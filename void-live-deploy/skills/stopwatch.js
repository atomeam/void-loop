/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start a stopwatch", "stopwatch please".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|show|open|make)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage } = api;
  let running = false, start = 0, banked = 0, interval;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p id="time" style="font-size:48px;font-family:monospace;text-align:center">0:00.00</p>'
      + '<div style="text-align:center;margin:12px"><button id="startstop">Start</button> <button id="reset">Reset</button></div>'
      + '<div class="sub">say “stopwatch” for another</div>';
    const timeEl = p.querySelector('#time');
    const ss = p.querySelector('#startstop');
    const rs = p.querySelector('#reset');
    const fmt = (ms) => {
      const s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60, cs = Math.floor((ms % 1000) / 10);
      return `${m}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
    };
    const tick = () => { if (running) timeEl.textContent = fmt(banked + (Date.now() - start)); };
    ss.addEventListener('click', () => {
      if (running) { banked += Date.now() - start; running = false; ss.textContent = 'Start'; clearInterval(interval); }
      else { start = Date.now(); running = true; ss.textContent = 'Stop'; interval = setInterval(tick, 50); }
    });
    rs.addEventListener('click', () => { running = false; banked = 0; start = 0; timeEl.textContent = '0:00.00'; ss.textContent = 'Start'; clearInterval(interval); });
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start a stopwatch', 'show stopwatch'],
  nearMisses: ['what is a stopwatch', 'stop the watch', 'watch'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
