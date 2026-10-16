// The angle a thing is best looked at from, the way a game's inventory frames an item (owner, 2026-10-16: "the whole 3D inventory
// should be like a video game ... like Resident Evil or Skyrim ... everything feeling like it knows what angle to put you at ...
// smart film angles"). From the thing's size alone, so every miniature gets it without saying anything:
//   flat   (a book, a board, a clipboard, a sheet): from above and in front, the way Skyrim shows a book on the inventory screen
//   tall   (a figure, a bottle, a vase, a lighthouse): eye level, three-quarter, a little below the top so it stands over you
//   object (everything else): a three-quarter hero shot from a touch above
// A miniature that names its own view keeps it (a board game frames from the player's seat). Pure.
export const HERO = {
  flat: { view: [0.05, 1.45, 0.95], pad: 0.78 },
  tall: { view: [0.6, 0.38, 1], pad: 0.86 },
  object: { view: [0.62, 0.55, 1], pad: 0.8 },
};

/** 'flat' | 'tall' | 'object' from a size { x, y, z } (y up). A size with nothing in it is an object. */
export function heroKind(size) {
  const w = Math.max(0, +(size && size.x) || 0), h = Math.max(0, +(size && size.y) || 0), d = Math.max(0, +(size && size.z) || 0);
  const span = Math.max(w, d);
  if (!span && !h) return 'object';
  if (h < 0.35 * span) return 'flat';
  if (h > 1.25 * span) return 'tall';
  return 'object';
}

/** { view, pad, kind } for a size: the direction the camera looks from (normalised by the caller) and how tight the framing is. */
export function heroView(size) {
  const kind = heroKind(size);
  return { ...HERO[kind], view: HERO[kind].view.slice(), kind };
}

/** The words of the examine prompt: what a hand can do here. Pure. */
export function inspectPrompt({ turn = true, zoom = true, back = 'Esc puts it back' } = {}) {
  return [turn ? 'Drag to turn' : '', zoom ? 'Wheel to zoom' : '', back].filter(Boolean).join(' · ');
}
