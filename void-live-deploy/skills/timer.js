/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "timer", "start timer", "countdown timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:(?:start|open|set)\s+(?:a\s+)?)?(?:countdown\s+)?timer(?:\s+(?:for\s+)?\d+\s*(?:s|sec|seconds?|m|min|minutes?))?(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let seconds = 60;
  const m = String(text).match(/(\d+)\s*(s|sec|seconds?|m|min|minutes?)/i);
  if (m) {
    seconds = parseInt(m[1], 10);
    if (/m/i.test(m[2])) seconds *= 60;
  }
  let left = seconds, id;
  const update = (p) => {
    const mm = Math.floor(left / 60), ss = left % 60;
    const disp = (mm ? mm + ':' : '') + String(ss).padStart(mm ? 2 : 1, '0');
    p.innerHTML = '<h2>Timer</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(disp) + '</p><div style="text-align:center"><button id="timer-pause" class="g-btn">' + (id ? 'Pause' : 'Start') + '</button> <button id="timer-reset" class="g-btn">Reset</button></div><div class="sub">say “timer” for a new one</div>';
    const pause = p.querySelector('#timer-pause'), reset = p.querySelector('#timer-reset');
    pause.addEventListener('click', (e) => { e.stopPropagation(); if (id) { clearInterval(id); id = null; } else { id = setInterval(() => { if (left > 0) { left--; update(p); } else { clearInterval(id); id = null; update(p); } }, 1000); } update(p); });
    reset.addEventListener('click', (e) => { e.stopPropagation(); left = seconds; if (id) { clearInterval(id); id = null; } update(p); });
  };
  showPage((p) => { update(p); });
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['timer', 'start timer', 'countdown timer', 'timer for 5 minutes'],
  nearMisses: ['what is a timer', 'kitchen timer', 'stopwatch'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('timer') && isTimer('start timer') && isTimer('timer for 5 minutes') && !isTimer('what is a timer');
    return { ok, got: 'match works' };
  }
};
