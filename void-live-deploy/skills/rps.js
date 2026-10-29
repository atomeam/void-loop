/**
 * rps skill — play rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rock paper scissors please".
 */
const CHOICES = ['rock', 'paper', 'scissors'];
const EMO = { rock: '✊', paper: '✋', scissors: '✌️' };

export function isRPS(text) {
  return /^(?:please\s+)?(?:(?:play\s+)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)|rock\s+paper\s+scissors(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const mine = CHOICES[Math.floor(Math.random() * 3)];
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2>'
      + '<p style="font-size:24px;text-align:center">I chose ' + EMO[mine] + ' ' + esc(mine) + '</p>'
      + '<div class="sub">say “rock paper scissors” to play again</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rock-paper-scissors'],
  nearMisses: ['what is rock paper scissors', 'paper scissors rock'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rock paper scissors') && isRPS('play rps') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
