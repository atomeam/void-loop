/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "timer", "start a timer", "countdown 5 minutes", "set a 10 minute timer".
 * Empty surface stays empty; the timer is an outcome page.
 */
export function isTimer(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:start|set|begin)\s+(?:a\s+)?(?:countdown\s+)?timer(?:\s+(?:for\s+)?(?:\d+\s*)?(?:minutes?|mins?|seconds?|secs?|hours?|hrs?)?)?|timer(?:\s+(?:for\s+)?(?:\d+\s*)?(?:minutes?|mins?|seconds?|secs?|hours?|hrs?)?)?|countdown\s+(?:timer\s+)?(?:\d+\s*)?(?:minutes?|mins?|seconds?|secs?))$/i.test(t);
}

function parseDuration(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/(\d+)\s*(?:minutes?|mins?)/);
  if (m) return parseInt(m[1], 10) * 60;
  const s = t.match(/(\d+)\s*(?:seconds?|secs?)/);
  if (s) return parseInt(s[1], 10);
  const h = t.match(/(\d+)\s*(?:hours?|hrs?)/);
  if (h) return parseInt(h[1], 10) * 3600;
  return 60; // default 1 minute
}

function run(text, api) {
  const { showPage, esc } = api;
  const total = parseDuration(text);
  let left = total;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Timer</h2><p id="t" style="font-size:48px;font-weight:300;text-align:center">' + Math.floor(left/60) + ':' + String(left%60).padStart(2,'0') + '</p><div class="sub">say “timer” again for a new one</div>';
  });
  const tick = () => {
    if (!api._pageStill(el)) return;
    left--;
    const display = Math.floor(left/60) + ':' + String(left%60).padStart(2,'0');
    const p = el.querySelector('#t');
    if (p) p.textContent = display;
    if (left > 0) setTimeout(tick, 1000);
    else if (p) p.textContent = 'Done';
  };
  setTimeout(tick, 1000);
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['timer', 'start a timer', 'countdown 5 minutes', 'set a 10 minute timer', 'timer for 30 seconds'],
  nearMisses: ['what is a timer', 'kitchen timer manual', 'days until new year'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('timer') && isTimer('start a timer') && isTimer('countdown 5 minutes') && !isTimer('what is a timer');
    return { ok, got: 'match works' };
  }
};
