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
