/**
 * haiku skill — generate a random haiku
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "write a haiku", "random haiku", "give me a haiku about nature".
 */
const HAIKUS = [
  { lines: ['An old silent pond', 'A frog jumps into the pond', 'Splash! Silence again.'], author: 'Bashō' },
  { lines: ['Over the wintry', 'forest, winds howl in rage', 'with no leaves to blow.'], author: 'Soseki' },
  { lines: ['The light of a candle', 'Is transferred to another candle—', 'spring twilight.'], author: 'Buson' },
  { lines: ['A summer river being crossed', 'how pleasing', 'with sandals in my hands!'], author: 'Buson' },
  { lines: ['In the twilight rain', 'these brilliant-hued hibiscus', 'A lovely sunset.'], author: 'Bashō' },
  { lines: ['The lamp once out', 'Cool stars enter', 'The window frame.'], author: 'Shiki' }
];

export function isHaiku(text) {
  return /^(?:please\\s+)?(?:(?:write|make|give\\s+me|tell\\s+me|random|a|another)\\s+(?:a\\s+)?haiku|(?:haiku)(?:\\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const h = HAIKUS[Math.floor(Math.random() * HAIKUS.length)];
  showPage((p) => { p.innerHTML = '<h2>A haiku</h2><p style="font-size:20px;line-height:1.6;font-style:italic">' + h.lines.map(esc).join('<br>') + '</p><p style="font-size:16px">— ' + esc(h.author) + '</p><div class="sub">say “another haiku” for one more</div>'; });
  return 'haiku';
}

export default {
  name: 'haiku',
  examples: ['write a haiku', 'random haiku', 'give me a haiku', 'another haiku'],
  nearMisses: ['what is a haiku', 'haiku meaning', 'how to write haiku'],
  match(lower, text) { return isHaiku(text); },
  run,
  suite() {
    const ok = isHaiku('write a haiku') && isHaiku('random haiku') && !isHaiku('what is a haiku');
    return { ok, got: 'match works' };
  }
};
