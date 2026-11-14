/**
 * jump-stack skill — Jump Stack. "jump stack", "play jump stack".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './jump-stack-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function jumpStackOf(text) { return asked(text, ['jump stack']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'jump-stack', title: 'Jump Stack', sub: 'you are cyan · Verse is violet', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!jumpStackOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'jump-stack');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'jump-stack'; }
  api.summon('jump-stack', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Jump Stack');
  return 'jump-stack';
}

export default {
  name: 'jump-stack',
  jumpStackOf,
  examples: ['jump stack', 'play jump stack'],
  nearMisses: ['play mario', 'super mario', 'platformer'],
  match(lower, text) { return jumpStackOf(text || lower); },
  run,
  stageKinds: { 'jump-stack': { mount } },
};
