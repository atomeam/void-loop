/**
 * fact skill — a random fun fact from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fact", "fun fact", "random fact".
 */
export function isFact(text) {
  return /^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?(?:a|an|another|one\s+more)\s+(?:(?:fun|random|cool|interesting)\s+)?fact|(?:(?:another|a|an)\s+)?(?:fun|random|cool|interesting)\s+fact|(?:another|a)\s+fact|fact(?:\s+please)?|tell\s+me\s+something\s+(?:interesting|i\s+don'?t\s+know))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
// "tell me a fact about octopuses", "a fun fact about the moon", "give me 3 facts about mars": a sentence from the Wikipedia article on that
// topic, linked. 2026-10-30 the octopus ask on a-to-mind.com fell to the article search, which quoted a law that names octopuses in passing.
// A bare "facts about space" is left to the article search.
export function factTopic(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = /^(?:please\s+)?(?:(?:tell|give|show)\s+me\s+(?:a|an|one|some|another|\d)\s+|(?:a|an|another|some)\s+)(?:(?:fun|random|cool|interesting|weird|surprising)\s+)?facts?\s+(?:about|on)\s+(.{2,60})$/i.exec(t)
    || /^(?:fun|cool|interesting|weird|surprising)\s+facts?\s+(?:about|on)\s+(.{2,60})$/i.exec(t);
  if (!m) return '';
  const q = m[1].replace(/^(?:the|a|an)\s+/i, '').trim();
  return /^(?:me|you|myself|yourself|it|this|that|them|us|life|anything|something|everything)$/i.test(q) ? '' : q;
}
// the sentences of an article's lead that can stand alone as a fact; the first one only names the thing, so it comes last
export function factSentences(extract) {
  const all = String(extract || '').replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(?=\s+[A-Z0-9"\u201c]|$)/g) || [];
  const s = all.map((x) => x.trim()).filter((x) => x.length >= 40 && x.length <= 320 && !/may refer to/i.test(x));
  return s.length > 1 ? s.slice(1).concat(s[0]) : s;
}
async function runTopic(topic, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A fact about ' + esc(topic) + '</h2><div class="sub">\u2026</div>'; });
  try {
    const j = await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts|pageprops&exintro=1&explaintext=1&ppprop=disambiguation&titles=' + encodeURIComponent(topic)).then((r) => r.json());
    if (!api._pageStill(el)) return 'fact';
    const page = Object.values((j && j.query && j.query.pages) || {})[0];
    if (!page || page.missing !== undefined || (page.pageprops && page.pageprops.disambiguation !== undefined)) {
      el.innerHTML = '<h2>A fact about ' + esc(topic) + '</h2><p>Wikipedia has no single article named \u201c' + esc(topic) + '\u201d, so Verse does not guess a fact. Try a more exact name.</p>';
      return 'fact';
    }
    const list = factSentences(page.extract);
    if (!list.length) throw 0;
    const pick = list[Math.floor(Math.random() * Math.min(list.length, 6))];
    const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'));
    el.innerHTML = '<h2>A fact about ' + esc(page.title) + '</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(pick) + '</p><div class="sub">say \u201canother fact about ' + esc(topic) + '\u201d for one more</div>'
      + '<div class="src">Source: <a href="' + esc(url) + '" target="_blank" rel="noopener">Wikipedia, ' + esc(page.title) + '</a></div>';
    return 'fact';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A fact about ' + esc(topic) + '</h2><p>Wikipedia didn\'t answer just now, so there is no fact to show. Try again in a moment.</p>';
    return 'none';
  }
}
// 2026-10-30: the page's small talk answered "tell me a fun fact" and "random fact" first, from 12 lines with no source, so this skill's own
// examples never reached it. Those asks come here now (void.html smallTalk no longer has them): a fact from the service, with its source.

async function run(text, api) {
  const topic = factTopic(text);
  if (topic) return runTopic(topic, api);
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
  examples: ['tell me a fact', 'fun fact', 'random fact', 'another fact', 'tell me a fun fact', 'give me a random fact', 'tell me something interesting', 'tell me a fact about octopuses', 'give me a fun fact about the moon'],
  nearMisses: ['what is a fact', 'facts about space', 'true or false', 'fact or opinion', 'tell me something about rome', 'tell me a fact about me'],
  match(lower, text) { return isFact(text) || !!factTopic(text); },
  run,
  suite() {
    const ok = isFact('tell me a fact') && isFact('fun fact') && !isFact('what is a fact');
    return { ok, got: 'match works' };
  }
};
