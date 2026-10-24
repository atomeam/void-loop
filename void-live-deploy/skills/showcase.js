/**
 * showcase skill: "look what I made". Verse shows what it built since you were last here, on the real stage.
 * One thing at a time, instead of a changelog to read (the owner, 2026-10-11: overnight growth should hit you when you open the page).
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
import { reactionBar } from '../lib/reaction-bar.js'; // spectator reactions under a step (the closed list, /api/react)
import { targetOf } from '../lib/reactions.js';
import { dockPanel } from '../lib/placement.js'; // where the walkthrough panel goes so it never covers the open card or the ask bar
export const SEEN_KEY = 'a2m.void.growthSeen.v1'; // when this device first visited: nothing older is ever new to it (a first visit stays empty)
export const SHOWN_KEY = 'a2m.void.shown.v1'; // the asks already previewed here: a thing is previewed once, then never offered again
export const LEDGER_URL = '/void.growth.json';
const SHOWN_KINDS = new Set(['grow', 'build', 'fix']);
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:hey\s+)?(?:verse|void),?\s+)?(?:please\s+)?(?:show\s+me\s+what(?:'?s|\s+is)\s+new|what(?:'?s|\s+is)\s+new(?:,?\s+pussy\s?cat|\s+(?:with\s+you|in\s+(?:verse|void)|here))?|show\s+me\s+what\s+you(?:'ve)?\s+(?:made|built|did|learned)|what\s+did\s+you\s+(?:make|build)(?:\s+for\s+me)?|what\s+have\s+you\s+(?:made|built)|look\s+what\s+you\s+(?:did|made))(?:\s+(?:today|lately|recently|overnight|while\s+i\s+was\s+away))?$/;

/** the ask wants the walkthrough. Pure. */
export const showcaseOf = (text) => ASK_RE.test(CLEAN(text));

// recent visible builds whose ledger lines came before `show` and `try` existed
export const KNOWN = [
  { match: /^sticky notes look like real paper/i, show: 'sticky notes look like real paper', try: 'sticky note buy milk' },
  { match: /^do you love me\?: answered/i, show: 'Verse answers "do you love me?" in its own words', try: 'do you love me?' },
  { match: /^Four in a Row looks finished/i, show: 'Four in a Row: the winning four light up', try: 'four in a row' },
  { match: /^(?:Verse|Void|V01D) played Othello against itself/i, show: 'Verse knows how good it is at Othello', try: 'how good are you at othello' },
  { match: /^(?:Ask (?:Verse|Void|V01D) how good it is at Connect Four|(?:Verse|Void|V01D) now learns Connect Four)/i, show: 'Verse learns Connect Four a little every day', try: 'how good are you at connect four' },
  { match: /^Ask whether coral can survive heatwaves/i, show: 'the coral card reads the Florida Keys reef live', try: 'can coral survive heatwaves' },
];

