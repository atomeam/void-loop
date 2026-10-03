/**
 * summon-figure skill — living 3D on the stage
 * Uses the figure stage kind already on the stage (fig3d / Motelet). Empty surface stays empty until asked.
 * "summon motelet" stays on the figure skill. This is the generic living-figure ask.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function summonFigureOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?summon a (?:living\s+)?figure$/i.test(t)) return { model: 'motelet' };
  if (/^(?:please\s+)?bring a figure to the stage$/i.test(t)) return { model: 'motelet' };
  if (/^(?:please\s+)?call a figure onto the stage$/i.test(t)) return { model: 'motelet' };
  if (/^(?:please\s+)?summon a living figure$/i.test(t)) return { model: 'motelet' };
  return null;
}

async function run(text, api) {
  const hit = summonFigureOf(text);
  if (!hit) return 'none';
  const S = api.stage;
  if (!S || !api.summon) return 'none';
  const W = S.stage.clientWidth || innerWidth, H = S.stage.clientHeight || innerHeight;
  const ax = Math.round(W / 2), ay = Math.round(H * 0.62);
  const fig = api.summon('fig3d', { model: hit.model, x: ax, y: ay, ax, ay, yaw: 0 });
  if (!fig) return 'none';
  if (S.save) S.save();
  if (S.render) S.render();
  if (api.say) api.say('a living figure · throw it off the screen to send it away');
  return 'summon-figure';
}

export default {
  name: 'summon-figure',
  examples: ['summon a figure', 'summon a living figure', 'bring a figure to the stage', 'call a figure onto the stage'],
  nearMisses: ['summon motelet', 'summon linemote-1', 'what is a figure', 'a chair'],
  summonFigureOf,
  match(lower, text) { return !!summonFigureOf(text); },
  run
};
