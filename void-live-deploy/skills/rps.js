/**
 * rps skill — play rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rock".
 */
export function isRPS(text) {
  return /^(?:please\s+)?(?:play\s+)?(?:rock\s+paper\s+scissors|rps|rock|paper|scissors)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['rock', 'paper', 'scissors'];
function beats(a, b) {
  return (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
}

function run(text, api) {
  const { showPage, esc } = api;
  const player = (text || '').toLowerCase().match(/rock|paper|scissors/)?.[0] || CHOICES[Math.floor(Math.random() * 3)];
  const verse = CHOICES[Math.floor(Math.random() * 3)];
  const result = player === verse ? 'Tie!' : beats(player, verse) ? 'You win!' : 'Verse wins!';
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:28px;text-align:center">You: ' + esc(player) + '<br>Verse: ' + esc(verse) + '</p><p style="font-size:32px;text-align:center;font-weight:300">' + esc(result) + '</p><div class="sub">say “rock” or “play rps”</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rock', 'paper', 'scissors'],
  nearMisses: ['what is rock paper scissors', 'rps game rules', 'scissors for paper'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rock paper scissors') && isRPS('rock') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
