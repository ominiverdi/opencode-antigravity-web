# opencode-antigravity-web

[![npm version](https://img.shields.io/npm/v/opencode-antigravity-web.svg)](https://www.npmjs.com/package/opencode-antigravity-web)
[![npm downloads](https://img.shields.io/npm/dm/opencode-antigravity-web.svg)](https://www.npmjs.com/package/opencode-antigravity-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Web search and URL reading plugin for [OpenCode](https://opencode.ai) using Antigravity (Google CloudCode) API.

## Features

- **search_web**: Search Google for documentation, error fixes, or general info with source citations
- **read_url_content**: Fetch and read the text content of a specific URL
- **Dynamic model selection**: Automatically fetches available models and picks the best one
- **Smart fallback**: Tries multiple models and endpoints if one fails (capacity issues, rate limits)
- **Quota-aware**: Skips models with exhausted quota

## Prerequisites

This plugin requires authentication via the [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) plugin.

## Installation

Add the plugin to your OpenCode config (`opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "opencode-antigravity-auth",
    "opencode-antigravity-web"
  ]
}
```

Then authenticate:

```bash
opencode auth login
```

Choose "OAuth with Google (Antigravity)" and follow the browser flow.

## Tools

### search_web

Search the web using Google Search via Antigravity API.

**Arguments:**
- `query` (required): The search query or question
- `urls` (optional): List of specific URLs to analyze along with the search
- `thinking` (optional): Enable deep thinking for more thorough analysis (default: true)

**Example:**
```
Search for "typescript generics tutorial"
```

### read_url_content

Fetch and read the text content of a specific URL.

**Arguments:**
- `url` (required): The URL to fetch and read
- `thinking` (optional): Enable deep thinking for analysis (default: false)

**Example:**
```
Read the content from https://docs.example.com/api
```

## How It Works

The plugin dynamically fetches available models from Google's CloudCode API and selects the best one based on:

1. **Recommended models first** - prioritizes Google's recommended models
2. **Quota remaining** - skips models with exhausted quota
3. **Multiple endpoints** - tries fallback endpoints if primary fails

This means the plugin automatically adapts to new models as Google releases them, without requiring updates.

## Troubleshooting

### "No Models Available"
- Check your authentication with `opencode auth login`
- Verify your Google One AI Premium subscription is active

### "All Models Unavailable"
- This usually means temporary capacity issues on Google's servers
- The error will show which models/endpoints were tried
- Wait a few minutes and try again

## Related Plugins

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Authentication (required)
- [opencode-antigravity-img](https://github.com/ominiverdi/opencode-antigravity-img) - Image generation with Gemini

## Acknowledgments

This plugin was inspired by [opencode-google-antigravity-auth](https://github.com/shekohex/opencode-google-antigravity-auth) by shekohex.

## License

MIT
