# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-01-29

### Added
- Dynamic model selection - fetches available models from API instead of hardcoding
- Smart model sorting by recommended status and quota remaining
- Multiple endpoint fallback for better reliability
- Detailed error reporting showing which models/endpoints were tried

### Changed
- Uses non-sandbox endpoint as primary for better stability
- Improved error messages with actionable troubleshooting tips

### Fixed
- Handle MODEL_CAPACITY_EXHAUSTED errors by trying alternative models

## [0.1.0] - 2026-01-28

### Added
- Initial release
- `search_web` tool for Google search via Antigravity/CloudCode API
  - Returns real-time information with source citations
  - Optional URL analysis alongside search
  - Configurable thinking depth for thorough analysis
- `read_url_content` tool for fetching and extracting webpage content
  - Summarizes key information from URLs
  - Configurable thinking depth for analysis
- Cross-platform config path support (Windows, macOS, Linux)
- Legacy config path fallback for backwards compatibility
