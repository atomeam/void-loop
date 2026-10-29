/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start a stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let ms = 0, running = false, interval;
  const update = (p) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), sec = s % 60, cent = Math.floor((ms % 1000) / 10);
    const display = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(cent).padStart(2, '0');
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(display) + '</p>' +
      '<div style="text-align:center"><button id="sw-toggle" class="g-btn">' + (running ? 'Stop' : 'Start') + '</button> <button id="sw-reset" class="g-btn">Reset</button></div>' +
      '<div class="sub">say “stopwatch” for a fresh one</div>';
    const toggle = p.querySelector('#sw-toggle'), reset = p.querySelector('#sw-reset');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (running) { clearInterval(interval); running = false; }
      else {
        running = true;
        const start = Date.now() - ms;
        interval = setInterval(() => { ms = Date.now() - start; update(p); }, 50);
      }
      update(p);
    });
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(interval); running = false; ms = 0; update(p);
    });
  };
  showPage((p) => update(p));
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start a stopwatch', 'open a stopwatch'],
  nearMisses: ['what is a stopwatch', 'stopwatch settings'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
