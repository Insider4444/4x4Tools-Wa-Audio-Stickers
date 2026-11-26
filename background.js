// 4x4Tools-Wa-Audio-Stickers — MV3 Service Worker
// Toggles the studio panel inside WhatsApp Web or opens WhatsApp Web if needed, and downloads videos for X links.
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

// ------------------------------------------------------------ X (Twitter) link import
// WhatsApp Web's page cannot reach X, so the service worker finds the post's video and downloads it.
// Lookup order: X's own embed endpoint (used by embedded tweets), then FxTwitter as a fallback.
// The accepted hosts must match X_LINK in src/xlink.js.
const X_HOSTS = new Set(["x.com", "twitter.com", "fxtwitter.com", "fixupx.com", "vxtwitter.com", "fixvx.com"]);
const X_TARGET_BYTES = 16e6; // pick the best quality expected to fit in this size
const X_MAX_BYTES = 40e6; // never download or hand more than this to the page
const X_MAX_SHORT_SIDE = 720; // more is wasted on a 512 px sticker
const X_LOOKUP_TIMEOUT_MS = 15000;
const X_DOWNLOAD_TIMEOUT_MS = 90000;

// Returns { id, mediaIndex } for an X post link, or null. mediaIndex comes from a "/video/N" suffix.
function parseXLink(input) {
  const s = String(input || "").trim();
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
  } catch (e) {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|mobile|m)\./, "");
  if (!X_HOSTS.has(host)) return null;
  const m = u.pathname.match(/\/status(?:es)?\/(\d{5,25})/i);
  if (!m) return null;
  const vm = u.pathname.match(/\/video\/(\d{1,2})/i);
  return { id: m[1], mediaIndex: vm ? Math.max(0, +vm[1] - 1) : null };
}

function syndicationToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

const errText = (e) => (e && e.name === "TimeoutError" ? "timed out" : String((e && e.message) || e));

// Returns parsed JSON, or null when the post is missing or private
// (an error status, or a web page instead of JSON).
async function fetchJsonOrNull(url) {
  const r = await fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    signal: AbortSignal.timeout(X_LOOKUP_TIMEOUT_MS),
  });
  if ([401, 403, 404, 410].includes(r.status)) return null;
  if (!r.ok) throw new Error("HTTP " + r.status);
  if (!/json/i.test(r.headers.get("content-type") || "")) return null;
  return r.json();
}

function sizeFromUrl(url) {
  const m = String(url).match(/\/(\d{2,5})x(\d{2,5})\//);
  return m ? { w: +m[1], h: +m[2] } : { w: 0, h: 0 };
}

// Both lookups return { videos: [...] }. mediaIndex is a video's position among its post's own media,
// photos included, which is what "/video/N" counts; videos from a quoted post get null.
function fromSyndication(j) {
  if (!j || j.__typename === "TweetTombstone") return null;
  const pick = (media, author, own) =>
    (media || [])
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => (m.type === "video" || m.type === "animated_gif") && m.video_info)
      .map(({ m, i }) => ({
        kind: m.type === "animated_gif" ? "gif" : "video",
        duration: (m.video_info.duration_millis || 0) / 1000,
        width: (m.original_info && m.original_info.width) || 0,
        height: (m.original_info && m.original_info.height) || 0,
        variants: (m.video_info.variants || []).map((v) => ({ url: v.url, type: v.content_type, bitrate: v.bitrate || 0 })),
        mediaIndex: own ? i : null,
        author: author || "",
      }));
  const q = j.quoted_tweet;
  return {
    videos: pick(j.mediaDetails, j.user && j.user.screen_name, true).concat(
      q ? pick(q.mediaDetails, q.user && q.user.screen_name, false) : []
    ),
  };
}

function fromFxTwitter(j) {
  const t = j && j.tweet;
  if (!t) return null;
  const pick = (media, author, own) =>
    ((media && (media.all || media.videos)) || [])
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.type === "video" || v.type === "gif")
      .map(({ v, i }) => ({
        kind: v.type === "gif" ? "gif" : "video",
        duration: v.duration || 0,
        width: v.width || 0,
        height: v.height || 0,
        variants: (v.variants && v.variants.length ? v.variants : [{ url: v.url, content_type: v.format }]).map((x) => ({
          url: x.url,
          type: x.content_type,
          bitrate: x.bitrate || 0,
        })),
        mediaIndex: own && media.all ? i : null,
        author: author || "",
      }));
  const q = t.quote;
  return {
    videos: pick(t.media, t.author && t.author.screen_name, true).concat(
      q ? pick(q.media, q.author && q.author.screen_name, false) : []
    ),
  };
}

