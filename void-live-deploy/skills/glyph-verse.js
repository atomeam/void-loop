/**
 * glyph-verse skill — Glyph Verse. "glyph verse", "play glyph verse".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './glyph-verse-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function glyphVerseOf(text) { return asked(text, ['glyph verse']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'glyph-verse', title: 'Glyph Verse', sub: 'six tries · Verse guesses behind you', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!glyphVerseOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'glyph-verse');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'glyph-verse'; }
  api.summon('glyph-verse', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Glyph Verse');
  return 'glyph-verse';
}

export default {
  name: 'glyph-verse',
  glyphVerseOf,
  examples: ['glyph verse', 'play glyph verse'],
  nearMisses: ['play wordle', 'wordle'],
  match(lower, text) { return glyphVerseOf(text || lower); },
  run,
  stageKinds: { 'glyph-verse': { mount } },
};
