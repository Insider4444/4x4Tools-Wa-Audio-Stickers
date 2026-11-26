// 4x4Tools-Wa-Audio-Stickers — Studio UI (Shadow DOM, 100% Trusted Types Safe)
// Zero innerHTML usage anywhere: all HTML and SVG nodes are built with createElement / createElementNS.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  const log = (lvl, ev, data) => (WAAS.log ? WAAS.log(lvl, ev, data) : console.debug(ev, data));

  const FRAME = 1 / 30;
  const MIN_LEN = 0.3;
  const DEFAULT_LEN = 10;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const CSS = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }

  .overlay {
    position: fixed; inset: 0; z-index: 2147483001;
    background: rgba(8, 15, 20, 0.58);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: fadeIn 0.14s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px) scale(0.99); } to { opacity: 1; transform: none; } }

  .panel {
    --bg: #ffffff;
    --surface: #f5f7f9;
    --surface-2: #edf1f4;
    --fg: #111b21;
    --muted: #667781;
    --line: #dce3e8;
    --accent: #00a884;
    --accent-hover: #008f70;
    --accent-soft: rgba(0, 168, 132, 0.13);
    --accent-fg: #ffffff;
    --ok: #1ea855;
    --ok-bg: rgba(37, 211, 102, 0.16);
    --warn: #c77c02;
    --warn-bg: rgba(240, 180, 0, 0.18);
    --err: #d93025;
    --err-bg: rgba(217, 48, 37, 0.11);
    --bubble: #d9fdd3;
    --bubble-bg: #efeae2;
    --shadow: 0 20px 60px rgba(0, 0, 0, 0.36);

    width: min(760px, 100%);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: var(--shadow);
    font-size: 13.5px;
    line-height: 1.4;
    overflow: hidden;
    animation: slideUp 0.16s ease-out;
  }

  .panel.dark {
    --bg: #111b21;
    --surface: #18252c;
    --surface-2: #202c33;
    --fg: #e9edef;
    --muted: #8696a0;
    --line: #2a3942;
    --accent: #00a884;
    --accent-hover: #06cf9c;
    --accent-soft: rgba(0, 168, 132, 0.2);
    --ok: #25d366;
    --ok-bg: rgba(37, 211, 102, 0.2);
    --warn: #f5b938;
    --warn-bg: rgba(245, 185, 56, 0.18);
    --err: #f87171;
    --err-bg: rgba(248, 113, 113, 0.15);
    --bubble: #005c4b;
    --bubble-bg: #0b141a;
    --shadow: 0 24px 64px rgba(0, 0, 0, 0.62);
  }

  /* Header */
  .hdr {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 18px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
    flex: none;
  }
  .brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .brand-logo {
    width: 36px; height: 36px; border-radius: 10px; flex: none;
    background: linear-gradient(135deg, #00d4a0, #007a62);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 10px rgba(0, 168, 132, 0.3);
  }
  .brand-text { min-width: 0; }
  .brand-title { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  h2 { margin: 0; font-size: 16.5px; font-weight: 750; letter-spacing: -0.015em; }
  .ver {
    font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
    background: var(--accent-soft); color: var(--accent);
  }
  .subline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; font-size: 11.5px; color: var(--muted); }
  .conn {
    display: inline-flex; align-items: center; gap: 5px; font-weight: 600;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); display: inline-block; }
  .conn.ready .dot { background: var(--ok); box-shadow: 0 0 0 3px var(--ok-bg); }
  .conn.ready { color: var(--ok); }
  .conn.loading .dot { background: var(--warn); }
  .conn.loading { color: var(--warn); }
  .conn.error .dot { background: var(--err); }
  .conn.error { color: var(--err); }

  .hdr-actions { display: flex; align-items: center; gap: 6px; flex: none; }
  .icon-btn {
    width: 32px; height: 32px; border-radius: 9px;
    border: 1px solid var(--line); background: var(--surface); color: var(--fg);
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.12s, border-color 0.12s, transform 0.1s;
    padding: 0;
  }
  .icon-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
  .icon-btn.close-btn { border: none; background: transparent; color: var(--muted); font-size: 20px; }
  .icon-btn.close-btn:hover { color: var(--fg); background: var(--surface-2); }

  /* Tabs */
  .tabs-wrap {
    padding: 10px 18px 0;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    flex: none;
  }
  .tabs {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
    background: var(--surface); padding: 4px; border-radius: 11px; margin-bottom: 10px;
    border: 1px solid var(--line);
  }
  .tabs button {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: none; background: transparent; color: var(--muted);
    padding: 7px 10px; border-radius: 8px; font-size: 13px; font-weight: 650;
    cursor: pointer; transition: background 0.14s, color 0.14s, box-shadow 0.14s;
  }
  .tabs button:hover:not(:disabled) { color: var(--fg); }
  .tabs button.on {
    background: var(--bg); color: var(--fg);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  .tabs button.on svg { color: var(--accent); }

  /* Toast */
  .toast {
    margin: 10px 18px 0; padding: 8px 12px; border-radius: 9px;
    background: var(--accent-soft); border: 1px solid var(--accent);
    color: var(--fg); font-size: 12.5px; font-weight: 600;
    display: none; align-items: center; justify-content: space-between; gap: 8px;
  }
  .toast.show { display: flex; }

  /* Scrollable content */
  .content {
    flex: 1; overflow-y: auto; padding: 12px 18px 16px;
    scrollbar-width: thin; scrollbar-color: var(--line) transparent;
  }
  .content::-webkit-scrollbar { width: 8px; }
  .content::-webkit-scrollbar-thumb { background: var(--line); border-radius: 99px; }

  .tabdesc { color: var(--muted); font-size: 12.5px; margin: 0 2px 10px; }

  /* Sections */
  section {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 13px;
    padding: 13px 15px;
    margin-bottom: 11px;
    transition: opacity 0.15s, border-color 0.15s;
  }
  section.off { opacity: 0.48; pointer-events: none; }
  section.done { border-color: rgba(0, 168, 132, 0.35); }
  h3 {
    margin: 0 0 10px; font-size: 13.5px; font-weight: 700;
    display: flex; align-items: center; gap: 8px;
  }
  h3 .n {
    display: inline-flex; width: 22px; height: 22px; border-radius: 50%;
    background: var(--surface-2); border: 1px solid var(--line); color: var(--muted);
    align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; flex: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  section:not(.off) h3 .n { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
  section.done h3 .n { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }

  /* Controls & Layout */
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 7px 0; }
  .row.tight { margin: 4px 0; gap: 6px; }
  .grow { flex: 1; }
  .muted { color: var(--muted); font-size: 12px; }
  .tabular { font-variant-numeric: tabular-nums; }

  button { font: inherit; cursor: pointer; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  .act {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 16px; border-radius: 10px; border: none;
    background: var(--accent); color: var(--accent-fg);
    font-weight: 650; font-size: 13px;
    transition: background 0.12s, transform 0.08s;
  }
  .act:hover:not(:disabled) { background: var(--accent-hover); }
  .act:active:not(:disabled) { transform: scale(0.98); }
  .sec {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    padding: 5px 11px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--bg); color: var(--fg);
    font-size: 12.5px; font-weight: 600;
    transition: border-color 0.12s, background 0.12s;
  }
  .sec:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); }
  .sec.on { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  .sec.sm { padding: 4px 8px; font-size: 11.5px; }
  .sec.icon { width: 28px; height: 28px; padding: 0; }

  input[type=text], input[type=number], select {
    padding: 6px 9px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--bg); color: var(--fg);
    font: inherit; font-size: 13px;
  }
  input[type=text]:focus, input[type=number]:focus, select:focus {
    outline: 2px solid var(--accent); outline-offset: -1px;
  }
  input[type=number] { width: 78px; font-variant-numeric: tabular-nums; }
  input[type=range] { accent-color: var(--accent); cursor: pointer; }

  /* Dropzone */
  .dropzone {
    border: 1.5px dashed var(--line);
    border-radius: 11px;
    background: var(--bg);
    padding: 16px 14px;
    display: flex; align-items: center; gap: 13px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .dropzone:hover, .dropzone.dragover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .drop-ico {
    width: 40px; height: 40px; border-radius: 10px; flex: none;
    background: var(--accent-soft); color: var(--accent);
    display: flex; align-items: center; justify-content: center;
  }
  .drop-title { font-weight: 650; font-size: 13.5px; }
  .drop-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }

  .file-card {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
    padding: 9px 12px;
  }
  .file-card.dragover { border-color: var(--accent); background: var(--accent-soft); }
  .file-name { font-weight: 650; font-size: 13px; word-break: break-all; }
  .file-meta { font-size: 12px; color: var(--muted); }

  /* Inline Alert Banner */
  .banner {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    padding: 9px 12px; border-radius: 9px; margin-top: 8px;
    background: var(--warn-bg); border: 1px solid rgba(210, 154, 0, 0.45);
    font-size: 12.5px; color: var(--fg);
  }
  .banner.err { background: var(--err-bg); border-color: var(--err); color: var(--err); }

  /* Video Stage & Live Framing Preview */
  .stage-wrap {
    position: relative;
    background: #090d10;
    border-radius: 10px;
    overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    min-height: 180px;
    border: 1px solid var(--line);
  }
  .stage-wrap video {
    display: block; max-width: 100%; max-height: 250px; width: 100%;
    object-fit: contain;
    transition: border-radius 0.15s;
  }
  .stage-wrap.sq {
    padding: 12px;
    background: repeating-conic-gradient(rgba(130, 145, 155, 0.16) 0 25%, rgba(130, 145, 155, 0.05) 0 50%) 50% / 16px 16px;
  }
  .stage-sq-box {
    position: relative; width: 210px; height: 210px; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    border: 1px dashed rgba(0, 168, 132, 0.6);
    background: transparent;
    transition: border-radius 0.15s;
  }
  .stage-sq-box.rounded { border-radius: 14%; }
  .stage-sq-box.circle { border-radius: 50%; }
  .stage-sq-box video {
    width: 100%; height: 100%; max-height: 210px;
    object-fit: contain;
  }
  .stage-sq-box.crop video { object-fit: cover; }
  .stage-sq-box.blur-mode { background: rgba(0, 0, 0, 0.35); }
  .stage-badge {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    background: rgba(15, 23, 28, 0.78); color: #fff; border: 1px solid rgba(255, 255, 255, 0.18);
    cursor: pointer;
  }
  .stage-badge:hover { background: var(--accent); border-color: var(--accent); }

  /* Preview Thumbnails */
  .thumb-stage {
    width: 148px; height: 148px; flex: none;
    border-radius: 12px;
    background: repeating-conic-gradient(rgba(130, 145, 155, 0.22) 0 25%, rgba(130, 145, 155, 0.07) 0 50%) 50% / 16px 16px;
    border: 1px solid var(--line);
    overflow: hidden; display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .thumb-stage.rounded img { border-radius: 14%; }
  .thumb-stage.circle img { border-radius: 50%; }
  .thumb-stage img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .thumb-stage.crop img { object-fit: cover; }

  /* Timeline Trimmer */
  .track {
    position: relative; height: 48px; margin: 12px 6px 5px;
    background: var(--surface-2); border: 1px solid var(--line);
    border-radius: 8px; cursor: pointer; touch-action: none; user-select: none;
  }
  .track canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; border-radius: 7px; }
  .track .dim-l, .track .dim-r {
    position: absolute; top: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.28); pointer-events: none;
  }
  .track .dim-l { left: 0; border-radius: 7px 0 0 7px; }
  .track .dim-r { right: 0; border-radius: 0 7px 7px 0; }
  .track .sel {
    position: absolute; top: 0; bottom: 0;
    background: rgba(0, 168, 132, 0.22);
    border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
    cursor: grab;
  }
  .track .sel:active { cursor: grabbing; }
  .track .handle {
    position: absolute; top: -4px; bottom: -4px; width: 14px; margin-left: -7px;
    background: var(--accent); border-radius: 5px; cursor: ew-resize;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25); z-index: 3;
  }
  .track .handle::after {
    content: ""; position: absolute; left: 4px; top: 14px; bottom: 14px; width: 4px;
    border-left: 1.5px solid rgba(255, 255, 255, 0.85);
    border-right: 1.5px solid rgba(255, 255, 255, 0.85);
  }
  .track .ph {
    position: absolute; top: -6px; bottom: -6px; width: 2px; margin-left: -1px;
    background: var(--fg); pointer-events: none; z-index: 4;
  }
  .track .ph::before {
    content: ""; position: absolute; top: -2px; left: -4px;
    width: 10px; height: 6px; border-radius: 2px; background: var(--fg);
  }
  .track .tip {
    position: absolute; top: -26px; transform: translateX(-50%);
    padding: 2px 6px; border-radius: 5px; font-size: 11px; font-weight: 600;
    background: var(--fg); color: var(--bg); pointer-events: none;
    display: none; white-space: nowrap; z-index: 5; font-variant-numeric: tabular-nums;
  }
  .times { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin: 0 6px; font-variant-numeric: tabular-nums; }

  .trim-grid {
    display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 8px;
    margin-top: 8px;
  }
  .trim-box {
    display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
    background: var(--bg); border: 1px solid var(--line); border-radius: 9px; padding: 6px 9px;
  }
  .trim-lbl { font-size: 11.5px; font-weight: 700; color: var(--muted); min-width: 34px; }

  .presets { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .chip {
    padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
    border: 1px solid var(--line); background: var(--bg); color: var(--muted);
    cursor: pointer; transition: all 0.12s;
  }
  .chip:hover:not(:disabled) { border-color: var(--accent); color: var(--fg); }
  .chip.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

  /* Segmented controls */
  .seg {
    display: inline-flex; width: fit-content; justify-self: start;
    border: 1px solid var(--line); border-radius: 9px; overflow: hidden;
    background: var(--bg);
  }
  .seg button {
    border: none; padding: 5px 11px; background: transparent; color: var(--muted);
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button:hover:not(:disabled) { color: var(--fg); }
  .seg button.on { background: var(--accent); color: var(--accent-fg); }

  .opt-grid {
    display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: center;
  }
  .opt-lbl { font-size: 12.5px; font-weight: 600; color: var(--muted); }

  .audio-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: var(--bg); border: 1px solid var(--line); border-radius: 9px;
    padding: 7px 11px; margin-top: 8px;
  }
  .summary-box {
    background: var(--bg); border: 1px solid var(--line); border-radius: 9px;
    padding: 8px 11px; margin-bottom: 8px; font-size: 12.5px;
  }

  /* Quality Presets & Neat Custom Matrix */
  .q-wrap { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .q-presets {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 7px;
  }
  .q-card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
    padding: 9px 11px; border-radius: 10px; text-align: left;
    border: 1.5px solid var(--line); background: var(--bg); color: var(--fg);
    cursor: pointer; transition: border-color 0.12s, background 0.12s, transform 0.08s;
  }
  .q-card:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-1px); }
  .q-card.sel {
    border-color: var(--accent); background: var(--accent-soft);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .q-card-top { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .q-name { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.02em; }
  .q-card.sel .q-name { color: var(--accent); }
  .q-badge {
    font-size: 10px; font-weight: 750; padding: 1px 6px; border-radius: 999px;
    background: var(--ok-bg); color: var(--ok);
  }
  .q-badge.low { background: var(--warn-bg); color: var(--warn); }
  .q-spec { font-size: 13.5px; font-weight: 750; font-variant-numeric: tabular-nums; }
  .q-size { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }

  .q-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
    background: var(--bg); border: 1px solid var(--line); border-radius: 9px;
    padding: 7px 10px; font-size: 12.5px;
  }
  .q-bar-info { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-weight: 650; font-variant-numeric: tabular-nums; }
  .q-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); flex: none; }
  .q-dot.low { background: var(--warn); }
  .q-dot.no { background: var(--err); }

  .q-matrix-card {
    background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
    padding: 10px 12px; overflow-x: auto;
  }
  table.grid { width: 100%; border-collapse: separate; border-spacing: 4px; font-size: 11.5px; font-variant-numeric: tabular-nums; }
  table.grid th { color: var(--muted); font-weight: 650; padding: 2px 4px 5px; text-align: center; font-size: 11px; }
  table.grid th.side { text-align: right; padding-right: 8px; white-space: nowrap; }
  table.grid td { text-align: center; }
  table.grid td button {
    width: 100%; min-width: 52px; padding: 5px 4px; border-radius: 7px; border: 1.5px solid transparent;
    font-size: 11.5px; font-weight: 650; background: transparent; color: var(--muted);
    transition: transform 0.08s, border-color 0.1s, background 0.1s;
  }
  table.grid td button.ok { background: var(--ok-bg); color: var(--fg); }
  table.grid td button.low { background: var(--warn-bg); color: var(--fg); }
  table.grid td button.no, table.grid td button.out { cursor: default; opacity: 0.35; }
  table.grid td button:not(:disabled):hover { transform: scale(1.04); border-color: var(--accent); }
  table.grid td button.sel { border-color: var(--accent); background: var(--accent); color: var(--accent-fg); font-weight: 750; }

  .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: var(--muted); margin-top: 7px; padding-top: 7px; border-top: 1px solid var(--line); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; }
  .stale { color: var(--warn); font-size: 12px; font-weight: 650; margin-top: 4px; }
  .brand-tag {
    display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 6px;
    background: linear-gradient(135deg, #00c896, #008568); color: #fff;
    font-size: 12px; font-weight: 800; letter-spacing: 0.02em;
  }

  /* Progress Bar */
  .bar { height: 7px; background: var(--surface-2); border-radius: 99px; overflow: hidden; margin-top: 8px; }
  .bar > div { height: 100%; width: 0; background: linear-gradient(90deg, #00a884, #25d366); transition: width 0.18s; border-radius: 99px; }
  .status { font-size: 12.5px; margin-top: 6px; min-height: 18px; color: var(--muted); font-weight: 500; }
  .status.ok { color: var(--ok); font-weight: 650; }
  .status.err { color: var(--err); font-weight: 650; }

  /* Metadata Grid */
  .meta-grid {
    display: grid; grid-template-columns: 1fr 1fr 110px; gap: 8px; margin: 4px 0 10px;
  }
  .field label { display: block; font-size: 11.5px; font-weight: 650; color: var(--muted); margin-bottom: 3px; }
  .field input { width: 100%; }

  /* WhatsApp Chat Bubble Preview */
  .preview-card {
    display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap;
    margin-top: 10px; padding: 12px;
    background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
  }
  .wa-stage {
    width: 172px; min-height: 172px; flex: none;
    border-radius: 12px; padding: 10px;
    background: var(--bubble-bg);
    border: 1px solid var(--line);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    position: relative; cursor: pointer;
  }
  .wa-stage:hover .wa-play-hint { opacity: 1; }
  .wa-sticker {
    width: 144px; height: 144px; object-fit: contain; display: block;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.18));
  }
  .wa-sound-badge {
    position: absolute; right: 10px; bottom: 10px;
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(17, 27, 33, 0.78); color: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: background 0.15s, transform 0.15s;
  }
  .wa-stage.playing .wa-sound-badge {
    background: var(--accent);
    transform: scale(1.1);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  .wa-play-hint {
    position: absolute; top: 8px; left: 8px;
    padding: 2px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 700;
    background: rgba(17, 27, 33, 0.72); color: #fff; opacity: 0.82; transition: opacity 0.12s;
  }
  .preview-meta { flex: 1; min-width: 220px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; }
  .preview-meta audio { width: 100%; height: 36px; }
  .meters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .meter { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 6px 9px; }
  .meter-top { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 650; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
  .meter-bar { height: 5px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
  .meter-fill { height: 100%; background: var(--ok); border-radius: 99px; }
  .meter-fill.warn { background: var(--warn); }

  /* Send Box */
  .send-box {
    margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line);
    display: flex; flex-direction: column; gap: 8px;
  }
  .chat-pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted); font-weight: 600;
  }
  .chat-pill strong { color: var(--fg); }

  /* Details / Advanced / Diagnostics */
  details { margin-top: 8px; }
  summary {
    cursor: pointer; color: var(--muted); font-size: 12.5px; font-weight: 650;
    user-select: none; list-style: none; display: inline-flex; align-items: center; gap: 5px;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "▸"; font-size: 11px; transition: transform 0.14s; }
  details[open] > summary::before { transform: rotate(90deg); }
  label.chk { display: flex; gap: 8px; align-items: flex-start; margin: 7px 0; cursor: pointer; font-size: 12.5px; }
  .logbox {
    max-height: 150px; overflow: auto;
    font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
    background: var(--bg); border: 1px solid var(--line);
    padding: 7px 9px; border-radius: 8px; white-space: pre-wrap; margin-top: 7px;
  }
  .logbox .e { color: var(--err); }
  .logbox .w { color: var(--warn); }

  .kbd-hint {
    font-size: 11px; color: var(--muted); margin-top: 6px;
    display: flex; gap: 10px; flex-wrap: wrap;
  }
  kbd {
    padding: 1px 5px; border-radius: 4px; border: 1px solid var(--line);
    background: var(--bg); font-family: ui-monospace, Consolas, monospace; font-size: 10.5px;
  }

  @media (max-width: 600px) {
    .meta-grid { grid-template-columns: 1fr; }
    .trim-grid { grid-template-columns: 1fr; }
    .meters { grid-template-columns: 1fr; }
    .tabs { grid-template-columns: 1fr; }
  }
  `;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }

  function svgEl(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    for (const c of children.flat()) if (c) el.append(c);
    return el;
  }

  const ICONS = {
    logo: () =>
      svgEl(
        "svg",
        { width: 28, height: 28, viewBox: "0 0 32 32", fill: "none" },
        svgEl("path", {
          d: "M5 3h18a4 4 0 0 1 4 4v14l-7 7H7a4 4 0 0 1-4-4V7a4 4 0 0 1 2-4Z",
          fill: "#ffffff",
        }),
        svgEl("path", { d: "M27 21l-7 7v-4.5A2.5 2.5 0 0 1 22.5 21H27Z", fill: "#9eeed8" }),
        // Bold geometric 4 x 4
        svgEl("path", { d: "M9.5 7.5 6.2 13.5h5.6M10.4 7.5v8.2", stroke: "#006a56", "stroke-width": 2.1, "stroke-linecap": "round", "stroke-linejoin": "round" }),
        svgEl("path", { d: "M14.3 10.6 17.7 14m0-3.4-3.4 3.4", stroke: "#00a884", "stroke-width": 1.9, "stroke-linecap": "round" }),
        svgEl("path", { d: "M23.5 7.5 20.2 13.5h5.6M24.4 7.5v8.2", stroke: "#006a56", "stroke-width": 2.1, "stroke-linecap": "round", "stroke-linejoin": "round" }),
        // Equalizer bars
        svgEl("rect", { x: 6.5, y: 20.5, width: 2.2, height: 3.5, rx: 1.1, fill: "#00c896" }),
        svgEl("rect", { x: 10, y: 18.5, width: 2.2, height: 6.5, rx: 1.1, fill: "#009c78" }),
        svgEl("rect", { x: 13.5, y: 19.5, width: 2.2, height: 5, rx: 1.1, fill: "#00c896" }),
        svgEl("rect", { x: 17, y: 17.8, width: 2.2, height: 7.5, rx: 1.1, fill: "#006a56" })
      ),
    video: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("rect", { x: 2, y: 5, width: 14, height: 14, rx: 2.5 }),
        svgEl("path", { d: "m16 10 6-3v10l-6-3" })
      ),
    image: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2.5 }),
        svgEl("circle", { cx: 8.5, cy: 8.5, r: 1.5 }),
        svgEl("path", { d: "m21 15-5-5L5 21" })
      ),
    mix: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("path", { d: "M9 18V5l12-2v13" }),
        svgEl("circle", { cx: 6, cy: 18, r: 3 }),
        svgEl("circle", { cx: 18, cy: 16, r: 3 })
      ),
    upload: (sz = 20) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("path", { d: "M12 16V4m0 0-4 4m4-4 4 4" }),
        svgEl("path", { d: "M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" })
      ),
    volume: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("path", { d: "M11 5 6 9H2v6h4l5 4V5Z" }),
        svgEl("path", { d: "M15.5 8.5a5 5 0 0 1 0 7" }),
        svgEl("path", { d: "M19 5a9.5 9.5 0 0 1 0 14" })
      ),
    theme: (sz = 16) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("circle", { cx: 12, cy: 12, r: 4 }),
        svgEl("path", { d: "M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" })
      ),
    send: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("path", { d: "m22 2-7 20-4-9-9-4Z" }),
        svgEl("path", { d: "M22 2 11 13" })
      ),
    download: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("path", { d: "M12 4v12m0 0-4-4m4 4 4-4" }),
        svgEl("path", { d: "M4 18h16" })
      ),
    spark: (sz = 15) =>
      svgEl(
        "svg",
        { width: sz, height: sz, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        svgEl("path", { d: "m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z" })
      ),
  };

  function attachStyles(root) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      log("warn", "ui:style-fallback", e);
      root.append(h("style", { textContent: CSS }));
    }
  }

  function download(blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  }

  async function saveLog() {
    const stored = await WAAS.getStoredLog();
    const entries = stored && stored.length ? stored : WAAS.entries;
    const content = JSON.stringify(
      {
        extension: WAAS.NAME,
        version: WAAS.VERSION,
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        entries,
      },
      null,
      2
    );
    const blob = new Blob([content], { type: "application/json" });
    const name =
      "4x4tools-wa-audio-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "JSON Diagnostic Log", accept: { "application/json": [".json"] } }],
        });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        log("info", "log:saved", { name: handle.name, entries: entries.length });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
        log("warn", "log:save-picker-fallback", e);
      }
    }
    download(blob, name);
    log("info", "log:downloaded", { name, entries: entries.length });
  }
  WAAS.saveLog = saveLog;

  const fmtT = (t) => {
    t = Math.max(0, Number(t) || 0);
    return t >= 60 ? Math.floor(t / 60) + ":" + (t % 60).toFixed(2).padStart(5, "0") : t.toFixed(2) + " s";
  };
  const fmtB = (b) => (b >= 1e6 ? (b / 1e6).toFixed(2) + " MB" : Math.round(b / 1000) + " KB");

  const store = {
    get(k, def) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        // Ignore storage errors
      }
    },
  };

  const detectDark = () => {
    try {
      return (
        document.body.classList.contains("dark") ||
        document.documentElement.classList.contains("dark") ||
        matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (e) {
      return false;
    }
  };

  const baseName = (f) => (f && f.name.replace(/\.[^.]+$/, "")) || "audio-sticker";

  // Shared WebAudio playback context — ensures instant, seek-accurate audio playback even when
  // HTMLAudio elements are restricted or glitchy inside shadow DOM / WhatsApp Web.
  let sharedAudioCtx = null;
  function getAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new Ctx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }

  function mount() {
    if (document.getElementById("waas-root")) return;

    const host = h("div", { id: "waas-root" });
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    attachStyles(root);

    // Shared UI state across all tabs.
    const G = {
      busy: false,
      abort: null,
      forms: [],
      active: 0,
      refreshTabs: () => {},
      toastTimer: null,
      showToast: () => {},
      switchToTab: () => {},
      routeFile: () => {},
    };

    const setBusy = (b) => {
      G.busy = b;
      G.forms.forEach((f) => f.refresh());
      G.refreshTabs();
    };

    const run = async (name, fn) => {
      const ac = new AbortController();
      G.abort = ac;
      setBusy(true);
      try {
        return await WAAS.run(name, () => fn(ac.signal));
      } finally {
        G.abort = null;
        setBusy(false);
      }
    };

    // ============================================================ Dropzone / File Picker
    function makeDropPicker({ title, subtitle, accept, icon = "upload", onFile, onClear }) {
      const input = h("input", { type: "file", accept, style: "display:none" });
      const drop = h(
        "div",
        { class: "dropzone", role: "button", tabIndex: 0 },
        h("div", { class: "drop-ico" }, ICONS[icon](20)),
        h("div", { class: "grow" }, h("div", { class: "drop-title" }, title), h("div", { class: "drop-sub" }, subtitle))
      );

      const fileName = h("div", { class: "file-name" });
      const fileMeta = h("div", { class: "file-meta" });
      const replaceBtn = h("button", { class: "sec sm", textContent: "Replace", onclick: () => input.click() });
      const clearBtn = h("button", {
        class: "sec sm",
        textContent: "Clear",
        onclick: () => {
          api.setEmpty();
          if (onClear) onClear();
        },
      });
      const card = h(
        "div",
        { class: "file-card", style: "display:none" },
        h("div", { class: "drop-ico", style: "width:34px;height:34px" }, ICONS[icon](17)),
        h("div", { class: "grow", style: "min-width:140px" }, fileName, fileMeta),
        h("div", { class: "row tight", style: "margin:0" }, replaceBtn, clearBtn)
      );

      const triggerPick = (f) => {
        if (!f || G.busy) return;
        onFile(f);
      };

      drop.addEventListener("click", () => {
        if (!G.busy) input.click();
      });
      drop.addEventListener("keydown", (ev) => {
        if ((ev.key === "Enter" || ev.key === " ") && !G.busy) {
          ev.preventDefault();
          input.click();
        }
      });

      const wireDrag = (el) => {
        el.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          if (!G.busy) el.classList.add("dragover");
        });
        el.addEventListener("dragleave", () => el.classList.remove("dragover"));
        el.addEventListener("drop", (ev) => {
          ev.preventDefault();
          el.classList.remove("dragover");
          const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
          if (f) triggerPick(f);
        });
      };
      wireDrag(drop);
      wireDrag(card);

      input.addEventListener("change", () => {
        const f = input.files && input.files[0];
        input.value = "";
        if (f) triggerPick(f);
      });

      const el = h("div", null, drop, card, input);
      const api = {
        el,
        setLoading(name) {
          drop.style.display = "none";
          card.style.display = "";
          fileName.textContent = name;
          fileMeta.textContent = "Reading file…";
        },
        setLoaded(name, metaText) {
          drop.style.display = "none";
          card.style.display = "";
          fileName.textContent = name;
          fileMeta.textContent = metaText;
        },
        setError(msg) {
          drop.style.display = "";
          card.style.display = "none";
          drop.querySelector(".drop-sub").textContent = msg;
        },
        setEmpty() {
          drop.style.display = "";
          card.style.display = "none";
          drop.querySelector(".drop-sub").textContent = subtitle;
        },
        setDisabled(d) {
          replaceBtn.disabled = clearBtn.disabled = d;
        },
      };
      return api;
    }

    // ============================================================ Pro Media Trimmer
    function makeTrimmer(kind, hint) {
      const isVideo = kind === "video";
      const media = isVideo ? h("video", { playsInline: true, preload: "auto" }) : h("audio", { preload: "auto" });
      const wave = h("canvas");
      const dimL = h("div", { class: "dim-l" });
      const dimR = h("div", { class: "dim-r" });
      const selBar = h("div", { class: "sel", title: "Drag to slide selection window" });
      const hS = h("div", { class: "handle", title: "Drag to adjust start time" });
      const hE = h("div", { class: "handle", title: "Drag to adjust end time" });
      const ph = h("div", { class: "ph" });
      const tip = h("div", { class: "tip" });
      const track = h(
        "div",
        { class: "track", title: "Click or drag to scrub; drag handles to trim; drag middle to slide" },
        wave,
        dimL,
        dimR,
        selBar,
        ph,
        hS,
        hE,
        tip
      );

      let stageWrap = null;
      let sqBox = null;
      let previewToggle = null;
      let previewSquare = false;
      let frameMode = "fit";
      let frameCorner = "square";

      const updateStageStyle = () => {
        if (!stageWrap || !sqBox) return;
        stageWrap.classList.toggle("sq", previewSquare);
        sqBox.className =
          "stage-sq-box" +
          (previewSquare ? (frameMode === "crop" ? " crop" : frameMode === "blur" ? " blur-mode" : "") : "") +
          (previewSquare && frameCorner !== "square" ? " " + frameCorner : "");
        if (!previewSquare) {
          sqBox.style.width = "100%";
          sqBox.style.height = "auto";
          sqBox.style.border = "none";
        } else {
          sqBox.style.width = "210px";
          sqBox.style.height = "210px";
          sqBox.style.border = "";
        }
        if (previewToggle) {
          previewToggle.textContent = previewSquare ? "View: 1:1 Sticker Frame" : "View: Full Video";
        }
      };

      if (isVideo) {
        sqBox = h("div", { class: "stage-sq-box", style: "width:100%;height:auto;border:none" }, media);
        previewToggle = h("button", {
          class: "stage-badge",
          textContent: "View: Full Video",
          title: "Toggle between original aspect ratio and 1:1 sticker frame preview",
          onclick: () => {
            previewSquare = !previewSquare;
            updateStageStyle();
          },
        });
        stageWrap = h("div", { class: "stage-wrap" }, sqBox, previewToggle);
      }

      const tLeft = h("span"),
        tMid = h("span", { class: "tabular", style: "font-weight:650;color:var(--accent)" }),
        tRight = h("span");
      const playSegBtn = h("button", { class: "sec", textContent: "▶ Play Clip" });
      const playCurBtn = h("button", { class: "sec sm", textContent: "▶ From Cursor" });
      const playEndBtn = h("button", { class: "sec sm", textContent: "▶ Last 2s" });
      const loopBtn = h("button", { class: "sec sm", textContent: "Loop: Off", title: "Loop playback within selected range" });
      const curLbl = h("span", { class: "muted grow tabular", style: "text-align:right" });

      const startNum = h("input", { type: "number", min: 0, step: 0.01 });
      const endNum = h("input", { type: "number", min: 0, step: 0.01 });
      const startCur = h("button", { class: "sec sm", textContent: "Set In", title: "Set clip start to playhead (shortcut: I)" });
      const endCur = h("button", { class: "sec sm", textContent: "Set Out", title: "Set clip end to playhead (shortcut: O)" });

      const t = {
        start: 0,
        end: 0,
        playhead: 0,
        stopAt: null,
        dur: 0,
        offset: 0,
        url: null,
        peaks: null,
        peakMax: 1,
        muted: false,
        loop: false,
        playing: false,
      };
      const listeners = new Set();
      const emit = () => listeners.forEach((fn) => fn());

      const presetDefs = [
        { label: "Full", len: Infinity },
        { label: "3s", len: 3 },
        { label: "5s", len: 5 },
        { label: "10s", len: 10 },
        { label: "15s", len: 15 },
      ];
      const presetBtns = presetDefs.map((p) =>
        h("button", {
          class: "chip",
          textContent: p.label,
          onclick: () => {
            if (!t.dur) return;
            if (p.len === Infinity) {
              t.start = 0;
              t.end = t.dur;
              changed();
              stop();
              seekTo(0);
            } else {
              const targetEnd = Math.min(t.dur, t.start + p.len);
              if (targetEnd - t.start < p.len && t.dur >= p.len) {
                t.end = t.dur;
                t.start = Math.max(0, t.dur - p.len);
              } else {
                t.end = Math.max(t.start + MIN_LEN, targetEnd);
              }
              changed();
              stop();
              seekTo(t.start);
            }
          },
        })
      );

      const mkStep = (txt, title, fn) => h("button", { class: "sec icon", textContent: txt, title, onclick: fn });

      const el = h(
        "div",
        null,
        isVideo ? stageWrap : h("div", { style: "display:none" }, media),
        track,
        h("div", { class: "times" }, tLeft, tMid, tRight),
        h("div", { class: "row" }, playSegBtn, playCurBtn, playEndBtn, loopBtn, curLbl),
        h(
          "div",
          { class: "row tight" },
          h("span", { class: "muted", style: "font-weight:600" }, "Quick length:"),
          h("div", { class: "presets" }, presetBtns)
        ),
        h(
          "div",
          { class: "trim-grid" },
          h(
            "div",
            { class: "trim-box" },
            h("span", { class: "trim-lbl" }, "Start"),
            mkStep("−", "1 frame earlier", () => setStart(t.start - FRAME)),
            startNum,
            mkStep("+", "1 frame later", () => setStart(t.start + FRAME)),
            startCur
          ),
          h(
            "div",
            { class: "trim-box" },
            h("span", { class: "trim-lbl" }, "End"),
            mkStep("−", "1 frame earlier", () => setEnd(t.end - FRAME)),
            endNum,
            mkStep("+", "1 frame later", () => setEnd(t.end + FRAME)),
            endCur
          )
        ),
        hint ? h("div", { class: "muted", style: "margin-top:6px" }, hint) : null
      );

      const layout = () => {
        const d = t.dur || 1;
        const pctNum = (x) => Math.max(0, Math.min(100, (x / d) * 100));
        const sPct = pctNum(t.start);
        const ePct = pctNum(t.end);
        selBar.style.left = sPct + "%";
        selBar.style.width = Math.max(0, ePct - sPct) + "%";
        dimL.style.width = sPct + "%";
        dimR.style.width = Math.max(0, 100 - ePct) + "%";
        hS.style.left = sPct + "%";
        hE.style.left = ePct + "%";
        ph.style.left = pctNum(t.playhead) + "%";
        tLeft.textContent = "0.00 s";
        tMid.textContent = t.dur ? `Selected: ${fmtT(t.end - t.start)}` : "";
        tRight.textContent = fmtT(t.dur);
        curLbl.textContent = "Cursor " + fmtT(t.playhead);
        playSegBtn.textContent = t.playing ? "⏸ Pause" : "▶ Play Clip";
        loopBtn.textContent = t.loop ? "Loop: On" : "Loop: Off";
        loopBtn.classList.toggle("on", t.loop);
        if (root.activeElement !== startNum) startNum.value = t.start.toFixed(2);
        if (root.activeElement !== endNum) endNum.value = t.end.toFixed(2);
        presetBtns.forEach((btn, idx) => {
          const p = presetDefs[idx];
          btn.disabled = !t.dur || (p.len !== Infinity && t.dur < p.len - 0.05);
          const isMatch =
            t.dur > 0 &&
            (p.len === Infinity
              ? t.start < 0.02 && Math.abs(t.end - t.dur) < 0.05
              : Math.abs(t.end - t.start - p.len) < 0.05);
          btn.classList.toggle("on", isMatch);
        });
      };

      const drawWave = () => {
        const w = track.clientWidth;
        const hh = track.clientHeight;
        if (!w || !hh) return;
        const dpr = window.devicePixelRatio || 1;
        wave.width = Math.round(w * dpr);
        wave.height = Math.round(hh * dpr);
        const ctx = wave.getContext("2d");
        ctx.clearRect(0, 0, wave.width, wave.height);
        if (!t.peaks) return;
        ctx.fillStyle = getComputedStyle(track).getPropertyValue("--muted").trim() || "#667781";
        ctx.globalAlpha = 0.55;
        const n = t.peaks.length;
        const cols = wave.width;
        const mid = wave.height / 2;
        const norm = 1 / (t.peakMax || 1);
        const step = Math.max(1, Math.round(dpr * 2));
        for (let x = 0; x < cols; x += step) {
          const a = Math.floor((x / cols) * n);
          const b = Math.max(a + 1, Math.floor(((x + step) / cols) * n));
          let p = 0;
          for (let i = a; i < b && i < n; i++) if (t.peaks[i] > p) p = t.peaks[i];
          const hgt = Math.max(2, p * norm * (wave.height - 8));
          ctx.fillRect(x, mid - hgt / 2, Math.max(1, step - 1), hgt);
        }
      };
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(drawWave).observe(track);

      let seeking = false,
        pendingSeek = null;
      const seekTo = (x) => {
        x = Math.max(0, Math.min(t.dur || 0, x));
        pendingSeek = x;
        if (!seeking) doSeek();
      };
      const doSeek = () => {
        if (pendingSeek == null) return;
        const x = pendingSeek;
        pendingSeek = null;
        seeking = true;
        t.playhead = x;
        if (media.src) media.currentTime = t.offset + x;
        layout();
      };
      media.addEventListener("seeked", () => {
        seeking = false;
        if (pendingSeek != null) doSeek();
      });

      const changed = () => {
        layout();
        emit();
      };
      const setStart = (x, doS = true) => {
        if (!t.dur) return;
        t.start = Math.max(0, Math.min(x, t.end - MIN_LEN));
        changed();
        if (doS) {
          stop();
          seekTo(t.start);
        }
      };
      const setEnd = (x, doS = true) => {
        if (!t.dur) return;
        t.end = Math.min(t.dur, Math.max(x, t.start + MIN_LEN));
        changed();
        if (doS) {
          stop();
          seekTo(Math.max(t.start, t.end - FRAME));
        }
      };

      const tAt = (ev) => {
        const r = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * t.dur;
      };

      let drag = null;
      let dragSlideOffset = 0;
      let dragWinLen = 0;

      track.addEventListener("pointerdown", (ev) => {
        if (!t.dur || G.busy) return;
        if (ev.target === hS) drag = "s";
        else if (ev.target === hE) drag = "e";
        else if (ev.target === selBar) {
          drag = "win";
          dragSlideOffset = tAt(ev) - t.start;
          dragWinLen = t.end - t.start;
        } else {
          drag = "p";
        }
        track.setPointerCapture(ev.pointerId);
        stop();
        applyDrag(ev);
      });
      track.addEventListener("pointermove", (ev) => {
        if (t.dur) {
          const r = track.getBoundingClientRect();
          const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
          tip.style.display = "block";
          tip.style.left = frac * 100 + "%";
          tip.textContent = fmtT(frac * t.dur);
        }
        if (drag) applyDrag(ev);
      });
      track.addEventListener("pointerleave", () => {
        if (!drag) tip.style.display = "none";
      });
      const endDrag = () => {
        drag = null;
        tip.style.display = "none";
      };
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);

      const applyDrag = (ev) => {
        const x = tAt(ev);
        if (drag === "s") setStart(x);
        else if (drag === "e") setEnd(x);
        else if (drag === "win") {
          const newStart = Math.max(0, Math.min(t.dur - dragWinLen, x - dragSlideOffset));
          t.start = newStart;
          t.end = Math.min(t.dur, newStart + dragWinLen);
          changed();
          seekTo(t.start);
        } else {
          seekTo(x);
        }
      };

      startNum.addEventListener("change", () => setStart(+startNum.value || 0));
      endNum.addEventListener("change", () => setEnd(+endNum.value || 0));
      startCur.addEventListener("click", () => setStart(t.playhead));
      endCur.addEventListener("click", () => setEnd(t.playhead));
      loopBtn.addEventListener("click", () => {
        t.loop = !t.loop;
        layout();
      });

      let raf = 0;
      let playToken = 0;
      let playStartedMs = 0;
      let waNode = null;
      let waCtxStart = 0;
      let waOffsetStart = 0;
      let waStopAt = 0;
      let audioBuf = null;

      function stopWebAudio() {
        if (waNode) {
          try {
            waNode.onended = null;
            waNode.stop();
            waNode.disconnect();
          } catch (e) {}
          waNode = null;
        }
      }

      const tickWebAudio = () => {
        if (!t.playing || !waNode) return;
        const ctx = getAudioCtx();
        if (!ctx) return stop();
        const elapsed = Math.max(0, ctx.currentTime - waCtxStart);
        t.playhead = Math.min(t.dur, waOffsetStart + elapsed);
        if (t.playhead >= waStopAt - 0.015) {
          if (t.loop) {
            playWebAudio(t.start, t.end);
            return;
          }
          t.playhead = waStopAt;
          stop();
          return;
        }
        layout();
        raf = requestAnimationFrame(tickWebAudio);
      };

      const playWebAudio = (from, to) => {
        const ctx = getAudioCtx();
        if (!ctx || !audioBuf) return false;
        stopWebAudio();
        cancelAnimationFrame(raf);
        const startPos = Math.max(0, Math.min(audioBuf.duration - 0.02, from));
        const clipDur = Math.max(0.05, Math.min(audioBuf.duration - startPos, to - startPos));
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        waNode = src;
        waOffsetStart = startPos;
        waStopAt = startPos + clipDur;
        t.stopAt = waStopAt;
        t.playing = true;
        t.playhead = startPos;
        const startPlay = () => {
          if (waNode !== src) return;
          waCtxStart = ctx.currentTime;
          src.onended = () => {
            if (waNode !== src) return;
            if (t.loop && t.playing) {
              playWebAudio(t.start, t.end);
            } else {
              waNode = null;
              t.playing = false;
              layout();
            }
          };
          src.start(0, startPos, clipDur);
          layout();
          raf = requestAnimationFrame(tickWebAudio);
        };
        if (ctx.state === "suspended") {
          ctx.resume().then(startPlay).catch((e) => {
            log("warn", "ui:webaudio-resume-error", e);
            stop();
          });
        } else {
          startPlay();
        }
        return true;
      };

      const tick = () => {
        if (!t.playing) return;
        if (media.seeking) {
          raf = requestAnimationFrame(tick);
          return;
        }
        t.playhead = Math.max(0, media.currentTime - t.offset);
        const settled = performance.now() - playStartedMs > 120;
        if (settled && t.stopAt != null && media.currentTime >= t.offset + t.stopAt - 0.015) {
          if (t.loop) {
            play(t.start, t.end, media.muted);
            return;
          }
          stop();
          return;
        }
        layout();
        if (!media.paused) raf = requestAnimationFrame(tick);
      };

      function stop() {
        playToken++;
        cancelAnimationFrame(raf);
        stopWebAudio();
        if (!media.paused) media.pause();
        t.stopAt = null;
        t.playing = false;
        layout();
      }

      const waitSeek = (targetTime) =>
        new Promise((resolve) => {
          if (Math.abs(media.currentTime - targetTime) < 0.04 && !media.seeking) return resolve();
          let done = false;
          const fin = () => {
            if (done) return;
            done = true;
            clearTimeout(to);
            media.removeEventListener("seeked", fin);
            resolve();
          };
          const to = setTimeout(fin, 400);
          media.addEventListener("seeked", fin, { once: true });
          try {
            media.currentTime = targetTime;
          } catch (e) {
            fin();
          }
        });

      const play = async (from, to, muted = t.muted) => {
        stop();
        const myToken = ++playToken;
        if (!isVideo && !muted && audioBuf && playWebAudio(from, to)) {
          return;
        }
        t.stopAt = to;
        t.playing = true;
        t.playhead = from;
        media.muted = muted;
        media.volume = 1;
        seeking = false;
        pendingSeek = null;
        layout();
        await waitSeek(t.offset + from);
        if (myToken !== playToken) return;
        playStartedMs = performance.now();
        try {
          await media.play();
          if (myToken !== playToken) {
            media.pause();
            return;
          }
          raf = requestAnimationFrame(tick);
        } catch (e) {
          log("warn", "ui:play-error", e);
          if (!muted && audioBuf && playWebAudio(from, to)) return;
          if (myToken === playToken) {
            t.playing = false;
            layout();
          }
        }
      };

      media.addEventListener("ended", () => {
        if (t.loop && t.playing) {
          play(t.start, t.end, media.muted);
        } else if (t.playing && !waNode) {
          stop();
        }
      });

      const toggleRange = (from, to) => {
        if (t.playing || !media.paused || waNode) stop();
        else play(from, to);
      };
      playSegBtn.addEventListener("click", () => toggleRange(t.start, t.end));
      playCurBtn.addEventListener("click", () =>
        toggleRange(t.playhead >= t.start && t.playhead < t.end - 0.1 ? t.playhead : t.start, t.end)
      );
      playEndBtn.addEventListener("click", () => toggleRange(Math.max(t.start, t.end - 2), t.end));

      const load = (file, { duration, offset = 0, peaks = null, peakMax = 1 }) => {
        stop();
        audioBuf = null;
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = URL.createObjectURL(file);
        Object.assign(t, {
          dur: duration,
          offset,
          start: 0,
          end: Math.min(duration, DEFAULT_LEN),
          playhead: 0,
          peaks,
          peakMax,
        });
        media.addEventListener("loadeddata", () => seekTo(0), { once: true });
        media.src = t.url;
        media.load();
        if (WAAS.decodeAudioFile) {
          WAAS.decodeAudioFile(file)
            .then((buf) => {
              if (t.url) audioBuf = buf;
            })
            .catch(() => {});
        }
        changed();
        requestAnimationFrame(drawWave);
      };

      const setWaveform = (peaks, peakMax = 1) => {
        t.peaks = peaks;
        t.peakMax = peakMax || 1;
        requestAnimationFrame(drawWave);
      };

      const clear = () => {
        stop();
        audioBuf = null;
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = null;
        media.removeAttribute("src");
        try {
          media.load();
        } catch (e) {}
        Object.assign(t, { dur: 0, start: 0, end: 0, playhead: 0, peaks: null });
        changed();
        drawWave();
      };

      layout();
      return {
        el,
        media,
        load,
        setWaveform,
        clear,
        stop,
        play,
        seekTo,
        setStart,
        setEnd,
        toggleSelection: () => {
          if (t.dur) toggleRange(t.start, t.end);
        },
        nudgePlayhead: (delta) => {
          if (!t.dur) return;
          stop();
          seekTo(t.playhead + delta);
        },
        setFramePreview: (mode, corner) => {
          frameMode = mode;
          frameCorner = corner;
          updateStageStyle();
        },
        layout,
        drawWave,
        onChange: (fn) => listeners.add(fn),
        setMuted: (m) => {
          t.muted = m;
          media.muted = m;
        },
        get loaded() {
          return t.dur > 0;
        },
        get start() {
          return t.start;
        },
        get end() {
          return t.end;
        },
        get playhead() {
          return t.playhead;
        },
        get len() {
          return t.end - t.start;
        },
        get key() {
          return t.start.toFixed(3) + "-" + t.end.toFixed(3);
        },
      };
    }

    // ============================================================ Section Helper
    function makeSection(n, title, ...body) {
      const badge = h("span", { class: "n" }, String(n));
      const el = h("section", { class: "off" }, h("h3", null, badge, title), ...body);
      return {
        el,
        setState(enabled, done) {
          el.classList.toggle("off", !enabled);
          el.classList.toggle("done", !!done && enabled);
          badge.textContent = done && enabled ? "✓" : String(n);
        },
      };
    }

    // ============================================================ Audio Source Section (Tabs 2 & 3)
    function makeAudioSource(onChange) {
      const s = { file: null };
      const trimmer = makeTrimmer("audio", "Drag the green handles to trim, or drag the middle highlight to slide the clip.");
      const wrap = h("div", { style: "display:none;margin-top:8px" }, trimmer.el);

      const loadFile = async (f) => {
        picker.setLoading(f.name);
        await run("audio", async () => {
          try {
            const a = await WAAS.probeAudio(f);
            s.file = f;
            trimmer.load(f, { duration: a.duration, peaks: a.peaks, peakMax: a.peakMax });
            wrap.style.display = "";
            picker.setLoaded(
              f.name,
              `${fmtT(a.duration)} · ${a.channels === 1 ? "Mono" : "Stereo"} · ${fmtB(f.size)}${
                a.hasAudio ? "" : " · Warning: appears silent"
              }`
            );
            log("info", "ui:audio-loaded", {
              name: f.name,
              type: f.type,
              bytes: f.size,
              duration: a.duration,
              channels: a.channels,
              peak: +a.peakMax.toFixed(4),
            });
          } catch (e) {
            log("error", "ui:audio-error", e);
            s.file = null;
            trimmer.clear();
            wrap.style.display = "none";
            picker.setError("Could not decode audio: " + e.message);
          }
        });
        onChange();
      };

      const picker = makeDropPicker({
        title: "Drop audio or video file here, or click to browse",
        subtitle: "Supports MP3, M4A, OGG, Opus, WAV, FLAC, or extract sound from any video",
        accept: "audio/*,video/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.mp4,.mov,.webm,.mkv",
        icon: "mix",
        onFile: loadFile,
        onClear: () => {
          s.file = null;
          trimmer.clear();
          wrap.style.display = "none";
          onChange();
        },
      });

      trimmer.onChange(onChange);
      return {
        els: [picker.el, wrap],
        trimmer,
        picker,
        loadFile,
        get ready() {
          return !!s.file && trimmer.loaded;
        },
        get params() {
          return s.file ? { file: s.file, start: trimmer.start, dur: trimmer.len } : null;
        },
      };
    }

    // ============================================================ Format, Audio FX & Quality Matrix
    function makeFormat({ getParams, grid = true, sync = true, still = false, defaultFade = false, onFrameStyle, extras = [] }) {
      const f = {
        mode: "fit",
        corner: "square",
        gain: 1,
        normalize: false,
        fade: defaultFade,
        an: null,
        anKey: null,
        sel: null,
      };

      const mkSeg = (items, getCur, onPick) => {
        const btns = items.map(([val, label]) =>
          h("button", {
            textContent: label,
            class: getCur() === val ? "on" : "",
            onclick: () => {
              onPick(val);
              refreshSeg();
              if (onFrameStyle) onFrameStyle(f.mode, f.corner);
              api.onUpdate();
            },
          })
        );
        const refreshSeg = () => btns.forEach((b, i) => b.classList.toggle("on", getCur() === items[i][0]));
        return { el: h("span", { class: "seg" }, btns), btns, refreshSeg };
      };

      const modeSeg = mkSeg(
        [
          ["fit", "Fit (Transparent)"],
          ["crop", "Crop (Fill)"],
          ["blur", "Blur Fill"],
        ],
        () => f.mode,
        (v) => (f.mode = v)
      );
      const cornerSeg = mkSeg(
        [
          ["square", "Square"],
          ["rounded", "Rounded"],
          ["circle", "Circle"],
        ],
        () => f.corner,
        (v) => (f.corner = v)
      );

      // Audio enhancement controls
      const gainVal = h("span", { class: "tabular", style: "font-size:12px;font-weight:700;min-width:38px" }, "100%");
      const gainSlider = h("input", {
        type: "range",
        min: 50,
        max: 250,
        step: 5,
        value: 100,
        style: "width:110px",
        title: "Adjust audio volume (double-click to reset to 100%)",
        oninput: () => {
          f.gain = +gainSlider.value / 100;
          gainVal.textContent = gainSlider.value + "%";
          api.onUpdate();
        },
        ondblclick: () => {
          gainSlider.value = 100;
          f.gain = 1;
          gainVal.textContent = "100%";
          api.onUpdate();
        },
      });
      const normBtn = h("button", {
        class: "chip",
        textContent: "Auto-Normalize",
        title: "Automatically boost quiet audio to an optimal listening level without clipping",
        onclick: () => {
          f.normalize = !f.normalize;
          normBtn.classList.toggle("on", f.normalize);
          api.onUpdate();
        },
      });
      const fadeBtn = h("button", {
        class: "chip" + (f.fade ? " on" : ""),
        textContent: "Anti-Click Fade",
        title: "Applies an 8 ms fade at start & end to prevent trim pops/clicks",
        onclick: () => {
          f.fade = !f.fade;
          fadeBtn.classList.toggle("on", f.fade);
          api.onUpdate();
        },
      });

      const audioBar = h(
        "div",
        { class: "audio-bar" },
        h("span", { class: "muted", style: "display:inline-flex;align-items:center;gap:5px;font-weight:650" }, ICONS.volume(14), "Audio:"),
        gainSlider,
        gainVal,
        normBtn,
        fadeBtn
      );

      // Quality Presets & Compact Custom Matrix UI
      const calcBtn = h("button", { class: "sec", textContent: "Analyze Quality Options" });
      const calcInfo = h("span", { class: "muted grow" });
      const staleLbl = h("div", { class: "stale", style: "display:none" }, "Clip or style changed — re-analyze or click Create Sticker to auto-update.");
      const calcBarIn = h("div");
      const calcBar = h("div", { class: "bar", style: "display:none" }, calcBarIn);
      const qWrap = h("div", { class: "q-wrap", style: "display:none" });
      const presetsHost = h("div", { class: "q-presets" });
      const qDot = h("span", { class: "q-dot" });
      const selLbl = h("span");
      let showMatrix = false;
      const toggleMatrixBtn = h("button", {
        class: "sec sm",
        textContent: "Custom Matrix ▾",
        onclick: () => {
          showMatrix = !showMatrix;
          matrixCard.style.display = showMatrix ? "" : "none";
          toggleMatrixBtn.textContent = showMatrix ? "Hide Matrix ▴" : "Custom Matrix ▾";
        },
      });
      const qBar = h("div", { class: "q-bar" }, h("div", { class: "q-bar-info" }, qDot, selLbl), toggleMatrixBtn);
      const gridHost = h("div");
      const legend = h(
        "div",
        { class: "legend" },
        h("span", null, h("i", { style: "background:var(--ok-bg);border:1px solid var(--ok)" }), "Fits cleanly"),
        h("span", null, h("i", { style: "background:var(--warn-bg);border:1px solid var(--warn)" }), "Fits (lower Q)"),
        h("span", null, "★ Best · est. size in KB")
      );
      const matrixCard = h("div", { class: "q-matrix-card", style: "display:none" }, gridHost, legend);
      qWrap.append(presetsHost, qBar, matrixCard);

      // Advanced controls
      const syncNum = h("input", {
        type: "number",
        min: 0,
        max: 1000,
        step: 10,
        value: store.get("waas-sync-ms", 0),
      });
      syncNum.addEventListener("change", () => {
        store.set("waas-sync-ms", +syncNum.value || 0);
        api.onUpdate();
      });

      const bitrateSel = h(
        "select",
        null,
        h("option", { value: "0", textContent: "Auto (up to 48 kbps — crisp music & voice)" }),
        h("option", { value: "32", textContent: "32 kbps (smaller audio file)" }),
        h("option", { value: "48", textContent: "48 kbps (balanced high quality)" }),
        h("option", { value: "64", textContent: "64 kbps (maximum clarity)" })
      );
      bitrateSel.value = String(store.get("waas-audio-kbps", 0));
      bitrateSel.addEventListener("change", () => {
        store.set("waas-audio-kbps", +bitrateSel.value || 0);
        api.onUpdate();
      });

      const stillChk = h("input", { type: "checkbox", onchange: () => api.onUpdate() });

      const autoGateChk = h("input", {
        type: "checkbox",
        checked: store.get("waas-auto-gating", true) !== false,
        onchange: () => {
          store.set("waas-auto-gating", autoGateChk.checked);
          if (autoGateChk.checked && WAAS.wa && WAAS.wa.isReady()) WAAS.wa.forceSoundStickers();
        },
      });

      const advRows = [];
      if (sync) {
        advRows.push(
          h(
            "div",
            { class: "row" },
            h("span", { style: "font-weight:600;font-size:12.5px" }, "Sync offset (ms)"),
            syncNum,
            h("span", { class: "muted" }, "Usually 0. Delays first visual frame if audio lags on mobile.")
          )
        );
      }
      advRows.push(
        h("div", { class: "row" }, h("span", { style: "font-weight:600;font-size:12.5px" }, "Audio bitrate"), bitrateSel)
      );
      if (still) {
        advRows.push(
          h(
            "label",
            { class: "chk" },
            stillChk,
            h(
              "span",
              null,
              h("strong", null, "Send as static WebP (experimental)"),
              h(
                "div",
                { class: "muted" },
                "By default, images are encoded as a 1-frame animated WebP matching the audio duration for best WhatsApp compatibility."
              )
            )
          )
        );
      }
      advRows.push(
        h(
          "label",
          { class: "chk" },
          autoGateChk,
          h(
            "span",
            null,
            h("strong", null, "Auto-enable audio sticker playback in WhatsApp Web"),
            h("div", { class: "muted" }, "Activates WhatsApp Web's local sound sticker feature flags automatically when loaded.")
          )
        )
      );

      const advanced = h("details", null, h("summary", null, "Advanced Settings"), ...advRows);

      const fileId = (x) => (x ? x.name + "|" + x.size + "|" + x.lastModified : "");
      const key = () => {
        const p = getParams();
        if (!p) return null;
        const v = p.visual;
        const followsAudio = v.kind === "image" || p.fit !== "independent";
        return JSON.stringify([
          v.kind,
          fileId(v.file),
          +(v.start || 0).toFixed(3),
          +(v.dur || 0).toFixed(3),
          followsAudio ? p.fit : "",
          followsAudio ? +p.audio.dur.toFixed(3) : "",
          f.mode,
          f.corner,
        ]);
      };
      const fullKey = () => {
        const p = getParams();
        if (!p) return null;
        return JSON.stringify([
          key(),
          fileId(p.audio.file),
          +p.audio.start.toFixed(3),
          +p.audio.dur.toFixed(3),
          p.fit,
          f.sel,
          api.options(),
        ]);
      };

      const fresh = () => !!f.an && f.anKey === key();
      const CALC_HINT = "Optional: preview size presets & custom grid, or click Create Sticker (Auto) directly.";
      const reset = () => {
        if (f.an) WAAS.release(f.an);
        f.an = null;
        f.anKey = null;
        f.sel = null;
        showMatrix = false;
        presetsHost.textContent = "";
        gridHost.textContent = "";
        selLbl.textContent = "";
        matrixCard.style.display = "none";
        toggleMatrixBtn.textContent = "Custom Matrix ▾";
        qWrap.style.display = "none";
        calcInfo.textContent = CALC_HINT;
      };
      calcInfo.textContent = CALC_HINT;

      const buildPresets = (an) => {
        const usable = an.cells.filter((c) => c.state === "ok" || c.state === "low");
        if (!usable.length) return [];
        const okCells = usable.filter((c) => c.state === "ok");
        const pool = okCells.length ? okCells : usable;

        const picked = [];
        const seen = new Set();
        const add = (name, badge, cell) => {
          if (!cell) return;
          const id = cell.side + "x" + cell.fps;
          if (seen.has(id)) return;
          seen.add(id);
          picked.push({ name, badge, cell });
        };

        // 1. Auto recommended
        if (an.auto) {
          const isTop = an.auto.side === 512 && an.auto.fps >= 25;
          add(isTop ? "Best Quality" : "Recommended", "★ Best", an.auto);
        }
        // 2. Sharpest (highest resolution, then highest fps)
        const sharpest = [...pool].sort((a, b) => b.side - a.side || b.fps - a.fps)[0];
        add("Sharpest", "Max px", sharpest);
        // 3. Smoothest (highest fps, then highest resolution)
        const smoothest = [...pool].sort((a, b) => b.fps - a.fps || b.side - a.side)[0];
        add("Smoothest", "Max fps", smoothest);
        // 4. Balanced mid-tier (useful when 512x30 fits everything)
        if (picked.length < 3) {
          const mid = pool.find((c) => c.side === 384 && c.fps <= 20) || pool.find((c) => c.side === 320 && c.fps <= 20);
          add("Balanced", "Medium", mid);
        }
        // 5. Compact lightweight option (distinct from already picked options)
        const compactPool = okCells.filter((c) => !seen.has(c.side + "x" + c.fps));
        const compact =
          [...compactPool]
            .filter((c) => c.side <= 256 && c.side >= 192 && c.fps >= 12 && c.fps <= 20)
            .sort((a, b) => b.score - a.score)[0] ||
          [...compactPool]
            .filter((c) => c.est <= 450000 && c.side >= 160)
            .sort((a, b) => a.est - b.est)[0] ||
          [...pool].filter((c) => !seen.has(c.side + "x" + c.fps) && c.side >= 128).sort((a, b) => a.est - b.est)[0];
        add("Compact", "Small", compact);

        return picked.slice(0, 4);
      };

      const renderGrid = () => {
        presetsHost.textContent = "";
        gridHost.textContent = "";
        const an = f.an;
        if (!an) {
          qWrap.style.display = "none";
          return;
        }
        qWrap.style.display = "";

        // 1. Render neat 1-click preset cards
        const presets = buildPresets(an);
        for (const p of presets) {
          const c = p.cell;
          const isSel = f.sel && f.sel.side === c.side && f.sel.fps === c.fps;
          presetsHost.append(
            h(
              "button",
              {
                class: "q-card" + (isSel ? " sel" : ""),
                onclick: () => {
                  f.sel = { side: c.side, fps: c.fps };
                  renderGrid();
                  api.onUpdate();
                },
              },
              h(
                "div",
                { class: "q-card-top" },
                h("span", { class: "q-name" }, p.name),
                h("span", { class: "q-badge" + (c.state === "low" ? " low" : "") }, p.badge)
              ),
              h("div", { class: "q-spec" }, `${c.side} px · ${c.fps} fps`),
              h("div", { class: "q-size" }, `≈ ${fmtB(c.est)}${c.state === "low" ? " · Lower Q" : ""}`)
            )
          );
        }

        // 2. Render clean selected bar
        const cur = f.sel && an.cells.find((x) => x.side === f.sel.side && x.fps === f.sel.fps);
        if (cur) {
          qDot.className = "q-dot" + (cur.state === "low" ? " low" : "");
          selLbl.textContent = `${cur.side}×${cur.side} px · ${cur.fps} fps · ≈ ${fmtB(cur.est)}${
            cur.state === "low" ? " (auto-reduced quality)" : " (fits cleanly)"
          }`;
        } else {
          qDot.className = "q-dot no";
          selLbl.textContent = "No combination fits under 1 MB — shorten your clip.";
        }

        // 3. Render pruned, neat Custom Matrix (only practical resolutions & non-empty rows/cols)
        const PREFERRED_SIDES = [512, 384, 320, 256, 192, 128, 96];
        const PREFERRED_FPS = [30, 25, 20, 15, 12, 10, 8, 5];
        const canCell = (s, fp) => {
          const x = an.cells.find((c) => c.side === s && c.fps === fp);
          return !!x && (x.state === "ok" || x.state === "low");
        };

        let sidesToShow = PREFERRED_SIDES.filter((s) => PREFERRED_FPS.some((fp) => canCell(s, fp)));
        if (f.sel && !sidesToShow.includes(f.sel.side)) sidesToShow.push(f.sel.side);
        if (!sidesToShow.length) {
          sidesToShow = WAAS.limits.SIDES.filter((s) => WAAS.limits.FPS_LIST.some((fp) => canCell(s, fp)));
        }
        sidesToShow.sort((a, b) => b - a);

        let fpsToShow = PREFERRED_FPS.filter((fp) => sidesToShow.some((s) => canCell(s, fp)));
        if (f.sel && !fpsToShow.includes(f.sel.fps)) fpsToShow.push(f.sel.fps);
        fpsToShow.sort((a, b) => b - a);

        toggleMatrixBtn.style.display = sidesToShow.length && fpsToShow.length ? "" : "none";
        if (!sidesToShow.length || !fpsToShow.length) {
          matrixCard.style.display = "none";
          return;
        }

        const thead = h(
          "tr",
          null,
          h("th", { class: "side" }, "Size \\ FPS"),
          fpsToShow.map((x) => h("th", null, x + " fps"))
        );
        const rows = sidesToShow.map((side) =>
          h(
            "tr",
            null,
            h("th", { class: "side" }, side + " px"),
            fpsToShow.map((fps) => {
              const c = an.cells.find((x) => x.side === side && x.fps === fps);
              const isAuto = an.auto && an.auto.side === side && an.auto.fps === fps;
              const isSel = f.sel && f.sel.side === side && f.sel.fps === fps;
              const can = !!c && (c.state === "ok" || c.state === "low");
              const label = !can ? "—" : (isAuto ? "★ " : "") + Math.round(c.est / 1000) + "K";
              const title = !c || c.state === "out"
                ? "Outside capture range"
                : c.state === "no"
                ? `≈ ${fmtB(c.estMin)} even at min quality (> 1 MB)`
                : c.state === "low"
                ? `≈ ${fmtB(c.est)} — fits under 1 MB with adaptive lower quality`
                : `≈ ${fmtB(c.est)} — fits cleanly under 1 MB`;
              return h(
                "td",
                null,
                h("button", {
                  class: (c ? c.state : "out") + (isSel ? " sel" : ""),
                  textContent: label,
                  title,
                  disabled: !can,
                  onclick: () => {
                    f.sel = { side, fps };
                    renderGrid();
                    api.onUpdate();
                  },
                })
              );
            })
          )
        );
        gridHost.append(h("table", { class: "grid" }, thead, rows));
      };

      const runAnalyze = async (signal, extProgress) => {
        const p = getParams();
        if (!p) throw new Error("Select your media files first.");
        reset();
        const k = key();
        const an = await WAAS.analyze({
          ...p,
          mode: f.mode,
          corner: f.corner,
          signal,
          onProgress: (txt, frac) => {
            calcInfo.textContent = txt;
            api.setProgress(frac);
            if (extProgress) extProgress(txt, frac);
          },
        });
        f.an = an;
        f.anKey = k;
        f.sel = an.auto ? { side: an.auto.side, fps: an.auto.fps } : null;
        calcInfo.textContent = `Analyzed in ${(an.ms / 1000).toFixed(1)} s — pick a preset or open Custom Matrix.`;
        renderGrid();
        api.setProgress(0);
        return an;
      };

      calcBtn.addEventListener("click", async () => {
        if (!getParams()) return;
        api.onUpdate();
        try {
          await run("analyze", (signal) => runAnalyze(signal));
        } catch (e) {
          calcInfo.textContent = e.name === "AbortError" ? "Analysis canceled." : "Error: " + e.message;
        }
        api.setProgress(0);
        api.onUpdate();
      });

      const body = [
        ...extras,
        h(
          "div",
          { class: "opt-grid" },
          h("span", { class: "opt-lbl" }, "Framing"),
          modeSeg.el,
          h("span", { class: "opt-lbl" }, "Corners"),
          cornerSeg.el
        ),
        audioBar,
      ];
      if (grid) {
        body.push(
          h("div", { class: "row", style: "margin-top:10px" }, calcBtn, calcInfo),
          calcBar,
          staleLbl,
          qWrap
        );
      }
      body.push(advanced);

      const api = {
        body,
        onUpdate: () => {},
        setProgress: (frac) => {
          calcBar.style.display = frac > 0 ? "" : "none";
          calcBarIn.style.width = Math.round(frac * 100) + "%";
        },
        refresh() {
          const has = !!getParams();
          const stale = !!f.an && !fresh();
          staleLbl.style.display = stale ? "" : "none";
          qWrap.style.opacity = stale ? "0.4" : "";
          qWrap.style.pointerEvents = stale ? "none" : "";
          calcBtn.disabled = G.busy || !has;
          modeSeg.btns.forEach((b) => (b.disabled = G.busy));
          cornerSeg.btns.forEach((b) => (b.disabled = G.busy));
          gainSlider.disabled = normBtn.disabled = fadeBtn.disabled = G.busy;
        },
        // Ready as soon as sources exist (auto-analyzes on Create if not yet analyzed, OR uses fresh analyzed selection).
        get ready() {
          if (!getParams()) return false;
          if (grid && fresh() && !f.sel) return false; // Analyzed and nothing fits under 1 MB
          return true;
        },
        get analyzed() {
          return fresh() && !!f.sel;
        },
        get mode() {
          return f.mode;
        },
        get corner() {
          return f.corner;
        },
        reset,
        fullKey,
        syncStored() {
          syncNum.value = store.get("waas-sync-ms", 0);
          bitrateSel.value = String(store.get("waas-audio-kbps", 0));
          autoGateChk.checked = store.get("waas-auto-gating", true) !== false;
        },
        options: () => ({
          syncMs: sync ? +syncNum.value || 0 : 0,
          still: still && stillChk.checked,
          audioOpts: {
            gain: f.gain,
            normalize: f.normalize,
            fadeMs: f.fade ? 8 : 0,
            targetKbps: +bitrateSel.value || 0,
          },
        }),
        async prepare(signal, onProgress) {
          const p = getParams();
          if (grid) {
            if (!fresh()) {
              await runAnalyze(signal, onProgress);
            }
            if (!f.sel) {
              throw new Error("No resolution/FPS combination fits within 1 MB — shorten your clip duration.");
            }
            return { an: f.an, side: f.sel.side, fps: f.sel.fps, audio: p.audio, temp: false };
          }
          const an = await WAAS.analyze({ ...p, mode: f.mode, corner: f.corner, signal, onProgress });
          return { an, side: an.auto.side, fps: an.auto.fps, audio: p.audio, temp: true };
        },
      };
      return api;
    }

    // ============================================================ Create, Preview & Send
    function makeCreate({ fmt, getBase }) {
      const META_KEY = "waas-meta";
      const packInput = h("input", { type: "text", maxLength: 128, placeholder: "e.g. My Meme Pack" });
      const authorInput = h("input", { type: "text", maxLength: 128, placeholder: "e.g. 4x4Tools" });
      const emojiInput = h("input", { type: "text", maxLength: 16, placeholder: "🔊", style: "text-align:center" });

      const loadMeta = () => {
        const m = store.get(META_KEY, {}) || {};
        packInput.value = m.packName || "";
        authorInput.value = m.publisher || "";
        emojiInput.value = m.emojis || "🔊";
      };
      const saveMeta = () =>
        store.set(META_KEY, {
          packName: packInput.value,
          publisher: authorInput.value,
          emojis: emojiInput.value || "🔊",
        });
      loadMeta();
      [packInput, authorInput, emojiInput].forEach((inp) => inp.addEventListener("change", saveMeta));

      const emojiChips = ["🔊", "😂", "🔥", "💀", "🎵", "❤️"].map((em) =>
        h("button", {
          class: "chip",
          textContent: em,
          title: "Set sticker emoji to " + em,
          onclick: () => {
            emojiInput.value = em;
            saveMeta();
          },
        })
      );

      const createBtn = h("button", { class: "act" }, ICONS.spark(15), h("span", null, "Create Sticker"));
      const cancelBtn = h("button", { class: "sec", textContent: "Cancel", style: "display:none" });
      const barIn = h("div");
      const status = h("div", { class: "status" });

      // WhatsApp-style preview
      const resImg = h("img", { class: "wa-sticker", alt: "Audio sticker preview" });
      const waStage = h(
        "div",
        { class: "wa-stage", title: "Click to replay sticker + audio in sync" },
        h("div", { class: "wa-play-hint" }, "Click to play"),
        resImg,
        h("div", { class: "wa-sound-badge" }, ICONS.volume(14))
      );
      const resAudio = h("audio", { controls: true });
      const togetherBtn = h("button", { class: "sec sm", textContent: "▶ Replay Synced" });
      const specLine = h("div", { class: "muted tabular", style: "font-size:11.5px" });

      const mStickerVal = h("span");
      const mStickerFill = h("div", { class: "meter-fill" });
      const mAudioVal = h("span");
      const mAudioFill = h("div", { class: "meter-fill" });
      const meters = h(
        "div",
        { class: "meters" },
        h("div", { class: "meter" }, h("div", { class: "meter-top" }, h("span", null, "Sticker"), mStickerVal), h("div", { class: "meter-bar" }, mStickerFill)),
        h("div", { class: "meter" }, h("div", { class: "meter-top" }, h("span", null, "Audio"), mAudioVal), h("div", { class: "meter-bar" }, mAudioFill))
      );

      // Send controls
      const chatDot = h("span", { class: "dot" });
      const chatText = h("span");
      const chatPill = h("div", { class: "chat-pill" }, chatDot, chatText);

      const optActive = h("option", { value: "active-only", textContent: "Send to Active Chat" });
      const optActiveFwd = h("option", { value: "active-fwd", textContent: "Send to Active Chat & Open Forward" });
      const optSelfFwd = h("option", { value: "self-fwd", textContent: "Save to My Chat (You) & Open Forward" });
      const optSelfOnly = h("option", { value: "self-only", textContent: "Save to My Chat (You)" });
      const destSel = h("select", { class: "grow" }, optActive, optActiveFwd, optSelfFwd, optSelfOnly);
      destSel.value = store.get("waas-dest", "active-only");
      destSel.addEventListener("change", () => store.set("waas-dest", destSel.value));

      const sendBtn = h("button", { class: "act" }, ICONS.send(14), h("span", null, "Send Sticker"));
      const fwdLastBtn = h("button", { class: "sec", textContent: "Forward Sent…", style: "display:none" });
      const dlBtn = h("button", { class: "sec" }, ICONS.download(14), h("span", null, "Download .webp & .ogg"));

      const staleNote = h(
        "div",
        { class: "stale", style: "display:none;margin-top:8px" },
        "Settings changed after creating this sticker. Click 'Update Sticker' to apply changes before sending."
      );
      const previewCard = h(
        "div",
        { class: "preview-card" },
        waStage,
        h("div", { class: "preview-meta" }, h("div", { class: "row tight", style: "margin:0" }, togetherBtn, specLine), resAudio, meters)
      );
      const result = h(
        "div",
        { style: "display:none" },
        staleNote,
        previewCard,
        h("div", { class: "send-box" }, chatPill, h("div", { class: "row tight", style: "margin:0" }, destSel, sendBtn, fwdLastBtn, dlBtn))
      );

      const c = { result: null, key: null, urls: [], lastMsg: null, previewNode: null, previewBuf: null, playing: false };

      const setPlayingUI = (on) => {
        c.playing = !!on;
        waStage.classList.toggle("playing", c.playing);
        togetherBtn.textContent = c.playing ? "■ Stop Preview" : "▶ Replay Synced";
      };

      const stopPreview = () => {
        if (c.previewNode) {
          try {
            c.previewNode.onended = null;
            c.previewNode.stop();
            c.previewNode.disconnect();
          } catch (e) {}
          c.previewNode = null;
        }
        try {
          if (!resAudio.paused) resAudio.pause();
        } catch (e) {}
        setPlayingUI(false);
      };

      resAudio.addEventListener("play", () => setPlayingUI(true));
      resAudio.addEventListener("pause", () => {
        if (!c.previewNode) setPlayingUI(false);
      });
      resAudio.addEventListener("ended", () => {
        if (!c.previewNode) setPlayingUI(false);
      });

      const setStatus = (txt, frac, kind = "") => {
        status.textContent = txt || "";
        status.className = "status" + (kind ? " " + kind : "");
        if (frac != null) barIn.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + "%";
      };

      const revoke = () => {
        c.urls.forEach((u) => URL.revokeObjectURL(u));
        c.urls = [];
      };
      const clear = () => {
        stopPreview();
        c.result = null;
        c.key = null;
        c.lastMsg = null;
        c.previewBuf = null;
        fwdLastBtn.style.display = "none";
        result.style.display = "none";
        revoke();
        setStatus("", 0);
      };

      const refreshChatTarget = () => {
        const waOk = WAAS.wa && WAAS.wa.isReady();
        if (!waOk) {
          chatDot.style.background = "var(--warn)";
          chatText.textContent = "WhatsApp Web not connected — you can still create and download stickers.";
          optActive.textContent = "Send to Active Chat";
          optActiveFwd.textContent = "Send to Active Chat & Open Forward";
          return;
        }
        const info = WAAS.wa.getActiveChatInfo();
        if (info) {
          chatDot.style.background = "var(--ok)";
          chatText.textContent = "";
          chatText.append("Active chat: ", h("strong", null, info.title));
          optActive.textContent = `Send to "${info.title}"`;
          optActiveFwd.textContent = `Send to "${info.title}" & Open Forward`;
        } else {
          chatDot.style.background = "var(--warn)";
          chatText.textContent = "No chat currently open — open a chat or send to My Chat (You).";
          optActive.textContent = "Send to Active Chat (none open)";
          optActiveFwd.textContent = "Send to Active Chat & Forward (none open)";
        }
      };

      const playPreviewViaWebAudio = async () => {
        if (!c.result) return false;
        const ctx = getAudioCtx();
        if (!ctx) return false;
        if (ctx.state === "suspended") await ctx.resume();
        if (!c.previewBuf) {
          const ab = await c.result.ogg.arrayBuffer();
          c.previewBuf = await ctx.decodeAudioData(ab.slice(0));
        }
        const src = ctx.createBufferSource();
        src.buffer = c.previewBuf;
        src.connect(ctx.destination);
        c.previewNode = src;
        setPlayingUI(true);
        src.onended = () => {
          if (c.previewNode === src) {
            c.previewNode = null;
            setPlayingUI(false);
          }
        };
        src.start(0);
        return true;
      };

      const replaySynced = async () => {
        if (!c.result) return;
        if (c.playing) {
          stopPreview();
          return;
        }
        stopPreview();
        // Restart animated WebP from frame 0
        const u = resImg.src;
        resImg.src = "";
        resImg.src = u;
        resAudio.muted = false;
        resAudio.volume = 1;
        try {
          resAudio.currentTime = 0;
          await resAudio.play();
          setPlayingUI(true);
        } catch (e) {
          log("warn", "ui:preview-audio-fallback", e);
          try {
            await playPreviewViaWebAudio();
          } catch (e2) {
            log("error", "ui:preview-webaudio-failed", e2);
            setPlayingUI(false);
          }
        }
      };
      waStage.addEventListener("click", replaySynced);
      togetherBtn.addEventListener("click", replaySynced);

      createBtn.addEventListener("click", async () => {
        if (!fmt.ready) return;
        result.style.display = "none";
        c.lastMsg = null;
        fwdLastBtn.style.display = "none";
        try {
          const wasAnalyzed = fmt.analyzed;
          const res = await run("create", async (signal) => {
            const p = await fmt.prepare(signal, (t, f) => setStatus(t, f * 0.45));
            const offset = wasAnalyzed ? 0 : 0.45;
            const scale = 1 - offset;
            try {
              return await WAAS.create(p.an, {
                side: p.side,
                fps: p.fps,
                audio: p.audio,
                ...fmt.options(),
                packName: packInput.value,
                publisher: authorInput.value,
                emojis: WAAS.parseEmojis(emojiInput.value),
                onProgress: (t, f) => setStatus(t, offset + f * scale),
                signal,
              });
            } finally {
              if (p.temp) WAAS.release(p.an);
            }
          });

          stopPreview();
          c.result = res;
          c.key = fmt.fullKey();
          c.previewBuf = null;
          revoke();
          const u1 = URL.createObjectURL(res.webp);
          const u2 = URL.createObjectURL(res.ogg);
          c.urls.push(u1, u2);
          resImg.src = u1;
          resAudio.muted = false;
          resAudio.volume = 1;
          resAudio.src = u2;
          resAudio.load();

          const i = res.info;
          const durTxt =
            Math.abs(i.duration - i.audioDuration) > 0.05
              ? `Visual ${fmtT(i.duration)} · Audio ${fmtT(i.audioDuration)}`
              : fmtT(i.duration);
          specLine.textContent = `${i.side}×${i.side}${i.fps ? " · " + i.fps + " fps" : ""}${
            i.isAnimated ? "" : " · static"
          } · Q${Math.round(i.quality * 100)} · ${durTxt}`;

          const sPct = Math.min(100, (i.webpBytes / WAAS.limits.MAX_STICKER_BYTES) * 100);
          mStickerVal.textContent = `${fmtB(i.webpBytes)} / 1 MB`;
          mStickerFill.style.width = sPct + "%";
          mStickerFill.className = "meter-fill" + (sPct > 85 ? " warn" : "");

          const aPct = Math.min(100, (i.oggBytes / WAAS.limits.MAX_AUDIO_BYTES) * 100);
          mAudioVal.textContent = `${fmtB(i.oggBytes)} · ${i.audioKbps} kbps`;
          mAudioFill.style.width = aPct + "%";
          mAudioFill.className = "meter-fill" + (aPct > 85 ? " warn" : "");

          refreshChatTarget();
          result.style.display = "";
          setStatus("Sticker ready! Click the preview to test synced playback, then send.", 1, "ok");
        } catch (e) {
          setStatus(
            e.name === "AbortError" ? "Canceled." : "Error: " + e.message,
            0,
            e.name === "AbortError" ? "" : "err"
          );
        }
        api.onUpdate();
      });

      cancelBtn.addEventListener("click", () => {
        if (G.abort) G.abort.abort();
      });

      sendBtn.addEventListener("click", async () => {
        if (!c.result) return;
        const dest = destSel.value;
        const target = dest.startsWith("self") ? "self" : "active";
        const openForward = dest.endsWith("-fwd");
        try {
          const sent = await run("send", async () => {
            const i = c.result.info;
            const curPack = packInput.value.trim();
            const curAuthor = authorInput.value.trim();
            const curEmojis = WAAS.parseEmojis(emojiInput.value);
            if (
              curPack !== (i.packName || "") ||
              curAuthor !== (i.publisher || "") ||
              curEmojis.join(",") !== (i.emojis || ["🔊"]).join(",")
            ) {
              c.result.webp = await WAAS.retagWebp(c.result.webp, {
                packName: curPack,
                publisher: curAuthor,
                emojis: curEmojis,
                soundSha: i.soundSha256,
              });
              i.packName = curPack;
              i.publisher = curAuthor;
              i.emojis = curEmojis;
              log("info", "metadata:updated", { packName: i.packName, publisher: i.publisher, emojis: i.emojis });
            }
            saveMeta();
            return await WAAS.wa.publish(c.result, {
              target,
              openForward,
              onProgress: (t) => setStatus(t),
            });
          });

          c.lastMsg = sent.msg;
          if (openForward) {
            setStatus("Sent! Choose chats in WhatsApp's Forward dialog.", 1, "ok");
            api.onSentAndForward();
          } else {
            fwdLastBtn.style.display = "";
            setStatus(`Sent to ${sent.chatTitle}!`, 1, "ok");
            G.showToast(`Audio sticker sent to ${sent.chatTitle}`);
          }
        } catch (e) {
          setStatus("Send failed: " + e.message, 0, "err");
        }
      });

      fwdLastBtn.addEventListener("click", async () => {
        if (!c.lastMsg) return;
        try {
          await WAAS.wa.openForward(c.lastMsg);
          api.onSentAndForward();
        } catch (e) {
          setStatus("Could not open Forward dialog: " + e.message, 0, "err");
        }
      });

      dlBtn.addEventListener("click", () => {
        if (!c.result) return;
        const base = getBase();
        download(c.result.webp, base + ".webp");
        download(c.result.ogg, base + ".ogg");
        log("info", "ui:downloaded-files", { base });
        G.showToast(`Downloaded ${base}.webp & ${base}.ogg`);
      });

      const api = {
        body: [
          h(
            "div",
            null,
            h("div", { class: "muted", style: "margin-bottom:6px" }, "Sticker metadata (optional — shown under the sticker in WhatsApp and remembered automatically):"),
            h(
              "div",
              { class: "meta-grid" },
              h("div", { class: "field" }, h("label", null, "Pack Name"), packInput),
              h("div", { class: "field" }, h("label", null, "Author / Publisher"), authorInput),
              h("div", { class: "field" }, h("label", null, "Emoji Tag"), emojiInput)
            ),
            h("div", { class: "row tight", style: "margin-bottom:8px" }, h("span", { class: "muted" }, "Quick emoji:"), ...emojiChips)
          ),
          h("div", { class: "row" }, createBtn, cancelBtn),
          h("div", { class: "bar" }, barIn),
          status,
          result,
        ],
        onSentAndForward: () => {},
        onUpdate: () => {},
        setStatus,
        clear,
        stopPreview,
        loadMeta,
        refreshChatTarget,
        get hasResult() {
          return !!c.result;
        },
        refresh() {
          const stale = !!c.result && c.key !== fmt.fullKey();
          const done = !!c.result && !stale;
          const lbl = createBtn.querySelector("span");
          lbl.textContent = done
            ? "✓ Sticker Ready"
            : c.result
            ? "Update Sticker"
            : fmt.analyzed
            ? "Create Sticker"
            : "Create Sticker (Auto)";
          createBtn.disabled = G.busy || !fmt.ready || done;
          staleNote.style.display = stale ? "" : "none";
          previewCard.style.opacity = stale ? "0.5" : "";
          sendBtn.disabled = G.busy || !c.result;
          fwdLastBtn.disabled = G.busy || !c.lastMsg;
          dlBtn.disabled = G.busy || !c.result;
          cancelBtn.style.display = G.busy && api.isActive() ? "" : "none";
          refreshChatTarget();
        },
        isActive: () => true,
      };
      return api;
    }

    // ============================================================ Form Builder
    function makeForm({ id, title, icon, desc, sources, fmt, getBase, onShow, stop, getTrimmer }) {
      const create = makeCreate({ fmt, getBase });
      let n = 0;
      const secs = sources.map((s) => makeSection(++n, s.title, ...s.body));
      const secFmt = makeSection(++n, "Style, Audio & Quality", ...fmt.body);
      const secCreate = makeSection(++n, "Create & Send", ...create.body);
      const el = h(
        "div",
        { style: "display:none" },
        h("div", { class: "tabdesc" }, desc),
        ...secs.map((s) => s.el),
        secFmt.el,
        secCreate.el
      );

      const stopAll = () => {
        stop();
        create.stopPreview();
      };
      const form = {
        id,
        title,
        icon,
        el,
        create,
        stop: stopAll,
        getTrimmer: getTrimmer || (() => null),
        refresh() {
          const allSourcesReady = sources.every((s) => s.ready());
          sources.forEach((s, i) => {
            const enabled = !G.busy && (s.enabled ? s.enabled() : true);
            secs[i].setState(enabled, s.ready());
          });
          secFmt.setState(allSourcesReady, allSourcesReady && fmt.analyzed);
          secCreate.setState(allSourcesReady && (fmt.ready || create.hasResult), create.hasResult);
          fmt.refresh();
          create.refresh();
        },
        show(on) {
          el.style.display = on ? "" : "none";
          if (on) {
            fmt.syncStored();
            create.loadMeta();
            create.refreshChatTarget();
            if (onShow) onShow();
          } else {
            stopAll();
          }
        },
      };

      fmt.onUpdate = () => form.refresh();
      create.onUpdate = () => form.refresh();
      create.isActive = () => el.style.display !== "none";
      create.onSentAndForward = () => close(true);
      return form;
    }

    // ============================================================ Tab 1: Video + Sound
    function videoForm() {
      const s = { file: null, noAudio: false };
      const trimmer = makeTrimmer(
        "video",
        "Shortcuts: Space (Play/Pause) · I / O (Set In/Out) · ← / → (Step 1 frame, hold Shift for 0.5s)"
      );
      const trimEmpty = h("div", { class: "muted" }, "Select a video in Step 1 to preview and trim your clip.");
      const trimWrap = h("div", { style: "display:none" }, trimmer.el);
      const syncTrimVis = () => {
        const has = trimmer.loaded;
        trimWrap.style.display = has ? "" : "none";
        trimEmpty.style.display = has ? "none" : "";
      };
      const silentMsg = h("span", null, "This video has no audio track (or is silent). Want to pair it with custom audio instead?");
      const silentBanner = h(
        "div",
        { class: "banner", style: "display:none" },
        silentMsg,
        h("button", {
          class: "act",
          style: "padding:5px 11px;font-size:12px",
          textContent: "Open in Video / GIF + Audio",
          onclick: () => {
            if (!s.file) return;
            const fileToMove = s.file;
            G.switchToTab("mix");
            G.forms[2].loadVisualFile(fileToMove);
            G.showToast("Moved video to Video / GIF + Audio — now add your audio clip!");
          },
        })
      );

      const changed = () => {
        syncTrimVis();
        form.refresh();
      };
      const fmt = makeFormat({
        onFrameStyle: (m, c) => trimmer.setFramePreview(m, c),
        getParams: () =>
          s.file && trimmer.loaded
            ? {
                visual: { kind: "video", file: s.file, start: trimmer.start, dur: trimmer.len },
                audio: { file: s.file, start: trimmer.start, dur: trimmer.len },
                fit: "loop",
              }
            : null,
      });

      const loadFile = async (f) => {
        setXMsg("");
        // Smart auto-routing if user drops an image, GIF, or audio file on Video tab
        if (WAAS.isAudioFile(f)) {
          G.switchToTab("image");
          G.forms[1].loadAudioFile(f);
          G.showToast("Switched to Image + Audio (audio loaded)");
          return;
        }
        if (WAAS.isImageFile(f)) {
          if (WAAS.isAnimationFile(f)) {
            try {
              const g = await WAAS.probeAnimation(f);
              if (g.animated) {
                G.switchToTab("mix");
                G.forms[2].loadVisualFile(f);
                G.showToast("Detected animated image — switched to Video / GIF + Audio");
                return;
              }
            } catch (e) {}
          }
          G.switchToTab("image");
          G.forms[1].loadImageFile(f);
          G.showToast("Detected image — switched to Image + Audio");
          return;
        }

        trimmer.stop();
        fmt.reset();
        form.create.clear();
        silentBanner.style.display = "none";
        s.noAudio = false;
        picker.setLoading(f.name);
        await run("video", async () => {
          try {
            const meta = await WAAS.probeVideo(f);
            s.file = f;
            trimmer.load(f, meta);
            trimmer.setFramePreview(fmt.mode, fmt.corner);
            picker.setLoaded(f.name, `${fmtT(meta.duration)} · ${meta.width}×${meta.height} · ${fmtB(f.size)}`);
            log("info", "ui:video-loaded", { name: f.name, type: f.type, bytes: f.size, ...meta });

            // Probe waveform & detect silent videos asynchronously without blocking video loading.
            WAAS.probeAudio(f)
              .then((a) => {
                if (s.file !== f) return;
                trimmer.setWaveform(a.peaks, a.peakMax);
                if (!a.hasAudio) {
                  s.noAudio = true;
                  silentMsg.textContent =
                    "This video has no audio track (or is silent). Want to pair it with custom audio instead?";
                  silentBanner.style.display = "";
                }
              })
              .catch(() => {
                if (s.file !== f) return;
                // Could be a silent video or an exotic container (MKV/MOV) that uses our MediaRecorder fallback
                silentMsg.textContent =
                  "Could not preview audio waveform (video may have no sound, or uses an uncommon audio codec that will use fallback extraction).";
                silentBanner.style.display = "";
              });
          } catch (e) {
            log("error", "ui:video-error", e);
            s.file = null;
            trimmer.clear();
            picker.setError("Could not read video: " + e.message);
          }
        });
        changed();
      };

      const picker = makeDropPicker({
        title: "Drop a video here, or click to browse",
        subtitle: "MP4, MOV, WebM, MKV — or drop an image/GIF and we'll switch tabs automatically",
        accept: "video/*,.mp4,.mov,.webm,.mkv,image/*,audio/*",
        icon: "video",
        onFile: loadFile,
        onClear: () => {
          setXMsg("");
          s.file = null;
          s.noAudio = false;
          silentBanner.style.display = "none";
          trimmer.clear();
          fmt.reset();
          form.create.clear();
          changed();
        },
      });

      // Load a video straight from an X (Twitter) post link (downloaded by the extension, see src/xlink.js).
      const xInput = h("input", {
        type: "text",
        class: "grow",
        placeholder: "…or paste an X (Twitter) post link",
        "aria-label": "X (Twitter) post link",
        spellcheck: false,
        autocomplete: "off",
        style: "min-width:0",
      });
      const xBtn = h("button", { class: "sec", textContent: "Load from X" });
      const xRow = h("div", { class: "row tight", style: "margin-top:8px" }, xInput, xBtn);
      const xMsg = h("div", { class: "status", style: "margin-top:2px;display:none" });
      const setXMsg = (text, isErr) => {
        xMsg.textContent = text || "";
        xMsg.style.display = text ? "" : "none";
        xMsg.className = isErr ? "status err" : "status";
      };
      let xLoading = false;
      const setXLoading = (on) => {
        xLoading = on;
        xInput.disabled = on;
        xBtn.textContent = on ? "Cancel" : "Load from X";
        // The section is greyed out (pointer-events: none) while busy; keep Cancel clickable.
        xBtn.style.pointerEvents = on ? "auto" : "";
      };
      const loadXLink = async (raw) => {
        const url = String(raw != null ? raw : xInput.value).trim();
        if (!url || xLoading || G.busy) return;
        xInput.value = url;
        if (!WAAS.isXLink(url)) {
          setXMsg("That doesn't look like an X post link. It should look like x.com/name/status/123…", true);
          return;
        }
        setXLoading(true);
        setXMsg("Finding the video on X and downloading it…");
        let res;
        try {
          res = await run("x-import", (signal) => WAAS.importXLink(url, { signal }));
        } catch (e) {
          setXMsg(e && e.name === "AbortError" ? "Canceled." : String((e && e.message) || e), true);
          return;
        } finally {
          setXLoading(false);
        }
        await loadFile(res.file);
        if (s.file === res.file) {
          const who = res.author ? "@" + res.author : "X";
          const gif = res.video && res.video.kind === "gif";
          setXMsg(`Loaded from ${who} on X${gif ? " (a GIF, so it has no sound of its own)" : ""}.`);
        }
      };
      xBtn.addEventListener("click", () => {
        if (xLoading) {
          if (G.abort) G.abort.abort();
        } else {
          loadXLink();
        }
      });
      xInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          loadXLink();
        }
      });
      // Pasting a link into the box loads it right away.
      xInput.addEventListener("paste", () =>
        setTimeout(() => {
          if (WAAS.isXLink(xInput.value)) loadXLink();
        }, 0)
      );

      trimmer.onChange(changed);
      const form = makeForm({
        id: "video",
        title: "Video + Sound",
        icon: "video",
        desc: "Clip any video with its built-in audio into an animated WhatsApp audio sticker.",
        sources: [
          { title: "Select Video", body: [picker.el, xRow, xMsg, silentBanner], ready: () => !!s.file },
          { title: "Trim Clip", body: [trimEmpty, trimWrap], ready: () => trimmer.loaded, enabled: () => trimmer.loaded },
        ],
        fmt,
        getBase: () => baseName(s.file),
        stop: () => trimmer.stop(),
        getTrimmer: () => trimmer,
      });
      form.loadVideoFile = loadFile;
      form.loadXLink = loadXLink;
      return form;
    }

    // ============================================================ Tab 2: Image + Audio
    function imageForm() {
      const s = { file: null, url: null };
      const thumbImg = h("img", { alt: "Selected image preview" });
      const thumbStage = h("div", { class: "thumb-stage", style: "display:none;margin-top:8px" }, thumbImg);
      const animBanner = h(
        "div",
        { class: "banner", style: "display:none" },
        h("span", null, "This is an animated image. Here only the first frame is used — want to keep it animated?"),
        h("button", {
          class: "act",
          style: "padding:5px 11px;font-size:12px",
          textContent: "Use in Video / GIF + Audio",
          onclick: () => {
            if (!s.file) return;
            const fileToMove = s.file;
            G.switchToTab("mix");
            G.forms[2].loadVisualFile(fileToMove);
            G.showToast("Moved animation to Video / GIF + Audio");
          },
        })
      );

      const updateThumbStyle = (m, c) => {
        thumbStage.className = "thumb-stage" + (m === "crop" ? " crop" : "") + (c !== "square" ? " " + c : "");
      };

      const changed = () => form.refresh();
      const audio = makeAudioSource(changed);
      const fmt = makeFormat({
        grid: false,
        sync: false,
        still: true,
        defaultFade: true,
        onFrameStyle: updateThumbStyle,
        getParams: () =>
          s.file && audio.ready ? { visual: { kind: "image", file: s.file }, audio: audio.params, fit: "loop" } : null,
      });

      const loadImageFile = async (f) => {
        if (WAAS.isVideoFile(f)) {
          G.switchToTab("video");
          G.forms[0].loadVideoFile(f);
          G.showToast("Detected video — switched to Video + Sound");
          return;
        }
        if (WAAS.isAudioFile(f)) {
          audio.loadFile(f);
          return;
        }
        form.create.clear();
        animBanner.style.display = "none";
        picker.setLoading(f.name);
        await run("image", async () => {
          try {
            const meta = await WAAS.probeImage(f);
            s.file = f;
            if (s.url) URL.revokeObjectURL(s.url);
            s.url = URL.createObjectURL(f);
            thumbImg.src = s.url;
            thumbStage.style.display = "";
            updateThumbStyle(fmt.mode, fmt.corner);
            animBanner.style.display = meta.animated ? "" : "none";
            picker.setLoaded(f.name, `${meta.width}×${meta.height} · ${fmtB(f.size)}`);
            log("info", "ui:image-loaded", { name: f.name, type: f.type, bytes: f.size, ...meta });
          } catch (e) {
            log("error", "ui:image-error", e);
            s.file = null;
            thumbStage.style.display = "none";
            animBanner.style.display = "none";
            picker.setError("Could not read image: " + e.message);
          }
        });
        changed();
      };

      const picker = makeDropPicker({
        title: "Drop an image here, click to browse, or press Ctrl+V to paste",
        subtitle: "JPG, PNG, WebP, AVIF — static photo, artwork, or meme",
        accept: "image/*,.jpg,.jpeg,.png,.webp,.avif,.bmp",
        icon: "image",
        onFile: loadImageFile,
        onClear: () => {
          s.file = null;
          if (s.url) {
            URL.revokeObjectURL(s.url);
            s.url = null;
          }
          thumbStage.style.display = "none";
          animBanner.style.display = "none";
          form.create.clear();
          changed();
        },
      });

      const form = makeForm({
        id: "image",
        title: "Image + Audio",
        icon: "image",
        desc: "Pair any static image with a custom audio clip. The sticker lasts as long as the audio.",
        sources: [
          { title: "Select Image", body: [picker.el, thumbStage, animBanner], ready: () => !!s.file },
          { title: "Select & Trim Audio", body: audio.els, ready: () => audio.ready },
        ],
        fmt,
        getBase: () => baseName(s.file),
        stop: () => audio.trimmer.stop(),
        getTrimmer: () => audio.trimmer,
      });
      form.loadImageFile = loadImageFile;
      form.loadAudioFile = (f) => audio.loadFile(f);
      return form;
    }

    // ============================================================ Tab 3: Video / GIF + Audio
    function mixForm() {
      const s = { file: null, kind: null, gif: null, url: null };
      const vTrim = makeTrimmer("video", "Trim the visual animation clip. Original video audio is muted here.");
      vTrim.setMuted(true);
      const vWrap = h("div", { style: "display:none;margin-top:8px" }, vTrim.el);
      const gifImg = h("img", { alt: "Animated preview" });
      const gifStage = h("div", { class: "thumb-stage", style: "display:none;margin-top:8px" }, gifImg);

      const changed = () => {
        updateSummary();
        form.refresh();
      };
      const audio = makeAudioSource(changed);

      const FIT_KEY = "waas-fit-mode";
      const fitSel = h(
        "select",
        null,
        h("option", { value: "independent", textContent: "Keep original lengths (independent)" }),
        h("option", { value: "loop", textContent: "Loop visual until audio ends" }),
        h("option", { value: "freeze", textContent: "Freeze last frame until audio ends" }),
        h("option", { value: "stretch", textContent: "Match visual speed to audio length" })
      );
      fitSel.value = store.get(FIT_KEY, "independent");
      fitSel.addEventListener("change", () => {
        store.set(FIT_KEY, fitSel.value);
        changed();
      });

      const summary = h("div", { class: "summary-box" });
      const fitRow = h("div", { class: "row", style: "margin-bottom:8px" }, h("span", { class: "opt-lbl" }, "When durations differ"), fitSel);
      const testBtn = h("button", { class: "sec sm", textContent: "▶ Preview Together" });
      const vDur = () => (s.kind === "gif" ? s.gif.duration : vTrim.len);

      function updateSummary() {
        summary.textContent = "";
        if (!s.file || !audio.ready) {
          summary.append("Select both an animation and an audio clip to preview timing.");
          fitRow.style.display = "none";
          return;
        }
        const v = vDur();
        const a = audio.params.dur;
        const same = Math.abs(v - a) < 0.05;
        fitRow.style.display = same ? "none" : "";
        if (same) {
          summary.append(`Animation and audio have matching lengths (${fmtT(a)}).`);
          return;
        }
        const fit = fitSel.value;
        let txt = `Visual ${fmtT(v)} · Audio ${fmtT(a)} — `;
        if (fit === "independent") {
          txt += "Both play from the start and finish independently. Changing audio will not require re-analyzing the video.";
        } else if (fit === "stretch") {
          const factor = (v / a).toFixed(2);
          txt += `Visual speed adjusts to ${factor}× so animation and audio end together at ${fmtT(a)}.`;
        } else if (v > a) {
          txt += `Visual is longer and will be trimmed to ${fmtT(a)}.`;
        } else if (fit === "loop") {
          txt += `Visual loops ${(a / v).toFixed(1)}× to fill ${fmtT(a)}.`;
        } else {
          txt += `Visual pauses on its last frame at ${fmtT(v)} until audio ends at ${fmtT(a)}.`;
        }
        summary.append(txt);
      }

      testBtn.addEventListener("click", () => {
        if (!s.file || !audio.ready) return;
        const a = audio.params;
        if (s.kind === "gif") {
          const u = gifImg.src;
          gifImg.src = "";
          gifImg.src = u;
        } else {
          vTrim.play(vTrim.start, vTrim.end, true);
        }
        audio.trimmer.play(a.start, a.start + a.dur, false);
      });

      const updateVisualStyle = (m, c) => {
        vTrim.setFramePreview(m, c);
        gifStage.className = "thumb-stage" + (m === "crop" ? " crop" : "") + (c !== "square" ? " " + c : "");
      };

      const fmt = makeFormat({
        defaultFade: true,
        onFrameStyle: updateVisualStyle,
        extras: [
          summary,
          fitRow,
          h("div", { class: "row tight", style: "margin-bottom:10px" }, testBtn, h("span", { class: "muted" }, "Plays visual + custom audio together once.")),
        ],
        getParams: () => {
          if (!s.file || !audio.ready) return null;
          const visual =
            s.kind === "gif"
              ? { kind: "gif", file: s.file, start: 0, dur: s.gif.duration }
              : { kind: "video", file: s.file, start: vTrim.start, dur: vTrim.len };
          return { visual, audio: audio.params, fit: fitSel.value };
        },
      });

      const loadVisualFile = async (f) => {
        if (WAAS.isAudioFile(f)) {
          audio.loadFile(f);
          return;
        }
        vTrim.stop();
        fmt.reset();
        form.create.clear();
        picker.setLoading(f.name);
        await run("animation", async () => {
          try {
            if (s.url) {
              URL.revokeObjectURL(s.url);
              s.url = null;
            }
            if (WAAS.isAnimationFile(f) || (f.type || "").startsWith("image/")) {
              const g = await WAAS.probeAnimation(f);
              if (!g.animated) {
                G.switchToTab("image");
                G.forms[1].loadImageFile(f);
                G.showToast("Static image detected — switched to Image + Audio");
                return;
              }
              s.file = f;
              s.kind = "gif";
              s.gif = g;
              s.url = URL.createObjectURL(f);
              gifImg.src = s.url;
              gifStage.style.display = "";
              vWrap.style.display = "none";
              vTrim.clear();
              updateVisualStyle(fmt.mode, fmt.corner);
              picker.setLoaded(f.name, `${fmtT(g.duration)} · ${g.frames} frames · ${g.width}×${g.height} · ${fmtB(f.size)}`);
              log("info", "ui:gif-loaded", {
                name: f.name,
                type: f.type,
                bytes: f.size,
                frames: g.frames,
                duration: g.duration,
                width: g.width,
                height: g.height,
              });
            } else {
              const meta = await WAAS.probeVideo(f);
              s.file = f;
              s.kind = "video";
              s.gif = null;
              vTrim.load(f, meta);
              vWrap.style.display = "";
              gifStage.style.display = "none";
              updateVisualStyle(fmt.mode, fmt.corner);
              picker.setLoaded(f.name, `${fmtT(meta.duration)} · ${meta.width}×${meta.height} · ${fmtB(f.size)}`);
              log("info", "ui:mix-video-loaded", { name: f.name, type: f.type, bytes: f.size, ...meta });
            }
          } catch (e) {
            log("error", "ui:animation-error", e);
            s.file = null;
            s.kind = null;
            s.gif = null;
            vTrim.clear();
            vWrap.style.display = "none";
            gifStage.style.display = "none";
            picker.setError("Could not read file: " + e.message);
          }
        });
        changed();
      };

      const picker = makeDropPicker({
        title: "Drop a video, GIF, animated WebP, or APNG here",
        subtitle: "Original video sound is ignored so you can pair your own audio below",
        accept: "video/*,image/gif,image/webp,image/apng,.gif,.webp,.apng,.mp4,.mov,.webm,.mkv",
        icon: "video",
        onFile: loadVisualFile,
        onClear: () => {
          s.file = null;
          s.kind = null;
          s.gif = null;
          if (s.url) {
            URL.revokeObjectURL(s.url);
            s.url = null;
          }
          vTrim.clear();
          vWrap.style.display = "none";
          gifStage.style.display = "none";
          fmt.reset();
          form.create.clear();
          changed();
        },
      });

      let activeTrimmer = null;
      vTrim.onChange(() => {
        activeTrimmer = vTrim;
        changed();
      });
      audio.trimmer.onChange(() => {
        activeTrimmer = audio.trimmer;
      });
      updateSummary();

      const form = makeForm({
        id: "mix",
        title: "Video / GIF + Audio",
        icon: "mix",
        desc: "Combine any muted video or animated GIF/WebP with a custom sound clip.",
        sources: [
          { title: "Select Animation (Video or GIF)", body: [picker.el, vWrap, gifStage], ready: () => !!s.file },
          { title: "Select & Trim Audio", body: audio.els, ready: () => audio.ready },
        ],
        fmt,
        getBase: () => baseName(s.file),
        stop: () => {
          vTrim.stop();
          audio.trimmer.stop();
        },
        getTrimmer: () => (activeTrimmer && activeTrimmer.loaded ? activeTrimmer : audio.ready ? audio.trimmer : s.kind === "video" ? vTrim : null),
      });
      form.loadVisualFile = loadVisualFile;
      form.loadAudioFile = (f) => audio.loadFile(f);
      return form;
    }

    // ============================================================ Panel Shell
    G.forms = [videoForm(), imageForm(), mixForm()];

    const TAB_KEY = "waas-active-tab";
    const savedTab = store.get(TAB_KEY, "video");
    G.active = Math.max(
      0,
      G.forms.findIndex((f) => f.id === savedTab)
    );

    const tabBtns = G.forms.map((f, i) =>
      h("button", { onclick: () => selectTab(i) }, ICONS[f.icon](15), h("span", null, f.title))
    );

    function selectTab(i) {
      if (G.busy || i < 0 || i >= G.forms.length) return;
      G.active = i;
      store.set(TAB_KEY, G.forms[i].id);
      G.forms.forEach((f, j) => f.show(j === i));
      G.refreshTabs();
      G.forms[i].refresh();
      log("info", "ui:tab", { tab: G.forms[i].id });
    }
    G.switchToTab = (id) => {
      const idx = G.forms.findIndex((f) => f.id === id);
      if (idx >= 0) selectTab(idx);
    };
    G.refreshTabs = () =>
      tabBtns.forEach((b, i) => {
        b.classList.toggle("on", i === G.active);
        b.disabled = G.busy && i !== G.active;
      });

    // Connection badge
    const connText = h("span", null, "Connecting…");
    const retryBtn = h("button", {
      class: "sec sm",
      style: "display:none;padding:2px 7px;font-size:11px",
      textContent: "Retry",
      onclick: () => {
        if (WAAS.retryConnect) WAAS.retryConnect();
      },
    });
    const connBadge = h("span", { class: "conn loading" }, h("span", { class: "dot" }), connText, retryBtn);

    const updateWAStatus = (state) => {
      connBadge.className = "conn " + state;
      if (state === "ready") {
        connText.textContent = "WhatsApp Ready";
        retryBtn.style.display = "none";
      } else if (state === "loading") {
        connText.textContent = "Connecting to WhatsApp…";
        retryBtn.style.display = "none";
      } else {
        connText.textContent = "Offline / Preview Mode";
        retryBtn.style.display = "";
      }
      G.forms.forEach((f) => f.create.refreshChatTarget());
    };
    updateWAStatus(WAAS.waState || "loading");
    if (WAAS.onState) WAAS.onState(updateWAStatus);

    // Theme mode: "auto" | "dark" | "light"
    const THEME_KEY = "waas-theme";
    let themeMode = store.get(THEME_KEY, "auto");
    const themeBtn = h("button", { class: "icon-btn", title: "Theme: Auto" }, ICONS.theme(16));
    const applyTheme = () => {
      const dark = themeMode === "dark" ? true : themeMode === "light" ? false : detectDark();
      panel.classList.toggle("dark", dark);
      themeBtn.title = `Theme: ${themeMode[0].toUpperCase() + themeMode.slice(1)} (click to switch)`;
    };
    themeBtn.addEventListener("click", () => {
      themeMode = themeMode === "auto" ? "dark" : themeMode === "dark" ? "light" : "auto";
      store.set(THEME_KEY, themeMode);
      applyTheme();
      G.showToast(`Theme set to ${themeMode[0].toUpperCase() + themeMode.slice(1)}`);
    });

    // Toast notification
    const toastMsg = h("span");
    const toast = h("div", { class: "toast" }, toastMsg);
    G.showToast = (msg) => {
      toastMsg.textContent = msg;
      toast.classList.add("show");
      clearTimeout(G.toastTimer);
      G.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
    };

    // Diagnostics & Log drawer
    const logBox = h("div", { class: "logbox" });
    const tools = h(
      "details",
      { style: "margin-top:6px" },
      h("summary", null, "Diagnostics & Activity Log"),
      h(
        "div",
        { class: "row" },
        h("button", {
          class: "sec sm",
          textContent: "Enable WA Playback",
          onclick: () => {
            const ok = WAAS.wa && WAAS.wa.forceSoundStickers();
            G.showToast(ok ? "WhatsApp sound sticker playback enabled!" : "WhatsApp Web not ready yet");
          },
        }),
        h("button", {
          class: "sec sm",
          textContent: "Run Diagnostics",
          onclick: () => WAAS.wa.diagnose().then(() => G.showToast("Diagnostics logged")).catch((e) => log("error", "diagnostics:error", e)),
        }),
        h("button", {
          class: "sec sm",
          textContent: "Save Log (.json)",
          onclick: () => saveLog().catch((e) => log("error", "log:error", e)),
        }),
        h("button", {
          class: "sec sm",
          textContent: "Open Full Log Viewer",
          onclick: () => window.postMessage({ __waas: "openLog" }, location.origin),
        }),
        h("button", {
          class: "sec sm",
          textContent: "Clear Log",
          onclick: () => {
            if (WAAS.clearStoredLog) WAAS.clearStoredLog();
            logBox.textContent = "";
            G.showToast("Diagnostic log cleared");
          },
        })
      ),
      logBox
    );

    const closeBtn = h("button", { class: "icon-btn close-btn", title: "Close (Esc)", textContent: "×" });
    const panel = h(
      "div",
      { class: "panel", role: "dialog", "aria-label": "4x4Tools-Wa-Audio-Stickers" },
      h(
        "div",
        { class: "hdr" },
        h(
          "div",
          { class: "brand" },
          h("div", { class: "brand-logo" }, ICONS.logo()),
          h(
            "div",
            { class: "brand-text" },
            h(
              "div",
              { class: "brand-title" },
              h("span", { class: "brand-tag" }, "4x4Tools"),
              h("h2", null, "Wa-Audio-Stickers"),
              h("span", { class: "ver" }, "v" + WAAS.VERSION)
            ),
            h("div", { class: "subline" }, connBadge, h("span", null, "· 100% local processing · max 1 MB"))
          )
        ),
        h("div", { class: "hdr-actions" }, themeBtn, closeBtn)
      ),
      h("div", { class: "tabs-wrap" }, h("nav", { class: "tabs", role: "tablist" }, tabBtns)),
      toast,
      h("div", { class: "content" }, ...G.forms.map((f) => f.el), tools)
    );

    const overlay = h("div", { class: "overlay", style: "display:none" }, panel);
    root.append(overlay);

    const showEntry = (e) => {
      logBox.append(
        h(
          "div",
          { class: e.level === "error" ? "e" : e.level === "warn" ? "w" : "" },
          e.ts.slice(11, 19) + " " + e.event + (e.data != null ? " " + JSON.stringify(e.data).slice(0, 240) : "")
        )
      );
      while (logBox.childNodes.length > 200) logBox.firstChild.remove();
      logBox.scrollTop = logBox.scrollHeight;
    };
    (WAAS.entries || []).slice(-30).forEach(showEntry);
    if (WAAS.onLog) WAAS.onLog(showEntry);

    const isOpen = () => overlay.style.display !== "none";
    const open = () => {
      applyTheme();
      overlay.style.display = "";
      G.forms[G.active].show(true);
      G.forms[G.active].refresh();
      log("info", "ui:open", null);
    };
    function close(force) {
      if (G.busy && force !== true) return;
      G.forms.forEach((f) => f.stop());
      overlay.style.display = "none";
    }
    const toggle = () => (isOpen() ? close() : open());

    window.addEventListener("message", (ev) => {
      if (ev.source === window && ev.data && ev.data.__waas === "togglePanel") toggle();
    });

    // Keyboard shortcuts while panel is open
    window.addEventListener("keydown", (ev) => {
      if (!isOpen()) return;
      const activeEl = root.activeElement || document.activeElement;
      const tag = activeEl && activeEl.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (activeEl && activeEl.isContentEditable);

      if (ev.key === "Escape") {
        if (!G.busy) {
          ev.preventDefault();
          close();
        }
        return;
      }
      if (inField || G.busy) return;
      const trimmer = G.forms[G.active].getTrimmer();
      if (!trimmer || !trimmer.loaded) return;

      if (ev.code === "Space") {
        ev.preventDefault();
        trimmer.toggleSelection();
      } else if (ev.key === "i" || ev.key === "I") {
        ev.preventDefault();
        trimmer.setStart(trimmer.playhead);
      } else if (ev.key === "o" || ev.key === "O") {
        ev.preventDefault();
        trimmer.setEnd(trimmer.playhead);
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        trimmer.nudgePlayhead(ev.shiftKey ? -0.5 : -FRAME);
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        trimmer.nudgePlayhead(ev.shiftKey ? 0.5 : FRAME);
      }
    });

    // Clipboard paste support (e.g. Ctrl+V a copied image or screenshot directly into the studio!)
    window.addEventListener("paste", (ev) => {
      if (!isOpen() || G.busy) return;
      const activeEl = root.activeElement || document.activeElement;
      const tag = activeEl && activeEl.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // A copied X (Twitter) post link loads its video into Video + Sound.
      const text = ev.clipboardData && ev.clipboardData.getData ? ev.clipboardData.getData("text/plain") : "";
      if (text && WAAS.isXLink && WAAS.isXLink(text)) {
        ev.preventDefault();
        G.switchToTab("video");
        G.forms[0].loadXLink(text.trim());
        return;
      }
      const items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f && WAAS.isImageFile(f)) {
            ev.preventDefault();
            G.switchToTab("image");
            G.forms[1].loadImageFile(f);
            G.showToast("Pasted image from clipboard!");
            return;
          }
        }
      }
    });

    WAAS.togglePanel = toggle;
    WAAS.openPanel = open;
    WAAS.closePanel = close;
    closeBtn.addEventListener("click", () => close());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    applyTheme();
    selectTab(G.active);
    log("info", "ui:mounted", null);
    window.postMessage({ __waas: "uiReady" }, location.origin);
  }

  WAAS.mountUI = mount;
})();
