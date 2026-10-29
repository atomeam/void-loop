/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "timer", "start a timer", "countdown timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:(?:start|open|set)\s+(?:a\s+)?)?(?:countdown\s+)?timer(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let seconds = 60;
  let running = false;
  let interval;
  const update = (p) => {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    const display = m + ':' + String(s).padStart(2, '0');
    p.innerHTML = '<h2>Timer</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(display) + '</p>' +
      '<div style="text-align:center"><button id="timer-toggle" class="g-btn">' + (running ? 'Pause' : 'Start') + '</button> <button id="timer-reset" class="g-btn">Reset</button></div>' +
      '<div class="sub">say “timer” for a fresh one</div>';
    const toggle = p.querySelector('#timer-toggle'), reset = p.querySelector('#timer-reset');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (running) { clearInterval(interval); running = false; }
      else {
        running = true;
        interval = setInterval(() => {
          if (seconds > 0) seconds--;
          else { clearInterval(interval); running = false; }
          update(p);
        }, 1000);
      }
      update(p);
    });
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(interval); running = false; seconds = 60; update(p);
    });
  };
  showPage((p) => update(p));
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['timer', 'start a timer', 'countdown timer', 'open a timer'],
  nearMisses: ['what is a timer', 'timer settings', 'kitchen timer manual'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('timer') && isTimer('start a timer') && !isTimer('what is a timer');
    return { ok, got: 'match works' };
  }
};
