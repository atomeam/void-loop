/**
 * stopwatch skill — a simple stopwatch on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "stopwatch", "start a stopwatch".
 */
export function isStopwatch(text) {
  return /^(?:please\s+)?(?:(?:start|open|make)\s+(?:a\s+)?)?stopwatch(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  let running = false, start = 0, elapsed = 0, id;
  const update = (p) => {
    const t = running ? Date.now() - start + elapsed : elapsed;
    const mm = Math.floor(t / 60000), ss = Math.floor((t % 60000) / 1000), ms = Math.floor((t % 1000) / 10);
    p.innerHTML = '<h2>Stopwatch</h2><p style="font-size:48px;text-align:center;font-family:monospace">' + esc(String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + '.' + String(ms).padStart(2, '0')) + '</p><div style="text-align:center"><button id="sw-start" class="g-btn">Start</button> <button id="sw-stop" class="g-btn">Stop</button> <button id="sw-reset" class="g-btn">Reset</button></div><div class="sub">say “stopwatch” for a new one</div>';
    const st = p.querySelector('#sw-start'), sp = p.querySelector('#sw-stop'), re = p.querySelector('#sw-reset');
    st.addEventListener('click', (e) => { e.stopPropagation(); if (running) return; running = true; start = Date.now(); id = setInterval(() => update(p), 50); });
    sp.addEventListener('click', (e) => { e.stopPropagation(); if (!running) return; running = false; elapsed += Date.now() - start; clearInterval(id); update(p); });
    re.addEventListener('click', (e) => { e.stopPropagation(); running = false; elapsed = 0; clearInterval(id); update(p); });
  };
  showPage((p) => update(p));
  return 'stopwatch';
}

export default {
  name: 'stopwatch',
  examples: ['stopwatch', 'start a stopwatch', 'open stopwatch'],
  nearMisses: ['what is a stopwatch', 'timer', 'clock'],
  match(lower, text) { return isStopwatch(text); },
  run,
  suite() {
    const ok = isStopwatch('stopwatch') && isStopwatch('start a stopwatch') && !isStopwatch('what is a stopwatch');
    return { ok, got: 'match works' };
  }
};
