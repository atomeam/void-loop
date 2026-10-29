/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "set a timer for 5 minutes", "start a 30 second timer", "timer 10 min".
 * Empty surface stays empty.
 */
export function secondsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:please\s+)?(?:set\s+a\s+|start\s+a\s+|start\s+)?timer\s+(?:for\s+)?(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes)?$/);
  if (!m) return null;
  const n = +m[1];
  const u = (m[2] || 'm').toLowerCase();
  if (u.startsWith('s')) return n;
  return n * 60;
}

export function isTimer(text) {
  return secondsOf(text) !== null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const secs = secondsOf(text) || 60;
  const label = secs >= 60 ? Math.floor(secs / 60) + ' min' + (secs % 60 ? ' ' + (secs % 60) + ' s' : '') : secs + ' s';
  showPage((p) => {
    p.innerHTML = '<h2>Timer</h2><p style="font-size:32px;font-weight:300;text-align:center">' + esc(label) + '</p><div class="sub">countdown started</div>';
    const el = p.querySelector('p');
    let left = secs;
    const id = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(id); if (el) el.textContent = 'Done'; return; }
      const mm = Math.floor(left / 60), ss = left % 60;
      if (el) el.textContent = (mm ? mm + ':' : '') + String(ss).padStart(2, '0');
    }, 1000);
  });
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['set a timer for 5 minutes', 'start a 30 second timer', 'timer 10 min'],
  nearMisses: ['what is a timer', 'kitchen timer', 'stopwatch'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('set a timer for 5 minutes') && isTimer('start a 30 second timer') && !isTimer('what is a timer');
    return { ok, got: 'match works' };
  }
};
