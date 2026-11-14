/**
 * stackwell skill — Stackwell. "stackwell", "play stackwell".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './stackwell-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function stackwellOf(text) { return asked(text, ['stackwell']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'stackwell', title: 'Stackwell', sub: 'your well is on the right', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!stackwellOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'stackwell');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'stackwell'; }
  api.summon('stackwell', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Stackwell');
  return 'stackwell';
}

export default {
  name: 'stackwell',
  stackwellOf,
  examples: ['stackwell', 'play stackwell'],
  nearMisses: ['play tetris', 'tetris', 'falling blocks'],
  match(lower, text) { return stackwellOf(text || lower); },
  run,
  stageKinds: { 'stackwell': { mount } },
};
