// The text-to-image page's rules (owner, 2026-10-25: "how do we beat perchance if we dont have images? we have to have everything all the sites
// have"), shared by functions/api/image.js (the route) and /image/ (the page). Pure: tests in tools/image-gen.test.mjs.
// A prompt typed by a person, a style and a shape from short allow-lists, an optional "leave out" line and a seed in; the prompt the painter
// gets, the size, the reason a prompt is refused, and the caps out. The painter is the Art Forge's (functions/api/card-art.js): Workers AI's
// image model first, inside a share of the forge's own daily cap, then Pollinations (free) with its safety filter on, then an honest "resting".
import { SEXUAL, HATE } from './art-rules.js';
import { keeperOf } from './keeper.js';

export const PROMPT_MAX = 400, NEGATIVE_MAX = 200, PER_GO = 4;
// the money rule (STANDING.md): the image page has its own Workers AI share, AI_SHARE a day, inside the free daily allowance. Its paintings are
// counted in the forge's total too (functions/api/card-art.js madeToday), so the forge paints that many fewer when /image/ paints first; both
// together never pass AI_SHARE + FREE_CAP (40) a day (2026-10-25: a share counted under the forge's 30 left /image/ with none by the afternoon); past that the free painter (Pollinations) takes POLL_CAP a day; a connection gets PER_CONN pictures a day in all. ~104 neurons a
// Workers AI picture (klein-4b, 26.05 neurons per 512x512 output tile, a 1024x1024 picture is 4 tiles), so the share is ~1,040 neurons a day.
// There is deliberately no setting that raises AI_SHARE above 10: more paid pictures are the owner's call (each ~$0.0011 past the free allowance).
export const AI_SHARE = 10, POLL_CAP = 150, PER_CONN = 24, PER_MINUTE = 6;
/** the image page's Workers AI share today: IMAGE_AI_SHARE when it is a whole number from 0 up, else AI_SHARE, never above AI_SHARE. Pure. */
export const aiShareOf = (env) => { const v = env && env.IMAGE_AI_SHARE, n = Math.floor(Number(v)); return v !== undefined && String(v).trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.min(n, AI_SHARE) : AI_SHARE; };

// the styles perchance's text-to-image page offers, as words the painter understands (none is an artist's or a studio's name)
export const STYLES = Object.freeze({
  none: { en: 'No style', de: 'Kein Stil', words: '' },
  photo: { en: 'Photo', de: 'Foto', words: 'a high quality photograph, natural light, sharp focus, realistic detail' },
  cinematic: { en: 'Cinematic', de: 'Filmisch', words: 'cinematic film still, dramatic lighting, shallow depth of field, rich colour grading' },
  anime: { en: 'Anime', de: 'Anime', words: 'anime illustration, clean line art, cel shading, vibrant colours' },
  cartoon: { en: 'Cartoon', de: 'Cartoon', words: 'flat 2D cartoon drawing, bold clean outlines, flat bright colours' },
  painting: { en: 'Oil painting', de: 'Ölgemälde', words: 'oil painting on canvas, visible brush strokes, rich texture' },
  watercolor: { en: 'Watercolour', de: 'Aquarell', words: 'soft watercolour painting, gentle washes of colour, paper texture' },
  pixel: { en: 'Pixel art', de: 'Pixelkunst', words: '16-bit pixel art, crisp pixels, limited palette, retro game style' },
  '3d': { en: '3D render', de: '3D-Render', words: '3D render, soft global illumination, smooth materials, octane style lighting' },
  fantasy: { en: 'Fantasy art', de: 'Fantasy', words: 'epic fantasy illustration, magical atmosphere, detailed, painterly' },
  comic: { en: 'Comic', de: 'Comic', words: 'comic book art, bold ink lines, halftone shading, dynamic composition' },
  sketch: { en: 'Pencil sketch', de: 'Bleistiftskizze', words: 'detailed pencil sketch, graphite on paper, cross-hatching' },
  neon: { en: 'Neon', de: 'Neon', words: 'neon-lit cyberpunk scene, glowing pinks and blues, night, reflections' },
  lowpoly: { en: 'Low poly', de: 'Low Poly', words: 'low poly 3D art, faceted shapes, flat shaded, pastel colours' },
  sticker: { en: 'Sticker', de: 'Sticker', words: 'die-cut sticker design, thick white border, simple shapes, plain background' },
});
// the shapes: [width, height] the painter is asked for (Pollinations takes any; Workers AI's klein takes these)
export const SHAPES = Object.freeze({ square: [1024, 1024], portrait: [768, 1152], landscape: [1152, 768], wide: [1344, 768] });
export const styleOf = (v) => (Object.prototype.hasOwnProperty.call(STYLES, v) ? v : 'none');
export const shapeOf = (v) => (Object.prototype.hasOwnProperty.call(SHAPES, v) ? v : 'square');
export const seedOf = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n < 1e9 ? n : 0; };

