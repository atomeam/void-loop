/**
 * apod skill — NASA's Astronomy Picture of the Day (no key, via public proxy)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "astronomy picture of the day", "APOD", "show me today's space picture".
 */
export function isApod(text) {
  return /^(?:please\s+)?(?:(?:show\s+(?:me\s+)?)?(?:the\s+)?(?:astronomy\s+picture\s+of\s+the\s+day|apod|nasa\s+picture\s+of\s+the\s+day|today'?s\s+(?:space|astronomy)\s+picture)|space\s+picture(?:\s+of\s+the\s+day)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Astronomy Picture of the Day</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://apod.as93.net/apod', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'apod';
    if (!j || !j.title) throw 0;
    const img = j.hdurl || j.url || '';
    el.innerHTML = '<h2>' + esc(j.title) + '</h2>'
      + (img ? '<img src="' + esc(img) + '" alt="' + esc(j.title) + '" style="max-width:100%;border-radius:8px;margin:10px 0">' : '')
      + '<p style="font-size:16px;line-height:1.45">' + esc(j.explanation || '') + '</p>'
      + '<div class="sub">' + esc(j.date || '') + '</div>'
      + '<div class="src">Source: <a href="https://apod.nasa.gov/" target="_blank" rel="noopener">NASA APOD</a> via <a href="https://apod.as93.net/" target="_blank" rel="noopener">apod.as93.net</a></div>';
    return 'apod';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Astronomy Picture of the Day</h2><p>The APOD service didn\'t answer just now. Try again in a moment.</p>';
    return 'apod';
  }
}

export default {
  name: 'apod',
  examples: ['astronomy picture of the day', 'APOD', 'show me today\'s space picture', 'nasa picture of the day'],
  nearMisses: ['what is astronomy', 'pictures of the moon', 'space news'],
  match(lower, text) { return isApod(text); },
  run,
  suite() {
    const ok = isApod('astronomy picture of the day') && isApod('APOD') && !isApod('space news');
    return { ok, got: 'match works' };
  }
};
