/**
 * magic8 skill — ask the magic 8-ball
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "ask the magic 8 ball", "magic 8 ball", "should I go out tonight", "yes or no".
 * Empty surface stays empty. Answers are classic 8-ball replies, pure.
 */
const ANSWERS = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes — definitely.',
  'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
  'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
  'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  'Don\'t count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
];

export function isMagic8(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  return /^(?:please\s+)?(?:ask\s+the\s+)?(?:magic\s+)?8[\s-]*ball(?:\s+(?:question|please))?$|^(?:should\s+i\s+).{3,80}$|^(?:yes\s+or\s+no)(?:\s+please)?$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const ans = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Magic 8-ball</h2><p style="font-size:28px;line-height:1.4;font-weight:300;margin:12px 0">' + esc(ans) + '</p><div class="sub">shake again with “ask the magic 8 ball”</div>';
  });
  return 'magic8';
}

export default {
  name: 'magic8',
  examples: ['ask the magic 8 ball', 'magic 8 ball', 'should I order pizza', 'yes or no'],
  nearMisses: ['what is a magic 8 ball', '8 ball', 'pool', 'should I be worried about the weather'],
  match(lower, text) { return isMagic8(text); },
  run,
  suite() { return { ok: isMagic8('ask the magic 8 ball') && isMagic8('should I go') && !isMagic8('hello world') }; }
};
