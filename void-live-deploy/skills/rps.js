/**
 * rps skill — play rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "play rock paper scissors", "rps", "rock paper scissors".
 */
export function isRPS(text) {
  return /^(?:please\s+)?(?:(?:play|start|open)\s+(?:a\s+)?)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const choices = ['rock', 'paper', 'scissors'];
  const update = (p, userChoice) => {
    const computer = choices[Math.floor(Math.random() * 3)];
    let result = 'Tie!';
    if (userChoice === 'rock' && computer === 'scissors') result = 'You win!';
    else if (userChoice === 'paper' && computer === 'rock') result = 'You win!';
    else if (userChoice === 'scissors' && computer === 'paper') result = 'You win!';
    else if (userChoice !== computer) result = 'Computer wins!';
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="text-align:center;font-size:24px">You: ' + esc(userChoice) + ' vs Computer: ' + esc(computer) + '</p><p style="text-align:center;font-size:28px">' + result + '</p><div style="text-align:center;margin-top:20px"><button class="g-btn" data-choice="rock">Rock</button> <button class="g-btn" data-choice="paper">Paper</button> <button class="g-btn" data-choice="scissors">Scissors</button></div><div class="sub">say “rock paper scissors” for a new game</div>';
    p.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); update(p, btn.dataset.choice); });
    });
  };
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="text-align:center">Choose:</p><div style="text-align:center;margin-top:20px"><button class="g-btn" data-choice="rock">Rock</button> <button class="g-btn" data-choice="paper">Paper</button> <button class="g-btn" data-choice="scissors">Scissors</button></div><div class="sub">say “rock paper scissors” for a new game</div>';
    p.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); update(p, btn.dataset.choice); });
    });
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rock paper scissors', 'rps', 'play rps'],
  nearMisses: ['what is rock paper scissors', 'rps rules', 'scissors'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rock paper scissors') && isRPS('play rps') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
