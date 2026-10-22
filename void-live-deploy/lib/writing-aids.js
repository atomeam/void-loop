// Writing aids (owner's list, 2026-10-18, tools pack 6): shorten, bullets, numbered steps, sentence case, filler words, unique
// words, reading level, outline from headings, reverse outline, synonym suggestions. Pure, list-based, no network, nothing sent anywhere.
// The skill (skills/writing-aids.js) puts them on one stage card with a mode for each. Run: node --test tools/writing-aids.test.mjs
import { syllables } from '../skills/util.js';

export const MODES = ['shorten', 'bullets', 'steps', 'sentence', 'title', 'filler', 'unique', 'level', 'outline', 'reverse', 'synonyms', 'proofread', 'thread'];
export const MODE_LABEL = { shorten: 'Shorten', bullets: 'Bullets', steps: 'Steps', sentence: 'Sentence case', title: 'Title Case', filler: 'No filler', unique: 'Unique words', level: 'Reading level', outline: 'Outline', reverse: 'Reverse outline', synonyms: 'Synonyms' , proofread: 'Proofread', thread: 'Thread' };
export const MAX_TEXT = 4000;

/** a pasted multi-line ask comes through the box with " ⏎ " for each line break; put the breaks back. Pure. */
export const unflat = (s) => String(s == null ? '' : s).replace(/\s*⏎\s*/g, '\n');

