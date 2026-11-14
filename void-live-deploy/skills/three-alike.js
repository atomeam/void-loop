/**
 * three-alike skill — Three Alike. "three alike", "play three alike".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './three-alike-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function threeAlikeOf(text) { return asked(text, ['three alike']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'three-alike', title: 'Three Alike', sub: 'swap for three alike', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!threeAlikeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'three-alike');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'three-alike'; }
  api.summon('three-alike', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Three Alike');
  return 'three-alike';
}

export default {
  name: 'three-alike',
  threeAlikeOf,
  examples: ['three alike', 'play three alike'],
  nearMisses: ['candy crush', 'bejeweled', 'match three'],
  match(lower, text) { return threeAlikeOf(text || lower); },
  run,
  stageKinds: { 'three-alike': { mount } },
};
