/**
 * chance — one skill for coin flip, dice, and random numbers (lap feed: merge overlaps).
 * "flip a coin", "roll a die", "roll 2d6", "random number between 1 and 10", "pick a number 1 to 100".
 * Magic 8 Ball stays on the page + eightball stage kind; this skill does the pure rolls only.
 * Contract: { name, examples, nearMisses, match, run, suite }
 */
export function chanceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const l = t.toLowerCase();
  // coin
  if (/^(?:flip|toss)\s+(?:a\s+)?coin$|^(?:coin\s+flip|heads\s+or\s+tails)$/.test(l)) return { kind: 'coin' };
  // dice: roll a die, roll 2d6, roll 1 to 6, roll 3 dice
  let m = l.match(/^roll\s+(?:a\s+)?(?:die|dice)$/) || l.match(/^roll\s+(\d{1,2})\s*d\s*(\d{1,3})$/) || l.match(/^roll\s+(\d{1,2})\s+dice?$/);
  if (m) {
    if (m[1] && m[2]) return { kind: 'dice', n: Math.min(20, Math.max(1, +m[1])), sides: Math.min(100, Math.max(2, +m[2])) };
    if (m[1] && !m[2]) return { kind: 'dice', n: Math.min(20, Math.max(1, +m[1])), sides: 6 };
    return { kind: 'dice', n: 1, sides: 6 };
  }
  m = l.match(/^(?:roll|pick)\s+(?:a\s+number\s+)?(?:from\s+|between\s+)?(\d{1,6})\s*(?:to|and|-|–)\s*(\d{1,6})$/);
  if (m) { const a = +m[1], b = +m[2]; return { kind: 'range', lo: Math.min(a, b), hi: Math.max(a, b) }; }
  m = l.match(/^(?:random\s+number|pick\s+a\s+number)(?:\s+(?:from\s+|between\s+)?(\d{1,6})\s*(?:to|and|-|–)\s*(\d{1,6}))?$/);
  if (m) {
    if (m[1] && m[2]) { const a = +m[1], b = +m[2]; return { kind: 'range', lo: Math.min(a, b), hi: Math.max(a, b) }; }
    return { kind: 'range', lo: 1, hi: 10 };
  }
  return null;
}

function roll(sides) { return 1 + Math.floor(Math.random() * sides); }

async function run(text, api) {
  const q = chanceOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  let title = 'Chance', big = '', sub = '';
  if (q.kind === 'coin') {
    const face = Math.random() < 0.5 ? 'Heads' : 'Tails';
    title = 'Coin flip'; big = face; sub = 'fair coin · ask again to flip again';
  } else if (q.kind === 'dice') {
    const rolls = Array.from({ length: q.n }, () => roll(q.sides));
    const sum = rolls.reduce((a, b) => a + b, 0);
    title = q.n === 1 ? 'd' + q.sides : q.n + 'd' + q.sides;
    big = q.n === 1 ? String(rolls[0]) : rolls.join(' + ') + ' = ' + sum;
    sub = q.n === 1 ? 'one die, ' + q.sides + ' sides' : q.n + ' dice · sum ' + sum;
  } else {
    const n = q.lo + Math.floor(Math.random() * (q.hi - q.lo + 1));
    title = 'Random number'; big = String(n); sub = 'from ' + q.lo + ' to ' + q.hi + ' inclusive';
  }
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + '<div style="font-size:44px;font-weight:300;margin:10px 0;line-height:1.2">' + esc(big) + '</div>'
      + '<p style="color:#8a8a8a">' + esc(sub) + ' · random in your browser, not a prediction</p>';
  });
  api.say(big);
  return 'chance';
}

export default {
  name: 'chance',
  examples: ['flip a coin', 'roll a die', 'roll 2d6', 'random number between 1 and 10', 'pick a number 1 to 100'],
  nearMisses: ['chance of rain', 'second chance', 'by chance', 'what are the odds'],
  match(lower, text) { return !!chanceOf(text); },
  run,
  suite() {
    const a = chanceOf('flip a coin'), b = chanceOf('roll 2d6'), c = chanceOf('random number between 1 and 10'), d = chanceOf('chance of rain');
    return { ok: !!(a && a.kind === 'coin' && b && b.kind === 'dice' && b.n === 2 && b.sides === 6 && c && c.kind === 'range' && c.lo === 1 && c.hi === 10 && d === null) };
  },
};
