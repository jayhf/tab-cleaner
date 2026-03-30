const container = document.getElementById('container')!;
const searchInput = document.getElementById('search') as HTMLInputElement;
const statsEl = document.getElementById('stats')!;
const cleanupBtn = document.getElementById('cleanup-btn') as HTMLButtonElement;
const editRulesBtn = document.getElementById('edit-rules-btn')!;
const rulesPanel = document.getElementById('rules-panel')!;
const rulesList = document.getElementById('rules-list')!;
const rulesEmpty = document.getElementById('rules-empty')!;
const showIncognitoCheckbox = document.getElementById('show-incognito') as HTMLInputElement;
const incognitoLabel = document.getElementById('incognito-label')!;

let allTabs: Browser.tabs.Tab[] = [];
let cleanupRules: string[] = [];
let showIncognito = false;

// Set browser-appropriate labels
const isFirefox = navigator.userAgent.includes('Firefox');
if (isFirefox) {
  incognitoLabel.textContent = 'Private';
  document.documentElement.style.setProperty('--private-label', "'private'");
}

async function loadCleanupRules() {
  const data = await browser.storage.local.get('cleanupRules');
  cleanupRules = (data as Record<string, unknown>).cleanupRules as string[] || [];
  updateCleanupBtn();
  renderRules();
}

async function saveCleanupRules() {
  await browser.storage.local.set({ cleanupRules });
  updateCleanupBtn();
  renderRules();
}

async function addCleanupRule(domain: string) {
  if (!cleanupRules.includes(domain)) {
    cleanupRules.push(domain);
    cleanupRules.sort();
    await saveCleanupRules();
    rulesPanel.style.display = '';
  }
}

async function removeCleanupRule(domain: string) {
  cleanupRules = cleanupRules.filter((r) => r !== domain);
  await saveCleanupRules();
}

function updateCleanupBtn(tabCount?: number) {
  if (tabCount != null && tabCount > 0) {
    cleanupBtn.textContent = `Cleanup (${tabCount})`;
  } else if (cleanupRules.length > 0) {
    cleanupBtn.textContent = `Cleanup (...)`;
  } else {
    cleanupBtn.textContent = 'Cleanup';
  }
  cleanupBtn.disabled = cleanupRules.length === 0;
}

function renderRules() {
  rulesList.innerHTML = '';
  rulesEmpty.style.display = cleanupRules.length === 0 ? '' : 'none';
  for (const domain of cleanupRules) {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const label = document.createElement('span');
    label.className = 'rule-label';
    label.textContent = domain;
    row.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'rule-remove';
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => removeCleanupRule(domain));
    row.appendChild(removeBtn);

    rulesList.appendChild(row);
  }
  render();
}

async function runCleanup() {
  if (cleanupRules.length === 0) return;
  const tabs = await browser.tabs.query({});
  const toClose = tabs.filter((t) => {
    try {
      const domain = new URL(t.url!).hostname;
      return cleanupRules.includes(domain);
    } catch {
      return false;
    }
  });
  if (toClose.length === 0) return;
  await browser.tabs.remove(toClose.map((t) => t.id!));
  rulesPanel.style.display = 'none';
  loadTabs();
}

const mergeBtn = document.getElementById('merge-btn')!;

mergeBtn.addEventListener('click', async () => {
  const currentWindow = await browser.windows.getCurrent();
  const allWindows = await browser.windows.getAll({ populate: true });
  const tabIds: number[] = [];
  for (const win of allWindows) {
    if (win.id === currentWindow.id) continue;
    for (const tab of win.tabs!) {
      tabIds.push(tab.id!);
    }
  }
  if (tabIds.length > 0) {
    await browser.tabs.move(tabIds, { windowId: currentWindow.id!, index: -1 });
  }
  loadTabs();
});

const exportBtn = document.getElementById('export-btn')!;
const importBtn = document.getElementById('import-btn')!;
const importFile = document.getElementById('import-file') as HTMLInputElement;

