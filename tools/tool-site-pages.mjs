// Writes the pages of the PDF and Kanban floors from lib/tool-sites.js (one row per page): the leader's page and the page built for each site of its lane.
//   node tools/tool-site-pages.mjs          write every page
//   node tools/tool-site-pages.mjs --check  exit 1 when a page differs from what its row makes (the head's seo block, asks row and modulepreload block belong to
//                                           tools/seo-pages.mjs and tools/preload.mjs and are left as they are)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDF_SITES, KANBAN_SITES, FLIGHT_SITES, JOB_SITES, LEARN_SITES } from '../void-live-deploy/lib/tool-sites.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** the share picture's name: /pdf/merge/ -> pdf-merge */
export const slug = (path) => path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
const CSS = `
  :root { color-scheme: light dark; --bg: #f7f6fb; --ink: #15131c; --soft: #625f70; --line: #d9d6e4; --accent: #6d4aff; --bad: #b42318; --ok: #1a7f4b; --card: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b0a10; --ink: #ecebf5; --soft: #a3a0b3; --line: #2c2938; --accent: #a58bff; --bad: #ff8a7e; --ok: #5fd39a; --card: #16141f; } }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: __MAX__; margin: 0 auto; padding: 18px 16px 40px; }
  h1 { font-size: 22px; margin: 0 0 6px; font-weight: 700; } h2 { font-size: 17px; margin: 10px 0 2px; } h3 { margin: 0; font-size: 14px; }
  .intro, .note { color: var(--soft); font-size: 14px; margin: 4px 0 10px; } .note { font-size: 13px; margin: 2px 0; }
  button, select, input, textarea { font: inherit; color: inherit; } button { border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; min-height: 40px; background: transparent; cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; } button:focus-visible, .card:focus-visible, .thumb:focus-visible, .drop:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  input[type=text], input[type=number], input[type=search], input[type=date], select, textarea { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; min-height: 40px; max-width: 100%; }
  textarea { width: 100%; } .go { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; } @media (prefers-color-scheme: dark) { .go { color: #0b0a10; } }
  footer { font-size: 12px; color: var(--soft); margin-top: 22px; text-align: center; } footer a { color: inherit; }
  #app { min-height: __APPMIN__; } #related { min-height: 190px; } .share { font-size: 14px; } .also { border-top: 1px solid var(--line); margin-top: 14px; padding-top: 6px; }
  input[type=checkbox] { width: 24px; height: 24px; accent-color: var(--accent); }
  .live, .status { min-height: 1.4em; font-size: 14px; margin: 6px 0; } .bad { color: var(--bad); }
  .sr { position: absolute; left: -9999px; }`;
const PDFCSS = `
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; } .tabs button[aria-selected=true] { background: var(--accent); color: #fff; border-color: var(--accent); } @media (prefers-color-scheme: dark) { .tabs button[aria-selected=true] { color: #0b0a10; } }
  .panel { border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: var(--card); }
  .drop { border: 2px dashed var(--line); border-radius: 12px; padding: 22px 12px; text-align: center; cursor: pointer; } .drop.over { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .pick { position: absolute; left: -9999px; opacity: 0; pointer-events: none; } .files { list-style: none; padding: 0; margin: 8px 0; } .files li { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); } .fname { font-weight: 600; word-break: break-all; } .files button { min-width: 40px; padding: 4px 10px; } .pg { width: 9em; }
  .field { display: flex; flex-direction: column; gap: 3px; margin: 10px 0; font-size: 14px; } .field.row { flex-direction: row; align-items: center; gap: 8px; } .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; } .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
  .results .result { margin: 6px 0; } .dl { display: inline-block; padding: 8px 16px; border-radius: 999px; background: var(--accent); color: #fff; font-weight: 600; text-decoration: none; min-height: 40px; line-height: 24px; } @media (prefers-color-scheme: dark) { .dl { color: #0b0a10; } }
  .thumbs { list-style: none; padding: 0; margin: 10px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; } .thumb { border: 1px solid var(--line); border-radius: 10px; padding: 6px; background: var(--bg); text-align: center; } .thumb.dragging { opacity: .4; } .thumb.over { outline: 3px dashed var(--accent); }
  .thumb .cv { display: flex; align-items: center; justify-content: center; min-height: 130px; overflow: hidden; } .thumb canvas { max-width: 100%; max-height: 130px; transition: transform .15s; box-shadow: 0 1px 4px #0003; background: #fff; } .cap { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; align-items: center; margin-top: 4px; } .cap button { min-width: 40px; min-height: 40px; padding: 2px 6px; }`;
