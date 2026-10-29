/**
 * rps skill — play a quick game of rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rps".
 */
const CHOICES = ['rock', 'paper', 'scissors'];

export function isRPS(text) {
  return /^(?:please\s+)?(?:(?:play|start|open)\s+(?:a\s+)?)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const update = (p, user, ai, result) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2>' +
      (result ? '<p style="font-size:24px;text-align:center">You: ' + esc(user) + ' — Verse: ' + esc(ai) + '</p><p style="font-size:28px;text-align:center;color:#4ef0a0">' + esc(result) + '</p>' : '') +
      '<div style="text-align:center"><button class="g-btn rps" data-c="rock">Rock</button> <button class="g-btn rps" data-c="paper">Paper</button> <button class="g-btn rps" data-c="scissors">Scissors</button></div><div class="sub">say “rps” for a new game</div>';
    p.querySelectorAll('.rps').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = btn.dataset.c;
        const a = CHOICES[Math.floor(Math.random() * 3)];
        let res = u === a ? 'Tie!' : (u === 'rock' && a === 'scissors') || (u === 'paper' && a === 'rock') || (u === 'scissors' && a === 'paper') ? 'You win!' : 'Verse wins!';
        update(p, u, a, res);
      });
    });
  };
  showPage((p) => update(p));
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rps', 'start rock paper scissors'],
  nearMisses: ['what is rock paper scissors', 'scissors paper rock rules'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rps') && isRPS('rock paper scissors') && !isRPS('what is rps');
    return { ok, got: 'match works' };
  }
};
