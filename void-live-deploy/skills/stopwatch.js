/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start stopwatch", "open a stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open|make|show|give\s+me)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let running = false, startTime = 0, elapsed = 0, interval;
  const format = (ms) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    return (h ? h + ':' : '') + String(m % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '.' + String(Math.floor(ms % 1000 / 10)).padStart(2, '0');
  };
  const update = (p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(format(elapsed)) + '</p><div style="text-align:center"><button id="sw-toggle" class="g-btn">' + (running ? 'Stop' : 'Start') + '</button> <button id="sw-reset" class="g-btn">Reset</button></div><div class="sub">say “stopwatch” for a new one</div>';
    p.querySelector('#sw-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      if (running) { running = false; elapsed += Date.now() - startTime; clearInterval(interval); }
      else { running = true; startTime = Date.now(); interval = setInterval(() => { elapsed = elapsed; update(p); }, 50); }
      update(p);
    });
    p.querySelector('#sw-reset').addEventListener('click', (e) => {
      e.stopPropagation();
      running = false; elapsed = 0; clearInterval(interval); update(p);
    });
  };
  showPage((p) => update(p));
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start stopwatch', 'open a stopwatch'],
  nearMisses: ['what is a stopwatch', 'stopwatch timer', 'countdown'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
