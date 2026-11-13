/**
 * nine-grid skill — Nine Grid. "nine grid", "play nine grid".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './nine-grid-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function nineGridOf(text) { return asked(text, ['nine grid']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'nine-grid', title: 'Nine Grid', sub: 'fill the grid · Verse already solved it', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!nineGridOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'nine-grid');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'nine-grid'; }
  api.summon('nine-grid', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Nine Grid');
  return 'nine-grid';
}

export default {
  name: 'nine-grid',
  nineGridOf,
  examples: ['nine grid', 'play nine grid'],
  nearMisses: ['play sudoku', 'sudoku'],
  match(lower, text) { return nineGridOf(text || lower); },
  run,
  stageKinds: { 'nine-grid': { mount } },
};
