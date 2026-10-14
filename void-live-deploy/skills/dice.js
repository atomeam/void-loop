/**
 * dice skill — roll dice from the ask: "roll a die", "roll a d20", "roll 2d6", "d6".
 * Shows the rolls and total. Empty stage stays empty (card only).
 */
function parseDice(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  if (!/\b(?:roll|d\d)\b/.test(t) && !/\b\d+d\d+\b/.test(t)) return null;
  let count = 1, sides = 6;
  const m = t.match(/(\d+)\s*d\s*(\d+)/) || t.match(/d(\d+)/) || t.match(/(\d+)\s*(?:sided|die|dice)/);
  if (m) {
    if (m[2]) { count = Math.min(20, Math.max(1, parseInt(m[1], 10) || 1)); sides = parseInt(m[2], 10); }
    else if (/d\d/.test(m[0])) sides = parseInt(m[1], 10);
    else sides = parseInt(m[1], 10);
  }
  if (!Number.isFinite(sides) || sides < 2 || sides > 100) sides = 6;
  return { count, sides };
}

function roll(sides) { return 1 + Math.floor(Math.random() * sides); }

function run(text, api) {
  const { showPage, esc } = api;
  const parsed = parseDice(text);
  if (!parsed) {
    showPage((el) => {
      el.innerHTML = '<h2>Dice</h2><p>Say “roll a die”, “roll a d20” or “roll 2d6”.</p><div class="src">Source: fair random · as of 2026-10</div>';
    });
    return 'dice';
  }
  const rolls = Array.from({ length: parsed.count }, () => roll(parsed.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const rollsStr = rolls.join(', ');
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(parsed.count + 'd' + parsed.sides) + '</h2><p style="font-size:28px">' + esc(rollsStr) + '</p>' + (parsed.count > 1 ? '<p>total ' + esc(String(total)) + '</p>' : '') + '<div class="src">Source: Math.random · as of 2026-10</div>';
  });
  return 'dice';
}

function suite() {
  const p = parseDice('roll 2d6');
  const ok = p && p.count === 2 && p.sides === 6 && parseDice('roll a d20').sides === 20 && !parseDice('what is a die');
  return { ok, got: ok ? 'pass' : JSON.stringify(p) };
}

export default {
  name: 'dice',
  examples: [
    "roll a die",
    "roll a d20",
    "roll 2d6"
  ],
  nearMisses: [
    "what is a die"
  ],
  match(lower) { return /\b(?:roll|d\d|dice|die)\b/.test(lower) && !/\bwhat\b/.test(lower); },
  run,
  suite
};
