/**
 * rps skill — play a quick game of rock paper scissors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rock paper scissors", "play rps", "rps".
 * Empty surface stays empty.
 */
export function isRps(text) {
  return /^(?:please\s+)?(?:(?:play\s+)?(?:rock\s+paper\s+scissors|rps)|rock\s+paper\s+scissors(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const CHOICES = ['Rock', 'Paper', 'Scissors'];

function run(text, api) {
  const { showPage, esc } = api;
  const choice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Rock Paper Scissors</h2><p style="font-size:36px;font-weight:300;text-align:center">' + esc(choice) + '</p><div class="sub">say “rock paper scissors” for another</div>';
  });
  return 'rps';
}

export default {
  name: 'rps',
  examples: ['rock paper scissors', 'play rps', 'rps'],
  nearMisses: ['what is rock paper scissors', 'paper scissors rock'],
  match(lower, text) { return isRps(text); },
  run,
  suite() {
    const ok = isRps('rock paper scissors') && isRps('play rps') && !isRps('what is rock paper scissors');
    return { ok, got: 'match works' };
  }
};
