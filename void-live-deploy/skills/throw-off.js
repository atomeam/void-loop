/**
 * throw-off skill — figures-first dismiss
 * Click a Void object or person to pick it up. A throw (fast release, or
 * already off the stage) tosses it like a park guest and it is gone.
 * A slow drop sets it back down. Nothing is published.
 */
export const TOSS_SPEED = 0.9; // px per ms; a flick, not a place-down

export function throwOffOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?throw (?:it|this|the figure|the card|the person) off the screen$/i.test(t)) return { what: 'open' };
  if (/^(?:please\s+)?toss (?:it|this) off the screen$/i.test(t)) return { what: 'open' };
  if (/^(?:please\s+)?throw the figure off$/i.test(t)) return { what: 'figure' };
  if (/^(?:please\s+)?pick (?:it|this|one) up and throw$/i.test(t)) return { what: 'open' };
  return null;
}

/** Grab point: the object lifts in the hand. Stage stays empty if nothing was held. */
export function pickup(thing) {
  if (!thing) return { held: false, html: '', published: false };
  return { held: true, id: thing.id, kind: thing.kind || 'object', lift: 18, html: '', published: false };
}

/**
 * Release. thrown = a flick or already outside the stage.
 * gone means it leaves; a gentle drop stays.
 */
export function releaseToss(s) {
  const x = Number(s.x) || 0, y = Number(s.y) || 0;
  const w = Number(s.w) || 0, h = Number(s.h) || 0;
  const stageW = Number(s.stageW) || 0, stageH = Number(s.stageH) || 0;
  const vx = Number(s.vx) || 0, vy = Number(s.vy) || 0;
  const speed = Math.hypot(vx, vy);
  const off = x + w < 0 || y + h < 0 || (stageW && x > stageW) || (stageH && y > stageH);
  const thrown = speed >= TOSS_SPEED || !!off;
  return { thrown, gone: thrown, vx, vy, html: '', published: false };
}

async function run(text, api) {
  const hit = throwOffOf(text);
  if (!hit) return 'none';
  if (api.say) api.say('pick one up and throw it');
  return 'throw-off';
}

export default {
  name: 'throw-off',
  examples: ['throw it off the screen', 'throw this off the screen', 'toss it off the screen', 'throw the figure off', 'pick it up and throw'],
  nearMisses: ['throw a ball', 'what is a screen', 'show the magnetize step', 'make a clock'],
  pickup,
  releaseToss,
  throwOffOf,
  match(lower, text) { return !!throwOffOf(text); },
  run
};
