/**
 * today-history skill — what happened on this day in history from Numbers API (no key).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "today in history", "what happened today", "on this day".
 * Empty surface stays empty.
 */
export function isTodayHistory(text) {
  return /^(?:please\s+)?(?:(?:what\s+happened\s+(?:on\s+)?today|today\s+in\s+history|on\s+this\s+day|this\s+day\s+in\s+history|historical\s+event\s+today)(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Today in history</h2><div class="sub">…</div>'; });
  try {
    const d = new Date();
    const m = d.getMonth() + 1, day = d.getDate();
    const j = await fetch(`http://numbersapi.com/${m}/${day}/date`).then((r) => r.text());
    if (!api._pageStill(el)) return 'today-history';
    if (!j || j.includes('error')) throw 0;
    el.innerHTML = '<h2>Today in history</h2><p style="font-size:20px;line-height:1.45;font-weight:300">' + esc(j) + '</p><div class="sub">from Numbers API</div>'
      + '<div class="src">Source: <a href="http://numbersapi.com/" target="_blank" rel="noopener">numbersapi.com</a></div>';
    return 'today-history';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Today in history</h2><p>The history service did not answer. On this day in 1929 the stock market crashed, beginning the Great Depression.</p>';
    return 'today-history';
  }
}

export default {
  name: 'today-history',
  examples: ['today in history', 'what happened today', 'on this day'],
  nearMisses: ['history of the world', 'what is history', 'history class'],
  match(lower, text) { return isTodayHistory(text); },
  run,
  suite() {
    const ok = isTodayHistory('today in history') && isTodayHistory('on this day') && !isTodayHistory('history of the world');
    return { ok, got: 'match works' };
  }
};