// Returns { videos, via } where every video has a downloadable MP4, trying each lookup in turn.
async function resolveXPost(id) {
  const lookups = [
    ["x-embed", `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`, fromSyndication],
    ["fxtwitter", `https://api.fxtwitter.com/status/${id}`, fromFxTwitter],
  ];
  const notes = [];
  for (const [via, url, parse] of lookups) {
    try {
      const post = parse(await fetchJsonOrNull(url));
      if (!post) {
        notes.push(via + ": not found");
        continue;
      }
      const videos = post.videos.filter((v) => pickVariant(v));
      if (videos.length) return { videos, via };
      notes.push(via + ": " + (post.videos.length ? "no mp4" : "no video"));
    } catch (e) {
      notes.push(via + ": " + errText(e));
    }
  }
  let message = "Couldn't reach X right now. Check your connection and try again.";
  if (notes.some((n) => /no mp4$/.test(n))) message = "X didn't offer a downloadable MP4 for this video.";
  else if (notes.some((n) => /no video$/.test(n))) message = "This post has no video. Pick a post with a video or GIF.";
  else if (notes.every((n) => /not found$/.test(n))) {
    message = "Couldn't find that post on X. It may be deleted, private, or age-restricted.";
  }
  const err = new Error(message);
  err.notes = notes;
  throw err;
}

function pickVariant(video) {
  const mp4 = video.variants
    .filter((v) => v.url && (/mp4/i.test(v.type || "") || /\.mp4(\?|$)/i.test(v.url)))
    .map((v) => ({ ...v, ...sizeFromUrl(v.url) }))
    .sort((a, b) => a.bitrate - b.bitrate);
  if (!mp4.length) return null;
  const est = (v) => (video.duration && v.bitrate ? ((v.bitrate * video.duration) / 8) * 1.06 : 0);
  const fits = mp4.filter((v) => (Math.min(v.w, v.h) || 0) <= X_MAX_SHORT_SIDE && est(v) <= X_TARGET_BYTES);
  return fits.length ? fits[fits.length - 1] : mp4[0];
}

function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// Downloads an MP4 from video.twimg.com into a Uint8Array, giving up past X_MAX_BYTES.
async function downloadXVideo(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== "video.twimg.com") throw new Error("Unexpected video address from X.");
  const tooBig = () =>
    new Error(`This video is over ${X_MAX_BYTES / 1e6} MB, too big to load from X. Download it and drop the file in instead.`);
  try {
    // video.twimg.com refuses requests whose Referer is another site, so never send one.
    const r = await fetch(u.href, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(X_DOWNLOAD_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error("X's video server answered " + r.status + ". Try again in a moment.");
    if (+(r.headers.get("content-length") || 0) > X_MAX_BYTES) throw tooBig();
    const reader = r.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > X_MAX_BYTES) {
        reader.cancel().catch(() => {});
        throw tooBig();
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out;
  } catch (e) {
    if (e && e.name === "TimeoutError") {
      throw new Error("Downloading the video from X took too long. Try again, or download it and drop the file in.");
    }
    throw e;
  }
}

async function importXVideo(rawUrl) {
  const t0 = Date.now();
  const link = parseXLink(rawUrl);
  if (!link) throw new Error("That isn't an X post link. Copy the link from the post's Share button (x.com/…/status/…).");
  const { videos, via } = await resolveXPost(link.id);
  const video = (link.mediaIndex != null && videos.find((v) => v.mediaIndex === link.mediaIndex)) || videos[0];
  const variant = pickVariant(video);
  const bytes = await downloadXVideo(variant.url);
  const author = video.author.replace(/[^A-Za-z0-9_]/g, "");
  const info = {
    kind: video.kind,
    duration: video.duration,
    width: variant.w || video.width,
    height: variant.h || video.height,
    bytes: bytes.byteLength,
  };
  await logToStorage("info", "x-fetch:done", { via, ...info, bitrate: variant.bitrate, ms: Date.now() - t0 });
  return {
    ok: true,
    name: `x-${author || "post"}-${link.id}.mp4`,
    type: "video/mp4",
    b64: bytesToBase64(bytes),
    via,
    author,
    video: info,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.waas === "xImport") {
    importXVideo(msg.url).then(sendResponse, async (e) => {
      const error = String((e && e.message) || e);
      await logToStorage("warn", "x-fetch:failed", { error, notes: e && e.notes });
      sendResponse({ ok: false, error });
    });
    return true; // keep the channel open for the async reply
  }
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
