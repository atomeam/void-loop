/**
 * magic8 skill — Magic 8-Ball answers from a classic list (no key, local)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "magic 8 ball", "ask the 8 ball", "will it happen?".
 */
const ANSWERS = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes — definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  'Don\'t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
];

export function isMagic8(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:magic\s+8\s*ball|ask\s+(?:the\s+)?(?:magic\s+)?8\s*ball|8\s*ball|magic\s+eight\s+ball)$/i.test(t) ||
    /^(?:will|is|are|can|should|does|do)\s+.+(?:\?|$)/i.test(t) && /8\s*ball|magic/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const ans = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Magic 8-Ball</h2><p style="font-size:28px;line-height:1.3;font-weight:600;text-align:center;margin:20px 0">' + esc(ans) + '</p><div class="sub">ask again for a new answer</div>';
  });
  return 'magic8';
}

export default {
  name: 'magic8',
  examples: ['magic 8 ball', 'ask the 8 ball', 'magic eight ball', 'will it rain? magic 8 ball'],
  nearMisses: ['what is a magic 8 ball', 'buy a magic 8 ball', '8 ball pool'],
  match(lower, text) { return isMagic8(text); },
  run,
  suite() {
    const ok = isMagic8('magic 8 ball') && isMagic8('ask the 8 ball') && !isMagic8('8 ball pool');
    return { ok, got: 'match works' };
  }
};
