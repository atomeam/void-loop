// Word helpers for the stage-pack B skills (error-garden, noun-heat): normalise a sentence to its content words so two
// phrasings of one thing compare equal. Pure, no network, nothing stored.
export const STOP = new Set('a an and are as at be been but by do did does for from had has have i if in into is it its me my of on or our so than that the their then there these they this those to too up was we were what when which who will with you your not no yes just very also'.split(' '));

/** the stem of a word: plural, -ing and -ed edges trimmed (long words only). Pure. */
export function stem(w) {
  let s = String(w || '').toLowerCase();
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return s;
}

/** content words of a text: lower-cased, stemmed, without stop words and one-letter bits, in order, no repeats. Pure. */
export function words(text) {
  const out = [];
  for (const raw of String(text || '').toLowerCase().split(/[^a-z0-9']+/)) {
    const w = raw.replace(/'/g, '');
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    const s = stem(w);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** overlap of two word lists, 0 to 1 (shared over the smaller list, so a short restatement still matches). Pure. */
export function overlap(a, b) {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  return a.filter((w) => sb.has(w)).length / Math.min(a.length, b.length);
}

/** are two texts the same thing said twice? Pure. */
export function sameThing(a, b, threshold = 0.75) {
  const wa = words(a), wb = words(b);
  return wa.length > 0 && wb.length > 0 && overlap(wa, wb) >= threshold;
}