exportBtn.addEventListener('click', async () => {
  const tabs = await browser.tabs.query({});
  const selfUrl = browser.runtime.getURL('/tabs.html');

  const windowIdMap: Record<number, number> = {};
  let nextWindow = 0;
  for (const tab of tabs) {
    if (!(tab.windowId! in windowIdMap)) {
      windowIdMap[tab.windowId!] = nextWindow++;
    }
  }

  const data: TabExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tabs: tabs
      .filter((t) => !t.url!.startsWith(selfUrl))
      .map((t) => ({
        url: t.url!,
        title: t.title || '',
        pinned: t.pinned || false,
        incognito: t.incognito,
        window: windowIdMap[t.windowId!],
      })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tabs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data: TabExportData = JSON.parse(text);
    if (!data.tabs || !Array.isArray(data.tabs)) {
      alert('Invalid tab export file.');
      return;
    }

    const byWindow: Record<string, { incognito: boolean; tabs: TabExportData['tabs'] }> = {};
    for (const tab of data.tabs) {
      const key = `${tab.incognito ? 'incognito' : 'regular'}-${tab.window ?? 0}`;
      if (!byWindow[key]) byWindow[key] = { incognito: tab.incognito || false, tabs: [] };
      byWindow[key].tabs.push(tab);
    }

    const failed: string[] = [];
    for (const group of Object.values(byWindow)) {
      const win = await browser.windows.create({ incognito: group.incognito });
      if (!win) continue;
      for (const tab of group.tabs) {
        try {
          await browser.tabs.create({
            windowId: win.id!,
            url: tab.url,
            pinned: tab.pinned || false,
          });
        } catch {
          failed.push(tab.url);
        }
      }
      const defaultTab = win.tabs?.[0];
      if (defaultTab) await browser.tabs.remove(defaultTab.id!);
    }

    if (failed.length > 0) {
      alert(`Failed to open ${failed.length} tab(s):\n${failed.join('\n')}`);
    }
    loadTabs();
  } catch (err: unknown) {
    alert('Failed to import tabs: ' + (err as Error).message);
  }
  importFile.value = '';
});

cleanupBtn.addEventListener('click', runCleanup);
editRulesBtn.addEventListener('click', () => {
  rulesPanel.style.display = rulesPanel.style.display === 'none' ? '' : 'none';
});

async function loadTabs() {
  allTabs = await browser.tabs.query({});
  render();
}

