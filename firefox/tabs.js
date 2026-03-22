const container = document.getElementById('container');
const searchInput = document.getElementById('search');
const statsEl = document.getElementById('stats');
const cleanupBtn = document.getElementById('cleanup-btn');
const editRulesBtn = document.getElementById('edit-rules-btn');
const rulesPanel = document.getElementById('rules-panel');
const rulesList = document.getElementById('rules-list');
const rulesEmpty = document.getElementById('rules-empty');
const showIncognitoCheckbox = document.getElementById('show-incognito');

let allTabs = [];
let cleanupRules = [];
let showIncognito = false;

async function loadCleanupRules() {
  const data = await browser.storage.local.get('cleanupRules');
  cleanupRules = data.cleanupRules || [];
  updateCleanupBtn();
  renderRules();
}

async function saveCleanupRules() {
  await browser.storage.local.set({ cleanupRules });
  updateCleanupBtn();
  renderRules();
}

async function addCleanupRule(domain) {
  if (!cleanupRules.includes(domain)) {
    cleanupRules.push(domain);
    cleanupRules.sort();
    await saveCleanupRules();
    rulesPanel.style.display = '';
  }
}

async function removeCleanupRule(domain) {
  cleanupRules = cleanupRules.filter(r => r !== domain);
  await saveCleanupRules();
}

function updateCleanupBtn(tabCount) {
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
  // Re-render tab list to update "+ Cleanup" button states
  render();
}

async function runCleanup() {
  if (cleanupRules.length === 0) return;
  const tabs = await browser.tabs.query({});
  const toClose = tabs.filter(t => {
    try {
      const domain = new URL(t.url).hostname;
      return cleanupRules.includes(domain);
    } catch { return false; }
  });
  if (toClose.length === 0) return;
  await browser.tabs.remove(toClose.map(t => t.id));
  rulesPanel.style.display = 'none';
  loadTabs();
}

const mergeBtn = document.getElementById('merge-btn');

mergeBtn.addEventListener('click', async () => {
  const currentWindow = await browser.windows.getCurrent();
  const allWindows = await browser.windows.getAll({ populate: true });
  const tabIds = [];
  for (const win of allWindows) {
    if (win.id === currentWindow.id) continue;
    for (const tab of win.tabs) {
      tabIds.push(tab.id);
    }
  }
  if (tabIds.length > 0) {
    await browser.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 });
  }
  loadTabs();
});

const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

