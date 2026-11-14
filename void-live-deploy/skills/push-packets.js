/**
 * push-packets skill — Push Packets. "push packets", "play push packets".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './push-packets-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function pushPacketsOf(text) { return asked(text, ['push packets']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'push-packets', title: 'Push Packets', sub: 'push the packet onto the mark', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!pushPacketsOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'push-packets');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'push-packets'; }
  api.summon('push-packets', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Push Packets');
  return 'push-packets';
}

export default {
  name: 'push-packets',
  pushPacketsOf,
  examples: ['push packets', 'play push packets'],
  nearMisses: ['play sokoban', 'sokoban'],
  match(lower, text) { return pushPacketsOf(text || lower); },
  run,
  stageKinds: { 'push-packets': { mount } },
};
