/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "set a timer for 5 minutes", "start a 30 second timer", "timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:set\s+(?:a\s+)?timer(?:\s+for\s+\d+\s+(?:second|minute|min|sec)s?)?|start\s+(?:a\s+)?(?:\d+\s+)?(?:second|minute|min|sec)s?\s+timer|timer(?:\s+for\s+\d+\s+(?:second|minute|min|sec)s?)?|countdown\s+timer)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDuration(text) {
  const m = /(\d+)\s*(second|minute|min|sec)s?/i.exec(text || '');
  if (!m) return 60;
  const n = parseInt(m[1], 10);
  return /min/i.test(m[2]) ? n * 60 : n;
}

function run(text, api) {
  const { showPage, esc } = api;
  const secs = parseDuration(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Timer</h2><p id="t" style="font-size:48px;text-align:center;font-weight:300">' + secs + '</p><div class="sub">say “set a timer for 5 minutes”</div>'; });
  let left = secs;
  const id = setInterval(() => {
    if (!api._pageStill(el)) { clearInterval(id); return; }
    left--;
    const t = el.querySelector('#t');
    if (t) t.textContent = left > 0 ? left : 'Done!';
    if (left <= 0) clearInterval(id);
  }, 1000);
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['set a timer for 5 minutes', 'start a 30 second timer', 'timer', 'countdown timer'],
  nearMisses: ['what is a timer', 'kitchen timer', 'timer for the oven'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('set a timer for 5 minutes') && isTimer('timer') && !isTimer('what is a timer');
    return { ok, got: 'match works' };
  }
};
