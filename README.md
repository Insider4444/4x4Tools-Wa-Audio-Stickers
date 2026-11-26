<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="4x4Tools-Wa-Audio-Stickers Logo">
</p>

<h1 align="center">4x4Tools-Wa-Audio-Stickers</h1>

<p align="center">
  <strong>Create, customize, and send WhatsApp audio stickers directly inside WhatsApp Web.</strong><br>
  Videos, GIFs, images, and custom audio clips — processed 100% locally in your browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-00a884?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Processing-100%25%20Local-00a884?style=flat-square" alt="100% Local Processing">
  <img src="https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge%20%7C%20Brave-202c33?style=flat-square" alt="Chromium Browsers">
  <img src="https://img.shields.io/badge/Engine-WebCodecs%20%2B%20WebAudio-202c33?style=flat-square" alt="WebCodecs + WebAudio">
</p>

---

## Overview & Use Cases

**4x4Tools-Wa-Audio-Stickers** is a Manifest V3 Chromium browser extension that embeds a full audio-sticker studio directly inside [WhatsApp Web](https://web.whatsapp.com).

- **Meme & Reaction Clips:** Turn short funny video clips with sound into instant playable WhatsApp stickers.
- **Image + Soundboard Stickers:** Pair any static photo, artwork, or screenshot (including `Ctrl+V` clipboard paste) with a voice line, sound effect, or song snippet.
- **GIF / Video Remixing:** Combine any animated GIF, animated WebP, APNG, or muted video with a completely different audio track—with independent timing, looping, freeze-frame, or speed-matching.
- **Instant Sharing & Pack Tagging:** Tag stickers with custom Pack Name, Author, and Emoji metadata, send straight to your active chat or personal chat, or trigger WhatsApp's native Forward modal.

> **Note:** This is an independent, unofficial tool not affiliated with WhatsApp or Meta. All encoding happens locally on your machine; files are only uploaded to WhatsApp when you explicitly click **Send Sticker**.

---

## Features

| Category | Highlights |
| --- | --- |
| **3 Creation Modes** | **Video + Sound**, **Image + Audio**, and **Video / GIF + Audio** with drag & drop, clipboard image paste (`Ctrl+V`), and automatic file-type tab routing. |
| **Precision Timeline Trimmer** | Live audio waveform visualization on both audio and video timelines, dual trim handles, draggable selection window, quick duration presets (`Full`, `3s`, `5s`, `10s`, `15s`), Loop toggle, and keyboard shortcuts (`Space`, `I`, `O`, `←`/`→`, `Esc`). |
| **Visual Framing & Shapes** | Live 1:1 sticker frame preview with **Fit (Transparent)**, **Crop (Fill)**, and **Blur Fill**, plus **Square**, **Rounded**, and **Circle** corner masks. |
| **Audio Enhancement** | Volume gain (`50%`–`250%`), **Auto-Normalize** with soft-clipping protection, **Anti-Click Edge Fade**, and adaptive Opus bitrate up to `64 kbps`. |
| **Smart Quality Presets & Matrix** | 1-click **Create Sticker (Auto)** plus clean quality preset cards (*Best Quality*, *Sharpest*, *Smoothest*, *Balanced*, *Compact*) and an optional collapsible **Custom Matrix** to fine-tune resolution × FPS within WhatsApp's 1 MB ceiling. |
| **WhatsApp-Style Preview & Send** | Clickable bubble preview for synced animation + audio playback, real-time 1 MB size meters, active chat indicator, direct send / native Forward integration, and `.webp` + `.ogg` export. |
| **Privacy-First Diagnostics** | Built-in local activity & error viewer (`logs.html`) with live search, filtering, and automatic phone-number / group-ID masking. |

---

## Installation

Works on **Google Chrome**, **Microsoft Edge**, **Brave**, and other desktop Chromium browsers with WebCodecs support.

1. Download the [latest Release ZIP](https://github.com/Insider4444/4x4Tools-Wa-Audio-Stickers/releases/latest) (or clone this repository):
   ```bash
   git clone https://github.com/Insider4444/4x4Tools-Wa-Audio-Stickers.git
   ```
2. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `4x4Tools-Wa-Audio-Stickers` folder (the folder containing `manifest.json`).
5. Pin **4x4Tools-Wa-Audio-Stickers** to your toolbar and open [web.whatsapp.com](https://web.whatsapp.com).

> If WhatsApp Web was already open before installing or reloading the extension, refresh the tab (`F5`).

---

## Quick Usage

1. Open [web.whatsapp.com](https://web.whatsapp.com) and click the **4×4** extension icon in your browser toolbar.
2. Pick a mode (**Video + Sound**, **Image + Audio**, or **Video / GIF + Audio**) and drop, browse, or paste your media.
3. Trim your clip using the waveform timeline and adjust Framing, Corners, or Audio enhancements if desired.
4. Click **Create Sticker (Auto)** — or click **Analyze Quality Options** to pick a preset card or exact resolution × FPS.
5. Click the preview sticker to verify synced audio + animation, set optional Pack Name / Author / Emoji, and click **Send Sticker** (or download `.webp` + `.ogg`).

---

## How It's Made & Technical Architecture

WhatsApp audio stickers consist of **two linked payloads** inside one sticker message:
1. A **WebP sticker** (`image/webp`, animated or static, ≤ 1 MB) carrying a big-endian TIFF EXIF block with WhatsApp's tag `0x5741` (`"WA"`), storing UTF-8 JSON metadata (`sticker-pack-id`, `sticker-pack-name`, `sticker-pack-publisher`, `emojis`, and `sound-sha256` — the base64 SHA-256 digest of the unencrypted audio).
2. An **Ogg/Opus audio file** (`audio/ogg; codecs=opus`, mono 48 kHz, ≤ 1 MB) encrypted and uploaded separately as WhatsApp audio media and attached via `stickerAudio`.

### Processing Pipeline (`100% Client-Side`)

```text
Input Media (MP4/MOV/WebM/MKV/GIF/WebP/APNG/Image/MP3/WAV/OGG)
  ├── Visual Pipeline (src/convert.js)
  │     ├─ <video> mid-interval frame seeking (+ requestVideoFrameCallback fallback)
  │     ├─ WebCodecs ImageDecoder for animated GIF / WebP / APNG
  │     ├─ OffscreenCanvas framing (Fit / Crop / Blur) + corner clipping
  │     ├─ 32×32 perceptual near-duplicate frame merging
  │     ├─ Sample-based size estimator across resolution × FPS matrix
  │     └─ Custom RIFF/WEBP muxer (VP8X + ANIM + ANMF ≥10ms + EXIF 0x5741)
  │
  ├── Audio Pipeline (src/convert.js)
  │     ├─ WebAudio OfflineAudioContext mono 48 kHz extraction
  │     ├─ Silent MediaElementSource + MediaRecorder fallback for exotic video containers
  │     ├─ Auto-normalize, gain boost with tanh soft-limiter, and 8ms anti-click edge fade
  │     ├─ WebCodecs AudioEncoder (Opus, auto-capped bitrate to stay ≤ 1 MB)
  │     └─ Custom RFC 3533 Ogg + RFC 7845 OpusHead/OpusTags packager + decode verification
  │
  └── WhatsApp Web Bridge (src/wa.js + src/bridge.js + background.js)
        ├─ Isolated-world content script (bridge.js) ↔ chrome.storage.local & MV3 service worker
        ├─ MAIN-world UI mounted in Shadow DOM with zero innerHTML (strict Trusted Types safe)
        ├─ Local sound sticker feature flag activation for creation, consumption & playback
        └─ Internal media encryption/upload + MediaPrep sticker dispatch + native Forward modal
```

### WhatsApp Format Limits

| Constraint | Limit | Handling |
| --- | --- | --- |
| Sticker WebP size | **1 MB** (`1,000,000 B`) | Sample estimation + adaptive WebP quality stepping + frame deduplication |
| Audio Ogg/Opus size | **1 MB** (`1,000,000 B`) | Automatic bitrate scaling (`48 kbps` → `12 kbps`, up to ~10 min) + overflow re-encode |
| Resolution | **64 – 512 px** | Standard `512×512` max canvas with auto-recommended presets |
| Frame timing | **≥ 8 ms / frame** | Enforced `≥ 10 ms` per ANMF frame (up to `30 fps`) |

### Project Structure

```text
4x4Tools-Wa-Audio-Stickers/
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── background.js       # MV3 service worker (toolbar toggle & session-persisted tab open)
├── logs.html           # Standalone diagnostic log viewer page (extension options)
├── logs.js             # Log filtering, search, copy, and JSON export logic
├── icons/              # 4x4Tools branded SVG & PNG icons (16, 32, 48, 128 px)
└── src/
    ├── bridge.js       # Isolated-world message & storage persistence bridge
    ├── logger.js       # Event logger, phone/group ID masking, and connection state bus
    ├── convert.js      # Media probing, WebP muxer, WebAudio/Opus encoder & Ogg packager
    ├── wa.js           # WhatsApp Web module loader, audio upload, send & Forward helpers
    ├── ui.js           # Shadow DOM studio UI (Trusted Types safe, dark/light themes)
    └── main.js         # Page bootstrapper and WhatsApp Web readiness monitor
```

---

## Privacy

- All video, image, and audio decoding/encoding runs entirely locally inside your browser.
- Diagnostic logs stay in local `chrome.storage.local` with phone numbers and group IDs automatically masked (`…XXX`), and can be viewed or cleared anytime from **Diagnostics & Activity Log** or extension **Options**.
