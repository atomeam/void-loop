// Verse sings (owner, 2026-10-30: "verse can have a good sounding distinct haunting voice", "not just rap all music", and on the Modal route:
// "Yes, set it up once you have the account"). Cloudflare's free models have no singing model, so a sung song is made by ACE-Step 1.5 (MIT,
// github.com/ace-step/ACE-Step-1.5) on the owner's own Modal account (modal/verse_sing.py, deployed by .github/workflows/modal-sing.yml).
// This file is the part the page and the site share, with no network: what Verse's voice is, the caption and lyrics sent, and the limits.
// functions/api/sing.js does the asking; skills/music.js offers "Sing it" only when the server says singing is on for this visitor.
// Tests: tools/sing.test.mjs.

/** Verse's own voice, the same in every sung song, so it is one singer and not a new one each time. */
export const VOICE = 'haunting ethereal lead vocal, airy and intimate, soft breathy falsetto on the high notes, long reverb tails, distinct and unhurried';
export const ASK_MAX = 300, CAPTION_MAX = 420, LYRICS_MAX = 2000, LINE_MAX = 120, LINES_MAX = 40;
export const SECONDS_MIN = 20, SECONDS_MAX = 90, SECONDS_DEFAULT = 60;
// the owner's Modal credit pays for every song, so two limits: per member each UTC day, and for the whole site (lib/daily-cap.js)
export const SING_PER_MEMBER = 4, SING_PER_DAY = 20;
// a sung song is kept at the edge a month: the same ask sung again costs nothing
export const SING_TTL = 2592000;

const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** the ask with the "make me a" part taken off: "make me a haunting folk song about the sea" -> "haunting folk song about the sea". Pure. */
export function askOf(text) {
  const t = clean(text).slice(0, ASK_MAX);
  return t.replace(/^(?:please\s+|can you\s+|could you\s+|will you\s+)?(?:make|compose|write|create|generate|give|sing|cook up)(?:\s+(?:me|us))?\s+(?:a\s+|an\s+|some\s+|my\s+|another\s+|new\s+)?/i, '').replace(/[?.!]+$/, '').trim();
}

/** the style caption ACE-Step reads: what was asked for, then Verse's voice. '' when there is nothing to sing about. Pure. */
export function captionOf(text) {
  const a = askOf(text);
  if (a.length < 3) return '';
  return (a + ', ' + VOICE).slice(0, CAPTION_MAX);
}

/** song lengths in whole seconds, held to what one song may cost. Pure. */
export function secondsOf(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? Math.min(SECONDS_MAX, Math.max(SECONDS_MIN, v)) : SECONDS_DEFAULT;
}

const HEAD = /^\[?\s*(intro|verse(?:\s*\d+)?|pre[- ]?chorus|chorus|hook|bridge|outro|refrain)\s*\d*\s*\]?\s*:?$/i;
/** lyrics as ACE-Step reads them: section tags in square brackets ([verse], [chorus], ...), one sung line a line, no notes or numbering.
 *  A heading the model wrote as "Chorus:" or "[Hook]" becomes "[chorus]". null when fewer than 4 sung lines are left. Pure. */
export function lyricsOf(text) {
  const out = []; let sung = 0;
  for (const raw of String(text == null ? '' : text).split(/\r?\n/)) {
    if (out.length >= LINES_MAX) break;
    let l = clean(raw).replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '');
    if (!l || /^title\s*:/i.test(l) || /^\(.*\)$/.test(l)) continue;
    const h = HEAD.exec(l);
    if (h) { const name = h[1].toLowerCase().replace(/\s*\d+$/, '').replace(/^hook$/, 'chorus').replace(/^refrain$/, 'chorus').replace(/^pre[- ]?chorus$/, 'pre-chorus'); out.push('[' + name + ']'); continue; }
    if (/^\[.*\]$/.test(l)) continue; // any other bracketed note is a stage direction, never sung
    out.push(l.slice(0, LINE_MAX)); sung++;
  }
  if (sung < 4) return null;
  let s = out.join('\n');
  if (s.length > LYRICS_MAX) s = s.slice(0, LYRICS_MAX).replace(/\n[^\n]*$/, '');
  return s;
}

/** the messages that ask the free chat model to write the words. Pure. */
export function lyricsMessages(text) {
  return [
    { role: 'system', content: 'You write original song lyrics for Verse, a singer with a haunting, ethereal voice. Write only original words (never copy or quote an existing song). Output only the lyrics in exactly this shape, with nothing before or after it:\n[verse]\n4 lines\n[chorus]\n4 lines\n[verse]\n4 lines\n[chorus]\n4 lines\nShort lines that are easy to sing, vivid images, a chorus people remember. No titles, no notes, no line numbers. Nothing hateful, sexual or violent.' },
    { role: 'user', content: 'The song: ' + askOf(text) }
  ];
}

/** singing is switched on only when both the endpoint and its key are set, and the endpoint is a Modal web address. Pure. */
export function singOn(env) {
  const u = String((env && env.VERSE_SING_URL) || '').trim(), k = String((env && env.VERSE_SING_KEY) || '').trim();
  return /^https:\/\/[a-z0-9-]+\.modal\.run\/?$/.test(u) && k.length >= 32;
}

/** the edge cache's key for one sung song: the ask and the words given, never anything about who asked. */
export const cacheTextOf = (caption, lyrics, seconds) => ['ace-step-1.5', caption.toLowerCase(), lyrics || '', seconds].join('|');
