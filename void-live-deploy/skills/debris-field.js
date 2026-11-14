/**
 * debris-field skill — Debris Field. "debris field", "play debris field".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './debris-field-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function debrisFieldOf(text) { return asked(text, ['debris field']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'debris-field', title: 'Debris Field', sub: 'you are cyan · Verse is violet', w: G.W, h: G.H });
  drive(c, G, { stick: 'x', canvasHud: true, onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!debrisFieldOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'debris-field');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'debris-field'; }
  api.summon('debris-field', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Debris Field');
  return 'debris-field';
}

export default {
  name: 'debris-field',
  debrisFieldOf,
  examples: ['debris field', 'play debris field'],
  nearMisses: ['play asteroids', 'asteroids', 'asteroid'],
  match(lower, text) { return debrisFieldOf(text || lower); },
  run,
  stageKinds: { 'debris-field': { mount } },
};