/** a typed line -> one clean line of at most `max` characters (control characters and markup brackets out). Pure. */
export const cleanLine = (v, max = PROMPT_MAX) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// a real person asked for by name: a few words that name one, or a capitalised first and last name with a photo look. Names of people in
// stories ("Santa Claus", "Little Red Riding Hood") are fine in a drawn style; only a photo-real look of a named person is refused.
const PERSON_WORDS = /\b(?:celebrit\w*|politician|president|prime minister|senator|congress(?:man|woman)|governor|mayor of|real person|famous person|influencer|youtuber|tiktoker|deepfake|face swap|lookalike)\b/i;
const NOT_NAMES = new Set(['A', 'An', 'The', 'In', 'On', 'At', 'Of', 'With', 'And', 'Or', 'New', 'Old', 'Great', 'North', 'South', 'East', 'West', 'Saint', 'St', 'Mount', 'Lake', 'River', 'Santa', 'Mr', 'Mrs', 'Ms', 'Dr', 'Sir', 'Lady', 'King', 'Queen', 'Prince', 'Princess', 'Captain', 'Little', 'Big', 'Red', 'Blue', 'Green', 'Black', 'White', 'Golden', 'Dark']);
const PHOTO_WORDS = /\b(?:photo\w*|photograph\w*|realistic|photoreal\w*|hyperreal\w*|real life|selfie|portrait shot|paparazzi|candid|dslr|4k|8k)\b/i;
/** whether a prompt looks like a photo of a named real person (a capitalised first and last name, the photo or cinematic style or photo words). Pure. */
export function namedPersonPhoto(prompt, style = 'none') {
  const p = String(prompt || ''), photo = style === 'photo' || style === 'cinematic' || PHOTO_WORDS.test(p);
  if (!photo) return false;
  for (const m of p.matchAll(/\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,20}|[A-Z]'[A-Z][a-z]+|Mc[A-Z][a-z]+)\b/g)) if (!NOT_NAMES.has(m[1]) && !NOT_NAMES.has(m[2])) return true;
  return false;
}
/** why a prompt gets no picture: '' when it may be painted, else one of 'empty', 'secret', 'unsuitable', 'person', 'kept'. `isSecret` is the
 *  route's (redact and scrubOut). The NSFW filter is always on: sexual and hateful words are refused here, and the free painter's own safety
 *  filter is asked for too. Pure. */
export function refusalOf(prompt, negative = '', style = 'none', isSecret = () => false) {
  const p = cleanLine(prompt), n = cleanLine(negative, NEGATIVE_MAX), lo = p.toLowerCase();
  if (!p.replace(/[^\p{L}\p{N}]/gu, '')) return 'empty';
  if (isSecret(p) || isSecret(n) || /[A-Za-z0-9_-]{32,}/.test(p) || /\d{9,}/.test(p.replace(/[\s-]/g, ''))) return 'secret';
  if (SEXUAL.test(lo) || HATE.test(lo) || /\b(?:undress\w*|topless|lingerie|bikini|underage|loli|shota|child\w* (?:in|wearing) (?:underwear|swimsuit))\b/i.test(p)) return 'unsuitable';
  if (PERSON_WORDS.test(p) || namedPersonPhoto(p, style)) return 'person';
  if (keeperOf(p)) return 'kept';
  return '';
}
/** the prompt the painter gets: what was typed, the style's words, what to leave out as plain "no ..." words (neither model takes a negative
 *  prompt, so it is written out), and the always-on safe words. Pure. */
export function promptOf(prompt, style = 'none', negative = '') {
  const p = cleanLine(prompt), s = STYLES[styleOf(style)].words;
  const no = cleanLine(negative, NEGATIVE_MAX).split(/[,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => 'no ' + x.replace(/^no\s+/i, '')).join(', ');
  return [p, s, no, 'safe for work, fully clothed'].filter(Boolean).join(', ');
}
/** the free painter's address: the prompt, the shape, the seed, its safety filter on, no logo. Pure. */
export function pollUrl(prompt, [w, h], seed, token = '') {
  const q = 'width=' + w + '&height=' + h + '&seed=' + seedOf(seed) + '&nologo=true&safe=true&private=true&referrer=a-to-mind.com'; // referrer: Pollinations' free tier for named apps
  return token ? 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) + '?' + q : 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?' + q + '&model=flux';
}
/** what the page says for each answer that is not a picture (English, German). Pure data. */
export const SAYS = Object.freeze({
  empty: ['Type what you want to see first.', 'Schreib zuerst, was du sehen willst.'],
  secret: ['That looks like a key or a password, so I left it alone.', 'Das sieht nach einem Schlüssel oder Passwort aus, das male ich nicht.'],
  unsuitable: ['I don\'t make that kind of picture.', 'Solche Bilder mache ich nicht.'],
  person: ['I don\'t make pictures of real people. Try a made-up character, or a drawn style.', 'Ich male keine echten Menschen. Versuch eine erfundene Figur oder einen gezeichneten Stil.'],
  kept: ['I don\'t make that kind of picture.', 'Solche Bilder mache ich nicht.'],
  cap: ['The painter is resting: today\'s pictures are used up. Come back tomorrow (midnight UTC).', 'Der Maler ruht: die Bilder für heute sind aufgebraucht. Morgen wieder (Mitternacht UTC).'],
  mine: ['That is today\'s pictures for you. More tomorrow (midnight UTC).', 'Das waren deine Bilder für heute. Morgen mehr (Mitternacht UTC).'],
  slow: ['One moment: a few pictures a minute at most.', 'Einen Moment: höchstens ein paar Bilder pro Minute.'],
  busy: ['The painter is resting right now. Try again in a minute.', 'Der Maler ruht gerade. Versuch es gleich noch mal.'],
  off: ['The painter is resting: pictures are off for now.', 'Der Maler ruht: Bilder sind gerade aus.'],
  gone: ['That picture is no longer kept here. Paint it again with the same seed, then change it.', 'Dieses Bild ist hier nicht mehr gespeichert. Mal es noch mal mit gleichem Seed, dann ändere es.'],
  badpic: ['That picture could not be read for a change. Try again.', 'Das Bild ließ sich für eine Änderung nicht lesen. Versuch es noch mal.'],
});

// "Change it" (2026-10-30, the owner: "assimilate their tech into verse ... same with image and video"): a picture Verse painted here, changed by
// one typed line, the way image apps edit a picture they made. FLUX.2 klein-4b takes reference pictures as input_image_0..3, each smaller than
// 512x512 (Cloudflare changelog, 2026-01-15), and the server cannot shrink a 1024 picture inside its CPU limit, so the page shrinks the picture it
// shows to EDIT_MAX on its longest side and sends that copy with the picture's own reference (functions/api/image.js changeOf).
export const CHANGE_MAX = 300, EDIT_MAX = 504, EDIT_BYTES = 160000;
/** the reference copy's size for a picture of [w, h]: the longest side EDIT_MAX, the other in proportion. Pure. */
export const editSizeOf = ([w, h]) => { const s = EDIT_MAX / Math.max(w, h); return [Math.round(w * s), Math.round(h * s)]; };
/** a JPEG's or a PNG's own width and height, read from its header with no decode: { type, w, h }, or null when it is neither. Pure. */
export function imageSizeOf(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && String.fromCharCode(b[12], b[13], b[14], b[15]) === 'IHDR') {
    const u = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    return { type: 'image/png', w: u(16), h: u(20) };
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd9 || m === 0xda) return null; // the end, or the picture data, before any frame header
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'image/jpeg', w: (b[i + 7] << 8) + b[i + 8], h: (b[i + 5] << 8) + b[i + 6] };
    i += 2 + ((b[i + 2] << 8) + b[i + 3]);
  }
  return null;
}
/** whether a reference copy of `dims` may stand for a picture of [w, h]: smaller than 512x512 (the model's limit), at least 256 on its longest
 *  side, and the picture's own proportions within 3 percent. Pure. */
export const fitsEdit = (dims, [w, h]) => !!dims && dims.w < 512 && dims.h < 512 && Math.max(dims.w, dims.h) >= 256 && Math.abs(dims.w / dims.h - w / h) <= 0.03 * (w / h);
/** the painter's words for a change: the typed line, keep the rest of image 0, and the always-on safe words. Pure. */
export const changePromptOf = (change) => [cleanLine(change, CHANGE_MAX), 'keep everything else in image 0 the same: the same scene, layout, subject, colours and style', 'safe for work, fully clothed'].join(', ');
