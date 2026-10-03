/**
 * spin-figure skill — see the back
 * Turns the living figure already on the stage. Does not summon one. Empty surface stays empty.
 * Listed before figure so "spin the figure" wins. "spin motelet" stays on the figure skill.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function spinFigureOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?spin the figure$/i.test(t)) return { deg: 180 };
  if (/^(?:please\s+)?see the back of the figure$/i.test(t)) return { deg: 180 };
  if (/^(?:please\s+)?show the back of the figure$/i.test(t)) return { deg: 180 };
  if (/^(?:please\s+)?turn to see the back$/i.test(t)) return { deg: 180 };
  return null;
}

export function yawAfter(yaw, deg) {
  return ((Number(yaw) || 0) + (deg * Math.PI) / 180) % (2 * Math.PI);
}

async function run(text, api) {
  const hit = spinFigureOf(text);
  if (!hit) return 'none';
  const S = api.stage;
  const things = S && S.things ? S.things() : null;
  if (!things) return 'none';
  const all = Object.values(things).filter((t) => t.kind === 'fig3d' && t.model === 'motelet');
  const target = all[all.length - 1];
  if (!target) {
    if (api.say) api.say('nothing to spin yet: try \u201csummon a figure\u201d');
    return 'none';
  }
  const seat = target.on && things[target.on] ? things[target.on] : target;
  seat.yaw = yawAfter(seat.yaw, hit.deg);
  if (S.save) S.save();
  if (S.render) S.render();
  if (api.say) api.say('turned around');
  return 'spin-figure';
}

export default {
  name: 'spin-figure',
  examples: ['spin the figure', 'see the back of the figure', 'show the back of the figure', 'turn to see the back'],
  nearMisses: ['spin motelet', 'what is a spin', 'throw it off the screen', 'summon a figure'],
  spinFigureOf,
  yawAfter,
  match(lower, text) { return !!spinFigureOf(text); },
  run
};
