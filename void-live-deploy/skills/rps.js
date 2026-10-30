/**
 * rps skill — rock paper scissors game
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rock paper scissors please".
 */
export function isRPS(text) {
  return /^(?:please\s+)?(?:(?:play|start)\s+)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function run(text, api) {
  const { showPage, esc } = api;
  const update = (p, user, ai, result) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2>'
      + (user ? '<p style="font-size:24px;text-align:center">You: ' + esc(user) + ' · Verse: ' + esc(ai) + '</p><p style="font-size:28px;text-align:center;font-weight:300">' + esc(result) + '</p>' : '')
      + '<div style="text-align:center;margin-top:20px">'
      + CHOICES.map(c => '<button class="g-btn rps-btn" data-choice="' + c + '">' + esc(c) + '</button> ').join('')
      + '</div><div class="sub">say “rock paper scissors” for a new game</div>';
    p.querySelectorAll('.rps-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = btn.dataset.choice;
        const a = CHOICES[Math.floor(Math.random() * 3)];
        let res = u === a ? 'Tie!' : BEATS[u] === a ? 'You win!' : 'Verse wins!';
        update(p, u, a, res);
      });
    });
  };
  showPage((p) => update(p));
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rps', 'rock-paper-scissors'],
  nearMisses: ['what is rock paper scissors', 'paper scissors rock rules'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rock paper scissors') && isRPS('play rps') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
