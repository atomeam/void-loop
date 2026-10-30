/**
 * rps skill — play rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "play rock paper scissors", "rock paper scissors".
 */
export function isRPS(text) {
  return /^(?:please\\s+)?(?:play\\s+)?(?:rock\\s+paper\\s+scissors|rps|rock-paper-scissors)(?:\\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['rock', 'paper', 'scissors'];
function beats(a, b) {
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
}

function run(text, api) {
  const { showPage, esc } = api;
  const player = CHOICES[Math.floor(Math.random() * 3)];
  const computer = CHOICES[Math.floor(Math.random() * 3)];
  let result = 'tie';
  if (beats(player, computer)) result = 'you win';
  else if (beats(computer, player)) result = 'computer wins';
  showPage((p) => { p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:24px;text-align:center">You: ' + esc(player) + '<br>Computer: ' + esc(computer) + '<br>' + result + '</p><div class="sub">say “play rock paper scissors” again</div>'; });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['play rock paper scissors', 'rock paper scissors', 'rps'],
  nearMisses: ['what is rock paper scissors', 'rock paper', 'scissors'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('play rock paper scissors') && isRPS('rps') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
