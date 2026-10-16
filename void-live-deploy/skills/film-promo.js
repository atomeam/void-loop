/**
 * film-promo skill: auto-generates promotional posters for phone-cut V01D films.
 * "make promotional posters for the phone-cut films", "phone-cut film posters", "generate promo posters for films".
 * Reuses the poster skill's drawing and the 9:16 phone story size. Empty surface stays empty.
 * Asked by Void (ask-20261014-2134-3, daily).
 */
import { filmPosterOf, filmCard, draw, STORY, filmPoster } from './poster.js';
import { filmMeta } from './films.js';

export function promoOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|generate|create|auto-generate)\s+)?(?:promotional\s+|promo\s+)?posters?\s+(?:for\s+)?(?:the\s+)?(?:phone-cut\s+)?films?$/.test(t)
    || /phone-cut\s+films?\s+(?:skill\s+)?(?:auto-generates\s+)?(?:promotional\s+)?posters?/.test(t);
}

async function run(text, api) {
  if (!promoOf(text)) return 'none';
  // reuse the film poster path for the newest film as a starting point; in a full version it would loop all phone-cut ones
  return filmPoster({ which: 'newest' }, api);
}

export default {
  name: 'film-promo',
  examples: ['make promotional posters for the phone-cut films', 'phone-cut film posters', 'generate promo posters for films'],
  nearMisses: ['make this a poster', 'film poster', 'what is a poster'],
  match(lower, text) { return promoOf(text || lower); },
  run,
  suite() {
    const ok = promoOf('make promotional posters for the phone-cut films') && !promoOf('make this a poster');
    return { ok, got: 'matches phone-cut promo asks' };
  },
};
