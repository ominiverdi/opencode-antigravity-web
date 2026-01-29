import {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  GOOGLE_TOKEN_URL,
  CLOUDCODE_ENDPOINTS,
  CLOUDCODE_HEADERS,
  CLOUDCODE_METADATA,
  SEARCH_TIMEOUT_MS,
  SEARCH_THINKING_BUDGET_FAST,
  SEARCH_THINKING_BUDGET_DEEP,
} from "./constants";
import type {
  Account,
  TokenResponse,
  LoadCodeAssistResponse,
  AntigravitySearchResponse,
  AvailableModelsResponse,
  SearchResult,
  SearchArgs,
  ReadUrlArgs,
} from "./types";

/**
 * Refresh an access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: ANTIGRAVITY_CLIENT_ID,
    client_secret: ANTIGRAVITY_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed (${response.status})`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Load code assist info to get project ID
 */
export async function loadCodeAssist(accessToken: string): Promise<LoadCodeAssistResponse> {
  for (const endpoint of CLOUDCODE_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers: {
          ...CLOUDCODE_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ metadata: CLOUDCODE_METADATA }),
      });

      if (response.ok) {
        return (await response.json()) as LoadCodeAssistResponse;
      }
    } catch {
      continue;
    }
  }
  throw new Error("loadCodeAssist failed on all endpoints");
}

/**
 * Extract project ID from cloudaicompanionProject field
 */
export function extractProjectId(project: string | { id?: string } | undefined): string | undefined {
  if (!project) return undefined;
  if (typeof project === "string") return project;
  return project.id;
}

/**
 * Fetch available models from CloudCode API
 */
