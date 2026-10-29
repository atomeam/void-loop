/**
 * wordcount: what a text holds, counted the way a writer means it (the tower's wordcounter.net floor, owner 2026-10-24: "focus on accuracy
 * so we can get this list moving fast"). Words are runs of letters and digits (an apostrophe or hyphen inside one keeps it one word);
 * characters are what the text holds, counted as people see them (an emoji is one); a sentence ends at . ! or ? followed by a space or
 * the end, but not after a title or a short abbreviation (Mr., Dr., e.g., U.S.) and never inside a number (3.5); paragraphs are blocks
 * separated by a blank line or a line break. Reading time at 238 words a minute and speaking time at 183 (Brysbaert 2019's average
 * silent reading rate; a typical presentation pace); the reading level is the Flesch-Kincaid grade. Pure. Tests: tools/wordcount.test.mjs.
 */
import { syllables } from '../skills/util.js';

export const READ_WPM = 238, SPEAK_WPM = 183;
const WORD = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
// words that end with a full stop without ending a sentence
const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'etc', 'inc', 'ltd', 'co', 'corp', 'dept', 'no', 'fig', 'approx', 'est', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'e.g', 'i.e', 'a.m', 'p.m', 'u.s', 'u.k', 'u.s.a', 'ph.d']);

export const wordsOf = (text) => String(text || '').match(WORD) || [];

/** the stage ask that opens the page's card on the text in the box, exactly as typed (line breaks too): the text rides as base64url
 *  ('count words #...', read back by skills/util.js utilOf), so no word in it can send the ask to another skill (a line about the
 *  weather was a forecast, its words sent off the device); at most `max` characters, so a long draft keeps the example; '' when
 *  the card would count it differently (a lone - or ' the skill counts as a word and this page does not). Pure. */
export function cardAsk(text, max = 200) {
  const s = String(text || ''), n = wordsOf(s).length;
  if (!n || Array.from(s).length > max || (s.match(/[\p{L}\p{N}'’-]+/gu) || []).length !== n) return '';
  let bin = ''; for (const x of new TextEncoder().encode(s)) bin += String.fromCharCode(x);
  return 'count words #' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** how many sentences: an end mark (. ! ? or …, repeated or not, a closing quote or bracket after it) before a space or the end. Pure. */
export function sentences(text) {
  const t = String(text || '').trim(); if (!wordsOf(t).length) return 0;
  let n = 0;
  const re = /([\p{L}\p{N}.'’]*)([.!?…]+)["'”’)\]]*(?=\s|$)/gu;
  for (const m of t.matchAll(re)) {
    const before = m[1].toLowerCase().replace(/\.$/, ''), mark = m[2];
    if (mark === '.' && (ABBR.has(before) || /^(?:[a-z]\.)+[a-z]?$/i.test(m[1] + '.') && m[1].length <= 4)) continue; // Mr. / U.S.
    n++;
  }
  // text after the last end mark that still has words is a sentence too ("Hello there" has one)
  const tail = t.replace(/^[\s\S]*[.!?…]["'”’)\]]*(?=\s|$)/u, '');
  if (wordsOf(tail).length || !n) n++;
  return n;
}

/** paragraphs: blocks of text separated by line breaks, blank ones not counted. Pure. */
export const paragraphs = (text) => String(text || '').split(/\n+/).filter((p) => wordsOf(p).length).length;

/** the top keywords: words of 3 letters or more, not the common small words, with their count and share of all words. Pure. */
const STOP = new Set('the and for are but not you all any can her was one our out day get has him his how man new now old see two way who boy did its let put say she too use that with have this will your from they know want been good much some time very when come here just like long make many more only over such take than them well were what into also then there their which would about could other after first these those where being'.split(' '));
export function keywords(text, n = 10) {
  const ws = wordsOf(text).map((w) => w.toLowerCase()), m = new Map();
  for (const w of ws) if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) m.set(w, (m.get(w) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([word, count]) => ({ word, count, share: ws.length ? count / ws.length : 0 }));
}

/** seconds as people say them: "0 sec", "45 sec", "3 min 20 sec", "1 hr 5 min". Pure. */
export function duration(sec) {
  const s = Math.round(sec); if (s < 60) return s + ' sec';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? h + ' hr ' + m + ' min' : m + ' min' + (r ? ' ' + r + ' sec' : '');
}

/** everything about a text: { words, characters, noSpaces, sentences, paragraphs, readSec, speakSec, grade, keywords }. Pure. */
export function count(text) {
  const t = String(text || ''), ws = wordsOf(t), chars = Array.from(t).length, noSpaces = Array.from(t.replace(/\s/g, '')).length;
  const sn = sentences(t), syl = ws.reduce((a, w) => a + syllables(w), 0);
  const grade = ws.length && sn ? Math.round((0.39 * (ws.length / sn) + 11.8 * (syl / ws.length) - 15.59) * 10) / 10 : null;
  return { words: ws.length, characters: chars, noSpaces, sentences: sn, paragraphs: paragraphs(t), readSec: (ws.length / READ_WPM) * 60, speakSec: (ws.length / SPEAK_WPM) * 60, grade, keywords: keywords(t) };
}

/** the top phrases of `size` words (2 or 3) that run inside one sentence, not made only of the common small words, seen at least twice. Pure. */
export function phrases(text, size = 2, n = 10) {
  const m = new Map(); let total = 0;
  for (const part of String(text || '').split(/[.!?…;:\n]+/u)) {
    const ws = wordsOf(part).map((w) => w.toLowerCase());
    for (let i = 0; i + size <= ws.length; i++) { const g = ws.slice(i, i + size); total++; if (g.every((w) => STOP.has(w) || w.length < 3) || STOP.has(g[0]) && STOP.has(g[size - 1])) continue; const k = g.join(' '); m.set(k, (m.get(k) || 0) + 1); }
  }
  return [...m].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([phrase, count]) => ({ phrase, count, share: total ? count / total : 0 }));
}

/** a goal of words or characters: { done, of, share (0 to 1), left, reached }. Pure. */
export function goal(c, target, unit = 'words') {
  const of = Math.max(1, Math.floor(target) || 1), done = unit === 'characters' ? c.characters : c.words;
  return { done, of, share: Math.min(1, done / of), left: Math.max(0, of - done), reached: done >= of };
}

/** about how many pages a text fills: 500 words a page single-spaced, 250 double-spaced (12 pt, 1-inch margins), to a tenth. Pure. */
export const pages = (words) => ({ single: Math.round((words / 500) * 10) / 10, double: Math.round((words / 250) * 10) / 10 });

/** the limits people write to, in characters (each service counts a little differently: these are the published caps). */
export const LIMITS = Object.freeze([['X (Twitter) post', 280], ['Text message (one SMS)', 160], ['Search result title', 60], ['Meta description', 160], ['Instagram caption', 2200], ['LinkedIn post', 3000], ['YouTube title', 100], ['TikTok caption', 4000], ['Facebook post', 63206]]);

/** the kept versions after the text changes at `now`: a new version when the last one is a minute old and the text differs, or the text
 *  changed by a lot (100 characters or a whole paragraph gone); the newest first, at most `max`. Versions are { at, text }. Pure. */
export function keepVersion(list, text, now, { max = 30, force = false } = {}) {
  const t = String(text || ''), last = list[0];
  if (!t.trim() || (last && last.text === t)) return list;
  const big = last && Math.abs(Array.from(t).length - Array.from(last.text).length) >= 100;
  if (!force && last && now - last.at < 60000 && !big) return list;
  return [{ at: now, text: t }, ...list].slice(0, max);
}
