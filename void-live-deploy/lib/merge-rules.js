// Verse card merges, the rules (frontier #34 step 1; owner, 2026-10-16: "research merge games so Verse can experiment with card merges").
// Two cards go in, one card comes out. PURE and DETERMINISTIC: no clock, no randomness, no network. The page (skills/merge.js) and the
// server route (functions/api/merge.js) share this file, so both mean the same thing by "the same pair".
//
// THE FIXED RULES (a card is { name, kinds, power, resistance, income, cost, depth }; a new idea is 1 / 1 / 0, cost 1, depth 0):
//   pair key   unordered: the two idea keys sorted and joined with "|", so merge(A, B) and merge(B, A) are one cached result.
//   idea key   folded: accents removed, lower case, letters and digits only, a leading "a/an/the/some/my" dropped, a trailing plural "s"
//              dropped, at most 60 characters ("A Pizza!" and "pizzas" are the same idea).
//   Power      = max(parent powers) + floor(min(parent powers) / 2), at most 99.
//   Resistance = the average of the parents' resistances, rounded up, at most 99.
//   Income     = sum of the parents' incomes, at most 9.
//   cost       = ceil((Power + Resistance) / 4), never below the dearer parent's cost, 1 to 9.
//   depth      = max(parent depths) + 1; rarity rises with depth: 1 Uncommon, 2 Rare, 3 or more Mythic (depth 0, an unmerged idea, is Common).
//   kinds      = both parents' kinds in key order, duplicates dropped, "Idea" dropped when a real kind is present, at most 3.
// Stats are EARNED from the parents, never chosen: the model's whole job is a name and one line (sanitiseName, sanitiseLine); no number
// in its text reaches a card. The parents are put in key order first, so every function here is symmetric in its two cards.
// The word list for the deterministic name is the parents' own names: with no model, a merge still has a readable name.

const KEY_MAX = 60, NAME_MAX = 40, LINE_MAX = 120;
export const LIMITS = { KEY_MAX, NAME_MAX, LINE_MAX, POWER_MAX: 99, RESISTANCE_MAX: 99, INCOME_MAX: 9, COST_MAX: 9, KINDS_MAX: 3 };
export const TIER_BY_DEPTH = ['experiment', 'tested', 'checked', 'proven']; // keys of RARITY in lib/card-frame.js: Common, Uncommon, Rare, Mythic

/** the folded key of an idea's name, or '' when nothing is left. Pure. */
export function ideaKey(text) {
  let s = String(text == null ? '' : text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(?:a|an|the|some|my)\s+/, '').trim();
  const w = s.split(' ').filter(Boolean);
  if (!w.length) return '';
  const last = w[w.length - 1];
  if (last.length > 3 && last.endsWith('s') && !last.endsWith('ss') && !last.endsWith('us')) w[w.length - 1] = last.slice(0, -1);
  return w.join(' ').slice(0, KEY_MAX).trim();
}

/** the unordered pair key "a|b" (keys sorted), or '' when either idea is empty. Pure. */
export function pairKey(a, b) {
  const ka = ideaKey(a), kb = ideaKey(b);
  return ka && kb ? [ka, kb].sort().join('|') : '';
}

const titleCase = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
const int = (v, lo, hi, dflt) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };

/** a card for an idea nobody has proved anything about: 1 / 1 / 0, cost 1, depth 0, an Idea. Pure. */
export function freshCard(name) {
  const clean = titleCase(sanitiseName(name) || ideaKey(name) || 'Idea');
  return { name: clean, key: ideaKey(name), kinds: ['Idea'], power: 1, resistance: 1, income: 0, cost: 1, depth: 0 };
}

/** a card for something Verse really is (a skill): its stats from card-frame's cardOf(), depth 0. Pure. */
export function cardFromStats(name, c) {
  const kind = String((c && c.typeLine) || '').split(/\s+[\u2014-]\s+/)[0].trim();
  return { name: sanitiseName(name) || freshCard(name).name, key: ideaKey(name), kinds: [kind || 'Skill'],
    power: int(c && c.power, 1, 99, 1), resistance: int(c && c.toughness, 1, 99, 1), income: int(c && c.income, 0, 9, 0), cost: int(c && c.cost, 1, 9, 1), depth: 0 };
}

