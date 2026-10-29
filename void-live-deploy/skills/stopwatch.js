/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start a stopwatch", "show the stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|show|open|give\s+me)\s+(?:a\s+)?)?(?:stop\s*watch|stopwatch)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let running = false, start = 0, elapsed = 0, timer = null;
  const format = (ms) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    return (h ? h + ':' : '') + String(m % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '.' + String(Math.floor(ms % 1000 / 10)).padStart(2, '0');
  };
  showPage((p) => {
    p.innerHTML = '<h2>Stopwatch</h2><p id="sw-time" style="font-size:48px;font-family:monospace;text-align:center;margin:20px 0">00:00.00</p><div style="text-align:center"><button id="sw-start" class="g-btn">Start</button> <button id="sw-stop" class="g-btn">Stop</button> <button id="sw-reset" class="g-btn">Reset</button></div><div class="sub">say “stopwatch” to open another</div>';
    const timeEl = p.querySelector('#sw-time');
    const tick = () => { if (running) { elapsed = Date.now() - start; timeEl.textContent = format(elapsed); } };
    p.querySelector('#sw-start').addEventListener('click', (e) => { e.stopPropagation(); if (!running) { running = true; start = Date.now() - elapsed; timer = setInterval(tick, 50); } });
    p.querySelector('#sw-stop').addEventListener('click', (e) => { e.stopPropagation(); if (running) { running = false; clearInterval(timer); elapsed = Date.now() - start; timeEl.textContent = format(elapsed); } });
    p.querySelector('#sw-reset').addEventListener('click', (e) => { e.stopPropagation(); running = false; clearInterval(timer); elapsed = 0; timeEl.textContent = format(0); });
  });
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start a stopwatch', 'show the stopwatch', 'open stopwatch'],
  nearMisses: ['what is a stopwatch', 'stop the watch', 'watch the clock'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
