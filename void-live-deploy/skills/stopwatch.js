/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "start a stopwatch", "stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\\s+)?(?:(?:start|show|make|give\\s+me)\\s+(?:a\\s+)?)?stopwatch(?:\\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage } = api;
  let start = 0, running = false, elapsed = 0;
  const update = (el) => {
    const now = running ? elapsed + (Date.now() - start) : elapsed;
    const s = Math.floor(now / 1000);
    const ms = Math.floor((now % 1000) / 10);
    el.querySelector('.time').textContent = String(s).padStart(2, '0') + '.' + String(ms).padStart(2, '0');
  };
  showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p class="time" style="font-size:48px;text-align:center;font-family:monospace">00.00</p><button style="margin:10px;padding:8px 16px">Start</button><button style="margin:10px;padding:8px 16px">Reset</button><div class="sub">click start / stop / reset</div>';
    const timeEl = p.querySelector('.time');
    const btns = p.querySelectorAll('button');
    btns[0].addEventListener('click', () => {
      if (running) { elapsed += Date.now() - start; running = false; btns[0].textContent = 'Start'; } else { start = Date.now(); running = true; btns[0].textContent = 'Stop'; }
      update(p);
    });
    btns[1].addEventListener('click', () => { elapsed = 0; running = false; start = 0; btns[0].textContent = 'Start'; update(p); });
    setInterval(() => { if (running) update(p); }, 50);
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['start a stopwatch', 'stopwatch', 'show stopwatch'],
  nearMisses: ['what is a stopwatch', 'stopwatch app', 'buy a stopwatch'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('start a stopwatch') && isStopwatch('stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
