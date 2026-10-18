/**
 * type-filter skill - hide every card on the stage but one kind (asked by Void: "Create a 'type-filter' toggle on the stage to instantly
 * hide all cards except those of a specific category"). "show only clocks", "only show the notes", "hide everything except lists",
 * "filter the stage by type" (a bar of toggles, one per kind that is on the stage), "show all cards" / "clear the filter" (everything back).
 * A tap on a toggle does the same without typing. Nothing is deleted, moved or saved: filtered things are only not drawn (a hidden
 * attribute that a redraw re-applies), and a reload shows everything. A kind that is not on the stage says so, and asks that only
 * look like it ("show only the best pizza places") are not taken: the kind must be one the stage can hold.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const CLEAN = (t) => String(t || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ONLY = /^(?:(?:please\s+)?show\s+(?:me\s+)?only|only\s+show|hide\s+everything\s+(?:but|except)|hide\s+all\s+(?:but|except)|filter\s+(?:the\s+)?stage\s+(?:to|for))\s+(?:the\s+|my\s+)?([a-z0-9][a-z0-9 -]{1,30}?)(?:\s+(?:cards?|things|on\s+the\s+stage))?$/;
const BAR = /^(?:(?:filter|sort)\s+(?:the\s+)?stage(?:\s+by\s+(?:type|kind))?|(?:type|kind)\s+filter|filter\s+(?:my\s+)?cards(?:\s+by\s+type)?)$/;
const ALL = /^(?:show\s+(?:me\s+)?(?:all|every)\s+(?:the\s+)?(?:cards|things|kinds)(?:\s+again)?|(?:clear|remove|reset|turn\s+off)\s+(?:the\s+)?(?:type\s+)?filter|unfilter(?:\s+the\s+stage)?)$/;

/** what the ask wants: { op: 'only', word } | { op: 'bar' } | { op: 'all' } | null. Pure. */
export function filterOf(text) {
  const t = CLEAN(text); let m;
  if (ALL.test(t)) return { op: 'all' };
  if (BAR.test(t)) return { op: 'bar' };
  if ((m = ONLY.exec(t)) && kindFor(m[1], KNOWN)) return { op: 'only', word: m[1] }; // only a kind the stage can hold: "show only the best pizza places" is another ask
  return null;
}
/** the stage kind a word names among `kinds` ("clocks" -> clock, "notes" -> sticky via its alias), or ''. Pure. */
const ALIAS = { note: 'sticky', notes: 'sticky', 'sticky note': 'sticky', 'sticky notes': 'sticky', stickies: 'sticky', games: 'game', todo: 'list', lists: 'list', timers: 'timer', calculators: 'calc', calculator: 'calc', pictures: 'image', photos: 'image', images: 'image', videos: 'video', counters: 'counter', drawings: 'shape', shapes: 'shape' };
// every kind a stage thing can have (the stageKinds of the skills), so the match is decided before the stage is looked at
const KNOWN = ['actions', 'aggravation', 'automations', 'battleship', 'calc', 'calendar', 'cartoon', 'challenge', 'checkers', 'chess', 'clock', 'connect4', 'convert', 'countdown', 'counter', 'eightball', 'fig3d', 'figure', 'fireworks', 'forge', 'gears', 'go', 'goal', 'image', 'kept', 'label', 'link', 'list', 'lock', 'mancala', 'memory', 'monopoly', 'moon', 'notepad', 'othello', 'poker', 'pong', 'proposal', 'quiz', 'rack', 'ringer', 'shape', 'skycard', 'snake', 'sorry', 'sticky', 'tab', 'tictactoe', 'timer', 'video', 'zorbleflux', 'watch', ...Object.values(ALIAS)];
export function kindFor(word, kinds) {
  const w = CLEAN(word).replace(/^(?:the|my|all)\s+/, ''), set = new Set(kinds);
  for (const c of [w, ALIAS[w], w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''), ALIAS[w.replace(/s$/, '')]]) if (c && set.has(c)) return c;
  return '';
}
/** the kinds on the stage with their counts, most first: [{ kind, n }]. Pure. */
export function kindsOn(things) {
  const n = {}; for (const t of Object.values(things || {})) if (t && t.kind) n[t.kind] = (n[t.kind] || 0) + 1;
  return Object.entries(n).map(([kind, c]) => ({ kind, n: c })).sort((a, b) => b.n - a.n || a.kind.localeCompare(b.kind));
}

