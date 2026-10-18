// What a card's art slot shows (owner, 2026-10-18), decided in one place for the card frame, the Art Forge and the saved card image.
// Exactly one picture, never a stack:
//   'photo'    the answer carries its own real art (a poster, a cover, a source image): that is the art and V01D's seal is not drawn at all
//   'painting' an Art Forge painting is present: it is the one picture; no seal or plate stays under it
//   'seal'     everything else (a text-only reply, or a painting still being made): V01D's procedural seal, filling the whole window as the single picture
// Pure.
const isPhoto = (u) => /^https:\/\//.test(String(u || ''));
/** @param {{photo?: string, painting?: string|boolean, hasArt?: boolean}} card photo: the source picture's https link (or a data URL the saved card drew); painting: a painting is present
 *  @returns {'photo'|'painting'|'seal'|'none'} */
export function artSource(card = {}) {
  const c = card || {};
  if (c.hasArt === false) return 'none';
  if (isPhoto(c.photo) || /^data:image\/(?:jpeg|png|webp);base64,/.test(String(c.photo || ''))) return 'photo';
  if (c.painting) return 'painting';
  return 'seal';
}
