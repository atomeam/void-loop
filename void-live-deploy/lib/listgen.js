// The list language (owner, 2026-10-25: "how do we beat perchance if we dont have images? we have to have everything all the sites have"):
// perchance.org's way of writing a random generator, as a pure engine shared by /generators/make/ (the live editor), /generators/ (the hub)
// and /api/generators (a generator is checked here before it is published). Pure: no DOM, no network, no clock. Tests: tools/listgen.test.mjs.
//
// What a generator looks like (the same text perchance takes, the common part of it):
//
//   output
//     A [size] [animal.titleCase] that loves [food]. {Truly|Honestly}, it is {a} [mood] one.
//   animal
//     cat ^2            <- odds: twice as likely as an item without them (^0.5 half as likely, ^0 never)
//     dog
//     bird
//       sparrow         <- a nested list: [animal] picks one of cat, dog or bird, and bird picks sparrow or owl;
//       owl                [animal.bird] picks from the birds only
//   size
//     tiny
//     huge
//   $output = [animal]  <- one line: a list of one item (perchance's $output = ... form)
//
// Inside an item: [list] picks from a list (nested lists all the way down), [list.sub] picks from a nested list, [list.titleCase],
// .upperCase, .lowerCase, .sentenceCase, .pluralForm, .singularForm, .selectOne, .selectMany(3), .selectUnique(3), .selectAll, .joinItems(", "),
// [x = animal] keeps the pick in x (later [x] says the same thing), [x = animal, ""] keeps it and shows nothing; {a|b|c} picks one inline
// (options may carry odds: {a^3|b}), {1-6} a whole number, {a-z} a letter, {2d6+1} dice, {a} is "a" or "an" for the word after it, {s} an "s" unless the
// number before it is 1, [d = list.consumableList, ""] then [d] deals without repeats (it starts over when used up), .possessiveForm, .pastTense, <br> a new line, \[ \{ \| \\ the
// character itself, \s a space, // a comment. A list called image (or $image) is the generator's picture prompt: "Picture it" sends it to
// /image/. A text with no indented line at all is one plain list, one entry per line (the old "make your own" box keeps working).
// Plain text out, never HTML: the pages put it in with textContent.

export const MAX_TEXT = 20000, MAX_OUT = 8000, MAX_STEPS = 20000, MAX_DEPTH = 60, MAX_LINES = 2000;
const NAME = /^[$A-Za-z_][\w$]*$/;
export const METHODS = Object.freeze(['selectOne', 'selectMany', 'selectUnique', 'selectAll', 'joinItems', 'consumableList', 'titleCase', 'upperCase', 'lowerCase', 'sentenceCase', 'pluralForm', 'singularForm', 'possessiveForm', 'pastTense']);
const RESERVED = new Set(METHODS);

