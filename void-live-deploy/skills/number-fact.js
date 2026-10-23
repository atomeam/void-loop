/**
 * number-fact skill — a random number fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a number fact", "random number fact", "number trivia".
 */
export function isNumberFact(text) {
  return /^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:number\s+)?(?:fact|trivia)|(?:another|a|random)\s+number\s+(?:fact|trivia)|number\s+(?:fact|trivia)(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A number fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://numbersapi.com/random/trivia?json', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'number-fact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>A number fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">about the number ' + esc(String(j.number)) + '</div><div class="sub">say “another number fact” for one more</div>'
      + '<div class="src">Source: <a href="https://numbersapi.com/" target="_blank" rel="noopener">numbersapi.com</a></div>';
    return 'number-fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A number fact</h2><p>The number service didn\'t answer, so here is mine: 42 is the answer to the ultimate question of life, the universe, and everything.</p>';
    return 'number-fact';
  }
}

export default {
  name: 'number-fact',
  examples: ['tell me a number fact', 'random number fact', 'number trivia', 'another number fact'],
  nearMisses: ['what is a number', 'facts about math', 'random fact'],
  match(lower, text) { return isNumberFact(text); },
  run,
  suite() {
    const ok = isNumberFact('tell me a number fact') && isNumberFact('random number fact') && !isNumberFact('random fact');
    return { ok, got: 'match works' };
  }
};
