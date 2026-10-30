/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a stopwatch", "stopwatch", "open stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open|make|show)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let running = false, startTime = 0, elapsed = 0, interval = null;
  const updateDisplay = (p, ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const frac = Math.floor((ms % 1000) / 10);
    p.querySelector('.sw-time').textContent = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(frac).padStart(2, '0');
  };
  showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p class="sw-time" style="font-size:48px;text-align:center;font-family:monospace">00:00.00</p><div style="text-align:center"><button id="sw-start" class="g-btn">Start</button> <button id="sw-reset" class="g-btn">Reset</button></div><div class="sub">say “stopwatch” for a new one</div>';
    const startBtn = p.querySelector('#sw-start'), resetBtn = p.querySelector('#sw-reset');
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!running) {
        running = true; startTime = Date.now() - elapsed;
        startBtn.textContent = 'Stop';
        interval = setInterval(() => updateDisplay(p, Date.now() - startTime), 50);
      } else {
        running = false; elapsed = Date.now() - startTime;
        startBtn.textContent = 'Start';
        clearInterval(interval);
      }
    });
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      running = false; elapsed = 0; startTime = 0;
      startBtn.textContent = 'Start';
      clearInterval(interval);
      updateDisplay(p, 0);
    });
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start a stopwatch', 'open stopwatch'],
  nearMisses: ['what is a stopwatch', 'buy stopwatch', 'stopwatch timer'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is stopwatch');
    return { ok, got: 'match works' };
  }
};
