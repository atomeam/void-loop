/**
 * rps skill — play rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "rps", "play rock paper scissors".
 * Empty surface stays empty; the game is an outcome page.
 */
export function isRPS(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:play\s+)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)(?:\s+please)?)$/i.test(t);
}

const CHOICES = ['rock', 'paper', 'scissors'];
function beats(a, b) {
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
}

function run(text, api) {
  const { showPage, esc } = api;
  const me = CHOICES[Math.floor(Math.random() * 3)];
  const you = CHOICES[Math.floor(Math.random() * 3)]; // demo; real would ask
  let result = 'Tie';
  if (beats(me, you)) result = 'I win';
  else if (beats(you, me)) result = 'You win';
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:24px;text-align:center">You: ' + esc(you) + '<br>Me: ' + esc(me) + '<br><strong>' + esc(result) + '</strong></p><div class="sub">say “rps” for another round</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'rps', 'play rock paper scissors'],
  nearMisses: ['what is rock paper scissors', 'rock music'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rps') && isRPS('rock paper scissors') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
