/**
 * rps skill — play a quick game of rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "play rock paper scissors", "rps", "rock paper scissors".
 */
export function isRps(text) {
  return /^(?:please\s+)?(?:(?:play|start|open)\s+(?:a\s+)?)?(?:rock\s+paper\s+scissors|rps)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const choices = ['rock', 'paper', 'scissors'];
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const update = (p, userChoice) => {
    const ai = choices[Math.floor(Math.random() * 3)];
    let result = 'Tie!';
    if (userChoice) {
      if (beats[userChoice] === ai) result = 'You win!';
      else if (beats[ai] === userChoice) result = 'You lose!';
    }
    p.innerHTML = '<h2>Rock Paper Scissors</h2>' +
      (userChoice ? '<p style="font-size:24px;text-align:center">You: ' + esc(userChoice) + ' &nbsp; Me: ' + esc(ai) + '</p><p style="font-size:28px;text-align:center;color:#4ef0a0">' + esc(result) + '</p>' : '<p style="text-align:center">Choose your weapon</p>') +
      '<div style="text-align:center;margin-top:12px">' +
      choices.map(c => '<button class="g-btn rps-btn" data-choice="' + c + '" style="margin:4px;font-size:18px">' + esc(c) + '</button>').join('') +
      '</div><div class="sub">say “rps” for a new game</div>';
    p.querySelectorAll('.rps-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); update(p, btn.dataset.choice); });
    });
  };
  showPage((p) => update(p));
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['play rock paper scissors', 'rps', 'rock paper scissors', 'start rps'],
  nearMisses: ['what is rock paper scissors', 'paper scissors', 'scissors rock'],
  match(lower, text) { return isRps(text); },
  run,
  suite() {
    const ok = isRps('play rock paper scissors') && isRps('rps') && !isRps('what is rps');
    return { ok, got: 'match works' };
  }
};
