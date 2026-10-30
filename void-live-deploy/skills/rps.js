/**
 * rps skill — play a quick game of rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rps".
 */
export function isRps(text) {
  return /^(?:please\s+)?(?:(?:play\s+)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)|rock\s+paper\s+scissors(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const choices = ['rock', 'paper', 'scissors'];
  const mine = choices[Math.floor(Math.random() * 3)];
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:28px;text-align:center">I pick <b>' + esc(mine) + '</b></p><div class="sub">say “rock”, “paper” or “scissors” next, or “rock paper scissors” for another round</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rps'],
  nearMisses: ['what is rock paper scissors', 'rock music', 'paper airplane'],
  match(lower, text) { return isRps(text); },
  run,
  suite() {
    const ok = isRps('rock paper scissors') && isRps('play rps') && !isRps('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
