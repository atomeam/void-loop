/**
 * checkers skill — wooden draughts on the same board and table as chess (skills/mini/checkers.js), played against Void.
 * "play checkers", "checkers", "lets play draughts" summons it; it stays until thrown off. You are the dark (rosewood) men
 * and move first. Tap a man, then where it lands; for a multi-jump tap each landing in turn.
 * The rules live in skills/checkers-rules.js (forced captures, multi-jumps, crowning, a king moves both ways).
 * Where WebGL can't run the same game shows as a flat board of buttons, so the card always works.
 */
import { grip, sideCard } from './side-card.js';
import * as K from './checkers-rules.js';

export function checkersOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|i'd like to|wanna|want to)\s+)?(?:play|start|open|summon|begin|new|set up|setup)?\s*(?:me\s+|us\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:new\s+)?(?:game\s+of\s+|round\s+of\s+)?(?:3d\s+)?(?:checkers|draughts)(?:\s+(?:game|board|set|match))?(?:\s+(?:with|against|vs\.?)\s+(?:me|void|you|the computer))?$/.test(t)) return { kind: 'game', fresh: /\bnew\b/.test(t) };
  return null;
}

const STATUS = { 'dark-wins': 'You win', 'light-wins': 'Void wins', draw: 'A draw · forty moves without progress' };
const thinking = new Map(); // th.id -> pending reply, so a re-render never starts a second one
const freshState = () => ({ s: K.create(), sel: -1, hops: [], moves: 0 });
const btnCss = 'font:inherit;font-size:12px;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:3px 12px;cursor:pointer';

