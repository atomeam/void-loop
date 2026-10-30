/**
 * fact skill — a random fun fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fact", "fun fact", "random fact".
 */
export function isFact(text) {
  return /^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?(?:a|an|another|one\s+more)\s+(?:(?:fun|random|cool|interesting)\s+)?fact|(?:(?:another|a|an)\s+)?(?:fun|random|cool|interesting)\s+fact|(?:another|a)\s+fact|fact(?:\s+please)?|tell\s+me\s+something\s+(?:interesting|i\s+don'?t\s+know))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
// 2026-10-30: the page's small talk answered "tell me a fun fact" and "random fact" first, from 12 lines with no source, so this skill's own
// examples never reached it. Those asks come here now (void.html smallTalk no longer has them): a fact from the service, with its source.

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A fact</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'fact';
    if (!j || !j.text) throw 0;
    el.innerHTML = '<h2>A fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="sub">say “another fact” for one more</div>'
      + '<div class="src">Source: <a href="' + esc(j.source_url || 'https://uselessfacts.jsph.pl/') + '" target="_blank" rel="noopener">uselessfacts</a></div>';
    return 'fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A fact</h2><p>The fact service didn\'t answer, so here is mine: The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.</p>';
    return 'fact';
  }
}

export default {
  name: 'fact',
  examples: ['tell me a fact', 'fun fact', 'random fact', 'another fact', 'tell me a fun fact', 'give me a random fact', 'tell me something interesting'],
  nearMisses: ['what is a fact', 'facts about space', 'true or false', 'fact or opinion', 'tell me something about rome'],
  match(lower, text) { return isFact(text); },
  run,
  suite() {
    const ok = isFact('tell me a fact') && isFact('fun fact') && !isFact('what is a fact');
    return { ok, got: 'match works' };
  }
};
