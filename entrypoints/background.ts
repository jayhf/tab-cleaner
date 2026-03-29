import { formatTab, type FormattedTab } from '@/utils/tab-helpers';

interface McpMessage {
  id: string;
  type: 'list_tabs' | 'close_tabs' | 'search_tabs';
  includeIncognito?: boolean;
  tabIds?: number[];
  query?: string;
}

export default defineBackground(() => {
  let ws: WebSocket | null = null;
  let mcpAvailable = false;

  async function checkAndConnect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    try {
      await fetch('http://localhost:18247', { mode: 'no-cors' });
      mcpAvailable = true;
    } catch {
      mcpAvailable = false;
      return;
    }
    try {
      ws = new WebSocket('ws://localhost:18247');
      ws.onmessage = async (event) => {
        const msg: McpMessage = JSON.parse(event.data);
        let response: Record<string, unknown> | undefined;
        try {
          if (msg.type === 'list_tabs') {
            const tabs = await browser.tabs.query({});
            const visible = msg.includeIncognito ? tabs : tabs.filter((t) => !t.incognito);
            response = { id: msg.id, tabs: visible.map(formatTab) };
          } else if (msg.type === 'close_tabs') {
            await browser.tabs.remove(msg.tabIds!);
            response = { id: msg.id, success: true, closed: msg.tabIds };
          } else if (msg.type === 'search_tabs') {
            const tabs = await browser.tabs.query({});
            const q = msg.query!.toLowerCase();
            const visible = msg.includeIncognito ? tabs : tabs.filter((t) => !t.incognito);
            const matches = visible.filter(
              (t) =>
                (t.title || '').toLowerCase().includes(q) ||
                (t.url || '').toLowerCase().includes(q),
            );
            response = { id: msg.id, tabs: matches.map(formatTab) };
          }
        } catch (err: unknown) {
          response = { id: msg.id, error: (err as Error).message };
        }
        if (response && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(response));
        }
      };
      ws.onclose = () => {
        ws = null;
      };
      ws.onerror = () => {
        ws = null;
      };
    } catch {
      ws = null;
    }
  }

  browser.alarms.create('keepalive', { periodInMinutes: 0.5 });
  browser.alarms.onAlarm.addListener(() => checkAndConnect());

  const action = browser.action || browser.browserAction;
  action.onClicked.addListener(async () => {
    const managerUrl = browser.runtime.getURL('/tabs.html');
    const existing = await browser.tabs.query({ url: managerUrl });
    if (existing.length > 0) {
      browser.tabs.update(existing[0].id!, { active: true });
      browser.windows.update(existing[0].windowId!, { focused: true });
    } else {
      browser.tabs.create({ url: managerUrl });
    }
  });

  checkAndConnect();
});
