/**
 * fact skill — a short random interesting fact
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "tell me a fact", "random fact", "did you know".
 */
const FACTS = [
  'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.',
  'A group of flamingos is called a flamboyance.',
  'Octopuses have three hearts. Two pump blood to the gills, while the third pumps it to the rest of the body.',
  'The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.',
  'Bananas are berries, but strawberries are not.',
  'A day on Venus is longer than a year on Venus.',
  'The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion.',
  'There are more possible iterations of a game of chess than there are atoms in the known universe.',
  'Wombat poop is cube-shaped.',
  'The inventor of the Pringles can is buried in one.'
];
export function isFact(text) {
  return /^(?:please\s+)?(?:tell\s+me\s+(?:a\s+)?fact|random\s+fact|(?:a\s+)?fact(?:\s+please)?|did\s+you\s+know)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
export function suite() {
  return { ok: isFact('tell me a fact') && isFact('random fact') && !isFact('what is a fact') };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const f = FACTS[Math.floor(Math.random() * FACTS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>A fact</h2><p style="font-size:20px;line-height:1.45;font-weight:300">' + esc(f) + '</p><div class="sub">say “tell me a fact” for another</div>';
  });
  return 'fact';
}
export default {
  name: 'fact',
  examples: ['tell me a fact', 'random fact', 'did you know'],
  nearMisses: ['what is a fact', 'history of facts', 'fact check'],
  match(lower, text) { return isFact(text); },
  run,
  suite
};
