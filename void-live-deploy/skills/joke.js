/**
 * joke skill — a clean, family-friendly joke from icanhazdadjoke (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a joke", "make me laugh", "dad joke".
 */
export function isJoke(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more|a\s+funny)\s+joke|(?:another|a)\s+joke|joke(?:\s+please)?|make\s+me\s+laugh|(?:tell\s+me\s+a\s+)?dad\s+joke|say\s+something\s+funny|got\s+any\s+jokes)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A joke</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://icanhazdadjoke.com/', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'joke';
    if (!j || !j.joke) throw 0;
    el.innerHTML = '<h2>A joke</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.joke) + '</p><div class="sub">say “another joke” for one more</div>'
      + '<div class="src">Source: <a href="https://icanhazdadjoke.com/j/' + encodeURIComponent(j.id || '') + '" target="_blank" rel="noopener">icanhazdadjoke</a></div>';
    return 'joke';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A joke</h2><p>The joke service didn\'t answer, so here is mine: I tried to catch fog yesterday. Mist.</p>';
    return 'joke';
  }
}
export default {
  name: 'joke',
  examples: ['tell me a joke', 'make me laugh', 'dad joke'],
  nearMisses: ['what is a joke', 'who is the joker', 'history of comedy'],
  match(lower, text) { return isJoke(text); },
  run
};
