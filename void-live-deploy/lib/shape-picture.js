// lib/shape-picture.js: "draw a red circle" (and "dessine un cercle rouge", "dibuja un círculo rojo", "zeichne einen roten Kreis") as a real picture: the ask read
// into { shape, color } in English, the shape drawn as SVG for the card and on a canvas for the PNG that goes on to /paint/
// (lib/image-handoff.js). The draw skill (skills/draw.js) shows it; the stage's one shape gets the same ask in English, so
// "make the shape blue" still reaches it. Pure except paintShape (a canvas context is passed in). Tests: tools/shape-picture.test.mjs.

/** the colours a shape can be named in, English name -> hex (the drawing card's own palette, skills/draw.js COLORS) */
export const HEX = Object.freeze({ red: '#d6402f', orange: '#ec8a2f', yellow: '#f2cf3a', green: '#3fa556', blue: '#2f6fd6', purple: '#7b47c9', pink: '#e86aa8',
  black: '#111111', white: '#f5f5f5', grey: '#8a8a8a', gray: '#8a8a8a', brown: '#8a5a33', gold: '#d4a72c', teal: '#2a9d8f', cyan: '#3cc7e0' });
export const SHAPES = Object.freeze(['circle', 'square', 'rectangle', 'triangle', 'star', 'heart', 'oval']);
// French, Spanish and (below) German words, to the English ones above (a feminine or plural form reads as its base)
const FR_SHAPE = { cercle: 'circle', rond: 'circle', carré: 'square', carre: 'square', rectangle: 'rectangle', triangle: 'triangle', étoile: 'star', etoile: 'star', cœur: 'heart', coeur: 'heart', ovale: 'oval' };
const FR_COLOR = { rouge: 'red', bleu: 'blue', bleue: 'blue', vert: 'green', verte: 'green', jaune: 'yellow', noir: 'black', noire: 'black', blanc: 'white', blanche: 'white', orange: 'orange', rose: 'pink', violet: 'purple', violette: 'purple', gris: 'grey', grise: 'grey', marron: 'brown', doré: 'gold', dorée: 'gold' };
const ES_SHAPE = { círculo: 'circle', circulo: 'circle', cuadrado: 'square', rectángulo: 'rectangle', rectangulo: 'rectangle', triángulo: 'triangle', triangulo: 'triangle', estrella: 'star', corazón: 'heart', corazon: 'heart', óvalo: 'oval', ovalo: 'oval' };
const ES_COLOR = { rojo: 'red', roja: 'red', azul: 'blue', verde: 'green', amarillo: 'yellow', amarilla: 'yellow', negro: 'black', negra: 'black', blanco: 'white', blanca: 'white', naranja: 'orange', rosa: 'pink', morado: 'purple', morada: 'purple', gris: 'grey', marrón: 'brown', marron: 'brown', dorado: 'gold', dorada: 'gold' };
// German: the colour comes before the shape and takes an ending ("einen roten Kreis", "ein blaues Quadrat", "eine gelbe Raute" is no shape here)
const DE_SHAPE = { kreis: 'circle', quadrat: 'square', rechteck: 'rectangle', dreieck: 'triangle', stern: 'star', herz: 'heart', oval: 'oval' };
const DE_COLOR = { rot: 'red', blau: 'blue', grün: 'green', gruen: 'green', gelb: 'yellow', schwarz: 'black', weiß: 'white', weiss: 'white', orange: 'orange', rosa: 'pink', pink: 'pink', lila: 'purple', violett: 'purple', grau: 'grey', braun: 'brown', golden: 'gold' };
const alt = (o) => Object.keys(o).sort((a, b) => b.length - a.length).join('|');
const EN_COLOR = alt(HEX), EN_SHAPE = SHAPES.join('|');
const SIZE = '(?:(big|large|huge|small|little|tiny)\\s+)?';
const EN = new RegExp('^(?:please\\s+)?(?:can you\\s+)?(?:draw|sketch|paint)\\s+(?:me\\s+)?(?:a|an|one)\\s+' + SIZE + '(' + EN_COLOR + ')\\s+' + SIZE + '(' + EN_SHAPE + ')(?:\\s+please)?\\s*[.!]?$');
const FR = new RegExp('^(?:s\'il te pla[iî]t\\s+)?dessine(?:[- ]moi)?\\s+(?:un|une)\\s+(?:(grand|grande|petit|petite)\\s+)?(' + alt(FR_SHAPE) + ')\\s+(' + alt(FR_COLOR) + ')\\s*[.!]?$');
const ES = new RegExp('^(?:por favor\\s+)?dib[uú]ja(?:me)?\\s+(?:un|una)\\s+(?:(gran|grande|pequeño|pequeña)\\s+)?(' + alt(ES_SHAPE) + ')\\s+(' + alt(ES_COLOR) + ')\\s*[.!]?$');
const DE = new RegExp('^(?:bitte\\s+)?(?:zeichne|male)(?:\\s+mir)?\\s+(?:einen|eine|ein)\\s+(?:(gro(?:ß|ss)(?:en|e|es|er)?|klein(?:en|e|es|er)?)\\s+)?(' + alt(DE_COLOR) + ')(?:n?(?:en|e|es|er)|n)?\\s+(' + alt(DE_SHAPE) + ')(?:\\s+bitte)?\\s*[.!]?$');
const sizeOf = (w) => (!w ? 'normal' : /^(?:big|large|huge|grand|grande|gran|gro(?:ß|ss)\w*)$/.test(w) ? 'big' : 'small');

