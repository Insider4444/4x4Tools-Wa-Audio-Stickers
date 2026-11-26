// 4x4Tools-Wa-Audio-Stickers — MV3 Service Worker
// Toggles the studio panel inside WhatsApp Web or opens WhatsApp Web if needed.
const WA_URL = "https://web.whatsapp.com/";
const PENDING_KEY = "pendingOpenTabs";
const memPending = new Set();

async function logToStorage(level, event, data) {
  try {
    const entry = { ts: new Date().toISOString(), level, event, run: null, session: "background", data };
    const { log = [] } = await chrome.storage.local.get({ log: [] });
    log.push(entry);
    await chrome.storage.local.set({ log: log.slice(-5000) });
  } catch (e) {
    // Ignore storage write errors
  }
}

async function getPendingSet() {
  try {
    if (chrome.storage && chrome.storage.session) {
      const res = await chrome.storage.session.get({ [PENDING_KEY]: [] });
      return new Set(res[PENDING_KEY] || []);
    }
  } catch (e) {
    // Fall back to memory
  }
  return new Set(memPending);
}

async function savePendingSet(set) {
  memPending.clear();
  for (const id of set) memPending.add(id);
  try {
    if (chrome.storage && chrome.storage.session) {
      await chrome.storage.session.set({ [PENDING_KEY]: [...set] });
    }
  } catch (e) {
    // Ignore session storage errors
  }
}

async function addPending(tabId) {
  const set = await getPendingSet();
  set.add(tabId);
  await savePendingSet(set);
}

async function consumePending(tabId) {
  const set = await getPendingSet();
  if (!set.has(tabId)) return false;
  set.delete(tabId);
  await savePendingSet(set);
  return true;
}

async function togglePanelIn(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { waas: "togglePanel" });
  } catch (e) {
    // Tab was opened before extension install/reload — reload it so content scripts attach.
    await logToStorage("warn", "background:tab-missing-scripts", { tabId, error: String((e && e.message) || e) });
    await addPending(tabId);
    await chrome.tabs.reload(tabId);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab && tab.url && tab.url.startsWith(WA_URL)) {
      return await togglePanelIn(tab.id);
    }
    const [waTab] = await chrome.tabs.query({ url: WA_URL + "*" });
    if (waTab) {
      await chrome.tabs.update(waTab.id, { active: true });
      await chrome.windows.update(waTab.windowId, { focused: true });
      return await togglePanelIn(waTab.id);
    }
    const created = await chrome.tabs.create({ url: WA_URL });
    if (created && created.id != null) await addPending(created.id);
  } catch (e) {
    await logToStorage("error", "background:action-error", { error: String((e && e.stack) || e) });
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.waas === "openLog") {
    chrome.runtime.openOptionsPage();
  } else if (msg.waas === "pageReady" && sender.tab && sender.tab.id != null) {
    const tabId = sender.tab.id;
    consumePending(tabId).then((shouldOpen) => {
      if (shouldOpen) {
        chrome.tabs.sendMessage(tabId, { waas: "togglePanel" }).catch(() => {});
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  consumePending(tabId).catch(() => {});
});
