/**
 * hangman skill — a simple word-guessing game on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "play hangman", "hangman", "start hangman".
 */
const WORDS = ['verse', 'void', 'stage', 'skill', 'timer', 'coin', 'figure', 'summon', 'blank', 'empty', 'roam', 'think', 'source', 'card', 'home'];

export function isHangman(text) {
  return /^(?:please\s+)?(?:(?:play|start|open)\s+(?:a\s+)?)?hangman(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  let guessed = new Set(), wrong = 0, maxWrong = 6;
  const update = (p) => {
    const display = word.split('').map(c => guessed.has(c) ? c : '_').join(' ');
    const won = word.split('').every(c => guessed.has(c));
    const lost = wrong >= maxWrong;
    p.innerHTML = '<h2>Hangman</h2><p style="font-size:32px;letter-spacing:8px;text-align:center;font-family:monospace">' + esc(display) + '</p><p style="text-align:center">Wrong: ' + wrong + '/' + maxWrong + '</p><p style="text-align:center">Guessed: ' + esc([...guessed].join(', ') || 'none') + '</p>' +
      (won ? '<p style="font-size:24px;color:#4ef0a0;text-align:center">You win!</p>' : lost ? '<p style="font-size:24px;color:#f04e4e;text-align:center">You lose. Word was ' + esc(word) + '</p>' : '<div style="text-align:center"><input id="hang-guess" maxlength="1" style="font-size:24px;width:40px;text-align:center"><button id="hang-go" class="g-btn">Guess</button></div>') +
      '<div class="sub">say “hangman” for a new game</div>';
    if (!won && !lost) {
      const inp = p.querySelector('#hang-guess'), btn = p.querySelector('#hang-go');
      const go = () => {
        const g = (inp.value || '').toLowerCase();
        if (g && g.length === 1 && /[a-z]/.test(g) && !guessed.has(g)) {
          guessed.add(g);
          if (!word.includes(g)) wrong++;
          update(p);
        }
        inp.value = '';
      };
      btn.addEventListener('click', (e) => { e.stopPropagation(); go(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); go(); } });
    }
  };
  showPage((p) => update(p));
  return 'hangman';
}

export default {
  name: 'hangman',
  examples: ['hangman', 'play hangman', 'start hangman'],
  nearMisses: ['what is hangman', 'hangman rules', 'draw hangman'],
  match(lower, text) { return isHangman(text); },
  run,
  suite() {
    const ok = isHangman('hangman') && isHangman('play hangman') && !isHangman('what is hangman');
    return { ok, got: 'match works' };
  }
};
