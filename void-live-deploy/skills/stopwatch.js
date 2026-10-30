/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start a stopwatch", "open the stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open|make|show)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage } = api;
  let running = false, startTime = 0, elapsed = 0, interval;
  const update = (p) => {
    const now = running ? elapsed + (Date.now() - startTime) : elapsed;
    const secs = Math.floor(now / 1000);
    const ms = Math.floor((now % 1000) / 10);
    const display = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + display + '</p>'
      + '<div style="text-align:center"><button id="sw-toggle" class="g-btn">' + (running ? 'Stop' : 'Start') + '</button> <button id="sw-reset" class="g-btn">Reset</button></div>'
      + '<div class="sub">say “stopwatch” for a new one</div>';
    p.querySelector('#sw-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      if (running) { elapsed += Date.now() - startTime; running = false; clearInterval(interval); }
      else { startTime = Date.now(); running = true; interval = setInterval(() => update(p), 50); }
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
  examples: ['stopwatch', 'start a stopwatch', 'open the stopwatch'],
  nearMisses: ['what is a stopwatch', 'stopwatch online', 'timer'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