/** the ask as { shape, color, hex, size, english } (english: the same ask in English, for the stage), or null. A colour is required:
 *  a plain "draw a circle" stays the stage shape's own ask (skills/shape.js plainShape). Pure. */
export function shapeAsk(text) {
  const l = String(text == null ? '' : text).toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
  let shape = null, color = null, size = 'normal', m;
  if ((m = EN.exec(l))) { color = m[2]; shape = m[4]; size = sizeOf(m[1] || m[3]); }
  else if ((m = FR.exec(l))) { shape = FR_SHAPE[m[2]]; color = FR_COLOR[m[3]]; size = sizeOf(m[1]); }
  else if ((m = ES.exec(l))) { shape = ES_SHAPE[m[2]]; color = ES_COLOR[m[3]]; size = sizeOf(m[1]); }
  else if ((m = DE.exec(l))) { shape = DE_SHAPE[m[3]]; color = DE_COLOR[m[2]]; size = sizeOf(m[1]); }
  if (!shape || !color || !HEX[color]) return null;
  if (color === 'gray') color = 'grey';
  return { shape, color, hex: HEX[color], size, english: 'draw a ' + (size === 'normal' ? '' : size + ' ') + color + ' ' + shape };
}

/** the stage shape type for a picture's shape ('circle' or 'rect'), or null when the stage has no such shape (a star stays on the card). Pure. */
export const stageTypeOf = (shape) => (shape === 'circle' ? 'circle' : shape === 'square' || shape === 'rectangle' ? 'rect' : null);

/** the side of the picture in px for a size and a grow step (each "bigger" adds a quarter, each "smaller" takes one off), 80 to 320. Pure. */
export function sideOf(size = 'normal', step = 0) {
  const base = size === 'big' ? 240 : size === 'small' ? 120 : 180;
  return Math.round(Math.min(320, Math.max(80, base * Math.pow(1.25, step))));
}

