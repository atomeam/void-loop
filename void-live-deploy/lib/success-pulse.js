// success-pulse — a brief green pulse on the stage when something the Status card showed failing is working again (asked by Void,
// 2026-10-16: "a 'Success Pulse' animation on the stage that triggers briefly when a failed action in the Status card is
// successfully converted into a proven skill"). skills/status.js keeps the names of what failed last time on this device; when a
// later check finds one of them fine, that is the recovery: a skill that failed to load and now does is the converted skill. Pure
// where it can be; the animation touches only a fixed overlay that removes itself.
export const KEY = 'a2m.void.status.failed.v1';

/** the names that failed before and are fine now (`failedNow` is what fails now, `checkedNow` every name looked at now). Pure. */
export function recovered(before, failedNow, checkedNow) {
  const now = new Set(failedNow || []), seen = new Set(checkedNow || []);
  return (Array.isArray(before) ? before : []).filter((n) => seen.has(n) && !now.has(n));
}
export function loadFailed(s) { try { const a = JSON.parse((s || globalThis.localStorage).getItem(KEY) || '[]'); return Array.isArray(a) ? a.map(String).slice(0, 200) : []; } catch (_) { return []; } }
// the last check's reading, for the book's parchment tone (lib/tome.js parchmentFilter): { failing, checked, at } numbers only
export const HEALTH_KEY = 'a2m.void.status.health.v1';
export function keepHealth(failing, checked, s, at = Date.now()) { try { (s || globalThis.localStorage).setItem(HEALTH_KEY, JSON.stringify({ failing: Math.max(0, failing | 0), checked: Math.max(0, checked | 0), at })); } catch (_) {} }
export function loadHealth(s) { try { const h = JSON.parse((s || globalThis.localStorage).getItem(HEALTH_KEY) || 'null'); return h && Number.isFinite(h.failing) && Number.isFinite(h.checked) && Number.isFinite(h.at) ? h : null; } catch (_) { return null; } }
export function keepFailed(list, s) { try { (s || globalThis.localStorage).setItem(KEY, JSON.stringify([...new Set(list)].slice(0, 200))); } catch (_) {} }

/** one green ring that grows and fades over the middle of the stage; nothing moves under reduced motion. Returns the element or null. */
export function successPulse(doc = globalThis.document) {
  if (!doc || !doc.body) return null;
  try {
    const g = doc.createElement('div'); g.className = 'success-pulse'; g.setAttribute('aria-hidden', 'true');
    g.style.cssText = 'position:fixed;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:3px solid #3fbf6a;box-shadow:0 0 24px 6px rgba(63,191,106,.5);pointer-events:none;z-index:5';
    doc.body.appendChild(g);
    const reduce = globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof g.animate !== 'function') { setTimeout(() => g.remove(), 900); return g; }
    const a = g.animate([{ transform: 'scale(.4)', opacity: 0.9 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 1100, easing: 'ease-out' });
    a.onfinish = () => g.remove();
    return g;
  } catch (_) { return null; }
}
