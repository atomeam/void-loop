/**
 * fact skill — a random interesting fact
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a fact", "random fact", "interesting fact".
 */
const FACTS = [
  "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.",
  "A group of flamingos is called a flamboyance.",
  "Octopuses have three hearts.",
  "Bananas are berries, but strawberries aren't.",
  "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
  "A day on Venus is longer than a year on Venus.",
  "There are more possible iterations of a game of chess than there are atoms in the observable universe.",
  "The inventor of the frisbee was turned into a frisbee after he died.",
  "Scotland has 421 words for snow.",
  "The unicorn is the national animal of Scotland.",
  "A jiffy is an actual unit of time: 1/100th of a second.",
  "The Eiffel Tower can be 15 cm taller during the summer.",
  "Cleopatra lived closer in time to the moon landing than to the construction of the Great Pyramid of Giza.",
  "A cloud can weigh more than a million pounds.",
  "The human brain can store about 2.5 petabytes of information."
];

export function isFact(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:interesting\s+)?fact|(?:another|a|random|interesting)\s+fact|fact(?:\s+please)?|give\s+me\s+a\s+fact|random\s+fact)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const f = FACTS[Math.floor(Math.random() * FACTS.length)];
  showPage((el) => {
    el.innerHTML = '<h2>A fact</h2><p style="font-size:20px;line-height:1.45">' + esc(f) + '</p><div class="sub">say “another fact” for one more</div>';
  });
  return 'fact';
}

export default {
  name: 'fact',
  examples: ['tell me a fact', 'random fact', 'interesting fact', 'another fact'],
  nearMisses: ['what is a fact', 'fun facts about cats', 'stock facts'],
  match(lower, text) { return isFact(text); },
  run,
  suite() {
    const ok = isFact('tell me a fact') && isFact('random fact') && !isFact('stock quotes');
    return { ok, got: 'match works' };
  }
};
