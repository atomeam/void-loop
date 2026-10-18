// Tools pack 5, the stage as a picture (owner, 2026-10-18; numbers 101, 102, 108): the asks, the box around some cards, the fallback
// layout, the SVG wrapper that lets the browser paint real cards into a PNG. Pure; the painting is in skills/stage-image.js.
import { tidy } from './stage-pack.js';

export const MAX_SIDE = 4096, MAX_PIXELS = 12000000;

/** { op: 'stage' } "copy the stage as an image" | { op: 'card' } "copy this card as a png" | { op: 'qr' } "qr code for this stage view" | null. Pure. */
export function imageIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, '');
  const IMG = '(?:an?\\s+)?(?:image|picture|png|photo|screenshot)';
  if (new RegExp('^(?:please\\s+)?(?:copy|save|export|download|take|make)\\s+(?:the\\s+|my\\s+)?(?:whole\\s+)?(?:stage|(?:verse|void))\\s+(?:as|to|into)\\s+' + IMG + '$').test(t) || /^(?:please\s+)?(?:take\s+)?a\s+screenshot\s+of\s+(?:the|my)\s+(?:stage|(?:verse|void))$/.test(t) || /^(?:please\s+)?screenshot\s+(?:the|my)\s+(?:stage|(?:verse|void))$/.test(t)) return { op: 'stage' };
  if (new RegExp('^(?:please\\s+)?(?:copy|save|export|download|make)\\s+(?:this|the\\s+(?:selected|open|picked)|that)\\s+(?:card|thing|object|sticky(?:\\s+note)?|note)\\s+(?:as|to|into)\\s+' + IMG + '$').test(t)) return { op: 'card' };
  if (/^(?:please\s+)?(?:make|show|give\s+me|get|create)\s+(?:me\s+)?(?:a\s+)?qr(?:\s+code)?\s+(?:for|of|to)\s+(?:this|the\s+current|my\s+current)\s+(?:stage|(?:verse|void)|view|page|stage\s+view)$/.test(t) || /^(?:please\s+)?qr(?:\s+code)?\s+(?:for|of|to)\s+(?:this|the\s+current|my\s+current)\s+(?:stage|(?:verse|void)|view|page|stage\s+view)$/.test(t) || /^(?:please\s+)?(?:qr\s+code|qr)\s+(?:of\s+)?(?:this\s+)?stage\s+view$/.test(t)) return { op: 'qr' };
  return null;
}

/** the smallest box holding every rect ({ left, top, width, height }), padded, as { x, y, w, h }, or null. Pure. */
export function unionBox(rects, pad = 12) {
  const r = (rects || []).filter((q) => q && q.width > 0 && q.height > 0);
  if (!r.length) return null;
  const l = Math.min(...r.map((q) => q.left)), t = Math.min(...r.map((q) => q.top)), rr = Math.max(...r.map((q) => q.left + q.width)), b = Math.max(...r.map((q) => q.top + q.height));
  return { x: Math.floor(l - pad), y: Math.floor(t - pad), w: Math.ceil(rr - l + 2 * pad), h: Math.ceil(b - t + 2 * pad) };
}

/** the picture's size in pixels: scaled up for sharpness, never past 4096 a side or 12 million pixels. Pure. */
export function pixelSize(w, h, scale = 2) {
  let s = scale;
  while (s > 1 && (w * s > MAX_SIDE || h * s > MAX_SIDE || w * s * h * s > MAX_PIXELS)) s -= 0.5;
  s = Math.max(s, 0.1);
  while (w * s > MAX_SIDE || h * s > MAX_SIDE || w * s * h * s > MAX_PIXELS) s *= 0.8;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), scale: s };
}

/** the SVG text that carries an XHTML tree as a picture the browser can paint to a canvas. Pure. */
export function foreignSvg(xhtml, w, h) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + '</foreignObject></svg>';
}

/** the plain fallback: a rounded box and a label per card, from { left, top, width, height, label, kind } rects, inside box. Pure. */
export function plainLayout(cards, box) {
  return (cards || []).map((c) => ({ x: Math.round(c.left - box.x), y: Math.round(c.top - box.y), w: Math.round(c.width), h: Math.round(c.height), title: String(c.kind || ''), text: String(c.label || '').slice(0, 200) }));
}