function mount(th, stageApi) {
  if (!th.state || !th.state.s) th.state = freshState();
  const phone = Math.min(innerWidth, innerHeight) < 560;
  const W = phone ? Math.min(innerWidth - 20, 420) : 560, H = Math.round(W * 0.78);
  const el = document.createElement('div');
  el.className = 'thing kept-card checkers-card';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;padding:10px;border:1px solid var(--line);border-radius:16px;background:rgba(12,12,13,0.94);text-align:center;cursor:grab;user-select:none;box-shadow:0 18px 50px rgba(0,0,0,.45)';
  // a desktop board stands in the void itself (no frame, no table rectangle); its controls are a separate card beside it,
  // and the grip under the board is what moves the board. Phones keep the framed card (a free board beside the screen edge would run off it).
  const free = !phone;
  if (free) el.classList.add('free-board'); // the stage's shared card look (background, border, padding) stays off
  if (free) el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
  const head = document.createElement('div');
  head.style.cssText = 'color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:2px 0 8px';
  head.textContent = 'Checkers · you are dark';
  const view = document.createElement('div');
  view.className = 'checkers-view';
  view.style.cssText = free ? 'position:relative;width:100%;height:' + Math.round(H * 0.86) + 'px' : 'position:relative;width:100%;height:' + H + 'px;border-radius:11px;overflow:hidden;background:#0c0c0d';
  const status = document.createElement('div');
  status.className = 'checkers-status'; status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'font-size:13px;margin:8px 0 2px;min-height:18px';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px';
  const again = document.createElement('button'); again.type = 'button'; again.textContent = 'new game'; again.style.cssText = btnCss;
  const back = document.createElement('button'); back.type = 'button'; back.textContent = 'take back'; back.style.cssText = btnCss;
  bar.append(back, again);
  for (const x of [view, again, back]) x.addEventListener('pointerdown', (e) => e.stopPropagation());

  let mini = null, flat = null;
  const st = () => th.state;
  const save = () => stageApi.save && stageApi.save();
  // the moves still possible from the selected man along the hops tapped so far
  const pending = () => (st().sel < 0 ? [] : K.legalMoves(st().s).filter((m) => m.from === st().sel && st().hops.every((q, i) => m.path[i] === q)));
  function data() {
    const s = st().s, mine = s.turn === 'd' && !thinking.has(th.id) && K.status(s) === 'playing';
    const next = [...new Set(pending().map((m) => m.path[st().hops.length]).filter((q) => q !== undefined))];
    return { free, board: s.board, last: s.last || null, selected: st().sel, hops: st().hops, targets: next,
      movable: mine && st().sel < 0 ? [...new Set(K.legalMoves(s).map((m) => m.from))] : [], onSquare };
  }
  function paint() {
    const s = st().s, code = K.status(s), n = K.count(s);
    const forced = s.turn === 'd' && K.legalMoves(s).some((m) => m.captures.length);
    status.textContent = STATUS[code] || (thinking.has(th.id) ? 'Void is thinking…' : s.turn === 'd' ? (forced ? 'Your move · a capture is forced' : 'Your move') : 'Void to move');
    status.textContent += ' · ' + (n.d + n.D) + '–' + (n.l + n.L);
    const h = st().hist || []; back.disabled = !h.length; back.style.opacity = h.length ? '1' : '.4';
    if (mini) mini.update(data()); else if (flat) flat();
  }
  function doMove(m) {
    st().hist = (st().hist || []).concat([st().s]).slice(-60);
    st().s = K.apply(st().s, m); st().sel = -1; st().hops = []; st().moves++;
    save(); paint();
  }
  function voidTurn() {
    const s = st().s;
    if (s.turn !== 'l' || K.status(s) !== 'playing' || thinking.has(th.id)) return;
    const p = new Promise((res) => setTimeout(res, 450)).then(() => K.bestMove(s, { depth: 8, ms: 400 })) // let your man land before Void thinks on this thread
      .then((m) => new Promise((res) => setTimeout(() => res(m), 150))).then((m) => {
        thinking.delete(th.id);
        if (st().s !== s || !m) { paint(); return; }
        doMove(m);
        if (!el.isConnected) stageApi.render();
      });
    thinking.set(th.id, p); paint();
  }
  function onSquare(sq0, cands = [sq0]) {
    const s = st().s;
    if (s.turn !== 'd' || thinking.has(th.id) || K.status(s) !== 'playing') return;
    const tos = new Set(pending().map((m) => m.path[st().hops.length])), mine = new Set(K.legalMoves(s).map((m) => m.from));
    const sq = cands.find((q) => tos.has(q)) ?? cands.find((q) => mine.has(q) && q !== st().sel) ?? sq0;
    const next = pending().filter((m) => m.path[st().hops.length] === sq);
    if (next.length) {
      st().hops = st().hops.concat(sq);
      const done = next.find((m) => m.path.length === st().hops.length);
      if (done && next.length === 1) { doMove(done); voidTurn(); return; }
      paint(); return; // more jumps to tap
    }
    const p = s.board[sq];
    st().sel = p && p.toLowerCase() === 'd' && sq !== st().sel && K.legalMoves(s).some((m) => m.from === sq) ? sq : -1;
    st().hops = []; paint();
  }
  function flatBoard() {
    const grid = document.createElement('div'); grid.className = 'checkers-flat';
    const cell = Math.floor(Math.min(W - 24, H - 8) / 8);
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,' + cell + 'px);margin:4px auto;width:max-content;border:6px solid #6b4a2e;border-radius:6px';
    const cells = [];
    for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) {
      const sq = r * 8 + f, b = document.createElement('button'); b.type = 'button'; b.dataset.sq = sq;
      b.style.cssText = 'width:' + cell + 'px;height:' + cell + 'px;padding:0;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:' + ((r + f) % 2 ? '#e9d3ad' : '#9c6b43');
      b.addEventListener('click', (e) => { e.stopPropagation(); onSquare(sq); }); cells[sq] = b; grid.appendChild(b);
    }
    view.appendChild(grid);
    return () => {
      const d = data(), tg = new Set(d.targets);
      cells.forEach((b, sq) => { const p = d.board[sq]; b.textContent = '';
        if (p) { const m = document.createElement('span'); const dark = p.toLowerCase() === 'd';
          m.style.cssText = 'width:76%;height:76%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:' + Math.round(cell * 0.4) + 'px;color:#e8c26a;box-shadow:inset 0 -3px 0 rgba(0,0,0,.35),0 2px 3px rgba(0,0,0,.4);background:' + (dark ? 'radial-gradient(circle at 40% 35%,#8a3b2a,#4a1a12)' : 'radial-gradient(circle at 40% 35%,#f6e2bd,#c9a46e)');
          if (p === 'D' || p === 'L') m.textContent = '♛'; b.appendChild(m); }
        b.style.boxShadow = sq === d.selected ? 'inset 0 0 0 3px #ffd36b' : tg.has(sq) ? 'inset 0 0 0 3px #9fe08a' : d.hops.includes(sq) ? 'inset 0 0 0 99px rgba(159,224,138,.3)' : d.movable.includes(sq) ? 'inset 0 0 0 2px rgba(255,211,107,.6)' : 'none';
        b.setAttribute('aria-label', 'abcdefgh'[sq & 7] + ((sq >> 3) + 1) + (p ? { d: ' your man', D: ' your king', l: ' Void man', L: ' Void king' }[p] : '')); });
    };
  }
  again.addEventListener('click', (e) => { e.stopPropagation(); thinking.delete(th.id); th.state = freshState(); save(); paint(); });
  back.addEventListener('click', (e) => { e.stopPropagation(); const h = st().hist || []; if (!h.length) return; thinking.delete(th.id);
    const n = st().s.turn === 'd' && h.length >= 2 ? 2 : 1; st().s = h[h.length - n]; st().hist = h.slice(0, h.length - n); st().sel = -1; st().hops = []; save(); paint(); voidTurn(); });

  let card = null;
  if (free) {
    // the board stands in the void on its own; its card (whose move, buttons) is separate and moves on its own (skills/side-card.js)
    card = document.createElement('div');
    card.className = 'checkers-side';
    head.style.padding = '0 0 6px'; status.style.margin = '0 0 4px'; bar.style.justifyContent = 'flex-start';
    card.append(head, status, bar);
    el.append(view, grip('Checkers'));
  } else el.append(head, view, status, bar);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  if (card) sideCard(th, stageApi, card, { boardW: W, boardH: Math.round(H * 0.86) + 24, w: 300 });
  paint();
  const fallback = () => { if (flat) return; flat = flatBoard(); paint(); };
  if (stageApi.miniature) {
    stageApi.miniature(view, 'checkers', data(), { key: 'checkers:' + th.id, label: '3D checkers board: tap a man, then where it lands; drag to look around', maxPolar: 1.22, minPolar: 0.15 })
      .then((h) => { mini = h; paint(); }).catch((e) => { console.warn('[checkers] 3D unavailable, flat board', e); fallback(); });
  } else fallback();
  voidTurn();
}

async function run(text, api) {
  const q = checkersOf(text);
  if (!q) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'checkers');
  if (existing) { if (q.fresh) existing.state = freshState(); api.stage.render(); return 'checkers'; }
  const phone = Math.min(innerWidth, innerHeight) < 560, w = phone ? Math.min(innerWidth - 20, 420) : 560;
  const both = !phone && innerWidth >= w + 340 ? w + 320 : w; // the board and its separate card side by side when they fit
  api.summon('checkers', { state: freshState(), x: Math.max(10, Math.round((innerWidth - both) / 2)), y: phone ? 56 : 48 });
  api.say('Checkers · you are dark and move first · tap a man, then where it lands');
  return 'checkers';
}

export default {
  name: 'checkers',
  checkersOf,
  examples: ['play checkers', 'checkers', 'lets play checkers', 'a game of checkers', 'play draughts', 'new checkers game', 'play checkers against void'],
  nearMisses: ['checkers rules', 'who invented checkers', 'play chess', 'chinese checkers', 'fact checkers', 'checkers restaurant'],
  match(lower, text) { return !!checkersOf(text); },
  run,
  stageKinds: { checkers: { mount } },
};
