/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a stopwatch", "stopwatch", "start stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|make|open)\s+(?:a\s+)?stopwatch|stopwatch(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const start = Date.now();
  showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p id="sw" style="font-size:36px;text-align:center;font-variant-numeric:tabular-nums">0.00</p><div class="sub">running · say “stop the stopwatch” or “stopwatch” again to restart</div>';
    const el = p.querySelector('#sw');
    if (el) {
      const tick = () => { if (!el.isConnected) return; el.textContent = ((Date.now() - start) / 1000).toFixed(2); requestAnimationFrame(tick); };
      tick();
    }
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['start a stopwatch', 'stopwatch', 'start stopwatch'],
  nearMisses: ['what is a stopwatch', 'timer', 'set a timer'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('start a stopwatch') && isStopwatch('stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
