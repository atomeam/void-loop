/**
 * haiku skill — a random haiku (local, no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "haiku", "random haiku", "give me a haiku".
 */
const HAIKU = [
  ['An old silent pond', 'A frog jumps into the pond—', 'Splash! Silence again.'],
  ['Autumn moonlight—', 'a worm digs silently', 'into the chestnut.'],
  ['In the twilight rain', 'these brilliant-hued hibiscus—', 'A lovely sunset.'],
  ['The light of a candle', 'is transferred to another candle—', 'spring twilight.'],
  ['I write, erase, rewrite', 'Erase again, and then', 'A poppy blooms.']
];

export function isHaiku(text) {
  return /^(?:please\s+)?(?:(?:give|tell|show)\s+(?:me\s+)?(?:a\s+|another\s+|random\s+)?haiku|haiku(?:\s+please)?|random\s+haiku)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const [a, b, c] = HAIKU[Math.floor(Math.random() * HAIKU.length)];
  showPage((p) => {
    p.innerHTML = '<h2>A haiku</h2><p style="font-size:20px;line-height:1.6;font-weight:300;font-style:italic">' + esc(a) + '<br>' + esc(b) + '<br>' + esc(c) + '</p><div class="sub">say “another haiku” for one more</div>';
  });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['haiku', 'random haiku', 'give me a haiku', 'another haiku'],
  nearMisses: ['what is a haiku', 'write a poem', 'japanese poetry'],
  match(lower, text) { return isHaiku(text); },
  run,
  suite() {
    const ok = isHaiku('haiku') && isHaiku('random haiku') && !isHaiku('what is a haiku');
    return { ok, got: 'match works' };
  }
};
