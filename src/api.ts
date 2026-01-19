import {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  GOOGLE_TOKEN_URL,
  CLOUDCODE_BASE_URL,
  CLOUDCODE_HEADERS,
  CLOUDCODE_METADATA,
  SEARCH_MODEL,
  SEARCH_TIMEOUT_MS,
  SEARCH_THINKING_BUDGET_FAST,
  SEARCH_THINKING_BUDGET_DEEP,
} from "./constants";
import type {
  Account,
  TokenResponse,
  LoadCodeAssistResponse,
  AntigravitySearchResponse,
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
  const response = await fetch(`${CLOUDCODE_BASE_URL}/v1internal:loadCodeAssist`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...CLOUDCODE_HEADERS,
    },
    body: JSON.stringify({ metadata: CLOUDCODE_METADATA }),
  });

  if (!response.ok) {
    throw new Error(`loadCodeAssist failed (${response.status})`);
  }

  return (await response.json()) as LoadCodeAssistResponse;
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

/**
 * Execute a web search using CloudCode API
 */
export async function executeSearch(
  account: Account,
  args: SearchArgs,
  abortSignal?: AbortSignal
): Promise<string> {
  try {
    const accessToken = await refreshAccessToken(account.refreshToken);

    // Get project ID
    let projectId = account.projectId || account.managedProjectId;
    if (!projectId) {
      const codeAssist = await loadCodeAssist(accessToken);
      projectId = extractProjectId(codeAssist.cloudaicompanionProject);
    }

    if (!projectId) {
      return "Error: Could not determine project ID";
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
      model: SEARCH_MODEL,
      userAgent: "antigravity",
      requestId: generateRequestId(),
      request: {
        ...requestPayload,
        sessionId: generateSessionId(),
      },
    };

    const url = `${CLOUDCODE_BASE_URL}/v1internal:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...CLOUDCODE_HEADERS,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wrappedBody),
      signal: abortSignal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `## Search Error\n\nFailed to execute search: ${response.status} ${response.statusText}\n\n${errorText.slice(0, 500)}`;
    }

    const data = (await response.json()) as AntigravitySearchResponse;
    const result = parseSearchResponse(data);
    return formatSearchResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `## Search Error\n\nFailed to execute search: ${message}`;
  }
}

const READ_URL_SYSTEM_INSTRUCTION = `You are an expert content extractor. Your task is to fetch and analyze the content of the provided URL.

Guidelines:
- Extract the main content from the URL
- Summarize key points if the content is long
- Preserve important details, facts, and data
- Note if the URL couldn't be fetched or had issues
- Format the output in a clear, readable way`;

/**
 * Read and extract content from a URL using CloudCode API
 */
export async function readUrlContent(
  account: Account,
  args: ReadUrlArgs,
  abortSignal?: AbortSignal
): Promise<string> {
  try {
    const accessToken = await refreshAccessToken(account.refreshToken);

    // Get project ID
    let projectId = account.projectId || account.managedProjectId;
    if (!projectId) {
      const codeAssist = await loadCodeAssist(accessToken);
      projectId = extractProjectId(codeAssist.cloudaicompanionProject);
    }

    if (!projectId) {
      return "Error: Could not determine project ID";
    }

    const { url: targetUrl, thinking = false } = args;

    const thinkingBudget = thinking ? SEARCH_THINKING_BUDGET_DEEP : SEARCH_THINKING_BUDGET_FAST;

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
      model: SEARCH_MODEL,
      userAgent: "antigravity",
      requestId: generateRequestId(),
      request: {
        ...requestPayload,
        sessionId: generateSessionId(),
      },
    };

    const apiUrl = `${CLOUDCODE_BASE_URL}/v1internal:generateContent`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        ...CLOUDCODE_HEADERS,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wrappedBody),
      signal: abortSignal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `## URL Read Error\n\nFailed to read URL: ${response.status} ${response.statusText}\n\n${errorText.slice(0, 500)}`;
    }

    const data = (await response.json()) as AntigravitySearchResponse;
    const result = parseSearchResponse(data);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `## URL Read Error\n\nFailed to read URL: ${message}`;
  }
}
