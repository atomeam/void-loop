/**
 * fun-fact skill — a clean random fun fact (new idea from growth inbox).
 * "tell me a fun fact", "random fact", "give me a fact", "fun fact please".
 * Uses a free public source when available; falls back to a local list. Empty stage stays empty.
 */
const FACTS = [
  'Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible.',
  'Octopuses have three hearts, two pump blood to the gills and one to the rest of the body.',
  'A group of flamingos is called a flamboyance.',
  'Bananas are berries, but strawberries are not.',
  'The shortest war in history was between Britain and Zanzibar in 1896; it lasted 38 minutes.',
  'There are more possible iterations of a game of chess than there are atoms in the known universe.',
  'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid of Giza.',
  'A bolt of lightning is five times hotter than the surface of the sun.',
  'Wombat poop is cube-shaped.',
  'The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion of the iron.',
];

export function wantsFunFact(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:tell|give|show)\s+(?:me\s+)?)?(?:a\s+|another\s+|random\s+|one\s+more\s+)?(?:fun\s+)?facts?(?:\s+please)?$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A fun fact</h2><div class="sub">…</div>'; });
  try {
    // try a free API first
    const r = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
    if (r.ok) {
      const j = await r.json();
      if (j && j.text && api._pageStill && api._pageStill(el)) {
        el.innerHTML = '<h2>A fun fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.text) + '</p><div class="src">Source: uselessfacts.jsph.pl</div>';
        return 'fun-fact';
      }
    }
  } catch (_) {}
  if (!api._pageStill || !api._pageStill(el)) return 'fun-fact';
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  el.innerHTML = '<h2>A fun fact</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(fact) + '</p><div class="sub">from the local list (the fact service was away)</div>';
  return 'fun-fact';
}

export default {
  name: 'fun-fact',
  examples: ['tell me a fun fact', 'random fact', 'give me a fact', 'fun fact please'],
  nearMisses: ['what is a fact', 'history of facts', 'fact check this'],
  match(lower, text) { return wantsFunFact(text); },
  run,
  suite() {
    return { ok: wantsFunFact('tell me a fun fact') && wantsFunFact('random fact') && !wantsFunFact('tell me a joke') };
  },
};