/** a ledger line cut to what a person reads: the first clause, at most 180 characters so the richer "Why these / Added" detail survives. Pure. */
export function lineOf(what) {
  const s = publicWhat(what).replace(/\s+/g, ' ').trim();
  const cut = s.split(/(?<=[a-z0-9)"])[:;](?=\s)/i)[0].trim();
  return cut; // whole sentences, never cut with an ellipsis (owner, 2026-10-21: "i need to see the whole sentences")
}

/** what one of Verse's own upgrades did, from the line grow-self writes (it opens "Verse hardened itself:" and names the benchmark asks and
 *  the skills they are for, calendar-file, clock and web4, say): "Better at calendar file, clock and web4: 9 more ways of asking answered right". The first
 *  clause alone read "Verse hardened itself" on every one of them (owner, 2026-10-20: "it should be saying the upgrade not just Verse hardened
 *  itself a bunch of times"). null for any other line. Pure. */
export function hardenedLine(what) {
  const m = /^(?:Verse|Void|V01D) hardened itself:\s*(.+)$/i.exec(String(what || '').replace(/\s+/g, ' ').trim());
  if (!m) return null;
  const [asksPart, ...rest] = m[1].split(/\.\s+(?=Why these|New phrases|Added:|Did not route)/)[0].replace(/\.$/, '').split(/,? and (?=the card art)/i);
  const art = /card art/i.test(rest.join(' ') + ' ' + asksPart);
  const a = /^(\d+) benchmark ask\(s\) for (.+)$/i.exec(asksPart.trim());
  if (!a) return art ? 'Sharper card art: my art scores went up' : null;
  // keep the richer "Why these / Added / Did not route" tail when present (owner 2026-10-21)
  // the actual new phrases and the skill each now opens (owner, 2026-10-21: "list the actual new phrases and which skill they now open, not just a count")
  const ph = /New phrases:\s*(.+?)\.(?:\s+Did not route|\s*$)/.exec(m[1]);
  const tail = ph ? ' — new phrases: ' + ph[1].trim() : m[1].includes('Added:') ? ' — added: ' + m[1].split('Added:')[1].split(/\.\s+Did not route/)[0].replace(/\.$/, '').trim() : '';
  const names = a[2].split(/,\s*/).map((x) => x.replace(/-/g, ' ').trim()).filter(Boolean);
  const shown = names.length > 3 ? names.slice(0, 3).concat(names.length - 3 + ' more') : names;
  const list = shown.length > 1 ? shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] : shown[0];
  return 'Better at ' + list + ': ' + a[1] + ' more ways of asking answered right' + (art ? ', and sharper card art' : '') + tail;
}

/** one of Verse's own upgrades from the phrases it proved: what got better and two of the new ways of asking, short enough for one line and a
 *  tray chip. The whole list ran to ten phrases, and a line whose first clause did not parse opened with ": new phrases" (owner's screenshot,
 *  2026-10-24). '' when there are none. Pure. */
export function phrasesLine(phrases) {
  const ps = (Array.isArray(phrases) ? phrases : []).filter((p) => p && p.ask && p.skill);
  if (!ps.length) return '';
  const names = [...new Set(ps.map((p) => String(p.skill).replace(/-/g, ' ').trim()))];
  const shown = names.length > 3 ? names.slice(0, 3).concat(names.length - 3 + ' more') : names;
  const list = shown.length > 1 ? shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] : shown[0];
  const eg = ps.slice(0, 2).map((p) => '\u201c' + String(p.ask).slice(0, 40) + '\u201d');
  return 'Better at ' + list + ': ' + ps.length + ' more way' + (ps.length === 1 ? '' : 's') + ' of asking answered right, like ' + eg.join(' and ');
}

/** { line, ask } for a ledger entry that can be shown on the stage, or null. Pure. */
// shipped lines a later change undid: never previewed again (owner, 2026-10-18: the "try:" suggestions were removed, so "real suggestions on the empty stage" is no longer true)
const RETIRED = [/real suggestions on the empty stage/i];

