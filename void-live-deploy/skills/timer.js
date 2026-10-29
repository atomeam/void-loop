/**
 * timer skill — a simple countdown timer on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "set a timer for 5 minutes", "timer 30 seconds", "start a 2 minute timer".
 */
export function isTimer(text) {
  return /^(?:please\s+)?(?:(?:set|start|begin)\s+(?:a\s+)?timer(?:\s+for)?\s+\d+\s*(?:min(?:ute)?s?|sec(?:ond)?s?)|(?:timer|countdown)\s+(?:for\s+)?\d+\s*(?:min(?:ute)?s?|sec(?:ond)?s?))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseTime(text) {
  const m = /(\d+)\s*(min|sec)/i.exec(String(text || ''));
  if (!m) return 60;
  const n = +m[1];
  return /min/i.test(m[2]) ? n * 60 : n;
}

function run(text, api) {
  const { showPage, esc } = api;
  const secs = parseTime(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Timer</h2><p id="time" style="font-size:48px;text-align:center;font-weight:300">' + secs + '</p><div class="sub">running…</div>'; });
  let left = secs;
  const iv = setInterval(() => {
    left--;
    const t = el.querySelector('#time');
    if (t) t.textContent = left;
    if (left <= 0) {
      clearInterval(iv);
      el.innerHTML = '<h2>Timer</h2><p style="font-size:36px;text-align:center">Done!</p><div class="sub">say “timer for 5 minutes” for another</div>';
    }
  }, 1000);
  return 'timer';
}

export default {
  name: 'timer',
  examples: ['set a timer for 5 minutes', 'timer 30 seconds', 'start a 2 minute timer'],
  nearMisses: ['what time is it', 'days until new year', 'alarm clock'],
  match(lower, text) { return isTimer(text); },
  run,
  suite() {
    const ok = isTimer('set a timer for 5 minutes') && isTimer('timer 30 seconds') && !isTimer('what time is it');
    return { ok, got: 'match works' };
  }
};
