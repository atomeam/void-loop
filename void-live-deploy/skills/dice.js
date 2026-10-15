/**
 * dice skill: "roll a die", "dice roller", "roll d20".
 * Shows a summoned page with the result. Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:roll|throw|toss)\s+(?:a\s+|the\s+)?(?:die|dice|d6|d20)$/.test(t) ||
      /^(?:dice|die)\s+(?:roller|roll)$/.test(t) ||
      /^roll\s+(?:some\s+)?dice$/.test(t)) return true;
  const m = t.match(/^(?:roll|throw)\s+(?:a\s+)?d(\d+)$/);
  return m ? { sides: Math.min(100, Math.max(2, +m[1])) } : null;
}

function roll(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

function run(text, api) {
  const { showPage } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const sides = (q && q.sides) || 6;
  const result = roll(sides);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><div class="sub">d' + sides + '</div><p style="font-size:72px;text-align:center;margin:20px 0">' + result + '</p><p class="src">Rolled in this browser. Nothing is sent.</p>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'dice roller', 'roll d20', 'roll some dice'],
  nearMisses: ['what is a die', 'dice game', 'play monopoly'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    return { ok: !!diceOf('roll a die') && !!diceOf('roll d20') && diceOf('hello') === null };
  },
};
