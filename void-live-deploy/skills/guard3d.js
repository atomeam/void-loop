/**
 * guard3d — a 3D board that breaks never takes the game with it (Adam, 2026-10-09: Sorry! "crashed as soon as i hit draw",
 * then Aggravation "in a different browser … crashed too"). Not a skill: lift3d.js and scene3d.js use it.
 *  - While a 3D board is up, this tab notes it (sessionStorage, so another tab never counts). The note is cleared when the
 *    page is left or hidden normally. If the page comes back and the note is still there, the page died with a 3D board
 *    up: that game opens on its flat board from then on (in this tab), with a line saying why and "Try 3D again".
 *  - A WebGL context lost and not back within a few seconds does the same at once.
 *  - Errors while a 3D board is up are kept (message, browser, graphics card) so the card can show what went wrong.
 *   begin(kind) / end(kind)   a 3D board came up / went away
 *   isOff(kind)               the flat board is the safe choice for this game now
 *   retry(kind)               the player asked for 3D again
 *   lastCrash()               { kind, why, gpu, ua, at } or null
 *   setGpu(name)              scene3d.js reports the graphics card once its renderer exists
 *   contextLost() / contextRestored()
 */
const ACTIVE = 'void.3d.active', OFF = 'void.3d.off', LAST = 'void.3d.crash';
const live = new Set();
let gpu = '', lostTimer = 0;

const ss = () => { try { return sessionStorage; } catch (_) { return null; } };
const read = (k, d) => { try { const v = ss() && ss().getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
const write = (k, v) => { try { if (!ss()) return; if (v == null) ss().removeItem(k); else ss().setItem(k, JSON.stringify(v)); } catch (_) {} };

function note(kind, why) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  write(LAST, { kind, why: String(why || '').slice(0, 300), gpu, ua, at: new Date().toISOString() });
}
function turnOff(kind, why) { const off = read(OFF, []); if (!off.includes(kind)) off.push(kind); write(OFF, off); note(kind, why); }
const mark = () => write(ACTIVE, live.size ? [...live] : null);

// the page came back with a 3D board still marked up: it died while drawing one
const died = read(ACTIVE, null);
if (Array.isArray(died) && died.length) for (const k of died) turnOff(k, 'the page stopped while the 3D ' + k + ' board was running');
write(ACTIVE, null);

if (typeof addEventListener === 'function') {
  addEventListener('pagehide', () => write(ACTIVE, null));
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => (document.hidden ? write(ACTIVE, null) : mark()));
  addEventListener('error', (e) => { if (live.size) note([...live].join(','), (e && (e.message || (e.error && e.error.message))) || 'script error'); });
  addEventListener('unhandledrejection', (e) => { if (live.size) note([...live].join(','), (e && e.reason && (e.reason.message || String(e.reason))) || 'promise rejected'); });
}

export function begin(kind) { live.add(kind); mark(); }
export function end(kind) { live.delete(kind); mark(); }
export function isOff(kind) { return read(OFF, []).includes(kind); }
export function retry(kind) { write(OFF, read(OFF, []).filter((k) => k !== kind)); }
export function lastCrash() { return read(LAST, null); }
export function setGpu(name) { gpu = String(name || '').slice(0, 120); }
export function contextLost() {
  clearTimeout(lostTimer);
  // a context that comes back is fine (scene3d redraws everything); one that stays gone is a crash
  lostTimer = setTimeout(() => {
    const kinds = [...live];
    for (const k of kinds) turnOff(k, 'the graphics card reset and the 3D board did not come back');
    if (kinds.length && typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent('void:3d-down', { detail: { kinds } }));
  }, 3000);
}
export function contextRestored() { clearTimeout(lostTimer); }
