// The Art Forge's rules (owner, 2026-10-17: "the art should be of the subject of each card" and "the art should be cool like illuminati or magic").
// Pure, shared by the route (functions/api/card-art.js) and the tests. One picture per FOLDED subject, made once and kept for ever.
// The prompt is a FIXED template: only the folded subject key, the card's kind and its rarity (each from a short allow-list) go into it. No
// artist, franchise, game, company or character is ever named by us, and a subject that is one (or a real person, or unsafe) is refused here
// before a model is asked, so the card keeps V01D's own ink plate.
import { ideaKey } from './merge-rules.js';
import { keeperOf } from './keeper.js';

export const SUBJECT_RAW_MAX = 120, IMG_MAX = 700000; // characters typed (cut before folding); bytes of base64 the row may hold
export const KINDS = { place: 'a place', film: 'a story', song: 'a melody', animal: 'a creature', thing: 'an object', idea: 'an idea', event: 'an event', answer: 'a thing', merge: 'a fusion', skill: 'an arcane instrument' };
const KIND_ALIAS = { person: 'person', people: 'person', cat: 'animal', species: 'animal', film: 'film', movie: 'film', song: 'song', place: 'place', city: 'place', country: 'place', event: 'event', idea: 'idea', merged: 'merge', merge: 'merge', skill: 'skill', miniature: 'skill' };
export const RARITY_STYLE = { mythic: 'blazing gold and crimson light, a halo of arcane sigils', rare: 'warm gold light, floating glyphs', uncommon: 'cool silver light, faint runes', common: 'moody indigo light, soft mist' };

/** the kind word we accept from the page: one of KINDS' keys, 'person' (refused), or 'answer'. Pure. */
export function kindWordOf(v) { const k = String(v == null ? '' : v).toLowerCase().replace(/[^a-z]/g, ''); return KIND_ALIAS[k] || (KINDS[k] ? k : 'answer'); }
export const rarityOf = (v) => { const k = String(v == null ? '' : v).toLowerCase(); return RARITY_STYLE[k] ? k : 'common'; };

/** the typed subject -> one clean line, cut before folding. Pure. */
export const rawSubject = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SUBJECT_RAW_MAX);
/** the folded cache key of a subject (letters, digits, spaces; same fold as the merge cards), or ''. Pure. */
export const subjectKey = (v) => ideaKey(rawSubject(v));

const SEXUAL = /\b(sex\w*|porn\w*|nude\w*|naked|nsfw|erotic\w*|fetish\w*|orgy|genital\w*|penis|vagina|boob\w*|hentai|rape\w*|incest\w*|xxx)\b/;
const HATE = /\b(nazi\w*|swastika\w*|kkk|white power|genocide|lynch\w*|slur\w*|terroris\w*|isis|jihad\w*|suicid\w*|self harm|child abuse|gore|beheading)\b/;
// names we never put in a picture prompt: living artists' styles, franchises, games, companies and their characters (a short list of the commonest;
// the template itself never names any, and a subject that does is painted as V01D's own plate instead)
const BRANDS = /\b(disney|pixar|marvel|dc comics|batman|superman|spider ?man|pokemon|pikachu|mario|zelda|nintendo|sega|sonic|minecraft|fortnite|roblox|star wars|jedi|yoda|harry potter|hogwarts|lord of the rings|hobbit|game of thrones|mickey|minnie|donald duck|simpsons|spongebob|hello kitty|barbie|lego|magic the gathering|yugioh|dungeons and dragons|warhammer|hearthstone|league of legends|overwatch|google|microsoft|nike|coca cola|pepsi|mcdonald|starbucks|netflix|ghibli|miyazaki|picasso|van gogh|monet|dali|banksy|rutkowski|artstation|deviantart|midjourney)\b/;

/** why a subject gets no painted card: '' when it may be painted, else a short reason. Pure.
 *  Refused: nothing left after folding, a real person (the page says its kind), sexual or hateful words, a brand or artist, anything the keeper
 *  refuses, and anything shaped like a key or a secret (`isSecret(text)` is passed in by the route: redact() and scrubOut() as merge.js uses). */
export function refusal(raw, kind = 'answer', isSecret = () => false) {
  const r = rawSubject(raw), k = subjectKey(r);
  if (!k) return 'empty';
  if (kindWordOf(kind) === 'person') return 'person';
  if (keeperOf(r)) return 'kept';
  if (isSecret(r)) return 'secret';
  if (/\d{6,}/.test(k.replace(/ /g, '')) || /[a-z0-9]{28,}/i.test(r.replace(/\s/g, ''))) return 'secret';
  if (SEXUAL.test(k)) return 'unsuitable';
  if (HATE.test(k)) return 'unsuitable';
  if (BRANDS.test(k)) return 'brand';
  return '';
}

export const ART_STYLE = 'arcane illuminati engraving, occult tarot-card illustration, all-seeing eye and sacred geometry halo, fine etched linework and gold filigree on deep indigo and black, glowing sigils and mystical light, a single central subject';
/** the fixed prompt: the template, the folded subject, and the kind and rarity phrases from the allow-lists. Nothing else enters it. Pure. */
export function artPrompt(key, kind = 'answer', rarity = 'common') {
  return ART_STYLE + ': ' + String(key).replace(/[^a-z0-9 ]/g, '').slice(0, 60) + ' (' + (KINDS[kindWordOf(kind)] || KINDS.answer) + '), ' + RARITY_STYLE[rarityOf(rarity)] + ', dark frame-ready composition, no text, no letters, no logos, no signature';
}

/** the model's reply -> a data URL, or '' when it is not a small jpeg or png. The reply is { image: '<base64>' } (or the base64 itself). Pure. */
export function imageOf(r) {
  const b = typeof r === 'string' ? r : r && typeof r.image === 'string' ? r.image : '';
  if (!b || b.length > IMG_MAX || !/^[A-Za-z0-9+/]+={0,2}$/.test(b)) return '';
  if (b.startsWith('/9j/')) return 'data:image/jpeg;base64,' + b;
  if (b.startsWith('iVBORw0KGgo')) return 'data:image/png;base64,' + b;
  return '';
}
/** the only image sources a card may show or save: a small data URL of a jpeg, png or webp. Pure. */
export const safeImg = (u) => (typeof u === 'string' && u.length <= IMG_MAX + 40 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(u) ? u : '');
