/**
 * emoji skill — pick a random emoji or a few
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random emoji", "give me an emoji", "three random emojis".
 */
const EMOJIS = ['😀','😂','😍','🤔','😎','🚀','🌈','🎉','🔥','💡','🐱','🐶','🍕','☕','⚽','🎵','🌟','❤️','👍','🙌','🦄','🌸','🍀','🍎','🎈'];

export function isEmoji(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+)?(?:a\s+|an\s+|another\s+|some\s+|a\s+few\s+)?(?:random\s+)?emoji(?:s)?|(?:random|another)\s+emoji(?:s)?|emoji(?:s)?(?:\s+please)?|\d+\s+(?:random\s+)?emoji(?:s)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(\d+)/.exec(String(text || ''));
  const n = m ? Math.min(10, Math.max(1, +m[1])) : 1;
  const picks = Array.from({ length: n }, () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  showPage((p) => {
    p.innerHTML = '<h2>Random emoji</h2><p style="font-size:48px;text-align:center;letter-spacing:8px">' + esc(picks.join(' ')) + '</p><div class="sub">say “another emoji” or “3 emojis” for more</div>';
  });
  return 'emoji';
}

export default {
  name: 'emoji',
  examples: ['random emoji', 'give me an emoji', 'another emoji', '3 emojis'],
  nearMisses: ['what is an emoji', 'emoji keyboard', 'send emoji'],
  match(lower, text) { return isEmoji(text); },
  run,
  suite() {
    const ok = isEmoji('random emoji') && isEmoji('3 emojis') && !isEmoji('what is an emoji');
    return { ok, got: 'match works' };
  }
};
