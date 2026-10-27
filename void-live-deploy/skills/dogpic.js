/**
 * dogpic skill — a random dog picture from dog.ceo (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show me a dog", "random dog", "dog picture".
 */
export function isDogPic(text) {
  return /^(?:please\s+)?(?:show\s+(?:me\s+)?(?:a|another|one\s+more)\s+dog|(?:another|a|random)\s+dog(?:\s+picture|\s+pic)?|dog\s+(?:picture|pic|photo)(?:\s+please)?|give\s+me\s+a\s+dog)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A dog</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://dog.ceo/api/breeds/image/random', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'dogpic';
    if (!j || !j.message || j.status !== 'success') throw 0;
    el.innerHTML = '<h2>A dog</h2><img src="' + esc(j.message) + '" alt="a random dog" style="max-width:100%;border-radius:8px"><div class="sub">say “another dog” for one more</div>'
      + '<div class="src">Source: <a href="https://dog.ceo/" target="_blank" rel="noopener">dog.ceo</a></div>';
    return 'dogpic';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A dog</h2><p>The dog service didn\'t answer, so here is a thought: Dogs have about 300 million olfactory receptors in their noses, compared to about 6 million in humans.</p>';
    return 'dogpic';
  }
}

export default {
  name: 'dogpic',
  examples: ['show me a dog', 'random dog', 'dog picture', 'another dog'],
  nearMisses: ['what is a dog', 'dog breeds', 'cat picture'],
  match(lower, text) { return isDogPic(text); },
  run,
  suite() {
    const ok = isDogPic('show me a dog') && isDogPic('dog picture') && !isDogPic('what is a dog');
    return { ok, got: 'match works' };
  }
};
