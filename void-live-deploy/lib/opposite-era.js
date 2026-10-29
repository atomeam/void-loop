// opposite-era — what stage pack E shares (asked by the owner, 2026-10-18: the Opposite Era: riot, mutation chamber, sudden death,
// overload, mass extinction): which things on the stage are safe from being taken, the seeded picks, and the one small escaper the
// stage kinds use for their own text. Pure: no DOM, no clock, no Math.random; every pick takes its random source.
import { rng } from './field-kit.js';
export { rng };

/** kinds the pack puts up itself (a countdown banner, the overload's mini-cards): never a victim of sudden death or extinction */
export const PACK_KINDS = new Set(['sudden-death']);

/** a thing nobody may take: a kept card, one marked keep, or one put where it is by hand (pinned). Pure. */
export const isSafe = (t) => !!t && (t.kind === 'kept' || !!t.keep || !!t.pinned);

/** the ids of the things that may be taken, in stage order. Pure. */
export const removable = (things) => Object.values(things || {}).filter((t) => t && t.id && !isSafe(t) && !PACK_KINDS.has(t.kind)).map((t) => t.id);

/** one of the list at random (r is () => [0,1)); null for an empty list. Pure. */
export const pickOne = (list, r = Math.random) => (list && list.length ? list[Math.min(list.length - 1, Math.floor(r() * list.length))] : null);

/** a short name for a thing in a line to the person. Pure. */
export const nameOf = (t) => String((t && (t.name || t.title || t.label || t.kind)) || 'thing').slice(0, 24);

/** text safe inside HTML. Pure. */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** the stage element of a thing, or null. */
export const elOf = (st, id) => (st && st.stage ? st.stage.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(id)) : String(id)) + '"]') : null);

/** the system asks for less motion. */
export const stillness = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
