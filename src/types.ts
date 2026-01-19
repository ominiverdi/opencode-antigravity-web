/**
 * Account stored in antigravity-accounts.json
 */
export interface Account {
  email?: string;
  refreshToken: string;
  accessToken?: string;
  projectId?: string;
  managedProjectId?: string;
}

/**
 * Accounts config file structure
 */
export interface AccountsConfig {
  accounts: Account[];
  activeIndex?: number;
  version?: number;
}

/**
 * Token refresh response
 */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * LoadCodeAssist response for getting project ID
 */
export interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string };
}

/**
 * Search grounding chunk
 */
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

/**
 * Search grounding support
 */
export interface GroundingSupport {
  segment?: {
    startIndex?: number;
    endIndex?: number;
    text?: string;
  };
  groundingChunkIndices?: number[];
}

/**
 * Search grounding metadata
 */
export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
  searchEntryPoint?: {
    renderedContent?: string;
  };
}

/**
 * URL context metadata
 */
export interface UrlMetadata {
  retrieved_url?: string;
  url_retrieval_status?: string;
}

export interface UrlContextMetadata {
  url_metadata?: UrlMetadata[];
}

/**
 * CloudCode search response
 */
export interface SearchResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
    finishReason?: string;
    groundingMetadata?: GroundingMetadata;
    urlContextMetadata?: UrlContextMetadata;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Wrapped Antigravity search response
 */
export interface AntigravitySearchResponse {
  response?: SearchResponse;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Parsed search result
 */
export interface SearchResult {
  text: string;
  sources: Array<{ title: string; url: string }>;
  searchQueries: string[];
  urlsRetrieved: Array<{ url: string; status: string }>;
}

/**
 * Search tool arguments
 */
export interface SearchArgs {
  query: string;
  urls?: string[];
  thinking?: boolean;
}

/**
 * Read URL tool arguments
 */
export interface ReadUrlArgs {
  url: string;
  thinking?: boolean;
}