const FLCSS = `
  main #app { min-height: 80vh; } .notice { background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; font-size: 14px; margin: 8px 0 12px; }
  .panel { border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: var(--card); margin: 12px 0; } h3 { margin: 12px 0 4px; font-size: 15px; }
  .field { display: flex; flex-direction: column; gap: 3px; margin: 8px 0; font-size: 14px; position: relative; min-width: 0; } .field input, .field select { width: 100%; } .field label { color: var(--soft); font-size: 13px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; } .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; } .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; } .chk { display: flex; gap: 8px; align-items: center; min-height: 40px; } .chk input { min-height: 0; width: 24px; height: 24px; margin: 0; flex: 0 0 auto; }
  .sug { position: absolute; top: 100%; left: 0; width: max(100%, min(300px, 90vw)); z-index: 6; list-style: none; margin: 2px 0 0; padding: 4px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 6px 20px #0003; max-height: 320px; overflow: auto; } .grid2 > .apk:nth-child(2) .sug { left: auto; right: 0; } .sug li { margin: 0; } .sug button { width: 100%; text-align: left; border: 0; border-radius: 8px; padding: 6px 10px; min-height: 44px; } .sug button:hover, .sug button:focus-visible { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .soft { color: var(--soft); font-size: 13px; } .swap { align-self: flex-start; min-width: 44px; } [hidden] { display: none !important; } .btn { display: inline-block; padding: 8px 16px; border: 1px solid var(--line); border-radius: 999px; text-decoration: none; color: inherit; min-height: 24px; line-height: 24px; background: var(--card); cursor: pointer; } a.btn:hover { border-color: var(--accent); }
  .plist, .plain, .alist { list-style: none; padding: 0; margin: 6px 0; } .plist li { margin: 6px 0; } .alist li { margin: 2px 0; } .alist a, .dl a, .plist a { display: inline-block; padding: 5px 0; min-height: 24px; } .alist button { width: 100%; text-align: left; border-radius: 10px; min-height: 44px; } .plain li { padding: 4px 0; border-bottom: 1px solid var(--line); }
  .dl { margin: 8px 0; } .dl > div { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 5px 0; border-bottom: 1px solid var(--line); } .dl dt { color: var(--soft); flex: 0 0 11em; font-size: 14px; } .dl dd { margin: 0; flex: 1 1 14em; min-width: 0; overflow-wrap: anywhere; }
  .big { font-size: 40px; font-weight: 700; margin: 8px 0 2px; font-variant-numeric: tabular-nums; } .big small { font-size: 16px; font-weight: 500; color: var(--soft); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; } .chip { min-height: 36px; padding: 2px 12px; font-size: 14px; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 14px; } .tbl th, .tbl td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; } .tablewrap { overflow-x: auto; }
  .chart svg, .map svg { width: 100%; height: auto; display: block; color: var(--accent); } .map { margin: 10px 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
  .seg { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; margin: 8px 0; } .warn { color: #b45309; font-size: 13px; margin: 2px 0; } @media (prefers-color-scheme: dark) { .warn { color: #fbbf24; } } .gap { list-style: none; color: var(--soft); font-size: 14px; } .leg { margin: 8px 0; } .stay { color: var(--soft); margin: 4px 0; } .ok { color: var(--ok); } .card { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin: 10px 0; }
  .pick { position: absolute; left: -9999px; } input[type=range] { width: 100%; min-height: 40px; accent-color: var(--accent); } output { font-weight: 600; }
  @media print { button, .sug, footer, .tk-row, .tk-ask, #related, .notice, #controls, #fl-err, .field:has(#i-paste), #i-help, #a-help, .grid3:has(#w-h), input[type=range], .chk, .pick, label.btn { display: none !important; } body { background: #fff; color: #000; } #app { min-height: 0 !important; } main { max-width: none; padding: 0; } .panel { border: 0; padding: 0; margin: 0 0 12px; break-inside: auto; } .seg { break-inside: avoid; } .seg input { border: 0; padding: 0; min-height: 0; } .alist li, .plain li, .dl > div { break-inside: avoid; } a { color: #000; text-decoration: none; } .soft { color: #333; } }`;
