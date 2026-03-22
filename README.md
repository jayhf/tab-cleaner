# Tab Cleaner

Browser extension for managing tabs with optional MCP support for Claude. Supports Chrome and Firefox from a single codebase using WXT.

## Features

- Tabs grouped by domain, sorted by last accessed time
- Duplicate tab detection (same URL, different query params) with "Keep 1" and "Close All" buttons
- Cleanup rules: mark domains for auto-cleanup, then close all matching tabs with one click
- Merge all windows into one
- Export/import all tabs to a JSON file (preserves window groupings and incognito/private state)
- Incognito/private browsing tab support with visibility toggle
- Search/filter across all tabs
- Click any tab to switch to it

## Prerequisites

- Node.js (for building and MCP server)

## Build

```bash
npm install
npm run build           # Chrome → .output/chrome-mv3/
npm run build:firefox   # Firefox → .output/firefox-mv2/
```

## Development

```bash
npm run dev             # Chrome with hot reload
npm run dev:firefox     # Firefox with hot reload
```

## Install

### Chrome

1. Run `npm run build`
2. Go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `.output/chrome-mv3/`

### Firefox

1. Run `npm run build:firefox`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** → select any file in `.output/firefox-mv2/`

### Incognito / Private Browsing

To manage incognito/private tabs, enable the extension in private mode:

- **Chrome**: `chrome://extensions/` → Tab Manager MCP → Details → Allow in Incognito
- **Firefox**: `about:addons` → Tab Manager MCP → Allow in Private Windows

## MCP Setup (optional)

Lets Claude list, search, and close your tabs.

```bash
cd mcp-server && npm install
claude mcp add tab-manager -- node /absolute/path/to/mcp-server/server.js
```

The extension auto-connects to the MCP server when it's running. No errors when it's not.
