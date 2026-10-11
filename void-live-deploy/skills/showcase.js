/**
 * showcase skill: "look what I made". Void puts what it built since you were last here on the real stage, one thing at a
 * time, instead of a changelog to read (the owner, 2026-10-11: overnight growth should hit you when you open the page).
 * "show me what you made", "what's new", "what did you make for me", "look what you did": the newest five. A returning
 * visitor also gets one quiet line on their first touch, "I made 3 new things while you were away · show me" (nudge below,
 * called by the page); a first visit gets nothing, so the empty page stays empty.
 * Each step runs the change's own ask through the stage (stageApi.ask), so the actual card or thing appears; a small bar
 * above the ask box says "1 of 3", the change in plain words, and Next → (takes that step's things away and runs the next),
 * Keep (leaves them and runs the next) and Done. The person moves it on: it never advances by itself (the owner's choice).
 * Where the ask comes from: the ledger line's `try` (tools/finish.mjs --try), else a few recent builds named in KNOWN
 * (old ledger lines are never edited). Never a quoted ask fished out of a line: tried, it ran "call this my morning" and
 * saved a routine; a demo must change nothing the person did not ask for, so each ask here is one a person chose. Seen is kept on this device
 * only (a2m.void.growthSeen.v1, the newest `at` shown); nothing is sent anywhere.
 */
