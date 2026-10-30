/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a stopwatch", "stopwatch", "time this".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isStopwatch(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:start|run|begin)\s+(?:a\s+)?stopwatch|stopwatch|time\s+this)$/i.test(t);
}

function run(text, api) {
  const { showPage } = api;
  let start = Date.now(), running = true;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p id="t" style="font-size:48px;font-weight:300;text-align:center;font-variant-numeric:tabular-nums">00:00.0</p><div class="sub">click the card or say “stop” to pause</div>';
  });
  const tick = () => {
    if (!api._pageStill(el) || !running) return;
    const elapsed = Date.now() - start;
    const s = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const d = Math.floor((elapsed % 1000) / 100);
    const display = el.querySelector('#t');
    if (display) display.textContent = mm + ':' + ss + '.' + d;
    setTimeout(tick, 100);
  };
  tick();
  // simple click to toggle
  el.addEventListener('click', () => {
    if (running) { running = false; }
    else { start = Date.now() - (Date.now() - start); running = true; tick(); }
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['start a stopwatch', 'stopwatch', 'time this'],
  nearMisses: ['what time is it', 'timer', 'how long'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('start a stopwatch') && isStopwatch('stopwatch') && !isStopwatch('what time is it');
    return { ok, got: 'match works' };
  }
};
