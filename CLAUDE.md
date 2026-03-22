# Tab Manager MCP

## Build System

Uses WXT (wxt.dev) with TypeScript. Single codebase produces both Chrome and Firefox builds.

- `npm run build` — Chrome output in `.output/chrome-mv3/`
- `npm run build:firefox` — Firefox output in `.output/firefox-mv2/`
- `npm run dev` / `npm run dev:firefox` — dev mode with HMR

Browser-specific differences (Incognito vs Private labels, manifest fields) are handled at runtime or in `wxt.config.ts`. No code duplication.

## Feature Parity

Chrome and Firefox extensions must maintain feature parity. The only intentional differences are:

- Firefox labels private browsing as "Private"; Chrome uses "Incognito" (detected at runtime via user agent)
- Manifest differences are handled automatically by WXT

The export/import JSON format is shared across browsers — a file exported from Chrome can be imported into Firefox and vice versa.
