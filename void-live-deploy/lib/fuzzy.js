// The fuzzy layer for skill activation (asked by Verse three times, domains/void.voice.md, 2026-10-14: "Implement the
// fuzzy-matching layer for all skill triggers to replace my current dependency on specific typo patterns."). The page's
// typo map (TYPO_WORDS in void.html) knows a few dozen slips by hand; this layer knows every word the skills answer to.
//
// Given the typed ask and the skills' trigger vocabulary (each skill's name and the words of its examples), a word is
// corrected only when all of these hold:
//   - it is letters only, 5 letters or longer (one edit allowed; a transposition counts as one), 8 or longer for two edits;
//   - it is in no skill's examples or near misses, and not a common English word (COMMON below: "whether" is never "weather");
//   - it is not inside quotes, not a number or a unit (digits and short words are never touched), and not the word after
//     in / at / near / from / about / of / called / named / says / saying (where a name or a place goes);
//   - exactly one vocabulary word is closest, and it starts with the same letter (people seldom slip on the first letter).
// Then the page runs the corrected ask only if the skill that takes it owns the corrected word (confirm below): a slip may
// become a trigger word of the skill it reaches, never a word that steers another skill. The ask is logged as typed; the
// corrected one is routed (void.html loopLog). Pure: no DOM, no fetch; tests in tools/fuzzy.test.mjs.

export const MIN_ONE = 5; // letters for one edit
export const MIN_TWO = 8; // letters for two edits
export const MAX_LEN = 20; // longer words are never a slip of a trigger word (a pasted key, a URL part)
export const PROTECT_AFTER = new Set(['in', 'at', 'near', 'from', 'about', 'of', 'called', 'named', 'says', 'saying']);
// real words a slip could be mistaken for: a typed common word is left alone even when no skill example holds it
export const COMMON = new Set(('whether where there their these those which while think thing things water waiter father mother other others pairs pair '
  + 'rather later latest letter little light night right write wrote would could should world words about above after again against '
  + 'among around because before being below between bring build built change close comes dance early earth every first found front '
  + 'given going great group heard house large learn least leave level lives local might money month movie music never north often '
  + 'order paper parts party peace phone place plane plant point power price quick quiet quite reach ready really since small smile '
  + 'sound south space speak spend stand start state still story study table taken teach thank thanks third three times today total '
  + 'touch trade train tried truth under until upper usual value visit voice wheel white whole whose woman women works worth wrong '
  + 'years young better bought brought caught center centre colour color course cover create decide degree detail direct double during '
  + 'effect either enough entire family finish follow former friend future happen health inside itself length listen living manner '
  + 'matter member middle minute moment myself nature nearly nobody normal notice number object office option parent people person '
  + 'please policy public reason recent record remain report result return school season second sector series simple single social '
  + 'source spring square strong summer supply system theory though toward travel trying unless useful wanted winter within wonder '
  + 'worker writer winner dinner tender wander wonder render sender finder border harder header leader reader loader wider tower '
  + 'timber tinder timers tamer tumor temper tempo tempt clock block flock stock shock knock clack click clerk click court count '
  + 'country county counter mounter weight height eight fight sight tight might light brightest weigh neigh sleigh'
).split(/\s+/));

const LETTERS = /^[a-z]+$/;
// an inflection of a trigger word ("rains", "timers", "converted") is that word, never a slip of it
const SUFFIXES = new Set(['s', 'es', 'd', 'ed', 'r', 'er', 'ing']);
export function sameStem(a, b) {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (/y$/.test(s) && (l === s.slice(0, -1) + 'ies' || l === s.slice(0, -1) + 'ied')) return true;
  if (!l.startsWith(s)) return false;
  const tail = l.slice(s.length);
  return SUFFIXES.has(tail) || (s.endsWith('e') && SUFFIXES.has('e' + tail));
}

/** optimal string alignment distance (Levenshtein plus adjacent transposition as one edit), stopping at max + 1 */
export function distance(a, b, max = Infinity) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur[j] = d; if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[lb];
}

