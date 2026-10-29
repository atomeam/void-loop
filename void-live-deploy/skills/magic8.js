/**
 * magic8 skill — a magic 8-ball answer, pure client-side
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "magic 8 ball", "ask the magic 8 ball", "8 ball".
 */
export const ANSWERS = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes — definitely.',
  'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
  'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
  'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  "Don't count on it.", 'My reply is no.', 'My sources say no.', 'Outlook not so good.',
  'Very doubtful.'
];

export function isMagic(text) {
  return /^(?:please\s+)?(?:magic\s+8[\s-]*ball|ask\s+(?:the\s+)?magic\s+8[\s-]*ball|8[\s-]*ball)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const ans = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Magic 8-Ball</h2><p style="font-size:24px;font-style:italic;text-align:center">' + esc(ans) + '</p><div class="sub">say “magic 8 ball” for another</div><div class="src">A classic 20 answers, chosen here on this device.</div>';
  });
  return 'magic8';
}

export default {
  name: 'magic8',
  examples: ['magic 8 ball', 'ask the magic 8 ball', '8 ball'],
  nearMisses: ['what is a magic 8 ball', '8 ball pool', 'magic number'],
  match(lower, text) { return isMagic(text); },
  run,
  suite() {
    const ok = isMagic('magic 8 ball') && isMagic('8 ball') && !isMagic('what is a magic 8 ball');
    return { ok, got: 'match works' };
  }
};
