import { type Plugin, tool } from "@opencode-ai/plugin";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import { CONFIG_PATHS } from "./constants";
import type { AccountsConfig, Account } from "./types";
import { executeSearch, readUrlContent } from "./api";

/**
 * Load accounts from config file
 */
async function loadAccounts(): Promise<AccountsConfig | null> {
  for (const configPath of CONFIG_PATHS) {
    if (existsSync(configPath)) {
      try {
        const content = await fs.readFile(configPath, "utf-8");
        return JSON.parse(content) as AccountsConfig;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Get the first available account
 */
async function getAccount(): Promise<Account | null> {
  const config = await loadAccounts();
  if (!config?.accounts?.length) return null;
  return config.accounts[0] || null;
}

export const plugin: Plugin = async (ctx) => {
  return {
    tool: {
      /**
       * Search the web using Google Search
       */
      search_web: tool({
        description:
          "Search the web using Google Search via Antigravity API. " +
          "Returns real-time information from the internet with source citations. " +
          "Use this when you need up-to-date information about current events, " +
          "documentation, error fixes, or any topic that may have changed. " +
          "You can also provide specific URLs to analyze along with your query.",
        args: {
          query: tool.schema
            .string()
            .describe("The search query or question to answer using web search"),
          urls: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe(
              "Optional list of specific URLs to fetch and analyze along with the search. " +
              "Include any URLs mentioned by the user here for direct analysis."
            ),
          thinking: tool.schema
            .boolean()
            .optional()
            .describe("Enable deep thinking for more thorough analysis (default: true)"),
        },
        async execute(args, context) {
          const { query, urls, thinking = true } = args;

          if (!query?.trim()) {
            return "Error: Please provide a search query.";
          }

          const account = await getAccount();
          if (!account) {
            return (
              "Error: No Antigravity account found.\n\n" +
              "Please install and configure opencode-antigravity-auth first:\n" +
              "  1. Add 'opencode-antigravity-auth' to your opencode plugins\n" +
              "  2. Run 'opencode auth login' and authenticate with Google\n\n" +
              `Checked paths:\n${CONFIG_PATHS.map((p) => `  - ${p}`).join("\n")}`
            );
          }

          context.metadata({ title: "Searching the web..." });

          const result = await executeSearch(
            account,
            { query, urls, thinking },
            context.abort
          );

          context.metadata({ title: "Search complete" });

          return result;
        },
      }),

      /**
       * Read content from a specific URL
       */
      read_url_content: tool({
        description:
          "Fetch and read the text content of a specific URL using Antigravity API. " +
          "Use this when you need to extract and analyze content from a webpage. " +
          "The content will be fetched and summarized with key information preserved.",
        args: {
          url: tool.schema
            .string()
            .describe("The URL to fetch and read content from"),
          thinking: tool.schema
            .boolean()
            .optional()
            .describe("Enable deep thinking for more thorough analysis (default: false)"),
        },
        async execute(args, context) {
          const { url, thinking = false } = args;

          if (!url?.trim()) {
            return "Error: Please provide a URL to read.";
          }

          // Basic URL validation
          try {
            new URL(url);
          } catch {
            return `Error: Invalid URL format: ${url}`;
          }

          const account = await getAccount();
          if (!account) {
            return (
              "Error: No Antigravity account found.\n\n" +
              "Please install and configure opencode-antigravity-auth first:\n" +
              "  1. Add 'opencode-antigravity-auth' to your opencode plugins\n" +
              "  2. Run 'opencode auth login' and authenticate with Google\n\n" +
              `Checked paths:\n${CONFIG_PATHS.map((p) => `  - ${p}`).join("\n")}`
            );
          }

          context.metadata({ title: `Reading ${new URL(url).hostname}...` });

          const result = await readUrlContent(
            account,
            { url, thinking },
            context.abort
          );

          context.metadata({ title: "URL content read" });

          return result;
        },
      }),
    },
  };
};

export default plugin;
