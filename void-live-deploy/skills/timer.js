/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a timer", "5 minute timer", "countdown 30 seconds", "timer".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isTimer(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:start|set|make|begin|run)\s+(?:a\s+)?(?:\d+\s+(?:minute|min|second|sec|hour|hr)s?\s+)?timer|(?:\d+\s+(?:minute|min|second|sec|hour|hr)s?\s+)?timer|(?:countdown|count\s+down)\s+(?:for\s+)?\d+\s+(?:minute|min|second|sec|hour|hr)s?)$/i.test(t);
}

function parseDuration(text) {
  const t = String(text || '').toLowerCase();
  let ms = 5 * 60 * 1000; // default 5 min
  const m = /(\d+)\s*(minute|min|second|sec|hour|hr)/i.exec(t);
  if (m) {
    const n = +m[1];
    const unit = m[2][0];
    if (unit === 's') ms = n * 1000;
    else if (unit === 'h') ms = n * 3600 * 1000;
    else ms = n * 60 * 1000;
  }
  return Math.max(1000, Math.min(ms, 24 * 3600 * 1000));
}

function run(text, api) {
  const { showPage, esc } = api;
  const duration = parseDuration(text);
  const end = Date.now() + duration;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Timer</h2><p id="t" style="font-size:48px;font-weight:300;text-align:center;font-variant-numeric:tabular-nums">—</p><div class="sub">say “stop timer” or close the card</div>';
  });
  const tick = () => {
    if (!api._pageStill(el)) return;
    const left = Math.max(0, end - Date.now());
    const s = Math.floor(left / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const display = el.querySelector('#t');
    if (display) display.textContent = mm + ':' + ss;
    if (left > 0) setTimeout(tick, 250);
    else if (display) display.textContent = '00:00';
  };
  tick();
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['start a timer', '5 minute timer', 'countdown 30 seconds', 'timer', 'set a 10 min timer'],
  nearMisses: ['what time is it', 'days until new year', 'stopwatch', 'how long is a timer'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('start a timer') && isTimer('5 minute timer') && isTimer('countdown 30 seconds') && !isTimer('what time is it');
    return { ok, got: 'match works' };
  }
};