export async function fetchAvailableModels(accessToken: string): Promise<AvailableModelsResponse | null> {
  for (const endpoint of CLOUDCODE_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
        method: "POST",
        headers: {
          ...CLOUDCODE_HEADERS,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        return (await response.json()) as AvailableModelsResponse;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Get sorted list of models to try for search/URL reading
 * Priority: recommended models with quota > 0, sorted by quota remaining
 * Returns empty array if no models available (caller should handle this)
 */
export function getSearchModels(modelsResponse: AvailableModelsResponse | null): string[] {
  if (!modelsResponse?.models) {
    return [];
  }

  const models = modelsResponse.models;
  
  // Get recommended model order from agentModelSorts
  const recommendedOrder = modelsResponse.agentModelSorts?.[0]?.groups?.[0]?.modelIds || [];
  
  // Build list of models with their info
  const modelList: Array<{ id: string; quota: number; isRecommended: boolean; order: number }> = [];
  
  for (const [modelId, info] of Object.entries(models)) {
    const quota = info.quotaInfo?.remainingFraction ?? 0;
    
    // Skip models with no quota
    if (quota <= 0) continue;
    
    // Skip internal/non-agent models
    if (modelId.startsWith("chat_") || modelId.startsWith("tab_")) continue;
    
    const order = recommendedOrder.indexOf(modelId);
    modelList.push({
      id: modelId,
      quota,
      isRecommended: info.recommended === true,
      order: order >= 0 ? order : 999,
    });
  }

  // Sort: recommended first, then by order in recommended list, then by quota
  modelList.sort((a, b) => {
    // Recommended models first
    if (a.isRecommended !== b.isRecommended) {
      return a.isRecommended ? -1 : 1;
    }
    // Then by order in recommended list
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    // Then by quota remaining
    return b.quota - a.quota;
  });

  return modelList.map(m => m.id);
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse search response from CloudCode API
 */
function parseSearchResponse(data: AntigravitySearchResponse): SearchResult {
  const result: SearchResult = {
    text: "",
    sources: [],
    searchQueries: [],
    urlsRetrieved: [],
  };

  const response = data.response;
  if (!response || !response.candidates || response.candidates.length === 0) {
    if (data.error) {
      result.text = `Error: ${data.error.message ?? "Unknown error"}`;
    } else if (response?.error) {
      result.text = `Error: ${response.error.message ?? "Unknown error"}`;
    }
    return result;
  }

  const candidate = response.candidates[0];
  if (!candidate) {
    return result;
  }

  // Extract text content
  if (candidate.content?.parts) {
    result.text = candidate.content.parts
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  // Extract grounding metadata (sources)
  if (candidate.groundingMetadata) {
    const gm = candidate.groundingMetadata;

    if (gm.webSearchQueries) {
      result.searchQueries = gm.webSearchQueries;
    }

    if (gm.groundingChunks) {
      for (const chunk of gm.groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          result.sources.push({
            title: chunk.web.title,
            url: chunk.web.uri,
          });
        }
      }
    }
  }

  // Extract URL context metadata
  if (candidate.urlContextMetadata?.url_metadata) {
    for (const meta of candidate.urlContextMetadata.url_metadata) {
      if (meta.retrieved_url) {
        result.urlsRetrieved.push({
          url: meta.retrieved_url,
          status: meta.url_retrieval_status ?? "UNKNOWN",
        });
      }
    }
  }

  return result;
}

/**
 * Format search result as markdown
 */
function formatSearchResult(result: SearchResult): string {
  const lines: string[] = [];

  lines.push("## Search Results\n");
  lines.push(result.text);
  lines.push("");

  if (result.sources.length > 0) {
    lines.push("### Sources");
    for (const source of result.sources) {
      lines.push(`- [${source.title}](${source.url})`);
    }
    lines.push("");
  }

  if (result.urlsRetrieved.length > 0) {
    lines.push("### URLs Retrieved");
    for (const url of result.urlsRetrieved) {
      const status = url.status === "URL_RETRIEVAL_STATUS_SUCCESS" ? "[OK]" : "[FAILED]";
      lines.push(`- ${status} ${url.url}`);
    }
    lines.push("");
  }

  if (result.searchQueries.length > 0) {
    lines.push("### Search Queries Used");
    for (const q of result.searchQueries) {
      lines.push(`- "${q}"`);
    }
  }

  return lines.join("\n");
}

const SEARCH_SYSTEM_INSTRUCTION = `You are an expert web search assistant with access to Google Search and URL analysis tools.

Your capabilities:
- Use google_search to find real-time information from the web
- Use url_context to fetch and analyze content from specific URLs when provided

Guidelines:
- Always provide accurate, well-sourced information
- Cite your sources when presenting facts
- If analyzing URLs, extract the most relevant information
- Be concise but comprehensive in your responses
- If information is uncertain or conflicting, acknowledge it
- Focus on answering the user's question directly`;

interface SearchAttemptError {
  model: string;
  endpoint: string;
  status?: number;
  reason?: string;
  message: string;
}

/**
 * Execute a web search using CloudCode API with model and endpoint fallback
 */
export async function executeSearch(
  account: Account,
  args: SearchArgs,
  abortSignal?: AbortSignal
): Promise<string> {
  const errors: SearchAttemptError[] = [];

  try {
    const accessToken = await refreshAccessToken(account.refreshToken);

    // Get project ID
    let projectId = account.projectId || account.managedProjectId;
    if (!projectId) {
      const codeAssist = await loadCodeAssist(accessToken);
      projectId = extractProjectId(codeAssist.cloudaicompanionProject);
    }

    if (!projectId) {
      return formatSearchError("Configuration Error", "Could not determine project ID. Please re-authenticate.");
    }

    // Fetch available models dynamically
    const modelsResponse = await fetchAvailableModels(accessToken);
    const searchModels = getSearchModels(modelsResponse);

    if (searchModels.length === 0) {
      return formatSearchError(
        "No Models Available",
        "Could not fetch available models from the API. Please try again later or check your authentication."
      );
    }

    const { query, urls, thinking = true } = args;

    // Build prompt
    let prompt = query;
    if (urls && urls.length > 0) {
      const urlList = urls.join("\n");
      prompt = `${query}\n\nURLs to analyze:\n${urlList}`;
    }

    // Configure tools
    const tools: Array<Record<string, unknown>> = [];
    tools.push({ googleSearch: {} });
    if (urls && urls.length > 0) {
      tools.push({ urlContext: {} });
    }

    const thinkingBudget = thinking ? SEARCH_THINKING_BUDGET_DEEP : SEARCH_THINKING_BUDGET_FAST;

    // Try each model with each endpoint
    for (const model of searchModels) {
      for (const endpoint of CLOUDCODE_ENDPOINTS) {
        try {
          const requestPayload = {
            systemInstruction: {
              parts: [{ text: SEARCH_SYSTEM_INSTRUCTION }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            tools,
            generationConfig: {
              thinkingConfig: {
                thinkingBudget,
                includeThoughts: false,
              },
            },
          };

          const wrappedBody = {
            project: projectId,
            model,
            userAgent: "antigravity",
            requestId: generateRequestId(),
            request: {
              ...requestPayload,
              sessionId: generateSessionId(),
            },
          };

          const response = await fetch(`${endpoint}/v1internal:generateContent`, {
            method: "POST",
            headers: {
              ...CLOUDCODE_HEADERS,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(wrappedBody),
            signal: abortSignal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS),
          });

          if (response.ok) {
            const data = (await response.json()) as AntigravitySearchResponse;
            const result = parseSearchResponse(data);
            if (result.text && !result.text.startsWith("Error:")) {
              return formatSearchResult(result);
            }
          }

          // Parse error for fallback decision
          const errorText = await response.text();
          let errorInfo: { reason?: string; message?: string } = {};
          try {
            const errorJson = JSON.parse(errorText);
            errorInfo = {
              reason: errorJson.error?.details?.[0]?.reason,
              message: errorJson.error?.message,
            };
          } catch {
            errorInfo.message = errorText.slice(0, 200);
          }

          errors.push({
            model,
            endpoint: endpoint.replace("https://", "").replace(".googleapis.com", ""),
            status: response.status,
            reason: errorInfo.reason,
            message: errorInfo.message || response.statusText,
          });

          // If capacity exhausted or rate limited, try next model/endpoint
          if (response.status === 503 || response.status === 429) {
            continue;
          }

          // For other errors (4xx), skip to next model
          if (response.status >= 400 && response.status < 500) {
            break;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({
            model,
            endpoint: endpoint.replace("https://", "").replace(".googleapis.com", ""),
            message,
          });
          continue;
        }
      }
    }

    // All attempts failed
    return formatSearchError("All Models Unavailable", buildErrorSummary(errors));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return formatSearchError("Search Failed", message);
  }
}

/**
 * Format a search error with clear structure
 */
function formatSearchError(title: string, details: string): string {
  return `## Search Error: ${title}\n\n${details}\n\n**Tip:** This is usually a temporary issue. Try again in a few minutes.`;
}

/**
 * Build a summary of all failed attempts
 */
function buildErrorSummary(errors: SearchAttemptError[]): string {
  if (errors.length === 0) {
    return "No specific error information available.";
  }

  const lines: string[] = ["Tried the following models/endpoints:\n"];
  
  for (const err of errors) {
    const status = err.status ? `(${err.status})` : "";
    const reason = err.reason ? `[${err.reason}]` : "";
    lines.push(`- **${err.model}** @ ${err.endpoint} ${status} ${reason}`);
    if (err.message && !err.reason) {
      lines.push(`  ${err.message.slice(0, 100)}`);
    }
  }

  return lines.join("\n");
}

const READ_URL_SYSTEM_INSTRUCTION = `You are an expert content extractor. Your task is to fetch and analyze the content of the provided URL.

Guidelines:
- Extract the main content from the URL
- Summarize key points if the content is long
- Preserve important details, facts, and data
- Note if the URL couldn't be fetched or had issues
- Format the output in a clear, readable way`;

/**
 * Read and extract content from a URL using CloudCode API with fallback
 */
export async function readUrlContent(
  account: Account,
  args: ReadUrlArgs,
  abortSignal?: AbortSignal
): Promise<string> {
  const errors: SearchAttemptError[] = [];

  try {
    const accessToken = await refreshAccessToken(account.refreshToken);

    // Get project ID
    let projectId = account.projectId || account.managedProjectId;
    if (!projectId) {
      const codeAssist = await loadCodeAssist(accessToken);
      projectId = extractProjectId(codeAssist.cloudaicompanionProject);
    }

    if (!projectId) {
      return formatSearchError("Configuration Error", "Could not determine project ID. Please re-authenticate.");
    }

    // Fetch available models dynamically
    const modelsResponse = await fetchAvailableModels(accessToken);
    const searchModels = getSearchModels(modelsResponse);

    if (searchModels.length === 0) {
      return formatSearchError(
        "No Models Available",
        "Could not fetch available models from the API. Please try again later or check your authentication."
      );
    }

    const { url: targetUrl, thinking = false } = args;
    const thinkingBudget = thinking ? SEARCH_THINKING_BUDGET_DEEP : SEARCH_THINKING_BUDGET_FAST;

    // Try each model with each endpoint
    for (const model of searchModels) {
      for (const endpoint of CLOUDCODE_ENDPOINTS) {
        try {
          const requestPayload = {
            systemInstruction: {
              parts: [{ text: READ_URL_SYSTEM_INSTRUCTION }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: `Fetch and extract the content from this URL: ${targetUrl}` }],
              },
            ],
            tools: [{ urlContext: {} }],
            generationConfig: {
              thinkingConfig: {
                thinkingBudget,
                includeThoughts: false,
              },
            },
          };

          const wrappedBody = {
            project: projectId,
            model,
            userAgent: "antigravity",
            requestId: generateRequestId(),
            request: {
              ...requestPayload,
              sessionId: generateSessionId(),
            },
          };

          const response = await fetch(`${endpoint}/v1internal:generateContent`, {
            method: "POST",
            headers: {
              ...CLOUDCODE_HEADERS,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(wrappedBody),
            signal: abortSignal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS),
          });

          if (response.ok) {
            const data = (await response.json()) as AntigravitySearchResponse;
            const result = parseSearchResponse(data);

            if (result.text && !result.text.startsWith("Error:")) {
              // Format specifically for URL content
              const lines: string[] = [];
              lines.push(`## Content from ${targetUrl}\n`);
              lines.push(result.text);

              if (result.urlsRetrieved.length > 0) {
                const urlStatus = result.urlsRetrieved[0];
                if (urlStatus && urlStatus.status !== "URL_RETRIEVAL_STATUS_SUCCESS") {
                  lines.push(`\n**Note:** URL retrieval status: ${urlStatus.status}`);
                }
              }

              return lines.join("\n");
            }
          }

          // Parse error for fallback decision
          const errorText = await response.text();
          let errorInfo: { reason?: string; message?: string } = {};
          try {
            const errorJson = JSON.parse(errorText);
            errorInfo = {
              reason: errorJson.error?.details?.[0]?.reason,
              message: errorJson.error?.message,
            };
          } catch {
            errorInfo.message = errorText.slice(0, 200);
          }

          errors.push({
            model,
            endpoint: endpoint.replace("https://", "").replace(".googleapis.com", ""),
            status: response.status,
            reason: errorInfo.reason,
            message: errorInfo.message || response.statusText,
          });

          // If capacity exhausted or rate limited, try next
          if (response.status === 503 || response.status === 429) {
            continue;
          }

          // For other errors, skip to next model
          if (response.status >= 400 && response.status < 500) {
            break;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({
            model,
            endpoint: endpoint.replace("https://", "").replace(".googleapis.com", ""),
            message,
          });
          continue;
        }
      }
    }

    // All attempts failed
    return formatSearchError("All Models Unavailable", buildErrorSummary(errors));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return formatSearchError("URL Read Failed", message);
  }
}
