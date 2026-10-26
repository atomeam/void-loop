/**
 * rps skill — Rock Paper Scissors against Verse (local, fair)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "scissors".
 */
const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export function isRps(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:play\s+)?(?:rock\s*paper\s*scissors|rps|rock\s*paper\s*scissors?)$/.test(t) ||
    /^(?:i\s+)?(?:choose|pick|throw)\s+(?:rock|paper|scissors)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const youMatch = /(?:choose|pick|throw)\s+(rock|paper|scissors)/i.exec(text);
  const you = youMatch ? youMatch[1].toLowerCase() : CHOICES[Math.floor(Math.random() * 3)];
  const verse = CHOICES[Math.floor(Math.random() * 3)];
  let result = 'Tie!';
  if (BEATS[you] === verse) result = 'You win!';
  else if (BEATS[verse] === you) result = 'Verse wins!';
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:22px;text-align:center">You: ' + esc(you) + '<br>Verse: ' + esc(verse) + '</p><p style="font-size:26px;font-weight:600;text-align:center;margin:16px 0">' + esc(result) + '</p><div class="sub">say “rock paper scissors” or pick one to play again</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'I choose rock', 'scissors'],
  nearMisses: ['what is rock paper scissors', 'rules of rps'],
  match(lower, text) { return isRps(text); },
  run,
  suite() {
    const ok = isRps('rock paper scissors') && isRps('play rps') && !isRps('what is rps');
    return { ok, got: 'match works' };
  }
};