exportBtn.addEventListener('click', async () => {
  const tabs = await browser.tabs.query({});
  const selfUrl = browser.runtime.getURL('tabs.html');

  const windowIdMap = {};
  let nextWindow = 0;
  for (const tab of tabs) {
    if (!(tab.windowId in windowIdMap)) {
      windowIdMap[tab.windowId] = nextWindow++;
    }
  }

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tabs: tabs
      .filter(t => !t.url.startsWith(selfUrl))
      .map(t => ({
        url: t.url,
        title: t.title || '',
        pinned: t.pinned || false,
        incognito: t.incognito || false,
        window: windowIdMap[t.windowId],
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
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.tabs || !Array.isArray(data.tabs)) {
      alert('Invalid tab export file.');
      return;
    }

    const byWindow = {};
    for (const tab of data.tabs) {
      const key = `${tab.incognito ? 'incognito' : 'regular'}-${tab.window ?? 0}`;
      if (!byWindow[key]) byWindow[key] = { incognito: tab.incognito || false, tabs: [] };
      byWindow[key].tabs.push(tab);
    }

    for (const group of Object.values(byWindow)) {
      const win = await browser.windows.create({ incognito: group.incognito });
      for (const tab of group.tabs) {
        await browser.tabs.create({
          windowId: win.id,
          url: tab.url,
          pinned: tab.pinned || false,
        });
      }
      const defaultTab = win.tabs?.[0];
      if (defaultTab) await browser.tabs.remove(defaultTab.id);
    }

    loadTabs();
  } catch (err) {
    alert('Failed to import tabs: ' + err.message);
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
  const selfUrl = browser.runtime.getURL('tabs.html');
  const filtered = allTabs.filter(t =>
    !t.url.startsWith(selfUrl) &&
    (showIncognito || !t.incognito) &&
    ((t.title || '').toLowerCase().includes(query) ||
    (t.url || '').toLowerCase().includes(query))
  );

  // Group by domain
  const groups = {};
  for (const tab of filtered) {
    let domain = 'other';
    try { domain = new URL(tab.url).hostname; } catch {}
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(tab);
  }

  // Sort tabs within groups by lastAccessed desc
  for (const domain in groups) {
    groups[domain].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }

  // Sort groups: non-cleanup first, then cleanup-marked, alphabetical within each
  const sortedDomains = Object.keys(groups).sort((a, b) => {
    const aCleanup = cleanupRules.includes(a) ? 1 : 0;
    const bCleanup = cleanupRules.includes(b) ? 1 : 0;
    if (aCleanup !== bCleanup) return aCleanup - bCleanup;
    return a.localeCompare(b);
  });

  const cleanupCount = filtered.filter(t => {
    try { return cleanupRules.includes(new URL(t.url).hostname); }
    catch { return false; }
  }).length;
  updateCleanupBtn(cleanupCount);
  statsEl.textContent = cleanupCount > 0
    ? `${filtered.length} tabs in ${sortedDomains.length} groups \u00b7 ${cleanupCount} marked for cleanup`
    : `${filtered.length} tabs in ${sortedDomains.length} groups`;

  container.innerHTML = '';
  for (const domain of sortedDomains) {
    const group = groups[domain];
    const groupEl = document.createElement('div');
    groupEl.className = 'group';

    // Group header
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
      const tabIds = group.map(t => t.id);
      await browser.tabs.remove(tabIds);
      loadTabs();
    });
    buttons.appendChild(closeAllBtn);

    header.appendChild(domainSpan);
    header.appendChild(buttons);
    groupEl.appendChild(header);

    // Sub-group tabs by base URL (origin + pathname, ignoring query/hash)
    const urlGroups = {};
    for (const tab of group) {
      const base = baseUrl(tab.url);
      if (!urlGroups[base]) urlGroups[base] = [];
      urlGroups[base].push(tab);
    }

    // Render tabs, inserting sub-group headers for duplicates
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
          const toClose = dupes.slice(1).map(t => t.id);
          await browser.tabs.remove(toClose);
          loadTabs();
        });
        subBtns.appendChild(keepOneBtn);

        const closeAllDupesBtn = document.createElement('button');
        closeAllDupesBtn.className = 'close-group';
        closeAllDupesBtn.textContent = 'Close All';
        closeAllDupesBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await browser.tabs.remove(dupes.map(t => t.id));
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

        // Favicon
        if (tab.favIconUrl) {
          const img = document.createElement('img');
          img.className = 'favicon';
          img.src = tab.favIconUrl;
          img.onerror = () => { img.style.display = 'none'; };
          tabEl.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'favicon-placeholder';
          tabEl.appendChild(placeholder);
        }

        // Info
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

        // Last accessed time
        if (tab.lastAccessed) {
          const time = document.createElement('div');
          time.className = 'tab-time';
          time.textContent = formatTime(tab.lastAccessed);
          tabEl.appendChild(time);
        }

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-tab';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          tabEl.classList.add('closing');
          await browser.tabs.remove(tab.id);
          setTimeout(loadTabs, 300);
        });
        tabEl.appendChild(closeBtn);

        // Click tab row to switch to it
        tabEl.addEventListener('click', () => {
          browser.tabs.update(tab.id, { active: true });
          browser.windows.update(tab.windowId, { focused: true });
        });

        groupEl.appendChild(tabEl);
      }
    }

    container.appendChild(groupEl);
  }
}

function baseUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch { return url || ''; }
}

function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
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
  showIncognito = data.showIncognito || false;
  showIncognitoCheckbox.checked = showIncognito;
  await loadCleanupRules();
  loadTabs();
}

init();
