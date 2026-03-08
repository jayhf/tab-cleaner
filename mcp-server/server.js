import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

const PORT = 18247;
const wss = new WebSocketServer({ port: PORT });

let extensionSocket = null;
const pendingRequests = new Map();
let requestId = 0;

wss.on('connection', (socket) => {
  extensionSocket = socket;
  socket.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      pending.resolve(msg);
      pendingRequests.delete(msg.id);
    }
  });
  socket.on('close', () => {
    if (extensionSocket === socket) extensionSocket = null;
  });
});

function sendToExtension(msg, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== 1) {
      reject(new Error('Chrome extension not connected. Make sure the Tab Manager extension is installed and active.'));
      return;
    }
    const id = String(++requestId);
    msg.id = id;
    pendingRequests.set(id, { resolve, reject });
    extensionSocket.send(JSON.stringify(msg));
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Extension response timeout'));
      }
    }, timeoutMs);
  });
}

const server = new McpServer({
  name: 'tab-manager',
  version: '1.0.0',
});

server.tool(
  'list_tabs',
  'List all open Chrome tabs with their IDs, titles, URLs, and last accessed times',
  {},
  async () => {
    const result = await sendToExtension({ type: 'list_tabs' });
    return { content: [{ type: 'text', text: JSON.stringify(result.tabs, null, 2) }] };
  }
);

server.tool(
  'search_tabs',
  'Search Chrome tabs by title or URL',
  { query: z.string().describe('Search query to match against tab titles and URLs') },
  async ({ query }) => {
    const result = await sendToExtension({ type: 'search_tabs', query });
    return { content: [{ type: 'text', text: JSON.stringify(result.tabs, null, 2) }] };
  }
);

server.tool(
  'close_tabs',
  'Close Chrome tabs by their IDs',
  { tabIds: z.array(z.number()).describe('Array of tab IDs to close') },
  async ({ tabIds }) => {
    const result = await sendToExtension({ type: 'close_tabs', tabIds });
    return { content: [{ type: 'text', text: `Closed ${result.closed.length} tab(s)` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
