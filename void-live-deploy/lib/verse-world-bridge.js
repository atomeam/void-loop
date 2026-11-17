// Shared bridge for Verse's full-screen worlds: a run summary that becomes a VERSE-CARD, a small wave field
// the games can draw behind their scenes, and one place for the game sound helpers. No third-party assets.
import { cardSvg } from './card-image.js';
import { clamp, lerp } from './field-kit.js';

/** A plain, bounded run summary from a game's own state. Pure. */
export function runSummary(game, s = {}) {
  const relics = Array.isArray(s.relics) ? s.relics : [];
  const lines = [
    String(s.title || 'Verse ' + game),
    'Depth ' + (s.depth || 1) + ' · ' + relics.length + ' relics',
    s.note || ''
  ].filter(Boolean);
  return { title: String(game) + ' run', text: lines.join('\n'), typeLine: 'Game · Run summary', kind: 'Game', number: s.seed != null ? 'SEED ' + s.seed : '', chapter: 'games', hue: 220, rarity: 'Rare', adds: 'Saved on this device.' };
}

/** The same card the site exports, given a run summary. Pure. */
export function summarySvg(summary) { return cardSvg(summary); }

/** A small curl-ish wave value in -1..1, shared by the worlds' backgrounds. Pure. */
export function drift(x, y, t = 0) {
  return clamp(Math.sin(x * 0.12 + t) * Math.cos(y * 0.16 - t * 0.7) + 0.35 * Math.sin((x + y) * 0.07 - t * 0.4), -1, 1);
}

/** Blend two field samples for a soft overlay without importing a renderer. Pure. */
export function blend(a, b, t) { return lerp(a, b, clamp(t, 0, 1)); }
