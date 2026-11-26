// 4x4Tools-Wa-Audio-Stickers — Client-Side Media Engine
// Converts video, GIF, animated WebP, APNG, or still images + audio into WhatsApp-compatible
// animated/still WebP stickers + Ogg/Opus audio 100% locally in the browser.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  const log = (lvl, ev, data) => (WAAS.log ? WAAS.log(lvl, ev, data) : console.debug(ev, data));

  const SIDE = 512;                    // WhatsApp standard sticker canvas dimension
  const MAX_STICKER_BYTES = 1_000_000; // WhatsApp rejects stickers > 1 MB (HTTP 413)
  const SAFE_BYTES = 910_000;          // Estimation safety ceiling for green ("ok") cells
  const MAX_AUDIO_BYTES = 1_000_000;   // WhatsApp Web max audio payload for sound stickers
  const SAMPLE_RATE = 48000;           // Standard Opus sample rate
  const CAPTURE_MEM_BYTES = 320e6;     // Memory budget for decoded RGBA bitmaps
  const SIDES = [512, 448, 384, 320, 256, 224, 192, 160, 128, 96, 64];
  const FPS_LIST = [30, 25, 20, 15, 12, 10, 8, 6, 5];
  const Q_MIN = 0.15;
  const Q_FLOOR = 0.10;
  const MIN_FRAME_MS = 10;             // WhatsApp requires >= 8 ms per frame
  const Q_BY_SIDE = {
    512: 0.78,
    448: 0.72,
    384: 0.68,
    320: 0.62,
    256: 0.58,
    224: 0.55,
    192: 0.52,
    160: 0.50,
    128: 0.45,
    96: 0.45,
    64: 0.40,
  };

  // Auto-selection preference: prioritize smooth motion up to 20 fps while avoiding < 192 px unless required.
  const FPS_SCORE = { 30: 101, 25: 100.5, 20: 100, 15: 80, 12: 55, 10: 40, 8: 25, 6: 12, 5: 5 };
  function score(side, fps) {
    return (FPS_SCORE[fps] || 0) + (40 * side) / 512 - (side < 192 ? (192 - side) / 3 : 0);
  }

  function captureFpsFor(dur) {
    return dur <= 10 ? 30 : dur <= 20 ? 25 : dur <= 40 ? 20 : dur <= 80 ? 15 : 12;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const te = new TextEncoder();

  function checkAbort(signal) {
    if (signal && signal.aborted) throw new DOMException("Canceled by user", "AbortError");
  }

  // ---------------------------------------------------------------- video loading & probing
  function loadVideo(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      const url = URL.createObjectURL(file);
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        v.removeAttribute("src");
        try {
          v.load();
        } catch (e) {
          // Ignore cleanup errors
        }
        reject(err);
      };
      const timer = setTimeout(() => fail(new Error("Timed out while loading video.")), 30000);

      v.onloadeddata = async () => {
        if (settled) return;
        clearTimeout(timer);
        try {
          // Some trimmed MP4/MKV files retain non-zero initial timestamps (e.g. starting at 130 s).
          v._waasOffset = Number.isFinite(v.currentTime) ? v.currentTime : 0;
          if (v.readyState < 4) {
            await new Promise((r) => {
              const t = setTimeout(r, 4000);
              v.addEventListener(
                "canplaythrough",
                () => {
                  clearTimeout(t);
                  r();
                },
                { once: true }
              );
            });
          }

          const seekWait = (t) =>
            new Promise((r) => {
              const to = setTimeout(r, 2500);
              v.addEventListener(
                "seeked",
                () => {
                  clearTimeout(to);
                  r();
                },
                { once: true }
              );
              try {
                v.currentTime = t;
              } catch (e) {
                clearTimeout(to);
                r();
              }
            });

          const initialDuration = v.duration;
          // Resolve WebM/streamed files that initially report Infinity duration.
          if (!Number.isFinite(v.duration)) {
            await seekWait(1e7);
            await sleep(60);
          }
          // Chrome occasionally refines duration only after reaching the end of the file.
          for (let i = 0; i < 8 && Number.isFinite(v.duration); i++) {
            const d = v.duration;
            await seekWait(Math.max(0, d - 0.01));
            await sleep(35);
            if (!(v.duration > d + 0.01)) break;
          }
          await seekWait(v._waasOffset);

          if (!Number.isFinite(v.duration) || v.duration <= 0) {
            return fail(new Error("Could not determine video duration. The file may be corrupted or unsupported."));
          }
          if (v.duration !== initialDuration) {
            log("info", "video:duration-resolved", {
              initial: Number.isFinite(initialDuration) ? initialDuration : String(initialDuration),
              final: v.duration,
              offset: v._waasOffset,
            });
          }
          settled = true;
          resolve(v);
        } catch (err) {
          fail(err);
        }
      };

      v.onerror = () => {
        const e = v.error;
        fail(
          new Error(
            "The browser could not decode this video" +
              (e ? ` (code ${e.code}: ${e.message || "unsupported codec or container"})` : ".")
          )
        );
      };

      v.src = url;
      v._waasUrl = url;
    });
  }

  function seek(v, t) {
    return new Promise((resolve, reject) => {
      if (Math.abs(v.currentTime - t) < 0.0005 && v.readyState >= 2) return resolve();
      const timer = setTimeout(() => {
        v.removeEventListener("seeked", done);
        reject(new Error(`Timed out seeking to ${t.toFixed(2)} s.`));
      }, 8000);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      v.addEventListener("seeked", done, { once: true });
      v.currentTime = t;
    });
  }

  // Dimensions of any drawable source: <video>, VideoFrame (GIF/WebP), or ImageBitmap (image).
  const srcW = (s) => s.videoWidth || s.displayWidth || s.width;
  const srcH = (s) => s.videoHeight || s.displayHeight || s.height;

  function applyCornerClip(ctx, side, corner) {
    if (corner === "circle") {
      ctx.beginPath();
      ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    } else if (corner === "rounded") {
      const r = side * 0.14;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(0, 0, side, side, r);
      } else {
        ctx.moveTo(r, 0);
        ctx.arcTo(side, 0, side, side, r);
        ctx.arcTo(side, side, 0, side, r);
        ctx.arcTo(0, side, 0, 0, r);
        ctx.arcTo(0, 0, side, 0, r);
      }
      ctx.closePath();
      ctx.clip();
    }
  }

  function drawFrame(ctx, src, mode, side, corner = "square") {
    const vw = srcW(src);
    const vh = srcH(src);
    ctx.clearRect(0, 0, side, side);
    ctx.save();
    applyCornerClip(ctx, side, corner);

    if (mode === "blur" && vw !== vh) {
      // Draw blurred cover backdrop first, then crisp fitted foreground on top.
      const sc = Math.max(side / vw, side / vh);
      const cw = vw * sc;
      const ch = vh * sc;
      ctx.save();
      ctx.filter = `blur(${Math.max(4, Math.round(side * 0.035))}px) brightness(0.72)`;
      const pad = Math.max(8, Math.round(side * 0.05));
      ctx.drawImage(src, (side - cw) / 2 - pad, (side - ch) / 2 - pad, cw + pad * 2, ch + pad * 2);
      ctx.restore();
      const sf = Math.min(side / vw, side / vh);
      const fw = vw * sf;
      const fh = vh * sf;
      ctx.drawImage(src, (side - fw) / 2, (side - fh) / 2, fw, fh);
    } else {
      const s = mode === "crop" ? Math.max(side / vw, side / vh) : Math.min(side / vw, side / vh);
      const w = vw * s;
      const h = vh * s;
      ctx.drawImage(src, (side - w) / 2, (side - h) / 2, w, h);
    }

    ctx.restore();
  }

  async function probeVideo(file) {
    const v = await loadVideo(file);
    try {
      const offset = v._waasOffset || 0;
      const duration = Math.max(0.05, v.duration - offset);
      return { duration, offset, width: v.videoWidth, height: v.videoHeight };
    } finally {
      URL.revokeObjectURL(v._waasUrl);
      v.removeAttribute("src");
      v.load();
    }
  }

  function makeSnapper(side, mode, corner) {
    const canvas = new OffscreenCanvas(side, side);
    const ctx = canvas.getContext("2d");
    const fpCanvas = new OffscreenCanvas(32, 32);
    const fpCtx = fpCanvas.getContext("2d", { willReadFrequently: true });
    return (v) => {
      drawFrame(ctx, v, mode, side, corner);
      fpCtx.clearRect(0, 0, 32, 32);
      fpCtx.drawImage(canvas, 0, 0, 32, 32);
      const fp = fpCtx.getImageData(0, 0, 32, 32).data;
      return { bmpPromise: createImageBitmap(canvas), fp, used: false };
    };
  }

  // Perceptual near-duplicate detection on 32x32 RGBA fingerprints.
  // Merges static scenes with minor video compression noise while preserving all real motion.
  function sameFrame(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    let sum = 0;
    const len = a.length;
    const maxSum = len * 0.9; // average <= 0.9 / 255 per channel
    for (let i = 0; i < len; i++) {
      const d = Math.abs(a[i] - b[i]);
      if (d > 4) return false;
      sum += d;
      if (sum > maxSum) return false;
    }
    return true;
  }

  function sameBytes(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function captureByPlayback(v, t0, dur, fps, side, mode, corner, onProgress, signal) {
    return new Promise((resolve, reject) => {
      if (typeof v.requestVideoFrameCallback !== "function") {
        return reject(new Error("requestVideoFrameCallback unavailable"));
      }
      const n = Math.max(1, Math.round(dur * fps));
      const T = Array.from({ length: n }, (_, k) => t0 + (k + 0.5) / fps);
      const tEnd = t0 + dur;
      const slots = new Array(n);
      const snap = makeSnapper(side, mode, corner);
      let next = 0,
        last = null,
        pendingFirst = 0,
        done = false,
        presented = 0;
      v.style.cssText =
        "position:fixed;right:0;bottom:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-1";
      document.body.appendChild(v);
      let watchdog = setTimeout(() => finish(new Error("Video playback produced no frames.")), 4500);
      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        v.pause();
        v.remove();
        if (err) {
          for (const s of new Set(slots.filter(Boolean).concat(last ? [last] : []))) {
            s.bmpPromise.then((b) => b.close());
          }
          return reject(err);
        }
        while (next < n && last) slots[next++] = last;
        if (last) last.used = true;
        resolve({ slots, presented });
      };
      const cb = (now, meta) => {
        if (done) return;
        if (signal && signal.aborted) return finish(new DOMException("Canceled by user", "AbortError"));
        clearTimeout(watchdog);
        watchdog = setTimeout(() => finish(new Error("Video playback stalled.")), 4500);
        presented++;
        const mt = meta.mediaTime;
        while (next < n && T[next] < mt - 1e-4) {
          if (last) {
            slots[next++] = last;
            last.used = true;
          } else {
            pendingFirst++;
            next++;
          }
        }
        if (last && !last.used) last.bmpPromise.then((b) => b.close());
        last = snap(v);
        if (pendingFirst) {
          for (let i = 0; i < pendingFirst; i++) slots[i] = last;
          last.used = true;
          pendingFirst = 0;
        }
        if (onProgress && presented % 10 === 0) onProgress(`Reading video frames ${next}/${n}`, next / n);
        if (next >= n || mt >= tEnd || v.ended) return finish();
        v.requestVideoFrameCallback(cb);
      };
      v.addEventListener("ended", () => finish(), { once: true });
      seek(v, t0)
        .then(() => {
          v.requestVideoFrameCallback(cb);
          v.playbackRate = 1;
          return v.play();
        })
        .catch((e) => finish(e));
    });
  }

  async function captureBySeeking(v, t0, dur, fps, side, mode, corner, onProgress, signal) {
    const n = Math.max(1, Math.round(dur * fps));
    const snap = makeSnapper(side, mode, corner);
    const maxT = Math.max(0, v.duration - 0.001);
    const slots = [];
    for (let i = 0; i < n; i++) {
      checkAbort(signal);
      // Sample mid-interval so Chromium returns the exact intended frame instead of the prior boundary frame.
      await seek(v, Math.min(t0 + (i + 0.5) / fps, maxT));
      const s = snap(v);
      s.used = true;
      slots.push(s);
      if (onProgress && (i % 5 === 0 || i === n - 1)) onProgress(`Reading video frames ${i + 1}/${n}`, (i + 1) / n);
    }
    return { slots, presented: n };
  }

  async function captureFrames(file, start, dur, fps, side, mode, corner, onProgress, signal, method = "seek") {
    const t0 = performance.now();
    let v = await loadVideo(file);
    try {
      if (!v.videoWidth || !v.videoHeight) throw new Error("This file has no video track (is it audio-only?).");
      const offset = v._waasOffset || 0;
      const methods = method === "playback" ? ["playback", "seek"] : ["seek", "playback"];
      let res, usedMethod;
      for (let i = 0; i < methods.length; i++) {
        usedMethod = methods[i];
        try {
          res =
            usedMethod === "seek"
              ? await captureBySeeking(v, offset + start, dur, fps, side, mode, corner, onProgress, signal)
              : await captureByPlayback(v, offset + start, dur, fps, side, mode, corner, onProgress, signal);
          break;
        } catch (e) {
          if ((e && e.name === "AbortError") || i === methods.length - 1) throw e;
          log("info", "video:capture-fallback", { failed: usedMethod, reason: String((e && e.message) || e) });
          URL.revokeObjectURL(v._waasUrl);
          v = await loadVideo(file);
        }
      }
      const frames = [];
      const cache = new Map();
      for (const s of res.slots) {
        if (!cache.has(s)) cache.set(s, { bmp: await s.bmpPromise, fp: s.fp });
        frames.push(cache.get(s));
      }
      let unique = 0;
      for (let i = 0; i < frames.length; i++) if (i === 0 || !sameFrame(frames[i].fp, frames[i - 1].fp)) unique++;
      log("info", "video:frames", {
        method: usedMethod,
        frames: frames.length,
        distinct: unique,
        presented: res.presented,
        captureFps: fps,
        captureSide: side,
        ms: Math.round(performance.now() - t0),
        width: v.videoWidth,
        height: v.videoHeight,
        videoDuration: v.duration,
        offset,
      });
      return frames;
    } finally {
      URL.revokeObjectURL(v._waasUrl);
      v.removeAttribute("src");
      v.load();
    }
  }

  // ---------------------------------------------------------------- GIF, WebP, APNG & still images
  const animCache = new WeakMap();

  function isAnimationFile(file) {
    return (
      /^image\/(gif|webp|png|apng)$/i.test(file.type || "") ||
      /\.(gif|webp|png|apng)$/i.test(file.name || "")
    );
  }

  function isImageFile(file) {
    return /^image\//i.test(file.type || "") || /\.(jpe?g|png|webp|gif|apng|bmp|avif|svg)$/i.test(file.name || "");
  }

  function isAudioFile(file) {
    return /^audio\//i.test(file.type || "") || /\.(mp3|m4a|aac|ogg|opus|wav|flac|weba|wma)$/i.test(file.name || "");
  }

  function isVideoFile(file) {
    return /^video\//i.test(file.type || "") || /\.(mp4|mov|webm|mkv|m4v|avi|ogv|3gp)$/i.test(file.name || "");
  }

  function imageType(file) {
    if (file.type && file.type.startsWith("image/")) return file.type;
    const ext = (file.name || "").split(".").pop().toLowerCase();
    return (
      {
        gif: "image/gif",
        webp: "image/webp",
        png: "image/png",
        apng: "image/apng",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        avif: "image/avif",
      }[ext] || "image/gif"
    );
  }

  async function openDecoder(file) {
    if (typeof ImageDecoder === "undefined") {
      throw new Error("This browser does not support ImageDecoder (required for animated GIF/WebP). Use an updated Chrome, Edge, or Brave.");
    }
    const type = imageType(file);
    if (!(await ImageDecoder.isTypeSupported(type))) {
      throw new Error("This browser cannot decode animated images of type " + type + ".");
    }
    const dec = new ImageDecoder({ data: await file.arrayBuffer(), type });
    await dec.completed;
    await dec.tracks.ready;
    return dec;
  }

  async function probeAnimation(file) {
    if (animCache.has(file)) return animCache.get(file);
    const dec = await openDecoder(file);
    try {
      const track = dec.tracks.selectedTrack;
      const n = track ? track.frameCount : 1;
      const durs = [];
      let width = 0,
        height = 0;
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        if (!i) {
          width = image.displayWidth;
          height = image.displayHeight;
        }
        const ms = image.duration != null ? image.duration / 1000 : 0;
        // Browsers normalize GIF frames <= 10 ms to 100 ms.
        durs.push(ms > 10 ? ms : 100);
        image.close();
      }
      const info = {
        frames: n,
        durs,
        duration: n > 1 ? durs.reduce((a, b) => a + b, 0) / 1000 : 0,
        width,
        height,
        animated: n > 1,
      };
      animCache.set(file, info);
      return info;
    } finally {
      dec.close();
    }
  }

  async function captureAnimation(file, start, dur, fps, side, mode, corner, onProgress, signal) {
    const t0 = performance.now();
    const info = await probeAnimation(file);
    const ends = [];
    let acc = 0;
    for (const d of info.durs) {
      acc += d;
      ends.push(acc);
    }
    const total = acc || 1;
    const startMs = Math.max(0, (start || 0) * 1000);
    const n = Math.max(1, Math.round(dur * fps));
    const want = [];
    for (let i = 0; i < n; i++) {
      const t = (startMs + ((i + 0.5) * 1000) / fps) % total;
      let k = 0;
      while (k < ends.length - 1 && ends[k] <= t) k++;
      want.push(k);
    }
    const needed = [...new Set(want)].sort((a, b) => a - b);
    const snap = makeSnapper(side, mode, corner);
    const byIndex = new Map();
    const dec = await openDecoder(file);
    try {
      for (let j = 0; j < needed.length; j++) {
        checkAbort(signal);
        const { image } = await dec.decode({ frameIndex: needed[j] });
        const s = snap(image);
        image.close();
        byIndex.set(needed[j], { bmp: await s.bmpPromise, fp: s.fp });
        if (onProgress && (j % 5 === 0 || j === needed.length - 1)) {
          onProgress(`Decoding animation frames ${j + 1}/${needed.length}`, (j + 1) / needed.length);
        }
      }
    } finally {
      dec.close();
    }
    const frames = want.map((k) => byIndex.get(k));
    log("info", "animation:frames", {
      sourceFrames: info.frames,
      decodedUnique: needed.length,
      timelineFrames: frames.length,
      captureFps: fps,
      captureSide: side,
      sourceDuration: info.duration,
      ms: Math.round(performance.now() - t0),
    });
    return frames;
  }

  async function probeImage(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch (e) {
      throw new Error("The browser could not decode this image (" + (e && e.message ? e.message : e) + ").");
    }
    const out = { width: bmp.width, height: bmp.height, animated: false };
    bmp.close();
    if (isAnimationFile(file) && typeof ImageDecoder !== "undefined") {
      try {
        out.animated = (await probeAnimation(file)).animated;
      } catch (e) {
        // Treat as static image
      }
    }
    return out;
  }

  async function captureImage(file, side, mode, corner) {
    const bmp = await createImageBitmap(file);
    try {
      const s = makeSnapper(side, mode, corner)(bmp);
      return { bmp: await s.bmpPromise, fp: s.fp };
    } finally {
      bmp.close();
    }
  }

  function fitTimeline(captured, capDur, dur, fps, fit) {
    const n = Math.max(1, Math.round(dur * fps));
    if (fit !== "stretch" && n === captured.length) return captured;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / fps;
      let tv;
      if (fit === "stretch") {
        tv = (t / dur) * capDur;
      } else if (fit === "loop") {
        tv = t % capDur;
      } else {
        tv = Math.min(t, capDur);
      }
      out[i] = captured[Math.max(0, Math.min(captured.length - 1, Math.floor((tv / capDur) * captured.length)))];
    }
    return out;
  }

  // ---------------------------------------------------------------- WebP muxer & encoder
  function readChunks(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    if (tag(0) !== "RIFF" || tag(8) !== "WEBP") throw new Error("Canvas did not produce a valid WebP image.");
    const chunks = [];
    let i = 12;
    while (i + 8 <= bytes.length) {
      const fourcc = tag(i);
      const size = dv.getUint32(i + 4, true);
      chunks.push({ fourcc, data: bytes.subarray(i + 8, i + 8 + size) });
      i += 8 + size + (size & 1);
    }
    return chunks;
  }

  function chunk(fourcc, data) {
    const pad = data.length & 1;
    const out = new Uint8Array(8 + data.length + pad);
    out.set(te.encode(fourcc), 0);
    new DataView(out.buffer).setUint32(4, data.length, true);
    out.set(data, 8);
    return out;
  }

  function concat(parts) {
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }

  function u24(arr, off, v) {
    arr[off] = v & 255;
    arr[off + 1] = (v >> 8) & 255;
    arr[off + 2] = (v >> 16) & 255;
  }

  async function encodeStaticFrame(bitmap, quality, canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    if (blob.type !== "image/webp") {
      throw new Error("This browser cannot encode WebP images (got " + blob.type + "). Use Chrome, Edge, or Brave.");
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const parts = readChunks(bytes).filter((c) => c.fourcc === "ALPH" || c.fourcc === "VP8 " || c.fourcc === "VP8L");
    if (!parts.some((c) => c.fourcc === "VP8 " || c.fourcc === "VP8L")) throw new Error("WebP frame missing image payload.");
    const payload = concat(parts.map((c) => chunk(c.fourcc, c.data)));
    const hasAlpha = parts.some((c) => c.fourcc === "ALPH" || c.fourcc === "VP8L");
    return { payload, hasAlpha };
  }

  function buildAnimatedWebp(frames, exif, side = SIDE) {
    const anyAlpha = frames.some((f) => f.hasAlpha);
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x02 | (anyAlpha ? 0x10 : 0) | (exif ? 0x08 : 0);
    u24(vp8x, 4, side - 1);
    u24(vp8x, 7, side - 1);
    const anim = new Uint8Array(6); // transparent background, infinite loop
    const parts = [chunk("VP8X", vp8x), chunk("ANIM", anim)];
    for (const f of frames) {
      const hdr = new Uint8Array(16);
      u24(hdr, 0, 0);
      u24(hdr, 3, 0);
      u24(hdr, 6, side - 1);
      u24(hdr, 9, side - 1);
      u24(hdr, 12, Math.max(MIN_FRAME_MS, Math.min(0xffffff, f.durationMs)));
      hdr[15] = 0x02; // replace frame, no dispose
      parts.push(chunk("ANMF", concat([hdr, f.payload])));
    }
    if (exif) parts.push(chunk("EXIF", exif));
    const body = concat(parts);
    const riff = new Uint8Array(12);
    riff.set(te.encode("RIFF"), 0);
    new DataView(riff.buffer).setUint32(4, 4 + body.length, true);
    riff.set(te.encode("WEBP"), 8);
    return concat([riff, body]);
  }

  function buildStillWebp(frame, exif, side = SIDE) {
    const vp8x = new Uint8Array(10);
    vp8x[0] = (frame.hasAlpha ? 0x10 : 0) | (exif ? 0x08 : 0);
    u24(vp8x, 4, side - 1);
    u24(vp8x, 7, side - 1);
    const body = concat([chunk("VP8X", vp8x), frame.payload].concat(exif ? [chunk("EXIF", exif)] : []));
    const riff = new Uint8Array(12);
    riff.set(te.encode("RIFF"), 0);
    new DataView(riff.buffer).setUint32(4, 4 + body.length, true);
    riff.set(te.encode("WEBP"), 8);
    return concat([riff, body]);
  }

  function exifWhatsApp(meta) {
    // Big-endian TIFF block with single tag 0x5741 ("WA") holding UTF-8 JSON metadata.
    const js = te.encode(JSON.stringify(meta));
    const out = new Uint8Array(26 + js.length);
    const dv = new DataView(out.buffer);
    out.set([0x4d, 0x4d, 0x00, 0x2a], 0);
    dv.setUint32(4, 8);
    dv.setUint16(8, 1);
    dv.setUint16(10, 0x5741);
    dv.setUint16(12, 7);
    dv.setUint32(14, js.length);
    dv.setUint32(18, 26);
    dv.setUint32(22, 0);
    out.set(js, 26);
    return out;
  }

  function plan(nCaptured, dur, fps, captureFps) {
    const totalMs = Math.max(MIN_FRAME_MS, Math.round(dur * 1000));
    const count = Math.max(1, Math.round(dur * fps));
    const out = [];
    for (let k = 0; k < count; k++) {
      const startMs = Math.round((k * 1000) / fps);
      const endMs = k === count - 1 ? totalMs : Math.min(totalMs, Math.round(((k + 1) * 1000) / fps));
      const dMs = Math.max(1, endMs - startMs);
      const idx = Math.min(nCaptured - 1, Math.round((k * captureFps) / fps));
      // Merge sub-10ms tail fragments into previous frame to satisfy WhatsApp's >= 8ms frame minimum.
      if (dMs < MIN_FRAME_MS && out.length > 0) {
        out[out.length - 1].durationMs += dMs;
      } else {
        out.push({ idx, durationMs: Math.max(MIN_FRAME_MS, dMs) });
      }
    }
    return out;
  }

  function sampleAvg(an, side, q) {
    const m = an.sampleBytes && an.sampleBytes[side];
    if (!m) return 0;
    if (m[q] != null) return m[q];
    const qs = Object.keys(m)
      .map(Number)
      .sort((x, y) => x - y);
    if (!qs.length) return 0;
    if (q <= qs[0]) return m[qs[0]];
    if (q >= qs[qs.length - 1]) return m[qs[qs.length - 1]];
    for (let i = 0; i < qs.length - 1; i++) {
      if (q >= qs[i] && q <= qs[i + 1]) {
        const t = (q - qs[i]) / (qs[i + 1] - qs[i]);
        return m[qs[i]] + t * (m[qs[i + 1]] - m[qs[i]]);
      }
    }
    return 0;
  }

  async function encodeWebp(an, side, fps, exifMeta, { onProgress, signal, syncMs = 0, still = false }) {
    const { frames, dur, captureFps } = an;
    const canvas = new OffscreenCanvas(side, side);
    const ctx = canvas.getContext("2d");
    const p = plan(frames.length, dur, fps, captureFps);
    const qStart = Q_BY_SIDE[side] || 0.55;
    const qCandidates = [];
    for (let q = qStart; q >= Q_MIN - 1e-9; q -= 0.08) qCandidates.push(+q.toFixed(2));
    if (qCandidates[qCandidates.length - 1] > Q_MIN) qCandidates.push(Q_MIN);
    if (qCandidates[qCandidates.length - 1] > Q_FLOOR) qCandidates.push(Q_FLOOR);

    // Jump directly near the predicted fitting quality if the sample estimator shows qStart is well over 1 MB.
    let startIdx = 0;
    if (an.sampleBytes && an.distinct && an.distinct[fps]) {
      const nDistinct = an.distinct[fps];
      const estAt = (q) => (sampleAvg(an, side, q) + 32) * nDistinct + 400;
      if (estAt(qCandidates[0]) > MAX_STICKER_BYTES * 1.06) {
        for (let i = 1; i < qCandidates.length; i++) {
          if (estAt(qCandidates[i]) <= MAX_STICKER_BYTES * 0.96) {
            // Try one step higher first so we don't needlessly under-shoot quality.
            startIdx = Math.max(0, i - 1);
            break;
          }
          startIdx = i;
        }
      }
    }

    const attempts = [];
    let best = null;
    for (let i = startIdx; i < qCandidates.length; i++) {
      const q = qCandidates[i];
      if (best && an.sampleBytes && i < qCandidates.length - 1) {
        const prevAvg = sampleAvg(an, side, best.q);
        const nextAvg = sampleAvg(an, side, q);
        const ratio = prevAvg > 0 ? nextAvg / prevAvg : 0;
        if (ratio > 0 && best.bytes.length * ratio > MAX_STICKER_BYTES * 0.99) {
          attempts.push({ q, skipped: true, predicted: Math.round(best.bytes.length * ratio) });
          continue;
        }
      }
      const cache = new Map();
      const out = [];
      let prevF = null;
      for (let k = 0; k < p.length; k++) {
        checkAbort(signal);
        const f = frames[p[k].idx];
        const prev = out[out.length - 1];
        if (prev && prevF && (f === prevF || sameFrame(f.fp, prevF.fp))) {
          prev.durationMs += p[k].durationMs;
          continue;
        }
        let enc = cache.get(f);
        if (!enc) {
          enc = await encodeStaticFrame(f.bmp, q, canvas, ctx);
          cache.set(f, enc);
        }
        prevF = f;
        if (prev && sameBytes(prev.payload, enc.payload)) {
          prev.durationMs += p[k].durationMs;
        } else {
          out.push({ payload: enc.payload, hasAlpha: enc.hasAlpha, durationMs: p[k].durationMs });
        }
        if (onProgress && (k % 8 === 0 || k === p.length - 1)) {
          onProgress(
            `Encoding WebP (${side}px · ${fps}fps · Q${Math.round(q * 100)}) ${k + 1}/${p.length}`,
            0.18 + 0.82 * ((k + 1) / p.length)
          );
        }
      }
      if (syncMs > 0 && !still) {
        out[0] = { ...out[0], durationMs: out[0].durationMs + syncMs };
      }
      const bytes = still
        ? buildStillWebp(out[0], exifWhatsApp(exifMeta), side)
        : buildAnimatedWebp(out, exifWhatsApp(exifMeta), side);
      attempts.push({ q, bytes: bytes.length, frames: out.length });
      best = { bytes, side, fps, q, frames: out.length };
      if (bytes.length <= MAX_STICKER_BYTES) break;
    }

    log("info", "webp:encode", { side, fps, attempts });
    if (!best || best.bytes.length > MAX_STICKER_BYTES) {
      throw new Error(
        `Sticker exceeds WhatsApp's 1 MB limit even at minimum quality (${Math.round(
          (best ? best.bytes.length : 0) / 1000
        )} KB). Pick a lower FPS, smaller resolution, or shorter clip.`
      );
    }
    return best;
  }

  // ---------------------------------------------------------------- audio decoding & processing
  const audioCache = new WeakMap();

  function decodeAudioFile(file) {
    if (!audioCache.has(file)) {
      const p = (async () => {
        const buf = await file.arrayBuffer();
        try {
          const dctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE);
          return await dctx.decodeAudioData(buf);
        } catch (e) {
          const err = new Error(
            "Could not decode audio directly (" + (e && e.message ? e.message : e) + ")."
          );
          err.cause = e;
          throw err;
        }
      })();
      p.catch(() => audioCache.delete(file));
      audioCache.set(file, p);
    }
    return audioCache.get(file);
  }

  // Fallback for video containers (e.g. MKV/MOV/AVI) that <video> can play but WebAudio decodeAudioData rejects.
  async function captureVideoAudioFallback(file, start, dur, signal) {
    if (typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") {
      throw new Error("This file's audio format is not supported by the browser.");
    }
    log("info", "audio:fallback-capture-start", { file: file.name, start, dur });
    const v = await loadVideo(file);
    const ac = new AudioContext();
    try {
      if (ac.state === "suspended") await ac.resume();
      const offset = v._waasOffset || 0;
      const srcNode = ac.createMediaElementSource(v);
      const dest = ac.createMediaStreamDestination();
      srcNode.connect(dest); // Routed ONLY to MediaStreamDestination — silent to user speakers!
      v.muted = false;
      v.volume = 1;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
      const chunks = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) chunks.push(ev.data);
      };
      const stopped = new Promise((res) => (rec.onstop = res));
      await seek(v, offset + start);
      checkAbort(signal);
      rec.start(200);
      await v.play();
      const endTarget = offset + start + dur;
      const tStart = performance.now();
      const maxWait = dur * 1000 + 3500;
      while (!v.ended && v.currentTime < endTarget && performance.now() - tStart < maxWait) {
        checkAbort(signal);
        await sleep(40);
      }
      v.pause();
      if (rec.state !== "inactive") rec.stop();
      await stopped;
      const recordedBlob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (!recordedBlob.size) throw new Error("No audio track was detected in this video.");
      const dctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE);
      const decoded = await dctx.decodeAudioData(await recordedBlob.arrayBuffer());
      log("info", "audio:fallback-capture-done", { duration: decoded.duration, bytes: recordedBlob.size });
      return decoded;
    } finally {
      try {
        v.pause();
      } catch (e) {}
      URL.revokeObjectURL(v._waasUrl);
      v.removeAttribute("src");
      v.load();
      try {
        await ac.close();
      } catch (e) {}
    }
  }

  async function probeAudio(file, buckets = 1200) {
    const d = await decodeAudioFile(file);
    const chans = Array.from({ length: d.numberOfChannels }, (_, c) => d.getChannelData(c));
    const per = Math.max(1, Math.floor(d.length / buckets));
    const peaks = new Float32Array(Math.ceil(d.length / per));
    let max = 0;
    for (let b = 0; b < peaks.length; b++) {
      let p = 0;
      const end = Math.min(d.length, (b + 1) * per);
      for (const ch of chans) {
        for (let i = b * per; i < end; i += 4) {
          const a = Math.abs(ch[i]);
          if (a > p) p = a;
        }
      }
      peaks[b] = p;
      if (p > max) max = p;
    }
    return { duration: d.duration, channels: d.numberOfChannels, peaks, peakMax: max, hasAudio: max > 0.0004 };
  }

  async function extractAudio(file, start, dur, { fadeMs = 0, gain = 1, normalize = false, signal } = {}) {
    let decoded;
    let sliceStart = start;
    try {
      decoded = await decodeAudioFile(file);
    } catch (e) {
      if (isVideoFile(file)) {
        decoded = await captureVideoAudioFallback(file, start, dur, signal);
        sliceStart = 0; // Fallback captured starting from `start` already.
      } else {
        throw new Error("Could not read audio track. Does this file contain sound? (" + (e.message || e) + ")");
      }
    }

    if (decoded.duration < sliceStart + 0.04) {
      throw new Error(
        `Audio track is ${decoded.duration.toFixed(2)} s long, which is shorter than the clip start (${sliceStart.toFixed(
          2
        )} s).`
      );
    }
    const effectiveDur = Math.min(dur, Math.max(0.05, decoded.duration - sliceStart));
    const len = Math.max(1, Math.round(dur * SAMPLE_RATE));
    const octx = new OfflineAudioContext(1, len, SAMPLE_RATE);
    const src = octx.createBufferSource();
    src.buffer = decoded;
    src.connect(octx.destination); // Downmix cleanly to mono
    src.start(0, sliceStart, effectiveDur);
    const rendered = await octx.startRendering();
    const pcm = rendered.getChannelData(0);

    let peak = 0;
    for (let i = 0; i < pcm.length; i++) {
      const a = Math.abs(pcm[i]);
      if (a > peak) peak = a;
    }

    // Apply optional auto-normalization and gain boost with soft limiting to prevent harsh clipping.
    let mult = Number.isFinite(+gain) ? Math.max(0.1, Math.min(3.5, +gain)) : 1;
    if (normalize && peak > 0.002) {
      const normGain = Math.min(8, 0.90 / peak);
      mult *= normGain;
    }
    if (Math.abs(mult - 1) > 0.005) {
      const willClip = peak * mult > 0.98;
      const normTanh = Math.tanh(1.15);
      for (let i = 0; i < pcm.length; i++) {
        const s = pcm[i] * mult;
        pcm[i] = willClip ? Math.tanh(s * 1.15) / normTanh : Math.max(-1, Math.min(1, s));
      }
    }

    // Short edge fade prevents click/pop artifacts on trimmed clips.
    if (fadeMs > 0) {
      const f = Math.min(Math.floor(pcm.length / 2), Math.round((fadeMs / 1000) * SAMPLE_RATE));
      for (let i = 0; i < f; i++) {
        const g = i / f;
        pcm[i] *= g;
        pcm[pcm.length - 1 - i] *= g;
      }
    }

    let finalPeak = 0,
      sumsq = 0;
    for (let i = 0; i < pcm.length; i++) {
      const a = Math.abs(pcm[i]);
      if (a > finalPeak) finalPeak = a;
      sumsq += pcm[i] * pcm[i];
    }
    const rms = Math.sqrt(sumsq / pcm.length);
    log("info", "audio:pcm", {
      sourceChannels: decoded.numberOfChannels,
      sourceRate: decoded.sampleRate,
      audioDuration: decoded.duration,
      samples: pcm.length,
      gainApplied: +mult.toFixed(2),
      normalize: !!normalize,
      peak: +finalPeak.toFixed(4),
      rms: +rms.toFixed(4),
    });
    if (finalPeak < 0.0005) log("warn", "audio:silent", "Selected clip appears to be silent.");
    return pcm;
  }

  async function encodeOpus(pcm, bitrate = 48000) {
    if (typeof AudioEncoder === "undefined") {
      throw new Error("WebCodecs AudioEncoder is not available. Please use an updated Chrome, Edge, or Brave.");
    }
    const base = { codec: "opus", sampleRate: SAMPLE_RATE, numberOfChannels: 1, bitrate };
    const candidates = [
      { ...base, bitrateMode: "variable", opus: { frameDuration: 20000, complexity: 10, application: "audio" } },
      { ...base, bitrateMode: "variable", opus: { frameDuration: 20000 } },
      base,
    ];
    let config = null;
    for (const c of candidates) {
      try {
        if ((await AudioEncoder.isConfigSupported(c)).supported) {
          config = c;
          break;
        }
      } catch (e) {
        // Try next candidate
      }
    }
    if (!config) throw new Error("This browser cannot encode Opus audio via WebCodecs.");

    const packets = [];
    let description = null;
    let encError = null;
    const enc = new AudioEncoder({
      output: (chunkOut, meta) => {
        const b = new Uint8Array(chunkOut.byteLength);
        chunkOut.copyTo(b);
        packets.push(b);
        if (!description && meta && meta.decoderConfig && meta.decoderConfig.description) {
          const d = meta.decoderConfig.description;
          description =
            d instanceof ArrayBuffer ? new Uint8Array(d) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
        }
      },
      error: (e) => {
        encError = e;
      },
    });
    enc.configure(config);
    const BLOCK = 960 * 50;
    for (let i = 0; i < pcm.length; i += BLOCK) {
      const n = Math.min(BLOCK, pcm.length - i);
      const data = new Float32Array(pcm.subarray(i, i + n));
      const ad = new AudioData({
        format: "f32-planar",
        sampleRate: SAMPLE_RATE,
        numberOfFrames: n,
        numberOfChannels: 1,
        timestamp: Math.round((i / SAMPLE_RATE) * 1e6),
        data,
      });
      enc.encode(ad);
      ad.close();
    }
    await enc.flush();
    enc.close();
    if (encError) throw encError;
    let preSkip = 312;
    if (description && description.length >= 12 && String.fromCharCode(...description.subarray(0, 8)) === "OpusHead") {
      preSkip = description[10] | (description[11] << 8);
    }
    return { packets, preSkip, config };
  }

  // Ogg (RFC 3533) + Opus encapsulation (RFC 7845)
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let r = i << 24;
      for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
      t[i] = r >>> 0;
    }
    return t;
  })();

  function oggCrc(bytes) {
    let c = 0;
    for (let i = 0; i < bytes.length; i++) c = ((c << 8) ^ CRC_TABLE[((c >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
    return c >>> 0;
  }

  function oggPage(headerType, granule, serial, seq, packetList) {
    const lacing = [];
    for (const p of packetList) {
      let len = p.length;
      while (len >= 255) {
        lacing.push(255);
        len -= 255;
      }
      lacing.push(len);
    }
    if (lacing.length > 255) throw new Error("Ogg page exceeded 255 lacing segments.");
    const dataLen = packetList.reduce((a, p) => a + p.length, 0);
    const page = new Uint8Array(27 + lacing.length + dataLen);
    const dv = new DataView(page.buffer);
    page.set(te.encode("OggS"), 0);
    page[4] = 0;
    page[5] = headerType;
    dv.setBigInt64(6, BigInt(granule), true);
    dv.setUint32(14, serial, true);
    dv.setUint32(18, seq, true);
    dv.setUint32(22, 0, true);
    page[26] = lacing.length;
    page.set(lacing, 27);
    let o = 27 + lacing.length;
    for (const p of packetList) {
      page.set(p, o);
      o += p.length;
    }
    dv.setUint32(22, oggCrc(page), true);
    return page;
  }

  function buildOggOpus(packets, preSkip, totalSamples) {
    const serial = (Math.random() * 0xffffffff) >>> 0;
    const head = new Uint8Array(19);
    head.set(te.encode("OpusHead"), 0);
    head[8] = 1;
    head[9] = 1;
    new DataView(head.buffer).setUint16(10, preSkip, true);
    new DataView(head.buffer).setUint32(12, SAMPLE_RATE, true);

    const vendor = te.encode("4x4Tools-Wa-Audio-Stickers");
    const tags = new Uint8Array(8 + 4 + vendor.length + 4);
    tags.set(te.encode("OpusTags"), 0);
    new DataView(tags.buffer).setUint32(8, vendor.length, true);
    tags.set(vendor, 12);

    const pages = [oggPage(0x02, 0, serial, 0, [head]), oggPage(0x00, 0, serial, 1, [tags])];
    const finalGranule = preSkip + totalSamples;
    const MAX_PER_PAGE = 50;
    let seq = 2;
    let idx = 0;
    while (idx < packets.length) {
      const group = [];
      let segs = 0;
      while (idx < packets.length && group.length < MAX_PER_PAGE) {
        const needed = Math.floor(packets[idx].length / 255) + 1;
        if (group.length > 0 && segs + needed > 250) break;
        group.push(packets[idx++]);
        segs += needed;
      }
      const isLast = idx >= packets.length;
      const granule = isLast ? finalGranule : Math.min(finalGranule, preSkip + idx * 960);
      pages.push(oggPage(isLast ? 0x04 : 0x00, granule, serial, seq++, group));
    }
    return concat(pages);
  }

  async function sha256b64(bytes) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    let s = "";
    for (const b of h) s += String.fromCharCode(b);
    return btoa(s);
  }

  async function verifyOgg(bytes) {
    try {
      const ctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE);
      const buf = await ctx.decodeAudioData(bytes.slice().buffer);
      return { ok: true, duration: +buf.duration.toFixed(3) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  // ---------------------------------------------------------------- sticker EXIF metadata
  async function packIdFor(packName, publisher) {
    if (!packName && !publisher) return crypto.randomUUID();
    const h = new Uint8Array(
      await crypto.subtle.digest("SHA-256", te.encode("4x4tools-wa-audio-stickers|" + packName + "|" + publisher))
    );
    const x = Array.from(h.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
  }

  function parseEmojis(raw) {
    if (Array.isArray(raw)) {
      const list = raw.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 3);
      return list.length ? list : ["🔊"];
    }
    const str = String(raw || "").trim();
    if (!str) return ["🔊"];
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segs = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(str)]
        .map((s) => s.segment.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (segs.length) return segs;
    }
    return [str.slice(0, 4)];
  }

  async function stickerMeta({ packName = "", publisher = "", emojis = ["🔊"], soundSha }) {
    packName = String(packName || "").trim().slice(0, 128);
    publisher = String(publisher || "").trim().slice(0, 128);
    const meta = { "sticker-pack-id": await packIdFor(packName, publisher) };
    if (packName) meta["sticker-pack-name"] = packName;
    if (publisher) meta["sticker-pack-publisher"] = publisher;
    meta.emojis = parseEmojis(emojis);
    meta["sound-sha256"] = soundSha;
    return meta;
  }

  async function retagWebp(blob, { packName, publisher, emojis, soundSha }) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const chunks = readChunks(bytes).filter((c) => c.fourcc !== "EXIF");
    const vp8x = chunks.find((c) => c.fourcc === "VP8X");
    if (vp8x) {
      const d = new Uint8Array(vp8x.data);
      d[0] |= 0x08;
      vp8x.data = d;
    }
    const meta = await stickerMeta({ packName, publisher, emojis, soundSha });
    const body = concat(
      [te.encode("WEBP")].concat(
        chunks.map((c) => chunk(c.fourcc, c.data)),
        [chunk("EXIF", exifWhatsApp(meta))]
      )
    );
    const riff = new Uint8Array(8);
    riff.set(te.encode("RIFF"), 0);
    new DataView(riff.buffer).setUint32(4, body.length, true);
    return new Blob([concat([riff, body])], { type: "image/webp" });
  }

  // ---------------------------------------------------------------- Public API
  // Step 1: Capture visual frames once and estimate size across all resolution x FPS combinations.
  async function analyze({
    file,
    start = 0,
    duration,
    mode = "fit",
    corner = "square",
    visual,
    audio,
    fit = "loop",
    onProgress,
    signal,
  }) {
    if (!visual) visual = { kind: "video", file, start, dur: duration };
    if (!audio) audio = { file: visual.file, start: visual.start, dur: visual.dur };
    const prog = onProgress || (() => {});
    const t0 = performance.now();
    const vDur = visual.kind === "image" ? audio.dur : visual.dur;
    const dur = visual.kind === "image" || fit !== "independent" ? audio.dur : vDur;
    const capDur = fit === "stretch" ? vDur : Math.min(vDur, dur);
    const base = { file: visual.file, start: visual.start || 0, visual, audio, fit, dur, vDur, mode, corner };

    if (visual.kind === "image") {
      log("info", "analyze:params", {
        kind: "image",
        file: visual.file.name,
        bytes: visual.file.size,
        audioDuration: audio.dur,
        mode,
        corner,
      });
      prog("Preparing image…", 0.35);
      const f = await captureImage(visual.file, SIDE, mode, corner);
      const cells = SIDES.map((side) => ({ side, fps: 1, state: "ok", score: side }));
      const an = {
        ...base,
        frames: [f],
        captureFps: 1,
        captureSide: SIDE,
        distinct: { 1: 1 },
        cells,
        auto: cells[0],
        ms: Math.round(performance.now() - t0),
      };
      prog("Image ready", 1);
      return an;
    }

    const captureFps = captureFpsFor(Math.max(dur, capDur));
    const slots = Math.max(1, Math.ceil(capDur * captureFps));
    const captureSide = Math.max(64, Math.min(SIDE, Math.floor(Math.sqrt(CAPTURE_MEM_BYTES / (4 * slots)))));
    log("info", "analyze:params", {
      kind: visual.kind,
      file: visual.file.name,
      bytes: visual.file.size,
      start: visual.start || 0,
      visualDuration: vDur,
      separateAudio: audio.file !== visual.file,
      audioDuration: audio.dur,
      fit,
      stickerDuration: dur,
      mode,
      corner,
      captureFps,
      captureSide,
    });

    const capProg = (t, f) => prog(t, f * 0.78);
    const captured =
      visual.kind === "gif"
        ? await captureAnimation(visual.file, visual.start || 0, capDur, captureFps, captureSide, mode, corner, capProg, signal)
        : await captureFrames(visual.file, visual.start || 0, capDur, captureFps, captureSide, mode, corner, capProg, signal);

    const frames = fitTimeline(captured, capDur, dur, captureFps, fit);
    const sides = SIDES.filter((x) => x <= captureSide);
    const fpsList = FPS_LIST.filter((x) => x <= captureFps);

    const distinct = {};
    for (const f of fpsList) {
      const p = plan(frames.length, dur, f, captureFps);
      let d = 0;
      for (let k = 0; k < p.length; k++) {
        const a = frames[p[k].idx];
        const b = k ? frames[p[k - 1].idx] : null;
        if (!b || (a !== b && !sameFrame(a.fp, b.fp))) d++;
      }
      distinct[f] = d;
    }

    // Sample up to 24 distinct frames across the clip using golden-ratio spacing to avoid periodic aliasing.
    const uniq = [];
    for (let i = 0; i < frames.length; i++) {
      if (!i || (frames[i] !== frames[i - 1] && !sameFrame(frames[i].fp, frames[i - 1].fp))) uniq.push(frames[i]);
    }
    const M = Math.min(24, uniq.length);
    const sample = Array.from(
      { length: M },
      (_, i) => uniq[Math.min(uniq.length - 1, Math.floor(((i + ((i * 0.618) % 1)) * uniq.length) / M))]
    );

    const sampleBytes = {};
    let done = 0;
    for (const side of sides) {
      const canvas = new OffscreenCanvas(side, side);
      const ctx = canvas.getContext("2d");
      sampleBytes[side] = {};
      for (const q of [Q_BY_SIDE[side], 0.35, Q_MIN]) {
        if (sampleBytes[side][q] != null) continue;
        let sum = 0;
        for (const f of sample) {
          checkAbort(signal);
          sum += (await encodeStaticFrame(f.bmp, q, canvas, ctx)).payload.length;
        }
        sampleBytes[side][q] = sum / sample.length;
      }
      prog("Estimating size matrix…", 0.78 + (0.22 * ++done) / sides.length);
    }

    const overhead = 32;
    const cells = [];
    for (const side of SIDES) {
      for (const fps of FPS_LIST) {
        if (!sampleBytes[side] || distinct[fps] == null) {
          cells.push({ side, fps, state: "out" });
          continue;
        }
        const n = distinct[fps];
        const est = (sampleBytes[side][Q_BY_SIDE[side]] + overhead) * n + 400;
        const estMin = (sampleBytes[side][Q_MIN] + overhead) * n + 400;
        const state = est <= SAFE_BYTES ? "ok" : estMin <= SAFE_BYTES ? "low" : "no";
        cells.push({ side, fps, est: Math.round(est), estMin: Math.round(estMin), state, score: score(side, fps) });
      }
    }

    const pick = (st) => cells.filter((c) => c.state === st).sort((x, y) => y.score - x.score)[0];
    const auto = pick("ok") || pick("low") || null;
    const an = {
      ...base,
      frames,
      captureFps,
      captureSide,
      sampleBytes,
      distinct,
      cells,
      auto,
      ms: Math.round(performance.now() - t0),
    };

    log("info", "analyze:result", {
      ms: an.ms,
      captureFps,
      captureSide,
      distinct,
      sampleCount: M,
      auto: auto && { side: auto.side, fps: auto.fps, est: auto.est, state: auto.state },
      okCount: cells.filter((c) => c.state === "ok").length,
      lowQualityCount: cells.filter((c) => c.state === "low").length,
    });
    prog("Quality matrix ready", 1);
    return an;
  }

  function release(an) {
    if (!an || !an.frames) return;
    for (const f of new Set(an.frames)) {
      try {
        f.bmp.close();
      } catch (e) {
        // Already closed
      }
    }
    an.frames = null;
  }

  // Step 2: Encode Opus audio and WebP sticker using analyzed frames.
  async function create(
    an,
    {
      side,
      fps,
      syncMs = 0,
      still = false,
      audio = null,
      audioOpts = {},
      onProgress,
      signal,
      packName = "",
      publisher = "",
      emojis = ["🔊"],
    }
  ) {
    if (!an || !an.frames) throw new Error("Run analysis first before creating the sticker.");
    syncMs = Math.max(0, Math.min(1000, Math.round(+syncMs || 0)));
    still = !!still && an.visual.kind === "image";
    const prog = onProgress || (() => {});
    const t0 = performance.now();
    const { dur } = an;
    const A = audio || an.audio;
    if (an.visual.kind === "image" || an.fit !== "independent") {
      if (Math.abs(A.dur - an.audio.dur) > 0.005) {
        throw new Error("Audio clip duration changed — re-analyze options to update visual timing.");
      }
    }
    const cell = an.cells.find((c) => c.side === side && c.fps === fps);
    log("info", "create:params", {
      side,
      fps,
      syncMs,
      still,
      estimatedBytes: cell && cell.est,
      state: cell && cell.state,
    });

    // Compute safe Opus bitrate capped to stay under WhatsApp's 1 MB audio limit.
    const desiredBps = audioOpts.targetKbps ? Math.max(16000, Math.min(64000, audioOpts.targetKbps * 1000)) : 48000;
    const maxSafeBps = Math.floor((0.90 * MAX_AUDIO_BYTES * 8) / Math.max(0.1, A.dur));
    const bitrate = Math.max(12000, Math.min(desiredBps, maxSafeBps));
    if ((bitrate / 8) * A.dur > 0.97 * MAX_AUDIO_BYTES) {
      const maxMin = Math.floor((0.9 * MAX_AUDIO_BYTES * 8) / 12000 / 60);
      throw new Error(
        `At ${Math.round(A.dur)} s, audio exceeds WhatsApp's 1 MB limit (maximum is roughly ${maxMin} minutes).`
      );
    }

    prog("Extracting & processing audio…", 0.04);
    const defaultFade = A.file !== an.visual.file ? 8 : 0;
    const fadeMs = audioOpts.fadeMs != null ? +audioOpts.fadeMs : defaultFade;
    const pcm = await extractAudio(A.file, A.start, A.dur, {
      fadeMs,
      gain: audioOpts.gain != null ? +audioOpts.gain : 1,
      normalize: !!audioOpts.normalize,
      signal,
    });
    checkAbort(signal);

    prog("Encoding Opus audio…", 0.12);
    let { packets, preSkip, config } = await encodeOpus(pcm, bitrate);
    let ogg = buildOggOpus(packets, preSkip, pcm.length);
    // If VBR slightly exceeded 1 MB, automatically re-encode at a conservative lower bitrate.
    if (ogg.length > MAX_AUDIO_BYTES && bitrate > 12000) {
      const retryBps = Math.max(12000, Math.floor(bitrate * (0.92 * MAX_AUDIO_BYTES / ogg.length)));
      log("warn", "audio:reencode-lower-bitrate", { firstBytes: ogg.length, retryBps });
      ({ packets, preSkip, config } = await encodeOpus(pcm, retryBps));
      ogg = buildOggOpus(packets, preSkip, pcm.length);
    }
    if (ogg.length > MAX_AUDIO_BYTES) {
      throw new Error(`Encoded audio is ${Math.round(ogg.length / 1000)} KB (WhatsApp limit is 1000 KB). Shorten the audio clip.`);
    }

    const soundSha = await sha256b64(ogg);
    const oggCheck = await verifyOgg(ogg);
    log(oggCheck.ok ? "info" : "error", "audio:ogg", {
      bytes: ogg.length,
      packets: packets.length,
      preSkip,
      config,
      verify: oggCheck,
      soundSha256: soundSha,
    });
    if (!oggCheck.ok) throw new Error("Generated Ogg/Opus audio failed playback verification: " + oggCheck.error);

    const exifMeta = await stickerMeta({ packName, publisher, emojis, soundSha });
    const w = await encodeWebp(an, side, fps, exifMeta, { onProgress: prog, signal, syncMs, still });
    const info = {
      kind: an.visual.kind,
      fit: an.fit,
      mode: an.mode,
      corner: an.corner,
      duration: dur,
      audioDuration: A.dur,
      audioSeconds: Math.max(1, Math.round(A.dur)),
      fps: an.visual.kind === "image" ? null : w.fps,
      quality: w.q,
      side: w.side,
      frames: w.frames,
      isAnimated: !still,
      syncMs,
      webpBytes: w.bytes.length,
      estimatedBytes: cell && cell.est,
      oggBytes: ogg.length,
      audioKbps: Math.round((config.bitrate || bitrate) / 1000),
      soundSha256: soundSha,
      packName: exifMeta["sticker-pack-name"] || "",
      publisher: exifMeta["sticker-pack-publisher"] || "",
      emojis: exifMeta.emojis || ["🔊"],
      totalMs: Math.round(performance.now() - t0),
    };
    log("info", "create:result", info);
    prog("Sticker ready", 1);
    return {
      webp: new Blob([w.bytes], { type: "image/webp" }),
      ogg: new Blob([ogg], { type: "audio/ogg; codecs=opus" }),
      info,
    };
  }

  async function convert({
    file,
    start = 0,
    duration,
    mode = "fit",
    corner = "square",
    visual,
    audio,
    audioOpts = {},
    fit = "loop",
    still = false,
    syncMs = 0,
    side = "auto",
    fps = "auto",
    packName = "",
    publisher = "",
    emojis = ["🔊"],
    onProgress,
    signal,
  }) {
    const an = await analyze({ file, start, duration, mode, corner, visual, audio, fit, onProgress, signal });
    try {
      let c = an.auto;
      if (side !== "auto" || fps !== "auto") {
        const ok = an.cells.filter(
          (x) => (side === "auto" || x.side === +side) && (fps === "auto" || x.fps === +fps) && x.state !== "no" && x.state !== "out"
        );
        c = ok.sort((x, y) => y.score - x.score)[0];
      }
      if (!c) throw new Error("No resolution/FPS combination fits within 1 MB for this clip length.");
      const r = await create(an, {
        side: c.side,
        fps: c.fps,
        syncMs,
        still,
        audioOpts,
        packName,
        publisher,
        emojis,
        onProgress,
        signal,
      });
      r.analysis = { auto: an.auto, cells: an.cells, ms: an.ms, captureFps: an.captureFps, captureSide: an.captureSide };
      return r;
    } finally {
      release(an);
    }
  }

  async function capabilities() {
    const out = {
      offscreenCanvas: typeof OffscreenCanvas !== "undefined",
      webCodecsAudio: typeof AudioEncoder !== "undefined",
      imageDecoder: typeof ImageDecoder !== "undefined",
    };
    try {
      const c = new OffscreenCanvas(4, 4);
      c.getContext("2d").fillRect(0, 0, 2, 2);
      const b = await c.convertToBlob({ type: "image/webp", quality: 0.5 });
      out.webpEncode = b.type;
    } catch (e) {
      out.webpEncode = "error: " + e.message;
    }
    if (out.webCodecsAudio) {
      try {
        out.opus = (
          await AudioEncoder.isConfigSupported({ codec: "opus", sampleRate: 48000, numberOfChannels: 1, bitrate: 48000 })
        ).supported;
      } catch (e) {
        out.opus = "error: " + e.message;
      }
    }
    return out;
  }

  WAAS.convert = convert;
  WAAS.probeVideo = probeVideo;
  WAAS.probeAudio = probeAudio;
  WAAS.decodeAudioFile = decodeAudioFile;
  WAAS.probeImage = probeImage;
  WAAS.probeAnimation = probeAnimation;
  WAAS.isAnimationFile = isAnimationFile;
  WAAS.isImageFile = isImageFile;
  WAAS.isAudioFile = isAudioFile;
  WAAS.isVideoFile = isVideoFile;
  WAAS.parseEmojis = parseEmojis;
  WAAS.capabilities = capabilities;
  WAAS.analyze = analyze;
  WAAS.retagWebp = retagWebp;
  WAAS.create = create;
  WAAS.release = release;
  WAAS.limits = { SIDE, MAX_STICKER_BYTES, MAX_AUDIO_BYTES, SIDES, FPS_LIST };
  WAAS._internals = {
    buildOggOpus,
    buildAnimatedWebp,
    buildStillWebp,
    fitTimeline,
    exifWhatsApp,
    readChunks,
    plan,
    sha256b64,
    score,
    sameFrame,
  };
})();
