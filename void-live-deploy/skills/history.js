/**
 * history skill — what happened on this day in history (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "today in history", "what happened on this day", "on this day".
 */
export function isHistory(text) {
  return /^(?:please\s+)?(?:(?:today|this\s+day)\s+in\s+history|what\s+happened\s+(?:on\s+)?(?:this\s+day|today)|on\s+this\s+day(?:\s+in\s+history)?|historical\s+events\s+today)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Today in history</h2><div class="sub">…</div>'; });
  try {
    const now = new Date();
    const m = now.getMonth() + 1, d = now.getDate();
    const j = await fetch('https://history.muffinlabs.com/date/' + m + '/' + d, { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'history';
    const events = (j && j.data && j.data.Events) || [];
    if (!events.length) throw 0;
    const items = events.slice(0, 5).map((e) => '<li style="margin:6px 0">' + esc(e.year) + ': ' + esc(e.text) + '</li>').join('');
    el.innerHTML = '<h2>Today in history</h2><div class="sub">' + esc(m + '/' + d) + '</div><ul style="padding-left:18px">' + items + '</ul><div class="sub">say “today in history” again for a refresh</div>'
      + '<div class="src">Source: <a href="https://history.muffinlabs.com/" target="_blank" rel="noopener">history.muffinlabs</a></div>';
    return 'history';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Today in history</h2><p>The history service didn\'t answer just now. Try again in a moment.</p>';
    return 'history';
  }
}

export default {
  name: 'history',
  examples: ['today in history', 'what happened on this day', 'on this day', 'this day in history'],
  nearMisses: ['history of the world', 'what is history', 'historical facts'],
  match(lower, text) { return isHistory(text); },
  run,
  suite() {
    const ok = isHistory('today in history') && isHistory('on this day') && !isHistory('history of the world');
    return { ok, got: 'match works' };
  }
};