const norm = (c) => ({ name: String(c.name || ''), key: String(c.key || ideaKey(c.name)), kinds: Array.isArray(c.kinds) && c.kinds.length ? c.kinds.map(String) : ['Idea'],
  power: int(c.power, 1, 99, 1), resistance: int(c.resistance, 1, 99, 1), income: int(c.income, 0, 9, 0), cost: int(c.cost, 1, 9, 1), depth: int(c.depth, 0, 99, 0) });
/** the two cards in key order (ties keep their given order, which cannot matter: equal keys are one idea). Pure. */
export function ordered(a, b) { const x = norm(a), y = norm(b); return x.key <= y.key ? [x, y] : [y, x]; }

/** the merged card's kinds. Pure. */
export function mergeKinds(a, b) {
  const [x, y] = ordered(a, b), all = [];
  for (const k of [...x.kinds, ...y.kinds]) if (k && !all.includes(k)) all.push(k);
  const real = all.filter((k) => k !== 'Idea');
  return (real.length ? real : ['Idea']).slice(0, LIMITS.KINDS_MAX);
}

/** the merged card's numbers from its parents by the fixed rules above: { power, resistance, income, cost, depth, tier }. Pure. */
export function mergeStats(a, b) {
  const [x, y] = ordered(a, b);
  const power = Math.min(99, Math.max(x.power, y.power) + Math.floor(Math.min(x.power, y.power) / 2));
  const resistance = Math.min(99, Math.ceil((x.resistance + y.resistance) / 2));
  const income = Math.min(9, x.income + y.income);
  const cost = Math.min(9, Math.max(1, Math.ceil((power + resistance) / 4), x.cost, y.cost));
  const depth = Math.max(x.depth, y.depth) + 1;
  return { power, resistance, income, cost, depth, tier: TIER_BY_DEPTH[Math.min(depth, TIER_BY_DEPTH.length - 1)] };
}

/** a readable name with no model: the parents' names joined, "Black hole-Pizza", kept under the cap, the same for (A, B) and (B, A). Pure. */
export function fallbackName(a, b) {
  const [x, y] = ordered(a, b), half = Math.floor((NAME_MAX - 1) / 2);
  const part = (c) => { const n = titleCase(sanitiseName(c.name) || c.key || 'Idea'); return n.length <= half ? n : n.slice(0, half).replace(/\s+\S*$/, '').trim() || n.slice(0, half); };
  return (part(x) + '-' + part(y)).slice(0, NAME_MAX);
}

/** one deterministic line of what the merged card adds, with no model. Pure. */
export function fallbackLine(a, b) {
  const [x, y] = ordered(a, b);
  const t = (c) => sanitiseName(c.name) || c.key || 'an idea';
  return sanitiseLine('What ' + t(x) + ' does, changed by ' + t(y) + '.');
}

// ---- model text: a name and a line, nothing else, made safe -------------------------------------------------------------------------
const KEY_SHAPES = /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[A-Z0-9]{16}\b|\bAIza[0-9A-Za-z_-]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|-----BEGIN[^-]*-----|\b[A-Fa-f0-9]{32,}\b|\b[A-Za-z0-9+/_-]{40,}={0,2}/g;
const URLS = /\b(?:https?|ftp|file|data|javascript):\S*|\bwww\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|co|ai|xyz|ru|cn|tk|info|biz|me|gg|ly|sh)\b\S*/gi;
function cleanText(text, keep) {
  let s = String(text == null ? '' : text);
  s = s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' '); // control, zero-width and direction characters
  s = s.replace(/\[redacted[^\]]*\]/gi, ' ').replace(/<[^>]*>?/g, ' ');                       // markup, including a tag left open
  s = s.replace(/\[([^\]]*)\]\(\S*/g, '$1').replace(KEY_SHAPES, ' ').replace(URLS, ' ');
  s = s.replace(keep, ' ');                              // markdown and code characters
  return s.replace(/\s+/g, ' ').trim();
}
/** a model's idea of a name -> at most 40 safe characters: no markup, links, key shapes or quotes. '' when nothing usable is left. Pure. */
export function sanitiseName(text) {
  const s = cleanText(text, /[`*_#~\[\]{}()\\|<>"\u201c\u201d]/g).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}!?]+$/gu, '');
  return s.slice(0, NAME_MAX).trim();
}
/** a model's one line -> at most 120 safe characters, one line, no markup or links. '' when nothing is left. Pure. */
export function sanitiseLine(text) {
  const s = cleanText(text, /[`*#~\[\]{}\\|<>]/g);
  return s.slice(0, LINE_MAX).trim();
}
