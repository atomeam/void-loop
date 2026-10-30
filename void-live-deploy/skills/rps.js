/**
 * rps skill — play rock paper scissors against the page
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "play rock paper scissors", "rock paper scissors", "rps".
 */
export function isRps(text) {
  return /^(?:please\s+)?(?:(?:play|start)\s+)?(?:rock\s+paper\s+scissors|rps)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function run(text, api) {
  const { showPage, esc } = api;
  const update = (p, userChoice) => {
    const ai = CHOICES[Math.floor(Math.random() * 3)];
    let result = 'Tie!';
    if (userChoice) {
      if (BEATS[userChoice] === ai) result = 'You win!';
      else if (BEATS[ai] === userChoice) result = 'You lose!';
    }
    p.innerHTML = '<h2>Rock Paper Scissors</h2>'
      + (userChoice ? '<p style="font-size:24px;text-align:center">You: ' + esc(userChoice) + ' &nbsp; Page: ' + esc(ai) + '</p><p style="font-size:28px;text-align:center;color:#4ef0a0">' + result + '</p>' : '<p style="text-align:center">Pick one</p>')
      + '<div style="text-align:center;margin-top:12px">' + CHOICES.map(c => '<button class="g-btn rps-btn" data-choice="' + c + '" style="margin:4px;font-size:18px">' + c + '</button>').join('') + '</div>'
      + '<div class="sub">say “rock paper scissors” for a new game</div>';
    p.querySelectorAll('.rps-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); update(p, btn.dataset.choice); });
    });
  };
  showPage((p) => update(p));
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['play rock paper scissors', 'rock paper scissors', 'rps'],
  nearMisses: ['what is rock paper scissors', 'rock paper scissors rules', 'play a game'],
  match(lower, text) { return isRps(text); },
  run,
  suite() {
    const ok = isRps('play rock paper scissors') && isRps('rps') && !isRps('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
