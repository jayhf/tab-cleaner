# Tab Manager MCP

## Feature Parity

Chrome (`chrome/`) and Firefox (`firefox/`) extensions must maintain feature parity. When adding or modifying a feature, apply the change to both browsers. The only intentional differences are:

- `manifest.json`: Firefox uses `browser_specific_settings` and `background.scripts`; Chrome uses `service_worker`
- Firefox JS uses `browser.*` API namespace; Chrome uses `chrome.*`
- Firefox labels private browsing as "Private"; Chrome uses "Incognito"

The export/import JSON format is shared across browsers — a file exported from Chrome can be imported into Firefox and vice versa.
