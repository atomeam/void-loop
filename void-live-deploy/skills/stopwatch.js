/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start stopwatch".
 * Empty surface stays empty; the stopwatch is an outcome page.
 */
export function isStopwatch(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:start|run)\s+(?:a\s+)?stopwatch|stopwatch(?:\s+please)?)$/i.test(t);
}

function run(text, api) {
  const { showPage } = api;
  let start = Date.now(), running = true;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p id="sw" style="font-size:48px;font-weight:300;text-align:center">0:00</p><div class="sub">say “stopwatch” to restart</div>';
  });
  const tick = () => {
    if (!api._pageStill(el) || !running) return;
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const display = Math.floor(elapsed/60) + ':' + String(elapsed%60).padStart(2,'0');
    const p = el.querySelector('#sw');
    if (p) p.textContent = display;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start stopwatch'],
  nearMisses: ['what is a stopwatch', 'stop the watch'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
