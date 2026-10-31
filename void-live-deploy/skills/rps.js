/**
 * rps skill — play a quick game of rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "play rock paper scissors".
 */
export function isRPS(text) {
  return /^(?:please\s+)?(?:play\s+)?(?:rock\s+paper\s+scissors|rps|rock\s+paper\s+scissor)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['rock', 'paper', 'scissors'];

function beats(a, b) {
  return (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock');
}

function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p>Choose:</p><div style="display:flex;gap:12px;justify-content:center;margin:16px 0">'
      + CHOICES.map(c => `<button data-choice="${c}" style="font-size:18px;padding:8px 16px">${esc(c)}</button>`).join('')
      + '</div><div id="result" class="sub"></div><div class="sub">say “rock paper scissors” to play again</div>';
    p.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const you = btn.dataset.choice;
        const me = CHOICES[Math.floor(Math.random() * 3)];
        let msg = `You: ${you} · Me: ${me} · `;
        if (you === me) msg += 'Tie!';
        else if (beats(you, me)) msg += 'You win!';
        else msg += 'I win!';
        p.querySelector('#result').textContent = msg;
      });
    });
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'play rock paper scissors'],
  nearMisses: ['what is rock paper scissors', 'rock music', 'paper airplane'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rock paper scissors') && isRPS('play rps') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
