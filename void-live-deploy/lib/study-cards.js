// Pure logic of the study cards (tools pack 7, owner 2026-10-18: flashcards, spaced repeat, quiz from a list, definition card,
// language drill, code snippet card, algorithm steps card, formula card, cite-as stub, glossary builder). No document in here.

export const MAX_CARDS = 60;
export const MAX_STEPS = 24;
/** days until a card comes back, by the box it lands in (box 1 = today again, box 5 = the longest wait) */
export const INTERVALS = [0, 0, 1, 2, 4, 8];

const tidy = (s) => String(s == null ? '' : s).trim().replace(/[ \t]+/g, ' ');
const LEAD = '(?:please\\s+)?(?:(?:make|build|create|start|give|set\\s+up|show|open)\\s+(?:me\\s+)?(?:a\\s+|an\\s+|my\\s+|the\\s+|some\\s+)?(?:set\\s+of\\s+)?)?';
const FOR = '(?:\\s+(?:for|on|about|of|in)\\s+(.{1,40}?))?';

/** one "front = back" pair out of a line, or null. The first separator wins (= => -> → — – " - " :). Pure. */
export function splitPair(s) {
  const m = /\s*(=>|->|→|=|—|–|\s-\s|:)\s*/.exec(String(s || ''));
  if (!m) return null;
  const q = tidy(String(s).slice(0, m.index)), a = tidy(String(s).slice(m.index + m[0].length));
  return q && a ? { q: q.slice(0, 120), a: a.slice(0, 240) } : null;
}

/** every pair in a body: split on ; or new lines, or on commas when every comma part is a pair itself. Pure. */
export function parsePairs(body) {
  const text = String(body || '').trim();
  let parts = text.split(/\s*(?:;|\n)\s*/).filter(Boolean);
  if (parts.length === 1 && text.includes(',')) {
    const cs = text.split(/\s*,\s*/).filter(Boolean);
    if (cs.length > 1 && cs.every((c) => splitPair(c))) parts = cs;
  }
  return parts.map(splitPair).filter(Boolean).slice(0, MAX_CARDS);
}

/** the numbered steps of "1. a 2. b" or "a; b" or lines. Pure. */
export function parseSteps(body) {
  return String(body || '').split(/\s*(?:;|\n|(?:^|\s)\d{1,2}[.)]\s+)\s*/).map((s) => tidy(s).replace(/^\d{1,2}[.)]\s*/, '')).filter(Boolean).map((s) => s.slice(0, 160)).slice(0, MAX_STEPS);
}

const CITE_STYLES = ['apa', 'mla', 'chicago'];

/**
 * What a study ask means, or null. { mode: 'flash'|'drill'|'quiz'|'glossary'|'glossary-add'|'card-add'|'define'|'code'|'algo'|'formula'|'cite', ... }
 * Every shape needs its colon and its content: "what are flashcards" and "cite this as APA" are left to others. Pure.
 */