export function playable(e) {
  if (!e || !SHOWN_KINDS.has(e.kind)) return null;
  if (RETIRED.some((r) => r.test(String(e.show || '')))) return null;
  if (!lineOf(e.what)) return null; // a line about what Verse studies is never shown
  if (e.try) return showcaseOf(e.try) ? null : { line: e.show || phrasesLine(e.phrases) || hardenedLine(e.what) || lineOf(e.what), ask: e.try }; // never the walkthrough itself
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

/** the tray of the walkthrough (asked by Verse: "make the What's new walkthrough interactive, grab a newly shipped skill from it and drop it
 *  on the stage to test it"): the steps after the current one, up to `max`, each { j, line } with its line cut to fit a chip. Pure. */
export const TRAY = 6;
export function trayOf(steps, i, max = TRAY) {
  const out = [];
  for (let j = i + 1; j < (steps || []).length && out.length < max; j++) { const l = String(steps[j].line || ''); out.push({ j, line: l }); }
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
/** the asks already previewed on this device (cleaned); bounded, so it stays small however much Verse makes */
export function shownSet() { try { return new Set(JSON.parse(read(SHOWN_KEY) || '[]')); } catch (_) { return new Set(); } }
export function markShown(steps) {
  const all = [...shownSet()]; for (const s of steps || []) { const a = CLEAN(s.ask); if (a && !all.includes(a)) all.push(a); }
  write(SHOWN_KEY, JSON.stringify(all.slice(-3000)));
}
export const VERIFIED_URL = '/claims-verified.json';
/** how far back "recently built" reaches: what Verse built in these days stays one tap away even after it was previewed
 *  (owner, 2026-10-21: "still not seeing i made this anymore": a device that had seen every build, or had said "show me everything",
 *  had every ask in a2m.void.shown.v1, so nothing ever showed again and there was no way back to it) */
export const RECENT_DAYS = 7;
/** the verified playable builds of the last `days` days, newest first, previewed before or not. Pure. */
export function recentOf(entries, verified, now = Date.now(), days = RECENT_DAYS, done = '') {
  let after = new Date(now - days * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  if (done && done > after) after = done; // closed with Done: only what was built since then
  return whatsNew(sinceLast(entries, after), { verified }).steps;
}
/** when this device last closed "Recently built" with Done: the sparkle and the quiet line stay away until something newer is built
 *  (owner, 2026-10-24: "so why are we back to unclearable recently built"); asking "what's new" still replays them */
export const RECENT_DONE_KEY = 'a2m.void.recentDone.v1';
let recentSteps = null; // the last recent list, so the sparkle comes back when a walkthrough ends
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

// the panel never covers an open card, the step's things or the ask bar (owner, 2026-10-18: it opened over the dragon card, hiding its
// text and buttons): lib/placement.js dockPanel puts it above the ask bar when nothing is open, beside the open card when there is room,
// docked at the top or between the card and the ask bar, and when there is no free space it becomes a modal layer over a dimmed stage
// (focus kept inside, Esc closes, aria-modal). It is re-placed as the card lands, grows or the window changes.
const rectOf = (e) => { const r = e && e.getBoundingClientRect ? e.getBoundingClientRect() : null; return r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
function avoidRects() {
  const out = [], pg = document.querySelector('.vpage.on'); if (pg) out.push(rectOf(pg));
  for (const id of (tour && tour.made && tour.made.ids) || []) { const e = document.querySelector('#stage [data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (e) out.push(rectOf(e)); }
  return out.filter(Boolean);
}
function place(el) {
  if (!el || !el.isConnected) return;
  const d = document.getElementById('dock'), dr = d && d.getBoundingClientRect();
  const floor = dr && dr.height ? dr.top : innerHeight - 72;
  const heightAt = (w) => { el.style.width = w + 'px'; el.style.maxHeight = 'none'; return el.offsetHeight; };
  const p = dockPanel({ view: { w: innerWidth, h: innerHeight }, top: 0, floor, avoid: avoidRects(), heightAt });
  Object.assign(el.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', maxHeight: p.maxH + 'px', bottom: 'auto' });
  el.dataset.dock = p.mode;
  modal(el, p.mode === 'modal');
}
// no free space: a proper modal layer. The stage behind is dimmed and blurred, focus stays in the panel, Esc closes the walkthrough.
function modal(el, on) {
  let s = document.getElementById('showcase-scrim');
  if (!on) { if (s) s.remove(); el.setAttribute('role', 'region'); el.removeAttribute('aria-modal'); return; }
  if (!s) {
    s = document.createElement('div'); s.id = 'showcase-scrim'; s.className = 'showcase-scrim'; s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:fixed;inset:0;z-index:59;background:rgba(4,5,10,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';
    document.body.insertBefore(s, el);
  }
  const was = el.getAttribute('aria-modal') === 'true';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  if (!was || !el.contains(document.activeElement)) { const f = el.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
}
// Tab and Shift+Tab go round the panel's own buttons while it is modal
function trap(e) {
  const el = e.currentTarget; if (e.key !== 'Tab' || el.getAttribute('aria-modal') !== 'true') return;
  const f = [...el.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
}
function bar() {
  let el = document.getElementById('showcase-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'showcase-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'What Verse made');
    el.style.cssText = 'position:fixed;box-sizing:border-box;z-index:60;padding:8px 12px;border-radius:12px;overflow:auto;overscroll-behavior:contain;'
      + 'background:rgba(20,22,30,.9);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.4);'
      + 'color:var(--ink-2,#b9bdcb);font-size:13px;line-height:1.35;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px';
    el.addEventListener('keydown', trap);
    document.body.appendChild(el);
    el._place = () => place(el);
    addEventListener('resize', el._place);
    el._tick = setInterval(el._place, 400); // the card lands, grows or settles after the step's ask: keep clear of it
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

/** the Clear list button: everything in this walkthrough is seen, Recently built is empty until something newer ships, and nothing is left on
 *  screen asking for a look. */
export function clearAll(stageApi, steps) {
  markShown(steps || []); write(RECENT_DONE_KEY, nowIso()); recentSteps = null;
  if (tour) { tour.done = true; end(stageApi); }
  const b = document.getElementById('whatsnew-bell'); if (b) b.remove();
  const note = document.getElementById('away-note'); if (note) note.textContent = '';
  if (stageApi && stageApi.say) stageApi.say('Cleared · new builds will show here when Verse makes them');
}

function end(stageApi) {
  if (!tour) return;
  const el = document.getElementById('showcase-bar'); if (el) { removeEventListener('resize', el._place); clearInterval(el._tick); el.remove(); }
  const s = document.getElementById('showcase-scrim'); if (s) s.remove();
  removeEventListener('keydown', tour.esc, true);
  const closedRecent = tour.done && /recently built/i.test(tour.label);
  tour = null;
  if (closedRecent) { write(RECENT_DONE_KEY, nowIso()); recentSteps = null; return; } // Done means done: no sparkle comes back for these
  if (recentSteps && recentSteps.length) bell(stageApi, recentSteps, { recent: true }); // recently built stays one tap away
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
  head.style.cssText = 'color:var(--ink-3,#8b90a0);overflow-wrap:anywhere;min-width:0;max-width:100%'; // wraps: nowrap pushed "1 of N · …" past the panel's right edge
  head.textContent = (tour.i + 1).toLocaleString('en') + ' of ' + tour.steps.length.toLocaleString('en') + ' · ' + tour.label;
  const line = document.createElement('span');
  line.className = 'showcase-line';
  line.style.cssText = 'color:var(--ink,#e9ebf2);flex:1 1 220px';
  line.textContent = s.line;
  const ctl = document.createElement('span');
  ctl.style.cssText = 'display:flex;gap:6px;margin-left:auto';
  const last = tour.i === tour.steps.length - 1;
  ctl.append(button(last ? 'Done' : 'Next →', () => { clear(stageApi); if (last) tour.done = true; tour.i++; step(stageApi); }),
    button('Keep', () => { tour.made = null; if (last) tour.done = true; tour.i++; step(stageApi); }), ...(last ? [] : [button('Done', () => { clear(stageApi); tour.done = true; end(stageApi); })]),
    // one tap clears the whole list on this device (owner, 2026-10-24: "just make a clear list button for the builds that stays cleared"):
    // every step is marked seen, Recently built starts again from now, and the sparkle and the line go; "show me everything you made" still walks it all
    button('Clear list', () => { clear(stageApi); clearAll(stageApi, tour.steps); }));
  ctl.lastChild.dataset.showcase = 'clear';
  ctl.firstChild.dataset.showcase = 'next'; ctl.children[1].dataset.showcase = 'keep'; if (!last) ctl.children[2].dataset.showcase = 'done';
  el.append(head, line, ctl);
  const rx = s.at ? reactionBar(targetOf(s.at)) : null; // spectators react to what Verse made; hidden unless /api/react answers
  if (rx) el.append(rx);
  const items = trayOf(tour.steps, tour.i);
  if (items.length) { // the tray: grab a coming step and drop it on the stage to try it now (a tap tries it too)
    const tray = document.createElement('span');
    tray.className = 'showcase-tray';
    // the panel's own footer row (owner, 2026-10-18: not a separate row piled between the panel and the ask bar)
    tray.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;flex:1 1 100%;align-items:center;color:var(--ink-3,#8b90a0);border-top:1px solid rgba(255,255,255,.08);padding-top:6px';
    tray.append(document.createTextNode('grab one onto the stage:'));
    for (const it of items) tray.append(chip(stageApi, it));
    el.append(tray);
  }
  place(el);
  const before = new Set(Object.keys(stageApi.things())), pageBefore = document.querySelector('.vpage');
  tour.made = { ids: [], pageBefore };
  await stageApi.ask(s.ask, { quiet: true }); // a preview: not saved as the person's own ask
  if (!tour || tour.steps[tour.i] !== s) return;
  tour.made.ids = Object.keys(stageApi.things()).filter((id) => !before.has(id));
  place(el); // clear of what the step just put up
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
  tour = { steps, i: 0, made: null, label, esc: (e) => {
    if (e.key !== 'Escape' || !tour) return;
    const el = document.getElementById('showcase-bar');
    if (el && el.dataset.dock === 'modal') { e.preventDefault(); e.stopPropagation(); end(stageApi); return; } // the modal layer closes first
    if (!document.querySelector('.vpage.on')) end(stageApi);
  } };
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
  const V = await verifiedSet();
  const { steps } = whatsNew(sinceLast(list, floor), { shown: shownSet(), verified: V });
  recentSteps = recentOf(list, V, Date.now(), RECENT_DAYS, read(RECENT_DONE_KEY));
  if (!steps.length) {
    // nothing unseen: what was built recently still shows, as a quiet line and the sparkle, never gone after one look
    if (!recentSteps.length) return 0;
    const old = document.getElementById('whatsnew-bell'); if (old && old.dataset.mode !== 'recent') return 0;
    if (old) old.remove();
    bell(stageApi, recentSteps, { recent: true });
    if (note && !note.querySelector('.showcase-pill')) pill(stageApi, note, recentSteps, 'Recently built: ', false);
    return recentSteps.length;
  }
  // marked shown only when it is seen through (the walkthrough starts): a line that flashed by while you typed used to use up every build,
  // so nothing was ever previewed again (owner, 2026-10-21: "I am not even seeing I built this previews")
  const old = document.getElementById('whatsnew-bell'); if (old && old.dataset.mode === 'recent') old.remove(); // something new outranks the recent sparkle
  if (!note) return steps.length;
  if (note.querySelector('.showcase-pill')) note.textContent = '';
  pill(stageApi, note, steps, 'I built this: ', true);
  bell(stageApi, steps);
  return steps.length;
}
// the quiet line: the newest thing by name and what it does, never only a count (owner, 2026-10-21: details on every preview)
function pill(stageApi, note, steps, head, isNew) {
  const n = steps.length;
  const lead = document.createElement('span');
  lead.className = 'showcase-pill'; lead.dataset.mode = isNew ? 'new' : 'recent';
  lead.textContent = (note.textContent ? note.textContent + ' · ' : '') + head + steps[0].line + (n > 1 ? ' (and ' + (n - 1).toLocaleString('en') + ' more)' : '') + ' · ';
  const go = document.createElement('a');
  go.href = '#'; go.className = 'away-see'; go.textContent = 'show me'; go.dataset.showcase = 'show';
  go.addEventListener('click', (e) => { e.preventDefault(); note.textContent = ''; const b = document.getElementById('whatsnew-bell'); if (b) b.remove(); if (isNew) markShown(steps); start(stageApi, steps, { label: isNew ? 'Built while you were away' : 'Recently built' }); });
  note.textContent = ''; note.append(lead, go);
}

/** while the tab stays open, look again for what Verse built (owner, 2026-10-19: "its supposed to pop up when Verse builds something"): the
 *  first-touch line above only ran once per page load, so a builder or Verse's own loop shipping while the page was open showed nothing until a
 *  reload. Every `ms` while the tab is visible, and when it comes back into view, the same check runs: a new verified build brings the quiet line
 *  and the sparkle. One static file read (/void.growth.json) per look; nothing runs while the tab is hidden or a walkthrough is on. */
export const WATCH_MS = 4 * 60 * 1000;
export function watch(stageApi, note, ms = WATCH_MS) {
  if (typeof document === 'undefined' || watch.on) return; watch.on = true;
  const look = () => { const b = document.getElementById('whatsnew-bell'); if (document.visibilityState !== 'visible' || tour || (b && b.dataset.mode !== 'recent')) return; nudge(stageApi, note).catch(() => {}); };
  setInterval(look, ms);
  document.addEventListener('visibilitychange', look);
}

/** a small animated icon on the stage for what is new (asked by Verse: "Link the 'whats new' showcase trigger to a small, animated
 * notification icon on the stage to prevent users from having to type it"): a bell-less sparkle with the count, pulsing quietly; a tap
 * starts the same walkthrough as typing "what's new", and the icon and the quiet line both go. It appears only when something is new
 * (so a first visit and an empty page stay empty) and never moves anything. Pure DOM, nothing sent anywhere. */
export function bell(stageApi, steps, { recent = false } = {}) {
  if (typeof document === 'undefined' || !steps || !steps.length || document.getElementById('whatsnew-bell')) return null;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'whatsnew-bell'; b.className = 'whatsnew-bell';
  const n = steps.length; b.dataset.count = String(n); b.dataset.mode = recent ? 'recent' : 'new';
  b.setAttribute('aria-label', recent ? 'Recently built: ' + n.toLocaleString('en') + (n === 1 ? ' thing' : ' things') + ' Verse made this week: show me'
    : (n === 1 ? 'Something new' : n.toLocaleString('en') + ' new things') + ' Verse made while you were away: show me');
  b.title = recent ? 'Recently built: tap to see what Verse made this week' : 'What\'s new: tap to see what Verse made';
  b.innerHTML = '<style>.whatsnew-bell{position:fixed;left:14px;bottom:14px;z-index:5;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(20,18,34,.82);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 0 0 0 rgba(158,178,255,.55);animation:wn-pulse 2.4s ease-out infinite}' // void-review: ok: static markup, the only variable is a number
    + '.whatsnew-bell svg{width:20px;height:20px;animation:wn-spin 6s linear infinite}.whatsnew-bell b{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;border-radius:9px;background:#ff6a3d;color:#fff;font:700 11px/17px system-ui,sans-serif;text-align:center;padding:0 4px;box-sizing:border-box}'
    + '@keyframes wn-pulse{0%{box-shadow:0 0 0 0 rgba(158,178,255,.55)}70%,100%{box-shadow:0 0 0 14px rgba(158,178,255,0)}}@keyframes wn-spin{to{transform:rotate(360deg)}}'
    + '@media (prefers-reduced-motion:reduce){.whatsnew-bell,.whatsnew-bell svg{animation:none}}</style>'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" fill="currentColor"/></svg><b aria-hidden="true">' + (n > 99 ? '99+' : n) + '</b>'; // void-review: ok: static markup, the count is a number
  b.addEventListener('click', (e) => { e.preventDefault(); const note = document.getElementById('away-note'); if (note) note.textContent = ''; b.remove(); if (!recent) markShown(steps); start(stageApi, steps, { label: recent ? 'Recently built' : 'Built while you were away' }); });
  if (recent) b.style.animation = 'none'; // seen before: still there, no longer pulsing for attention
  document.body.appendChild(b);
  return b;
}

/** "show me everything you made": the whole walkthrough, previewed before or not, asked for by name. Pure. */
const ALL_RE = /^(?:(?:show|walk) me (?:through )?|i want to see )?(?:everything|all(?: the things)?|every single thing) (?:you|(?:verse|v01d)|(?:verse|void)|verse)(?:'ve| have|'s| has)? (?:ever )?(?:made|built|done)(?: for me)?(?: so far| ever)?$/;
export const everythingOf = (text) => ALL_RE.test(CLEAN(text));

async function run(text, api) {
  // "what's new, pussycat" (asked 100+ times; the Tom Jones song, 1965) is the same question as "what's new", with a nod to the song first
  const cat = /pussy\s?cat/.test(CLEAN(text)) ? 'Meow, the Tom Jones song (1965) · ' : '';
  const say = (m) => api.say(cat + m);
  const stageApi = api.stage;
  let list = [];
  try { list = await ledger(); } catch (_) { say("can't read what I made just now"); return 'none'; }
  const V = await verifiedSet();
  // everything, asked for by name: every playable build, whether or not this device has been shown it (never on its own)
  if (everythingOf(text)) {
    const all = whatsNew(sinceLast(list), { verified: V }).steps;
    if (!all.length) { say('nothing to show yet'); return 'none'; }
    markShown(all);
    start(stageApi, all, { label: 'Everything I made' });
    return 'showcase';
  }
  const floor = read(SEEN_KEY);
  const fresh = floor ? whatsNew(sinceLast(list, floor), { shown: shownSet(), verified: V }) : { steps: [], waiting: [] };
  const wip = fresh.waiting.length ? ' · ' + fresh.waiting.length + ' more in progress (not answering yet)' : '';
  // a thing is previewed once (owner, 2026-10-16): with nothing new there is no replay, only the count and the way to see it all
  if (!fresh.steps.length) {
    const recent = recentOf(list, V, Date.now(), RECENT_DAYS, read(RECENT_DONE_KEY));
    if (recent.length) { recentSteps = recent; start(stageApi, recent, { label: 'Nothing unseen since you last looked · recently built' + wip }); return 'showcase'; }
    const n = whatsNew(sinceLast(list), { verified: V }).steps.length;
    say((floor ? 'nothing new since you last looked' : 'nothing new to show yet') + wip + (n ? ' · say "show me everything you made" for all ' + n.toLocaleString('en') : ''));
    return 'showcase'; // it answered (the count and how to see it all): 'none' let the ask fall through to the encyclopedia, so claims-verify dropped "what's new"
  }
  markShown(fresh.steps);
  if (cat) api.say(cat.trim());
  start(stageApi, fresh.steps, { label: 'Built while you were away' + wip });
  return 'showcase';
}

export default {
  name: 'showcase',
  examples: ['show me what you made', "what's new", "what's new pussycat", 'what did you make for me', 'look what you did', 'show me everything you made'],
  nearMisses: ["what's new in the news", 'show me what you can do', 'what did you make for dinner'],
  match(lower, text) { return showcaseOf(text || lower) || everythingOf(text || lower); },
  run,
};
