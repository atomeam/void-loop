/**
 * ask-diff skill - `diff "make a timer" and "make a focus timer for writing"` (asked by the owner, 2026-10-18, stage pack G). Runs both asks
 * through the stage's own ask path in turn (api.stage.ask), captures what each one made (the card's text and the state of any thing it
 * made or changed), puts the stage back exactly as it was (the two temporary cards and things are removed, a thing an ask changed is
 * restored), and shows one card with only what CHANGED between the two answers: lines added, removed, changed; unchanged runs collapsed.
 * An ask that opens no card is said so on its side. Both asks must be in quotes, so "diff command in git" goes where it went. The
 * line diff is pure (lib/linediff.js, tools/stage-pack-g.test.mjs). Nothing leaves the page; the asks run as if typed.
 */
import { linesOf, diffLines, collapse, identical, diffAsk } from '../lib/linediff.js';

const SKIP_KEYS = new Set(['id', 'x', 'y', 'z', 'startedAt', 'w', 'h']);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** the state of a thing as lines "key: value" under its kind. Pure. */
export function stateLines(t) {
  if (!t) return [];
  const out = ['[' + (t.kind || 'thing') + ']'];
  for (const k of Object.keys(t).sort()) {
    const v = t[k];
    if (SKIP_KEYS.has(k) || k === 'kind' || v == null || typeof v === 'object' || typeof v === 'function') continue;
    out.push(k + ': ' + (/^(duration|remaining)$/.test(k) && Number.isFinite(v) ? Math.round(v / 1000) + ' s' : String(v).slice(0, 200)));
  }
  return out;
}
/** the lines a card shows: its text without its buttons and chrome. */
function cardLines(page) {
  const c = page.cloneNode(true);
  for (const x of c.querySelectorAll('button, .vtell, .vread, .rating-note, [aria-live], [role="status"], .sr-only, script, style, svg, canvas')) x.remove();
  return linesOf(c.innerText != null && c.innerText !== '' ? c.innerText : c.textContent);
}
const snap = (things) => { const o = {}; for (const [id, t] of Object.entries(things)) o[id] = JSON.stringify(t); return o; };

/** run one ask through the stage and report { lines | null, undo() }. */
async function capture(st, ask) {
  const before = snap(st.things()), pagesBefore = new Set(document.querySelectorAll('.vpage'));
  await st.ask(ask);
  let page = null, last = '';
  for (let i = 0; i < 8; i++) {
    const fresh = [...document.querySelectorAll('.vpage')].filter((p) => !pagesBefore.has(p)).pop() || null;
    const now = fresh ? fresh.textContent : '';
    page = fresh;
    if (i >= 1 && now === last) break;
    last = now; await wait(200);
  }
  const lines = page ? cardLines(page) : [];
  const things = st.things(), made = [], changed = [];
  for (const [id, t] of Object.entries(things)) { if (!(id in before)) made.push(id); else if (JSON.stringify(t) !== before[id]) changed.push(id); }
  for (const id of [...made, ...changed]) lines.push(...stateLines(things[id]));
  const undo = () => {
    for (const id of made) delete things[id];
    for (const id of changed) { if (things[id]) { for (const k of Object.keys(things[id])) delete things[id][k]; Object.assign(things[id], JSON.parse(before[id])); } }
    if (page && typeof st.closePage === 'function') st.closePage();
    if (st.selected() && !things[st.selected()]) st.select(null);
    st.save(); st.render();
  };
  return { lines: page || made.length || changed.length ? lines : null, undo };
}

let busy = false;
async function run(text, api) {
  const want = diffAsk(text);
  if (!want) return 'none';
  const { showPage, esc } = api, st = api.stage;
  if (busy) { api.say('already comparing · one moment'); return 'ask-diff'; }
  busy = true;
  let A, B;
  try {
    api.say('comparing two asks');
    A = await capture(st, want.a); A.undo();
    B = await capture(st, want.b); B.undo();
  } finally { busy = false; }
  const rows = A.lines && B.lines ? diffLines(A.lines, B.lines) : [];
  const shown = collapse(rows), same = A.lines && B.lines && identical(rows);
  const q = (s) => '“' + esc(s) + '”';
  const side = (ask, lines) => (lines ? '' : '<p class="ad-none">' + q(ask) + ' opened no card</p>');
  const row = (r) => r.t === 'skip' ? '<div class="ad-row skip" style="opacity:.55">· ' + r.n + ' unchanged line' + (r.n === 1 ? '' : 's') + '</div>'
    : r.t === 'add' ? '<div class="ad-row add" style="color:#7ddc8a">+ ' + esc(r.b) + '</div>'
    : r.t === 'del' ? '<div class="ad-row del" style="color:#ff8a8a">− ' + esc(r.a) + '</div>'
    : '<div class="ad-row chg">~ <span style="color:#ff8a8a;text-decoration:line-through">' + esc(r.a) + '</span> → <span style="color:#7ddc8a">' + esc(r.b) + '</span></div>';
  showPage((el) => {
    el.innerHTML = '<h2>' + esc('Ask diff') + '</h2><div class="ad-asks">A ' + q(want.a) + ' · B ' + q(want.b) + '</div>'
      + side(want.a, A.lines) + side(want.b, B.lines)
      + (A.lines && B.lines ? (same ? '<p class="ad-same">no difference between the two answers</p>' : '<div class="ad-rows" style="margin:8px 0">' + shown.map(row).join('') + '</div>') : '')
      + '<div class="src">Source: both asks run on this stage just now and removed again · only what changed is shown</div>';
  });
  api.say('');
  return 'ask-diff';
}

export default {
  name: 'ask-diff',
  examples: ['diff "make a timer" and "make a focus timer for writing"', 'compare "clock" with "world clock"'],
  nearMisses: ['diff command in git', 'what is the diff between two files', 'compare iphone and android'],
  match(lower, text) { return !!diffAsk(text || lower); },
  run,
  diffAsk, stateLines,
};
