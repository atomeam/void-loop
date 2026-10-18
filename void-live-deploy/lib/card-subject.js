// What a card is ABOUT, taken from its own answer (owner, 2026-10-17: "still needs unique pictures of the card's subject": the card "pick a movie to watch with me"
// answered with a film about an embalmed hand and spirits, and showed a generic door-with-an-eye plate). subjectOf() reads the answer's text, not the ask's words:
// the most-repeated concrete words (hand, spirits, ...) in order, no names. Those words are (1) the paint prompt of the Art Forge (lib/art-rules.js) and (2) what the
// procedural plate draws until a painting exists: motifOf() maps a word to a small ink drawing (a hand, an eye, a ghost, a skull, a moon ...). Pure; no DOM.
const STOP = new Set(('about above after again against also always another around because been before being between both came come could does doing down during each even '
  + 'every first found from gets give goes going good great have having here himself however into just keep know last later like likely made make many more most much must '
  + 'never next only other over really said same several should since some still such take tell than that their them then there these they thing things this those through '
  + 'time today under until upon very want well were what when where which while will with within without would your yours you the and for are was has had not but can '
  + 'movie movies film films watch watching recommend recommended recommendation pick picks choose answer answers question source sources according based people person '
  + 'tonight friends friend together night pretty quite maybe perhaps rated rating review reviews story stories plot something someone anything everyone mostly start '
  + 'started find finds need needs help idea ideas kind list lists top best better worth see seen look looks sure part parts real very right year years released release '
  + 'directed director starring stars plays cast known called named long short high low new old big small little '
  // the words about V01D and the search, not the subject (owner's K-pop card, 2026-10-17: "Closest match I found for void kpop" made it paint "match void")
  + 'void v01d match matches closest search searched').split(' '));