const LRCSS = `
  :root { --c1: #ffd9d6; --c2: #ffe8c7; --c3: #fff5bf; --c4: #dff3d2; --c5: #d2efe9; --c6: #d6e6ff; --c7: #e4dcff; --c8: #f6d9f0; --c9: #e8e6ef; --c10: #d9f0ff; }
  @media (prefers-color-scheme: dark) { :root { --c1: #4a1f1c; --c2: #4a3216; --c3: #433c12; --c4: #24401c; --c5: #173f38; --c6: #1d2f52; --c7: #33275a; --c8: #4a1f42; --c9: #2d2b36; --c10: #163a4f; } }
  .panel { border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: var(--card); margin: 12px 0; } .panel h2 { margin: 0 0 6px; } h3 { margin: 14px 0 4px; font-size: 15px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; } .soft { color: var(--soft); font-size: 14px; } [hidden] { display: none !important; }
  .primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; } @media (prefers-color-scheme: dark) { .primary { color: #0b0a10; } }
  .btn { display: inline-flex; align-items: center; padding: 6px 14px; border: 1px solid var(--line); border-radius: 999px; min-height: 40px; cursor: pointer; } .pick { position: absolute; left: -9999px; }
  .big { font-size: 28px; font-weight: 700; margin: 8px 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; } .q { min-height: 1.4em; }
  .fb { min-height: 1.5em; font-weight: 600; margin: 6px 0; } .fb.ok, .ok { color: var(--ok); } .fb.bad { color: var(--bad); }
  .steps { margin: 6px 0; padding-left: 22px; } .steps li { margin: 4px 0; } .badge { font-size: 13px; border: 1px solid var(--line); border-radius: 999px; padding: 1px 10px; white-space: nowrap; }
  .badge[data-l="2"] { background: var(--c3); } .badge[data-l="3"] { background: var(--c6); } .badge[data-l="4"] { background: var(--c4); font-weight: 700; }
  .meter { height: 10px; border-radius: 99px; background: var(--line); overflow: hidden; margin: 8px 0; } .meter i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .1s linear; } .timer { height: 8px; }
  .skills { list-style: none; padding: 0; margin: 4px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; } .skill { width: 100%; display: flex; justify-content: space-between; gap: 8px; text-align: left; border-radius: 12px; }
  .dl { margin: 8px 0; } .dl > div { display: flex; flex-wrap: wrap; gap: 2px 12px; padding: 4px 0; border-bottom: 1px solid var(--line); } .dl dt { color: var(--soft); flex: 0 0 11em; font-size: 14px; } .dl dd { margin: 0; flex: 1 1 12em; min-width: 0; overflow-wrap: anywhere; }
  .cal { display: grid; grid-template-columns: repeat(14, 1fr); gap: 3px; max-width: 360px; margin: 8px 0; } .cal span { aspect-ratio: 1; border-radius: 3px; background: var(--line); } .cal span.on { background: var(--accent); }
  .sheet, .akey { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 18px; padding: 0; list-style-position: inside; } .sheet li { margin: 6px 0 12px; break-inside: avoid; overflow-wrap: anywhere; } .akey { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); font-size: 14px; color: var(--soft); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } .chip { min-width: 44px; } .chip.on { background: var(--accent); color: #fff; border-color: var(--accent); } @media (prefers-color-scheme: dark) { .chip.on { color: #0b0a10; } }
  .tablewrap { overflow-x: auto; max-width: 100%; } .tgrid { display: grid; grid-template-columns: repeat(13, minmax(26px, 1fr)); gap: 2px; min-width: 360px; font-size: 12px; } .tgrid .hd { text-align: center; font-weight: 700; color: var(--soft); align-self: center; }
  .tgrid .cell { min-height: 26px; min-width: 26px; padding: 0; border-radius: 6px; font-size: 11px; } .tgrid .seen { background: var(--c3); } .tgrid .known { background: var(--c4); font-weight: 700; }
  .ptable { display: grid; grid-template-columns: repeat(18, 40px); grid-template-rows: repeat(7, 46px) 12px repeat(2, 46px); gap: 2px; width: max-content; } .ptable .pt { padding: 0; min-height: 0; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; border-color: transparent; }
  .pt small { font-size: 9px; } .pt b { font-size: 15px; } .pt.on { outline: 3px solid var(--ink); } .ph { font-size: 9px; color: var(--soft); align-self: center; text-align: center; } .ptable .pt[data-c] { color: var(--ink); }
  [data-c=alkali], [data-c=bs] { background: var(--c1); } [data-c=alkaline], [data-c=bp] { background: var(--c2); } [data-c=transition], [data-c=bd] { background: var(--c6); } [data-c=post] { background: var(--c5); } [data-c=metalloid] { background: var(--c3); } [data-c=nonmetal] { background: var(--c4); }
  [data-c=halogen], [data-c=sliquid] { background: var(--c10); } [data-c=noble], [data-c=sgas] { background: var(--c7); } [data-c=lanthanide], [data-c=bf] { background: var(--c8); } [data-c=actinide] { background: var(--c2); } [data-c=ssolid] { background: var(--c9); } [data-c=sunknown] { background: var(--line); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px; font-size: 12px; } .lg { padding: 1px 8px; border-radius: 6px; color: var(--ink); }
  .el-card { display: flex; gap: 12px; align-items: flex-start; min-height: 300px; margin: 8px 0; } .el-card .dl { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; } .el-card .dl > div { flex-direction: column; gap: 0; } .el-card .dl dt { flex: none; font-size: 12px; } .el-card .dl dd { flex: none; } .el-card > div:last-child { flex: 1; min-width: 0; } .el-big { flex: 0 0 82px; height: 92px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--ink); } .el-big b { font-size: 34px; } .el-card h3 { margin: 0; font-size: 20px; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 8px 0; } .choices button { border-radius: 12px; min-height: 48px; text-align: left; } .right { background: var(--c4) !important; } .wrong { background: var(--c1) !important; }
  .plain { list-style: none; padding: 0; margin: 6px 0; max-height: 360px; overflow: auto; } .plain li { display: flex; align-items: center; gap: 6px; padding: 3px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; } .plain .ff { font-weight: 600; } .plain .soft { flex: 1; } .mini { min-width: 40px; }
  .field { display: flex; flex-direction: column; gap: 3px; margin: 6px 0; font-size: 14px; } .field label { color: var(--soft); font-size: 13px; } .study { min-height: 140px; } .front { margin: 6px 0; } .back { font-size: 20px; margin: 6px 0; }
  .match { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; } .match button { border-radius: 10px; min-height: 52px; } .match .sel { outline: 3px solid var(--accent); }
  .typetext { font: 22px/1.6 ui-monospace, Menlo, Consolas, monospace; overflow-wrap: anywhere; background: var(--bg); border-radius: 10px; padding: 8px 10px; min-height: 3.4em; } .typetext .done { color: var(--soft); } .typetext .cur { background: var(--accent); color: #fff; border-radius: 3px; } @media (prefers-color-scheme: dark) { .typetext .cur { color: #0b0a10; } }
  #ty-in { width: 100%; font-size: 18px; } .keys { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; } .krow { display: flex; gap: 4px; } .krow:nth-child(2) { padding-left: 12px; } .krow:nth-child(3) { padding-left: 28px; }
  .key { width: 28px; height: 32px; border-radius: 6px; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-family: ui-monospace, monospace; color: var(--soft); } .key.open { color: var(--ink); } .key[data-s=fast] { background: var(--c4); } .key[data-s=mid] { background: var(--c3); } .key[data-s=slow] { background: var(--c1); }
  .chart svg { width: 100%; max-width: 420px; height: auto; color: var(--accent); display: block; } .frow { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 6px; align-items: center; } .frow input { width: 100%; min-width: 0; } .result { min-height: 150px; }
  a[target=_blank] { display: inline-block; min-height: 24px; line-height: 24px; } .more { display: block; border-radius: 12px; text-decoration: none; color: inherit; height: 100%; } .more b { color: var(--accent); } .cardsprint { display: none; } .cert { text-align: center; }
  @media print { body { background: #fff; color: #000; } button, select, .tk-row, .tk-ask, footer, #related, input, textarea, label.btn { display: none !important; } .tablewrap { overflow: visible; }
    body[data-print] * { visibility: hidden; } body[data-print] .pr, body[data-print] .pr * { visibility: visible; } body[data-print] .pr { position: absolute; left: 0; top: 0; width: 100%; border: 0; }
    .cardsprint.pr { display: grid !important; grid-template-columns: 1fr 1fr; } .pc { border: 1px dashed #999; padding: 18px; min-height: 120px; display: flex; flex-direction: column; justify-content: space-between; break-inside: avoid; } .pc span { color: #444; } }`;
