/**
 * fact skill — a clean, interesting fact from a curated list (nothing sent, nothing kept)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fact", "random fact", "interesting fact", "give me a fact"
 */
const FACTS = [
  'Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.',
  'Octopuses have three hearts, blue blood, and can taste with their suckers.',
  'A day on Venus is longer than a year on Venus. It rotates so slowly that one day takes longer than one orbit around the Sun.',
  'Bananas are berries, but strawberries are not.',
  'The shortest war in history was between Britain and Zanzibar in 1896. It lasted 38 minutes.',
  'Wombat poop is cube-shaped. This helps it stay put and mark territory.',
  'There are more possible iterations of a game of chess than there are atoms in the observable universe.',
  'The Great Wall of China is not visible from space with the naked eye. That is a myth.',
  'A group of flamingos is called a flamboyance.',
  'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid of Giza.',
  'Sharks have been around longer than trees.',
  'The inventor of the Pringles can is buried in one.',
  'A cloud can weigh more than a million pounds.',
  'The human nose can detect over 1 trillion different smells.',
  'Oxford University is older than the Aztec Empire.',
];

export function factOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:tell|give|show)\s+(?:me\s+)?)?(?:a\s+|an\s+|another\s+|random\s+|interesting\s+|cool\s+|fun\s+)?(?:fact|facts)(?:\s+please)?$/.test(t);
}

export function pickFact(seed = Date.now()) {
  const i = Math.abs(Math.floor(seed / 1000) % FACTS.length);
  return FACTS[i];
}

function run(text, api) {
  if (!factOf(text)) return 'none';
  const { showPage, esc } = api;
  const fact = pickFact();
  showPage((el) => {
    el.innerHTML = '<h2>A fact</h2><p style="font-size:20px;line-height:1.5;font-weight:300">' + esc(fact) + '</p>'
      + '<div class="sub">say “another fact” for a different one</div>'
      + '<div class="src">From a short curated list · nothing is sent or stored</div>';
  });
  return 'fact';
}

export default {
  name: 'fact',
  examples: ['tell me a fact', 'random fact', 'interesting fact', 'give me a fact', 'another fact'],
  nearMisses: ['what is a fact', 'fact check this', 'the fact of the matter', 'science facts about space'],
  match(lower, text) { return factOf(text); },
  run,
  suite() {
    const ok = factOf('tell me a fact') && factOf('random fact') && !factOf('what is a fact') && typeof pickFact(42) === 'string' && pickFact(42).length > 20;
    return { ok, got: ok ? 'matched and picked' : 'failed match or pick' };
  },
};
