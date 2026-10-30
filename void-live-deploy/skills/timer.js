/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "set a timer for 5 minutes", "start a 10 second timer", "timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:(?:set|start|make|open)\s+(?:a\s+)?)?(?:\d+\s+(?:second|minute|min|sec)s?\s+)?timer(?:\s+(?:for\s+)?\d+\s+(?:second|minute|min|sec)s?)?(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''))
    || /^(?:please\s+)?(?:set|start)\s+a\s+timer(?:\s+for\s+\d+\s+(?:second|minute|min|sec)s?)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDuration(text) {
  const m = /(\d+)\s*(second|minute|min|sec)s?/i.exec(text || '');
  if (!m) return 60;
  const n = +m[1];
  return /min/i.test(m[2]) ? n * 60 : n;
}

function run(text, api) {
  const { showPage, esc } = api;
  let seconds = parseDuration(text);
  let left = seconds;
  let interval;
  const update = (p) => {
    const m = Math.floor(left / 60), s = left % 60;
    const time = m + ':' + String(s).padStart(2, '0');
    p.innerHTML = '<h2>Timer</h2><p style="font-size:48px;font-weight:300;text-align:center;font-family:monospace">' + esc(time) + '</p><div style="text-align:center"><button id="timer-pause" class="g-btn">' + (interval ? 'Pause' : 'Start') + '</button> <button id="timer-reset" class="g-btn">Reset</button></div><div class="sub">say “timer for 5 minutes” for another</div>';
    const pause = p.querySelector('#timer-pause'), reset = p.querySelector('#timer-reset');
    pause.addEventListener('click', (e) => {
      e.stopPropagation();
      if (interval) { clearInterval(interval); interval = null; }
      else {
        interval = setInterval(() => {
          left--;
          if (left <= 0) { clearInterval(interval); interval = null; left = 0; }
          update(p);
        }, 1000);
      }
      update(p);
    });
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      if (interval) clearInterval(interval);
      interval = null;
      left = seconds;
      update(p);
    });
  };
  showPage((p) => { update(p); });
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['timer', 'set a timer', 'start a timer for 5 minutes', '10 second timer'],
  nearMisses: ['what time is it', 'countdown to new year', 'stopwatch'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('timer') && isTimer('set a timer for 5 minutes') && !isTimer('what time is it');
    return { ok, got: 'match works' };
  }
};