const JBCSS = `
  .notice { background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; font-size: 14px; margin: 8px 0 12px; min-height: 4.6em; }
  .panel { border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: var(--card); margin: 12px 0; } h3 { margin: 12px 0 4px; font-size: 15px; }
  .field { display: flex; flex-direction: column; gap: 3px; margin: 6px 0; font-size: 14px; min-width: 0; } .field input, .field select, .field textarea { width: 100%; } .field label { color: var(--soft); font-size: 13px; display: flex; flex-direction: column; gap: 3px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 4px 10px; } .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 4px 10px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; } .chk { display: flex; gap: 8px; align-items: center; min-height: 40px; color: var(--ink) !important; flex-direction: row !important; } .chks { justify-content: flex-end; }
  input[type=radio] { width: 24px; height: 24px; accent-color: var(--accent); }
  .soft { color: var(--soft); font-size: 13px; } [hidden] { display: none !important; } .btn { display: inline-block; padding: 8px 16px; border: 1px solid var(--line); border-radius: 999px; text-decoration: none; color: inherit; min-height: 40px; line-height: 22px; background: var(--card); cursor: pointer; } a.btn.go { color: #fff; } @media (prefers-color-scheme: dark) { a.btn.go { color: #0b0a10; } }
  .count { font-weight: 600; min-height: 1.5em; margin: 10px 0 4px; } .jobs { list-style: none; padding: 0; margin: 0; min-height: 70vh; } #jb-savedlist { min-height: 0; }
  .job { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin: 8px 0; background: var(--bg); } .job.fresh { border-color: var(--accent); } .jh { display: flex; gap: 10px; align-items: flex-start; } .jt { min-width: 0; }
  .av { flex: 0 0 36px; height: 36px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 20%, transparent); display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .jl { font-weight: 600; color: var(--ink); display: inline-block; min-height: 24px; overflow-wrap: anywhere; } .pay { font-weight: 600; color: var(--ok); margin: 4px 0; } .visa { color: var(--ok); font-size: 13px; } .ex { margin: 6px 0; font-size: 14px; color: var(--soft); overflow-wrap: anywhere; } .new { background: var(--accent); color: #fff; border-radius: 999px; padding: 0 8px; font-size: 12px; } @media (prefers-color-scheme: dark) { .new { color: #0b0a10; } }
  .src a, .plain a, .plist a { display: inline-block; min-height: 24px; padding: 2px 0; } .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } .chip { min-height: 32px; padding: 2px 12px; font-size: 13px; } .chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
  .facet { height: 132px; overflow: auto; align-content: flex-start; } .plain, .plist, .alist, .apps { list-style: none; padding: 0; margin: 6px 0; } .plain li, .plist li { padding: 4px 0; border-bottom: 1px solid var(--line); } .alist li, .apps li { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .counts { font-size: 14px; } .pick { position: absolute; left: -9999px; } details summary { cursor: pointer; min-height: 32px; padding: 4px 0; }
  @media print { button, footer, .tk-row, .tk-ask, #jb-form { display: none !important; } body { background: #fff; color: #000; } }`;
