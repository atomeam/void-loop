/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a timer", "5 minute timer", "countdown timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:(?:start|set|open|make)\s+(?:a\s+)?)?(?:\d+\s+)?(?:minute|min|second|sec)?\s*timer(?:\s+for\s+\d+\s*(?:minutes?|mins?|seconds?|secs?))?(?:\s+please)?$|countdown\s+timer|timer\s+please$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(\d+)/.exec(String(text || ''));
  let secs = 60;
  if (m) {
    const n = +m[1];
    if (/sec/.test(text)) secs = n;
    else if (/min/.test(text)) secs = n * 60;
    else secs = n * 60; // default minutes
  }
  secs = Math.min(3600, Math.max(5, secs));
  let left = secs, id;
  const update = (p) => {
    const mm = Math.floor(left / 60), ss = left % 60;
    p.innerHTML = '<h2>Timer</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')) + '</p><div style="text-align:center"><button id="timer-start" class="g-btn">Start</button> <button id="timer-stop" class="g-btn">Stop</button></div><div class="sub">say “timer” for a new one</div>';
    const start = p.querySelector('#timer-start'), stop = p.querySelector('#timer-stop');
    start.addEventListener('click', (e) => { e.stopPropagation(); if (id) return; id = setInterval(() => { left--; if (left <= 0) { clearInterval(id); id = null; left = 0; } update(p); }, 1000); });
    stop.addEventListener('click', (e) => { e.stopPropagation(); if (id) { clearInterval(id); id = null; } });
  };
  showPage((p) => update(p));
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['timer', 'start a timer', '5 minute timer', 'countdown timer', 'timer for 10 minutes'],
  nearMisses: ['what is a timer', 'days until new year', 'make a clock'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('timer') && isTimer('5 minute timer') && !isTimer('what is a timer') && !isTimer('days until new year');
    return { ok, got: 'match works' };
  }
};
