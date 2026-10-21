/**
 * haiku skill — a short 5-7-5 poem on the stage. Pure, no network, empty surface stays empty.
 * "write a haiku", "haiku about the moon", "make a haiku", "another haiku".
 */
const HAIKUS = [
  ['old pond', 'a frog jumps in', 'sound of water'],
  ['autumn moonlight', 'a worm digs silently', 'into the chestnut'],
  ['first snow', 'the leaves of the last year', 'still on the branch'],
  ['summer grass', 'all that remains', 'of warriors dreams'],
  ['the light of a candle', 'is transferred to another candle', 'spring twilight'],
  ['in the cicada\'s cry', 'no sign can foretell', 'how soon it must die'],
  ['lightning flash', 'what I thought were faces', 'are plumes of pampas grass'],
  ['the old pond', 'a frog jumps in', 'the sound of water'],
];

export function isHaiku(text) {
  return /^(?:please\s+)?(?:write|make|compose|give\s+me|tell\s+me)\s+(?:a|an|another|one\s+more)\s+haiku(?:\s+about\s+.+)?$|^haiku(?:\s+about\s+.+)?$|^another\s+haiku$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const topic = (String(text || '').match(/about\s+(.+)$/i) || [])[1] || '';
  const [a, b, c] = HAIKUS[Math.floor(Math.random() * HAIKUS.length)];
  const el = showPage((p) => {
    p.innerHTML = '<h2>A haiku</h2><p style="font-size:22px;line-height:1.6;font-weight:300;text-align:center">' +
      esc(a) + '<br>' + esc(b) + '<br>' + esc(c) + '</p>' +
      (topic ? '<div class="sub">about ' + esc(topic) + '</div>' : '') +
      '<div class="sub">say “another haiku” for one more</div>';
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['write a haiku', 'haiku about the moon', 'make a haiku', 'another haiku'],
  nearMisses: ['what is a haiku', 'haiku history', 'explain haiku'],
  match(lower, text) { return isHaiku(text); },
  run
};
