# opencode-antigravity-web

Web search and URL reading plugin for [OpenCode](https://opencode.ai) using Antigravity (Google CloudCode) API.

## Features

- **search_web**: Search Google for documentation, error fixes, or general info with source citations
- **read_url_content**: Fetch and read the text content of a specific URL

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

## Related Plugins

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Authentication (required)
- [opencode-antigravity-img](https://github.com/ominiverdi/opencode-antigravity-img) - Image generation with Gemini

## License

MIT