let active = '', watcher = null;
const stageEl = () => document.getElementById('stage');
/** hide what is not of the active kind; show everything when none. Idempotent: it only sets an attribute. */
export function apply(api) {
  const st = stageEl(); if (!st) return;
  const things = api.stage.things();
  for (const el of st.querySelectorAll(':scope > [data-id]')) {
    const th = things[el.dataset.id], off = !!active && !(th && th.kind === active);
    if (off) { el.setAttribute('data-filtered', ''); el.style.display = 'none'; } else if (el.hasAttribute('data-filtered')) { el.removeAttribute('data-filtered'); el.style.display = ''; }
  }
  const bar = document.getElementById('type-filter-bar');
  if (bar) for (const b of bar.querySelectorAll('button[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === active));
  document.documentElement.dataset.stageFilter = active;
}
function watch(api) {
  if (watcher) return; const st = stageEl(); if (!st) return;
  watcher = new MutationObserver(() => apply(api)); watcher.observe(st, { childList: true }); // a redraw of the stage keeps the filter
}
function drawBar(api, esc) {
  let bar = document.getElementById('type-filter-bar');
  const kinds = kindsOn(api.stage.things());
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'type-filter-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Show only one kind of card');
    bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:6;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:min(94vw,640px);padding:6px 8px;border-radius:999px;background:rgba(20,18,34,.86);border:1px solid rgba(255,255,255,.18);font:13px system-ui,sans-serif';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.dataset.close !== undefined) { active = ''; apply(api); bar.remove(); return; }
      active = b.dataset.kind === active ? '' : b.dataset.kind || ''; apply(api);
    });
  }
  const chip = 'cursor:pointer;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:inherit;padding:3px 11px;font:inherit';
  bar.innerHTML = kinds.map((k) => '<button type="button" data-kind="' + esc(k.kind) + '" aria-pressed="false" style="' + chip + '">' + esc(k.kind) + ' ' + k.n + '</button>').join('')
    + '<button type="button" data-close style="' + chip + ';opacity:.7" aria-label="Close the filter and show everything">×</button>'; // void-review: ok: kind names are escaped, the rest is static
  apply(api);
}

function run(text, api) {
  const want = filterOf(text); if (!want) return 'none';
  const { esc, say } = api, kinds = kindsOn(api.stage.things());
  watch(api);
  if (want.op === 'all') { active = ''; apply(api); const b = document.getElementById('type-filter-bar'); if (b) b.remove(); say('every card is back'); return 'type-filter'; }
  if (want.op === 'bar') {
    if (!kinds.length) { say('nothing is on the stage to filter yet'); return 'type-filter'; }
    drawBar(api, esc); say('tap a kind to show only it; tap it again for all'); return 'type-filter';
  }
  const kind = kindFor(want.word, Object.keys(api.stage.kinds()).concat(kinds.map((k) => k.kind)));
  if (!kind) return 'none'; // not a kind the stage holds: it is some other ask
  if (!kinds.some((k) => k.kind === kind)) { say('no ' + kind + ' on the stage'); return 'type-filter'; }
  active = kind; drawBar(api, esc); say('showing only ' + kind + ' · say "show all cards" for the rest');
  return 'type-filter';
}

export default {
  name: 'type-filter',
  filterOf,
  examples: ['show only clocks', 'show only notes', 'filter the stage by type', 'show all cards', 'hide everything except lists'],
  nearMisses: ['show only the best pizza places', 'only the lonely', 'show only your best work', 'filter the coffee'],
  match(lower, text) { return !!filterOf(text || lower); },
  run,
};
