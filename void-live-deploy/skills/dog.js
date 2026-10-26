/**
 * dog skill — a random dog photo from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show me a dog", "random dog", "dog photo".
 */
export function isDog(text) {
  return /^(?:please\s+)?(?:show\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:random\s+)?dog(?:\s+(?:photo|picture|pic))?|(?:another|a|random)\s+dog(?:\s+(?:photo|picture))?|dog(?:\s+(?:photo|picture|pic))?(?:\s+please)?|give\s+me\s+a\s+dog)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A dog</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://dog.ceo/api/breeds/image/random', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'dog';
    if (!j || j.status !== 'success' || !j.message) throw 0;
    el.innerHTML = '<h2>A dog</h2><img src="' + esc(j.message) + '" alt="a dog" style="max-width:100%;border-radius:8px"><div class="sub">say “another dog” for one more</div>'
      + '<div class="src">Source: <a href="https://dog.ceo/" target="_blank" rel="noopener">dog.ceo</a></div>';
    return 'dog';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A dog</h2><p>The dog service didn\'t answer. Try again in a moment.</p>';
    return 'dog';
  }
}

export default {
  name: 'dog',
  examples: ['show me a dog', 'random dog', 'dog photo', 'another dog'],
  nearMisses: ['what is a dog', 'dog breeds list', 'hot dog'],
  match(lower, text) { return isDog(text); },
  run,
  suite() {
    const ok = isDog('show me a dog') && isDog('random dog') && !isDog('what is a dog');
    return { ok, got: 'match works' };
  }
};
