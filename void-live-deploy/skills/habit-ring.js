/**
 * habit-ring skill — "habit ring for write, walk, sleep" puts 1 to 7 habits on the stage as SVG rings; tap a ring to mark
 * today, "mark walk done today" does the same by words. A ring fills with the last 7 days; the number is the streak. Kept in
 * this browser only (the stage's own storage), nothing sent anywhere. Asked for by the owner (2026-10-18).
 * The mark-by-words ask is answered by the stage kind's hook, so it only fires when a ring with that habit is on the stage.
 */
import { addThing, cardEl, keepOut, firstOf, localDay, tidy } from '../lib/stage-pack.js';

export const MAX_HABITS = 7;
const KEEP_DAYS = 400;

/** the habits an ask names (1 to 7, trimmed, no repeats), or null when it is not a habit-ring ask. Pure. */
export function parseHabits(text) {
  const m = /^(?:please\s+)?(?:(?:make|build|create|show|start|give|set\s+up)\s+(?:me\s+)?(?:a\s+|my\s+)?)?habit\s+rings?\s*(?:for|of|:)\s*(.+)$/i.exec(tidy(text));
  if (!m) return null;
  const seen = new Set(), out = [];
  for (const raw of m[1].split(/\s*(?:,|;|&|\band\b|\+)\s*/i)) {
    const name = raw.trim().replace(/^(?:to\s+)/i, '').slice(0, 24);
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); out.push(name); }
  }
  return out.length ? out.slice(0, MAX_HABITS) : null;
}

/** the habit name in "mark walk done today" / "mark walk as done", or '' / null. Pure. */
export function markOf(text) {
  const m = /^(?:please\s+)?(un)?mark\s+(?:my\s+|the\s+)?(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)(?:\s+(?:for\s+)?today)?$/i.exec(tidy(text))
    || /^(?:please\s+)?(un)?mark\s+(?:my\s+|the\s+)?(.+?)\s+(?:for\s+)?today$/i.exec(tidy(text));
  return m ? { name: m[2].trim().toLowerCase(), off: !!m[1] } : null;
}

const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const dayKeyOf = (n) => { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };

/** days with today toggled on or off (sorted, newest 400 kept). Pure. */
export function toggleDay(days, today, force) {
  const has = (days || []).includes(today), want = force === undefined ? !has : !!force;
  const set = new Set(days || []);
  if (want) set.add(today); else set.delete(today);
  return [...set].sort().slice(-KEEP_DAYS);
}

/** the run of consecutive days up to today (or up to yesterday while today is still open). Pure. */
export function streakOf(days, today) {
  const set = new Set(days || []);
  let n = dayNum(today), count = 0;
  if (!set.has(today)) n -= 1;
  while (set.has(dayKeyOf(n))) { count++; n -= 1; }
  return count;
}

/** how many of the 7 days ending today are marked. Pure. */
export function weekCount(days, today) {
  const set = new Set(days || []), t = dayNum(today);
  let c = 0;
  for (let i = 0; i < 7; i++) if (set.has(dayKeyOf(t - i))) c++;
  return c;
}

/** the habit a name points at on a ring thing: exact first, then the one it starts. Pure. */
export function findHabit(th, name) {
  const hs = (th && th.habits) || [], n = String(name || '').toLowerCase();
  return hs.find((h) => h.name.toLowerCase() === n) || hs.find((h) => h.name.toLowerCase().startsWith(n) && n.length >= 2) || null;
}

