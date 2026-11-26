// 4x4Tools-Wa-Audio-Stickers — Diagnostic Logs Viewer
const $ = (id) => document.getElementById(id);
let filterMode = "all"; // "all" | "warn" | "error"
let searchQuery = "";
let entries = [];

function formatLine(e) {
  const ts = String(e.ts || "").replace("T", " ").slice(0, 19);
  const lvl = String(e.level || "info").toUpperCase().padEnd(5, " ");
  const data = e.data != null ? " " + JSON.stringify(e.data) : "";
  return `${ts} [${lvl}] ${e.event}${data}`;
}

function renderStats() {
  const host = $("stats");
  host.textContent = "";
  const errs = entries.filter((e) => e.level === "error").length;
  const warns = entries.filter((e) => e.level === "warn").length;
  const sessions = new Set(entries.map((e) => e.session)).size;
  const items = [
    { cls: "pill", text: `${entries.length} entries` },
    { cls: "pill" + (errs ? " err" : ""), text: `${errs} errors` },
    { cls: "pill" + (warns ? " warn" : ""), text: `${warns} warnings` },
    { cls: "pill", text: `${sessions} sessions` },
  ];
  for (const it of items) {
    const span = document.createElement("span");
    span.className = it.cls;
    span.textContent = it.text;
    host.append(span);
  }
}

function render() {
  renderStats();
  const box = $("log");
  box.textContent = "";
  const q = searchQuery.trim().toLowerCase();
  const filtered = entries.filter((e) => {
    if (filterMode === "error" && e.level !== "error") return false;
    if (filterMode === "warn" && e.level === "info") return false;
    if (q) {
      const line = formatLine(e).toLowerCase();
      if (!line.includes(q)) return false;
    }
    return true;
  });

  const shown = filtered.slice(-2500);
  if (!shown.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = entries.length ? "No log entries match the current filter." : "No log entries recorded yet.";
    box.append(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const e of shown) {
    const div = document.createElement("div");
    div.className = "entry" + (e.level === "error" ? " e" : e.level === "warn" ? " w" : "");
    div.textContent = formatLine(e);
    frag.append(div);
  }
  box.append(frag);
  box.scrollTop = box.scrollHeight;
}

function load() {
  chrome.storage.local.get({ log: [] }, (res) => {
    entries = res.log || [];
    render();
  });
}

function setFilter(mode) {
  filterMode = mode;
  $("f-all").classList.toggle("on", mode === "all");
  $("f-warn").classList.toggle("on", mode === "warn");
  $("f-err").classList.toggle("on", mode === "error");
  render();
}

$("f-all").addEventListener("click", () => setFilter("all"));
$("f-warn").addEventListener("click", () => setFilter("warn"));
$("f-err").addEventListener("click", () => setFilter("error"));
$("search").addEventListener("input", (ev) => {
  searchQuery = ev.target.value || "";
  render();
});

$("dl").addEventListener("click", () => {
  const manifest = chrome.runtime.getManifest();
  const content = JSON.stringify(
    {
      extension: manifest.name,
      version: manifest.version,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      entries,
    },
    null,
    2
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  a.download =
    "4x4tools-wa-audio-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
    $("copy").textContent = "Copied!";
    setTimeout(() => ($("copy").textContent = "Copy JSON"), 1600);
  } catch (e) {
    $("copy").textContent = "Copy failed";
    setTimeout(() => ($("copy").textContent = "Copy JSON"), 1600);
  }
});

$("clear").addEventListener("click", () => {
  if (!confirm("Clear all stored diagnostic logs?")) return;
  chrome.storage.local.set({ log: [] }, load);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.log) {
    entries = changes.log.newValue || [];
    render();
  }
});

load();
