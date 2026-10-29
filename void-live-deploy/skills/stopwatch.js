/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let start = 0, elapsed = 0, id;
  const update = (p) => {
    const t = elapsed + (id ? Date.now() - start : 0);
    const s = Math.floor(t / 1000), ms = Math.floor((t % 1000) / 10);
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(s + '.' + String(ms).padStart(2, '0')) + '</p><div style="text-align:center"><button id="sw-toggle" class="g-btn">' + (id ? 'Stop' : 'Start') + '</button> <button id="sw-reset" class="g-btn">Reset</button></div><div class="sub">say “stopwatch” for a new one</div>';
    p.querySelector('#sw-toggle').addEventListener('click', (e) => { e.stopPropagation(); if (id) { elapsed += Date.now() - start; clearInterval(id); id = null; } else { start = Date.now(); id = setInterval(() => update(p), 50); } update(p); });
    p.querySelector('#sw-reset').addEventListener('click', (e) => { e.stopPropagation(); elapsed = 0; if (id) { clearInterval(id); id = null; } update(p); });
  };
  showPage((p) => update(p));
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start stopwatch'],
  nearMisses: ['what is a stopwatch', 'timer'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
