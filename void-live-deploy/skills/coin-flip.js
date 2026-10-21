/**
 * coin-flip skill: "flip a coin", "heads or tails", "coin flip" for a quick decision.
 * Returns heads or tails with a short reason drawn from the ask when one is present.
 * Empty surface stays empty: the answer is the words, no card of its own.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function coinOf(text) {
  const t = CLEAN(text);
  const m = t.match(/^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|heads\s+or\s+tails|coin\s+flip|flip\s+for\s+me)(?:\s+for\s+(.+))?$/);
  return m ? (m[1] || '').trim() : null;
}

export default {
  name: 'coin-flip',
  examples: ['flip a coin', 'heads or tails', 'coin flip for dinner', 'flip a coin for me'],
  nearMisses: ['what is a coin', 'flip the table'],
  match(lower, text) { return coinOf(text) !== null; },
  run(text, api) {
    const reason = coinOf(text);
    const side = Math.random() < 0.5 ? 'heads' : 'tails';
    const line = reason ? `${side} — ${reason}` : side;
    api.say(line);
    return side;
  },
};