/** the lowercase letter-only words of a line (numbers, units with digits and punctuation drop out) */
export const words = (s) => String(s || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** how many edits a typed word of this length may be from a trigger word */
export const allowed = (len) => (len >= MIN_TWO ? 2 : len >= MIN_ONE ? 1 : 0);

/** the skills' trigger vocabulary: own = word -> the skills whose name or examples hold it (correction targets);
 *  known = own plus every word of every near miss (a typed word in here is never corrected) */
export function vocabulary(skills) {
  const own = new Map(), known = new Set();
  for (const sk of skills || []) {
    if (!sk || !sk.name) continue;
    const add = (w) => { if (!own.has(w)) own.set(w, new Set()); own.get(w).add(sk.name); known.add(w); };
    for (const w of words(sk.name)) add(w);
    for (const ex of sk.examples || []) for (const w of words(ex)) add(w);
    for (const nm of sk.nearMisses || []) for (const w of words(nm)) known.add(w);
  }
  // the first-letter index makes a lookup scan only the words that can be a candidate
  const byFirst = new Map();
  for (const w of own.keys()) { const k = w[0]; if (!byFirst.has(k)) byFirst.set(k, []); byFirst.get(k).push(w); }
  return { own, known, byFirst };
}

/** the same letters in another order. Pure. */
export const sameLetters = (a, b) => a.length === b.length && [...a].sort().join('') === [...b].sort().join('');

/** the one trigger word a typed word is a slip of, { to, d }, or null (ties, far words and known words give null) */
export function nearest(word, vocab) {
  const max = allowed(word.length);
  if (!max || word.length > MAX_LEN || !LETTERS.test(word) || vocab.known.has(word) || COMMON.has(word)) return null;
  let best = null, bestD = max + 1, ties = 0, swaps = [];
  for (const w of vocab.byFirst.get(word[0]) || []) {
    if (Math.abs(w.length - word.length) > max) continue;
    const d = distance(word, w, max);
    if (d <= max && sameStem(word, w)) return null; // "rains" is the word "rain", not a slip of it
    if (d < bestD) { bestD = d; best = w; ties = 0; swaps = []; } else if (d === bestD) ties++;
    if (d === bestD && d <= max && sameLetters(word, w)) swaps.push(w);
  }
  // a tie is settled by the one candidate with exactly the typed letters: two swapped keys ("moive") are the commonest slip, so
  // "moive" is "movie", not "move" (site-test issue #802). Two such candidates still tie.
  if (best && ties && swaps.length === 1) return { to: swaps[0], d: bestD };
  return best && !ties ? { to: best, d: bestD } : null;
}

// the spans inside straight or curly quotes: a name in quotes is never corrected
const QUOTED = /"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’/g;

/** typed ask + vocabulary -> { text, fixes: [{ from, to, d, at, skills }] } (text is the ask as typed when nothing is fixed) */
export function correct(text, vocab) {
  const src = String(text || '');
  const fixes = [];
  if (!vocab || !src || src.length > 160) return { text: src, fixes };
  const quoted = []; for (const m of src.matchAll(QUOTED)) quoted.push([m.index, m.index + m[0].length]);
  const inQuotes = (i) => quoted.some(([a, b]) => i >= a && i < b);
  let prev = '';
  const out = src.replace(/[A-Za-z]+|\S+/g, (tok, at) => {
    const lw = tok.toLowerCase(), was = prev; prev = lw;
    if (!LETTERS.test(lw) || inQuotes(at) || PROTECT_AFTER.has(was)) return tok;
    const n = nearest(lw, vocab);
    if (!n) return tok;
    fixes.push({ from: tok, to: n.to, d: n.d, at, skills: [...vocab.own.get(n.to)] });
    return n.to;
  });
  return { text: fixes.length ? out : src, fixes };
}

/** the typed words correct() may change with some vocabulary: every word that passes the rules above, whatever the vocabulary. Pure. */
export function openWords(text) {
  const src = String(text || ''), out = [];
  if (!src || src.length > 160) return out;
  const quoted = []; for (const m of src.matchAll(QUOTED)) quoted.push([m.index, m.index + m[0].length]);
  let prev = '';
  for (const m of src.matchAll(/[A-Za-z]+|\S+/g)) {
    const lw = m[0].toLowerCase(), was = prev; prev = lw;
    if (!LETTERS.test(lw) || quoted.some(([a, b]) => m.index >= a && m.index < b) || PROTECT_AFTER.has(was)) continue;
    if (allowed(lw.length) && lw.length <= MAX_LEN && !COMMON.has(lw)) out.push(lw);
  }
  return out;
}

/** true when correct() can change nothing in this ask with this vocabulary or any larger one: the vocabulary already knows every
 *  open word, and a known word is never corrected. The page stops waiting for skills still loading at this point (void.html fuzzyFix). */
export const settled = (text, vocab) => !!vocab && openWords(text).every((w) => vocab.known.has(w));

/** true when the skill that takes the corrected ask owns every corrected word (a slip only ever becomes that skill's own word) */
export const confirm = (result, skillName) => !!(result && result.fixes.length && skillName && result.fixes.every((f) => f.skills.includes(skillName)));
