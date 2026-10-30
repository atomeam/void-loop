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

export const AI_MAX = 3, AI_PROMPT_MAX = 400, WHEEL_MAX = 24, SHARED_KEYS = 20;
export const LAYOUTS = Object.freeze(['lines', 'cards', 'grid', 'table']);
export const MAX_TEXT = 20000, MAX_OUT = 8000, MAX_STEPS = 20000, MAX_DEPTH = 60, MAX_LINES = 2000;
const NAME = /^[$A-Za-z_][\w$]*$/;
export const METHODS = Object.freeze(['selectOne', 'selectMany', 'selectUnique', 'selectAll', 'joinItems', 'consumableList', 'titleCase', 'upperCase', 'lowerCase', 'sentenceCase', 'pluralForm', 'singularForm', 'possessiveForm', 'pastTense', 'presentTense', 'futureTense', 'negativeForm']);
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
  const c = text.match(/(^|[^\\])\s\^\[([\s\S]+)\]\s*$/); // ^[condition]: worked out at each pick
  if (c && !balance('[' + c[2] + ']')) return { text: text.slice(0, c.index + c[1].length).trimEnd(), odds: 1, oddsExpr: c[2] };
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
    cleaned.forEach((l, i) => { if (l.trim() && !titled(l)) { const o = oddsOf(l.trim()); if (o.bad) err(i + 1, 'odds are a number like ^2 or ^0.5, not ^' + o.bad); items.push({ text: o.text, odds: o.odds, line: i + 1, ...(o.oddsExpr ? { oddsExpr: o.oddsExpr } : {}) }); } });
    lists.output = { name: 'output', line: 1, items }; order.push('output');
    return finish({ lists, order, errors, plain: true, meta: {}, inputs: [], imports: [], title: t ? t.replace(/^\$title\s*=\s*/, '').replace(/[[\]{}]/g, '').slice(0, 60) : '' });
  }
  let stack = null; // [{ indent, node }] from the list down to the item last added
  cleaned.forEach((l, i) => {
    const ln = i + 1; if (!l.trim()) return;
    const ind = indentOf(l), body = l.trim();
    if (ind === 0) {
      const one = body.match(/^(\$?[A-Za-z_][\w$]*)\s*=\s*(.*)$/);
      if (one && !/^=/.test(one[2])) {
        const name = one[1]; if (lists[name]) err(ln, 'there are two lists called ' + name + '; the second one is used');
        const imp = one[2].trim().match(/^\{import:([^}]*)\}$/);
        if (imp) { if (!/^[a-z2-7]{8}$/.test(imp[1].trim())) err(ln, 'an import names a published generator by its 8-letter id, the end of its link: {import:abcdefgh}'); lists[name] = { name, line: ln, items: [], importId: imp[1].trim() }; if (!order.includes(name)) order.push(name); stack = null; return; }
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
    const item = { text: o.text, odds: o.odds, line: ln, ...(o.oddsExpr ? { oddsExpr: o.oddsExpr } : {}) }; parent.items.push(item); stack.push({ indent: ind, node: item });
  });
  // $meta: title, description, image (a gallery picture's id) for the share card; $inputs: what a person chooses before generating
  const meta = {}, inputs = [];
  for (const it of (lists.$meta && lists.$meta.items) || []) { const m = String(it.text).match(/^(title|description|image)\s*=\s*(.+)$/i); if (!m) { err(it.line, 'a $meta line is title = ..., description = ... or image = <a gallery picture id>'); continue; } const k = m[1].toLowerCase(); meta[k] = m[2].replace(/[[\]{}<>]/g, '').trim().slice(0, k === 'description' ? 200 : 60); }
  if (meta.image && !/^[a-z2-7]{8}$/.test(meta.image)) { err(lists.$meta.line, 'a $meta image is the id of a picture in the public gallery (8 letters)'); delete meta.image; }
  for (const it of (lists.$inputs && lists.$inputs.items) || []) {
    const m = String(it.text).match(/^([A-Za-z_]\w{0,30})\s*=\s*(select|text|number)\b\s*(.*)$/i);
    if (!m) { err(it.line, 'an input is name = select a|b|c, name = text default words, or name = number 1-10'); continue; }
    const kind = m[2].toLowerCase(), rest = m[3].trim();
    if (kind === 'select') { const options = rest.split('|').map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 20); if (!options.length) { err(it.line, 'a select input needs its choices: select a|b|c'); continue; } inputs.push({ name: m[1], kind, options, def: options[0] }); }
    else if (kind === 'number') { const r = rest.match(/^(-?\d+)\s*-\s*(-?\d+)$/) || [null, '1', '10']; const min = Math.min(+r[1], +r[2]), max = Math.max(+r[1], +r[2]); inputs.push({ name: m[1], kind, min, max, def: String(min) }); }
    else inputs.push({ name: m[1], kind, def: rest.slice(0, 60) });
    if (inputs.length >= 12) break;
  }
  const titleList = lists.$title || lists.title;
  const title = meta.title || (titleList && titleList.items.length === 1 && !titleList.items[0].items ? String(titleList.items[0].text).replace(/[[\]{}]/g, '').slice(0, 60) : '');
  const imports = order.filter((n) => lists[n].importId).map((n) => lists[n].importId);
  // $layout: how the results are laid out (lines, cards, a grid of tiles, or a table whose columns are split by " | ")
  const lay = lists.$layout && lists.$layout.items[0] ? String(lists.$layout.items[0].text).trim().toLowerCase() : 'lines';
  if (!LAYOUTS.includes(lay)) err(lists.$layout.line, '$layout is one of ' + LAYOUTS.join(', '));
  meta.layout = LAYOUTS.includes(lay) ? lay : 'lines';
  return finish({ lists, order, errors, plain: false, title, meta, inputs, imports });
}
// the checks that need the whole text: an output list, every [name] a list or a kept value, brackets that close
function finish(g) {
  const out = outputName(g); if (!out) g.errors.push({ line: 1, message: 'there is no output list: write a list called output (or $output = ...), the line that makes each result' });
  const assigned = new Set((g.inputs || []).map((x) => x.name).concat(['shared'])); // shared: the published generator's shared data
  const own = (node) => { Object.defineProperty(node, 'owner', { value: g, enumerable: false, configurable: true }); for (const it of node.items || []) if (it.items) own(it); };
  for (const name of g.order) own(g.lists[name]);
  const walk = (node, fn) => { for (const it of node.items || []) { if (it.items) walk(it, fn); else fn(it); } };
  const all = [];
  for (const name of g.order) if (name !== '$meta' && name !== '$inputs' && name !== '$layout') walk(g.lists[name], (it) => all.push(it));
  for (const it of all) for (const m of String(it.text).matchAll(/\[\s*(\$?[A-Za-z_][\w$]*)\s*=(?!=)/g)) assigned.add(m[1]);
  for (const it of all) {
    const b = balance(it.text); if (b) { g.errors.push({ line: it.line, message: b }); continue; }
    for (const ref of refsOf(it.text)) if (!g.lists[ref] && !assigned.has(ref)) g.errors.push({ line: it.line, message: 'there is no list called ' + ref + (near(ref, g.order) ? ' (did you mean ' + near(ref, g.order) + '?)' : '') });
  }
  for (const name of g.order) if (!g.lists[name].items.length && !g.lists[name].importId) g.errors.push({ line: g.lists[name].line, message: 'the list ' + name + ' has no entries: put each one on an indented line under it' });
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
      const h = expr.match(/^(\$?[A-Za-z_][\w$]*)/); if (h && !/^["']/.test(expr) && !/^(?:if|else|true|false)$/.test(h[1])) out.add(h[1]);
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
const UNPAST = Object.fromEntries(Object.entries(PAST).filter(([k]) => !['is', 'has'].includes(k)).map(([a, b]) => [b, a]));
const MODAL = /^(?:can|could|will|would|shall|should|may|might|must)$/i;
/** a verb's plain form, whatever tense it came in: "walked", "walks", "will walk", "flew" -> "walk", "fly". Pure. */
export function verbBase(w) {
  const lo = String(w).toLowerCase();
  if (lo === 'is' || lo === 'are' || lo === 'was' || lo === 'were' || lo === 'am') return 'be';
  if (lo === 'has' || lo === 'had') return 'have';
  if (UNPAST[lo]) return UNPAST[lo];
  if (/[^aeiou]ied$/.test(lo)) return lo.slice(0, -3) + 'y';
  if (/([^aeiouwxy])\1ed$/.test(lo) && !/(?:ll|ss)ed$/.test(lo)) return lo.slice(0, -3);
  if (/ated$|[^aeiou][aeiou][bcdgklmnprstvz]ed$/.test(lo) && !/(?:ened|ited|ered|eled|aled|oned|ored)$/.test(lo)) return lo.slice(0, -1); // liked, smiled, created -> like, smile, create
  if (/ed$/.test(lo) && lo.length > 4) return lo.slice(0, -2);
  if (/[^aeiou]ies$/.test(lo)) return lo.slice(0, -3) + 'y';
  if (/(?:ss|x|z|ch|sh|o)es$/.test(lo)) return lo.slice(0, -2);
  if (/[^s]s$/.test(lo) && lo.length > 3) return lo.slice(0, -1);
  return lo;
}
const thirdPerson = (b) => (b === 'be' ? 'is' : b === 'have' ? 'has' : /[^aeiou]y$/.test(b) ? b.slice(0, -1) + 'ies' : /(?:s|x|z|ch|sh|o)$/.test(b) ? b + 'es' : b + 's');
const verbFirst = (s, fn) => String(s).replace(/^(\s*)(?:(will)\s+)?([A-Za-z]+)/i, (_, sp, will, w) => { const out = fn(will ? w : w, !!will); return sp + (/^[A-Z]/.test(will || w) ? out.charAt(0).toUpperCase() + out.slice(1) : out); });
/** "walked to town" -> "walks to town" (he/she/it). Pure. */
export const presentTense = (s) => verbFirst(s, (w) => (MODAL.test(w) ? w.toLowerCase() : thirdPerson(verbBase(w))));
/** "walked to town" -> "will walk to town". Pure. */
export const futureTense = (s) => verbFirst(s, (w, will) => (will ? 'will ' + verbBase(w) : MODAL.test(w) ? w.toLowerCase() : 'will ' + verbBase(w)));
/** "walks to town" -> "does not walk to town", "walked" -> "did not walk", "is happy" -> "is not happy", "can fly" -> "cannot fly". Pure. */
export const negativeForm = (s) => verbFirst(s, (w, will) => {
  const lo = w.toLowerCase(); if (will) return 'will not ' + verbBase(w);
  if (/^(?:is|are|was|were|am|has|had|have)$/.test(lo) && lo.startsWith('ha') === false) return lo + ' not';
  if (lo === 'can') return 'cannot'; if (MODAL.test(lo)) return lo + ' not';
  if (UNPAST[lo] || /ed$/.test(lo)) return 'did not ' + verbBase(w);
  if (/s$/.test(lo) && verbBase(w) !== lo) return 'does not ' + verbBase(w);
  return 'do not ' + lo;
});
const STRING_METHODS = { possessiveForm, pastTense, presentTense, futureTense, negativeForm, titleCase, upperCase: (s) => String(s).toUpperCase(), lowerCase: (s) => String(s).toLowerCase(), sentenceCase, pluralForm, singularForm };
// "a" or "an" before a word: vowel sounds, with the usual exceptions
export function articleFor(word) {
  const w = String(word || '').toLowerCase();
  if (/^(?:hour|honest|honou?r|heir)/.test(w)) return 'an';
  if (/^(?:uni|use|usu|uti|eu|one|once|ur[aei])/.test(w)) return 'a';
  if (/^\d/.test(w)) return /^(?:8|11|18|80)/.test(w) ? 'an' : 'a';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

class GenError extends Error { constructor(message, line) { super(message); this.line = line; } }

/** the values an input may take: the input's own default, or what was chosen when it is allowed. Pure. */
export function inputValues(g, chosen = {}) {
  const out = Object.create(null);
  for (const inp of g.inputs || []) {
    const v = Object.prototype.hasOwnProperty.call(chosen || {}, inp.name) ? String(chosen[inp.name]) : inp.def;
    if (inp.kind === 'select') out[inp.name] = inp.options.includes(v) ? v : inp.def;
    else if (inp.kind === 'number') { const n = Number(v); out[inp.name] = Number.isFinite(n) ? String(Math.max(inp.min, Math.min(inp.max, Math.round(n)))) : inp.def; }
    else out[inp.name] = v.replace(/[\u0000-\u001f]/g, ' ').slice(0, 60);
  }
  return out;
}
/** one result: { output, image, errors }. `g` is compile()'s answer (or the text itself). `imports` maps a hub id to that generator compiled;
 *  `inputs` are the values chosen in the generator's inputs. The same g, seed, imports and inputs give the same result. Pure. */
export function run(gen, seed = 1, { image = true, imports = {}, inputs = {}, spans = false, shared = null } = {}) {
  const g = typeof gen === 'string' ? compile(gen) : gen;
  if (g.errors.length) return { output: '', image: '', errors: g.errors };
  const out = outputName(g); if (!out) return { output: '', image: '', errors: [{ line: 1, message: 'there is no output list' }] };
  const vars = Object.assign(Object.create(null), inputValues(g, inputs));
  vars.shared = {}; if (shared && typeof shared === 'object') vars.shared = Object.fromEntries(Object.entries(shared).slice(0, SHARED_KEYS).map(([k, v]) => [String(k).slice(0, 30), typeof v === 'number' ? v : String(v).slice(0, 200)]));
  const ctx = { g, rand: rng(seed), vars, c: { steps: 0, depth: 0 }, line: g.lists[out].line, imports: imports || {}, others: new Map(), ai: [], armSpans: !!spans, spans: null, wheels: [], writes: [] };
  try {
    const output = finishText(pick(ctx, g.lists[out]));
    const sp = ctx.spans; ctx.armSpans = false;
    const im = image && imageName(g) ? finishText(pick(ctx, g.lists[imageName(g)])) : '';
    const res = { output, image: im, errors: [], ai: ctx.ai, ...(ctx.wheels.length ? { wheels: ctx.wheels } : {}), ...(ctx.writes.length ? { writes: ctx.writes } : {}) };
    if (spans) { res.spans = sp || [{ t: output }]; res.vars = Object.fromEntries(Object.entries(ctx.vars).filter(([, v]) => typeof v === 'string' || typeof v === 'number')); }
    return res;
  } catch (e) {
    if (!(e instanceof GenError)) throw e;
    return { output: '', image: '', errors: [{ line: e.line || ctx.line || 1, message: e.message }] };
  }
}
/** `n` results from one seed, each made again by run(g, seedFor(seed, i), opts): { results: [{ output, image }], errors, title }. Pure. */
export function generate(text, seed = 1, n = 5, opts = {}) {
  const g = typeof text === 'string' ? compile(text) : text, results = [];
  if (g.errors.length) return { results, errors: g.errors, title: g.title || '' };
  for (let i = 0; i < Math.max(1, Math.min(50, n | 0)); i++) { const r = run(g, seedFor(seed, i), opts); if (r.errors.length) return { results, errors: r.errors, title: g.title }; results.push({ output: r.output, image: r.image }); }
  return { results, errors: [], title: g.title };
}

function step(ctx, line) { if (++ctx.c.steps > MAX_STEPS) throw new GenError('the generator does too much work for one result (more than ' + MAX_STEPS + ' picks): a list probably picks from itself', line); }
// evaluating a list of another generator (an import): its own lists and its own kept values, the same random source and limits
function within(ctx, owner, fn) {
  if (!owner || owner === ctx.g) return fn();
  const g = ctx.g, vars = ctx.vars; if (!ctx.others.has(owner)) ctx.others.set(owner, Object.create(null));
  ctx.g = owner; ctx.vars = ctx.others.get(owner);
  try { return fn(); } finally { ctx.g = g; ctx.vars = vars; }
}
const importOf = (ctx, node) => { const ig = ctx.imports && ctx.imports[node.importId]; if (!ig || !outputName(ig)) throw new GenError('the imported generator ' + node.importId + ' is not loaded (it may have been taken down)', node.line); return ig; };
// an entry's odds now: its number, or its ^[condition] worked out (true is 1, false 0)
function oddsNow(ctx, it) { if (it.oddsExpr === undefined) return it.odds; const v = settle(ctx, expr(ctx, it.oddsExpr, it.line), it.line); return Math.max(0, numOf(v, true)); }
// one weighted pick from a list (or nested list), evaluated
function pick(ctx, node) {
  if (node.importId) { const ig = importOf(ctx, node); return within(ctx, ig, () => pick(ctx, ig.lists[outputName(ig)])); }
  step(ctx, node.line);
  return within(ctx, node.owner, () => {
    const items = node.items.map((it) => [it, oddsNow(ctx, it)]).filter(([, o]) => o > 0);
    if (!items.length) throw new GenError('every entry of ' + node.name + ' has odds of 0 right now, so nothing can be picked', node.line);
    const total = items.reduce((a, [, o]) => a + o, 0); let r = ctx.rand() * total, chosen = items[items.length - 1][0];
    for (const [it, o] of items) { r -= o; if (r < 0) { chosen = it; break; } }
    if (chosen.items) return pick(ctx, chosen);
    if (ctx.armSpans) { ctx.armSpans = false; ctx.spanTarget = chosen; } // the output's own entry: its parts are kept for tap-to-reroll
    return evalText(ctx, chosen.text, chosen.line, ctx.spanTarget === chosen);
  });
}
function leaves(ctx, node) { const out = []; for (const it of node.items) { if (it.items) out.push(...leaves(ctx, it)); else { const o = oddsNow(ctx, it); if (o > 0) out.push({ ...it, odds: o, owner: node.owner }); } } return out; }

// the end of a result: "a"/"an" settled by the word after it, <br> as a new line, the length cut
function finishText(s) {
  let t = String(s).replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/\u0002/g, (_, at, all) => { const m = all.slice(0, at).match(/(-?\d+(?:\.\d+)?)[^\d]*$/); return m && Number(m[1]) === 1 ? '' : 's'; });
  t = t.replace(/\u0001([aA])([\s\u0003\u0004]*)([^\s\u0001\u0003\u0004]*)/g, (_, a, sp, w) => { const x = articleFor(w.replace(/^[^A-Za-z0-9]+/, '')); return (a === 'A' ? x.charAt(0).toUpperCase() + x.slice(1) : x) + (sp || ' ') + w; });
  return t.slice(0, MAX_OUT);
}

function evalText(ctx, text, line, record = false) {
  if (ctx.c.depth + 1 > MAX_DEPTH) throw new GenError('the generator calls itself without end (more than ' + MAX_DEPTH + ' levels deep)', line);
  ctx.c.depth++; const prev = ctx.line; ctx.line = line;
  try {
    const s = String(text); let out = '';
    const parts = record ? [] : null, lit = (x) => { if (!parts) return; const l = parts[parts.length - 1]; if (l && l.src === undefined) l.t += x; else parts.push({ t: x }); };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { const n = s[i + 1]; const x = n === 's' ? ' ' : n === 'n' ? '\n' : n === undefined ? '' : n; out += x; lit(x); i++; continue; }
      if (c === '[' || c === '{') {
        const end = closing(s, i); if (end < 0) throw new GenError('a ' + c + ' is never closed', line);
        const inner = s.slice(i + 1, end);
        const x = c === '[' ? asText(evalExpr(ctx, inner, line)) : evalChoice(ctx, inner, line);
        out += x; if (parts) parts.push({ t: x, src: inner, kind: c, line });
        i = end; continue;
      }
      out += c; lit(c);
      if (out.length > MAX_OUT * 2) break;
    }
    if (parts) ctx.spans = parts;
    return out;
  } finally { ctx.c.depth--; ctx.line = prev; }
}
function closing(s, i) {
  const open = s[i], close = open === '[' ? ']' : open === '(' ? ')' : '}'; let d = 0, q = '';
  for (let j = i; j < s.length; j++) {
    const c = s[j]; if (c === '\\') { j++; continue; }
    if (open !== '{' && q) { if (c === q) q = ''; continue; }
    if (open !== '{' && (c === '"' || c === "'") && d === 1) { q = c; continue; }
    if (c === open) d++; else if (c === close && --d === 0) return j;
  }
  return -1;
}
// {a|b|c}, {a^2|b}, {1-6}, {a-z}, {2d6+1}, {a}, {s}
function evalChoice(ctx, inner, line) {
  const t = inner.trim();
  if (t === 'a' || t === 'A') return '\u0001' + t;
  if (t === 's') return '\u0002';
  const wh = inner.match(/^\s*wheel\s*:\s*(\$?[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*)\s*$/i); // {wheel: list}: the winner, picked fairly by weight, and the wheel the page spins to it
  if (wh) {
    let node = null; try { node = expr(ctx, wh[1], line); } catch (e) { throw e; }
    if (!node || !node.items) throw new GenError('{wheel: ...} needs a list: ' + wh[1] + ' is not one', line);
    const ls = leaves(ctx, node).slice(0, WHEEL_MAX); if (!ls.length) return '';
    const entries = ls.map((it) => ({ label: within(ctx, it.owner, () => asText(evalText(ctx, it.text, it.line))).replace(/[\u0001-\u0006]/g, '').slice(0, 80) || '…', weight: Math.max(0.01, it.odds) }));
    step(ctx, line); const total = entries.reduce((a, e) => a + e.weight, 0); let x = ctx.rand() * total, k = entries.length - 1;
    for (let i = 0; i < entries.length; i++) { x -= entries[i].weight; if (x < 0) { k = i; break; } }
    ctx.wheels.push({ entries, winner: k }); return entries[k].label;
  }
  const wr = inner.match(/^\s*(add|set)\s*:\s*([A-Za-z_]\w{0,29})\s*(?:=\s*([\s\S]*))?$/i); // {add: key} counts one up in the generator's shared data, {set: key = text} keeps a value
  if (wr) { if (ctx.writes.length < 5) ctx.writes.push(wr[1].toLowerCase() === 'add' ? { op: 'add', key: wr[2] } : { op: 'set', key: wr[2], value: evalText(ctx, wr[3] || '', line).slice(0, 200) }); return ''; }
  const ai = inner.match(/^\s*ai\s*:([\s\S]+)$/i); // {ai: a prompt with [lists]}: the page asks the answer model and puts the text in (lib/listgen.js aiMarks)
  if (ai) { const prompt = evalText(ctx, ai[1].trim(), line).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, AI_PROMPT_MAX); if (!prompt || ctx.ai.length >= AI_MAX) return ''; ctx.ai.push(prompt); return '\u0005' + (ctx.ai.length - 1) + '\u0005'; }
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
const asText = (v) => (Array.isArray(v) ? v.join(', ') : v && (v.items || v.importId) ? '' : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v == null ? '' : v));
const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && /^\s*-?\d+(?:\.\d+)?\s*$/.test(v));
const numOf = (v, truthyIsOne = false) => (typeof v === 'boolean' ? (v ? 1 : 0) : isNum(v) ? Number(v) : truthyIsOne ? (truthy(v) ? 1 : 0) : NaN);
const truthy = (v) => !(v === false || v === '' || v === 0 || v == null || (Array.isArray(v) && !v.length));
// [a, b = c, "text"], [if (x) {..} else {..}]: each part in turn, the last one shown
function evalExpr(ctx, inner, line) {
  let last = '';
  for (const seg of splitTop(inner, ',')) {
    if (/^\s*if\s*\(/.test(seg)) { last = evalIf(ctx, seg.trim(), line); continue; }
    const a = seg.match(/^\s*(\$?[A-Za-z_][\w$]*)\s*=(?!=)([\s\S]*)$/);
    if (a) { const raw = expr(ctx, a[2].trim(), line); if (raw && raw.deck) { ctx.vars[a[1]] = raw; last = ''; continue; } const v = settle(ctx, raw, line); ctx.vars[a[1]] = v; last = v; continue; }
    last = settle(ctx, expr(ctx, seg.trim(), line), line);
  }
  return last;
}
// if (cond) {text} else if (cond) {text} else {text}: the text of the first condition that holds
function evalIf(ctx, s, line) {
  let i = 0; const bad = () => { throw new GenError('cannot read [' + s.slice(0, 40) + ']: write if (condition) {text} else {text}', line); };
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const block = () => { ws(); if (s[i] !== '{') bad(); const e = closing(s, i); if (e < 0) bad(); const body = s.slice(i + 1, e); i = e + 1; return body; };
  for (;;) {
    ws(); if (!s.startsWith('if', i)) bad(); i += 2; ws(); if (s[i] !== '(') bad();
    const e = closing(s, i); if (e < 0) bad(); const cond = s.slice(i + 1, e); i = e + 1;
    const body = block();
    if (truthy(settle(ctx, expr(ctx, cond, line), line))) return evalText(ctx, body, line);
    ws(); if (!s.startsWith('else', i)) return '';
    i += 4; ws(); if (s.startsWith('if', i)) continue;
    return evalText(ctx, block(), line);
  }
}
const settle = (ctx, v, line) => (v && (v.items || v.importId) ? pick(ctx, v) : v && v.deck ? deal(ctx, v, line) : v);
// one card from a deck: weighted, removed from the deck; an empty deck starts over
function deal(ctx, d, line) {
  if (!d.pool.length) d.pool = d.all.slice();
  if (!d.pool.length) return '';
  step(ctx, line); const total = d.pool.reduce((a, it) => a + it.odds, 0); let x = ctx.rand() * total, k = d.pool.length - 1;
  for (let i = 0; i < d.pool.length; i++) { x -= d.pool[i].odds; if (x < 0) { k = i; break; } }
  const [it] = d.pool.splice(k, 1); return within(ctx, it.owner, () => evalText(ctx, it.text, it.line));
}

// expressions inside [ ]: strings, numbers, true/false, list chains (animal.bird.titleCase, names[gender], x.selectMany(2)), ! - * / % + - < > <= >= == != && || and a ? b : c.
// Parsed to a small tree first, then worked out, so only the branch a condition takes is ever picked from. No JavaScript is run.
const OPS = [['||'], ['&&'], ['===', '!==', '==', '!='], ['<=', '>=', '<', '>'], ['+', '-'], ['*', '/', '%']];
export function parseExpr(src, line = 1) {
  const s = String(src); let i = 0;
  const bad = (why) => { throw new GenError('cannot read [' + s.slice(0, 40) + ']' + (why ? ': ' + why : ''), line); };
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const ternary = () => { const c = level(0); ws(); if (s[i] === '?') { i++; const a = ternary(); ws(); if (s[i] !== ':') bad('a ? needs its :'); i++; const b = ternary(); return { t: 'tern', c, a, b }; } return c; };
  const level = (k) => {
    if (k >= OPS.length) return unary();
    let a = level(k + 1);
    for (;;) { ws(); const op = OPS[k].find((o) => s.startsWith(o, i)); if (!op) return a; i += op.length; a = { t: 'bin', op, a, b: level(k + 1) }; } // longest first in each row: <= before <
  };
  const unary = () => { ws(); if (s[i] === '!') { i++; return { t: 'un', op: '!', a: unary() }; } if (s[i] === '-' && !/\d/.test(s[i + 1] || '')) { i++; return { t: 'un', op: '-', a: unary() }; } return primary(); };
  const primary = () => {
    ws(); const c = s[i];
    if (c === '(') { i++; const e = ternary(); ws(); if (s[i] !== ')') bad('a ( is never closed'); i++; return e; }
    if (c === '"' || c === "'") { let j = i + 1, v = ''; while (j < s.length && s[j] !== c) { if (s[j] === '\\') { v += s[j] + (s[j + 1] || ''); j += 2; continue; } v += s[j++]; } if (j >= s.length) bad('a quote is never closed'); i = j + 1; return { t: 'str', v }; }
    const n = s.slice(i).match(/^-?\d+(?:\.\d+)?/); if (n) { i += n[0].length; return { t: 'num', v: Number(n[0]) }; }
    const id = s.slice(i).match(/^\$?[A-Za-z_][\w$]*/); if (!id) bad(i < s.length ? 'unexpected "' + s[i] + '"' : 'something is missing at the end');
    i += id[0].length; if (id[0] === 'true' || id[0] === 'false') return { t: 'bool', v: id[0] === 'true' };
    const parts = [];
    for (;;) {
      if (s[i] === '.') { const m = s.slice(i + 1).match(/^\$?[A-Za-z_][\w$]*/); if (!m) bad('a . needs a name after it'); i += 1 + m[0].length; let args = null; if (s[i] === '(') { const e = closing(s, i); if (e < 0) bad('a ( is never closed'); const inner = s.slice(i + 1, e).trim(); args = inner ? splitTop(inner, ',').map((a) => parseExpr(a, line)) : []; i = e + 1; } parts.push({ name: m[0], args }); continue; }
      if (s[i] === '[') { const e = closing(s, i); if (e < 0) bad('a [ is never closed'); parts.push({ index: parseExpr(s.slice(i + 1, e), line) }); i = e + 1; continue; }
      break;
    }
    return { t: 'chain', head: id[0], parts };
  };
  const tree = ternary(); ws(); if (i < s.length) bad('unexpected "' + s.slice(i, i + 10) + '"');
  return tree;
}
function expr(ctx, src, line) { return evalNode(ctx, parseExpr(src, line), line); }
function evalNode(ctx, n, line) {
  const val = (x) => settle(ctx, evalNode(ctx, x, line), line);
  switch (n.t) {
    case 'str': return evalText(ctx, n.v, line);
    case 'num': return n.v;
    case 'bool': return n.v;
    case 'tern': return evalNode(ctx, truthy(val(n.c)) ? n.a : n.b, line);
    case 'un': { const a = val(n.a); return n.op === '!' ? !truthy(a) : -numOf(a); }
    case 'bin': {
      if (n.op === '&&') { const a = val(n.a); return truthy(a) ? val(n.b) : a; }
      if (n.op === '||') { const a = val(n.a); return truthy(a) ? a : val(n.b); }
      const a = val(n.a), b = val(n.b), nums = isNum(a) && isNum(b), x = Number(a), y = Number(b);
      switch (n.op) {
        case '==': case '===': return nums ? x === y : asText(a) === asText(b);
        case '!=': case '!==': return nums ? x !== y : asText(a) !== asText(b);
        case '<': return nums ? x < y : asText(a) < asText(b);
        case '>': return nums ? x > y : asText(a) > asText(b);
        case '<=': return nums ? x <= y : asText(a) <= asText(b);
        case '>=': return nums ? x >= y : asText(a) >= asText(b);
        case '+': return nums ? x + y : asText(a) + asText(b);
        case '-': return x - y; case '*': return x * y; case '/': return y === 0 ? 0 : x / y; case '%': return y === 0 ? 0 : x % y;
      }
      return '';
    }
    case 'chain': {
      let v = n.head in ctx.vars ? ctx.vars[n.head] : ctx.g.lists[n.head];
      if (v === undefined) throw new GenError('there is no list called ' + n.head, line);
      for (const p of n.parts) v = p.index ? member(ctx, v, { name: asText(val(p.index)), args: null, dynamic: true }, line) : member(ctx, v, { name: p.name, args: p.args ? p.args.map(val) : null }, line);
      return v;
    }
  }
  return '';
}
const argN = (args, i, def) => { const v = args && args[i] !== undefined ? numOf(args[i]) : def; return Number.isFinite(v) ? v : def; };
const countOf = (ctx, args, line) => { const a = argN(args, 0, 1), b = argN(args, 1, a), lo = Math.max(0, Math.min(100, Math.min(a, b))), hi = Math.max(0, Math.min(100, Math.max(a, b))); if (hi > lo) { step(ctx, line); return lo + Math.floor(ctx.rand() * (hi - lo + 1)); } return Math.floor(lo); };
function member(ctx, v, p, line) {
  const { name, args } = p;
  if (v && v.importId) { const ig = importOf(ctx, v); const l = ig.lists[name]; if (l) return l; if (STRING_METHODS[name] || METHODS.includes(name)) return member(ctx, pick(ctx, v), p, line); throw new GenError('the imported generator has no list called ' + name, line); }
  if (v && v.items) { // a list
    const sub = v.items.find((it) => it.items && it.name === name);
    if (sub) return sub;
    if (p.dynamic) throw new GenError(v.name + ' has no nested list called ' + (name || '(nothing)'), line);
    if (name === 'selectOne') return pick(ctx, v);
    if (name === 'consumableList') { const all = leaves(ctx, v); return { deck: true, name: v.name, all, pool: all.slice() }; }
    if (name === 'selectAll') return leaves(ctx, v).map((it) => within(ctx, it.owner, () => evalText(ctx, it.text, it.line)));
    if (name === 'selectMany') { const n = countOf(ctx, args, line); return Array.from({ length: n }, () => pick(ctx, v)); }
    if (name === 'selectUnique') {
      const n = countOf(ctx, args, line), pool = leaves(ctx, v), out = [];
      while (out.length < n && pool.length) { step(ctx, line); const total = pool.reduce((a, it) => a + it.odds, 0); let x = ctx.rand() * total, k = pool.length - 1; for (let i = 0; i < pool.length; i++) { x -= pool[i].odds; if (x < 0) { k = i; break; } } const it = pool[k]; out.push(within(ctx, it.owner, () => evalText(ctx, it.text, it.line))); pool.splice(k, 1); }
      return out;
    }
    if (STRING_METHODS[name] || name === 'joinItems') return member(ctx, pick(ctx, v), p, line);
    throw new GenError(v.name + ' has no nested list or way called ' + name, line);
  }
  if (v && v.deck) {
    if (name === 'selectOne') return deal(ctx, v, line);
    if (name === 'selectMany' || name === 'selectUnique') { const n = countOf(ctx, args, line); return Array.from({ length: n }, () => deal(ctx, v, line)); }
    if (STRING_METHODS[name] || name === 'joinItems') return member(ctx, deal(ctx, v, line), p, line);
    throw new GenError('a dealt list has no way called ' + name, line);
  }
  if (Array.isArray(v)) {
    if (name === 'joinItems') return v.join(args && args[0] !== undefined ? asText(args[0]) : ', ');
    if (STRING_METHODS[name]) return v.map((x) => STRING_METHODS[name](x));
    if (name === 'selectOne') { step(ctx, line); return v.length ? v[Math.floor(ctx.rand() * v.length)] : ''; }
    if (p.dynamic && /^\d+$/.test(name)) return v[+name] == null ? '' : v[+name];
    throw new GenError('a list of picks has no way called ' + name + ' (try .joinItems)', line);
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && !v.items && !v.deck && !v.importId) return Object.prototype.hasOwnProperty.call(v, name) ? v[name] : ''; // shared data: [shared.key]
  if (STRING_METHODS[name]) return STRING_METHODS[name](asText(v));
  if (name === 'selectOne' || name === 'joinItems') return v;
  throw new GenError('"' + asText(v).slice(0, 20) + '" has no way called ' + name, line);
}

/** the parts of a result (run(..., { spans: true }).spans) as they read: "a"/"an" and {s} worked out across parts. Pure. */
export function tidySpans(spans) {
  const raw = spans.map((x) => x.t);
  return spans.map((x, i) => { const all = finishText(raw.slice(0, i).join('') + '\u0004' + raw[i] + '\u0003' + raw.slice(i + 1).join('')); return { ...x, t: all.slice(all.indexOf('\u0004') + 1, all.indexOf('\u0003')) }; });
}
/** a new value for one tappable part of a result: the part's [ ] or { } worked out again with a fresh seed and the result's kept values. Pure. */
export function reroll(gen, span, seed = 1, { imports = {}, inputs = {}, vars = {} } = {}) {
  const g = typeof gen === 'string' ? compile(gen) : gen;
  if (!span || span.src === undefined) return { t: span ? span.t : '', errors: [] };
  const ctx = { g, rand: rng(seed), vars: Object.assign(Object.create(null), inputValues(g, inputs), vars), c: { steps: 0, depth: 0 }, line: span.line || 1, imports, others: new Map(), ai: [], armSpans: false };
  try { const t = span.kind === '[' ? asText(evalExpr(ctx, span.src, span.line)) : evalChoice(ctx, span.src, span.line); return { t, errors: [], ai: ctx.ai }; }
  catch (e) { if (!(e instanceof GenError)) throw e; return { t: span.t, errors: [{ line: e.line || 1, message: e.message }] }; }
}
/** a result's text with its {ai: ...} marks filled: `texts[i]` for mark i, or `wait` while it is being written. Pure. */
export const aiMarks = (text, texts = [], wait = '…') => String(text).replace(/\u0005(\d+)\u0005/g, (_, i) => (texts[+i] != null ? texts[+i] : wait));

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
