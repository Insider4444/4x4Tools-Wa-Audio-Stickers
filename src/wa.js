// 4x4Tools-Wa-Audio-Stickers — WhatsApp Web Integration
// Uses WhatsApp Web's internal modules to upload audio, send stickers with stickerAudio, and open Forward.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  const log = (lvl, ev, data) => (WAAS.log ? WAAS.log(lvl, ev, data) : console.debug(ev, data));
  const W = (WAAS.wa = {});

  const SOUND_PROPS = [
    "sound_stickers_consumption_enabled",
    "sound_stickers_creation_enabled",
    "sound_stickers_audio_playing_enabled",
  ];
  const NEEDED = [
    "WAWebChatCollection",
    "WAWebMsgCollection",
    "WAWebMediaPrep",
    "WAWebMediaOpaqueData",
    "WAWebUploadManagerMainThread",
    "WAWebUploadManager",
    "WAWebCreateMediaUploadMetrics",
    "WAWebMmsMediaTypes",
    "WAWebMediaGetUploadOriginForChat",
    "WAWebSoundStickerGating",
    "WAWebSoundStickerUtils",
    "WAWebABProps",
    "WAWebModalManager",
    "WAWebForwardMessageFlowLoadable",
    "WAWebStateUtils",
    "WAWebUserPrefsMeUser",
    "WAWebFindChatAction",
    "WAWebSendMsgResultAction",
    "WAWebAck",
    "WALogger",
    "react",
  ];

  // ------------------------------------------------------------ module loader
  function hasLoader() {
    return typeof window.require === "function" && typeof window.__d === "function";
  }

  function ns(name) {
    if (typeof window.importNamespace === "function") {
      try {
        const m = window.importNamespace(name);
        if (m) return m;
      } catch (e) {
        // Fallback to require
      }
    }
    return window.require(name);
  }

  function def(name) {
    const m = ns(name);
    return m && m.default !== undefined ? m.default : m;
  }

  async function load(name, timeoutMs = 15000) {
    try {
      return ns(name);
    } catch (e) {
      // May be a lazy-loaded module
    }
    if (typeof window.requireLazy !== "function") {
      throw new Error(`WhatsApp module "${name}" is unavailable and requireLazy is missing.`);
    }
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out while loading WhatsApp module "${name}".`)), timeoutMs);
      window.requireLazy([name], () => {
        clearTimeout(t);
        resolve();
      });
    });
    return ns(name);
  }

  function isReady() {
    try {
      if (!hasLoader()) return false;
      const CC = ns("WAWebChatCollection");
      return !!(CC && CC.ChatCollection);
    } catch (e) {
      return false;
    }
  }

  W.ns = ns;
  W.def = def;
  W.load = load;
  W.hasLoader = hasLoader;
  W.isReady = isReady;

  function waVersion() {
    try {
      return (window.Debug && window.Debug.VERSION) || null;
    } catch (e) {
      return null;
    }
  }

  function abValues() {
    const out = {};
    try {
      const AB = ns("WAWebABProps");
      for (const p of SOUND_PROPS.concat(["sound_stickers_channels_send_enabled"])) {
        try {
          out[p] = AB.getABPropConfigValue(p);
        } catch (e) {
          out[p] = "error: " + e.message;
        }
      }
    } catch (e) {
      out.error = e.message;
    }
    return out;
  }

  // Safely patch a property on a module object, falling back to defineProperty if configurable.
  function safePatch(obj, prop, value) {
    try {
      obj[prop] = value;
      return obj[prop] === value;
    } catch (e) {
      try {
        Object.defineProperty(obj, prop, { value, configurable: true, writable: true });
        return obj[prop] === value;
      } catch (e2) {
        return false;
      }
    }
  }

  // ------------------------------------------------------------ diagnostics
  W.diagnose = async function () {
    const mods = {};
    for (const n of NEEDED) {
      try {
        const m = ns(n);
        mods[n] = m ? "ok" : "empty";
      } catch (e) {
        mods[n] = "missing: " + String((e && e.message) || e).slice(0, 120);
      }
    }
    let caps = null;
    try {
      caps = await WAAS.capabilities();
    } catch (e) {
      caps = { error: e.message };
    }
    let activeChat = null;
    try {
      const c = W.getActiveChat();
      activeChat = c ? describeChat(c) : null;
    } catch (e) {
      activeChat = "error: " + e.message;
    }
    const d = {
      extension: WAAS.NAME + " v" + WAAS.VERSION,
      waVersion: waVersion(),
      loader: {
        require: typeof window.require,
        importNamespace: typeof window.importNamespace,
        requireLazy: typeof window.requireLazy,
      },
      modules: mods,
      originalAbProps: W._abOriginal || abValues(),
      currentAbProps: abValues(),
      browser: caps,
      activeChat,
      gatingForced: !!W._forced,
    };
    log("info", "diagnostics", d);
    return d;
  };

  function describeChat(chat) {
    try {
      const id = chat.id;
      const type =
        id && id.isGroup && id.isGroup()
          ? "group"
          : id && id.server === "lid"
          ? "lid"
          : id && id.isUser && id.isUser()
          ? "user"
          : String((id && id.server) || "unknown");
      return {
        type,
        id: WAAS.maskIds(String((id && id._serialized) || id || "")),
        name: WAAS.maskIds(String(chat.formattedTitle || chat.name || "")).slice(0, 40),
      };
    } catch (e) {
      return { error: e.message };
    }
  }
  W.describeChat = describeChat;

  // Return all distinct module references (CommonJS require + importNamespace) so patches hit the live object.
  function allModuleRefs(name) {
    const refs = [];
    try {
      if (typeof window.require === "function") {
        const m = window.require(name);
        if (m) refs.push(m);
      }
    } catch (e) {}
    try {
      if (typeof window.importNamespace === "function") {
        const m = window.importNamespace(name);
        if (m && !refs.includes(m)) refs.push(m);
      }
    } catch (e) {}
    return refs;
  }

  // ------------------------------------------------------------ enable sound stickers locally
  W.forceSoundStickers = function () {
    if (!hasLoader()) return false;
    W._abOriginal = W._abOriginal || abValues();
    let method = null;

    const abRefs = allModuleRefs("WAWebABProps");
    for (const AB of abRefs) {
      try {
        const orig = AB.getABPropConfigValue;
        if (typeof orig === "function" && !orig.__waas) {
          const patched = function (name) {
            if (SOUND_PROPS.includes(name)) return true;
            return orig.apply(this, arguments);
          };
          patched.__waas = true;
          if (safePatch(AB, "getABPropConfigValue", patched)) {
            method = "WAWebABProps";
          }
        } else if (orig && orig.__waas) {
          method = "WAWebABProps";
        }
      } catch (e) {
        log("warn", "gating:abprops-failed", e);
      }
    }

    const gRefs = allModuleRefs("WAWebSoundStickerGating");
    const G = gRefs[0] || null;
    if (!G) log("error", "gating:module-missing", "WAWebSoundStickerGating not found");

    const ok = () => {
      if (!G) return false;
      try {
        const createOk = typeof G.isSoundStickerCreationEnabled !== "function" || G.isSoundStickerCreationEnabled() === true;
        const consumeOk = typeof G.isSoundStickerConsumptionEnabled !== "function" || G.isSoundStickerConsumptionEnabled() === true;
        const playOk = typeof G.isSoundStickerPlaybackEnabled !== "function" || G.isSoundStickerPlaybackEnabled() === true;
        return createOk && consumeOk && playOk;
      } catch (e) {
        return false;
      }
    };

    if (gRefs.length && !ok()) {
      let patchedAny = false;
      for (const ref of gRefs) {
        const names = new Set([
          "isSoundStickerConsumptionEnabled",
          "isSoundStickerCreationEnabled",
          "isSoundStickerPlaybackEnabled",
        ]);
        try {
          for (const k of Object.keys(ref)) {
            if (/soundsticker.*enabled/i.test(k) && !/channel/i.test(k) && typeof ref[k] === "function") {
              names.add(k);
            }
          }
        } catch (e) {}
        for (const fnName of names) {
          if (fnName in ref && safePatch(ref, fnName, () => true)) patchedAny = true;
        }
      }
      if (patchedAny) method = method ? method + "+WAWebSoundStickerGating" : "WAWebSoundStickerGating";
    }

    W._forced = !!G && ok();
    log(W._forced ? "info" : "warn", "gating:enable", {
      method,
      original: W._abOriginal,
      current: abValues(),
      gatingChecks: G
        ? {
            creation: typeof G.isSoundStickerCreationEnabled === "function" ? G.isSoundStickerCreationEnabled() : "n/a",
            consumption: typeof G.isSoundStickerConsumptionEnabled === "function" ? G.isSoundStickerConsumptionEnabled() : "n/a",
            playback: typeof G.isSoundStickerPlaybackEnabled === "function" ? G.isSoundStickerPlaybackEnabled() : "n/a",
          }
        : null,
      enabled: W._forced,
    });
    return W._forced;
  };

  // ------------------------------------------------------------ hook internal WA logger during operations
  W.hookWALogger = function () {
    if (W._loggerHooked) return;
    try {
      const L = ns("WALogger");
      const RELEVANT = /sticker|media|upload|sound|forward|prep|send|mms|encrypt|kaleidoscope/i;
      for (const lvl of ["LOG", "WARN", "ERROR"]) {
        const orig = L[lvl];
        if (typeof orig !== "function" || orig.__waas) continue;
        const wrapped = function (strings) {
          try {
            if (WAAS.activeRun && strings && strings.raw) {
              const vals = Array.prototype.slice.call(arguments, 1);
              let msg = "";
              for (let i = 0; i < strings.length; i++) {
                msg += strings[i] + (i < vals.length ? String(vals[i]) : "");
              }
              if (lvl !== "LOG" || RELEVANT.test(msg)) {
                log(lvl === "ERROR" ? "error" : lvl === "WARN" ? "warn" : "info", "wa-" + lvl.toLowerCase(), msg);
              }
            }
          } catch (e) {
            // Never disrupt WhatsApp's own logger
          }
          return orig.apply(this, arguments);
        };
        wrapped.__waas = true;
        safePatch(L, lvl, wrapped);
      }
      W._loggerHooked = true;
      log("info", "walogger:hooked", null);
    } catch (e) {
      log("warn", "walogger:hook-failed", e);
    }
  };

  // ------------------------------------------------------------ chats
  W.getActiveChat = function () {
    try {
      const CC = ns("WAWebChatCollection").ChatCollection;
      if (!CC) return null;
      const direct = typeof CC.getActive === "function" ? CC.getActive() : null;
      if (direct) return direct;
      if (typeof CC.getModelsArray === "function") {
        return CC.getModelsArray().find((c) => c && c.active) || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  W.getActiveChatInfo = function () {
    const chat = W.getActiveChat();
    if (!chat) return null;
    try {
      const id = chat.id;
      const title = String(chat.formattedTitle || chat.name || (chat.contact && chat.contact.name) || "Active chat").trim();
      const isGroup = !!(id && id.isGroup && id.isGroup());
      return { title: title || "Active chat", isGroup };
    } catch (e) {
      return { title: "Active chat", isGroup: false };
    }
  };

  W.getSelfChat = async function () {
    const Me = ns("WAWebUserPrefsMeUser");
    const CC = ns("WAWebChatCollection").ChatCollection;
    const getters = ["getMaybeMePnUser", "getMeUserOrThrow", "getMaybeMeLidUser"];
    let firstWid = null;
    for (const g of getters) {
      try {
        const wid = Me[g] && Me[g]();
        if (!wid) continue;
        firstWid = firstWid || wid;
        const c = CC.get(wid) || CC.get(String(wid._serialized || wid));
        if (c) {
          log("info", "self-chat:found", { via: g, chat: describeChat(c) });
          return c;
        }
      } catch (e) {
        // Try next getter
      }
    }
    if (!firstWid) throw new Error("Could not resolve your own WhatsApp account ID.");
    const r = await ns("WAWebFindChatAction").findOrCreateLatestChat(firstWid, "forwardSelectedModals");
    const chat = r && (r.chat || r);
    if (!chat) throw new Error("Could not open your personal chat (You).");
    log("info", "self-chat:created", { chat: describeChat(chat) });
    return chat;
  };

  // ------------------------------------------------------------ audio upload
  function toB64(v) {
    if (v == null) return v;
    if (typeof v === "string") return v;
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer || v);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }
  function b64Len(s) {
    try {
      return atob(s).length;
    } catch (e) {
      return -1;
    }
  }

  const noopQpl = new Proxy({}, { get: () => () => undefined });

  async function doUpload(params) {
    try {
      const metrics = def("WAWebCreateMediaUploadMetrics")(params);
      const res = await def("WAWebUploadManagerMainThread").encryptAndUpload(params, metrics);
      return { res, via: "MainThread" };
    } catch (e) {
      log("warn", "upload:mainthread-failed", e);
      const res = await def("WAWebUploadManager").encryptAndUpload(params);
      return { res, via: "UploadManager" };
    }
  }

  W.uploadAudio = async function (oggBlob, seconds, chat) {
    const MT = ns("WAWebMmsMediaTypes").MEDIA_TYPES;
    let uploadOrigin = 1;
    try {
      uploadOrigin = def("WAWebMediaGetUploadOriginForChat")(chat);
    } catch (e) {
      log("warn", "upload:origin-fallback", e);
    }
    const makeParams = (attempt) => ({
      blob: oggBlob,
      type: MT.AUDIO,
      signal: new AbortController().signal,
      uploadQpl: noopQpl,
      uploadOrigin,
      fileOrigin: undefined,
      userUploadAttemptCount: attempt,
      forwardedFromWeb: false,
      isViewOnce: false,
      isHdPhoto: false,
    });

    let uploaded;
    try {
      uploaded = await doUpload(makeParams(0));
    } catch (firstErr) {
      log("warn", "upload:retrying", firstErr);
      await new Promise((r) => setTimeout(r, 800));
      uploaded = await doUpload(makeParams(1));
    }

    const { res, via } = uploaded;
    const bytes = new Uint8Array(await oggBlob.arrayBuffer());
    const filehash = await WAAS._internals.sha256b64(bytes);
    const stickerAudio = {
      deprecatedMms3Url: res.url || undefined,
      directPath: res.directPath,
      mediaKey: toB64(res.mediaKey),
      mediaKeyTimestamp: res.mediaKeyTimestamp,
      filehash,
      encFilehash: toB64(res.encFilehash),
      size: bytes.length,
      mimetype: "audio/ogg; codecs=opus",
      duration: seconds,
    };

    let complete = null;
    try {
      complete = ns("WAWebSoundStickerUtils").isCompleteStickerAudio(stickerAudio);
    } catch (e) {
      complete = "error: " + e.message;
    }

    log(complete === true ? "info" : "error", "upload:audio", {
      via,
      responseTypes: Object.fromEntries(
        Object.entries(res || {}).map(([k, v]) => [k, v == null ? String(v) : v.constructor ? v.constructor.name : typeof v])
      ),
      directPath: stickerAudio.directPath ? stickerAudio.directPath.split("?")[0] : null,
      hasUrl: !!stickerAudio.deprecatedMms3Url,
      mediaKeyBytes: b64Len(stickerAudio.mediaKey),
      encFilehashBytes: b64Len(stickerAudio.encFilehash),
      filehash,
      size: stickerAudio.size,
      duration: seconds,
      isCompleteStickerAudio: complete,
    });

    if (complete !== true) {
      throw new Error("WhatsApp rejected the uploaded audio metadata (isCompleteStickerAudio=" + complete + ").");
    }
    return stickerAudio;
  };

  // ------------------------------------------------------------ send sticker
  W.sendSticker = async function (chat, webpBlob, info, stickerAudio) {
    const Opaque = def("WAWebMediaOpaqueData");
    const MediaPrep = def("WAWebMediaPrep");
    const opaque = await Opaque.createFromData(webpBlob, "image/webp");
    const emojis = Array.isArray(info.emojis) && info.emojis.length ? info.emojis : ["🔊"];
    const side = info.side || 512;
    const data = {
      type: "sticker",
      mediaBlob: opaque,
      mimetype: "image/webp",
      size: webpBlob.size,
      fullWidth: side,
      fullHeight: side,
      isAnimated: !!info.isAnimated,
      emojis,
    };
    const prep = new MediaPrep("sticker", Promise.resolve(data));
    log("info", "send:prepared", { chat: describeChat(chat), webpBytes: webpBlob.size, hasAudio: !!stickerAudio });
    const res = await prep.sendToChat({ chat, options: stickerAudio ? { stickerAudio } : {} });
    const OK = ns("WAWebSendMsgResultAction").SendMsgResult.OK;
    const msg = res && res.msg;
    const summary = {
      result: res && res.messageSendResult,
      ok: res && res.messageSendResult === OK,
      msgId: msg && msg.id ? WAAS.maskIds(String(msg.id._serialized || msg.id)) : null,
      msgHasStickerAudio: msg ? !!(msg.stickerAudio || (msg.attributes && msg.attributes.stickerAudio)) : null,
      ack: msg ? msg.ack : null,
    };
    log(summary.ok ? "info" : "error", "send:result", summary);
    if (!summary.ok) {
      throw new Error("WhatsApp could not send the sticker (" + summary.result + ").");
    }
    return msg;
  };

  W.waitForAck = async function (msg, timeoutMs = 30000) {
    const ACK = ns("WAWebAck").ACK;
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const a = msg.ack;
      if (a >= ACK.SENT) {
        log("info", "send:ack", { ack: a, ms: Date.now() - t0 });
        return a;
      }
      if (a < 0) throw new Error("Message failed on WhatsApp server (ack " + a + ").");
      await new Promise((r) => setTimeout(r, 300));
    }
    log("warn", "send:ack-timeout", { ack: msg.ack });
    return msg.ack;
  };

  W.openForward = async function (msg) {
    const React = ns("react");
    const MM = ns("WAWebModalManager");
    const FL = await load("WAWebForwardMessageFlowLoadable");
    const SU = ns("WAWebStateUtils");
    let model = msg;
    try {
      const MC = ns("WAWebMsgCollection").MsgCollection;
      model = MC.get(msg.id) || msg;
    } catch (e) {
      // Use provided msg model
    }
    const close = MM.closeModalManager || (() => MM.ModalManager.close());
    MM.ModalManager.open(
      React.createElement(FL.ForwardMessageFlowLoadable, {
        msgs: [SU.unproxy(model)],
        onClose: close,
        onForward: (msgs) => log("info", "forward:completed", { count: msgs ? msgs.length : null }),
      }),
      { transition: "modal-flow" }
    );
    log("info", "forward:dialog-opened", null);
  };

  // Full publish pipeline: upload audio, send sticker to target chat, and optionally open native Forward modal.
  W.publish = async function ({ webp, ogg, info }, { target = "self", openForward = true, onProgress } = {}) {
    if (!isReady()) {
      throw new Error("WhatsApp Web is not ready yet. Make sure you are signed in and chats have finished loading.");
    }
    const prog = onProgress || (() => {});
    W.hookWALogger();
    if (!W.forceSoundStickers()) {
      log("warn", "publish:gating-warning", "Could not enable local sound sticker flags; WhatsApp may strip audio.");
    }
    prog("Locating target chat…");
    const chat = target === "active" ? W.getActiveChat() : await W.getSelfChat();
    if (!chat) {
      throw new Error(
        target === "active"
          ? "No chat is currently open. Open a chat first, or choose 'Save to My Chat (You)'."
          : "Could not find your personal chat (You)."
      );
    }
    prog("Uploading encrypted audio…");
    const stickerAudio = await W.uploadAudio(ogg, info.audioSeconds, chat);
    prog("Sending audio sticker…");
    const msg = await W.sendSticker(chat, webp, info, stickerAudio);
    if (openForward) {
      prog("Waiting for server confirmation…");
      await W.waitForAck(msg);
      prog("Opening Forward dialog…");
      await W.openForward(msg);
    }
    const chatTitle = String(chat.formattedTitle || chat.name || (target === "self" ? "My Chat (You)" : "Active Chat")).trim();
    return { chat, msg, chatTitle };
  };
})();
