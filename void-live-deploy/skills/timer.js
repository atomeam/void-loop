/**
 * timer skill — start a simple countdown timer
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a timer", "timer for 5 minutes", "set a timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:(?:start|set|begin)\s+(?:a\s+|the\s+)?timer(?:\s+(?:for|of)\s+\d+\s*(?:min|minutes?|sec|seconds?)?)?|timer(?:\s+for\s+\d+\s*(?:min|minutes?|sec|seconds?))?|\d+\s*(?:min|minutes?|sec|seconds?)\s+timer)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  let secs = 300; // default 5 min
  const m = t.match(/(\d+)\s*(min|minutes?|sec|seconds?)/);
  if (m) {
    const n = parseInt(m[1], 10);
    secs = /min/.test(m[2]) ? n * 60 : n;
  }
  secs = Math.min(3600, Math.max(1, secs));
  const el = showPage((p) => {
    p.innerHTML = '<h2>Timer</h2><div class="timer-display" style="font-size:48px;font-weight:300;text-align:center">' + Math.floor(secs/60) + ':' + String(secs%60).padStart(2,'0') + '</div><div class="sub">counting down</div>';
  });
  if (!el) return 'timer';
  const display = el.querySelector('.timer-display');
  let left = secs;
  const id = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(id);
      display.textContent = '0:00';
      el.querySelector('.sub').textContent = 'done';
      return;
    }
    display.textContent = Math.floor(left/60) + ':' + String(left%60).padStart(2,'0');
  }, 1000);
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['start a timer', 'timer for 5 minutes', 'set a timer for 30 seconds', '5 minute timer'],
  nearMisses: ['what time is it', 'timer app', 'stopwatch'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('start a timer') && isTimer('timer for 5 minutes') && !isTimer('what time is it');
    return { ok, got: 'match works' };
  }
};
