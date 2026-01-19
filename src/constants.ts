import { homedir } from "os";
import { join } from "path";
import { platform } from "process";

// OAuth credentials (same as antigravity-auth plugin)
export const ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
export const ANTIGRAVITY_CLIENT_SECRET = "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";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// CloudCode API endpoints
export const CLOUDCODE_BASE_URL = "https://daily-cloudcode-pa.sandbox.googleapis.com";
export const CLOUDCODE_FALLBACK_URLS = [
  "https://daily-cloudcode-pa.sandbox.googleapis.com",
  "https://autopush-cloudcode-pa.sandbox.googleapis.com",
  "https://cloudcode-pa.googleapis.com",
];

export const CLOUDCODE_METADATA = {
  ideType: "ANTIGRAVITY",
  platform: "PLATFORM_UNSPECIFIED",
  pluginType: "GEMINI",
};

export const CLOUDCODE_HEADERS = {
  "User-Agent": "antigravity/1.11.5 windows/amd64",
  "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "Client-Metadata": '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

// Search configuration
export const SEARCH_MODEL = "gemini-2.5-flash";
export const SEARCH_TIMEOUT_MS = 60_000;
export const SEARCH_THINKING_BUDGET_FAST = 4096;
export const SEARCH_THINKING_BUDGET_DEEP = 16384;

// Config directory (match opencode-antigravity-auth behavior)
function getConfigDir(): string {
  if (platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode");
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "opencode");
}

// Config file paths (primary path matches auth plugin, fallback for legacy)
export const CONFIG_PATHS = [
  join(getConfigDir(), "antigravity-accounts.json"),
  join(homedir(), ".opencode", "antigravity-accounts.json"),
];
