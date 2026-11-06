// What a movie ask wants, and how closely a real pick matches it (asked by Verse, 2026-10-22: "Add a 'similarity-score' field to the movie
// picks JSON so users can see how closely a pick matches their expressed intent"). "scary movies from the 90s" wants horror from 1990 to 1999;
// "pick a movie to watch with me" wants nothing in particular, so it gets no score at all, never a made-up one. A pick is scored only on its
// own looked-up data (the source's genre, the year, the title and the overview), criterion by criterion. Pure: skills/movie.js and
// tools/movie-intent.test.mjs use it. The genre words and the decades are lib/film-discovery.js's, so the two skills read an ask the same way.
import { GENRES, span } from './film-discovery.js';

// mood words that name a genre (the ask's own word is shown beside the genre it stands for)
export const MOODS = [
  [/^(?:scary|spooky|creepy|frightening|terrifying|haunted|horrifying)$/, 'Horror'],
  [/^(?:funny|hilarious|silly|lighthearted|goofy)$/, 'Comedy'],
  [/^(?:thrilling|suspenseful|tense)$/, 'Thriller'],
  [/^(?:romantic)$/, 'Romance'],
  [/^(?:sad|moving|emotional|tearjerking)$/, 'Drama'],
  [/^(?:exciting|explosive)$/, 'Action & Adventure'],
  [/^(?:animated|cartoon|cartoons)$/, 'Anime'],
  [/^(?:kids|kid|family)$/, 'Kids & Family'],
];
const DEC_WORDS = new Set(['twenties', 'thirties', 'forties', 'fifties', 'sixties', 'seventies', 'eighties', 'nineties']);
// words that say how to pick, not what to pick
const FILLER = new Set(('a an the some any good great nice best well top really very please pick choose suggest recommend find give show get list me us i we you our my '
  + 'movie movies film films flick flicks watch see to for with from of in on at about and or tonight today now night something anything that this one ones '
  + 'what should could would can let lets made released era decade decades year years old new kind sort type like want need maybe just few couple '
  + 'is are be into it its so but by').split(' '));
const GENRE_OF = (w) => { const g = GENRES.find((x) => x[0].test(w)); return g ? g[1] : null; };
const MOOD_OF = (w) => { const m = MOODS.find((x) => x[0].test(w)); return m ? m[1] : null; };
const GENRE_TEST = (name) => { const g = GENRES.find((x) => x[1] === name); return g ? g[2] : new RegExp('^' + String(name).split(/[^A-Za-z]/)[0], 'i'); }; // void-review: ok (name is one of the constant genre names above, never user text)
const decadeLabel = (s) => (s.from === s.to ? String(s.from) : s.to - s.from === 9 && s.from % 10 === 0 ? s.from + 's' : s.from + ' to ' + s.to);

/**
 * a movie ask -> { genre, genreWord, from, to, keywords, criteria } | null when it names nothing to match. Pure.
 * criteria is the list a pick is scored on, each { kind: 'genre'|'years'|'keyword', label }.
 * "scary movies from the 90s" -> genre Horror (word "scary"), 1990 to 1999; "pick a movie to watch with me" -> null.
 */
