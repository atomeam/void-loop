// Writes the games floor's pages (owner, 2026-10-26: the games floor of Versus, Lichess, and the small game sites in front of it; docs/RULES.md: every
// lane site gets a page of its own): /chess/ (Lichess), the hub /games/ and one page per lane site under /games/<name>/. They share one look, so the shell
// is written once here; each page's words, controls and its first board are in the HTML (the first paint), and the page's module, <page>/app.js, only
// wires them after the load event. The seo block and the asks row inside the markers are filled by tools/seo-pages.mjs, the module preloads by
// tools/preload.mjs. Rows (name, does, asks, links) are lib/game-sites.js.   node tools/game-pages.mjs [--check]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { GAME_SITES } from '../void-live-deploy/lib/game-sites.js';
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slug = (p) => p.replace(/^\/|\/$/g, '').replace(/\//g, '-');

export const CSS = `
  :root { color-scheme: light dark; --bg: #f7f6fb; --ink: #15131c; --soft: #5d5a6b; --line: #cfcbdc; --accent: #5b36f0; --on-accent: #fff; --box: #fff; --tint: #efe9ff; --bad: #c62a40; --good: #12795a; --warn: #a15c00;
    --lt: #ecdcbf; --dk: #a7774f; --sel: #f4d34a; --last: #c9d86a; --tile: #e7e2f4; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme=light]) { --bg: #0b0a10; --ink: #ecebf5; --soft: #aaa7ba; --line: #3a3649; --accent: #a58bff; --on-accent: #15131c; --box: #14121c; --tint: #221c3a; --bad: #ff6b7e; --good: #4fd6a8; --warn: #ffb44f; --lt: #c9b591; --dk: #8a6342; --tile: #262236; } }
  :root[data-theme=dark] { --bg: #0b0a10; --ink: #ecebf5; --soft: #aaa7ba; --line: #3a3649; --accent: #a58bff; --on-accent: #15131c; --box: #14121c; --tint: #221c3a; --bad: #ff6b7e; --good: #4fd6a8; --warn: #ffb44f; --lt: #c9b591; --dk: #8a6342; --tile: #262236; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 14px 16px 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; text-align: center; font-weight: 650; } h2 { font-size: 16px; margin: 0 0 8px; }
  .sub { font-size: 13px; color: var(--soft); text-align: center; margin: 0 0 10px; min-height: 40px; }
  #gnav { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 0 0 10px; min-height: 84px; align-content: flex-start; }
  #gnav a { font-size: 14px; padding: 6px 12px; min-height: 24px; border: 1px solid var(--line); border-radius: 999px; color: var(--ink); text-decoration: none; background: var(--box); }
  #gnav a[aria-current=page] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
  input, select, textarea { font: inherit; font-size: 16px; color: inherit; background: var(--box); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; min-height: 44px; box-sizing: border-box; max-width: 100%; }
  textarea { width: 100%; min-height: 96px; font-family: ui-monospace, monospace; font-size: 13px; }
  button, a.btn { font: inherit; font-size: 15px; border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; min-height: 44px; min-width: 44px; background: var(--box); color: var(--ink); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
  button[aria-pressed=true], button.go, button[aria-selected=true] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
  button:disabled { opacity: .45; cursor: default; }
  :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .pane { border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin: 10px 0; background: var(--box); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; } .row.c { justify-content: center; }
  .row > label { font-size: 13px; color: var(--soft); display: flex; flex-direction: column; gap: 2px; flex: 1 1 120px; min-width: 0; } .row > label select, .row > label input { width: 100%; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 6px 0 4px; }
  [hidden] { display: none !important; }
  .note { font-size: 13px; color: var(--soft); margin: 4px 0; } .status { min-height: 48px; text-align: center; font-size: 16px; margin: 6px 0; } .bad { color: var(--bad); } .ok { color: var(--good); }
  details { margin: 8px 0; } summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
  #related, #asks { margin-top: 14px; } footer { font-size: 13px; color: var(--soft); text-align: center; margin-top: 10px; } footer a { color: var(--soft); } footer a, .note a, .lacks a { display: inline-block; min-height: 24px; line-height: 24px; }
  .tk-row { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 13px; color: var(--soft); } .tk-row a { color: var(--soft); display: inline-block; min-height: 24px; padding: 2px 0; }
  .lacks { font-size: 13px; color: var(--soft); border-left: 3px solid var(--line); padding: 2px 0 2px 10px; margin: 10px 0; }
  .stats { display: flex; flex-wrap: wrap; gap: 6px 16px; justify-content: center; font-size: 14px; min-height: 24px; font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`;
const CHESS_CSS = `
  .boardwrap { position: relative; width: min(100%, 560px); margin: 0 auto; touch-action: none; }
  .board { display: grid; grid-template-columns: repeat(8, 1fr); aspect-ratio: 1; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 10px #0003; user-select: none; -webkit-user-select: none; }
  .board button { border: 0; border-radius: 0; padding: 0; min-height: 0; min-width: 0; position: relative; display: block; aspect-ratio: 1; }
  .board .l { background: var(--lt); } .board .d { background: var(--dk); }
  .board .last::before, .board .sel::before, .board .chk::before { content: ''; position: absolute; inset: 0; } .board .last::before { background: #e6e04a66; } .board .sel::before { background: #4aa3e688; } .board .chk::before { background: radial-gradient(#ff2a2acc 0%, #ff2a2a55 45%, transparent 72%); }
  .board .tgt::after { content: ''; position: absolute; left: 36%; top: 36%; width: 28%; height: 28%; border-radius: 50%; background: #1d1a2455; } .board .tgt.cap::after { left: 4%; top: 4%; width: 92%; height: 92%; background: transparent; box-shadow: inset 0 0 0 5px #1d1a2455; }
  .board svg { position: absolute; inset: 4%; width: 92%; height: 92%; pointer-events: none; } .board .crd { position: absolute; font-size: 10px; line-height: 1; font-weight: 600; pointer-events: none; } .board .rk { left: 3px; top: 3px; } .board .fl { right: 3px; bottom: 2px; } .board .l .crd { color: var(--dk); } .board .d .crd { color: var(--lt); }
  .board .drag svg { opacity: .35; }
  #ghost { position: fixed; pointer-events: none; z-index: 20; width: 64px; height: 64px; display: none; } #ghost svg { width: 100%; height: 100%; }
  #arrows { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .pw { fill: #fbf8f1; stroke: #1d1a24; stroke-width: 1.4; stroke-linejoin: round; } .pb { fill: #2b2735; stroke: #050409; stroke-width: 1.4; stroke-linejoin: round; } .pb .hl { stroke: #e9e3d6; } .pw .hl { stroke: #1d1a24; } .hl { fill: none; stroke-width: 1.3; }
  .clock { display: flex; justify-content: space-between; align-items: center; width: min(100%, 560px); margin: 6px auto; min-height: 44px; font-size: 15px; }
  .clock b { font: 600 22px/1 ui-monospace, monospace; padding: 8px 12px; border-radius: 10px; background: var(--tint); min-width: 92px; text-align: center; font-variant-numeric: tabular-nums; } .clock b.run { background: var(--accent); color: var(--on-accent); } .clock b.low { color: var(--bad); } .clock b.run.low { color: #fff; background: var(--bad); }
  .moves { list-style: none; padding: 0; margin: 6px 0; display: grid; grid-template-columns: 3em 1fr 1fr; gap: 2px 6px; max-height: 260px; overflow: auto; font-variant-numeric: tabular-nums; min-height: 48px; }
  .moves li { display: contents; } .moves span { color: var(--soft); padding: 4px 0; text-align: right; } .moves button { min-height: 32px; border-radius: 8px; justify-content: flex-start; padding: 2px 8px; font-size: 15px; border-color: transparent; } .moves button.cur { background: var(--tint); border-color: var(--accent); }
  .evalline { min-height: 44px; font-size: 14px; text-align: center; font-variant-numeric: tabular-nums; } .evalbar { height: 8px; border-radius: 4px; background: #2b2735; overflow: hidden; width: min(100%, 560px); margin: 4px auto; } .evalbar i { display: block; height: 100%; width: 50%; background: #fbf8f1; transition: width .3s; }
  dialog { border: 1px solid var(--line); border-radius: 14px; background: var(--box); color: var(--ink); } dialog::backdrop { background: #0007; } .promo { display: flex; gap: 8px; } .promo button { width: 64px; height: 64px; padding: 4px; } .promo svg { width: 100%; height: 100%; }
  .fen { width: 100%; font-family: ui-monospace, monospace; font-size: 13px; }
  @media print { #gnav, .tabs, .row, #asks, #related, footer, details, .clock { display: none !important; } }`;

// the pieces: Verse's own simple shapes (a base, a body and a head for each), one symbol each, coloured by the class of the <svg> that uses them
const BASE = '<path d="M10 39.5h25v-3.5H10zM13 36h19l-1.6-3.6H14.6z"/>';
export const PIECES = {
  p: BASE + '<path d="M16.5 32.4c.6-5 2.6-8 4.3-9.9h3.4c1.7 1.9 3.7 4.9 4.3 9.9z"/><circle cx="22.5" cy="16.5" r="5.6"/>',
  r: BASE + '<path d="M15 32.4l1.2-14.6h12.6L30 32.4z"/><path d="M13 10.5h4v3h3v-3h5v3h3v-3h4v7.3H13z"/><path class="hl" d="M16.4 21h12.2"/>',
  b: BASE + '<path d="M16.2 32.4c.8-4 2-6.6 3.4-8.4h5.8c1.4 1.8 2.6 4.4 3.4 8.4z"/><path d="M22.5 8.6c-5.2 3.6-7.4 8.7-6.3 12.6.9 3.3 11.7 3.3 12.6 0 1.1-3.9-1.1-9-6.3-12.6z"/><circle cx="22.5" cy="7" r="2.1"/><path class="hl" d="M24.6 12.6l-3.8 4.6"/>',
  n: BASE + '<path d="M14.4 32.4c-.4-5.6 2.4-9 6.6-11.7-2.6-.6-4.9.2-6.9 2.1l-2.6-2.9c1.6-4.7 5.6-9.1 10.6-10.4l.8-3.1 2.3 2.9c5.9 1.6 9.2 7.4 8.9 14.8l-.6 8.3z"/><circle class="hl" cx="20.6" cy="14.6" r=".9"/>',
  q: BASE + '<path d="M14.4 32.4l1-6.4h14.2l1 6.4z"/><path d="M11 13.6l4.4 12.4h14.2l4.4-12.4-6 5.6-3-9.4-2.5 8.6-2.5-8.6-3 9.4z"/><circle cx="11" cy="12.6" r="2"/><circle cx="17" cy="9.4" r="2"/><circle cx="22.5" cy="8.4" r="2"/><circle cx="28" cy="9.4" r="2"/><circle cx="34" cy="12.6" r="2"/>',
  k: BASE + '<path d="M15 32.4l-1.6-11.2c2.7-3 5.7-4.4 9.1-4.4s6.4 1.4 9.1 4.4L30 32.4z"/><path d="M21 5h3v3.4h3.4v3H24v4.4h-3v-4.4h-3.4v-3H21z"/><path class="hl" d="M15.6 25.6h13.8"/>',
};
export const SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + Object.entries(PIECES).map(([k, v]) => `<symbol id="p-${k}" viewBox="0 0 45 45">${v}</symbol>`).join('') + '</defs></svg>';
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const pieceSvg = (p) => `<svg class="${p === p.toUpperCase() ? 'pw' : 'pb'}" viewBox="0 0 45 45" aria-hidden="true"><use href="#p-${p.toLowerCase()}"/></svg>`;
/** the 64 squares of the start position, white at the bottom: what the page shows before its module runs */
function startBoard() {
  const rows = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'], out = [];
  for (let i = 0; i < 64; i++) {
    const r = 7 - (i >> 3), f = i & 7, sq = 'abcdefgh'[f] + (r + 1), p = rows[7 - r][f] || '', light = (r + f) % 2 === 1;
    out.push(`<button type="button" class="${light ? 'l' : 'd'}" aria-label="${sq}${p ? ' ' + (p === p.toUpperCase() ? 'white ' : 'black ') + NAMES[p.toLowerCase()] : ''}">${f === 0 ? `<span class="crd rk">${r + 1}</span>` : ''}${r === 0 ? `<span class="crd fl">${'abcdefgh'[f]}</span>` : ''}${p ? pieceSvg(p) : ''}</button>`);
  }
  return out.join('');
}
const LEVEL_OPTS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000].map((e, i) => `<option value="${i + 1}"${i === 3 ? ' selected' : ''}>Level ${i + 1} (~${e})</option>`).join('');
const TC_OPTS = [['none', 'No clock'], ['1+0', 'Bullet 1+0'], ['3+2', 'Blitz 3+2'], ['5+0', 'Blitz 5+0'], ['10+0', 'Rapid 10+0'], ['15+10', 'Rapid 15+10'], ['30+0', 'Classical 30+0']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

export const CHESS_BODY = `
  <div class="tabs" role="tablist" aria-label="Mode"><button type="button" role="tab" id="m-ai" aria-selected="true">Play the computer</button><button type="button" role="tab" id="m-two" aria-selected="false">Two players</button><button type="button" role="tab" id="m-puzzle" aria-selected="false">Puzzles</button><button type="button" role="tab" id="m-analysis" aria-selected="false">Analysis</button></div>
  <section class="pane" id="setup" aria-label="New game">
    <div class="row"><label id="lv-l">Computer level<select id="level">${LEVEL_OPTS}</select></label><label id="col-l">You play<select id="color"><option value="w">White</option><option value="b">Black</option><option value="r">Random</option></select></label><label>Clock<select id="tc">${TC_OPTS}</select></label></div>
    <div class="row c"><button type="button" class="go" id="new">New game</button><span class="note" id="rating">Your rating against Verse on this device: 1200 (no games yet)</span></div>
  </section>
  <section class="pane" id="puz" aria-label="Puzzle" hidden>
    <p class="note" id="puzinfo">Find the best move. Puzzles found by Verse's own engine in its games; ratings are rough.</p>
    <div class="row c"><button type="button" id="pnext">Next puzzle</button><button type="button" id="psol">Show the solution</button><button type="button" id="pdaily">Lichess daily puzzle</button></div>
    <p class="note" id="prating">Your puzzle rating on this device: 1200</p>
  </section>
  <div class="clock" id="clk-top"><span id="name-top">Verse, level 4</span><b id="t-top">–</b></div>
  <div class="boardwrap" id="wrap"><div class="board" id="board" role="grid" aria-label="Chess board">${startBoard()}</div><svg id="arrows" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs><g id="arrowg"></g></svg></div>
  <div class="clock" id="clk-bot"><span id="name-bot">You</span><b id="t-bot">–</b></div>
  <p class="status" id="status" role="status" aria-live="polite">White to move. Tap a piece, then a square, or drag it.</p>
  <div class="row c" role="toolbar" aria-label="Game"><button type="button" id="first" aria-label="First move">⏮</button><button type="button" id="prev" aria-label="Back one move">◀</button><button type="button" id="next" aria-label="Forward one move">▶</button><button type="button" id="last" aria-label="Last move">⏭</button><button type="button" id="undo">Takeback</button><button type="button" id="flip">Flip board</button></div>
  <div class="row c"><button type="button" id="hint">Hint</button><button type="button" id="analyse" aria-pressed="false">Engine analysis</button><button type="button" id="draw" aria-pressed="false">Draw arrows</button><button type="button" id="clear">Clear arrows</button><button type="button" id="resign">Resign</button><button type="button" id="share">Share link</button></div>
  <div class="evalbar" aria-hidden="true"><i id="evalfill"></i></div>
  <p class="evalline" id="eval" aria-live="polite">Right-click and drag (or Draw arrows, then tap two squares) to draw an arrow.</p>
  <section class="pane" aria-label="Moves"><h2>Moves</h2><ol class="moves" id="moves"></ol><p class="note" id="opening"></p></section>
  <details class="pane" id="io"><summary>PGN and FEN: import, export, copy</summary>
    <label class="note" for="fenout">This position (FEN)</label><input class="fen" id="fenout" readonly value="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1">
    <div class="row"><button type="button" id="copyfen">Copy FEN</button><button type="button" id="copypgn">Copy PGN</button><button type="button" id="dlpgn">Download .pgn</button><a class="btn" id="lichess" href="https://lichess.org/analysis/standard/rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR_w_KQkq_-_0_1" rel="noopener" target="_blank">Open this position on Lichess</a><button type="button" id="cloud">Lichess cloud analysis</button></div>
    <label class="note" for="pgnin">Paste a PGN or a FEN to load it</label><textarea id="pgnin" spellcheck="false" placeholder="1. e4 e5 2. Nf3 Nc6 ..."></textarea>
    <div class="row"><button type="button" class="go" id="load">Load</button><span class="note" id="ioerr" role="status"></span></div>
  </details>
  <dialog id="promo" aria-label="Promote to"><p>Promote to</p><div class="promo" id="promobtns"></div></dialog>
  <div id="ghost" aria-hidden="true"></div>
  <p class="lacks" id="lacks">What Verse does not have: no online games against strangers and no ratings shared with anyone, because Verse keeps no accounts. Play a friend by link instead: after your move, press Share link and send it; they open it, move, and send theirs back (a correspondence game with nothing stored anywhere). No variants, tournaments or opening database yet. The computer is Verse's own engine, written for this page (no third-party engine); its levels are rough guesses of strength.</p>
  <p class="note" id="credit">Lichess is used, never copied: "Open this position on Lichess" and "Lichess cloud analysis" ask lichess.org, one request at a time and only when you press them; the daily puzzle comes from the Lichess puzzle API (Lichess puzzle data is published under CC0). The 3D wooden board is on the stage: <a href="/?q=play%20chess">play chess on the 3D board</a>.</p>`;

const head = (row) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(row.title || row.name)} · Verse</title>
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
<style>${CSS}${row.css || ''}
</style>
</head>`;
const NAV = () => '<nav id="gnav" aria-label="Games">' + GAME_SITES.map((r) => `<a href="${r.path}">${esc(r.short || r.name)}</a>`).join('') + '</nav>';
/** a page: the shell, its own body, the asks row and related row markers, the module after load */
export function pageOf(row, body) {
  const nav = NAV().replace(`<a href="${row.path}">`, `<a href="${row.path}" aria-current="page">`);
  return `${head(row)}
