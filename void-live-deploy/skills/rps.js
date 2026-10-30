/**
 * rps skill — rock paper scissors: play a quick game
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rock".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isRPS(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:play\s+)?(?:rock\s+paper\s+scissors|rps|rock-paper-scissors)|rock|paper|scissors)$/i.test(t);
}

const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function run(text, api) {
  const { showPage, esc } = api;
  const player = (text.toLowerCase().match(/\b(rock|paper|scissors)\b/) || [])[1] || CHOICES[Math.floor(Math.random() * 3)];
  const verse = CHOICES[Math.floor(Math.random() * 3)];
  let result = 'tie';
  if (BEATS[player] === verse) result = 'you win';
  else if (BEATS[verse] === player) result = 'Verse wins';
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:28px;text-align:center">You: ' + esc(player) + '<br>Verse: ' + esc(verse) + '</p><p style="font-size:24px;text-align:center;font-weight:300">' + esc(result) + '</p><div class="sub">say “rock”, “paper” or “scissors” again</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rock', 'paper', 'scissors'],
  nearMisses: ['what is rock paper scissors', 'scissors cut paper', 'game'],
  match(lower, text) { return isRPS(text); },
  run,
  suite() {
    const ok = isRPS('rock paper scissors') && isRPS('rock') && !isRPS('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