export function parseStudy(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 4000) return null;
  let m;
  if ((m = new RegExp('^' + LEAD + '(?:flash\\s?cards?|study\\s+cards?)' + FOR + '\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const pairs = parsePairs(m[2]); return pairs.length ? { mode: 'flash', title: tidy(m[1]), pairs } : null;
  }
  const topic = flashTopic(t);
  if (topic) {
    const deck = STARTER_DECKS[starterKey(topic)];
    return deck ? { mode: 'flash', title: deck.title, note: deck.note, pairs: deck.pairs.map(([q, a]) => ({ q, a })) } : { mode: 'flash', title: tidy(topic).slice(0, 40), pairs: [] };
  }
  if ((m = new RegExp('^' + LEAD + '(?:language|vocab(?:ulary)?|translation|word)\\s+(?:drill|practice)' + FOR + '\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const pairs = parsePairs(m[2]); return pairs.length ? { mode: 'drill', title: tidy(m[1]), pairs } : null;
  }
  if ((m = new RegExp('^' + LEAD + 'quiz\\s+(?:me\\s+)?from\\s+(?:a\\s+|my\\s+|this\\s+|the\\s+)?list' + FOR + '\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const pairs = parsePairs(m[2]); return pairs.length ? { mode: 'quiz', title: tidy(m[1]), pairs } : null;
  }
  if ((m = /^(?:please\s+)?add\s+(?:a\s+)?(?:flash\s?)?cards?\s*:\s*([\s\S]+)$/i.exec(t))) {
    const pairs = parsePairs(m[1]); return pairs.length ? { mode: 'card-add', pairs } : null;
  }
  if ((m = /^(?:please\s+)?add\s+to\s+(?:the\s+|my\s+)?glossary\s*:\s*([\s\S]+)$/i.exec(t))) {
    const pairs = parsePairs(m[1]); return pairs.length ? { mode: 'glossary-add', pairs } : null;
  }
  if ((m = new RegExp('^' + LEAD + 'glossary' + FOR + '\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const pairs = parsePairs(m[2]); return pairs.length ? { mode: 'glossary', title: tidy(m[1]), pairs } : null;
  }
  if (/^(?:please\s+)?(?:open\s+|start\s+|make\s+|build\s+|show\s+)?(?:a\s+|the\s+|my\s+)?glossary\s+builder$/i.test(t)) return { mode: 'glossary', title: '', pairs: [] };
  if ((m = new RegExp('^' + LEAD + '(?:definition|define)\\s+card\\s+(?:for|of)\\s+(.{1,60}?)\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) return { mode: 'define', term: tidy(m[1]), def: tidy(m[2]).slice(0, 600) };
  if ((m = new RegExp('^' + LEAD + '(?:definition|define)\\s+card\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const p = splitPair(m[1]); return p ? { mode: 'define', term: p.q, def: p.a } : null;
  }
  if ((m = new RegExp('^' + LEAD + '(?:([a-z+#]{1,12})\\s+)?(?:code|snippet)\\s+(?:snippet\\s+)?card' + '(?:\\s+(?:for|of)\\s+(.{1,60}?))?\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const code = m[3].replace(/^\s*\n/, '').replace(/\s+$/, '');
    return code ? { mode: 'code', lang: (m[1] || '').toLowerCase(), name: tidy(m[2]), code: code.slice(0, 3000) } : null;
  }
  if ((m = new RegExp('^' + LEAD + 'algorithm(?:\\s+steps)?\\s+card' + '(?:\\s+(?:for|of)\\s+(.{1,60}?))?\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const steps = parseSteps(m[2]); return steps.length ? { mode: 'algo', name: tidy(m[1]), steps } : null;
  }
  if ((m = new RegExp('^' + LEAD + 'formula\\s+card' + '(?:\\s+(?:for|of)\\s+(.{1,60}?))?\\s*:\\s*([\\s\\S]+)$', 'i').exec(t))) {
    const parts = m[2].split(/\s+where\s+/i), expr = tidy(parts[0]).slice(0, 160);
    return expr ? { mode: 'formula', name: tidy(m[1]), expr, legend: parseLegend(parts.slice(1).join(' ')) } : null;
  }
  if ((m = /^cite(?:\s+this)?(?:\s+as)?(?:\s+(apa|mla|chicago))?\s*:\s*([\s\S]+)$/i.exec(t))) {
    const c = parseCite(m[2]); return c ? { mode: 'cite', style: (m[1] || 'apa').toLowerCase(), cite: c } : null;
  }
  if ((m = /^cite\s+([\s\S]+?)\s+as\s+(apa|mla|chicago)$/i.exec(t))) {
    if (/^(?:this|that|it|these|them|the\s+following)$/i.test(m[1].trim())) return null; // "cite this as APA" names nothing
    const c = parseCite(m[1]); return c ? { mode: 'cite', style: m[2].toLowerCase(), cite: c } : null;
  }
  return null;
}

/** "E energy, m mass, c speed of light" or "E is energy; m is mass" to [{ sym, means }]. Pure. */
export function parseLegend(s) {
  const out = [];
  for (const part of String(s || '').split(/\s*(?:;|,|\band\b|\n)\s*/i)) {
    const m = /^([^\s=]{1,12})\s*(?:=|is|:|-|–)?\s+(.{1,80})$/i.exec(part.trim());
    if (m) out.push({ sym: m[1], means: tidy(m[2]).replace(/^(?:is|=)\s+/i, '') });
  }
  return out.slice(0, 12);
}

// ---- cite as -----------------------------------------------------------------------------------

/** { title, author, year, url } out of "Title by Author, 2020, https://x" or "Title, Author, 2020"; null without a title. Pure. */
export function parseCite(body) {
  let s = String(body || '').trim();
  const out = { title: '', author: '', year: '', url: '' };
  const u = /https?:\/\/\S+/i.exec(s);
  if (u) { out.url = u[0].replace(/[.,;)\]]+$/, ''); s = s.replace(u[0], ' '); }
  const y = /\b(1[5-9]\d\d|20\d\d)\b/.exec(s);
  if (y) { out.year = y[1]; s = s.replace(y[0], ' '); }
  const clean = (x) => String(x || '').replace(/^[\s,;.|()"'“”‘’]+|[\s,;.|()"'“”‘’]+$/g, '').replace(/\s+/g, ' ');
  const by = /^(.*?)\s+by\s+(.+)$/i.exec(s);
  if (by) { out.title = clean(by[1]); out.author = clean(by[2]); } else {
    const parts = s.split(/\s*[|;,]\s*/).map(clean).filter(Boolean);
    out.title = parts[0] || ''; out.author = parts[1] || '';
  }
  return out.title ? { title: out.title.slice(0, 160), author: out.author.slice(0, 80), year: out.year, url: out.url.slice(0, 300) } : null;
}

function nameParts(author) {
  const a = tidy(author);
  if (!a || /,| and | & /i.test(a)) return null;
  const w = a.split(' ');
  return w.length > 1 ? { last: w[w.length - 1], first: w.slice(0, -1) } : null;
}

/** the reference text in one style; a stub: the reader checks it against the style guide. Pure. */
export function formatCite(c, style) {
  const st = CITE_STYLES.includes(style) ? style : 'apa', np = nameParts(c.author);
  const year = c.year || 'n.d.', end = (x) => (/[.!?]$/.test(x) ? x : x + '.');
  if (st === 'apa') {
    const a = np ? np.last + ', ' + np.first.map((f) => f.charAt(0).toUpperCase() + '.').join(' ') : c.author;
    return (a ? end(a) + ' ' : '') + '(' + year + '). ' + end(c.title) + (c.url ? ' ' + c.url : '');
  }
  const a = np ? np.last + ', ' + np.first.join(' ') : c.author;
  if (st === 'mla') return (a ? end(a) + ' ' : '') + '“' + end(c.title) + '” ' + (c.year || 'n.d.') + (c.url ? ', ' + c.url : '') + '.';
  return (a ? end(a) + ' ' : '') + end(c.title) + ' ' + end(year) + (c.url ? ' ' + end(c.url) : '');
}

// ---- the deck: boxes, due days, typed answers ------------------------------------------------------

/** a calendar day as YYYY-MM-DD in local time. Pure. */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
const toNum = (key) => { const [y, m, d] = String(key).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
/** a day key plus n days. Pure. */
export function addDays(key, n) {
  const d = new Date((toNum(key) + n) * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
export const daysBetween = (a, b) => toNum(b) - toNum(a);

export const newCard = (q, a, today) => ({ q, a, box: 1, due: today, cool: 0 });

/** the card after an answer: right moves it up a box and out by that box's wait, wrong sends it to box 1, due today. Pure. */
export function grade(card, good, today, tick = 0) {
  const box = good ? Math.min(5, (card.box || 1) + 1) : 1;
  return { ...card, box, due: addDays(today, good ? INTERVALS[box] : 0), cool: tick, last: today };
}

/** the cards due today or earlier. Pure. */
export const dueCards = (cards, today) => (cards || []).filter((c) => c && c.due <= today);

/** the card to show now: due ones, the ones answered longest ago first, then the lowest box; null when none is due. Pure. */
export function nextCard(cards, today) {
  const due = (cards || []).map((c, i) => ({ c, i })).filter((x) => x.c && x.c.due <= today);
  due.sort((a, b) => (a.c.cool || 0) - (b.c.cool || 0) || (a.c.box || 1) - (b.c.box || 1) || a.i - b.i);
  return due.length ? due[0].i : -1;
}

/** the soonest day a card comes back after today, or '' . Pure. */
export function nextDueDay(cards, today) {
  const later = (cards || []).map((c) => c.due).filter((d) => d > today).sort();
  return later[0] || '';
}

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return d[b.length];
}
/** does a typed answer match the card's answer (any "a / b" variant)? Accents, case and punctuation are ignored; one slip is forgiven in words of 5+ letters. Pure. */
export function checkAnswer(typed, answer) {
  const got = fold(typed);
  if (!got) return { ok: false, exact: false };
  for (const v of String(answer || '').split(/\s*\/\s*/)) {
    const want = fold(v);
    if (!want) continue;
    if (got === want) return { ok: true, exact: true };
    if (want.length >= 5 && lev(got, want) <= 1) return { ok: true, exact: false };
  }
  return { ok: false, exact: false };
}

/** a deck thing out of a parsed ask. Pure. */
export function deckOf(p, today) {
  return { mode: p.mode === 'quiz' ? 'flash' : p.mode, typed: p.mode === 'drill' || p.mode === 'quiz', dir: 'fwd', title: p.title || (p.mode === 'drill' ? 'Language drill' : p.mode === 'quiz' ? 'Quiz' : 'Flashcards'),
    note: p.note || '', cards: p.pairs.map((x) => newCard(x.q, x.a, today)), reviews: 0, rev: false, res: null };
}

/**
 * The topic of "make flashcards for spanish verbs" or "spanish verb flashcards", an ask with no colon and no pairs, or ''.
 * "what are flashcards" and "best flashcard app for ..." name no deck to make. Pure.
 */
export function flashTopic(text) {
  const t = tidy(text).replace(/[?!.]+$/, '');
  const m = /^(?:please\s+)?(?:(?:make|build|create|give|show|start)\s+(?:me\s+)?(?:a\s+|some\s+|the\s+)?(?:set\s+of\s+|deck\s+of\s+)?)?(?:flash\s?cards?|study\s+cards?|a\s+flash\s?card\s+deck)\s+(?:for|on|about|of)\s+(.{2,60})$/i.exec(t)
    || /^(?:please\s+)?(?:make|build|create|give|show|start)\s+(?:me\s+)?(?:a\s+|some\s+)?(.{2,40}?)\s+(?:flash\s?cards?|flash\s?card\s+deck|study\s+cards?)$/i.exec(t);
  if (!m) {
    // a bare "spanish verb flashcards" counts only when Verse ships that deck, so "what are flashcards" is never a deck
    const b = /^(.{2,40}?)\s+flash\s?cards?$/i.exec(t);
    return b && STARTER_DECKS[starterKey(b[1])] ? b[1] : '';
  }
  if (/[:=]/.test(m[1])) return '';
  const q = m[1].replace(/^(?:the|my|some|a|an)\s+/i, '').trim();
  return /^(?:me|you|it|this|that|them|us|anything|something|everything)$/i.test(q) ? '' : q;
}

/** "Spanish verb", "common spanish verbs", "the basic Spanish verbs" all to "spanish verbs". Pure. */
export function starterKey(topic) {
  return tidy(topic).toLowerCase().replace(/^(?:the|some|common|basic|everyday|simple|useful|beginner|most\s+used)\s+/g, '').replace(/\bverb\b/, 'verbs').replace(/\s+/g, ' ');
}

/** Decks Verse ships with, so an ask that names one of these topics gets real cards (infinitive on the front, English on the back). */
export const STARTER_DECKS = {
  'spanish verbs': { title: 'Spanish verbs', note: 'A starter deck Verse ships with: the Spanish infinitive on the front, the English on the back.', pairs: [
    ['ser', 'to be (what something is)'], ['estar', 'to be (a state or a place)'], ['tener', 'to have'], ['hacer', 'to do, to make'], ['ir', 'to go'],
    ['poder', 'to be able to, can'], ['decir', 'to say, to tell'], ['dar', 'to give'], ['ver', 'to see'], ['saber', 'to know (a fact)'],
    ['conocer', 'to know (a person or a place)'], ['querer', 'to want, to love'], ['llegar', 'to arrive'], ['pasar', 'to pass, to happen'], ['deber', 'must, to owe'],
    ['poner', 'to put'], ['parecer', 'to seem'], ['quedar', 'to stay, to remain'], ['creer', 'to believe'], ['hablar', 'to speak'],
    ['llevar', 'to carry, to wear'], ['dejar', 'to leave, to let'], ['seguir', 'to follow, to continue'], ['encontrar', 'to find'], ['llamar', 'to call'],
    ['venir', 'to come'], ['pensar', 'to think'], ['salir', 'to go out, to leave'], ['volver', 'to return'], ['tomar', 'to take, to drink'],
    ['vivir', 'to live'], ['sentir', 'to feel'], ['comer', 'to eat'], ['trabajar', 'to work'], ['escribir', 'to write']] },
  'french verbs': { title: 'French verbs', note: 'A starter deck Verse ships with: the French infinitive on the front, the English on the back.', pairs: [
    ['\u00eatre', 'to be'], ['avoir', 'to have'], ['faire', 'to do, to make'], ['aller', 'to go'], ['dire', 'to say, to tell'],
    ['pouvoir', 'to be able to, can'], ['vouloir', 'to want'], ['savoir', 'to know (a fact)'], ['conna\u00eetre', 'to know (a person or a place)'], ['voir', 'to see'],
    ['venir', 'to come'], ['devoir', 'must, to have to'], ['prendre', 'to take'], ['trouver', 'to find'], ['donner', 'to give'],
    ['parler', 'to speak'], ['mettre', 'to put'], ['passer', 'to pass, to spend (time)'], ['croire', 'to believe'], ['penser', 'to think'],
    ['partir', 'to leave'], ['manger', 'to eat'], ['finir', 'to finish'], ['aimer', 'to like, to love'], ['\u00e9crire', 'to write'], ['vivre', 'to live']] },
};

/** a glossary's entries, A to Z, one per term (a later definition replaces an earlier one). Pure. */
export function glossaryAdd(entries, add) {
  const map = new Map((entries || []).map((e) => [e.t.toLowerCase(), e]));
  for (const p of add) map.set(p.q.toLowerCase(), { t: p.q, d: p.a });
  return [...map.values()].sort((a, b) => a.t.localeCompare(b.t, undefined, { sensitivity: 'base' })).slice(0, 200);
}
