/**
 * fun-fact skill — a random interesting fact on a card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fun fact", "random fun fact", "give me a fact".
 * Hard-coded facts; empty surface stays empty. No external calls.
 */
const FACTS = [
  'The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.',
  'Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still edible.',
  'Octopuses have three hearts and blue blood. Two hearts pump blood to the gills, while the third pumps it to the rest of the body.',
  'A group of flamingos is called a flamboyance.',
  'The inventor of the Pringles can is buried in one. Fredric Baur designed the can and asked to be buried in one after his death.',
  'There are more possible games of chess than atoms in the observable universe.',
  'Bananas are berries, but strawberries are not. Botanically, berries come from a single flower with one ovary.',
  'The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion of the iron.',
  'A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate once, but only 225 Earth days to orbit the sun.',
  'The first computer bug was an actual bug. In 1947, Grace Hopper found a moth in a relay of the Harvard Mark II computer.'
];

export function factOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:tell me |give me |show me |what(?:'s| is) )?a )?(?:random |interesting )?fun fact$|^(?:random |interesting )?fact(?: of the day)?$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!factOf(text)) return 'none';
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Fun fact</h2><p>' + esc(fact) + '</p><div class="src">Hard-coded facts · ask again for another</div>';
  });
  return 'fun-fact';
}

export default {
  name: 'fun-fact',
  examples: ['tell me a fun fact', 'random fun fact', 'give me a fact', 'fun fact of the day'],
  nearMisses: ['what is a fact', 'facts about space', 'how do I fact check', 'true facts'],
  match(lower, text) { return factOf(text || lower); },
  run,
  suite() {
    return { ok: factOf('tell me a fun fact') && factOf('random fun fact') && !factOf('what is a fact') };
  },
};