const KBCSS = `
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; } .bname { margin: 0; } .tools button { font-size: 14px; }
  .cols { display: flex; gap: 12px; overflow-x: auto; align-items: flex-start; padding-bottom: 12px; scroll-snap-type: x proximity; } .col { flex: 0 0 min(280px, 82vw); background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px; scroll-snap-align: start; } .col.wipover { border-color: var(--bad); }
  .chead { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; } .chead h3 { flex: 1; font-size: 15px; overflow-wrap: anywhere; } .count { font-size: 13px; color: var(--soft); font-variant-numeric: tabular-nums; } .count.over { color: var(--bad); font-weight: 700; }
  .cmenu { position: relative; } .cmenu summary { list-style: none; cursor: pointer; min-width: 40px; min-height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 999px; } .menu { position: absolute; right: 0; z-index: 5; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 6px; min-width: 200px; box-shadow: 0 6px 24px #0004; } .wipl { display: flex; gap: 8px; align-items: center; font-size: 13px; } .wipl input { width: 5em; }
  .cards { list-style: none; margin: 0; padding: 0; min-height: 44px; display: flex; flex-direction: column; gap: 8px; border-radius: 10px; } .cards.dropping { outline: 3px dashed var(--accent); outline-offset: 2px; }
  .card { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; cursor: pointer; } .card.dragging { opacity: .35; } .ctitle { display: flex; gap: 6px; align-items: flex-start; overflow-wrap: anywhere; } .grip { border: 0; padding: 0; min-height: 28px; min-width: 22px; color: var(--soft); cursor: grab; }
  .dots { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; } .dot { font-size: 11px; padding: 0 8px; border-radius: 999px; min-width: 28px; line-height: 16px; } .badges { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 6px; } .badge { font-size: 12px; color: var(--soft); } .badge.overdue { color: var(--bad); font-weight: 700; } .badge.today, .badge.soon { color: #b45309; } .badge.ok { color: var(--ok); }
  .addcard, .addcolumn { width: 100%; margin-top: 8px; } .addcol { background: transparent; border-style: dashed; } .lanes { display: grid; grid-template-columns: 110px repeat(var(--n), minmax(180px, 1fr)); gap: 8px; overflow-x: auto; } .lane-h { font-weight: 700; font-size: 13px; } .lane-name { font-weight: 600; font-size: 13px; padding-left: 6px; overflow-wrap: anywhere; }
  .dlg { border: 1px solid var(--line); border-radius: 16px; background: var(--card); color: var(--ink); width: min(520px, 94vw); max-height: 90vh; padding: 14px; } .dlg::backdrop { background: #0008; } .f { display: flex; flex-direction: column; gap: 3px; margin: 10px 0; font-size: 14px; } .f > span:first-child { font-weight: 600; color: var(--soft); font-size: 13px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; } .chip { min-height: 32px; padding: 2px 12px; font-size: 13px; opacity: .55; border: 0; } .chip.on { opacity: 1; outline: 2px solid var(--ink); } .checks { list-style: none; padding: 0; margin: 4px 0; } .checks li { display: flex; justify-content: space-between; align-items: center; gap: 6px; } .checks .done { text-decoration: line-through; color: var(--soft); } .checks button { min-width: 40px; }
  .comments { list-style: none; padding: 0; margin: 6px 0; font-size: 14px; } .comments li { padding: 4px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; } .dfoot { justify-content: flex-end; } progress { width: 100%; accent-color: var(--accent); } .archive { margin: 12px 0; } .archive li { display: flex; gap: 6px; align-items: center; padding: 3px 0; }
  @media print { .bar, .tk-ask, .tk-row, .help, footer, .addcard, .addcol, .cmenu, .grip, .archive { display: none !important; } .cols { flex-wrap: wrap; overflow: visible; } .col { flex: 1 1 30%; break-inside: avoid; } body { background: #fff; color: #000; } }`;

