// The spectator reaction bar (owner, 2026-10-18; server: functions/api/react.js, list: lib/reactions.js). A row of the closed set of buttons under a
// "look what I made" step, each with a live count. Every glyph comes from REACTIONS in code and every count is written with textContent as an integer, so
// nothing the server (or a stranger) sends can put markup or text on the page. Taps are debounced, a pressed button rests for a moment, a refusal (429)
// rests them all for the Retry-After, the burst animation is skipped under prefers-reduced-motion, and if the endpoint is down or off the bar is not shown.
import { REACTION_IDS, REACTIONS, targetOk } from './reactions.js';

export const REST_MS = 1200;      // a button rests this long after a tap
export const MAX_REST_MS = 120000; // a Retry-After never rests the bar longer than this
const LABELS = { clap: 'applaud', fire: 'fire', wow: 'wow', laugh: 'laugh', heart: 'love', eyes: 'watching', confused: 'confused', pity: 'pity' };

/** the counts object from a response, as integers for exactly the ids on the list, or null when it is not one. Pure. */
export function cleanCounts(j) {
  if (!j || j.ok !== true || !j.counts || typeof j.counts !== 'object') return null;
  const out = {}; for (const id of REACTION_IDS) { const n = Math.floor(Number(j.counts[id])); out[id] = Number.isFinite(n) && n > 0 ? Math.min(n, 99999) : 0; }
  return out;
}
/** how long a refusal rests the bar, in ms: its Retry-After (seconds) up to MAX_REST_MS, else a minute. Pure. */
export function restFor(retryAfter) { const s = Number(retryAfter); return Number.isFinite(s) && s > 0 ? Math.min(Math.ceil(s) * 1000, MAX_REST_MS) : 60000; }
/** 1234 -> "1.2k" so a count never widens the bar. Pure. */
export const short = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));

const BURST_CSS = '.rx-b{position:absolute;pointer-events:none;font-size:18px;animation:rx-up .8s ease-out forwards}@keyframes rx-up{from{transform:translateY(0);opacity:1}to{transform:translateY(-34px);opacity:0}}';

/** Build the bar for `target` (a ledger slug). Returns the element, or null when the target is not a slug; the element stays hidden until the counts have been
 *  read once, so a dead endpoint shows nothing. opts: fetchFn, doc, reduceMotion, now, tint ({ id: css } added to those buttons' style: the autopsy's
 *  warning look on 'confused' and 'pity', asked by Verse). */
export function reactionBar(target, opts = {}) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null), f = opts.fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!doc || !f || !targetOk(target)) return null;
  const reduce = opts.reduceMotion != null ? !!opts.reduceMotion : !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const bar = doc.createElement('span');
  bar.className = 'rx-bar'; bar.hidden = true; bar.dataset.target = target;
  bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'React to this');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;position:relative;flex:1 1 100%;min-width:0;max-width:100%';
  const style = doc.createElement('style'); style.textContent = BURST_CSS; bar.append(style);
  const nums = {}, btns = {};
  let dead = false, restUntil = 0, busy = false;
  const show = (c) => { for (const id of REACTION_IDS) nums[id].textContent = c[id] ? short(c[id]) : ''; };
  const rest = (ms) => { restUntil = Date.now() + ms; for (const id of REACTION_IDS) btns[id].disabled = true; setTimeout(() => { if (Date.now() >= restUntil && !dead) for (const id of REACTION_IDS) btns[id].disabled = false; }, ms + 20); };
  const burst = (btn, id) => {
    if (reduce) return;
    const s = doc.createElement('span'); s.className = 'rx-b'; s.setAttribute('aria-hidden', 'true'); s.textContent = REACTIONS[id];
    s.style.cssText = 'left:' + (btn.offsetLeft + 6) + 'px;top:0'; bar.append(s); setTimeout(() => s.remove(), 900);
  };
  for (const id of REACTION_IDS) {
    const b = doc.createElement('button'); b.type = 'button'; b.dataset.reaction = id; b.setAttribute('aria-label', LABELS[id] || id);
    b.style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:1px 8px;cursor:pointer;display:inline-flex;gap:4px;align-items:center' + (opts.tint && typeof opts.tint[id] === 'string' ? ';' + opts.tint[id] : '');
    if (opts.tint && opts.tint[id]) b.dataset.tint = '1';
    const g = doc.createElement('span'); g.textContent = REACTIONS[id]; g.setAttribute('aria-hidden', 'true');
    const n = doc.createElement('span'); n.className = 'rx-n'; n.style.cssText = 'font-size:12px;opacity:.8;min-width:0';
    b.append(g, n); nums[id] = n; btns[id] = b; bar.append(b);
    b.addEventListener('click', async () => {
      if (busy || dead || Date.now() < restUntil) return; // a double tap is one tap
      busy = true; rest(REST_MS);
      try {
        const res = await f('/api/react', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target, reaction: id }) });
        if (res.status === 429) { rest(restFor(res.headers && res.headers.get && res.headers.get('retry-after'))); return; }
        const c = res.ok ? cleanCounts(await res.json()) : null;
        if (c) { show(c); burst(b, id); } else if (res.status >= 500) { dead = true; bar.hidden = true; }
      } catch (_) { dead = true; bar.hidden = true; } finally { busy = false; }
    });
  }
  f('/api/react?target=' + encodeURIComponent(target)).then((r) => (r.ok ? r.json() : null)).then((j) => {
    const c = cleanCounts(j); if (!c || dead) return; show(c); bar.hidden = false;
  }).catch(() => {});
  return bar;
}
