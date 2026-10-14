/**
 * dice skill — roll dice from the ask (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a dice", "roll 2d6", "roll d20", "roll three d10".
 * Shows the total and the individual faces. Empty stage stays empty.
 */
function diceOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (!/\b(?:roll|dice|die|d\d+)\b/.test(t)) return null;
  if (/\b(?:what is|history of|how to make)\b/.test(t)) return null;
  let n = 1, sides = 6;
  let m = t.match(/\b(\d+)\s*d\s*(\d+)\b/) || t.match(/\bd\s*(\d+)\b/);
  if (m) {
    if (m[2]) { n = +m[1]; sides = +m[2]; }
    else sides = +m[1];
  } else {
    m = t.match(/\b(?:roll|dice)\s+(?:a\s+)?(?:(\d+)\s+)?(?:d(?:ie|ice)|(\d+)\s*sided)\b/);
    if (m) {
      if (m[1]) n = +m[1];
      if (m[2]) sides = +m[2];
    } else if (!/\b(?:roll|dice|die)\b/.test(t)) return null;
  }
  n = Math.max(1, Math.min(20, n || 1));
  sides = Math.max(2, Math.min(100, sides || 6));
  return { n, sides, raw };
}

function roll(n, sides) {
  const faces = [];
  for (let i = 0; i < n; i++) faces.push(1 + Math.floor(Math.random() * sides));
  return { faces, total: faces.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const r = roll(q.n, q.sides);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2>'
      + '<div class="sub">' + esc(q.n + 'd' + q.sides) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + r.total + '</div>'
      + '<p style="color:#8a8a8a">' + esc(r.faces.join(' + ')) + '</p>'
      + '<div class="sub">say “roll again” or another dice ask</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a dice', 'roll 2d6', 'roll d20', 'roll three d10'],
  nearMisses: ['what is a dice', 'history of dice', 'how to make dice'],
  match(lower, text) { return !!diceOf(text); },
  run
};
