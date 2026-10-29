/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a stopwatch", "stopwatch", "start the stopwatch".
 * Empty surface stays empty.
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:start\s+(?:a\s+)?stopwatch|stopwatch(?:\s+please)?|start\s+the\s+stopwatch)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:32px;font-weight:300;text-align:center" id="sw">0.0</p><div class="sub">running</div>';
    const el = p.querySelector('#sw');
    const start = Date.now();
    const id = setInterval(() => {
      const secs = ((Date.now() - start) / 1000).toFixed(1);
      if (el) el.textContent = secs;
    }, 100);
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['start a stopwatch', 'stopwatch', 'start the stopwatch'],
  nearMisses: ['what is a stopwatch', 'timer', 'clock'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('start a stopwatch') && isStopwatch('stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
