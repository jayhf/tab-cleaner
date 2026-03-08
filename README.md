# Tab Cleaner

Chrome extension for managing tabs with optional MCP support for Claude.

## Features

- Tabs grouped by domain, sorted by last accessed time
- Duplicate tab detection (same URL, different query params) with "Keep 1" and "Close All" buttons
- Cleanup rules: mark domains for auto-cleanup, then close all matching tabs with one click
- Merge all windows into one
- Search/filter across all tabs
- Click any tab to switch to it

## Install

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `chrome/`

## MCP Setup (optional)

Lets Claude list, search, and close your tabs.

```bash
cd mcp-server && npm install
claude mcp add tab-manager -- node /absolute/path/to/mcp-server/server.js
```

The extension auto-connects to the MCP server when it's running. No errors when it's not.
