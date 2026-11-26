// 4x4Tools-Wa-Audio-Stickers — Bootstrap
// Mounts the UI immediately, waits for WhatsApp Web internals, enables sound sticker support, and logs diagnostics.
(() => {
  const WAAS = window.WAAS;
  if (!WAAS || WAAS._started) return;
  WAAS._started = true;

  function shouldAutoEnableGating() {
    try {
      const v = localStorage.getItem("waas-auto-gating");
      return v == null ? true : JSON.parse(v) !== false;
    } catch (e) {
      return true;
    }
  }

  async function waitForWA(maxMs = 180000) {
    const t0 = Date.now();
    const autoGate = shouldAutoEnableGating();
    let earlyPatched = false;
    while (Date.now() - t0 < maxMs) {
      try {
        if (autoGate && !earlyPatched && WAAS.wa && WAAS.wa.hasLoader()) {
          // Enable sound sticker flags as early as possible before chat sticker bubbles mount.
          if (WAAS.wa.forceSoundStickers()) earlyPatched = true;
        }
        if (WAAS.wa && WAAS.wa.isReady()) return Date.now() - t0;
      } catch (e) {
        // Still initializing
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    throw new Error("WhatsApp Web did not finish loading within 3 minutes (signed out or page still loading?).");
  }

  async function connectWA() {
    WAAS.setWAState("loading", "Connecting to WhatsApp Web…");
    try {
      const ms = await waitForWA();
      WAAS.info("wa:ready", { ms });
      if (shouldAutoEnableGating() && WAAS.wa) {
        WAAS.wa.forceSoundStickers();
      }
      WAAS.setWAState("ready", "Connected");
      // Re-verify after server AB props finish hydrating (~5 s after initial render).
      await new Promise((r) => setTimeout(r, 5000));
      if (shouldAutoEnableGating() && WAAS.wa) {
        WAAS.wa.forceSoundStickers();
      }
      await WAAS.wa.diagnose();
    } catch (e) {
      WAAS.error("wa:not-ready", e);
      WAAS.setWAState("error", String((e && e.message) || e));
    }
  }

  WAAS.retryConnect = connectWA;

  try {
    WAAS.mountUI();
  } catch (e) {
    WAAS.error("ui:mount-error", e);
  }

  connectWA();
})();
