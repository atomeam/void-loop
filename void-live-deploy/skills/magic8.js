/**
 * magic8 skill — classic Magic 8-Ball answers for a yes/no style ask (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 * "ask the magic 8 ball", "magic 8-ball", "what does the 8 ball say".
 * Empty stage stays empty: only shows a page on a matching ask.
 */
const ANSWERS = [
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes — definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.'
];

export function isMagic8(text) {
  return /^(?:(?:ask|consult|shake)\s+(?:the\s+)?(?:magic\s+)?(?:8|eight)[\s-]*balls?|(?:magic\s+)?(?:8|eight)[\s-]*ball(?:\s+(?:says|answer|please))?|what\s+does\s+the\s+(?:magic\s+)?(?:8|eight)[\s-]*ball\s+say)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  if (!isMagic8(text)) return 'none';
  const { showPage, esc } = api;
  const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Magic 8-Ball</h2>'
      + '<div style="font-size:28px;line-height:1.4;font-weight:300;margin:12px 0;text-align:center">' + esc(answer) + '</div>'
      + '<div class="sub">shake again for another answer</div>';
  });
  return 'magic8';
}

export default {
  name: 'magic8',
  examples: ['ask the magic 8 ball', 'magic 8-ball', 'what does the 8 ball say'],
  nearMisses: ['what is a magic 8 ball', 'history of the magic 8 ball', 'eight ball pool'],
  match(lower, text) { return isMagic8(text); },
  run,
  suite() {
    // one suite check: the matcher accepts a canonical ask and rejects a near miss
    const ok = isMagic8('ask the magic 8 ball') && !isMagic8('what is a magic 8 ball');
    return { ok, got: ok ? undefined : 'matcher failed' };
  }
};
