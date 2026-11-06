/**
 * image-gen skill: "generate a picture of a lighthouse", "make an image of a sunset", "create a watercolour painting of a fox",
 * "ai art of a castle", "sketch a house". The stage card for the AI image generator (owner, 2026-10-30: "same with image and video ...
 * we should have the best of everything"): it paints one picture on the card with the same POST /api/image the /image/ page uses (its
 * own per-connection and daily caps, its refusals, its edge cache), and links to /image/ with the words, the style and the seed filled
 * in, so Make there gives the same picture first, from the cache. The style is read from the words (a watercolour, a pencil sketch, a
 * photo, pixel art). The seed is the words' own, so the same ask is the same picture and a second asker gets it from the cache, free.
 * A drawing card for you to draw on ("make a picture of a dog", "sketch pad") stays skills/draw.js, a cartoon ("draw a cat") stays
 * skills/cartoon.js, a coloured shape ("sketch a red circle") stays the draw skill's shape picture, and a real photo of a thing on the
 * free list ("picture of a cat") stays skills/image.js.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { PROMPT_MAX, STYLES } from '../lib/image-gen.js';
import { shapeAsk } from '../lib/shape-picture.js';

// the words that ask for a made picture. make, create and paint take no "picture", "sketch", "drawing" or "doodle" (skills/draw.js opens
// a canvas for those, for you to draw on); generate, render, produce and design take every one
const NOUN = '(?:image|picture|photo|photograph|pic|illustration|painting|artwork|art|render|wallpaper|portrait|drawing|sketch)';
const MADE = '(?:image|photo|photograph|illustration|painting|artwork|art|render|wallpaper|portrait)';
const ADJ = '(?:(?:ai|ai-generated|ai generated|realistic|photorealistic|photo-realistic|beautiful|detailed|high quality|hd|4k|cool|nice|quick|simple|watercolou?r|oil|pencil|pixel|pixel art|anime|manga|3d|3-d|comic|neon|cyberpunk|low poly|fantasy|cinematic|sticker|digital|cartoon)\\s+){0,3}';
const LEAD = '^(?:please\\s+)?(?:can you\\s+|could you\\s+|will you\\s+|i want you to\\s+)?';
const ASKS = [
  new RegExp(LEAD + '(?:generate|render|produce|design)\\s+(?:me\\s+|us\\s+)?(?:an?\\s+|the\\s+|some\\s+|one\\s+)?' + ADJ + NOUN + 's?\\s+(?:of|showing|with)\\s+(.+)$'),
  new RegExp(LEAD + '(?:make|create|paint)\\s+(?:me\\s+|us\\s+)?(?:an?\\s+|the\\s+|some\\s+|one\\s+)?' + ADJ + MADE + 's?\\s+(?:of|showing|with)\\s+(.+)$'),
  /^(?:an?\s+)?ai(?:[\s-]generated)?\s+(?:art|image|picture|photo|illustration|painting)s?\s+of\s+(.+)$/,
];
const SKETCH = new RegExp(LEAD + 'sketch\\s+(?:me\\s+)?((?:an?|some|two|three)\\s+(.+))$'); // not "the": "sketch the system for: automate invoices" is a plan (skills/system-blueprint.js)
// what a sketch ask names that is not a subject to paint: a shape (the stage's, or the draw skill's coloured one), the canvas itself
const NOT_A_SKETCH = /^(?:[a-z]+\s+){0,2}(?:circle|line|square|triangle|rectangle|rect|star|heart|oval|dot|hexagon|pentagon|diamond|shape)s?$|^(?:canvas|pad|sketch ?pad|sketchbook|brush|picture|drawing|doodle|sketch|plan|outline|draft|idea|layout|diagram|chart|graph|map|timeline|wireframe|mockup|mock-up|proposal|summary|list|card|system|architecture|process|flow|workflow|design|structure|step|schema|budget|strategy|story|plot|script|essay|song|poem|answer|reply)s?\b/;

// a style from the words: the first one named wins (the /image/ page's own styles, lib/image-gen.js STYLES)
const STYLE_WORDS = [
  [/\bwatercolou?rs?\b/, 'watercolor'], [/\b(?:oil\s+painting|oil|on canvas)\b/, 'painting'], [/\bpixel(?:\s+art)?\b|\b(?:8|16)[\s-]?bit\b/, 'pixel'],
  [/\b(?:anime|manga)\b/, 'anime'], [/\b(?:3d|3-d)\b/, '3d'], [/\b(?:pencil|sketch|graphite|charcoal)\b/, 'sketch'], [/\bcomic\b/, 'comic'],
  [/\b(?:neon|cyberpunk)\b/, 'neon'], [/\blow[\s-]?poly\b/, 'lowpoly'], [/\bsticker\b/, 'sticker'], [/\bfantasy\b/, 'fantasy'],
  [/\bcinematic\b/, 'cinematic'], [/\bcartoon\b/, 'cartoon'], [/\b(?:photo|photograph|photorealistic|photo-realistic|realistic)\b/, 'photo'], [/\bpainting\b/, 'painting'],
];
/** the style the words name, one of lib/image-gen.js STYLES ('none' when they name none). Pure. */
export function styleFrom(words) {
  const l = String(words || '').toLowerCase();
  for (const [re, k] of STYLE_WORDS) if (re.test(l) && Object.prototype.hasOwnProperty.call(STYLES, k)) return k;
  return 'none';
}