/** the outline of a shape in a box of side s, as an SVG path's d (a circle and an oval as arcs). Pure. */
export function pathOf(shape, s) {
  const p = s * 0.1, w = s - 2 * p, c = s / 2, r = (n) => Math.round(n * 10) / 10;
  if (shape === 'circle') return 'M ' + r(c - w / 2) + ' ' + r(c) + ' a ' + r(w / 2) + ' ' + r(w / 2) + ' 0 1 0 ' + r(w) + ' 0 a ' + r(w / 2) + ' ' + r(w / 2) + ' 0 1 0 ' + r(-w) + ' 0 Z';
  if (shape === 'oval') return 'M ' + r(p) + ' ' + r(c) + ' a ' + r(w / 2) + ' ' + r(w / 3) + ' 0 1 0 ' + r(w) + ' 0 a ' + r(w / 2) + ' ' + r(w / 3) + ' 0 1 0 ' + r(-w) + ' 0 Z';
  if (shape === 'square') return 'M ' + r(p) + ' ' + r(p) + ' H ' + r(s - p) + ' V ' + r(s - p) + ' H ' + r(p) + ' Z';
  if (shape === 'rectangle') return 'M ' + r(p) + ' ' + r(s * 0.25) + ' H ' + r(s - p) + ' V ' + r(s * 0.75) + ' H ' + r(p) + ' Z';
  if (shape === 'triangle') return 'M ' + r(c) + ' ' + r(p) + ' L ' + r(s - p) + ' ' + r(s - p) + ' L ' + r(p) + ' ' + r(s - p) + ' Z';
  if (shape === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? w * 0.2 : w / 2; pts.push(r(c + rr * Math.cos(a)) + ' ' + r(c + rr * Math.sin(a) + s * 0.03)); }
    return 'M ' + pts.join(' L ') + ' Z';
  }
  // heart: two lobes and a point
  return 'M ' + r(c) + ' ' + r(s - p) + ' C ' + r(p - s * 0.05) + ' ' + r(c + s * 0.05) + ' ' + r(p) + ' ' + r(p + s * 0.05) + ' ' + r(c) + ' ' + r(s * 0.32)
    + ' C ' + r(s - p) + ' ' + r(p + s * 0.05) + ' ' + r(s - p + s * 0.05) + ' ' + r(c + s * 0.05) + ' ' + r(c) + ' ' + r(s - p) + ' Z';
}

/** the picture as an SVG element's markup (a filled shape with a darker edge on transparent ground), scaled to fit its card. Pure. */
export function svgOf(pic, side) {
  const s = side || sideOf(pic.size), d = pathOf(pic.shape, s), label = 'a ' + pic.color + ' ' + pic.shape;
  return '<svg class="vd-shape-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '" role="img" aria-label="' + label + '"'
    + ' style="display:block;max-width:100%;height:auto;margin:6px auto;background:#fbfaf6;border-radius:10px"><path d="' + d + '" fill="' + pic.hex + '" stroke="rgba(0,0,0,.35)" stroke-width="' + Math.max(1, Math.round(s / 90)) + '"/></svg>';
}

/** paints the picture on a 2D context g in a box of side s at its origin (white paper first unless paper is false, so /paint/ cuts it into areas); needs Path2D (false without it) */
export function paintShape(g, pic, s, paper = true) {
  if (paper) { g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, s, s); }
  const P = globalThis.Path2D; if (!P) return false;
  const path = new P(pathOf(pic.shape, s));
  g.fillStyle = pic.hex; g.fill(path);
  g.lineWidth = Math.max(1, Math.round(s / 90)); g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke(path);
  return true;
}

/** "make the picture bigger", "make the drawing smaller", "bigger": +1, -1, or 0 when the ask is not about the picture's size. Pure. */
export function resizeAsk(text) {
  const l = String(text == null ? '' : text).toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
  const m = /^(?:please\s+)?(?:make|draw)\s+(?:the|this|my|that)\s+(?:picture|drawing|image|circle|square|triangle|star|heart|oval|rectangle)\s+(bigger|larger|smaller|tinier)(?:\s+please)?$/.exec(l)
    || /^(?:(?:the|this|my)\s+(?:picture|drawing|image)\s+)(bigger|larger|smaller)(?:\s+please)?$/.exec(l)
    || /^(?:agrandis|agrandir)\s+(?:le|la|l')\s*(?:dessin|image)()$/.exec(l);
  if (!m) return 0;
  return /smaller|tinier/.test(m[1] || '') ? -1 : 1;
}
