/**
 * haiku skill — a random haiku
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "write a haiku", "haiku", "random haiku".
 */
export function isHaiku(text) {
  return /^(?:please\s+)?(?:(?:write|make|give\s+me|generate)\s+(?:a\s+)?)?(?:random\s+)?haiku(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const HAIKUS = [
  'An old silent pond...\nA frog jumps into the pond,\nsplash! Silence again.',
  'Autumn moonlight\u2014\na worm digs silently\ninto the chestnut.',
  'In the cicada's cry\nNo sign can foretell\nHow soon it must die.',
  'A world of dew,\nAnd within every dewdrop\nA world of struggle.',
  'The light of a candle\nIs transferred to another candle\u2014\nspring twilight.'
];

function run(text, api) {
  const { showPage, esc } = api;
  const h = HAIKUS[Math.floor(Math.random() * HAIKUS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Haiku</h2><p style="font-size:22px;line-height:1.6;font-style:italic;text-align:center;white-space:pre-line">' + esc(h) + '</p><div class="sub">say “haiku” for another</div><div class="src">Classic haiku, chosen here.</div>';
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['write a haiku', 'haiku', 'random haiku', 'make a haiku'],
  nearMisses: ['what is a haiku', 'haiku rules', 'write a poem'],
  match(lower, text) { return isHaiku(text); },
  run,
  suite() {
    const ok = isHaiku('write a haiku') && isHaiku('haiku') && !isHaiku('what is a haiku');
    return { ok, got: 'match works' };
  }
};
