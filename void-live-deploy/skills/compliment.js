/**
 * compliment skill — a random compliment from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a compliment", "random compliment", "compliment me".
 */
export function isCompliment(text) {
  return /^(?:please\s+)?(?:(?:give|tell)\s+(?:me\s+)?(?:a|another|one\s+more)\s+compliment|(?:another|a|random)\s+compliment|compliment(?:\s+me)?(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A compliment</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://complimentr.com/api', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'compliment';
    if (!j || !j.compliment) throw 0;
    el.innerHTML = '<h2>A compliment</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.compliment) + '</p><div class="sub">say “another compliment” for one more</div>'
      + '<div class="src">Source: <a href="https://complimentr.com/" target="_blank" rel="noopener">complimentr.com</a></div>';
    return 'compliment';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A compliment</h2><p>The compliment service didn\'t answer, so here is mine: You have a wonderful sense of curiosity.</p>';
    return 'compliment';
  }
}

export default {
  name: 'compliment',
  examples: ['give me a compliment', 'random compliment', 'compliment me', 'another compliment'],
  nearMisses: ['what is a compliment', 'compliments about my work', 'insult me'],
  match(lower, text) { return isCompliment(text); },
  run,
  suite() {
    const ok = isCompliment('give me a compliment') && isCompliment('random compliment') && !isCompliment('insult me');
    return { ok, got: 'match works' };
  }
};
