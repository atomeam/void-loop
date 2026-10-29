/**
 * rps skill — rock paper scissors on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rps".
 */
export function isRps(text) {
  return /^(?:please\s+)?(?:(?:play|start)\s+)?(?:rock\s+paper\s+scissors|rps)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['rock', 'paper', 'scissors'];
function beats(a, b) { return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper'); }

function run(text, api) {
  const { showPage, esc } = api;
  const update = (p, user, ai, result) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2>' +
      (result ? '<p style="font-size:24px;text-align:center">You: ' + esc(user) + ' · Verse: ' + esc(ai) + '</p><p style="font-size:28px;text-align:center;color:' + (result === 'win' ? '#4ef0a0' : result === 'lose' ? '#f04e4e' : '#f0d44e') + '">' + esc(result === 'win' ? 'You win!' : result === 'lose' ? 'You lose' : 'Tie') + '</p>' : '<p style="text-align:center">Pick one</p>') +
      '<div style="text-align:center;margin-top:12px"><button data-c="rock" class="g-btn">Rock</button> <button data-c="paper" class="g-btn">Paper</button> <button data-c="scissors" class="g-btn">Scissors</button></div>' +
      '<div class="sub">say “rps” for a new game</div>';
    p.querySelectorAll('button[data-c]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = btn.dataset.c;
        const a = CHOICES[Math.floor(Math.random() * 3)];
        const res = u === a ? 'tie' : beats(u, a) ? 'win' : 'lose';
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
  nearMisses: ['what is rock paper scissors', 'rps rules', 'scissors paper rock'],
  match(lower, text) { return isRps(text); },
  run,
  suite() {
    const ok = isRps('rps') && isRps('rock paper scissors') && !isRps('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
