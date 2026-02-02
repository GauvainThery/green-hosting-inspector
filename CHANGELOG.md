# Change Log

All notable changes to the "green-hosting-inspector" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
