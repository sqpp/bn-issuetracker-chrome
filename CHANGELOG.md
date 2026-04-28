# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-28

### Added
- New management dashboard page for issue operations (`management.html`, `management.js`).
- Dist build automation scripts for reproducible packaging (`scripts/build-dist.js`, `scripts/pack-crx.ps1`).
- Vendor icon font assets (Line Awesome) for updated UI icons.
- Management and triage oriented extension workflow.
- Packaging pipeline for `dist/`, zip artifacts, and CRX generation.

### Changed
- Refreshed extension UI/UX styling across popup, settings, and management pages.
- Updated build/package scripts and release workflow in `package.json`.
- Updated extension assets and distribution output under `dist/`.
- Manifest and extension pages updated for the v2 architecture.
- Core scripts and frontend assets modernized.

### Fixed
- Improved issue submission logging and API response diagnostics for failed requests.
