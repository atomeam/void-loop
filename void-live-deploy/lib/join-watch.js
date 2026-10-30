// The stage's community milestone card (asked by Verse, 2026-10-17; lib/joins.js has the words and the rules). While the page is
// visible it reads GET /api/joins once after the page settles and again every 5 minutes. A join newer than the newest this device
// saw shows one quiet line under the stage with the join link; the page clears it on the next ask. Built with textContent only.
import { milestoneFor, joinCardText, JOIN_URL } from './joins.js';
export const SEEN_KEY = 'a2m.void.joinseen.v1';
export const EVERY_MS = 5 * 60e3;
const seenGet = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch (_) { return ''; } };
const seenSet = (v) => { try { localStorage.setItem(SEEN_KEY, v); } catch (_) {} };

/** builds the card's element (no DOM insertion). Pure apart from document.createElement. */
export function cardEl(doc, m) {
  const t = joinCardText(m);
  if (!t) return null;
  const el = doc.createElement('div');
  el.className = 'join-card';
  el.setAttribute('role', 'status');
  el.style.cssText = 'margin:8px auto 0;max-width:420px;padding:8px 14px;border-radius:12px;border:1px solid var(--line, rgba(140,160,255,.25));background:rgba(12,16,40,.72);color:var(--ink-2, #c9cff5);font-size:var(--fs-xs, 13px);text-align:center';
  const b = doc.createElement('strong'); b.textContent = t.title; b.style.color = 'var(--fg, #eef1ff)';
  const line = doc.createElement('span'); line.textContent = ' ' + t.line + ' ';
  const a = doc.createElement('a'); a.href = JOIN_URL; a.textContent = t.link; a.style.color = 'var(--fg, #eef1ff)';
  el.append(b, line, a);
  return el;
}

/** starts the watch. `after` is the element the card goes under; `fetchJson` is injectable for tests. Returns a stop function. */
export function watch(doc, after, { fetchJson, now = () => Date.now(), win = typeof window !== 'undefined' ? window : null } = {}) {
  const get = fetchJson || ((u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)));
  let shown = null, timer = null, stopped = false;
  const look = async () => {
    if (stopped || (doc.visibilityState && doc.visibilityState !== 'visible')) return;
    let stats = null;
    try { stats = await get('/api/joins'); } catch (_) { return; }
    const seen = seenGet(), m = milestoneFor(stats, seen, now());
    if (!m) { if (!seen && stats && stats.last) seenSet(stats.last); return; } // an old join on a first visit is noted, never shown
    seenSet(m.at);
    const el = cardEl(doc, m);
    if (!el || !after || !after.parentNode) return;
    if (shown) shown.remove();
    after.parentNode.insertBefore(el, after.nextSibling);
    shown = el;
  };
  look();
  timer = setInterval(look, EVERY_MS);
  if (doc.addEventListener) doc.addEventListener('visibilitychange', look);
  return () => { stopped = true; clearInterval(timer); if (doc.removeEventListener) doc.removeEventListener('visibilitychange', look); if (shown) shown.remove(); };
}
