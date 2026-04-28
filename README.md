# BitNinja IssueTracker (Chrome/Edge)

BitNinja IssueTracker is a Chrome/Edge extension used by the BitNinja support team to create, browse, and manage IssueTracker tickets faster with a streamlined internal UI.

## Current Version

`2.0.0`

## Features

- Create issues from supported support platforms.
- Open a management dashboard for issue search and triage.
- Track ongoing issues and support actions.
- Risk Center view for high-priority users.
- Extension settings page for API endpoints and keys.

## Requirements

- Google Chrome (Chromium-based)
- Microsoft Edge (Chromium-based)
- Node.js + npm (for local development/build)

## Local Development

1. Clone repository:
   - `git clone https://github.com/sqpp/bn-issuetracker-chrome.git`
2. Install dependencies:
   - `npm install`
3. Build styles for development:
   - `npm run dev`
4. Build minified production styles:
   - `npm run build`

## Build and Packaging

- Build extension-ready `dist/` folder:
  - `npm run build:dist`
- Build and create `dist.zip`:
  - `npm run package:dist`
- Build and create `dist.zip` + CRX package:
  - `npm run package:release`

## Load Extension Locally

1. Build release assets (`npm run package:dist`) or make sure project files are up to date.
2. Open extension management page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project root (or `dist/` if you use packaged build output).

## Configuration

Open **Settings** from the extension UI and provide:

- `Username`: IssueTracker username
- `IssueTracker API URL`
- `IssueTracker API Key`
- `Management UI URL` (optional)
- `Intercom API Key` (optional)
- `JIRA API Key` (optional)
- `Zendesk API Key` (optional)

Then click **Update Settings**.

## Tech Stack

- HTML
- CSS
- JavaScript
- [Tailwind CSS](https://tailwindcss.com)

## Author

[Marcell Csendes](https://twitter.com/csendesmarcell)
