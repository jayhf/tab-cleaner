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
      default_icon: {
        16: 'icon.svg',
        32: 'icon.svg',
        48: 'icon.svg',
        96: 'icon.svg',
      },
    },
    icons: {
      16: 'icon.svg',
      32: 'icon.svg',
      48: 'icon.svg',
      96: 'icon.svg',
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