/** the page for a row: kind 'pdf' or 'kanban' */
export function pageOf(row, kind) {
  const pdf = kind === 'pdf', fl = kind === 'flights', jb = kind === 'jobs', ln = kind === 'learn';
  const css = (CSS + (pdf ? PDFCSS : fl ? FLCSS : jb ? JBCSS : ln ? LRCSS : KBCSS)).replace('__MAX__', pdf || fl || jb || ln ? '860px' : '1180px').replace('__APPMIN__', pdf ? '760px' : fl || jb || ln ? '80vh' : '520px');
  const foot = ln ? 'Every exercise is made on this device and checked here; your progress, decks and statistics stay in this browser, and the page works offline after one visit. Element weights are IUPAC\u2019s; the words and their meanings are Verse\u2019s own. Verse has no video library and no teacher or class accounts: where a video explains best, the page links to Khan Academy\u2019s free lessons. There is no account and there are no ads.' : jb ? 'Remote job listings from Remotive, Jobicy and Himalayas, each credited and linked to its original posting, where you apply. Your saved jobs, alerts and applications stay in this browser: no account, no profile, no email, nothing about you on a server. The page works offline after one visit with the last listings it saw. No ads.' : fl ? 'Everything is worked out on this device from an airport list of about 4,000 airports (OurAirports, public domain); the fares and trips you keep stay in this browser, and the page works offline after one visit. Verse has no live fares: the prices are on the providers, whose links this page builds from your choices. Flight times and CO2 are estimates from averages, not a timetable. There is no account and there are no ads.' : pdf
    ? 'Every tool runs on this device with a small open-source library (pdf-lib and pdf.js, both vendored here): your files are read, changed and saved in this browser and never uploaded. After one visit the page works offline. A password-protected PDF cannot be opened, and text in a PDF cannot be edited (a PDF holds no paragraphs); <a href="/?q=ask%20questions%20about%20a%20pdf">ask questions about a PDF</a> reads one instead.'
    : 'Boards are kept in this browser only (nothing is sent anywhere) and the page works offline after one visit. Export a board as JSON to keep a copy or move it; a Trello export comes in too.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(row.name)} · Verse</title>
<meta name="description" content="${esc(row.does)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Verse">
<meta property="og:title" content="${esc(row.name)} · Verse">
<meta property="og:description" content="${esc(row.does)}">
<meta property="og:url" content="https://a-to-mind.com${row.path}">
<meta property="og:image" content="https://a-to-mind.com/og/${slug(row.path)}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(row.name)} on Verse">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(row.name)} · Verse">
<meta name="twitter:description" content="${esc(row.does)}">
<meta name="twitter:image" content="https://a-to-mind.com/og/${slug(row.path)}.png">
<style>${css}
</style>
<script src="/visit.js" defer></script>
</head>
<body>
<main>
  <h1>${esc(row.h1)}</h1>
  <p class="intro">${esc(row.intro)}</p>
  <div id="app"></div>
  <nav id="related" aria-label="Related tools"></nav>
  <footer>${foot}</footer>
