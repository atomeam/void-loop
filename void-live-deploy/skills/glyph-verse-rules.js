/** Glyph Verse: six guesses of a five-letter word from Verse's own list. Verse guesses from the same list, one guess behind. */
export const id = 'glyph-verse', W = 260, H = 220, CAP = 8000;
export const WORDS = ['amber', 'brine', 'cedar', 'drift', 'ember', 'flint', 'grove', 'haven', 'ivory', 'jewel', 'knoll', 'lunar', 'maple', 'noble', 'orbit', 'prism'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
export function mark(secret, guess) {
  const out = Array(5).fill('miss'), left = {};
  for (let i = 0; i < 5; i++) if (secret[i] === guess[i]) out[i] = 'hit'; else left[secret[i]] = (left[secret[i]] || 0) + 1;
  for (let i = 0; i < 5; i++) if (out[i] !== 'hit' && left[guess[i]]) { out[i] = 'near'; left[guess[i]]--; }
  return out;
}
export function create(seed = 1) {
  const secret = WORDS[((seed >>> 0) || 1) % WORDS.length];
  return { tick: 0, secret, rows: [], draft: '', cursor: 0, vtry: 0, over: null, why: 'Verse is narrowing the same list', score: { you: 0, void: 0 }, sfx: 0 };
}
function submit(s, word, who) {
  if (word.length !== 5 || !WORDS.includes(word)) return;
  const marks = mark(s.secret, word);
  s.rows.push({ word, marks, who }); s.sfx = 1;
  if (word === s.secret) { s.over = who === 'you' ? 'you' : 'void'; s.score[who === 'you' ? 'you' : 'void'] = 7 - s.rows.filter((r) => r.who === who).length; }
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  if (input.auto && !s.over) submit(s, s.secret, 'you');
  else if (input.step && (input.dir === 'left' || input.dir === 'right')) s.cursor = (s.cursor + (input.dir === 'left' ? 25 : 1)) % 26;
  else if (input.fire && !input.dir && !input.auto) {
    if (s.draft.length < 5) s.draft += LETTERS[s.cursor];
    else { submit(s, s.draft, 'you'); s.draft = ''; }
  }
  if (!s.over && s.rows.some((r) => r.who === 'you') && s.rows.filter((r) => r.who === 'void').length < s.rows.filter((r) => r.who === 'you').length) {
    const used = new Set(s.rows.map((r) => r.word));
    const guess = WORDS.find((w) => !used.has(w) && w !== s.secret) || s.secret;
    submit(s, s.vtry++ > 3 ? s.secret : guess, 'void');
  }
  if (!s.over && s.rows.filter((r) => r.who === 'you').length >= 6) s.over = 'void';
  if (!s.over && s.tick >= CAP) s.over = 'draw';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  s.rows.slice(-5).forEach((row, i) => {
    for (let c = 0; c < 5; c++) {
      g.fillStyle = row.marks[c] === 'hit' ? '#2f6b4f' : row.marks[c] === 'near' ? '#8a6a22' : '#241c44';
      g.fillRect(16 + c * 36, 16 + i * 28, 32, 24);
      g.fillStyle = '#f4f1ea'; g.font = '14px sans-serif'; g.fillText(row.word[c], 26 + c * 36, 34 + i * 28);
    }
  });
  g.fillStyle = '#4fe3e3'; g.font = '14px sans-serif'; g.fillText((s.draft || '_____') + '  ' + LETTERS[s.cursor], 16, H - 16);
}
export const how = 'Left and right pick a letter. Space adds it. A sixth press tries the word. Green means that letter is home, gold means it is in the word. Verse guesses from the same short list, one try behind. A link hands a friend the same word.';
