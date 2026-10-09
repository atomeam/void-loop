/**
 * live — the background runner for cards that go stale (asked by Void, 2026-10-09: "a background task runner that
 * allows my existing skills (like news, weather, or worldtime) to update autonomously").
 *
 * A skill draws its card once, then hands live.js a refresh and how often. live.js re-runs that refresh for as long as
 * the card is on the stage, the tab is visible and the browser is online. A tab that was hidden refreshes the moment it
 * comes back if it is due, so a weather card left open overnight shows now, not last night. A refresh that fails keeps
 * the card as it is (stale and dated beats blank) and waits longer each time (2x, 4x, up to 8x) until one works. A line
 * under the card says when it last updated and how often it refreshes, with pause and resume. Nothing ticks while the
 * tab is hidden, and no timer survives the card: a pending wait re-checks the stage at least every half minute.
 *
 * Contract: keepLive(api, el, { name, every, refresh }) -> handle { now(), pause(), resume(), stop(), state() }
 *   every    ms between refreshes (never under 10 s)
 *   refresh  async () => void: fetch again and redraw the card in place (never showPage: the card is the same element)
 * The scheduling maths (plan, nextDelay, caption) is pure, so tools/live.test.mjs runs it in Node.
 */
export const MIN_EVERY = 10e3, MAX_BACKOFF = 8, SLICE = 30e3;

/** how long after the last good update the next refresh is due: every × 2^failures, capped at 8× */
export function nextDelay(every, failures) {
  return Math.max(MIN_EVERY, every) * Math.min(MAX_BACKOFF, 2 ** Math.max(0, failures | 0));
}

/**
 * what the runner does next, from its state and the world:
 *   s   { every, lastAt, failures, paused, busy }   env { now, present, visible, online }
 *   -> { do: 'stop' } the card is gone | { do: 'hold' } wait for the world to change (hidden, offline, paused, mid-refresh)
 *      | { do: 'wait', ms } not due yet | { do: 'refresh' } due now
 */
export function plan(s, env) {
  if (!env.present) return { do: 'stop' };
  if (s.paused || s.busy || !env.visible || env.online === false) return { do: 'hold' };
  const ms = s.lastAt + nextDelay(s.every, s.failures) - env.now;
  return ms > 0 ? { do: 'wait', ms } : { do: 'refresh' };
}

/** "every 15 min", "every 2 hours", "every 45 s" */
export function everyText(ms) {
  if (ms < 60e3) return 'every ' + Math.round(ms / 1e3) + ' s';
  if (ms < 3600e3) { const m = Math.round(ms / 60e3); return 'every ' + m + ' min'; }
  const h = Math.round(ms / 3600e3 * 10) / 10; return 'every ' + h + (h === 1 ? ' hour' : ' hours');
}

/** the line under the card. clock(t) formats a time; tests pass their own */
export function caption(s, env, clock) {
  const at = clock(s.lastAt), ev = everyText(s.every);
  if (s.paused) return 'updates paused · last ' + at;
  if (env.online === false) return 'offline · last ' + at + ' · updates when back';
  if (s.failures) return 'couldn\'t update at ' + clock(s.failedAt || env.now) + ' · showing ' + at + ' · trying again';
  return 'updated ' + at + ' · refreshes ' + ev;
}

const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function keepLive(api, el, { name = 'card', every = 15 * 60e3, refresh }) {
  if (typeof refresh !== 'function') throw new TypeError('keepLive needs a refresh function');
  const s = { every: Math.max(MIN_EVERY, +every || 0), lastAt: Date.now(), failures: 0, failedAt: 0, paused: false, busy: false, updates: 0, stopped: false };
  let timer = 0;
  const env = () => ({ now: Date.now(), present: !s.stopped && api._pageStill(el), visible: typeof document === 'undefined' || document.visibilityState !== 'hidden', online: typeof navigator === 'undefined' ? true : navigator.onLine });
  // the line under the card: re-made after every redraw (a skill's innerHTML takes it out), touched only when something changed
  function stamp() {
    if (!api._pageStill(el)) return;
    let f = el.querySelector('.vlive');
    if (!f) { f = document.createElement('div'); f.className = 'vlive'; f.style.cssText = 'color:#8b90a0;font-size:12px;margin-top:8px'; el.appendChild(f); }
    const text = caption(s, env(), clock), want = text + (s.paused ? ' resume' : ' pause');
    if (f.dataset.text === want) return;
    f.dataset.text = want; f.textContent = text + ' · ';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vlive-btn'; b.textContent = s.paused ? 'resume' : 'pause';
    b.style.cssText = 'background:none;border:0;padding:0;color:inherit;font:inherit;text-decoration:underline;cursor:pointer';
    b.addEventListener('click', () => (s.paused ? handle.resume() : handle.pause()));
    f.appendChild(b);
  }
  async function run() {
    s.busy = true; stamp();
    try { await refresh(); if (api._pageStill(el)) { s.lastAt = Date.now(); s.failures = 0; s.updates++; } }
    catch (_) { s.failures++; s.failedAt = Date.now(); }
    s.busy = false; stamp(); tick();
  }
  function tick() {
    clearTimeout(timer); timer = 0;
    if (s.stopped) return;
    const p = plan(s, env());
    if (p.do === 'stop') return handle.stop();
    if (p.do === 'refresh') return run();
    // a wait is sliced so a closed card is noticed within half a minute and a hidden tab costs one check a slice at most
    if (p.do === 'wait') timer = setTimeout(tick, Math.min(SLICE, p.ms + 20));
    else if (!s.busy && !s.paused) timer = setTimeout(tick, SLICE); // hidden or offline: the events below wake it, this is the fallback
  }
  const wake = () => { if (!s.stopped) tick(); };
  if (typeof document !== 'undefined') { document.addEventListener('visibilitychange', wake); addEventListener('online', wake); addEventListener('offline', wake); }
  const handle = {
    now() { if (!s.stopped && !s.busy) { clearTimeout(timer); timer = 0; return run(); } return Promise.resolve(); },
    pause() { s.paused = true; clearTimeout(timer); timer = 0; stamp(); },
    resume() { s.paused = false; stamp(); tick(); },
    stop() { s.stopped = true; clearTimeout(timer); timer = 0;
      if (typeof document !== 'undefined') { document.removeEventListener('visibilitychange', wake); removeEventListener('online', wake); removeEventListener('offline', wake); } },
    stamp,
    state() { const e = env(); return { name, every: s.every, lastAt: s.lastAt, failures: s.failures, paused: s.paused, busy: s.busy, updates: s.updates, stopped: s.stopped, next: plan(s, e) }; }
  };
  el._live = handle;
  stamp(); tick();
  return handle;
}