/** a seeded random number source in [0, 1): mulberry32. Pure. */
export function rng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** the seed of the i-th result of a run, so each result can be made again on its own. Pure. */
export const seedFor = (seed, i) => { let h = ((Number(seed) >>> 0) + Math.imul(i + 1, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };

// a comment starts at // at the line's start or after a space, unless escaped (a link's https:// is not one)
function stripComment(line) {
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '/' && line[i + 1] === '/' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}
const indentOf = (line) => { let n = 0; for (const c of line) { if (c === ' ') n++; else if (c === '\t') n += 2; else break; } return n; };
// an item's odds: a trailing ^number (^2, ^0.5, ^1/3), not escaped. { text, odds, bad }
function oddsOf(text) {
  const m = text.match(/(^|[^\\])\s\^\s*(\S+)\s*$/) || text.match(/^()\^\s*(\S+)\s*$/);
  if (!m) return { text, odds: 1 };
  const raw = m[2], f = raw.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
  const body = text.slice(0, m.index + m[1].length).trimEnd();
  if (!f) return { text: body, odds: 1, bad: raw };
  const odds = f[2] ? Number(f[1]) / Number(f[2]) : Number(f[1]);
  return Number.isFinite(odds) ? { text: body, odds } : { text: body, odds: 1, bad: raw };
}

/** the text -> { lists: { name: node }, order, errors: [{ line, message }], plain, title }. A node is { name, line, items: [{ text, odds, line, name?, items? }] }:
 *  an item with items under it is a nested list called by its text. Errors are plain words with the line they are on. Pure. */
export function compile(source) {
  const text = String(source == null ? '' : source).slice(0, MAX_TEXT).replace(/\r\n?/g, '\n');
  const lines = text.split('\n').slice(0, MAX_LINES), errors = [], lists = Object.create(null), order = [];
  const err = (line, message) => { if (errors.length < 50) errors.push({ line, message }); };
  const cleaned = lines.map((l) => stripComment(l).replace(/\s+$/, ''));
  // a plain list: nothing indented, so every line is an entry of one list (the old one-list box)
  const titled = (l) => /^\$title\s*=/.test(l);
  if (!cleaned.some((l) => l.trim() && indentOf(l) > 0) && !cleaned.some((l) => !titled(l) && /^\s*\$?[A-Za-z_][\w$]*\s*=/.test(l) && !/^\s*\$?[A-Za-z_][\w$]*\s*==/.test(l))) {
    const items = [], t = cleaned.find(titled);
    cleaned.forEach((l, i) => { if (l.trim() && !titled(l)) { const o = oddsOf(l.trim()); if (o.bad) err(i + 1, 'odds are a number like ^2 or ^0.5, not ^' + o.bad); items.push({ text: o.text, odds: o.odds, line: i + 1 }); } });
    lists.output = { name: 'output', line: 1, items }; order.push('output');
    return finish({ lists, order, errors, plain: true, title: t ? t.replace(/^\$title\s*=\s*/, '').replace(/[[\]{}]/g, '').slice(0, 60) : '' });
  }
  let stack = null; // [{ indent, node }] from the list down to the item last added
  cleaned.forEach((l, i) => {
    const ln = i + 1; if (!l.trim()) return;
    const ind = indentOf(l), body = l.trim();
    if (ind === 0) {
      const one = body.match(/^(\$?[A-Za-z_][\w$]*)\s*=\s*(.*)$/);
      if (one && !/^=/.test(one[2])) {
        const name = one[1]; if (lists[name]) err(ln, 'there are two lists called ' + name + '; the second one is used');
        lists[name] = { name, line: ln, items: [{ text: one[2], odds: 1, line: ln }] }; if (!order.includes(name)) order.push(name); stack = null; return;
      }
      if (!NAME.test(body)) { err(ln, '"' + body.slice(0, 30) + '" is not a list name: a name is letters, digits, _ or $, with no spaces (an entry goes on an indented line under its list)'); stack = null; return; }
      if (RESERVED.has(body)) { err(ln, body + ' is a word the language uses; call the list something else'); stack = null; return; }
      if (lists[body]) err(ln, 'there are two lists called ' + body + '; the second one is used');
      const node = { name: body, line: ln, items: [] }; lists[body] = node; if (!order.includes(body)) order.push(body);
      stack = [{ indent: -1, node }]; return;
    }
    if (!stack) { err(ln, 'this line is indented, but there is no list name above it'); return; }
    while (stack.length > 1 && stack[stack.length - 1].indent >= ind) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (parent.items === undefined) { // an item that gets items of its own becomes a nested list called by its text
      if (!NAME.test(parent.text) || RESERVED.has(parent.text)) err(parent.line, '"' + String(parent.text).slice(0, 30) + '" has entries under it, so it is a nested list and needs a name: letters, digits, _ or $, no spaces');
      parent.name = parent.text; parent.items = [];
    }
    const o = oddsOf(body); if (o.bad) err(ln, 'odds are a number like ^2 or ^0.5, not ^' + o.bad);
    const item = { text: o.text, odds: o.odds, line: ln }; parent.items.push(item); stack.push({ indent: ind, node: item });
  });
  const titleList = lists.$title || lists.title;
  const title = titleList && titleList.items.length === 1 && !titleList.items[0].items ? String(titleList.items[0].text).replace(/[[\]{}]/g, '').slice(0, 60) : '';
  return finish({ lists, order, errors, plain: false, title });
}
// the checks that need the whole text: an output list, every [name] a list or a kept value, brackets that close
function finish(g) {
  const out = outputName(g); if (!out) g.errors.push({ line: 1, message: 'there is no output list: write a list called output (or $output = ...), the line that makes each result' });
  const assigned = new Set();
  const walk = (node, fn) => { for (const it of node.items || []) { if (it.items) walk(it, fn); else fn(it); } };
  const all = [];
  for (const name of g.order) walk(g.lists[name], (it) => all.push(it));
  for (const it of all) for (const m of String(it.text).matchAll(/\[\s*(\$?[A-Za-z_][\w$]*)\s*=(?!=)/g)) assigned.add(m[1]);
  for (const it of all) {
    const b = balance(it.text); if (b) { g.errors.push({ line: it.line, message: b }); continue; }
    for (const ref of refsOf(it.text)) if (!g.lists[ref] && !assigned.has(ref)) g.errors.push({ line: it.line, message: 'there is no list called ' + ref + (near(ref, g.order) ? ' (did you mean ' + near(ref, g.order) + '?)' : '') });
  }
  for (const name of g.order) if (!g.lists[name].items.length) g.errors.push({ line: g.lists[name].line, message: 'the list ' + name + ' has no entries: put each one on an indented line under it' });
  g.errors.sort((a, b) => a.line - b.line); g.errors.splice(50);
  return g;
}
export const outputName = (g) => (g.lists.output ? 'output' : g.lists.$output ? '$output' : '');
export const imageName = (g) => (g.lists.image ? 'image' : g.lists.$image ? '$image' : '');
const near = (w, names) => names.find((n) => n.toLowerCase() === w.toLowerCase() || n.replace(/s$/, '') === w.replace(/s$/, '')) || '';
// whether [ ] and { } close in an entry (escapes skipped): '' or the message
function balance(t) {
  const st = []; const s = String(t);
  for (let i = 0; i < s.length; i++) {
    const c = s[i]; if (c === '\\') { i++; continue; }
    if (c === '[' || c === '{') st.push(c);
    else if (c === ']' || c === '}') { const o = st.pop(); if (!o) return 'a ' + c + ' closes something that was never opened'; if ((o === '[') !== (c === ']')) return 'a ' + o + ' is closed by ' + c; }
  }
  return st.length ? 'a ' + st[st.length - 1] + ' is never closed' : '';
}
// the list names an entry refers to: the first name of each [ ... ] chain (strings, numbers and kept values aside)
function refsOf(t) {
  const out = new Set(), s = String(t).replace(/\\./g, '');
  for (const m of s.matchAll(/\[([^\[\]]*)\]/g)) {
    for (const seg of splitTop(m[1], ',')) {
      const expr = seg.replace(/^\s*\$?[A-Za-z_][\w$]*\s*=(?!=)/, '').trim();
      const h = expr.match(/^(\$?[A-Za-z_][\w$]*)/); if (h && !/^["']/.test(expr)) out.add(h[1]);
    }
  }
  return out;
}
// split at a separator that is not inside brackets, braces, parentheses or quotes
function splitTop(s, sep) {
  const out = []; let depth = 0, q = '', cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { cur += c + (s[i + 1] || ''); i++; continue; }
    if (q) { if (c === q) q = ''; cur += c; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if ('[{('.includes(c)) depth++; else if (']})'.includes(c)) depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur); return out;
}

// words
const IRREGULAR = { man: 'men', woman: 'women', child: 'children', person: 'people', mouse: 'mice', goose: 'geese', foot: 'feet', tooth: 'teeth', ox: 'oxen', wolf: 'wolves', knife: 'knives', leaf: 'leaves', life: 'lives', elf: 'elves', dwarf: 'dwarves', thief: 'thieves', fish: 'fish', sheep: 'sheep', deer: 'deer' };
const SINGULAR = Object.fromEntries(Object.entries(IRREGULAR).map(([a, b]) => [b, a]));
const keepCase = (from, to) => (/^[A-Z]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to);
/** a word's plural (the last word of a phrase). Pure. */
export function pluralForm(s) {
  return String(s).replace(/([A-Za-z]+)(\W*)$/, (_, w, tail) => {
    const lo = w.toLowerCase(); let p;
    if (IRREGULAR[lo]) p = IRREGULAR[lo];
    else if (/[^aeiou]y$/.test(lo)) p = lo.slice(0, -1) + 'ies';
    else if (/(s|x|z|ch|sh)$/.test(lo)) p = lo + 'es';
    else p = lo + 's';
    return (w === w.toUpperCase() && w.length > 1 ? p.toUpperCase() : keepCase(w, p)) + tail;
  });
}
/** a word's singular (the last word of a phrase), the other way round from pluralForm. Pure. */
export function singularForm(s) {
  return String(s).replace(/([A-Za-z]+)(\W*)$/, (_, w, tail) => {
    const lo = w.toLowerCase(); let p;
    if (SINGULAR[lo]) p = SINGULAR[lo];
    else if (/[^aeiou]ies$/.test(lo)) p = lo.slice(0, -3) + 'y';
    else if (/(ss|x|z|ch|sh)es$/.test(lo)) p = lo.slice(0, -2);
    else if (/[^s]s$/.test(lo)) p = lo.slice(0, -1);
    else p = lo;
    return keepCase(w, p) + tail;
  });
}
export const titleCase = (s) => String(s).replace(/(^|[\s\-("'])(\p{Ll})/gu, (_, a, b) => a + b.toUpperCase());
export const sentenceCase = (s) => String(s).replace(/^(\s*)(\p{L})/u, (_, a, b) => a + b.toUpperCase());
/** "cat" -> "cat's", "cats" -> "cats'". Pure. */
export const possessiveForm = (s) => String(s).replace(/([A-Za-z]+)(\W*)$/, (_, w, tail) => w + (/s$/i.test(w) ? "'" : "'s") + tail);
const PAST = { be: 'was', is: 'was', are: 'were', go: 'went', do: 'did', have: 'had', has: 'had', make: 'made', see: 'saw', take: 'took', come: 'came', get: 'got', give: 'gave', find: 'found', run: 'ran', eat: 'ate', fly: 'flew', fight: 'fought', sing: 'sang', write: 'wrote', ride: 'rode', steal: 'stole', break: 'broke', speak: 'spoke', know: 'knew', think: 'thought', bring: 'brought', buy: 'bought', fall: 'fell', sleep: 'slept', win: 'won', lose: 'lost', say: 'said', tell: 'told', swim: 'swam', drink: 'drank', begin: 'began', leave: 'left', meet: 'met', hold: 'held', build: 'built', send: 'sent', sit: 'sat', stand: 'stood', wake: 'woke', put: 'put', cut: 'cut', hit: 'hit', let: 'let', set: 'set' };
/** a verb's past tense (the first word of a phrase): "walk to town" -> "walked to town". Pure. */
export const pastTense = (s) => String(s).replace(/^(\s*)([A-Za-z]+)/, (_, sp, w) => { const lo = w.toLowerCase(); let p = PAST[lo] || (/e$/.test(lo) ? lo + 'd' : /[^aeiou]y$/.test(lo) ? lo.slice(0, -1) + 'ied' : /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(lo) ? lo + lo.slice(-1) + 'ed' : lo + 'ed'); return sp + keepCase(w, p); });
const STRING_METHODS = { possessiveForm, pastTense, titleCase, upperCase: (s) => String(s).toUpperCase(), lowerCase: (s) => String(s).toLowerCase(), sentenceCase, pluralForm, singularForm };
// "a" or "an" before a word: vowel sounds, with the usual exceptions
export function articleFor(word) {
  const w = String(word || '').toLowerCase();
  if (/^(?:hour|honest|honou?r|heir)/.test(w)) return 'an';
  if (/^(?:uni|use|usu|uti|eu|one|once|ur[aei])/.test(w)) return 'a';
  if (/^\d/.test(w)) return /^(?:8|11|18|80)/.test(w) ? 'an' : 'a';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

class GenError extends Error { constructor(message, line) { super(message); this.line = line; } }

/** one result: { output, image, errors }. `g` is compile()'s answer (or the text itself). The same g and seed give the same result. Pure. */
export function run(gen, seed = 1, { image = true } = {}) {
  const g = typeof gen === 'string' ? compile(gen) : gen;
  if (g.errors.length) return { output: '', image: '', errors: g.errors };
  const out = outputName(g); if (!out) return { output: '', image: '', errors: [{ line: 1, message: 'there is no output list' }] };
  const ctx = { g, rand: rng(seed), vars: Object.create(null), steps: 0, depth: 0, line: g.lists[out].line };
  try {
    const output = finishText(pick(ctx, g.lists[out]));
    const im = image && imageName(g) ? finishText(pick(ctx, g.lists[imageName(g)])) : '';
    return { output, image: im, errors: [] };
  } catch (e) {
    if (!(e instanceof GenError)) throw e;
    return { output: '', image: '', errors: [{ line: e.line || ctx.line || 1, message: e.message }] };
  }
}
/** `n` results from one seed, each made again by run(g, seedFor(seed, i)): { results: [{ output, image }], errors }. Pure. */
export function generate(text, seed = 1, n = 5) {
  const g = typeof text === 'string' ? compile(text) : text, results = [];
  if (g.errors.length) return { results, errors: g.errors, title: g.title || '' };
  for (let i = 0; i < Math.max(1, Math.min(50, n | 0)); i++) { const r = run(g, seedFor(seed, i)); if (r.errors.length) return { results, errors: r.errors, title: g.title }; results.push({ output: r.output, image: r.image }); }
  return { results, errors: [], title: g.title };
}

function step(ctx, line) { if (++ctx.steps > MAX_STEPS) throw new GenError('the generator does too much work for one result (more than ' + MAX_STEPS + ' picks): a list probably picks from itself', line); }
// one weighted pick from a list (or nested list), evaluated
function pick(ctx, node) {
  step(ctx, node.line);
  const items = node.items.filter((it) => it.odds > 0);
  if (!items.length) throw new GenError('every entry of ' + node.name + ' has odds of 0, so nothing can be picked', node.line);
  const total = items.reduce((a, it) => a + it.odds, 0); let r = ctx.rand() * total, chosen = items[items.length - 1];
  for (const it of items) { r -= it.odds; if (r < 0) { chosen = it; break; } }
  if (chosen.items) return pick(ctx, chosen);
  return evalText(ctx, chosen.text, chosen.line);
}
function leaves(node) { const out = []; for (const it of node.items) { if (it.items) out.push(...leaves(it)); else if (it.odds > 0) out.push(it); } return out; }

// the end of a result: "a"/"an" settled by the word after it, <br> as a new line, the length cut
function finishText(s) {
  let t = String(s).replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/\u0002/g, (_, at, all) => { const m = all.slice(0, at).match(/(-?\d+(?:\.\d+)?)[^\d]*$/); return m && Number(m[1]) === 1 ? '' : 's'; });
  t = t.replace(/\u0001([aA])(\s*)([^\s\u0001]*)/g, (_, a, sp, w) => { const x = articleFor(w.replace(/^[^A-Za-z0-9]+/, '')); return (a === 'A' ? x.charAt(0).toUpperCase() + x.slice(1) : x) + (sp || ' ') + w; });
  return t.slice(0, MAX_OUT);
}

function evalText(ctx, text, line) {
  if (ctx.depth + 1 > MAX_DEPTH) throw new GenError('the generator calls itself without end (more than ' + MAX_DEPTH + ' levels deep)', line);
  ctx.depth++; const prev = ctx.line; ctx.line = line;
  try {
    const s = String(text); let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { const n = s[i + 1]; out += n === 's' ? ' ' : n === 'n' ? '\n' : n === undefined ? '' : n; i++; continue; }
      if (c === '[' || c === '{') {
        const end = closing(s, i); if (end < 0) throw new GenError('a ' + c + ' is never closed', line);
        const inner = s.slice(i + 1, end);
        out += c === '[' ? asText(evalExpr(ctx, inner, line)) : evalChoice(ctx, inner, line);
        i = end; continue;
      }
      out += c;
      if (out.length > MAX_OUT * 2) break;
    }
    return out;
  } finally { ctx.depth--; ctx.line = prev; }
}
function closing(s, i) {
  const open = s[i], close = open === '[' ? ']' : '}'; let d = 0, q = '';
  for (let j = i; j < s.length; j++) {
    const c = s[j]; if (c === '\\') { j++; continue; }
    if (open === '[' && q) { if (c === q) q = ''; continue; }
    if (open === '[' && (c === '"' || c === "'") && d === 1) { q = c; continue; }
    if (c === open) d++; else if (c === close && --d === 0) return j;
  }
  return -1;
}
// {a|b|c}, {a^2|b}, {1-6}, {a}
function evalChoice(ctx, inner, line) {
  const t = inner.trim();
  if (t === 'a' || t === 'A') return '\u0001' + t;
  if (t === 's') return '\u0002';
  const lr = t.match(/^([a-zA-Z])\s*-\s*([a-zA-Z])$/);
  if (lr) { const lo = Math.min(lr[1].charCodeAt(0), lr[2].charCodeAt(0)), hi = Math.max(lr[1].charCodeAt(0), lr[2].charCodeAt(0)); step(ctx, line); return String.fromCharCode(lo + Math.floor(ctx.rand() * (hi - lo + 1))); }
  const dice = t.match(/^(\d{0,2})d(\d{1,4})\s*(?:([+-])\s*(\d{1,4}))?$/i);
  if (dice) { const n = Math.max(1, Math.min(99, +dice[1] || 1)), f = Math.max(1, +dice[2]); let sum = 0; for (let i = 0; i < n; i++) { step(ctx, line); sum += 1 + Math.floor(ctx.rand() * f); } return String(sum + (dice[3] ? (dice[3] === '-' ? -1 : 1) * +dice[4] : 0)); }
  const r = t.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
  if (r) { const lo = Math.min(+r[1], +r[2]), hi = Math.max(+r[1], +r[2]); step(ctx, line); return String(lo + Math.floor(ctx.rand() * (hi - lo + 1))); }
  const opts = splitTop(inner, '|').map((o) => { const m = o.match(/(^|[^\\])\^\s*(\d+(?:\.\d+)?)\s*$/); return m ? { text: o.slice(0, m.index + m[1].length), odds: Number(m[2]) } : { text: o, odds: 1 }; });
  const live = opts.filter((o) => o.odds > 0); if (!live.length) return '';
  step(ctx, line);
  const total = live.reduce((a, o) => a + o.odds, 0); let x = ctx.rand() * total, chosen = live[live.length - 1];
  for (const o of live) { x -= o.odds; if (x < 0) { chosen = o; break; } }
  return evalText(ctx, chosen.text, line);
}
const asText = (v) => (Array.isArray(v) ? v.join(', ') : v && v.items ? '' : String(v == null ? '' : v));
// [a, b = c, "text"]: each part in turn, the last one shown
function evalExpr(ctx, inner, line) {
  let last = '';
  for (const seg of splitTop(inner, ',')) {
    const a = seg.match(/^\s*(\$?[A-Za-z_][\w$]*)\s*=(?!=)([\s\S]*)$/);
    if (a) { const raw = chain(ctx, a[2].trim(), line); if (raw && raw.deck) { ctx.vars[a[1]] = raw; last = ''; continue; } const v = settle(ctx, raw, line); ctx.vars[a[1]] = v; last = v; continue; }
    last = settle(ctx, chain(ctx, seg.trim(), line), line);
  }
  return last;
}
const settle = (ctx, v, line) => (v && v.items ? pick(ctx, v) : v && v.deck ? deal(ctx, v, line) : v);
// one card from a deck: weighted, removed from the deck; an empty deck starts over
function deal(ctx, d, line) {
  if (!d.pool.length) d.pool = d.all.slice();
  if (!d.pool.length) return '';
  step(ctx, line); const total = d.pool.reduce((a, it) => a + it.odds, 0); let x = ctx.rand() * total, k = d.pool.length - 1;
  for (let i = 0; i < d.pool.length; i++) { x -= d.pool[i].odds; if (x < 0) { k = i; break; } }
  const [it] = d.pool.splice(k, 1); return evalText(ctx, it.text, it.line);
}
// name(.member(args))* -> a list node, a string or an array
function chain(ctx, expr, line) {
  if (!expr) return '';
  const lit = expr.match(/^"((?:[^"\\]|\\.)*)"$|^'((?:[^'\\]|\\.)*)'$/);
  if (lit) return evalText(ctx, lit[1] != null ? lit[1] : lit[2], line);
  if (/^-?\d+(?:\.\d+)?$/.test(expr)) return expr;
  const parts = [], re = /\.?(\$?[A-Za-z_][\w$]*)(?:\(([^()]*)\))?/y; let m, pos = 0;
  while (pos < expr.length) { re.lastIndex = pos; m = re.exec(expr); if (!m || (pos > 0 && expr[pos] !== '.')) throw new GenError('cannot read [' + expr.slice(0, 40) + ']: write a list name, then .something for each step', line); parts.push({ name: m[1], args: m[2] }); pos = re.lastIndex; }
  const head = parts[0].name;
  let v = head in ctx.vars ? ctx.vars[head] : ctx.g.lists[head];
  if (v === undefined) throw new GenError('there is no list called ' + head, line);
  for (const p of parts.slice(1)) v = member(ctx, v, p, line);
  return v;
}
const argOf = (a, def) => { const s = String(a == null ? '' : a).trim(); const q = s.match(/^"((?:[^"\\]|\\.)*)"$|^'((?:[^'\\]|\\.)*)'$/); if (q) return (q[1] != null ? q[1] : q[2]).replace(/\\(.)/g, '$1'); return s === '' ? def : s; };
function member(ctx, v, p, line) {
  const { name } = p;
  if (v && v.items) { // a list
    const sub = v.items.find((it) => it.items && it.name === name);
    if (sub) return sub;
    if (name === 'selectOne') return pick(ctx, v);
    if (name === 'consumableList') { const all = leaves(v); return { deck: true, name: v.name, all, pool: all.slice() }; }
    if (name === 'selectAll') return leaves(v).map((it) => evalText(ctx, it.text, it.line));
    if (name === 'selectMany') { const n = Math.max(0, Math.min(100, parseInt(argOf(p.args, '1'), 10) || 0)); return Array.from({ length: n }, () => pick(ctx, v)); }
    if (name === 'selectUnique') {
      const n = Math.max(0, Math.min(100, parseInt(argOf(p.args, '1'), 10) || 0)), pool = leaves(v).slice(), out = [];
      while (out.length < n && pool.length) { step(ctx, line); const total = pool.reduce((a, it) => a + it.odds, 0); let x = ctx.rand() * total, k = pool.length - 1; for (let i = 0; i < pool.length; i++) { x -= pool[i].odds; if (x < 0) { k = i; break; } } out.push(evalText(ctx, pool[k].text, pool[k].line)); pool.splice(k, 1); }
      return out;
    }
    if (STRING_METHODS[name] || name === 'joinItems') return member(ctx, pick(ctx, v), p, line);
    throw new GenError(v.name + ' has no nested list or way called ' + name, line);
  }
  if (v && v.deck) {
    if (name === 'selectOne') return deal(ctx, v, line);
    if (name === 'selectMany' || name === 'selectUnique') { const n = Math.max(0, Math.min(100, parseInt(argOf(p.args, '1'), 10) || 0)); return Array.from({ length: n }, () => deal(ctx, v, line)); }
    if (STRING_METHODS[name] || name === 'joinItems') return member(ctx, deal(ctx, v, line), p, line);
    throw new GenError('a dealt list has no way called ' + name, line);
  }
  if (Array.isArray(v)) {
    if (name === 'joinItems') return v.join(argOf(p.args, ', '));
    if (STRING_METHODS[name]) return v.map((x) => STRING_METHODS[name](x));
    if (name === 'selectOne') { step(ctx, line); return v.length ? v[Math.floor(ctx.rand() * v.length)] : ''; }
    throw new GenError('a list of picks has no way called ' + name + ' (try .joinItems)', line);
  }
  if (STRING_METHODS[name]) return STRING_METHODS[name](v);
  if (name === 'selectOne' || name === 'joinItems') return v;
  throw new GenError('"' + String(v).slice(0, 20) + '" has no way called ' + name, line);
}

// sharing: the whole generator in the link's fragment (#g=...), so nothing is stored anywhere for a share. 'p.' is the text as base64url;
// 'z.' is the text deflated first (CompressionStream, every current browser and Node), about a third of the size
const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
/** the text -> 'p.<base64url>'. Pure. */
export const toShare = (text) => 'p.' + b64u(new TextEncoder().encode(String(text).slice(0, MAX_TEXT)));
/** the text -> 'z.<base64url of deflate-raw>' where CompressionStream exists, else toShare(text). */
export async function packShare(text) {
  if (typeof CompressionStream !== 'function') return toShare(text);
  try { const s = new Blob([String(text).slice(0, MAX_TEXT)]).stream().pipeThrough(new CompressionStream('deflate-raw')); return 'z.' + b64u(new Uint8Array(await new Response(s).arrayBuffer())); } catch (_) { return toShare(text); }
}
/** 'p.' or 'z.' -> the text, or null when it is not a generator link. */
export async function unpackShare(code) {
  const c = String(code || '').trim();
  try {
    if (c.startsWith('p.')) return new TextDecoder().decode(unb64u(c.slice(2))).slice(0, MAX_TEXT);
    if (c.startsWith('z.') && typeof DecompressionStream === 'function') {
      const s = new Blob([unb64u(c.slice(2))]).stream().pipeThrough(new DecompressionStream('deflate-raw')), r = new Response(s).body.getReader(); let got = 0; const parts = [];
      for (;;) { const { done, value } = await r.read(); if (done) break; got += value.length; if (got > MAX_TEXT * 4) { r.cancel(); return null; } parts.push(value); }
      const all = new Uint8Array(got); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      return new TextDecoder().decode(all).slice(0, MAX_TEXT);
    }
  } catch (_) {}
  return null;
}

/** the starter a new generator opens with: nested lists, odds, an inline choice, a method, a kept value and a picture prompt. Pure data. */
export const STARTER = [
  '$title = Tavern of the day',
  '',
  'output',
  '  [t = tavern.titleCase, ""]The [t], {a} [mood] place where [patron.pluralForm] drink [drink]. Tonight: {2-6} bards.',
  '',
  'image',
  '  a cozy fantasy tavern called the [t], [mood] mood, warm candlelight',
  '',
  'tavern',
  '  [adjective] [animal]',
  '  [animal] and [animal]',
  '',
  'adjective',
  '  rusty ^2',
  '  golden',
  '  {sleepy|drowsy}',
  '  one-eyed ^0.5',
  '',
  'animal',
  '  beasts',
  '    dragon',
  '    griffin',
  '  birds',
  '    owl',
  '    crow',
  '',
  'mood',
  '  rowdy',
  '  quiet',
  '  eerie',
  '',
  'patron',
  '  dwarf',
  '  thief',
  '  [animal.birds] keeper',
  '',
  'drink',
  '  mead',
  '  {cold|warm} cider',
].join('\n');
