// 4x4Tools-Wa-Audio-Stickers — X (Twitter) link import (MAIN world)
// WhatsApp Web's page cannot reach X directly, so this asks the extension's service worker
// (via src/bridge.js) to find the post's video and download it, then returns it as a File.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  const log = (lvl, ev, data) => (WAAS.log ? WAAS.log(lvl, ev, data) : console.debug(ev, data));

  // Keep the hosts in sync with X_HOSTS in background.js, which does the real parsing.
  const X_LINK =
    /^(?:https?:\/\/)?(?:(?:www|mobile|m)\.)?(?:x|twitter|fxtwitter|fixupx|vxtwitter|fixvx)\.com\/[^\s?#]*status(?:es)?\/\d{5,25}/i;

  WAAS.isXLink = (s) => X_LINK.test(String(s || "").trim());

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Resolves to { file, author, video, via }. Rejects with a user-readable Error.
  WAAS.importXLink = function (url, { signal, timeoutMs = 150000 } = {}) {
    return new Promise((resolve, reject) => {
      const reqId = "x" + Math.random().toString(36).slice(2);
      let timer = null;
      const finish = (err, val) => {
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        if (signal) signal.removeEventListener("abort", onAbort);
        if (err) reject(err);
        else resolve(val);
      };
      const onAbort = () => finish(new DOMException("Canceled by user", "AbortError"));
      function onMsg(ev) {
        const d = ev.data;
        if (ev.source !== window || !d || d.__waas !== "xImportResponse" || d.reqId !== reqId) return;
        if (!d.ok) return finish(new Error(d.error || "Could not load that X post."));
        try {
          const file = new File([b64ToBytes(d.b64)], d.name || "x-video.mp4", { type: d.type || "video/mp4" });
          log("info", "x-import:received", { via: d.via, bytes: file.size, video: d.video });
          finish(null, { file, author: d.author || "", video: d.video || {}, via: d.via });
        } catch (e) {
          finish(new Error("The downloaded video could not be read (" + ((e && e.message) || e) + ")."));
        }
      }
      if (signal) {
        if (signal.aborted) return onAbort();
        signal.addEventListener("abort", onAbort);
      }
      timer = setTimeout(
        () => finish(new Error("Timed out while loading the video from X. Try again, or download it and drop the file in.")),
        timeoutMs
      );
      window.addEventListener("message", onMsg);
      log("info", "x-import:request", { url: String(url).trim().slice(0, 200) });
      window.postMessage({ __waas: "xImport", reqId, url: String(url).trim() }, location.origin);
    });
  };
})();
