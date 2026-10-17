/**
 * showcase skill: "look what I made". Void puts what it built since you were last here on the real stage, one thing at a
 * time, instead of a changelog to read (the owner, 2026-10-11: overnight growth should hit you when you open the page).
 * "show me what you made", "what's new", "what did you make for me", "look what you did": everything built since you were last here,
 * newest first, with no ceiling (owner, 2026-10-16: "there should not be a limit or stopping point to what it makes or can show you";
 * it used to stop at five). One at a time, so a thousand is as easy to page through as three; Done ends it whenever you like. A returning
 * visitor also gets one quiet line on their first touch, "I made 1,204 new things while you were away · show me" (the true count) (nudge below,
 * called by the page); a first visit gets nothing, so the empty page stays empty.
 * Each step runs the change's own ask through the stage (stageApi.ask), so the actual card or thing appears; a small bar
 * above the ask box says "1 of 3", the change in plain words, and Next → (takes that step's things away and runs the next),
 * Keep (leaves them and runs the next) and Done. The person moves it on: it never advances by itself (the owner's choice).
 * Where the ask comes from: the ledger line's `try` (tools/finish.mjs --try), else a few recent builds named in KNOWN
 * (old ledger lines are never edited). Never a quoted ask fished out of a line: tried, it ran "call this my morning" and
 * saved a routine; a demo must change nothing the person did not ask for, so each ask here is one a person chose.
 * Previewed once (owner, 2026-10-16: "it's only supposed to preview once"): the asks offered are remembered on this device the moment the
 * line shows (a2m.void.shown.v1), tapped or not, and never offered again; what is new is what is not in that list. A first visit only
 * remembers when it was (a2m.void.growthSeen.v1), so a newcomer is not told about everything ever built. Nothing is sent anywhere.
 */