const SVGNS = 'http://www.w3.org/2000/svg';
const R = 26, CIRC = 2 * Math.PI * R;

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'habit-ring');
  const today = localDay();
  el.style.display = 'flex'; el.style.gap = '14px'; el.style.flexWrap = 'wrap'; el.style.maxWidth = 'min(92vw,560px)';
  for (const h of th.habits || []) {
    const done = (h.days || []).includes(today), wk = weekCount(h.days, today), st = streakOf(h.days, today);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'habit'; b.dataset.habit = h.name;
    b.setAttribute('aria-pressed', done ? 'true' : 'false');
    b.setAttribute('aria-label', h.name + ': ' + (done ? 'done today' : 'not done today') + ', streak ' + st + ' day' + (st === 1 ? '' : 's') + '. Tap to mark today.');
    b.style.cssText = 'all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:72px;text-align:center';
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('width', '64'); svg.setAttribute('height', '64'); svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(SVGNS, 'circle');
    for (const [k, v] of Object.entries({ cx: 32, cy: 32, r: R, fill: done ? 'rgba(120,220,150,.18)' : 'none', stroke: 'rgba(255,255,255,.16)', 'stroke-width': 6 })) track.setAttribute(k, v);
    const arc = document.createElementNS(SVGNS, 'circle');
    for (const [k, v] of Object.entries({ cx: 32, cy: 32, r: R, fill: 'none', stroke: done ? '#78dc96' : '#8fb4ff', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': (CIRC * wk / 7).toFixed(2) + ' ' + CIRC.toFixed(2), transform: 'rotate(-90 32 32)' })) arc.setAttribute(k, v);
    const label = document.createElementNS(SVGNS, 'text');
    for (const [k, v] of Object.entries({ x: 32, y: 38, 'text-anchor': 'middle', 'font-size': 18, fill: '#e8e8e8' })) label.setAttribute(k, v);
    label.textContent = done ? '✓' : String(st);
    svg.append(track, arc, label);
    const name = document.createElement('span'); name.textContent = h.name; name.style.fontSize = '13px';
    const sub = document.createElement('span'); sub.textContent = st + ' day streak'; sub.style.cssText = 'font-size:11px;opacity:.7';
    b.append(svg, name, sub);
    b.addEventListener('click', (e) => { e.stopPropagation(); h.days = toggleDay(h.days, localDay()); stageApi.save(); stageApi.render(); });
    keepOut(b);
    el.appendChild(b);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: make/extend the ring, or mark a habit by words; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const names = parseHabits(text);
  if (names) {
    let th = firstOf(stageApi, 'habits');
    if (!th) th = addThing(stageApi, 'habits', { habits: [] });
    for (const n of names) if (th.habits.length < MAX_HABITS && !th.habits.some((h) => h.name.toLowerCase() === n.toLowerCase())) th.habits.push({ name: n, days: [] });
    stageApi.select(th.id); stageApi.save(); stageApi.render();
    return 'habit-ring';
  }
  const mk = markOf(text);
  if (!mk) return '';
  const th = Object.values(stageApi.things()).find((t) => t && t.kind === 'habits' && findHabit(t, mk.name));
  if (!th) return '';
  const h = findHabit(th, mk.name);
  h.days = toggleDay(h.days, localDay(), !mk.off);
  stageApi.save(); stageApi.render();
  stageApi.say(h.name + (mk.off ? ' unmarked' : ' done today') + ' · streak ' + streakOf(h.days, localDay()));
  return 'habit-mark';
}

/** a "mark X done" ask for a habit that is on the saved stage (read from this browser's stage, as the page saves it). The
 *  skill sits ahead of the calendar in the routing order so "mark walk done today" is not taken for an event; with no ring
 *  it says no and the ask goes on as before. */
export function marksSavedHabit(text, store) {
  const mk = markOf(text);
  if (!mk) return false;
  try {
    const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    const saved = JSON.parse((bag && bag.getItem('a2m.void.state.v1')) || '{}');
    return Object.values(saved || {}).some((t) => t && t.kind === 'habits' && findHabit(t, mk.name));
  } catch (_) { return false; }
}

export default {
  name: 'habit-ring',
  examples: ['habit ring for write, walk, sleep', 'habit rings for read and stretch'],
  nearMisses: ['how do I build a habit', 'mark walk done today', 'add milk to my list'],
  parseHabits,
  marksSavedHabit,
  match(lower, text) { return !!parseHabits(text || lower) || marksSavedHabit(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'habit-ring' : 'none'; },
  stageKinds: { habits: { mount, ask } },
};
