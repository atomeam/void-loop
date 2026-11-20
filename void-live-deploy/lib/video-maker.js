// The visitor's video maker on /video/ (owner, 2026-11-20: "Verse is meant to be able to do everything"): a topic or a script in, a
// 1080x1920 short out, made in the visitor's own browser. These are its pure parts: the script from a Wikipedia article (the article's
// own words, picked for numbers and firsts, the most surprising line kept for the end), caption chunks, scene timing and photo credits.
// video/maker.js does the rest: the article's photos (Wikimedia Commons), Kokoro's voice (open, runs on the device), a piano bed, captions.

const STOP = new Set('about above after again against because before being below between could their there these those which while would with from into over under were what when where your have this that than then them they will been more most some such only very also just like many much other'.split(' '));
const PUNCH = /\b(first|only|largest|biggest|smallest|oldest|youngest|fastest|longest|highest|record|never|million|billion|secret|accident|banned|refused|nobody|everyone|still|surviv|discover|invent|named after)/i;

/** the article's sentences, without brackets, pronunciations or references. Pure. */
export function sentencesOf(text) {
  return String(text || '').replace(/\s*\([^()]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"])/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 200 && !/may refer to|^See also|^This article/i.test(s));
}

/** how much a sentence is worth saying aloud: numbers, firsts and turns score; lists and definitions do not. Pure. */
export function worth(s) {
  let n = 0;
  if (/\d/.test(s)) n += 3;
  if (PUNCH.test(s)) n += 2;
  if (/\b(but|until|despite|although|instead|because)\b/i.test(s)) n += 1;
  if ((s.match(/,/g) || []).length > 3) n -= 2;
  if (s.length > 170) n -= 1;
  return n;
}

/** a narrated script from an article: what it is, the best lines in the article's order, the most surprising one last. Pure. */
export function scriptFrom(title, text, { lines = 6 } = {}) {
  const all = sentencesOf(text);
  if (all.length < 3) return null;
  const [lead, ...rest] = all;
  const ranked = rest.map((s, i) => ({ s, i, w: worth(s) })).sort((a, b) => b.w - a.w || a.i - b.i);
  const pay = ranked[0];
  const middle = ranked.slice(1, lines - 1).sort((a, b) => a.i - b.i).map((r) => r.s);
  return { title: String(title), lines: [lead, ...middle, ...(pay ? ['And the best part? ' + pay.s] : [])] };
}

/** the visitor's own script: one scene per sentence, at most 10. Pure. */
export function scriptOwn(text) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const lines = [];
  for (const p of parts) { if (lines.length && (p.length < 30 || lines[lines.length - 1].length < 30) && (lines[lines.length - 1] + ' ' + p).length < 120) lines[lines.length - 1] += ' ' + p; else lines.push(p); }
  return lines.length ? { title: lines[0].slice(0, 60), lines: lines.slice(0, 10).map((l) => l.slice(0, 260)) } : null;
}

/** is the box a script (several sentences) or a topic to look up? Pure. */
export const isScript = (text) => String(text || '').trim().split(/[.!?]+\s/).filter((s) => s.trim().split(/\s+/).length >= 3).length >= 2 || String(text || '').length > 120;

/** caption chunks of a line: a few words each, at most `max` characters. Pure. */
export function chunks(line, max = 22) {
  const out = [];
  for (const w of String(line).split(/\s+/).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && (last + ' ' + w).length <= max) out[out.length - 1] = last + ' ' + w; else out.push(w);
  }
  return out;
}

/** the chunk showing at `t` seconds into a line said over `dur` seconds, timed by characters. Pure. */
export function chunkAt(parts, t, dur) {
  const total = parts.reduce((a, p) => a + p.length + 1, 0) || 1;
  let at = 0;
  for (const p of parts) { at += (p.length + 1) / total * dur; if (t < at) return p; }
  return parts[parts.length - 1] || '';
}

/** when each line starts and ends, given each line's voice length: a short title beat, a breath between lines, an end card. Pure. */
export function timeline(durs, { intro = 0.7, gap = 0.35, outro = 3 } = {}) {
  let t = intro;
  const scenes = durs.map((d) => { const s = { start: t, end: t + d }; t += d + gap; return s; });
  return { scenes, voiceEnd: t - gap, total: t - gap + outro };
}

/** words worth searching photos by. Pure. */
export const keywords = (line, n = 2) => [...new Set(String(line).toLowerCase().match(/[a-z]{5,}/g) || [])].filter((w) => !STOP.has(w)).sort((a, b) => b.length - a.length).slice(0, n);

/** a photo is worth showing: a real photo or painting, not an icon, logo, map key or flag. Pure. */
export const photoOk = (info) => { const f = decodeURIComponent(String((info && info.url) || '').split('?')[0].split('/').pop()); return !!info && /\.(jpe?g|png|webp)$/i.test(f) && (info.width || 0) >= 500 && !/(logo|icon|flag_of|symbol|commons-|wiki|signature|coat_of_arms|locator|_map|map_)/i.test(f); };

/** "Photo: Artist, licence" from Commons' extmetadata, plain text. Pure. */
export function creditOf(meta) {
  const m = meta || {}, plain = (v) => String((v && v.value) || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const who = plain(m.Artist).slice(0, 40), lic = plain(m.LicenseShortName).slice(0, 24);
  return 'Photo: ' + (who || 'Wikimedia Commons') + (lic ? ', ' + lic : '');
}
