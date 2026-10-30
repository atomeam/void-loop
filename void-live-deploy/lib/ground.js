// The semantic validator, first step (owner, 2026-10-14: "it needs a tighter grounding mechanism" and "maybe it needs a 'semantic
// validator' loop"; Verse, 2026-10-13: its 'Words and the world' family struggles "to ground language into the stage reliably").
// Routing is measured (the everyday benchmark: the right skill answered), but whether the card is about what was asked was checked
// for only the asks that carry a "says" pattern. This checks every answer the same way: an ask's subject is what is left once the
// skill's own trigger words and the small words are taken out ("recipe for banana bread" -> banana, bread), and a grounded card
// shows that subject. Cheap and deterministic, so it can run on every answer; an ask with no subject ("tell me a joke") is not
// judged. The benchmark reports the ungrounded answers (node tools/bench.mjs --ground) before anything on the page acts on it.
const STOP = new Set(('a an the and or but of to for in on at by with from into onto about as is are was were be been being am do does did ' +
  'i me my mine you your yours we our us it its this that these those there here what which who whom whose when where why how ' +
  'can could would should will shall may might must please pls show tell give get make find let lets need want like just some any ' +
  'all one two me up out over under than then so if not no yes ok okay hey hi void now today tonight right really very much many ' +
  'more most less little bit thing things stuff something anything again also too new old good best quick quickly ' +
  // verbs and asking words: they say what to do, not what the answer is about
  'explain work works working have has had got open chat send play take took reach check create test turn save load redo hire offer ' +
  'see know look go going start use set put keep add help try ask say said tell bring move learn teach long bad high low strong ' +
  'recent next last public first lets let whats thats im ive dont doesnt cant should would could').split(' '));

// numbers compare as numbers: "$20,000" and "20000", "300k" and "300,000", "12x14" and "12 × 14"; apostrophes go ("what's" is "whats")
const norm = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/\b(\d+(?:\.\d+)?)k\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000))).replace(/(\d)\.0+\b/g, '$1').replace(/['\u2019]/g, ''); // and 45.00 is 45
const stem = (w) => w.replace(/(?:ies)$/, 'y').replace(/(?:ing|ed|es|s)$/, '') || w;
export const words = (t) => norm(t).match(/[a-z]+|\d+(?:\.\d+)?/g) || [];

/** a skill's trigger words, read off its own asks: the words in at least `share` of them (at least 3 asks), stemmed. Pure. */
export function triggersFrom(asks, share = 0.25) {
  const list = (Array.isArray(asks) ? asks : []).map((a) => new Set(words(a).map(stem)));
  const count = new Map();
  for (const s of list) for (const w of s) count.set(w, (count.get(w) || 0) + 1);
  const min = Math.max(3, Math.ceil(list.length * share));
  return new Set([...count].filter(([, n]) => n >= min).map(([w]) => w));
}

/** what the ask is about: its words minus the small words and the skill's triggers, 3+ letters or a number, stemmed and unique */
export function subjectOf(ask, triggers = new Set()) {
  const out = [];
  for (const w of words(ask)) {
    const s = stem(w);
    if (STOP.has(w) || STOP.has(s) || triggers.has(s) || (w.length < 3 && !/^\d+$/.test(w))) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

// one letter changed, added or dropped (and nothing else): a typo, not another word
function oneOff(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1 || b.length < 5) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (x, y) => x.slice(i + 1) === y.slice(i + (a.length === b.length ? 1 : 0));
  return a.length === b.length ? rest(a, b) : a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** does the card show the subject? { subject, found, missing, ok }: ok when the ask has no subject (nothing to judge), or when
 *  at least half of its words are on the card (lenient on purpose: a false alarm costs more than a miss here). A word counts when the card has a
 *  word that starts with its stem (bread -> "breads", banana -> "bananas"). Pure. */
export function grounded(ask, cardText, triggers = new Set()) {
  const subject = subjectOf(ask, triggers);
  const shown = new Set(words(cardText).map(stem)), seen = [...shown];
  // a word one letter off what the card says is that word ("calender" on a CALENDAR card), for words of 5 letters or more
  const has = (s) => shown.has(s) || (s.length >= 4 && seen.some((w) => w.startsWith(s))) || (s.length >= 5 && seen.some((w) => oneOff(s, w)));
  const found = subject.filter(has), missing = subject.filter((s) => !has(s));
  const need = Math.ceil(subject.length / 2);
  return { subject, found, missing, ok: !subject.length || found.length >= need };
}

/** a skill's trigger words on the page, where only its own examples are at hand: its name's words and the words in at least two
 *  of its examples (so "recipe" in "recipe for pancakes" and "lasagna recipe"). Pure. */
export function skillTriggers(skill) {
  const t = triggersFrom((skill && skill.examples) || [], 0);
  const list = ((skill && skill.examples) || []).map((a) => new Set(words(a).map(stem)));
  const count = new Map(); for (const s of list) for (const w of s) count.set(w, (count.get(w) || 0) + 1);
  for (const [w, n] of count) if (n >= 2) t.add(w);
  // an example that is one word on its own ("agenda") is the skill's own word for itself
  for (const a of ((skill && skill.examples) || [])) { const ws = words(a); if (ws.length === 1) t.add(stem(ws[0])); }
  for (const w of words(String((skill && skill.name) || '').replace(/-/g, ' '))) t.add(stem(w));
  return t;
}

/** the page's check (void.html, after a skill draws a card): { unmet, subject, missing }. Stricter than the benchmark's on purpose:
 *  only a card that shows none of the ask's subject is unmet, so what reaches the miss list is a card about something else. */
// A skill that looks a named thing up (refuseUngrounded: true, as the recipe skill does) refuses a card about something else
// (Adam's incident card, 2026-10-30: "how do i make guacamole" got a pancakes card, reported only quietly). Every other skill is
// reported quietly as before: a tip card for "calculate a 20% tip on 45" shows none of "calculate", and refusing it would be wrong.
export function judgeCard(ask, cardText, skill) {
  const g = grounded(ask, cardText, skillTriggers(skill));
  const unmet = g.subject.length > 0 && g.found.length === 0;
  return { unmet, refuse: unmet && !!(skill && skill.refuseUngrounded), subject: g.subject, missing: g.missing };
}
/** the line said in place of a refused card: what was asked, what the card was about, that the miss is noted. Pure. */
export function refusalLine(ask, missing, title) {
  const want = (Array.isArray(missing) && missing.length ? missing.join(' ') : String(ask || '')).trim();
  const was = String(title || '').trim().slice(0, 60);
  return 'I don\'t have ' + want + ' yet' + (was ? ': the card I found was ' + was + ', so I did not show it' : '') + '. I\'ve noted it, so I can learn it.';
}
