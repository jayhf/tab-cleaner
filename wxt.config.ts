import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser }) => ({
    name: 'Tab Manager MCP',
    description:
      browser === 'firefox'
        ? 'Firefox tab manager with MCP support for Claude'
        : 'Chrome tab manager with MCP support for Claude',
    permissions: ['tabs', 'alarms', 'storage'],
    incognito: 'spanning' as const,
    action: {
      default_title: 'Open Tab Manager',
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'tab-manager-mcp@jayf.engineer',
            },
          },
        }
      : {}),
  }),
});
