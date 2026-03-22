let ws = null;
let mcpAvailable = false;

async function checkAndConnect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  // Probe the port with fetch before opening a WebSocket to avoid console errors
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
      const msg = JSON.parse(event.data);
      let response;
      try {
        if (msg.type === 'list_tabs') {
          const tabs = await browser.tabs.query({});
          const visible = msg.includeIncognito ? tabs : tabs.filter(t => !t.incognito);
          response = { id: msg.id, tabs: visible.map(formatTab) };
        } else if (msg.type === 'close_tabs') {
          await browser.tabs.remove(msg.tabIds);
          response = { id: msg.id, success: true, closed: msg.tabIds };
        } else if (msg.type === 'search_tabs') {
          const tabs = await browser.tabs.query({});
          const q = msg.query.toLowerCase();
          const visible = msg.includeIncognito ? tabs : tabs.filter(t => !t.incognito);
          const matches = visible.filter(t =>
            (t.title || '').toLowerCase().includes(q) ||
            (t.url || '').toLowerCase().includes(q)
          );
          response = { id: msg.id, tabs: matches.map(formatTab) };
        }
      } catch (err) {
        response = { id: msg.id, error: err.message };
      }
      if (response && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    };
    ws.onclose = () => { ws = null; };
    ws.onerror = () => { ws = null; };
  } catch {
    ws = null;
  }
}

function formatTab(t) {
  return {
    id: t.id,
    title: t.title || '',
    url: t.url || '',
    favIconUrl: t.favIconUrl || '',
    lastAccessed: t.lastAccessed || 0,
    windowId: t.windowId,
    active: t.active,
    pinned: t.pinned,
    incognito: t.incognito,
  };
}

// Periodically reconnect WebSocket
browser.alarms.create('keepalive', { periodInMinutes: 0.5 });
browser.alarms.onAlarm.addListener(() => checkAndConnect());

// Open tab manager page on icon click (focus existing if already open)
browser.action.onClicked.addListener(async () => {
  const managerUrl = browser.runtime.getURL('tabs.html');
  const existing = await browser.tabs.query({ url: managerUrl });
  if (existing.length > 0) {
    browser.tabs.update(existing[0].id, { active: true });
    browser.windows.update(existing[0].windowId, { focused: true });
  } else {
    browser.tabs.create({ url: managerUrl });
  }
});

checkAndConnect();
