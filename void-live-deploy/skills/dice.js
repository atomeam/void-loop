/**
 * dice skill — roll one or more dice (NdS notation or plain words)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "roll three six-sided dice", "1d20"
 * Empty stage stays empty: only a matching ask shows a card.
 */
function parseDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  let m = t.match(/^(?:please\s+)?(?:roll|throw)\s+(?:a\s+|an\s+|the\s+)?(?:(\d+)\s+)?(?:d|die|dice)(?:\s+(\d+))?$/);
  if (m) return { n: +(m[1] || 1), s: +(m[2] || 6) };
  m = t.match(/^(\d+)d(\d+)$/);
  if (m) return { n: +m[1], s: +m[2] };
  m = t.match(/^(?:please\s+)?roll\s+(\d+)\s+(?:six|6)[- ]?sided\s+dice$/);
  if (m) return { n: +m[1], s: 6 };
  m = t.match(/^(?:please\s+)?roll\s+(?:a\s+)?(?:d(\d+)|(\d+)\s+sided\s+die)$/);
  if (m) return { n: 1, s: +(m[1] || m[2]) };
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)|throw\s+(?:a\s+)?die)$/.test(t)) return { n: 1, s: 6 };
  return null;
}
export function diceOf(text) { return parseDice(text); }
function run(text, api) {
  const { showPage, esc } = api;
  const q = parseDice(text);
  if (!q || q.n < 1 || q.n > 20 || q.s < 2 || q.s > 100) return 'none';
  const rolls = Array.from({ length: q.n }, () => 1 + Math.floor(Math.random() * q.s));
  const sum = rolls.reduce((a, b) => a + b, 0);
  const face = rolls.join(', ');
  showPage((el) => {
    el.innerHTML = '<h2>Dice</h2><div class="sub">' + esc(q.n + 'd' + q.s) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.1;margin:8px 0">' + esc(String(sum)) + '</div>'
      + '<p>' + esc(face) + '</p><div class="src">Rolled in your browser · ask again for another</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'roll three six-sided dice', '1d20'],
  nearMisses: ['what is a die', 'dice game rules', 'how to play monopoly'],
  match(lower, text) { return !!parseDice(text || lower); },
  run
};
