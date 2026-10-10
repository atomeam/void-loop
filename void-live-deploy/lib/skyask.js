/**
 * skyask — the small parts the sky skills (moon tonight, sunrise and sunset, aurora, constellations, meteor showers, eclipses) share:
 * pulling a place out of an ask ("sunset in Oslo"), the phase of the moon as a picture, and a card with a way back to the sky.
 */
const WHEN = /^(?:tonight|today|now|right now|tomorrow|this month|this week|this year|next year|here|please|me)$/;
// "sunset in Oslo" -> { core: 'sunset', place: 'oslo' }; "moon tonight" -> { core: 'moon tonight', place: null }
export function splitPlace(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = /^(.*?)\s+(?:in|at|for|over|near|from)\s+(?:the\s+)?(\p{L}[\p{L} .,'\-]{1,40})$/u.exec(t);
  if (!m || WHEN.test(m[2].toLowerCase()) || /^(?:the\s+)?(?:sky|dark|morning|evening|night|world|uk|us|usa)$/i.test(m[2])) return { core: t.toLowerCase(), place: null };
  return { core: m[1].toLowerCase(), place: m[2].trim() };
}

// the moon's phase as a picture: the lit part is on the right while it waxes (north of the equator; on the left in the south)
export function moonSvg(illumination, waxing, south = false, size = 72) {
  const r = 30, k = Math.max(0, Math.min(1, illumination)), w = r * (1 - 2 * k), right = south ? !waxing : waxing;
  const sweepEdge = right ? 1 : 0, bulge = (w > 0) === right ? 0 : 1;
  const lit = k < 0.004 ? '' : k > 0.996 ? `<circle cx="36" cy="36" r="${r}" fill="#f2efe3"/>`
    : `<path d="M36 ${36 - r} A${r} ${r} 0 0 ${sweepEdge} 36 ${36 + r} A${Math.abs(w).toFixed(2)} ${r} 0 0 ${bulge} 36 ${36 - r}Z" fill="#f2efe3"/>`;
  return `<svg viewBox="0 0 72 72" width="${size}" height="${size}" role="img" aria-label="the moon, ${Math.round(k * 100)}% lit" style="float:right;margin:0 0 8px 12px"><circle cx="36" cy="36" r="${r}" fill="#262c3f"/>${lit}</svg>`;
}

export const SKY_LINK = '<p class="src"><a href="#" data-ask="sky">Open the sky</a> to see it overhead.</p>';
