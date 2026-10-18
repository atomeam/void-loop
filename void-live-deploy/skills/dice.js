/**
 * dice skill: roll dice. "roll a die", "roll 2d6", "roll d20", "roll 3d8 + 2".
 * Empty surface stays empty. The result is a card that stays on the stage.
 * Pure browser: Math.random, no network.
 */
const WHEN = /^(?:(?:please\s+)?(?:roll|throw|toss)\s+(?:a\s+|the\s+|some\s+)?(?:dice?|d\d+|\d+d\d+(?:\s*\+\s*\d+)?)(?:\s+(?:dice?|for me))?|(?:roll|throw)\s+\d+d\d+(?:\s*\+\s*\d+)?)$/i;

function parseRoll(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/(?:roll|throw|toss)\s+(?:a\s+|the\s+)?(?:(\d+)\s*)?d(\d+)(?:\s*\+\s*(\d+))?/);
  if (m) return { n: Math.min(20, +(m[1] || 1)), sides: Math.min(100, +m[2]), bonus: +(m[3] || 0) };
  if (/roll a die|roll dice|throw a die/.test(t)) return { n: 1, sides: 6, bonus: 0 };
  return null;
}

function roll({ n, sides, bonus }) {
  const faces = [];
  let sum = bonus;
  for (let i = 0; i < n; i++) {
    const f = 1 + Math.floor(Math.random() * sides);
    faces.push(f);
    sum += f;
  }
  return { faces, sum, bonus };
}

function run(text, api) {
  const q = parseRoll(text);
  if (!q) return null;
  const r = roll(q);
  const label = `${q.n}d${q.sides}${q.bonus ? ' + ' + q.bonus : ''}`;
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = `<h2>${esc(label)}</h2>
      <p style="font-size:2.2em;margin:.2em 0">${esc(String(r.sum))}</p>
      <p>${r.faces.map(f => `<b>${esc(String(f))}</b>`).join(' + ')}${q.bonus ? ' + ' + q.bonus : ''}</p>
      <div class="src">Source: browser Math.random · as of 2026-10</div>`;
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: [
    'roll a die',
    'roll 2d6',
    'roll d20',
    'roll 3d8',
    'throw 4d6',
  ],
  nearMisses: [
    'what is a dice',
    'dice games',
    'how do dice work',
    'buy dice',
  ],
  match(lower, text) { return !!parseRoll(text); },
  run,
};
