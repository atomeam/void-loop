/**
 * rock paper scissors skill — play a quick game on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rps".
 */
const CHOICES = ['rock', 'paper', 'scissors'];
export function isRPS(text) {
  return /^(?:please\s+)?(?:(?:play|start)\s+)?(?:rock\s+paper\s+scissors|rps)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const update = (p, user, ai, result) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="text-align:center;font-size:24px">' + (user ? esc(user) + ' vs ' + esc(ai) + '<br>' + esc(result) : 'Choose:') + '</p><div style="text-align:center">' +
      CHOICES.map(c => '<button class="g-btn rps" data-c="' + c + '">' + c + '</button> ').join('') + '</div><div class="sub">say “rps” for a new game</div>';
    p.querySelectorAll('.rps').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const u = btn.dataset.c;
      const a = CHOICES[Math.floor(Math.random() * 3)];
      let res = u === a ? 'Tie!' : (u === 'rock' && a === 'scissors') || (u === 'paper' && a === 'rock') || (u === 'scissors' && a === 'paper') ? 'You win!' : 'You lose!';
      update(p, u, a, res);
    }));
  };
  showPage((p) => update(p));
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rps'],
  nearMisses: ['what is rock paper scissors', 'rock music'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rps') && isRPS('play rock paper scissors') && !isRPS('what is rps');
    return { ok, got: 'match works' };
  }
};
