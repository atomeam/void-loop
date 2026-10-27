/**
 * dog skill — a random dog image from dog.ceo (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show me a dog", "random dog", "dog picture".
 */
export function isDog(text) {
  return /^(?:please\s+)?(?:(?:show\s+(?:me\s+)?)?(?:a|another|random)\s+(?:dog|puppy)(?:\s+(?:picture|photo|image))?|(?:dog|puppy)\s+(?:picture|photo|image)|random\s+dog)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A dog</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://dog.ceo/api/breeds/image/random', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'dog';
    if (!j || j.status !== 'success' || !j.message) throw 0;
    el.innerHTML = '<h2>A dog</h2><img src="' + esc(j.message) + '" alt="a random dog" style="max-width:100%;border-radius:8px;margin:10px 0"><div class="sub">say “another dog” for one more</div>'
      + '<div class="src">Source: <a href="https://dog.ceo/" target="_blank" rel="noopener">dog.ceo</a></div>';
    return 'dog';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A dog</h2><p>The dog service didn\'t answer just now. Try again in a moment.</p>';
    return 'dog';
  }
}

export default {
  name: 'dog',
  examples: ['show me a dog', 'random dog', 'dog picture', 'another dog'],
  nearMisses: ['what is a dog', 'dog breeds list', 'cat picture'],
  match(lower, text) { return isDog(text); },
  run,
  suite() {
    const ok = isDog('show me a dog') && isDog('random dog') && !isDog('cat picture');
    return { ok, got: 'match works' };
  }
};
