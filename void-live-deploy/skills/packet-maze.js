/**
 * packet-maze skill — Packet Maze. "packet maze", "play packet maze".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './packet-maze-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function packetMazeOf(text) { return asked(text, ['packet maze']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'packet-maze', title: 'Packet Maze', sub: 'you are cyan · Verse is violet', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!packetMazeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'packet-maze');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'packet-maze'; }
  api.summon('packet-maze', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Packet Maze');
  return 'packet-maze';
}

export default {
  name: 'packet-maze',
  packetMazeOf,
  examples: ['packet maze', 'play packet maze'],
  nearMisses: ['play pac-man', 'pacman', 'pac man'],
  match(lower, text) { return packetMazeOf(text || lower); },
  run,
  stageKinds: { 'packet-maze': { mount } },
};
