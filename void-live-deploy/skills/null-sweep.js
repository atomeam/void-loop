/**
 * null-sweep skill — Null Sweep, Verse's mine-clearing puzzle (skills/null-sweep-rules.js; research in domains/void.game-research.md):
 * "null sweep", "minesweeper", "play minesweeper", "sweep the void". A grid hides bad commits; open the safe cells, flag the bad ones, clear the grid.
 * Player two is Verse: it plays the same seed beside you with a logic solver, one move a second, and each move says why. First to clear wins;
 * opening a bad commit loses. Tap opens, a long press, a right click or Flag mode flags. A finished game goes on Verse's arcade ladder.
 */
import * as S from './null-sweep-rules.js';
import { studioCard, every, verdict } from '../lib/studio-card.js';
import { finish } from '../lib/ladder.js';

export function nullSweepOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)?\s*(?:a\s+)?(?:game\s+of\s+)?(?:(?:verse|void|v01d)\s+)?(?:null\s+sweep|minesweeper|mine\s+sweeper|mine\s+clearing|sweep\s+the\s+(?:void|verse))(?:\s+game)?(?:\s+(?:with|against|vs)\s+(?:me|(?:verse|void)|you))?$/.test(t);
}

const COL = ['', '#6cb6ff', '#4ef0a0', '#ff8a7a', '#c39bff', '#ffd04a', '#4fe3e3', '#ffffff', '#aaaaaa'];

function mount(th, stageApi) {
  const c = studioCard(th, stageApi, { cls: 'nsweep', title: 'Null Sweep', sub: 'you against Verse, one board', width: 320 });
  let you, vs, seed, flagMode = false, result = '', stop = null, started = false;
  const cells = [];
  c.body.style.cssText = 'display:grid;grid-template-columns:repeat(' + S.W + ',1fr);gap:2px;user-select:none;touch-action:manipulation';
  for (let i = 0; i < S.W * S.H; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ns-cell'; b.dataset.i = i;
    b.style.cssText = 'aspect-ratio:1;min-width:0;padding:0;border-radius:4px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:inherit;font:700 14px system-ui;cursor:pointer';
    let press = 0, long = false;
    b.addEventListener('pointerdown', () => { long = false; press = setTimeout(() => { long = true; act(i, true); }, 450); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(press));
    b.addEventListener('click', (e) => { e.stopPropagation(); if (long) { long = false; return; } act(i, flagMode); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); act(i, true); });
    c.body.appendChild(b); cells.push(b);
  }
  const flagBtn = c.button('Flag mode: off', () => { flagMode = !flagMode; flagBtn.textContent = 'Flag mode: ' + (flagMode ? 'on' : 'off'); flagBtn.setAttribute('aria-pressed', String(flagMode)); }, 'ns-flag');
  flagBtn.setAttribute('aria-pressed', 'false');
  const bar = document.createElement('div'); bar.className = 'ns-verse'; bar.style.cssText = 'height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:8px;overflow:hidden';
  const fill = document.createElement('div'); fill.style.cssText = 'height:100%;width:0;background:#a070ff;transition:width .4s'; bar.appendChild(fill); c.body.after(bar);

  function reset() {
    seed = (Date.now() & 0xffff) || 7; you = S.create(seed); vs = S.create(seed); result = ''; started = false; if (stop) stop(); stop = null;
    c.el.dataset.result = ''; paint();
  }
  function act(i, asFlag) {
    if (result || you.over) return;
    if (asFlag) S.flag(you, i); else S.open(you, i);
    if (!started) { started = true; stop = every(c.el, 900, verse); }
    settle(); paint();
  }
  function verse() { if (result || vs.over) return; const m = S.botMove(vs); if (!m) return; S.apply(vs, m); settle(); paint(); }
  function settle() {
    if (result) return;
    result = you.over === 'win' ? 'you' : vs.over === 'win' ? 'void' : you.over === 'boom' ? 'void' : vs.over === 'boom' ? 'you' : '';
    if (result) { if (stop) stop(); stop = null; c.el.dataset.result = result; try { finish('null-sweep', result); } catch (_) { /* the ladder is a convenience */ } }
  }
  function paint() {
    const safe = S.W * S.H - you.mines;
    cells.forEach((b, i) => {
      const open = you.open[i], flag = you.flag[i], boom = you.over && you.mine[i];
      b.disabled = !!(open || you.over || result);
      b.style.background = open ? 'rgba(255,255,255,.03)' : boom ? 'rgba(255,90,90,.45)' : 'rgba(255,255,255,.1)';
      b.style.color = COL[open ? S.count(you, i) : 0] || '#fff';
      b.textContent = open ? (S.count(you, i) || '') : flag ? '⚑' : boom ? '✹' : '';
      b.setAttribute('aria-label', 'row ' + (Math.floor(i / S.W) + 1) + ', column ' + ((i % S.W) + 1) + ': ' + (open ? (S.count(you, i) || 'empty') : flag ? 'flagged' : boom ? 'a bad commit' : 'closed'));
    });
    const opened = vs.open.reduce((a, b) => a + b, 0);
    fill.style.width = Math.round((opened / safe) * 100) + '%';
    c.status.textContent = result ? verdict(result, 'You cleared it first', you.over === 'boom' ? 'You opened a bad commit' : 'Verse cleared it first') + ' · ' + S.safeLeft(you) + ' cells were left' : !started ? 'Tap a cell to start · long-press or right-click to flag' : S.flagsLeft(you) + ' bad commits left to flag · ' + S.safeLeft(you) + ' cells to open';
    c.why.textContent = started ? 'Verse (' + opened + ' of ' + safe + ' opened): ' + (vs.over === 'boom' ? 'opened a bad commit' : vs.why || 'thinking') : '';
  }
  c.again.addEventListener('click', (e) => { e.stopPropagation(); reset(); });
  reset();
}

async function run(text, api) {
  if (!nullSweepOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'null-sweep');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'null-sweep'; }
  api.summon('null-sweep', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 50 });
  api.say('Null Sweep · you and Verse clear the same board · long-press or right-click flags');
  return 'null-sweep';
}

export default {
  name: 'null-sweep',
  nullSweepOf,
  examples: ['null sweep', 'minesweeper', 'play minesweeper', 'sweep the void', "let's play null sweep", 'null sweep against verse'],
  nearMisses: ['sweep the floor', 'how do I sweep a chimney', 'minesweeper solver algorithm', 'what is a landmine', 'play chess', 'sweepstakes rules'],
  match(lower, text) { return !!nullSweepOf(text); },
  run,
  stageKinds: { 'null-sweep': { mount } },
};
