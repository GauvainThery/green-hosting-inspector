# Change Log

All notable changes to the "green-hosting-inspector" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [2.2.0] - 2026-02-06

### Added

- **Expanded language support**: Added support for React variants (javascriptreact, typescriptreact), CSS preprocessors (sass, less), JSON with comments (jsonc), and template engines (astro, handlebars, ejs, twig, razor, blade).

### Fixed

- **Improved domain regex**: Enhanced pattern matching to exclude underscored identifiers, preventing false positives with variable names containing underscores.

## [2.1.0] - 2026-02-06

### Added

- **Repository Metrics Dashboard**: New command to view workspace-wide green hosting statistics.
  - Summary cards showing total URLs, unique domains, green vs not-verified counts
  - Visual percentage bar displaying green hosting ratio at a glance
  - Detailed table with each domain's status, hosting provider, and file locations
  - One-click refresh to rescan the workspace
  - Legend explaining green/yellow indicators
  - Display of scan limits and exclusions
- **Welcome message**: Shows informational message on extension activation with quick access to metrics dashboard.

### Improved

- **Code organization**: Refactored shared domain validation logic into `domainUtils.ts` module for better maintainability.
- **Performance**: Moved supported languages to module-level Set constant to avoid recreation on every decoration.
- **Type safety**: Added `DomainCheckResult` interface for better type consistency across modules.

## [2.0.2] - 2026-02-02

### Fixed

- **Improved code pattern filtering**: Better detection of code constructs vs real URLs.
  - Added comprehensive keyword exclusion list (logger, this, console, import, etc.)
  - Excludes patterns preceded by `identifier.` or followed by `(`

## [2.0.1] - 2026-02-02

### Fixed

- **Fixed API reliability**: Switched from batch API to parallel individual domain checks for more reliable results.
- **Fixed decorations disappearing**: Decorations now persist when closing and reopening files.

## [2.0.0] - 2026-02-02

### Improved

- **Better URL detection**: Now detects URLs in comments, inside longer strings, and bare domains without protocol (e.g., `google.com`).
- **Batch API calls**: Multiple domains are checked in a single API request for better performance.
- **Persistent cache**: Cache survives VS Code restarts (stored in global state).
- **Smarter scanning**: Documents are only re-scanned when content actually changes.

### Changed

- **New visual style**: Subtle colored dot before URLs instead of background highlighting.
  - 🟢 Green dot: Verified green hosting
  - 🟡 Yellow dot: No evidence of green hosting
- **Improved hover messages**: Clearer explanations following Green Web Foundation's terminology.
- **Reduced false positives**: Better filtering to avoid matching file extensions like `.json`, `.ts`, etc.

### Fixed

- Fixed issue where only the domain was highlighted instead of the full URL.
- Fixed redundant scanning of all visible editors.

## [1.0.0] - 2025-04-03

### Added

- Initial release of the Green Hosting Inspector.
- Automatically detects URLs in supported file types and checks if they are hosted on green hosting providers using the Green Web Foundation API.
- Highlights green-hosted URLs in green and non-green-hosted URLs in red.
- Provides hover information with hosting details.
- Caches results for a week to improve performance.
- Supports multiple programming languages and file types.