export function parseIntent(text) {
  const t = String(text || '').toLowerCase().normalize('NFKC').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!t || t.length > 200) return null;
  const toks = t.replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  let genre = null, genreWord = '', years = null; const keywords = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].replace(/^'+|'+$/g, ''), two = i + 1 < toks.length ? w + ' ' + toks[i + 1] : '';
    if (!w) continue;
    if (two && /^(?:sci fi|science fiction)$/.test(two)) { if (!genre) { genre = 'Sci-Fi & Fantasy'; genreWord = 'sci-fi'; } i++; continue; }
    const sp = /^\d{4}s?$|^\d0'?s$/.test(w) || DEC_WORDS.has(w) ? span(w) : null;
    if (sp) { if (!years) years = sp; continue; }
    const g = GENRE_OF(w) || MOOD_OF(w);
    if (g) { if (!genre) { genre = g; genreWord = w; } continue; }
    if (FILLER.has(w) || w.length < 3 || /^\d+$/.test(w) || /'/.test(w)) continue;
    const k = w.length > 3 ? w.replace(/(?<=[^s])s$/, '') : w; // "zombies" -> "zombie"; the match takes the plural back
    if (k.length >= 3 && !keywords.includes(k) && keywords.length < 4) keywords.push(k);
  }
  const criteria = [];
  if (genre) criteria.push({ kind: 'genre', label: genreWord && genreWord !== genre.toLowerCase() ? genreWord + ' (' + genre.toLowerCase() + ')' : genre.toLowerCase(), genre });
  if (years) criteria.push({ kind: 'years', label: decadeLabel(years), from: years.from, to: years.to });
  for (const k of keywords) criteria.push({ kind: 'keyword', label: k, word: k });
  if (!criteria.length) return null;
  return { genre, genreWord, from: years ? years.from : null, to: years ? years.to : null, keywords, criteria };
}

/** the prompt that asks the model for picks that follow the intent; the default prompt when there is none. Pure. */
export const DEFAULT_PROMPT = 'Suggest 5 well-regarded movies for someone to watch tonight, a mix of genres. Reply with only a numbered list, one per line, exactly like: 1. Title (Year)';
export function pickPrompt(intent) {
  if (!intent) return DEFAULT_PROMPT;
  const what = (intent.genre ? intent.genre.replace('Anime', 'animated').toLowerCase() + ' ' : '') + 'movies'
    + (intent.from ? (intent.from === intent.to ? ' released in ' + intent.from : ' released between ' + intent.from + ' and ' + intent.to) : '')
    + (intent.keywords.length ? ' about ' + intent.keywords.join(', ') : '');
  return 'Suggest 5 well-regarded ' + what + '. Every one must fit all of that. Reply with only a numbered list, one per line, exactly like: 1. Title (Year)';
}

const hasWord = (text, w) => { const s = String(text || '').toLowerCase(); return new RegExp('\\b' + w.replace(/[^a-z0-9]/g, '') + '(?:s|es)?\\b').test(s); }; // void-review: ok (w is a parsed keyword of letters and digits only)

/**
 * how closely one looked-up pick matches the intent: { score: 0..100, matched: [label], missed: [label] }, or { score: null, reason }
 * when the ask had nothing to match. Each criterion counts once; a criterion the source gave no data for is missed (it is not known to
 * match), and its label says so. Pure.
 */
export function similarity(f, intent) {
  if (!intent || !intent.criteria || !intent.criteria.length) return { score: null, reason: 'the ask named no genre, mood, decade or keyword to match, so there is nothing to score' };
  const matched = [], missed = [];
  for (const c of intent.criteria) {
    if (c.kind === 'genre') {
      if (!f || !f.genre) missed.push(c.label + ', the source gives no genre');
      else (GENRE_TEST(c.genre).test(f.genre) ? matched : missed).push(GENRE_TEST(c.genre).test(f.genre) ? c.label : c.label + ', the source says ' + String(f.genre).toLowerCase());
    } else if (c.kind === 'years') {
      const y = f && Number(f.year);
      if (!y) missed.push(c.label + ', the source gives no year');
      else (y >= c.from && y <= c.to ? matched : missed).push(y >= c.from && y <= c.to ? c.label : c.label + ', it is from ' + y);
    } else (f && (hasWord(f.title, c.word) || hasWord(f.overview, c.word)) ? matched : missed).push(c.label);
  }
  return { score: Math.round((100 * matched.length) / intent.criteria.length), matched, missed };
}

/** the plain words beside a pick: "Matches 2 of 2 (100%): scary (horror), 1990s", then what missed and why. Pure. */
export function similarityWords(s, intent) {
  if (!s || s.score === null) return '';
  const n = intent.criteria.length;
  return 'Matches ' + s.matched.length + ' of ' + n + ' (' + s.score + '%)' + (s.matched.length ? ': ' + s.matched.join(', ') : '') + (s.missed.length ? '. Not a match: ' + s.missed.join('; ') : '');
}
