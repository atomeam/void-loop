/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start a stopwatch", "open stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open|make|show)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let running = false, start = 0, elapsed = 0, interval;
  const format = (ms) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60, cs = Math.floor((ms % 1000) / 10);
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  };
  const update = (p) => {
    const now = running ? elapsed + (Date.now() - start) : elapsed;
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:48px;font-weight:300;text-align:center;font-family:monospace">' + esc(format(now)) + '</p><div style="text-align:center"><button id="sw-toggle" class="g-btn">' + (running ? 'Stop' : 'Start') + '</button> <button id="sw-reset" class="g-btn">Reset</button></div><div class="sub">say “stopwatch” for another</div>';
    const toggle = p.querySelector('#sw-toggle'), reset = p.querySelector('#sw-reset');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (running) { elapsed += Date.now() - start; running = false; if (interval) clearInterval(interval); }
      else { start = Date.now(); running = true; interval = setInterval(() => update(p), 50); }
      update(p);
    });
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      running = false; elapsed = 0; if (interval) clearInterval(interval);
      update(p);
    });
  };
  showPage((p) => update(p));
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start a stopwatch', 'open stopwatch'],
  nearMisses: ['what is a stopwatch', 'timer', 'countdown'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
