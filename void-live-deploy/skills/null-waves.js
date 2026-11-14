/**
 * null-waves skill — Null Waves. "null waves", "play null waves".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './null-waves-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function nullWavesOf(text) { return asked(text, ['null waves']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'null-waves', title: 'Null Waves', sub: 'you are cyan · Verse drops from above', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!nullWavesOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'null-waves');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'null-waves'; }
  api.summon('null-waves', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Null Waves');
  return 'null-waves';
}

export default {
  name: 'null-waves',
  nullWavesOf,
  examples: ['null waves', 'play null waves'],
  nearMisses: ['play space invaders', 'space invaders', 'invaders'],
  match(lower, text) { return nullWavesOf(text || lower); },
  run,
  stageKinds: { 'null-waves': { mount } },
};
