// live-cards, a live card keeps running when the stage redraws (owner, 2026-10-29: "all the pages are supposed to be able to work
// together", "combine all the builds into one entity"; asked through the coordinator: live cards must survive a new card opening).
// The stage draws itself again on every new thing (render() in void.html empties it and mounts each card). A card that runs a live
// mind (a field mind: the memory orbs, Swarm, Verse Brain) would start over from nothing each time. keepWhile(el, th) lets such a card
// say when it can stay as it is: render() asks el._liveKeep(things[id]) before it empties the stage and puts the same element back.
// It stays only while it is the same thing (the same object, not a reload or an undo) with the same look: only where it stands, its
// own live state and its board's size may differ. Anything else (a new colour, a new kind) mounts it again as before.

const MOVES = new Set(['x', 'y', 'state', 'card', 'scale', 'geo', 'home']); // what changes while a card lives, without a new mount

/** what a thing looks like, without where it stands or its live state: a string, or null when it cannot be read. Pure. */
export function liveSig(th) {
  if (!th || typeof th !== 'object') return null;
  try { return JSON.stringify(th, function (k, v) { return this === th && MOVES.has(k) ? undefined : v; }); } catch (_) { return null; }
}

/** mark el as a live card for th: el._liveKeep(now) is true while now is th, unchanged but for where it stands and its live state. */
export function keepWhile(el, th) {
  const was = liveSig(th);
  el._liveKeep = (now) => now === th && was !== null && liveSig(now) === was;
  return el;
}
