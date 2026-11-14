/**
 * token-stand skill — Token Stand. "token stand", "play token stand".
 * You and Verse share the round. The result goes on the arcade ladder.
 */
import * as G from './token-stand-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { asked, drive } from '../lib/studio-play.js';

export function tokenStandOf(text) { return asked(text, ['token stand']); }

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'token-stand', title: 'Token Stand', sub: 'set a price · Verse sells at 1', w: G.W, h: G.H });
  drive(c, G, { onDone: (over) => { try { finish(G.id, over); } catch (_) {} } });
}

function run(text, api) {
  if (!tokenStandOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'token-stand');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'token-stand'; }
  api.summon('token-stand', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40 });
  api.say('Token Stand');
  return 'token-stand';
}

export default {
  name: 'token-stand',
  tokenStandOf,
  examples: ['token stand', 'play token stand'],
  nearMisses: ['lemonade stand', 'play lemonade'],
  match(lower, text) { return tokenStandOf(text || lower); },
  run,
  stageKinds: { 'token-stand': { mount } },
};
