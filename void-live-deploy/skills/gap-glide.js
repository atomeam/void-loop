/**
 * gap-glide skill — Gap Glide (skills/gap-glide-rules.js). "gap glide", "play gap glide".
 * You and Verse share one course of gaps. A tap lifts you. Verse aims a little low. The result goes on the arcade ladder.
 */
import * as G from './gap-glide-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function gapGlideOf(text) { return asked(text, ['gap glide', 'glide the gaps']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'gglide', title: 'Gap Glide', sub: 'you are cyan · Verse is violet', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!gapGlideOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'gap-glide');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'gap-glide'; }
  api.summon('gap-glide', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Gap Glide · tap to lift · Verse flies the other glider');
  return 'gap-glide';
}

export default {
  name: 'gap-glide',
  gapGlideOf,
  examples: ['gap glide', 'play gap glide', "let's play gap glide", 'glide the gaps'],
  nearMisses: ['play flappy bird', 'flappy', 'play pong', 'gap year', 'glide path of a plane'],
  match(lower, text) { return gapGlideOf(text || lower); },
  run,
  stageKinds: { 'gap-glide': { mount } },
};
