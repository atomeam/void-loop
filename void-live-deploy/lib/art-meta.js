// Card art that follows the item's real metadata (asked by Verse: "make the art on song and film cards follow the item's real metadata, so the
// style evolves with the data and is not just one static kind"). Only fields the sources returned are read: a film's genre and year (lib/movies.js,
// #984's metadata), a song's genre (primaryGenreName) and year (releaseDate) from the iTunes result (lib/media.js). They map onto looks that
// lib/card-art.js already has and nothing else: the plate's hue, and an ink look from RARITY_LOOK (weight, wobble, density). No model call, no
// network, no clock, no randomness: the same genre and year always give the same look; a field the source did not return changes nothing.
// The two rules are this module's own display choices, not measurements: a genre word picks a hue (GENRE_HUES, the first match in the order
// written); the decade sets the ink: older work is drawn in heavier, steadier ink (the classics are mythic ink), newer in lighter, looser ink.
// The ink is the line quality only: a card's foil and gem still come from its evidence rating, never from a film's age.
export const GENRE_HUES = [
  ['horror', 350], ['thriller', 330], ['crime', 310], ['mystery', 300], ['sci', 190], ['fantasy', 270], ['animation', 130], ['family', 120],
  ['comedy', 48], ['romance', 335], ['musical', 290], ['western', 28], ['war', 8], ['history', 36], ['biograph', 40], ['documentary', 95], ['adventure', 160], ['action', 18], ['drama', 225],
  ['metal', 0], ['punk', 355], ['rock', 8], ['hip', 280], ['rap', 280], ['r&b', 295], ['soul', 295], ['funk', 305], ['jazz', 215], ['blues', 235], ['classical', 52], ['country', 34],
  ['folk', 80], ['reggae', 120], ['latin', 22], ['electronic', 180], ['dance', 175], ['house', 175], ['ambient', 200], ['pop', 315], ['soundtrack', 250], ['children', 125], ['alternative', 150],
];
/** the hue (0-359) a genre text names, or null when it names none we know. The first word in the text that matches, in the order of GENRE_HUES. Pure. */
export function genreHue(genre) {
  const g = String(genre == null ? '' : genre).toLowerCase();
  if (!g) return null;
  for (const [w, h] of GENRE_HUES) if (g.includes(w)) return h;
  return null;
}
/** the decade a 4-digit year sits in (1994 -> 1990), or null for anything else or a year outside 1850-2100. Pure. */
export function decadeOf(year) {
  const y = /^\d{4}$/.test(String(year == null ? '' : year).trim()) ? +String(year).trim() : NaN;
  return y >= 1850 && y <= 2100 ? Math.floor(y / 10) * 10 : null;
}
/** the ink a decade is drawn in, as a RARITY_LOOK key: before 1970 mythic, 1970s-80s rare, 1990s-2000s uncommon, 2010 on common; null with no decade. Pure. */
export function inkOfDecade(decade) {
  if (decade == null) return null;
  return decade < 1970 ? 'mythic' : decade < 1990 ? 'rare' : decade < 2010 ? 'uncommon' : 'common';
}
/**
 * The look of one item's art from its real metadata: { hue, ink, decade, why }. hue and ink are null when the source gave no usable genre / year, and
 * then the card keeps its usual look. `why` says what drove it, in words, from the fields only (nothing invented). Pure and deterministic.
 */
export function artLook({ genre = '', year = '' } = {}) {
  const hue = genreHue(genre), decade = decadeOf(year), ink = inkOfDecade(decade), why = [];
  if (hue !== null) why.push('genre ' + String(genre).replace(/\s+/g, ' ').trim().slice(0, 40));
  if (decade !== null) why.push(decade + 's');
  return { hue, ink, decade, why: why.join(', ') };
}