export const SEEN_KEY = 'a2m.void.growthSeen.v1';
export const LEDGER_URL = '/void.growth.json';
const SHOWN_KINDS = new Set(['grow', 'build', 'fix']);
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:hey\s+)?void,?\s+)?(?:please\s+)?(?:show\s+me\s+what(?:'s|\s+is)\s+new|what(?:'s|\s+is)\s+new(?:\s+(?:with\s+you|in\s+void|here))?|show\s+me\s+what\s+you(?:'ve)?\s+(?:made|built|did|learned)|what\s+did\s+you\s+(?:make|build)(?:\s+for\s+me)?|what\s+have\s+you\s+(?:made|built)|look\s+what\s+you\s+(?:did|made))(?:\s+(?:today|lately|recently|overnight|while\s+i\s+was\s+away))?$/;

/** the ask wants the walkthrough. Pure. */
export const showcaseOf = (text) => ASK_RE.test(CLEAN(text));

// recent visible builds whose ledger lines came before `show` and `try` existed
export const KNOWN = [
  { match: /^sticky notes look like real paper/i, show: 'sticky notes look like real paper', try: 'sticky note buy milk' },
  { match: /^do you love me\?: answered/i, show: 'Void answers "do you love me?" in its own words', try: 'do you love me?' },
  { match: /^Four in a Row looks finished/i, show: 'Four in a Row: the winning four light up', try: 'four in a row' },
  { match: /^Void played Othello against itself/i, show: 'Void knows how good it is at Othello', try: 'how good are you at othello' },
  { match: /^(?:Ask Void how good it is at Connect Four|Void now learns Connect Four)/i, show: 'Void learns Connect Four a little every day', try: 'how good are you at connect four' },
  { match: /^Ask whether coral can survive heatwaves/i, show: 'the coral card reads the Florida Keys reef live', try: 'can coral survive heatwaves' },
];

/** a ledger line cut to what a person reads: the first clause, at most 90 characters. Pure. */
export function lineOf(what) {
  const s = String(what || '').replace(/\s+/g, ' ').trim();
  const cut = s.split(/(?<=[a-z0-9)"])[:;](?=\s)/i)[0].trim();
  return cut.length > 90 ? cut.slice(0, 89).replace(/\s+\S*$/, '') + '…' : cut;
}

/** { line, ask } for a ledger entry that can be shown on the stage, or null. Pure. */
export function playable(e) {
  if (!e || !SHOWN_KINDS.has(e.kind)) return null;
  if (e.try) return { line: e.show || lineOf(e.what), ask: e.try };
  const k = KNOWN.find((x) => x.match.test(String(e.what || '')));
  return k ? { line: k.show, ask: k.try } : null;
}

/** the entries newer than `seenAt` (all of them when it is empty), newest first. Pure. */
export function sinceLast(entries, seenAt = '') {
  return (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e.at === 'string' && (!seenAt || e.at > seenAt))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** up to n steps from newest-first entries, each ask once: [{ line, ask, at }]. Pure. */
export function pick(entries, n = 5) {
  const out = [], asks = new Set();
  for (const e of entries) {
    const p = playable(e);
    if (!p || asks.has(CLEAN(p.ask))) continue;
    asks.add(CLEAN(p.ask)); out.push({ ...p, at: e.at });
    if (out.length >= n) break;
  }
  return out;
}

/** the newest `at` in the ledger. Pure. */
export const newestAt = (entries) => (Array.isArray(entries) ? entries : []).reduce((m, e) => (e && typeof e.at === 'string' && e.at > m ? e.at : m), '');

const read = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
async function ledger() {
  const r = await fetch(LEDGER_URL, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

let tour = null; // the walkthrough on screen: { steps, i, made, bar, newest }

// the bar sits just above the ask box and above an open card (a step's card must not cover its own controls)
function bar() {
  let el = document.getElementById('showcase-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'showcase-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'What Void made');
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);width:min(720px,calc(100% - 32px));box-sizing:border-box;z-index:60;padding:8px 12px;border-radius:12px;'
      + 'background:rgba(20,22,30,.9);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.4);'
      + 'color:var(--ink-2,#b9bdcb);font-size:13px;line-height:1.35;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px';
    document.body.appendChild(el);
    el._place = () => { const d = document.getElementById('dock'); el.style.bottom = ((d ? d.getBoundingClientRect().height : 72) + 6) + 'px'; };
    addEventListener('resize', el._place);
  }
  el._place();
  return el;
}

function button(label, on) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.style.cssText = 'font:inherit;color:var(--ink,#e9ebf2);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:3px 11px;cursor:pointer';
  b.addEventListener('click', on);
  return b;
}

function end(stageApi) {
  if (!tour) return;
  if (tour.newest && tour.newest > read(SEEN_KEY)) write(SEEN_KEY, tour.newest);
  const el = document.getElementById('showcase-bar'); if (el) { removeEventListener('resize', el._place); el.remove(); }
  removeEventListener('keydown', tour.esc, true);
  tour = null;
}

// take away what the last step put up (Next), unless it was kept
function clear(stageApi) {
  if (!tour || !tour.made) return;
  const things = stageApi.things();
  for (const id of tour.made.ids) delete things[id];
  if (tour.made.ids.length) { stageApi.select(null); stageApi.save(); stageApi.render(); }
  const pg = document.querySelector('.vpage');
  if (pg && pg !== tour.made.pageBefore && stageApi.closePage) stageApi.closePage(); // the card this step opened
  tour.made = null;
}

async function step(stageApi) {
  if (!tour) return;
  if (tour.i >= tour.steps.length) { end(stageApi); stageApi.say(''); return; }
  const s = tour.steps[tour.i], el = bar();
  el.textContent = '';
  const head = document.createElement('span');
  head.style.cssText = 'color:var(--ink-3,#8b90a0);white-space:nowrap';
  head.textContent = (tour.i + 1) + ' of ' + tour.steps.length + ' · ' + tour.label;
  const line = document.createElement('span');
  line.className = 'showcase-line';
  line.style.cssText = 'color:var(--ink,#e9ebf2);flex:1 1 220px';
  line.textContent = s.line;
  const ctl = document.createElement('span');
  ctl.style.cssText = 'display:flex;gap:6px;margin-left:auto';
  const last = tour.i === tour.steps.length - 1;
  ctl.append(button(last ? 'Done' : 'Next →', () => { clear(stageApi); tour.i++; step(stageApi); }),
    button('Keep', () => { tour.made = null; tour.i++; step(stageApi); }), ...(last ? [] : [button('Done', () => { clear(stageApi); end(stageApi); })]));
  ctl.firstChild.dataset.showcase = 'next'; ctl.children[1].dataset.showcase = 'keep'; if (!last) ctl.children[2].dataset.showcase = 'done';
  el.append(head, line, ctl);
  const before = new Set(Object.keys(stageApi.things())), pageBefore = document.querySelector('.vpage');
  tour.made = { ids: [], pageBefore };
  await stageApi.ask(s.ask);
  if (!tour || tour.steps[tour.i] !== s) return;
  tour.made.ids = Object.keys(stageApi.things()).filter((id) => !before.has(id));
}

/** start the walkthrough over these steps */
export function start(stageApi, steps, { label = 'Built while you were away', newest = '' } = {}) {
  if (tour) end(stageApi);
  if (!steps.length) return false;
  tour = { steps, i: 0, made: null, label, newest, esc: (e) => { if (e.key === 'Escape' && tour && !document.querySelector('.vpage.on')) end(stageApi); } };
  addEventListener('keydown', tour.esc, true);
  step(stageApi);
  return true;
}

/** the page calls this once, on a returning visitor's first touch: the quiet line, or nothing (a first visit only remembers now) */
export async function nudge(stageApi, note) {
  const seen = read(SEEN_KEY);
  if (!seen) { write(SEEN_KEY, new Date().toISOString().replace(/\.\d+Z$/, 'Z')); return 0; }
  let list = [];
  try { list = await ledger(); } catch (_) { return 0; }
  const steps = pick(sinceLast(list, seen));
  const newest = newestAt(list);
  if (!steps.length) { if (newest > seen) write(SEEN_KEY, newest); return 0; }
  if (!note) return steps.length;
  const n = steps.length;
  const lead = document.createElement('span');
  lead.className = 'showcase-pill';
  lead.textContent = (note.textContent ? note.textContent + ' · ' : '') + 'I made ' + (n === 1 ? 'a new thing' : n + ' new things') + ' while you were away · ';
  const go = document.createElement('a');
  go.href = '#'; go.className = 'away-see'; go.textContent = 'show me'; go.dataset.showcase = 'show';
  go.addEventListener('click', (e) => { e.preventDefault(); note.textContent = ''; start(stageApi, steps, { newest }); });
  note.textContent = ''; note.append(lead, go);
  return n;
}

async function run(text, api) {
  const stageApi = api.stage;
  let list = [];
  try { list = await ledger(); } catch (_) { api.say("can't read what I made just now"); return 'none'; }
  const seen = read(SEEN_KEY);
  const fresh = seen ? pick(sinceLast(list, seen)) : [];
  const steps = fresh.length ? fresh : pick(sinceLast(list));
  if (!steps.length) { api.say('nothing new to show yet'); return 'none'; }
  start(stageApi, steps, { label: fresh.length ? 'Built while you were away' : 'Built lately', newest: newestAt(list) });
  return 'showcase';
}

export default {
  name: 'showcase',
  examples: ['show me what you made', "what's new", 'what did you make for me', 'look what you did'],
  nearMisses: ["what's new in the news", 'show me what you can do', 'what did you make for dinner'],
  match(lower, text) { return showcaseOf(text || lower); },
  run,
};
