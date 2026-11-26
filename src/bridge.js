// 4x4Tools-Wa-Audio-Stickers — Isolated-World Bridge
// Persists diagnostic logs to chrome.storage.local and relays messages between the page and background worker.
(() => {
  const MAX_ENTRIES = 5000;
  let queue = [];
  let timer = null;
  let writing = Promise.resolve();

  function safeStorageGet(keys, cb) {
    try {
      chrome.storage.local.get(keys, (res) => {
        if (chrome.runtime.lastError) return cb({});
        cb(res || {});
      });
    } catch (e) {
      cb({});
    }
  }

  function safeStorageSet(obj, cb) {
    try {
      chrome.storage.local.set(obj, () => {
        void chrome.runtime.lastError;
        if (cb) cb();
      });
    } catch (e) {
      if (cb) cb();
    }
  }

  function safeSendRuntime(payload) {
    try {
      const p = chrome.runtime.sendMessage(payload);
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (e) {
      // Extension context may have been reloaded
    }
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const batch = queue;
    queue = [];
    if (!batch.length) return writing;
    writing = writing.then(
      () =>
        new Promise((resolve) => {
          safeStorageGet({ log: [] }, (res) => {
            let log = (res.log || []).concat(batch);
            if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);
            safeStorageSet({ log }, resolve);
          });
        })
    );
    return writing;
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.__waas === "log" && d.entry) {
      queue.push(d.entry);
      if (!timer) timer = setTimeout(flush, 350);
    } else if (d.__waas === "getLog") {
      flush().then(() => {
        safeStorageGet({ log: [] }, (res) => {
          window.postMessage({ __waas: "logResponse", reqId: d.reqId, log: res.log || [] }, location.origin);
        });
      });
    } else if (d.__waas === "clearLog") {
      queue = [];
      writing = writing.then(() => new Promise((r) => safeStorageSet({ log: [] }, r)));
    } else if (d.__waas === "openLog") {
      safeSendRuntime({ waas: "openLog" });
    } else if (d.__waas === "uiReady") {
      safeSendRuntime({ waas: "pageReady" });
    } else if (d.__waas === "xImport" && d.reqId) {
      // The page asks for an X post's video; the service worker downloads it and we hand back the bytes.
      const reply = (payload) =>
        window.postMessage(Object.assign({ __waas: "xImportResponse", reqId: d.reqId }, payload), location.origin);
      try {
        chrome.runtime.sendMessage({ waas: "xImport", url: String(d.url || "").slice(0, 2000) }, (res) => {
          if (chrome.runtime.lastError) {
            return reply({ ok: false, error: "Extension error: " + chrome.runtime.lastError.message });
          }
          reply(res || { ok: false, error: "No answer from the extension." });
        });
      } catch (e) {
        reply({ ok: false, error: "The extension was reloaded. Refresh WhatsApp Web (F5) and try again." });
      }
    }
  });

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.waas === "togglePanel") {
        window.postMessage({ __waas: "togglePanel" }, location.origin);
      }
    });
  } catch (e) {
    // Ignore if runtime unavailable
  }

  window.addEventListener("pagehide", () => {
    flush();
  });
})();
