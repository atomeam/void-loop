/**
 * cross-bus skill — Cross the Bus (skills/cross-bus-rules.js). "cross the bus", "play cross the bus".
 * You and Verse cross the same lanes. A block sends you home. The first to the far curb wins, and the result goes on the ladder.
 */
import * as G from './cross-bus-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function crossBusOf(text) { return asked(text, ['cross the bus']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'cbus', title: 'Cross the Bus', sub: 'you are cyan · Verse is violet', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!crossBusOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'cross-bus');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'cross-bus'; }
  api.summon('cross-bus', { x: Math.max(10, Math.round(innerWidth / 2 - 140)), y: 36 });
  api.say('Cross the Bus · step to the far curb · Verse crosses with you');
  return 'cross-bus';
}

export default {
  name: 'cross-bus',
  crossBusOf,
  examples: ['cross the bus', 'play cross the bus', "let's play cross the bus"],
  nearMisses: ['play frogger', 'frogger', 'bus times', 'cross the road safely', 'play snake'],
  match(lower, text) { return crossBusOf(text || lower); },
  run,
  stageKinds: { 'cross-bus': { mount } },
};
