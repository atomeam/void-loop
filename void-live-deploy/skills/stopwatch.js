/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start stopwatch", "time me".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start\s+)?stopwatch|time\s+me|stop\s+watch)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Stopwatch</h2><p id="sw" style="font-size:48px;text-align:center;font-weight:300">0.0</p><div class="sub">say “stopwatch” to start</div>'; });
  let start = Date.now(), id = setInterval(() => {
    if (!api._pageStill(el)) { clearInterval(id); return; }
    const t = el.querySelector('#sw');
    if (t) t.textContent = ((Date.now() - start) / 1000).toFixed(1);
  }, 100);
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start stopwatch', 'time me'],
  nearMisses: ['what is a stopwatch', 'stop the watch', 'watch the time'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('time me') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