</main>
<script type="module" src="${row.path}app.js"></script>
<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)</script>
</body>
</html>
`;
}
/** the page's module: the one place its path and settings are written (a file of its own, so every page of a family has the same inline scripts and shares one CSP rule, tools/csp-hashes.mjs) */
export function appOf(row, kind) {
  const pdf = kind === 'pdf', fl = kind === 'flights', jb = kind === 'jobs', cfg = jb ? { panels: row.panels, ...(row.preset ? { preset: row.preset } : {}), de: row.de } : pdf ? { tools: row.tools, ...(row.also ? { also: row.also } : {}) } : fl ? { panels: row.panels, ...(row.controls ? { controls: row.controls } : {}), de: row.de } : { features: row.features };
  const fn = pdf ? 'mountPdf' : fl ? 'mountFlights' : 'mountKanban', lib = pdf ? 'pdf-ui' : fl ? 'flights-ui' : 'kanban-ui';
  if (kind === 'learn') return `// ${row.path}: written by tools/tool-site-pages.mjs from lib/learn-sites.js; edit the row, not this file
// the learning screen comes after the load event (the gate times the load event: only this small file stands before it), then the related row
const go = () => import('/lib/learn-ui.js').then(({ mountLearn }) => mountLearn(document.getElementById('app'), ${JSON.stringify({ panels: row.panels, ...(row.skills ? { skills: row.skills } : {}), de: row.de })}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '${row.path}')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
`;
  if (jb) return `// ${row.path}: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the jobs screen and its listings come after the load event (the gate times the load event: only this small file stands before it), then the related row
const go = () => import('/lib/jobs-ui.js').then(({ mountJobs }) => mountJobs(document.getElementById('app'), ${JSON.stringify(cfg)}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '${row.path}')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
`;
  if (fl) return `// ${row.path}: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
// the flights screen and its airport list come after the load event (the gate times the load event: only this small file stands before it), then the related row
const go = () => import('/lib/flights-ui.js').then(({ mountFlights }) => mountFlights(document.getElementById('app'), ${JSON.stringify(cfg)}))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '${row.path}')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
`;
  return `// ${row.path}: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { ${fn} } from '/lib/${lib}.js';
${fn}(document.getElementById('app'), ${JSON.stringify(cfg)});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '${row.path}'));
`;
}
const MARK = /<!-- seo -->[\s\S]*?<!-- \/seo -->\n?|<!-- asks -->[\s\S]*?<!-- \/asks -->\n?|<!-- modulepreload: tools\/preload\.mjs -->[\s\S]*?<!-- \/modulepreload -->\n?/g;
/** a page without the blocks other generators own */
export const bare = (html) => html.replace(MARK, '');
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), bad = [];
  for (const [rows, kind] of [[PDF_SITES, 'pdf'], [KANBAN_SITES, 'kanban'], [FLIGHT_SITES, 'flights'], [JOB_SITES, 'jobs'], [LEARN_SITES, 'learn']]) for (const row of rows) {
    const appFile = resolve(root, 'void-live-deploy' + row.path + 'app.js'), wantApp = appOf(row, kind), haveApp = existsSync(appFile) ? readFileSync(appFile, 'utf8') : null;
    if (haveApp !== wantApp) { if (check) bad.push(row.path + 'app.js differs from its row (node tools/tool-site-pages.mjs)'); else { mkdirSync(dirname(appFile), { recursive: true }); writeFileSync(appFile, wantApp); console.log('wrote ' + row.path + 'app.js'); } }
    const file = resolve(root, 'void-live-deploy' + row.path + 'index.html'), want = pageOf(row, kind);
    const have = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (have !== null && bare(have) === bare(want)) continue;
    if (check) bad.push(row.path + ' differs from its row (node tools/tool-site-pages.mjs)'); else { mkdirSync(dirname(file), { recursive: true }); const keep = have ? have.match(MARK) || [] : []; writeFileSync(file, want); console.log('wrote ' + row.path + (keep.length ? ' (re-run seo-pages and preload)' : '')); }
  }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
}