const MOTIFS = {
  hand: 'hand hands fist palm finger fingers glove', eye: 'eye eyes gaze vision watcher', skull: 'skull skulls bone bones dead death corpse skeleton grave tomb embalmed mummy',
  ghost: 'ghost ghosts spirit spirits haunt haunted haunting soul souls phantom specter possession possessed demon demons', moon: 'moon lunar crescent night midnight',
  sun: 'sun solar sunrise sunset dawn day', star: 'star stars space galaxy cosmos planet universe constellation', tree: 'tree trees forest woods jungle garden plant',
  house: 'house home door castle tower mansion building room cabin village', key: 'key keys lock secret mystery', book: 'book books tome library novel magic spell spells',
  sword: 'sword swords blade knife war battle weapon fight warrior', flame: 'flame fire burn burning ember dragon explosion', crown: 'crown king queen throne royal kingdom',
  wave: 'ocean sea wave waves water ship island river boat', mountain: 'mountain mountains peak climb hill', heart: 'heart love romance hearts', gem: 'crystal gem gems diamond jewel treasure gold',
  note: 'music musical song songs singer singers band bands album albums melody concert concerts dance dancing idol idols choir orchestra guitar piano jazz rock opera rapper rappers', // the K-pop card had no picture of its own (2026-10-17)
  clock: 'clock time watchmaker hour', mask: 'mask masks mask disguise party carnival theatre',
};
const WORD_MOTIF = {}; for (const [m, ws] of Object.entries(MOTIFS)) for (const w of ws.split(' ')) if (!WORD_MOTIF[w]) WORD_MOTIF[w] = m;
const stem = (w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** the words an answer is about: its most repeated concrete words (first seen first on a tie), at most `max`, lower-case letters only. Pure. */
export function nounsOf(text, max = 6) {
  const seen = new Map(); let i = 0;
  // names (a Title Case run in mid-sentence, like a film's title) are not subjects to paint: cut them out first
  const bare = String(text || '').replace(/(?<=[a-z,;:("'] )[A-Z][a-z]+(?:(?: (?:of|the|to|and|in|a|for|at|on) | )[A-Z][a-z]+)*/g, ' ');
  for (const w of bare.toLowerCase().replace(/https?:\/\/\S+/g, ' ').match(/[a-z]{4,16}/g) || []) {
    if (STOP.has(w)) continue; const k = stem(w), e = seen.get(k) || { w, n: 0, at: i++ }; e.n++; seen.set(k, e);
  }
  // a word with a motif counts double: "hand" and "spirits" beat "teenagers" and "grief" as what to draw
  return [...seen.values()].sort((a, b) => (b.n + (WORD_MOTIF[b.w] || WORD_MOTIF[stem(b.w)] ? 2 : 0)) - (a.n + (WORD_MOTIF[a.w] || WORD_MOTIF[stem(a.w)] ? 2 : 0)) || a.at - b.at).slice(0, max).map((e) => e.w);
}
/** the paint subject of a card: the answer's own nouns as one line; with too little answer text, the card title's content words. Pure. */
export function subjectOf(title, text) {
  let n = nounsOf(text); if (n.length < 2) n = [...new Set([...n, ...nounsOf(title)])].slice(0, 6);
  return { nouns: n, phrase: n.join(' ') };
}
/** the motif names (at most 3, no repeats) for a list of nouns, in order. Pure. */
export function motifsFor(nouns) { const out = []; for (const w of nouns || []) { const m = WORD_MOTIF[w] || WORD_MOTIF[stem(w)]; if (m && !out.includes(m) && out.length < 3) out.push(m); } return out; }

const circ = (cx, cy, r) => 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0Z';
// each motif is a list of [path, fill] in a 100 x 100 box: 'P' paper, 'L' light, 'I' ink, 'G' gold, 'N' none
const DRAW = {
  hand: [['M28 92L26 62Q25 54 31 52L31 30Q31 24 37 24Q42 24 42 30L42 18Q42 12 48 12Q53 12 53 18L53 20Q53 14 59 14Q64 14 64 20L64 30Q64 24 69 26Q73 28 72 34L71 60Q71 76 63 92Z', 'P'], ['M31 52Q25 46 20 40Q16 34 22 32Q26 32 31 40', 'N'], ['M42 30V50M53 20V48M64 30V50', 'N'], ['M34 74Q50 80 66 74', 'N']],
  eye: [['M4 50Q50 8 96 50Q50 92 4 50Z', 'P'], [circ(50, 50, 17), 'L'], [circ(50, 50, 7), 'I'], ['M50 4V16M24 12L30 22M76 12L70 22M8 30L18 36M92 30L82 36', 'N']],
  skull: [['M50 8Q18 8 18 42Q18 58 30 64L30 82L70 82L70 64Q82 58 82 42Q82 8 50 8Z', 'P'], [circ(37, 46, 9), 'I'], [circ(63, 46, 9), 'I'], ['M50 56L45 66H55Z', 'I'], ['M38 82V70M46 82V72M54 82V72M62 82V70', 'N']],
  ghost: [['M18 94L18 44Q18 8 50 8Q82 8 82 44L82 94L69 82L56 94L44 82L31 94Z', 'P'], [circ(38, 42, 6), 'I'], [circ(62, 42, 6), 'I'], ['M42 62Q50 72 58 62Q50 66 42 62Z', 'I']],
  moon: [['M62 8A42 42 0 1 0 62 92A34 34 0 1 1 62 8Z', 'G']],
  sun: [[circ(50, 50, 20), 'G'], ['M50 6V24M50 76V94M6 50H24M76 50H94M19 19L32 32M68 68L81 81M81 19L68 32M32 68L19 81', 'N']],
  star: [['M50 6L61 38L95 38L67 58L78 92L50 71L22 92L33 58L5 38L39 38Z', 'G']],
  tree: [['M44 94L44 62L56 62L56 94Z', 'L'], ['M50 6L82 46H66L90 74H10L34 46H18Z', 'P']],
  house: [['M8 50L50 12L92 50L92 94L8 94Z', 'P'], ['M40 94V62Q50 50 60 62V94Z', 'I'], ['M18 56H30V68H18ZM70 56H82V68H70Z', 'G']],
  key: [[circ(30, 34, 20), 'G'], [circ(30, 34, 8), 'I'], ['M44 48L90 86M72 70L82 60M82 78L92 68', 'N']],
  book: [['M6 24Q28 16 50 28Q72 16 94 24L94 80Q72 72 50 84Q28 72 6 80Z', 'P'], ['M50 28V84M16 38Q30 34 42 42M16 52Q30 48 42 56M58 42Q70 34 84 38M58 56Q70 48 84 52', 'N']],
  sword: [['M50 4L58 18V66H42V18Z', 'L'], ['M24 66H76V74H24Z', 'G'], ['M46 74H54V92H46Z', 'P'], [circ(50, 96, 4), 'G']],
  flame: [['M50 6Q72 34 74 56Q76 88 50 94Q24 88 26 56Q28 40 42 28Q42 44 50 50Q58 30 50 6Z', 'G'], ['M50 56Q60 70 50 86Q40 70 50 56Z', 'P']],
  crown: [['M10 80L10 32L32 54L50 20L68 54L90 32L90 80Z', 'G'], ['M10 80H90V90H10Z', 'P'], [circ(50, 20, 4), 'P']],
  wave: [['M4 56Q20 34 36 56T68 56T96 56V92H4Z', 'L'], ['M4 72Q20 54 36 72T68 72T96 72', 'N'], [circ(78, 24, 10), 'G']],
  mountain: [['M4 90L36 24L54 56L68 38L96 90Z', 'P'], ['M36 24L28 40L36 36L44 44Z', 'L']],
  heart: [['M50 90L12 48Q4 26 26 18Q42 14 50 32Q58 14 74 18Q96 26 88 48Z', 'G']],
  gem: [['M24 24H76L94 46L50 94L6 46Z', 'L'], ['M6 46H94M24 24L38 46L50 94L62 46L76 24M38 46L50 24L62 46', 'N']],
  clock: [[circ(50, 50, 40), 'P'], ['M50 20V50L68 62M50 12V16M50 84V88M12 50H16M84 50H88', 'N']],
  note: [[circ(30, 78, 13), 'G'], [circ(74, 70, 13), 'G'], ['M43 78V22L87 12V70', 'N'], ['M43 22L87 12V26L43 36Z', 'I']],
  mask: [['M10 28Q50 12 90 28Q92 64 70 80Q50 94 30 80Q8 64 10 28Z', 'P'], ['M24 42Q34 36 44 46Q34 54 24 42ZM56 46Q66 36 76 42Q66 54 56 46Z', 'I'], ['M38 70Q50 78 62 70', 'N']],
};
/** the motifs as ink drawings for an art box of w x h: a gold halo of sigils behind, the first motif large, the others beside it. `c` = { P, L, D, G, ink, sw }. Pure. */
/** a motif's drawing as [path, fill] pairs in a 100 x 100 box (fills: P paper, L light, I ink, G gold, N none), or null. Pure. */
export const motifPaths = (name) => DRAW[name] || null;
export function motifSvg(names, w, h, c) {
  if (!names || !names.length) return '';
  const fill = { P: c.P, L: c.L, I: c.ink, G: c.G, N: 'none' }, u = h / 100;
  const one = (name, cx, cy, sz) => '<g transform="translate(' + (cx - sz / 2).toFixed(1) + ' ' + (cy - sz / 2).toFixed(1) + ')scale(' + (sz / 100).toFixed(3) + ')">' + DRAW[name].map(([d, f]) => '<path d="' + d + '" fill="' + fill[f] + '"/>').join('') + '</g>';
  let s = '<g stroke="' + c.ink + '" stroke-width="' + (c.sw * 2.2).toFixed(1) + '" stroke-linejoin="round" stroke-linecap="round" fill="none">';
  s += '<g stroke="' + c.G + '" stroke-width="' + (1.2 * u).toFixed(1) + '" opacity=".75"><circle cx="' + (w / 2).toFixed(1) + '" cy="' + (h / 2).toFixed(1) + '" r="' + (h * 0.47).toFixed(1) + '"/><circle cx="' + (w / 2).toFixed(1) + '" cy="' + (h / 2).toFixed(1) + '" r="' + (h * 0.41).toFixed(1) + '" stroke-dasharray="' + (2 * u).toFixed(1) + ' ' + (5 * u).toFixed(1) + '"/></g>';
  const big = h * 0.72; s += one(names[0], w / 2, h / 2, big);
  if (names[1]) s += one(names[1], w / 2 - big * 0.95, h / 2 + h * 0.06, h * 0.4);
  if (names[2]) s += one(names[2], w / 2 + big * 0.95, h / 2 + h * 0.06, h * 0.4);
  return s + '</g>';
}