import { publicWhat } from './growth-tree.js'; // the site leaves out quotes of the owner's messages
export const SEEN_KEY = 'a2m.void.growthSeen.v1'; // when this device first visited: nothing older is ever new to it (a first visit stays empty)
export const SHOWN_KEY = 'a2m.void.shown.v1'; // the asks already previewed here: a thing is previewed once, then never offered again
export const LEDGER_URL = '/void.growth.json';
const SHOWN_KINDS = new Set(['grow', 'build', 'fix']);
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:hey\s+)?void,?\s+)?(?:please\s+)?(?:show\s+me\s+what(?:'?s|\s+is)\s+new|what(?:'?s|\s+is)\s+new(?:\s+(?:with\s+you|in\s+void|here))?|show\s+me\s+what\s+you(?:'ve)?\s+(?:made|built|did|learned)|what\s+did\s+you\s+(?:make|build)(?:\s+for\s+me)?|what\s+have\s+you\s+(?:made|built)|look\s+what\s+you\s+(?:did|made))(?:\s+(?:today|lately|recently|overnight|while\s+i\s+was\s+away))?$/;

/** the ask wants the walkthrough. Pure. */
export const showcaseOf = (text) => ASK_RE.test(CLEAN(text));

// recent visible builds whose ledger lines came before `show` and `try` existed
export const KNOWN = [
  { match: /^sticky notes look like real paper/i, show: 'sticky notes look like real paper', try: 'sticky note buy milk' },
  { match: /^do you love me\?: answered/i, show: 'V01D answers "do you love me?" in its own words', try: 'do you love me?' },
  { match: /^Four in a Row looks finished/i, show: 'Four in a Row: the winning four light up', try: 'four in a row' },
  { match: /^Void played Othello against itself/i, show: 'V01D knows how good it is at Othello', try: 'how good are you at othello' },
  { match: /^(?:Ask Void how good it is at Connect Four|Void now learns Connect Four)/i, show: 'V01D learns Connect Four a little every day', try: 'how good are you at connect four' },
  { match: /^Ask whether coral can survive heatwaves/i, show: 'the coral card reads the Florida Keys reef live', try: 'can coral survive heatwaves' },
];

/** a ledger line cut to what a person reads: the first clause, at most 90 characters. Pure. */
export function lineOf(what) {
  const s = publicWhat(what).replace(/\s+/g, ' ').trim();
  const cut = s.split(/(?<=[a-z0-9)"])[:;](?=\s)/i)[0].trim();
  return cut.length > 90 ? cut.slice(0, 89).replace(/\s+\S*$/, '') + '…' : cut;
}

/** { line, ask } for a ledger entry that can be shown on the stage, or null. Pure. */
export function playable(e) {
  if (!e || !SHOWN_KINDS.has(e.kind)) return null;
  if (!lineOf(e.what)) return null; // a line about what Void studies is never shown
  if (e.try) return showcaseOf(e.try) ? null : { line: e.show || lineOf(e.what), ask: e.try }; // never the walkthrough itself
  const k = KNOWN.find((x) => x.match.test(String(e.what || '')));
  return k ? { line: k.show, ask: k.try } : null;
}

/** the entries newer than `after` (all of them when it is empty), newest first. Pure. */
export function sinceLast(entries, after = '') {
  return (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e.at === 'string' && (!after || e.at > after))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/**
 * What is new to show: the playable entries (newest first) whose ask has not been previewed on this device, each ask once.
 * `shown` is the set of asks already previewed here (cleaned); `verified` (claims-verified.json, tools/claims-verify.mjs) is the
 * set of asks seen to answer with their own card: a build not on it is never played as built (Adam, 2026-10-15: no claiming what
 * doesn't answer). It is not marked shown either, so it is offered the day it answers. Returns { steps, waiting }. Pure.
 */
export function whatsNew(entries, { shown = new Set(), verified = null, n = Infinity } = {}) {
  const steps = [], waiting = [], asks = new Set(shown);
  for (const e of entries) {
    const p = playable(e);
    if (!p || asks.has(CLEAN(p.ask))) continue;
    asks.add(CLEAN(p.ask));
    if (verified && !verified.has(CLEAN(p.ask))) { waiting.push({ ...p, at: e.at }); continue; }
    steps.push({ ...p, at: e.at });
    if (steps.length >= n) break;
  }
  return { steps, waiting };
}

/** the tray of the walkthrough (asked by Void: "make the What's new walkthrough interactive, grab a newly shipped skill from it and drop it
 *  on the stage to test it"): the steps after the current one, up to `max`, each { j, line } with its line cut to fit a chip. Pure. */
export const TRAY = 6;
export function trayOf(steps, i, max = TRAY) {
  const out = [];
  for (let j = i + 1; j < (steps || []).length && out.length < max; j++) { const l = String(steps[j].line || ''); out.push({ j, line: l.length > 38 ? l.slice(0, 37).replace(/\s+\S*$/, '') + '…' : l }); }
  return out;
}
/** where a chip dropped at (x, y) puts its things: the delta that brings the first new thing's corner to the drop point, kept inside
 *  the stage (w × h, with a margin). null when nothing moved there (no thing, or not a drop on the stage). Pure. */
export function dropDelta(first, x, y, w, h, margin = 8) {
  if (!first || !Number.isFinite(+first.x) || !Number.isFinite(+first.y) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tx = Math.max(margin, Math.min(w - 120, x - 40)), ty = Math.max(margin, Math.min(h - 80, y - 20));
  return { dx: Math.round(tx - first.x), dy: Math.round(ty - first.y) };
}

/** the newest `at` in the ledger. Pure. */
export const newestAt = (entries) => (Array.isArray(entries) ? entries : []).reduce((m, e) => (e && typeof e.at === 'string' && e.at > m ? e.at : m), '');

const read = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
/** the asks already previewed on this device (cleaned); bounded, so it stays small however much V01D makes */
export function shownSet() { try { return new Set(JSON.parse(read(SHOWN_KEY) || '[]')); } catch (_) { return new Set(); } }
export function markShown(steps) {
  const all = [...shownSet()]; for (const s of steps || []) { const a = CLEAN(s.ask); if (a && !all.includes(a)) all.push(a); }
  write(SHOWN_KEY, JSON.stringify(all.slice(-3000)));
}
export const VERIFIED_URL = '/claims-verified.json';
async function ledger() {
  const r = await fetch(LEDGER_URL, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
// the verified asks; when the list can't be read nothing counts as verified (no claim without proof)
async function verifiedSet() {
  try { const r = await fetch(VERIFIED_URL, { cache: 'no-cache' }); const j = r.ok ? await r.json() : {}; return new Set((j.ok || []).map(CLEAN)); } catch (_) { return new Set(); }
}

let tour = null; // the walkthrough on screen: { steps, i, made, bar }

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
  head.textContent = (tour.i + 1).toLocaleString('en') + ' of ' + tour.steps.length.toLocaleString('en') + ' · ' + tour.label;
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
  const items = trayOf(tour.steps, tour.i);
  if (items.length) { // the tray: grab a coming step and drop it on the stage to try it now (a tap tries it too)
    const tray = document.createElement('span');
    tray.className = 'showcase-tray';
    tray.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1 1 100%;align-items:center;color:var(--ink-3,#8b90a0)';
    tray.append(document.createTextNode('grab one onto the stage:'));
    for (const it of items) tray.append(chip(stageApi, it));
    el.append(tray);
  }
  const before = new Set(Object.keys(stageApi.things())), pageBefore = document.querySelector('.vpage');
  tour.made = { ids: [], pageBefore };
  await stageApi.ask(s.ask);
  if (!tour || tour.steps[tour.i] !== s) return;
  tour.made.ids = Object.keys(stageApi.things()).filter((id) => !before.has(id));
  // the preview has to show the thing it names (owner, 2026-10-16: "the preview is supposed to actually preview what it says"):
  // a moment for the card to land, then proof: a new thing on the stage, a new card, or the page's own log saying a skill
  // answered (not the encyclopedia, not a miss). Without proof the line says so, and the ask goes to the miss board as a
  // preview that showed nothing, so the builders fix the ledger line's try or the skill.
  for (let t = 0; t < 10 && !lastLog(s.ask); t++) await new Promise((r) => setTimeout(r, 150)); // the log line lands a moment after the answer
  await new Promise((r) => setTimeout(r, 300));
  if (!tour || tour.steps[tour.i] !== s) return;
  const pageNow = document.querySelector('.vpage');
  if (!proved({ madeIds: tour.made.ids, pageChanged: !!pageNow && pageNow !== pageBefore, log: lastLog(s.ask) })) {
    line.textContent = s.line + ' · but nothing showed just now: I flagged it for the builders';
    line.dataset.showcaseFailed = '1';
    try { fetch('/api/miss', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: String(s.ask).slice(0, 200), fallback: 'preview:nothing-shown' }), keepalive: true }).catch(() => {}); } catch (_) {}
  }
}

// a step chip in the tray: drag it out of the bar and let go over the stage, and that step runs now with its things where it landed;
// a tap (no drag) runs it in place. Pointer events, so mouse, pen and touch all grab it.
function chip(stageApi, it) {
  const b = button(it.line, () => {}); b.dataset.showcaseGrab = String(it.j); b.title = 'drag onto the stage to try it'; b.style.touchAction = 'none'; b.style.cursor = 'grab';
  let from = null, ghost = null;
  b.addEventListener('pointerdown', (e) => { if (e.button) return; from = { x: e.clientX, y: e.clientY }; try { b.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  b.addEventListener('pointermove', (e) => {
    if (!from) return;
    if (!ghost && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 6) {
      ghost = b.cloneNode(true); ghost.removeAttribute('data-showcase-grab'); ghost.className = 'showcase-ghost';
      ghost.style.cssText += ';position:fixed;z-index:70;pointer-events:none;opacity:.9;transform:translate(-50%,-50%) rotate(-3deg);box-shadow:0 8px 20px rgba(0,0,0,.45)';
      document.body.appendChild(ghost);
    }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  });
  const up = (e, cancel) => {
    if (!from) return; const dragged = !!ghost; from = null; if (ghost) { ghost.remove(); ghost = null; }
    if (cancel) return;
    const bar = document.getElementById('showcase-bar'), r = bar && bar.getBoundingClientRect();
    const onBar = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (dragged && onBar) return; // let go back on the bar: nothing happens
    jump(stageApi, it.j, dragged ? { x: e.clientX, y: e.clientY } : null);
  };
  b.addEventListener('pointerup', (e) => up(e, false));
  b.addEventListener('pointercancel', (e) => up(e, true));
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(stageApi, it.j, null); } });
  return b;
}

// run step j now (what the current step put up goes, as with Next); dropped at a point, its new things move there
async function jump(stageApi, j, at) {
  if (!tour || !(j > tour.i && j < tour.steps.length)) return;
  clear(stageApi); tour.i = j;
  const s = tour.steps[j];
  await step(stageApi);
  if (!at || !tour || tour.steps[tour.i] !== s || !tour.made || !tour.made.ids.length) return;
  const st = stageApi.stage, rect = st && st.getBoundingClientRect ? st.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const things = stageApi.things(), first = things[tour.made.ids[0]];
  const d = dropDelta(first, at.x - rect.left, at.y - rect.top, rect.width, rect.height);
  if (!d) return;
  for (const id of tour.made.ids) { const th = things[id]; if (!th || !Number.isFinite(+th.x)) continue; th.x = +th.x + d.dx; th.y = +th.y + d.dy; if (th.card) th.card = { x: th.card.x + d.dx, y: th.card.y + d.dy }; }
  stageApi.save(); stageApi.render();
  if (tour) tour.dropped = { ids: tour.made.ids.slice(), x: Math.round(at.x), y: Math.round(at.y) };
  document.body.dataset.showcaseDropped = String(j);
}

// what the page logs when an ask fell through to the encyclopedia or a generic answer, or missed (tools/claims-verify.mjs FALLBACK)
const FALLTHROUGH = /^(?:article|answer|short topic|article fallback)$|^miss/;
/** did the preview show the thing? The page's own log decides first: an ask that fell through to the encyclopedia or the generic
 *  answer opened a card too, and that card is not the thing. Otherwise a new thing on the stage or a new card is proof; failing
 *  those, the log has to say a skill answered. Pure. */
export function proved({ madeIds = [], pageChanged = false, log = null } = {}) {
  if (log && FALLTHROUGH.test(String(log.note || ''))) return false;
  if ((madeIds && madeIds.length) || pageChanged) return true;
  return !!(log && log.score === 'pass' && log.note);
}
/** the page's newest loop-log entry for this ask (void.html loopLog, localStorage), or null */
function lastLog(ask) {
  try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return (Array.isArray(l) ? l : []).filter((x) => x && CLEAN(x.ask) === CLEAN(ask)).pop() || null; } catch (_) { return null; }
}

/** start the walkthrough over these steps */
export function start(stageApi, steps, { label = 'Built while you were away' } = {}) {
  if (tour) end(stageApi);
  if (!steps.length) return false;
  const bl = typeof document !== 'undefined' && document.getElementById('whatsnew-bell'); if (bl) bl.remove(); // the walkthrough has begun, the icon has done its job
  tour = { steps, i: 0, made: null, label, esc: (e) => { if (e.key === 'Escape' && tour && !document.querySelector('.vpage.on')) end(stageApi); } };
  addEventListener('keydown', tour.esc, true);
  step(stageApi);
  return true;
}

/** the page calls this once, on a returning visitor's first touch: the quiet line, or nothing (a first visit only remembers now) */
export async function nudge(stageApi, note) {
  const floor = read(SEEN_KEY);
  if (!floor) { write(SEEN_KEY, nowIso()); return 0; }
  let list = [];
  try { list = await ledger(); } catch (_) { return 0; }
  const { steps } = whatsNew(sinceLast(list, floor), { shown: shownSet(), verified: await verifiedSet() });
  if (!steps.length) return 0;
  markShown(steps); // previewed once: from here on these are never offered again on this device, whether or not the line is tapped
  if (!note) return steps.length;
  const n = steps.length;
  const lead = document.createElement('span');
  lead.className = 'showcase-pill';
  lead.textContent = (note.textContent ? note.textContent + ' · ' : '') + 'I made ' + (n === 1 ? 'a new thing' : n.toLocaleString('en') + ' new things') + ' while you were away · ';
  const go = document.createElement('a');
  go.href = '#'; go.className = 'away-see'; go.textContent = 'show me'; go.dataset.showcase = 'show';
  go.addEventListener('click', (e) => { e.preventDefault(); note.textContent = ''; start(stageApi, steps); });
  note.textContent = ''; note.append(lead, go);
  bell(stageApi, steps);
  return n;
}

/** a small animated icon on the stage for what is new (asked by Void: "Link the 'whats new' showcase trigger to a small, animated
 * notification icon on the stage to prevent users from having to type it"): a bell-less sparkle with the count, pulsing quietly; a tap
 * starts the same walkthrough as typing "what's new", and the icon and the quiet line both go. It appears only when something is new
 * (so a first visit and an empty page stay empty) and never moves anything. Pure DOM, nothing sent anywhere. */
export function bell(stageApi, steps) {
  if (typeof document === 'undefined' || !steps || !steps.length || document.getElementById('whatsnew-bell')) return null;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'whatsnew-bell'; b.className = 'whatsnew-bell';
  const n = steps.length; b.dataset.count = String(n);
  b.setAttribute('aria-label', (n === 1 ? 'Something new' : n.toLocaleString('en') + ' new things') + ' V01D made while you were away: show me');
  b.title = 'What\'s new: tap to see what V01D made';
  b.innerHTML = '<style>.whatsnew-bell{position:fixed;left:14px;bottom:14px;z-index:5;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(20,18,34,.82);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 0 0 0 rgba(158,178,255,.55);animation:wn-pulse 2.4s ease-out infinite}' // void-review: ok: static markup, the only variable is a number
    + '.whatsnew-bell svg{width:20px;height:20px;animation:wn-spin 6s linear infinite}.whatsnew-bell b{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;border-radius:9px;background:#ff6a3d;color:#fff;font:700 11px/17px system-ui,sans-serif;text-align:center;padding:0 4px;box-sizing:border-box}'
    + '@keyframes wn-pulse{0%{box-shadow:0 0 0 0 rgba(158,178,255,.55)}70%,100%{box-shadow:0 0 0 14px rgba(158,178,255,0)}}@keyframes wn-spin{to{transform:rotate(360deg)}}'
    + '@media (prefers-reduced-motion:reduce){.whatsnew-bell,.whatsnew-bell svg{animation:none}}</style>'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" fill="currentColor"/></svg><b aria-hidden="true">' + (n > 99 ? '99+' : n) + '</b>'; // void-review: ok: static markup, the count is a number
  b.addEventListener('click', (e) => { e.preventDefault(); const note = document.getElementById('away-note'); if (note) note.textContent = ''; b.remove(); start(stageApi, steps); });
  document.body.appendChild(b);
  return b;
}

/** "show me everything you made": the whole walkthrough, previewed before or not, asked for by name. Pure. */
const ALL_RE = /^(?:(?:show|walk) me (?:through )?|i want to see )?(?:everything|all(?: the things)?|every single thing) (?:you|v01d|void)(?:'ve| have|'s| has)? (?:ever )?(?:made|built|done)(?: for me)?(?: so far| ever)?$/;
export const everythingOf = (text) => ALL_RE.test(CLEAN(text));

async function run(text, api) {
  const stageApi = api.stage;
  let list = [];
  try { list = await ledger(); } catch (_) { api.say("can't read what I made just now"); return 'none'; }
  const V = await verifiedSet();
  // everything, asked for by name: every playable build, whether or not this device has been shown it (never on its own)
  if (everythingOf(text)) {
    const all = whatsNew(sinceLast(list), { verified: V }).steps;
    if (!all.length) { api.say('nothing to show yet'); return 'none'; }
    markShown(all);
    start(stageApi, all, { label: 'Everything I made' });
    return 'showcase';
  }
  const floor = read(SEEN_KEY);
  const fresh = floor ? whatsNew(sinceLast(list, floor), { shown: shownSet(), verified: V }) : { steps: [], waiting: [] };
  const wip = fresh.waiting.length ? ' · ' + fresh.waiting.length + ' more in progress (not answering yet)' : '';
  // a thing is previewed once (owner, 2026-10-16): with nothing new there is no replay, only the count and the way to see it all
  if (!fresh.steps.length) {
    const n = whatsNew(sinceLast(list), { verified: V }).steps.length;
    api.say((floor ? 'nothing new since you last looked' : 'nothing new to show yet') + wip + (n ? ' · say "show me everything you made" for all ' + n.toLocaleString('en') : ''));
    return 'none';
  }
  markShown(fresh.steps);
  start(stageApi, fresh.steps, { label: 'Built while you were away' + wip });
  return 'showcase';
}

export default {
  name: 'showcase',
  examples: ['show me what you made', "what's new", 'what did you make for me', 'look what you did', 'show me everything you made'],
  nearMisses: ["what's new in the news", 'show me what you can do', 'what did you make for dinner'],
  match(lower, text) { return showcaseOf(text || lower) || everythingOf(text || lower); },
  run,
};