function render() {
  const query = searchInput.value.toLowerCase();
  const selfUrl = browser.runtime.getURL('/tabs.html');
  const filtered = allTabs.filter(
    (t) =>
      !t.url!.startsWith(selfUrl) &&
      (showIncognito || !t.incognito) &&
      ((t.title || '').toLowerCase().includes(query) || (t.url || '').toLowerCase().includes(query)),
  );

  const groups: Record<string, Browser.tabs.Tab[]> = {};
  for (const tab of filtered) {
    let domain = 'other';
    try {
      domain = new URL(tab.url!).hostname;
    } catch {}
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(tab);
  }

  for (const domain in groups) {
    groups[domain].sort(
      (a, b) => ((b as any).lastAccessed || 0) - ((a as any).lastAccessed || 0),
    );
  }

  const sortedDomains = Object.keys(groups).sort((a, b) => {
    const aCleanup = cleanupRules.includes(a) ? 1 : 0;
    const bCleanup = cleanupRules.includes(b) ? 1 : 0;
    if (aCleanup !== bCleanup) return aCleanup - bCleanup;
    return a.localeCompare(b);
  });

  const cleanupCount = filtered.filter((t) => {
    try {
      return cleanupRules.includes(new URL(t.url!).hostname);
    } catch {
      return false;
    }
  }).length;
  updateCleanupBtn(cleanupCount);
  statsEl.textContent =
    cleanupCount > 0
      ? `${filtered.length} tabs in ${sortedDomains.length} groups \u00b7 ${cleanupCount} marked for cleanup`
      : `${filtered.length} tabs in ${sortedDomains.length} groups`;

  container.innerHTML = '';
  for (const domain of sortedDomains) {
    const group = groups[domain];
    const groupEl = document.createElement('div');
    groupEl.className = 'group';

    const header = document.createElement('div');
    header.className = 'group-header';

    const domainSpan = document.createElement('span');
    domainSpan.className = 'domain';
    domainSpan.textContent = domain;

    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = ` (${group.length})`;
    domainSpan.appendChild(countSpan);

    const buttons = document.createElement('div');
    buttons.className = 'group-buttons';

    const toggleCleanupBtn = document.createElement('button');
    const inCleanup = cleanupRules.includes(domain);
    toggleCleanupBtn.className = inCleanup ? 'add-cleanup remove-cleanup' : 'add-cleanup';
    toggleCleanupBtn.textContent = inCleanup ? '\u2212 Cleanup' : '+ Cleanup';
    toggleCleanupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (inCleanup) {
        removeCleanupRule(domain);
      } else {
        addCleanupRule(domain);
      }
    });
    buttons.appendChild(toggleCleanupBtn);

    const closeAllBtn = document.createElement('button');
    closeAllBtn.className = 'close-group';
    closeAllBtn.textContent = 'Close All';
    closeAllBtn.addEventListener('click', async () => {
      const tabIds = group.map((t) => t.id!);
      await browser.tabs.remove(tabIds);
      loadTabs();
    });
    buttons.appendChild(closeAllBtn);

    header.appendChild(domainSpan);
    header.appendChild(buttons);
    groupEl.appendChild(header);

    const urlGroups: Record<string, Browser.tabs.Tab[]> = {};
    for (const tab of group) {
      const base = baseUrl(tab.url!);
      if (!urlGroups[base]) urlGroups[base] = [];
      urlGroups[base].push(tab);
    }

    const sortedBases = Object.keys(urlGroups).sort();
    for (const base of sortedBases) {
      const dupes = urlGroups[base];

      if (dupes.length > 1) {
        const subHeader = document.createElement('div');
        subHeader.className = 'url-subgroup-header';

        const pathLabel = document.createElement('span');
        pathLabel.className = 'subgroup-label';
        try {
          const u = new URL(base);
          pathLabel.textContent = `${u.pathname} (${dupes.length})`;
        } catch {
          pathLabel.textContent = `${base} (${dupes.length})`;
        }
        subHeader.appendChild(pathLabel);

        const subBtns = document.createElement('div');
        subBtns.className = 'group-buttons';

        const keepOneBtn = document.createElement('button');
        keepOneBtn.className = 'btn-keep-one';
        keepOneBtn.textContent = 'Keep 1';
        keepOneBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const toClose = dupes.slice(1).map((t) => t.id!);
          await browser.tabs.remove(toClose);
          loadTabs();
        });
        subBtns.appendChild(keepOneBtn);

        const closeAllDupesBtn = document.createElement('button');
        closeAllDupesBtn.className = 'close-group';
        closeAllDupesBtn.textContent = 'Close All';
        closeAllDupesBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await browser.tabs.remove(dupes.map((t) => t.id!));
          loadTabs();
        });
        subBtns.appendChild(closeAllDupesBtn);

        subHeader.appendChild(subBtns);
        groupEl.appendChild(subHeader);
      }

      for (const tab of dupes) {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        if (dupes.length > 1) tabEl.classList.add('tab-in-subgroup');
        if (tab.incognito) tabEl.classList.add('tab-incognito');

        if (tab.favIconUrl) {
          const img = document.createElement('img');
          img.className = 'favicon';
          img.src = tab.favIconUrl;
          img.onerror = () => {
            img.style.display = 'none';
          };
          tabEl.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'favicon-placeholder';
          tabEl.appendChild(placeholder);
        }

        const info = document.createElement('div');
        info.className = 'tab-info';

        const title = document.createElement('div');
        title.className = 'tab-title';
        title.textContent = tab.title || 'Untitled';
        info.appendChild(title);

        const url = document.createElement('div');
        url.className = 'tab-url';
        url.textContent = tab.url || '';
        info.appendChild(url);

        tabEl.appendChild(info);

        const lastAccessed = (tab as any).lastAccessed as number | undefined;
        if (lastAccessed) {
          const time = document.createElement('div');
          time.className = 'tab-time';
          time.textContent = formatTime(lastAccessed);
          tabEl.appendChild(time);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-tab';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          tabEl.classList.add('closing');
          await browser.tabs.remove(tab.id!);
          setTimeout(loadTabs, 300);
        });
        tabEl.appendChild(closeBtn);

        tabEl.addEventListener('click', () => {
          browser.tabs.update(tab.id!, { active: true });
          browser.windows.update(tab.windowId!, { focused: true });
        });

        groupEl.appendChild(tabEl);
      }
    }

    container.appendChild(groupEl);
  }
}

searchInput.addEventListener('input', render);

showIncognitoCheckbox.addEventListener('change', async () => {
  showIncognito = showIncognitoCheckbox.checked;
  await browser.storage.local.set({ showIncognito });
  render();
});

browser.tabs.onCreated.addListener(loadTabs);
browser.tabs.onRemoved.addListener(loadTabs);
browser.tabs.onUpdated.addListener(loadTabs);

async function init() {
  const data = await browser.storage.local.get('showIncognito');
  showIncognito = (data as Record<string, unknown>).showIncognito as boolean || false;
  showIncognitoCheckbox.checked = showIncognito;
  await loadCleanupRules();
  loadTabs();
}

init();
