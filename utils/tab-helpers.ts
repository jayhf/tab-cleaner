export function baseUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url || '';
  }
}

export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export interface FormattedTab {
  id: number;
  title: string;
  url: string;
  favIconUrl: string;
  lastAccessed: number;
  windowId: number;
  active: boolean;
  pinned: boolean;
  incognito: boolean;
}

export interface TabExportData {
  version: number;
  exportedAt: string;
  tabs: {
    url: string;
    title: string;
    pinned: boolean;
    incognito: boolean;
    window: number;
  }[];
}

export function formatTab(t: Browser.tabs.Tab): FormattedTab {
  return {
    id: t.id!,
    title: t.title || '',
    url: t.url || '',
    favIconUrl: t.favIconUrl || '',
    lastAccessed: (t as any).lastAccessed || 0,
    windowId: t.windowId!,
    active: t.active || false,
    pinned: t.pinned || false,
    incognito: t.incognito,
  };
}