/** the picture an ask wants made: { words, style }, or null when the ask is not one. Pure. */
export function pictureAsk(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim().replace(/[?!.]+$/, '').replace(/\s+please$/i, '');
  const l = raw.toLowerCase();
  if (!l || shapeAsk(l)) return null; // "sketch a red circle" is the draw skill's shape picture
  let words = '', lead = '';
  for (const re of ASKS) { const m = re.exec(l); if (m) { words = m[1]; lead = l.slice(0, l.length - m[1].length); break; } }
  if (!words) {
    const m = SKETCH.exec(l);
    if (!m || NOT_A_SKETCH.test(m[2])) return null;
    words = m[1]; lead = 'sketch';
  }
  words = (raw.length === l.length ? raw.slice(raw.length - words.length) : words).trim(); // the subject in the asker's own case
  if (words.length < 2 || !/[a-z]{2}/i.test(words) || /^(?:it|this|that|me|you|yourself|verse|void|something|anything)$/i.test(words)) return null;
  const style = lead === 'sketch' ? 'sketch' : styleFrom(lead) !== 'none' ? styleFrom(lead) : styleFrom(words);
  return { words: words.slice(0, PROMPT_MAX), style };
}

/** the words' own seed: the same words and style always give the same seed, 0 to 999,999,999 (FNV-1a). Pure. */
export function seedOf(words, style = 'none') {
  let h = 0x811c9dc5;
  for (const c of String(words || '').toLowerCase() + '|' + style) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % 1000000000;
}

/** the /image/ page with the words, the style and the seed filled in (%20, not +: lib/card-frame.js pageOfCard links only a plain query). Pure. */
export function pageOf(p, seed) {
  const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return '/image/?prompt=' + enc(p.words) + (p.style !== 'none' ? '&style=' + enc(p.style) : '') + '&seed=' + seed;
}

/** what the card shows for the route's answer: { img } for a painted picture, or { say } in the route's own words. Pure. */
export function outcomeOf(j) {
  if (j && j.state === 'art' && /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(String(j.img || ''))) return { img: j.img };
  const said = j && typeof j.say === 'string' && j.say.trim() ? j.say.trim().slice(0, 300) : '';
  return { say: said || 'The painter did not answer just now. Try again in a minute, or open the image generator.' };
}

const IMG_CSS = 'display:block;width:100%;max-width:100%;height:auto;max-height:52vh;object-fit:contain;margin:6px 0;border-radius:8px;background:#0001';

function run(text, api) {
  const { showPage, esc } = api, p = pictureAsk(text);
  if (!p) return 'none';
  const seed = seedOf(p.words, p.style), href = pageOf(p, seed), styleName = p.style === 'none' ? '' : STYLES[p.style].en;
  const el = showPage((page) => {
    page.dataset.page = href;
    page.innerHTML = '<h2>' + esc('A picture of ' + p.words) + '</h2>' // void-review: ok (every piece escaped)
      + '<div class="ig-slot" aria-live="polite"><p class="sub">Painting it' + (styleName ? ' as ' + esc(styleName.toLowerCase()) : '') + '. A picture takes up to a minute.</p></div>'
      + '<p><a href="' + esc(href) + '">Open the AI image generator with these words</a> to pick another style, shape or seed.</p>'
      + '<div class="src">Painted by Verse\'s image generator (/image/): free, no sign-up, a few pictures a day for each connection. Seed ' + seed + '.</div>';
  });
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl ? setTimeout(() => ctl.abort(), 60000) : 0;
  Promise.resolve().then(() => fetch('/api/image', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: p.words, style: p.style, shape: 'square', seed }), ...(ctl ? { signal: ctl.signal } : {}) }))
    .then((r) => r.json()).catch(() => null)
    .then((j) => {
      clearTimeout(t);
      const slot = el && el.querySelector && el.querySelector('.ig-slot'); if (!slot) return;
      const o = outcomeOf(j);
      slot.innerHTML = o.img ? '<img class="ig-pic" src="' + esc(o.img) + '" alt="' + esc(p.words) + '" style="' + IMG_CSS + '">' : '<p class="sub">' + esc(o.say) + '</p>';
    });
  return 'image-gen';
}

export default {
  name: 'image-gen',
  examples: ['generate a picture of a lighthouse at night', 'make an image of a sunset over the sea', 'create a watercolour painting of a fox', 'generate an ai image of a red car', 'ai art of a castle', 'sketch a house'],
  nearMisses: ['make a picture of a dog', 'picture of a cat', 'draw a cat', 'sketch a red circle', 'sketch pad', 'sketch a plan for the week', 'sketch the system for: automate invoices', 'make an image board', 'generate a password'],
  match(lower, text) { return !!pictureAsk(text || lower); },
  run,
};