/** the sentences of a text (end marks stay off). Pure. */
export function sentencesOf(text) {
  return unflat(text).replace(/\r/g, '').split(/(?<=[.!?])["')\]]?\s+|\n+/).map((s) => s.trim().replace(/[.!?]+["')\]]?$/, '').trim()).filter(Boolean);
}
export const wordsOf = (text) => (unflat(text).toLowerCase().match(/[a-z0-9À-ɏ]+(?:['’][a-z]+)*/g) || []);
const cap = (s) => s.replace(/^(\W*)(\p{L})/u, (_, a, c) => a + c.toUpperCase());
const squeeze = (s) => s.replace(/[ \t]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/,+([.!?])/g, '$1').replace(/([,;:])(?:\s*[,;:])+/g, '$1').replace(/^[\s,;:]+/, '').trim();

// ---- shorten and filler ----
const WORDY = [ // long phrase -> short one ("" drops it)
  [/\bin order to\b/gi, 'to'], [/\bdue to the fact that\b/gi, 'because'], [/\bowing to the fact that\b/gi, 'because'], [/\bin spite of the fact that\b/gi, 'although'],
  [/\bat this point in time\b/gi, 'now'], [/\bat the present time\b/gi, 'now'], [/\bin the event that\b/gi, 'if'], [/\bfor the purpose of\b/gi, 'for'],
  [/\bwith regard to\b/gi, 'about'], [/\bwith respect to\b/gi, 'about'], [/\bin regard to\b/gi, 'about'], [/\bin relation to\b/gi, 'about'],
  [/\ba large number of\b/gi, 'many'], [/\ba majority of\b/gi, 'most'], [/\ba number of\b/gi, 'several'], [/\bthe vast majority of\b/gi, 'most'],
  [/\bin the near future\b/gi, 'soon'], [/\bprior to\b/gi, 'before'], [/\bsubsequent to\b/gi, 'after'], [/\bin close proximity to\b/gi, 'near'],
  [/\bhas the ability to\b/gi, 'can'], [/\bis able to\b/gi, 'can'], [/\bare able to\b/gi, 'can'], [/\bis in a position to\b/gi, 'can'],
  [/\bit is important to note that\s*/gi, ''], [/\bit should be noted that\s*/gi, ''], [/\bit is worth noting that\s*/gi, ''], [/\bneedless to say,?\s*/gi, ''],
  [/\bas a matter of fact,?\s*/gi, ''], [/\bthe fact that\b/gi, 'that'], [/\bin my opinion,?\s*/gi, ''], [/\bI think that\b/g, 'I think'],
  [/\bfor the reason that\b/gi, 'because'], [/\bin the process of\b/gi, ''], [/\bon a daily basis\b/gi, 'daily'], [/\bon a regular basis\b/gi, 'regularly'],
  [/\bat the end of the day,?\s*/gi, ''], [/\bwhether or not\b/gi, 'whether'], [/\bin addition to\b/gi, 'besides'], [/\bis going to\b/gi, 'will'],
  [/\bmake a decision\b/gi, 'decide'], [/\btake into consideration\b/gi, 'consider'], [/\bgive consideration to\b/gi, 'consider'], [/\bcome to the conclusion\b/gi, 'conclude'],
  [/\bconduct an investigation into\b/gi, 'investigate'], [/\bdespite the fact that\b/gi, 'although'], [/\bin the absence of\b/gi, 'without'], [/\bin light of the fact that\b/gi, 'since'],
];
// words that add nothing in most sentences; "like", "well" and "so" only count where they are clearly filler
export const FILLERS = ['um', 'uh', 'er', 'hmm', 'basically', 'actually', 'literally', 'really', 'very', 'just', 'totally', 'simply', 'honestly', 'frankly',
  'obviously', 'clearly', 'definitely', 'absolutely', 'quite', 'rather', 'somewhat', 'essentially', 'virtually', 'practically', 'kind of', 'sort of', 'you know',
  'i mean', 'you see', 'i guess', 'in fact', 'of course', 'at all', 'to be honest', 'to be fair', 'as such'];
const FILLER_RE = new RegExp('(?:^|(?<=[\\s,;(]))(?:' + FILLERS.slice().sort((a, b) => b.length - a.length).map((f) => f.replace(/ /g, '\\s+')).join('|') + ')(?=[\\s,.;:!?)]|$)[,]?', 'gi');
const LEAD_RE = /(^|[.!?]\s+|\n)(?:well|so|like|anyway|okay|ok|right)\s*,\s*/gi;
const COMMA_LIKE = /,\s*like\s*,|(?<=\s)like,\s*/gi;

function tidyText(s) {
  return s.split('\n').map((line) => squeeze(line).replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a, c) => a + c.toUpperCase()).replace(/^(\p{Ll})/u, (c) => c.toUpperCase())).join('\n');
}

/** drop the list-based filler words; returns { text, removed: [..] }. Pure. */
export function removeFiller(text) {
  const removed = [];
  let s = unflat(text).replace(/\r/g, '');
  s = s.replace(COMMA_LIKE, ',').replace(LEAD_RE, (m, a) => { removed.push(m.slice(a.length).replace(/[\s,]+$/, '').toLowerCase()); return a; });
  s = s.replace(FILLER_RE, (m) => { removed.push(m.replace(/[,\s]+$/, '').toLowerCase().replace(/\s+/g, ' ')); return ''; });
  return { text: tidyText(s), removed };
}

/** a tighter version: wordy phrases swapped for short ones, then the filler words dropped; { text, before, after }. Pure. */
export function shorten(text) {
  let s = unflat(text).replace(/\r/g, '');
  for (const [re, to] of WORDY) s = s.replace(re, to);
  const f = removeFiller(s);
  const out = f.text;
  return { text: out, before: wordsOf(text).length, after: wordsOf(out).length };
}

// ---- bullets and steps ----
function pieces(text) {
  const sents = sentencesOf(text);
  if (sents.length > 1) return sents;
  const one = sents[0] || '';
  const semi = one.split(/\s*;\s*/).filter(Boolean);
  if (semi.length > 1) return semi;
  const commas = one.replace(/^[^:]*:\s*/, '').split(/\s*,\s*(?:and\s+|or\s+)?|\s+and\s+(?=\S+\s*$)/i).filter(Boolean);
  return commas.length >= 3 ? commas : [one].filter(Boolean);
}

/** a paragraph as "- " bullets, one idea each. Pure. */
export function bulletize(text) { return pieces(text).map((p) => '- ' + cap(p)).join('\n'); }

const STEP_LEAD = /^(?:and\s+)?(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|next|then|after\s+that|afterwards?|finally|lastly|last|once\s+(?:that(?:'s| is)\s+done|done)|now)\b[,:]?\s*/i;
/** prose as numbered steps; "first", "then", "finally" lead-ins are dropped, since the numbers say it. Pure. */
export function numberSteps(text) {
  const split = unflat(text).replace(/\r/g, '').replace(/,?\s+(?:and\s+)?(?:then|after\s+that|afterwards?|next|finally|lastly)[,\s]+/gi, '. ');
  return sentencesOf(split).map((p) => cap(p.replace(STEP_LEAD, '').replace(/^and\s+/i, '').trim())).filter(Boolean).map((p, i) => (i + 1) + '. ' + p).join('\n');
}

// ---- case ----
const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'via', 'vs']);
/** Title Case, small words kept small unless they open or close the title. Pure. */
export function titleCase(text) {
  const w = unflat(text).toLowerCase().split(/(\s+)/), last = w.length - 1;
  return w.map((x, i) => (i && i !== last && SMALL.has(x)) ? x : x.replace(/^\P{L}*\p{L}/u, (c) => c.toUpperCase())).join('');
}

/** Sentence case: the first word of each sentence and "I" capitalised; acronyms and CamelCase words stay; text shouted in
 *  capitals is lower-cased first. Pure. */
export function sentenceCase(text) {
  const raw = unflat(text).replace(/\r/g, '');
  const letters = raw.replace(/[^\p{L}]/gu, ''), upper = letters.replace(/[^\p{Lu}]/gu, '');
  const shouting = letters.length > 3 && upper.length / letters.length > 0.6;
  const keep = (w) => /^\p{Lu}{2,4}$/u.test(w) && !shouting ? true : /\p{Ll}\p{Lu}/u.test(w);
  let s = raw.replace(/[\p{L}][\p{L}'’]*/gu, (w) => (keep(w) ? w : w.toLowerCase()));
  s = s.replace(/\bi\b(?=['’]|\s|[,.;!?]|$)/g, 'I');
  s = s.replace(/(^|[.!?]["')\]]?\s+|\n\s*)(\P{L}*)(\p{Ll})/gu, (_, a, b, c) => a + b + c.toUpperCase());
  return s;
}

// ---- counts and level ----
/** unique-word facts: total, unique, share, the most repeated words. Pure. */
export function uniqueWords(text) {
  const ws = wordsOf(text), counts = new Map();
  for (const w of ws) counts.set(w, (counts.get(w) || 0) + 1);
  const top = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5);
  return { total: ws.length, unique: counts.size, share: ws.length ? Math.round((counts.size / ws.length) * 100) : 0, top };
}

const BANDS = [[90, 'very easy', '5th grade'], [80, 'easy', '6th grade'], [70, 'fairly easy', '7th grade'], [60, 'plain English', '8th to 9th grade'], [50, 'fairly difficult', '10th to 12th grade'], [30, 'difficult', 'college'], [-Infinity, 'very difficult', 'college graduate']];
/** Flesch reading ease and the Flesch-Kincaid grade, with the plain-English band; null under 5 words. Pure. */
export function readingLevel(text) {
  const ws = wordsOf(text), sn = Math.max(1, sentencesOf(text).length);
  if (ws.length < 5) return null;
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  const ease = 206.835 - 1.015 * (ws.length / sn) - 84.6 * (syl / ws.length);
  const grade = 0.39 * (ws.length / sn) + 11.8 * (syl / ws.length) - 15.59;
  const band = BANDS.find(([min]) => ease >= min);
  return { ease: Math.round(ease), grade: Math.max(0, Math.round(grade * 10) / 10), label: band[1], who: band[2], words: ws.length, sentences: sn };
}

// ---- outlines ----
/** the headings of a text ("# Intro", "## Why", "1.2 Detail", or inline "# A ## B") as an indented, numbered outline. Pure. */
export function outlineFromHeadings(text) {
  const lines = unflat(text).replace(/\r/g, '').replace(/(\S)\s+(#{1,6}\s)/g, '$1\n$2').split('\n');
  const heads = [];
  for (const raw of lines) {
    const line = raw.trim();
    let m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (m) { heads.push({ level: m[1].length, text: m[2] }); continue; }
    m = /^(\d+(?:\.\d+)*)[.)]?\s+(\S.*)$/.exec(line);
    if (m) heads.push({ level: m[1].split('.').length, text: m[2] });
  }
  if (!heads.length) return '';
  const base = Math.min(...heads.map((h) => h.level)), counters = [];
  return heads.map((h) => {
    const depth = Math.min(5, Math.max(0, h.level - base));
    counters.length = depth + 1;
    for (let i = 0; i < depth; i++) counters[i] = counters[i] || 1;
    counters[depth] = (counters[depth] || 0) + 1;
    return '  '.repeat(depth) + counters.slice(0, depth + 1).join('.') + ' ' + h.text;
  }).join('\n');
}

/** one line of gist for a paragraph: its first sentence, cut to about 12 words. Pure. */
export function gistOf(par) {
  const first = sentencesOf(par)[0] || '';
  const w = first.split(/\s+/);
  return w.length > 12 ? w.slice(0, 12).join(' ') + '…' : first; // ellipsis-ok: drawn picture or short label, the full text is on the card
}
/** a reverse outline: the gist of each paragraph (or of each sentence when the text is one paragraph). Pure. */
export function reverseOutline(text) {
  const t = unflat(text).replace(/\r/g, '').trim();
  let parts = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = t.split('\n').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = sentencesOf(t);
  return parts.map((p, i) => (i + 1) + '. ' + cap(gistOf(p))).filter((l) => /\w/.test(l)).join('\n');
}

// ---- synonyms (a local list of the words that get overused) ----
export const SYN = {
  good: ['fine', 'solid', 'strong', 'sound', 'excellent'], bad: ['poor', 'weak', 'awful', 'faulty', 'harmful'], big: ['large', 'huge', 'sizable', 'major', 'vast'], small: ['little', 'tiny', 'compact', 'minor', 'slight'],
  happy: ['glad', 'pleased', 'cheerful', 'content', 'delighted'], sad: ['unhappy', 'down', 'gloomy', 'sorrowful', 'blue'], important: ['key', 'vital', 'crucial', 'central', 'significant'], easy: ['simple', 'effortless', 'plain', 'light', 'smooth'],
  hard: ['difficult', 'tough', 'demanding', 'tricky', 'firm'], fast: ['quick', 'rapid', 'swift', 'brisk', 'speedy'], slow: ['gradual', 'unhurried', 'sluggish', 'steady', 'leisurely'], nice: ['pleasant', 'kind', 'lovely', 'agreeable', 'friendly'],
  said: ['stated', 'replied', 'noted', 'remarked', 'added'], get: ['obtain', 'gain', 'fetch', 'receive', 'earn'], got: ['obtained', 'gained', 'received', 'earned', 'fetched'], make: ['create', 'build', 'form', 'produce', 'craft'],
  use: ['apply', 'employ', 'use up', 'draw on', 'work with'], show: ['reveal', 'display', 'present', 'demonstrate', 'point out'], help: ['aid', 'assist', 'support', 'back', 'serve'], think: ['believe', 'consider', 'reckon', 'suppose', 'judge'],
  idea: ['notion', 'concept', 'thought', 'plan', 'proposal'], thing: ['item', 'object', 'matter', 'element', 'detail'], start: ['begin', 'launch', 'open', 'kick off', 'set off'], end: ['finish', 'close', 'conclude', 'stop', 'wrap up'],
  look: ['glance', 'peek', 'view', 'inspect', 'study'], walk: ['stroll', 'stride', 'wander', 'amble', 'trek'], run: ['sprint', 'dash', 'jog', 'race', 'operate'], tell: ['inform', 'notify', 'say to', 'advise', 'let know'],
  need: ['require', 'want', 'call for', 'lack', 'depend on'], want: ['wish', 'desire', 'crave', 'long for', 'seek'], keep: ['hold', 'retain', 'save', 'maintain', 'store'], give: ['offer', 'hand', 'provide', 'grant', 'supply'],
  very: ['highly', 'truly', 'deeply', 'especially', 'extremely'], really: ['truly', 'genuinely', 'indeed', 'certainly', 'in fact'], many: ['numerous', 'several', 'plenty of', 'countless', 'a lot of'], lots: ['plenty', 'loads', 'heaps', 'a great deal', 'masses'],
  old: ['aged', 'ancient', 'dated', 'veteran', 'former'], new: ['fresh', 'novel', 'recent', 'modern', 'original'], smart: ['clever', 'bright', 'sharp', 'wise', 'astute'], funny: ['amusing', 'witty', 'comic', 'droll', 'humorous'],
  angry: ['mad', 'furious', 'irate', 'cross', 'annoyed'], scared: ['afraid', 'fearful', 'anxious', 'nervous', 'alarmed'], tired: ['weary', 'exhausted', 'drained', 'sleepy', 'worn out'], beautiful: ['lovely', 'gorgeous', 'stunning', 'pretty', 'striking'],
  ugly: ['unsightly', 'plain', 'unattractive', 'hideous', 'grim'], rich: ['wealthy', 'affluent', 'prosperous', 'well-off', 'loaded'], poor: ['needy', 'broke', 'impoverished', 'lacking', 'weak'], strange: ['odd', 'unusual', 'peculiar', 'curious', 'weird'],
  clear: ['plain', 'obvious', 'evident', 'transparent', 'lucid'], bright: ['vivid', 'brilliant', 'shining', 'luminous', 'radiant'], dark: ['dim', 'shadowy', 'murky', 'gloomy', 'dusky'], cold: ['chilly', 'cool', 'icy', 'frosty', 'freezing'],
  hot: ['warm', 'scorching', 'boiling', 'burning', 'sweltering'], great: ['excellent', 'superb', 'wonderful', 'fantastic', 'outstanding'], amazing: ['astonishing', 'remarkable', 'incredible', 'striking', 'wonderful'], interesting: ['engaging', 'intriguing', 'absorbing', 'fascinating', 'compelling'],
  change: ['alter', 'adjust', 'shift', 'modify', 'switch'], try: ['attempt', 'test', 'seek', 'strive', 'aim'], buy: ['purchase', 'acquire', 'pick up', 'order', 'get'], ask: ['inquire', 'question', 'request', 'query', 'pose'],
  answer: ['reply', 'response', 'solution', 'respond', 'resolve'], problem: ['issue', 'trouble', 'difficulty', 'snag', 'obstacle'], way: ['method', 'manner', 'route', 'approach', 'means'], part: ['piece', 'portion', 'section', 'share', 'segment'],
  maybe: ['perhaps', 'possibly', 'perchance', 'conceivably', 'it may be'], also: ['too', 'as well', 'besides', 'furthermore', 'in addition'], but: ['yet', 'however', 'though', 'still', 'although'], because: ['since', 'as', 'for', 'given that', 'owing to'],
  enough: ['sufficient', 'adequate', 'ample', 'plenty', 'satisfactory'], whole: ['entire', 'complete', 'full', 'total', 'intact'], enjoy: ['like', 'relish', 'love', 'savor', 'appreciate'], love: ['adore', 'cherish', 'treasure', 'be fond of', 'prize'],
  hate: ['detest', 'dislike', 'loathe', 'despise', 'resent'], pretty: ['fairly', 'quite', 'rather', 'attractive', 'lovely'], stop: ['halt', 'end', 'cease', 'pause', 'quit'], choose: ['pick', 'select', 'opt for', 'decide on', 'prefer'],
};
/** the words of a text that have synonyms in the local list: [{ word, options }] (each word once). Pure. */
export function synonymsIn(text) {
  const seen = new Set(), out = [];
  for (const w of wordsOf(text)) if (SYN[w] && !seen.has(w)) { seen.add(w); out.push({ word: w, options: SYN[w] }); }
  return out;
}


// ---- proofread and thread ----
const TYPOS = { teh: 'the', adn: 'and', taht: 'that', wich: 'which', recieve: 'receive', recieved: 'received', definately: 'definitely', definitly: 'definitely', seperate: 'separate',
  occured: 'occurred', untill: 'until', alot: 'a lot', thier: 'their', becuase: 'because', beacuse: 'because', wierd: 'weird', accomodate: 'accommodate', goverment: 'government',
  enviroment: 'environment', tommorow: 'tomorrow', tomorow: 'tomorrow', begining: 'beginning', beleive: 'believe', freind: 'friend', occassion: 'occasion', neccessary: 'necessary',
  necesary: 'necessary', succesful: 'successful', sucess: 'success', embarass: 'embarrass', publically: 'publicly', existance: 'existence', independant: 'independent', calender: 'calendar' };
const keepCase = (from, to) => (/^[A-Z]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to);
/** the mechanical fixes only (doubled words, spaces, capitals, a short list of common typos): { text, fixes: [what, ...] }. It never rewrites a sentence. Pure. */
export function proofread(text) {
  let t = unflat(text), fixes = [];
  const note = (what, n) => { if (n) fixes.push(n > 1 ? what + ' ×' + n : what); };
  let n = 0;
  t = t.replace(/\b([A-Za-z']+)(\s+)\1\b/gi, (m, w) => { if (/^(?:had|that|is)$/i.test(w)) return m; n++; return w; }); note('doubled word', n);
  n = 0; t = t.replace(/[ \t]{2,}/g, () => { n++; return ' '; }); note('extra space', n);
  n = 0; t = t.replace(/[ \t]+([,.;:!?])/g, (m, c) => { n++; return c; }); note('space before punctuation', n);
  n = 0; t = t.replace(/([a-z])([,;:])(?=[A-Za-z])/g, (m, a, c) => { n++; return a + c + ' '; }); note('missing space after punctuation', n);
  n = 0; t = t.replace(/\b(teh|adn|taht|wich|recieve[d]?|definately|definitly|seperate|occured|untill|alot|thier|becuase|beacuse|wierd|accomodate|goverment|enviroment|tommorow|tomorow|begining|beleive|freind|occassion|neccessary|necesary|succesful|sucess|embarass|publically|existance|independant|calender)\b/gi,
    (m) => { n++; return keepCase(m, TYPOS[m.toLowerCase()]); }); note('common misspelling', n);
  n = 0; t = t.replace(/\bi\b(?=[\s,.;:!?']|$)/g, () => { n++; return 'I'; }); note('lowercase "I"', n);
  n = 0; t = t.replace(/(^|[.!?]["')\]]?\s+)([a-z])/g, (m, a, c) => { n++; return a + c.toUpperCase(); }); note('sentence start without a capital', n);
  n = 0; t = t.replace(/([!?])\1{1,}/g, (m, c) => { n++; return c; }); note('repeated ' + 'punctuation', n);
  return { text: t.trim(), fixes };
}
/** a text as numbered posts of at most `max` characters, split at sentence ends ("1/3 ..."); a single sentence longer than a post is cut at a word. Pure. */
export function threadOf(text, max = 280) {
  const sents = unflat(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const room = max - 8; // "12/12 " fits in the margin
  const posts = []; let cur = '';
  const push = () => { if (cur) { posts.push(cur); cur = ''; } };
  for (let s of sents) {
    while (s.length > room) { const cut = s.lastIndexOf(' ', room); const at = cut > room / 2 ? cut : room; push(); posts.push(s.slice(0, at).trim()); s = s.slice(at).trim(); }
    if (!s) continue;
    if (cur && (cur + ' ' + s).length > room) push();
    cur = cur ? cur + ' ' + s : s;
  }
  push();
  return posts.length === 1 ? posts : posts.map((p, i) => (i + 1) + '/' + posts.length + ' ' + p);
}

// ---- one entry for the card ----
/** run a mode on a text: { out, note }. Pure. */
export function transform(mode, text) {
  const t = unflat(text).slice(0, MAX_TEXT);
  if (!t.trim()) return { out: '', note: 'Type or paste some text above.' };
  switch (mode) {
    case 'shorten': { const r = shorten(t); return { out: r.text, note: r.before === r.after ? 'Nothing wordy found.' : r.before + ' words → ' + r.after + ' (' + Math.round((1 - r.after / r.before) * 100) + '% shorter)' }; }
    case 'bullets': return { out: bulletize(t), note: '' };
    case 'steps': return { out: numberSteps(t), note: '' };
    case 'sentence': return { out: sentenceCase(t), note: '' };
    case 'title': return { out: titleCase(t), note: '' };
    case 'filler': { const r = removeFiller(t); return { out: r.text, note: r.removed.length ? 'Removed ' + r.removed.length + ': ' + [...new Set(r.removed)].join(', ') : 'No filler words found.' }; }
    case 'unique': { const u = uniqueWords(t); return { out: u.top.length ? 'Repeated most: ' + u.top.map(([w, n]) => w + ' ×' + n).join(', ') : 'No word repeats.', note: u.total + ' words · ' + u.unique + ' unique (' + u.share + '%)' }; }
    case 'level': { const r = readingLevel(t); return r ? { out: 'Reading ease ' + r.ease + ' · ' + r.label + ' · about grade ' + r.grade + ' (' + r.who + ')', note: r.words + ' words · ' + r.sentences + ' sentence' + (r.sentences === 1 ? '' : 's') + ' · a rough guide (Flesch)' } : { out: '', note: 'Needs at least 5 words.' }; }
    case 'outline': { const o = outlineFromHeadings(t); return { out: o, note: o ? '' : 'No headings found: start lines with # or 1.' }; }
    case 'reverse': return { out: reverseOutline(t), note: 'First idea of each paragraph. If the outline reads oddly, so might the text.' };
    case 'synonyms': { const s = synonymsIn(t); return { out: s.map((x) => x.word + ': ' + x.options.join(', ')).join('\n'), note: s.length ? 'From a short local list' : 'No overused words from the list found.' }; }
    case 'proofread': { const r = proofread(t); return { out: r.text, note: r.fixes.length ? 'Fixed: ' + r.fixes.join(', ') + '. Spelling is a short common-mistakes list; read it once yourself.' : 'Nothing mechanical to fix.' }; }
    case 'thread': { const p = threadOf(t); return { out: p.join('\n\n'), note: p.length + ' post' + (p.length === 1 ? '' : 's') + ' of 280 characters or fewer' }; }
    default: return { out: '', note: '' };
  }
}

// ---- the ask ----
const LEAD = '^(?:please\\s+)?(?:can\\s+you\\s+)?';
const THIS = '(?:\\s+(?:this|the|my|that)(?:\\s+(?:text|sentence|paragraph|passage|note|writing|draft))?)?';
const RULES = [
  ['shorten', new RegExp(LEAD + '(?:shorten|tighten(?:\\s+up)?|condense|make' + THIS + '\\s+shorter|trim)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['bullets', new RegExp(LEAD + '(?:bulleti[sz]e|make' + THIS + '\\s+(?:into\\s+)?(?:a\\s+)?bullets?(?:\\s+points?)?|(?:turn|convert|change|put)' + THIS + '\\s+(?:in)?to\\s+bullets?(?:\\s+points?)?|bullet\\s+points?(?:\\s+(?:from|of|for))?)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['steps', new RegExp(LEAD + '(?:numbered\\s+steps?(?:\\s+(?:from|of|for))?|(?:turn|convert|change|put|make)' + THIS + '\\s+(?:in)?(?:to\\s+)?(?:into\\s+)?(?:a\\s+)?numbered\\s+(?:steps?|list)|steps?\\s+from(?:\\s+(?:this|the))?(?:\\s+(?:text|paragraph|prose))?|stepify)\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['sentence', new RegExp(LEAD + '(?:(?:make|turn|convert|change|put)' + THIS + '\\s+(?:in)?(?:to\\s+)?(?:into\\s+)?sentence\\s+case|sentence\\s+case)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['filler', new RegExp(LEAD + '(?:(?:remove|strip|cut|delete|drop|take\\s+out)(?:\\s+(?:the|all))?\\s+filler(?:\\s+words?)?(?:\\s+(?:from|out\\s+of|in))?|filler\\s+words?(?:\\s+(?:remover|removal|cut))?)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['unique', new RegExp(LEAD + '(?:count\\s+(?:the\\s+)?unique\\s+words?(?:\\s+(?:in|of|for))?|unique\\s+word\\s+count(?:\\s+(?:in|of|for))?|how\\s+many\\s+unique\\s+words\\s+(?:are\\s+)?(?:in|of)|unique\\s+words(?:\\s+(?:in|of))?)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['level', new RegExp(LEAD + '(?:(?:what(?:\'s|\\s+is)\\s+)?(?:the\\s+)?(?:reading|readability|grade)\\s+(?:level|score|ease)(?:\\s+(?:of|for))?|how\\s+readable\\s+is|reading\\s+level\\s+check|flesch\\s+(?:score|reading\\s+ease)(?:\\s+(?:of|for))?)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['outline', new RegExp(LEAD + '(?:(?:make|build|create|get|give\\s+me)\\s+(?:me\\s+)?(?:an?\\s+)?)?outline\\s+(?:from|of|out\\s+of)\\s+(?:the\\s+|my\\s+)?headings?' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['reverse', new RegExp(LEAD + '(?:(?:make|build|create|do|get|give\\s+me)\\s+(?:me\\s+)?(?:an?\\s+)?)?reverse\\s+outline(?:\\s+(?:of|for|from))?' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['proofread', new RegExp(LEAD + '(?:proofread|copy[\\s-]?edit|(?:fix|check|correct)\\s+(?:the\\s+)?(?:grammar|spelling|typos?|punctuation)(?:\\s+(?:and|&)\\s+(?:grammar|spelling|typos?|punctuation))?(?:\\s+(?:in|of|for))?)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['thread', new RegExp(LEAD + '(?:(?:turn|convert|change|make|put)' + THIS + '\\s+(?:in)?(?:to\\s+)?(?:into\\s+)?(?:a\\s+)?(?:social\\s+)?(?:thread|tweets?|posts?)|(?:social\\s+)?thread\\s+(?:from|of))' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
  ['synonyms', new RegExp(LEAD + '(?:suggest\\s+)?synonyms?\\s+for\\s+(?:the\\s+words\\s+in|each\\s+word\\s+in|words\\s+in|every\\s+word\\s+in|overused\\s+words\\s+in)' + THIS + '\\s*:\\s*([\\s\\S]+)$', 'i')],
];
const OPEN = /^(?:please\s+)?(?:open\s+|show\s+|make\s+|give\s+me\s+|start\s+)?(?:(?:a|the|my)\s+)?(?:writing\s+aids?|writing\s+tools?\s+card|text\s+tools?\s+card)(?:\s+card)?(?:\s+please)?$/i;

/** { mode, text } for a writing-aids ask, { mode: 'shorten', text: '' } for "writing aids", or null. Pure. */
export function parseWritingAsk(raw) {
  const t = String(raw == null ? '' : raw).trim();
  if (!t) return null;
  if (OPEN.test(t.replace(/[.!]+$/, ''))) return { mode: 'shorten', text: '' };
  const flat = t.replace(/\r?\n/g, ' ⏎ ');
  for (const [mode, re] of RULES) {
    const m = re.exec(flat);
    if (m && m[1] && m[1].trim()) return { mode, text: unflat(m[1]).trim().slice(0, MAX_TEXT) };
  }
  return null;
}