<body>
${row.sprite ? SPRITE + '\n' : ''}<main id="app">
  <h1>${esc(row.h1 || row.name)}</h1>
  <p class="sub" id="lede">${esc(row.intro)}</p>
  ${nav}${body}
  <nav id="related" aria-label="Related tools"></nav>
  <p class="note" style="text-align:center" id="trust">Free, no account, no ads. It runs on your device and works offline after one visit.</p>
  <footer><a href="/">Verse</a> · <a href="/games/">every game</a> · <a href="/tools/">every tool</a></footer>
</main>
<script type="module" src="${row.path}app.js"></script>
<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js LATER, kept with its modules)</script>
</body>
</html>
`;
}
// ---- the pages under /games/: each body is its words, its controls and its empty board, so the first paint is the page ----
const STATUS = (s) => `<p class="status" id="status" role="status" aria-live="polite">${s}</p>`;
const SHARE = '<button type="button" id="share">Share link</button>';
const grid = (n, cls, label = (i) => '') => Array.from({ length: n }, (_, i) => `<button type="button" class="${cls}" aria-label="${label(i)}"></button>`).join('');
const CHECKERS_CSS = `
  .cboard { display: grid; grid-template-columns: repeat(8, 1fr); width: min(100%, 520px); aspect-ratio: 1; margin: 8px auto; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 10px #0003; }
  .cboard button { border: 0; border-radius: 0; padding: 0; min-height: 0; min-width: 0; aspect-ratio: 1; position: relative; display: block; } .cboard .l { background: var(--lt); } .cboard .d { background: #6b4a33; }
  .cboard .sel { box-shadow: inset 0 0 0 4px var(--sel); } .cboard .tgt::after { content: ''; position: absolute; inset: 36%; border-radius: 50%; background: #f4d34acc; } .cboard .last { box-shadow: inset 0 0 0 3px #e6e04a99; }
  .man { position: absolute; inset: 12%; border-radius: 50%; box-shadow: inset 0 -4px 0 #0005, 0 2px 4px #0006; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; } .man.me { background: #c8312f; color: #ffe9a8; } .man.cpu { background: #f2ead8; color: #6b4a33; }`;
const CHECKERS_BODY = `
  <div class="row c"><label style="flex:0 1 160px">Level<select id="level"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></label><label style="flex:0 1 180px">Opponent<select id="mode"><option value="ai">The computer</option><option value="two">A friend on this device</option></select></label></div>
  <div class="stats" id="stats">Your wins on this device: 0 · losses: 0 · draws: 0</div>
  <div class="cboard" id="cb" role="grid" aria-label="Checkers board">${Array.from({ length: 64 }, (_, i) => { const r = 7 - (i >> 3), c = i & 7, dark = (r + c) % 2 === 0, p = dark && r <= 2 ? 'me' : dark && r >= 5 ? 'cpu' : ''; return `<button type="button" class="${dark ? 'd' : 'l'}" aria-label="${'abcdefgh'[c]}${r + 1}${p ? (p === 'me' ? ' your man' : ' computer man') : ''}">${p ? `<span class="man ${p}"></span>` : ''}</button>`; }).join('')}</div>
  ${STATUS('Your move: red moves up the board. Tap a man, then where it goes. A capture must be taken.')}
  <div class="row c"><button type="button" class="go" id="new">New game</button><button type="button" id="undo">Undo</button><button type="button" id="hint">Hint</button>${SHARE}</div>
  <p class="lacks">What Verse does not have: no games against strangers online and no shared rankings (Verse keeps no accounts). The rules are American checkers (English draughts) on an 8x8 board; international 10x10 draughts is not here yet.</p>`;
const SOL_CSS = `
  .sol { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; width: min(100%, 640px); margin: 8px auto; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  .slot { position: relative; aspect-ratio: 5 / 7; border-radius: 6px; border: 1px dashed var(--line); min-height: 0; padding: 0; background: transparent; }
  .col { position: relative; min-height: 260px; } .cardx { position: absolute; left: 0; right: 0; aspect-ratio: 5 / 7; border-radius: 6px; border: 1px solid #0003; background: #fffdf8; color: #15131c; font: 700 clamp(12px, 3.6vw, 18px)/1 system-ui; padding: 3px 4px; text-align: left; min-height: 0; min-width: 0; display: block; box-sizing: border-box; }
  .cardx.rd { color: #c8102e; } .cardx.back { background: repeating-linear-gradient(45deg, #5b36f0 0 6px, #7a5cff 6px 12px); border-color: #3a2a99; } .cardx.selc { outline: 3px solid var(--sel); outline-offset: -1px; } .cardx .big { position: absolute; right: 4px; bottom: 3px; font-size: clamp(16px, 5vw, 26px); }
  .slot .cardx { top: 0; } .gap { visibility: hidden; }`;
const SOL_BODY = `
  <div class="row c"><label style="flex:0 1 150px">Draw<select id="draw"><option value="1">One card</option><option value="3">Three cards</option></select></label><span class="stats" id="stats">Moves 0 · Score 0 · <span id="clock">0:00</span></span></div>
  <div class="sol" id="sol"><button type="button" class="slot" id="stock" aria-label="Stock: turn cards"></button><div class="slot" id="waste" aria-label="Waste"></div><div class="slot gap"></div>${[0, 1, 2, 3].map((f) => `<div class="slot" id="found${f}" aria-label="Foundation ${f + 1}"></div>`).join('')}${[0, 1, 2, 3, 4, 5, 6].map((c) => `<div class="col" id="tab${c}" aria-label="Column ${c + 1}"></div>`).join('')}</div>
  ${STATUS('Tap a card to send it where it goes, or tap a card and then where to put it. Tap the stock to turn cards.')}
  <div class="row c"><button type="button" class="go" id="new">New game</button><button type="button" id="restart">Restart this deal</button><button type="button" id="undo">Undo</button><button type="button" id="hint">Hint</button><button type="button" id="finish">Finish</button>${SHARE}</div>
  <p class="stats" id="record">Wins on this device: 0 of 0</p>
  <p class="lacks">What Verse does not have: Spider, FreeCell and the other patience games are not here yet; this page is Klondike. Some deals cannot be won; a numbered deal can be played again.</p>`;
const MINES_CSS = `
  .mines { display: grid; gap: 2px; margin: 8px auto; width: fit-content; max-width: 100%; overflow-x: auto; user-select: none; -webkit-user-select: none; touch-action: manipulation; padding: 4px; }
  .mines button { width: 34px; height: 34px; min-height: 0; min-width: 0; border-radius: 4px; padding: 0; font: 700 16px/1 system-ui; border: 0; background: #8f86b5; color: #fff; box-shadow: inset 0 -3px 0 #0003; }
  .mines.small button { width: 24px; height: 24px; font-size: 13px; } .mines button.o { background: var(--tile); box-shadow: none; color: var(--ink); } .mines button.boom { background: var(--bad); }
  .n1 { color: #2563eb !important; } .n2 { color: #15803d !important; } .n3 { color: #dc2626 !important; } .n4 { color: #7c3aed !important; } .n5 { color: #b45309 !important; } .n6 { color: #0e7490 !important; } .n7 { color: var(--ink) !important; } .n8 { color: var(--soft) !important; }`;
const MINES_BODY = `
  <div class="row c"><label style="flex:0 1 260px">Level<select id="level"><option value="beginner">Beginner 9x9, 10 mines</option><option value="intermediate">Intermediate 16x16, 40</option><option value="expert">Expert 30x16, 99</option><option value="custom">Custom</option></select></label><span id="custom" hidden><label>W <input id="cw" type="number" min="5" max="40" value="20" style="width:5em"></label> <label>H <input id="ch" type="number" min="5" max="30" value="12" style="width:5em"></label> <label>Mines <input id="cm" type="number" min="1" max="300" value="40" style="width:5em"></label></span></div>
  <div class="stats"><span>Field <b id="size">9 × 9</b></span><span>Mines left <b id="left">10</b></span><span>Time <b id="clock">0:00</b></span><span id="best">Best: none yet</span></div>
  <div class="mines" id="grid" style="grid-template-columns:repeat(9,34px)" role="grid" aria-label="Minefield">${grid(81, '', (i) => 'square ' + ((i % 9) + 1) + ', ' + (Math.floor(i / 9) + 1))}</div>
  ${STATUS('Open a square. Long-press, right-click or Flag mode puts a flag. Tap an opened number whose flags are all placed to open the rest around it.')}
  <div class="row c"><button type="button" class="go" id="new">New game</button><button type="button" id="flagmode" aria-pressed="false">Flag mode</button><label style="flex:0 1 auto;flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="marks" style="width:24px;height:24px;min-height:0"> Question marks</label>${SHARE}</div>
  <p class="lacks">What Verse does not have: no world ranking of times (Verse keeps no accounts); your best times stay on this device.</p>`;
const WORD_CSS = `
  .tiles { display: grid; grid-template-columns: repeat(5, 58px); grid-auto-rows: 58px; gap: 6px; justify-content: center; margin: 8px auto; }
  .tiles div { border: 2px solid var(--line); border-radius: 6px; display: flex; align-items: center; justify-content: center; font: 700 28px/1 system-ui; text-transform: uppercase; }
  .tiles .g, .kbd .g { background: #3a8a4a; border-color: #3a8a4a; color: #fff; } .tiles .y, .kbd .y { background: #c99a15; border-color: #c99a15; color: #fff; } .tiles .b, .kbd .b { background: #6b6878; border-color: #6b6878; color: #fff; }
  .cb .tiles .g, .cb .kbd .g { background: #e8752a; border-color: #e8752a; } .cb .tiles .y, .cb .kbd .y { background: #3d8fd6; border-color: #3d8fd6; }
  .kbd { display: flex; flex-direction: column; gap: 6px; align-items: center; margin: 10px 0; user-select: none; } .kbd div { display: flex; gap: 4px; } .kbd button { min-width: 0; width: clamp(28px, 8.4vw, 44px); height: 52px; padding: 0; border-radius: 6px; font-weight: 700; text-transform: uppercase; background: var(--tile); border: 0; } .kbd .wide { width: clamp(44px, 13vw, 66px); font-size: 12px; text-transform: none; }
  .dist { list-style: none; padding: 0; margin: 6px 0; font-size: 13px; } .dist li { display: flex; gap: 6px; align-items: center; margin: 2px 0; } .dist i { display: inline-block; height: 18px; background: var(--accent); border-radius: 3px; min-width: 18px; color: var(--on-accent); font-style: normal; text-align: right; padding: 0 4px; }`;
const WORD_BODY = `
  <div class="tabs" role="tablist" aria-label="Game"><button type="button" role="tab" id="unl" aria-selected="true">Unlimited</button><button type="button" role="tab" id="daily" aria-selected="false">Word of the day</button></div>
  <div class="tiles" id="tiles" aria-label="Your guesses">${'<div></div>'.repeat(30)}</div>
  ${STATUS('Type a five-letter word and press Enter.')}
  <div class="kbd" id="kbd" aria-label="Keyboard">${['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((r, i) => '<div>' + (i === 2 ? '<button type="button" class="wide" data-k="enter">Enter</button>' : '') + [...r].map((c) => `<button type="button" data-k="${c}">${c}</button>`).join('') + (i === 2 ? '<button type="button" class="wide" data-k="back" aria-label="Delete a letter">⌫</button>' : '') + '</div>').join('')}</div>
  <div class="row c"><button type="button" class="go" id="new">New word</button><label style="flex:0 1 auto;flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="hard" style="width:24px;height:24px;min-height:0"> Hard mode</label><label style="flex:0 1 auto;flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="cbm" style="width:24px;height:24px;min-height:0"> Colour-blind colours</label><button type="button" id="share">Share result</button></div>
  <section class="pane" aria-label="Your record"><h2>Your record on this device</h2><p class="stats" id="stats">Played 0 · Won 0% · Streak 0 · Best streak 0</p><ul class="dist" id="dist"></ul></section>
  <p class="lacks">What Verse does not have: one shared word for everybody on the same day is the word of the day here, but there is no leaderboard (Verse keeps no accounts). Five-letter English words only for now.</p>
  <p class="note">The answers are Verse's own list of everyday words; a guess is accepted from a list of 12,578 five-letter words (word-list, MIT licence).</p>`;
const SUDOKU_CSS = `
  .sgrid { display: grid; grid-template-columns: repeat(9, 1fr); width: min(100%, 468px); aspect-ratio: 1; margin: 8px auto; border: 3px solid var(--ink); border-radius: 4px; background: var(--ink); gap: 1px; }
  .sgrid button { border: 0; border-radius: 0; padding: 0; min-height: 0; min-width: 0; background: var(--box); font: 600 clamp(16px, 5vw, 26px)/1 system-ui; color: var(--accent); position: relative; aspect-ratio: 1; }
  .sgrid button.giv { color: var(--ink); font-weight: 700; } .sgrid button:nth-child(9n+3), .sgrid button:nth-child(9n+6) { box-shadow: inset -3px 0 0 var(--ink); } .sgrid button:nth-child(n+19):nth-child(-n+27), .sgrid button:nth-child(n+46):nth-child(-n+54) { box-shadow: inset 0 -3px 0 var(--ink); } .sgrid button:nth-child(21), .sgrid button:nth-child(24), .sgrid button:nth-child(48), .sgrid button:nth-child(51) { box-shadow: inset -3px -3px 0 var(--ink); }
  .sgrid .peer { background: var(--tint); } .sgrid .same { background: color-mix(in srgb, var(--accent) 22%, var(--box)); } .sgrid .cur { background: color-mix(in srgb, var(--accent) 38%, var(--box)); } .sgrid .err { color: var(--bad); } .sgrid .hint { outline: 3px solid var(--good); outline-offset: -3px; }
  .sgrid .notes { position: absolute; inset: 2px; display: grid; grid-template-columns: repeat(3, 1fr); font-size: clamp(8px, 2.4vw, 12px); color: var(--soft); font-weight: 500; line-height: 1; align-items: center; }
  .pad { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; width: min(100%, 468px); margin: 6px auto; } .pad button { min-width: 0; padding: 0; font-size: 20px; font-weight: 700; border-radius: 8px; }
  @media print { .pad, .row, .tabs, #status { display: none !important; } .sgrid { width: 15cm; } }`;
const SUDOKU_BODY = `
  <div class="row c"><label style="flex:0 1 150px">Level<select id="level"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option><option value="evil">Evil</option></select></label><span class="stats"><span>Time <b id="clock">0:00</b></span><span id="num">Puzzle 1</span><span id="best">Best: none yet</span></span></div>
  <div class="sgrid" id="grid" role="grid" aria-label="Sudoku grid">${grid(81, '', (i) => 'row ' + (Math.floor(i / 9) + 1) + ' column ' + ((i % 9) + 1) + ', empty')}</div>
  <div class="pad" id="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}</div>
  ${STATUS('Pick a square, then a number. Notes mode writes small pencil marks.')}
  <div class="row c"><button type="button" id="notes" aria-pressed="false">Notes</button><button type="button" id="erase">Erase</button><button type="button" id="undo">Undo</button><button type="button" id="redo">Redo</button><button type="button" id="hint">Hint</button><label style="flex:0 1 auto;flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="showerr" checked style="width:24px;height:24px;min-height:0"> Show mistakes</label></div>
  <div class="row c"><button type="button" class="go" id="new">New game</button><button type="button" id="print">Print</button>${SHARE}</div>
  <p class="lacks">What Verse does not have: no daily ranking against other people (Verse keeps no accounts). Every puzzle is made on your device and checked to have exactly one solution; the levels are by clues and by whether singles alone solve it.</p>`;
const MERGE_CSS = `
  .tilesb { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: min(100%, 420px); aspect-ratio: 1; margin: 8px auto; padding: 8px; box-sizing: border-box; background: #8f86b5; border-radius: 10px; touch-action: none; user-select: none; }
  .tilesb div { border-radius: 6px; background: #b9b2d6; display: flex; align-items: center; justify-content: center; font: 800 clamp(20px, 7vw, 40px)/1 system-ui; color: #1b1826; transition: transform .08s; }
  .tilesb .v2 { background: #f2eefc; } .tilesb .v4 { background: #e3dbfa; } .tilesb .v8 { background: #ffb38a; color: #fff; } .tilesb .v16 { background: #ff8f5e; color: #fff; } .tilesb .v32 { background: #ff6b5e; color: #fff; } .tilesb .v64 { background: #f04a3c; color: #fff; }
  .tilesb .v128 { background: #ffd65e; font-size: clamp(18px, 6vw, 34px); } .tilesb .v256 { background: #ffcc33; font-size: clamp(18px, 6vw, 34px); } .tilesb .v512 { background: #f5bd12; font-size: clamp(18px, 6vw, 34px); } .tilesb .v1024, .tilesb .v2048 { background: #5b36f0; color: #fff; font-size: clamp(14px, 5vw, 28px); } .tilesb .big { background: #15131c; color: #fff; font-size: clamp(12px, 4vw, 24px); }
  .tilesb .pop { transform: scale(1.08); }`;
const MERGE_BODY = `
  <div class="stats"><span>Score <b id="score">0</b></span><span>Best <b id="best">0</b></span><span>Moves <b id="moves">0</b></span></div>
  <div class="tilesb" id="board" role="img" aria-label="The tiles">${'<div></div>'.repeat(16)}</div>
  ${STATUS('Swipe, or use the arrow keys or W A S D. Equal tiles that meet join and double.')}
  <div class="row c" aria-label="Arrows"><button type="button" data-d="left" aria-label="Slide left">←</button><button type="button" data-d="up" aria-label="Slide up">↑</button><button type="button" data-d="down" aria-label="Slide down">↓</button><button type="button" data-d="right" aria-label="Slide right">→</button></div>
  <div class="row c"><button type="button" class="go" id="new">New game</button><button type="button" id="undo">Undo</button>${SHARE}</div>
  <p class="lacks">What Verse does not have: no shared high-score table (Verse keeps no accounts); your best score stays on this device.</p>`;
const HUB_CSS = `
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 10px 0; padding: 0; list-style: none; }
  .cards a { display: block; border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: var(--box); color: var(--ink); text-decoration: none; min-height: 96px; } .cards a:hover { border-color: var(--accent); } .cards b { font-size: 17px; display: block; margin-bottom: 4px; } .cards span { font-size: 13px; color: var(--soft); display: block; } .cards em { font-style: normal; font-size: 12px; color: var(--accent); display: block; margin-top: 6px; min-height: 18px; }`;
export const HUB_BODY = (rows) => `
  <ul class="cards" id="list">${rows.filter((r) => r.path !== '/games/').map((r) => `<li><a href="${r.path}" data-key="${r.path}"><b>${esc(r.short || r.name)}</b><span>${esc(r.does.split('. ')[0].replace(/^Free /, ''))}.</span><em></em></a></li>`).join('')}</ul>
  <section class="pane" aria-label="On the stage"><h2>More games on the stage, in 3D</h2><p class="note">Verse's stage plays these against Verse on a 3D table: ask for one and it appears.</p>
  <div class="tk-row">${[['Connect four', 'play connect four'], ['Othello', 'play othello'], ['Go', 'play go'], ['Mancala', 'play mancala'], ['Battleship', 'play battleship'], ['Tic-tac-toe', 'play tic tac toe'], ['Snake', 'play snake'], ['Pong', 'play pong'], ['Chess in 3D', 'play chess'], ['The game box', 'games']].map(([n, q]) => `<a href="/?q=${encodeURIComponent(q)}">${n}</a>`).join(' · ')}</div></section>
  <p class="lacks">What Verse does not have: no online games against strangers and no accounts, ratings or leaderboards shared with anyone; your records stay on this device. Chess with a friend works by link: each move is sent as a link.</p>`;
/** the page's start file: the game's code (game.js) after the load event, so only this small file stands before it (the gate times the load event); on a
 *  first visit the service worker takes over after the code has loaded, so the code is asked for once more through it and kept for offline */
export const bootOf = (row) => `// ${row.path}app.js: written by tools/game-pages.mjs; edit the generator, not this file. The game is ${row.path}game.js, loaded after the load event.
const keep = () => { for (const u of new Set([...performance.getEntriesByType('resource').map((e) => new URL(e.name)).filter((u) => u.origin === location.origin && /\\.(?:js|json)$/.test(u.pathname)).map((u) => u.pathname)${row.keep ? ', ...' + JSON.stringify(row.keep) : ''}])) fetch(u).catch(() => {}); };
const go = () => import('${row.path}game.js').then(() => { const sw = navigator.serviceWorker; if (!sw) return; if (sw.controller) keep(); else sw.addEventListener('controllerchange', keep, { once: true }); });
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
`;
export const BODIES = { '/chess/': CHESS_BODY, '/games/': HUB_BODY(GAME_SITES), '/games/checkers/': CHECKERS_BODY, '/games/solitaire/': SOL_BODY, '/games/mines/': MINES_BODY, '/games/word/': WORD_BODY, '/games/sudoku/': SUDOKU_BODY, '/games/merge/': MERGE_BODY };
export const EXTRA_CSS = { '/chess/': CHESS_CSS, '/games/': HUB_CSS, '/games/checkers/': CHECKERS_CSS, '/games/solitaire/': SOL_CSS, '/games/mines/': MINES_CSS, '/games/word/': WORD_CSS, '/games/sudoku/': SUDOKU_CSS, '/games/merge/': MERGE_CSS };
const MARK = /<!-- seo -->[\s\S]*?<!-- \/seo -->\n?|<!-- asks -->[\s\S]*?<!-- \/asks -->\n?|<!-- modulepreload: tools\/preload\.mjs -->[\s\S]*?<!-- \/modulepreload -->\n?/g;
const bare = (h) => h.replace(MARK, '');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), bad = [];
  for (const row of GAME_SITES) {
    const body = BODIES[row.path]; if (!body) continue;
    const bootFile = path.join(site, row.path, 'app.js'), bootWant = bootOf(row);
    if (!fs.existsSync(bootFile) || fs.readFileSync(bootFile, 'utf8') !== bootWant) { if (check) bad.push(row.path + 'app.js differs from tools/game-pages.mjs'); else { fs.mkdirSync(path.dirname(bootFile), { recursive: true }); fs.writeFileSync(bootFile, bootWant); console.log('wrote ' + row.path + 'app.js'); } }
    const want = pageOf({ ...row, css: EXTRA_CSS[row.path] || '' }, body), file = path.join(site, row.path, 'index.html'), have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (have !== null && bare(have) === bare(want)) continue;
    if (check) { bad.push(row.path + ' differs from tools/game-pages.mjs (node tools/game-pages.mjs)'); continue; }
    // keep the blocks other generators own (seo, asks, preloads) where they were
    let out = want; if (have) { for (const m of have.match(MARK) || []) { const tag = m.slice(0, m.indexOf('-->') + 3); if (/<!-- asks -->/.test(tag)) { if (row.links && row.links.length) out = out.replace('  <nav id="related"', m.trimEnd() + '\n  <nav id="related"'); } else out = out.replace('</head>', m.trimEnd() + '\n</head>'); } }
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, out); console.log('wrote ' + row.path);
  }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
}
