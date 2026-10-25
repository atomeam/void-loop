/**
 * calculator miniature — a calculator on the desk, in five Verse models that take turns (owner, 2026-10-25: "maybe a cycle of all the
 * existing calculators too for 3d, all with verse branding but also saying which model"): the SL-200 SOLAR pocket one (solar strip,
 * 8-digit LCD), the FX-900 SCIENTIFIC (dark case, two-line display, six columns of small keys, an amber SHIFT), the DT-12 DESK (a wide
 * wedge, big soft keys, a 12-digit tilted display, 00 and tax keys, a paper roll that prints the sum), the RP-11 FINANCIAL (landscape,
 * gold on brown, rows of ten, an ENTER bar, n i PV PMT FV) and the GX-84 GRAPHING (tall, a pixel screen drawing a sine wave, an arrow
 * cluster, F1–F5). One builder, each model a row of MODELS (case, display, key rows, badge): data, not a copy. The badge names the
 * model and says what kind it is; never a real maker's name.
 * When the card gets a new sum the keys press one by one for the expression, the display follows what was typed, then "=" and the
 * result. Tapping a key works it as a real calculator (owner, 2026-10-25: "the buttons are pressing but nothing is showing up"): digits
 * and the point type, + − × ÷ chain, = (ENTER, EXE) answers, C (AC, CE, CLR, ON) clears, ± and % act on what is typed, √ and x² too; a
 * key the four-function logic has no use for (sin, PMT, F3, an arrow) presses and does nothing else.
 * data: { expression: '12*7', result: '84', typed?: bool (true = play the key presses now), model?: 'FX-900' (SL-200 when missing) }
 */
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', E: 'afged', r: 'eg', o: 'cdeg' };
// what a labelled key means to the four-function logic: other labels are a no-op that still presses
export const CANON = { ENTER: '=', EXE: '=', AC: 'C', CE: 'C', CLR: 'C', ON: 'C', 'ON/C': 'C', '(−)': '±', CHS: '±' };
const R = (k, w, h, gapX) => ({ k, w, h, gapX }); // a key row with its own key size and gap (the model's defaults when left out)
/** the five models. Metres. case: w across, l front to back, t thick (tb: thicker at the back makes a wedge). display: one seg line,
 *  seg2 (small expression line over the digits) or pixel (a graphing screen); w is the glass width, z its centre. keys: rows of labels
 *  ('' is an empty slot, wide lists the labels that take two columns), z0 the first row's centre. badge: [model line, what kind it is]. */
export const MODELS = [
  { id: 'SL-200', badge: ['SL-200  SOLAR', 'pocket solar'], case: { w: 0.074, l: 0.118, t: 0.01, color: '#1e2023', r: 0.008 },
    face: { z: -0.046, w: 0.064, h: 0.02, solar: true }, display: { kind: 'seg', digits: 8, z: -0.021, w: 0.056, bezelH: 0.024 },
    keys: { w: 0.0128, h: 0.0098, gapX: 0.0036, gapZ: 0.003, z0: -0.002, wide: ['0'], rows: [R(['C', '±', '%', '÷']), R(['7', '8', '9', '×']), R(['4', '5', '6', '−']), R(['1', '2', '3', '+']), R(['0', '.', '='])] } },
  { id: 'FX-900', badge: ['FX-900  SCIENTIFIC', 'scientific'], case: { w: 0.08, l: 0.13, t: 0.012, color: '#111318', r: 0.007 },
    face: { z: -0.0565, w: 0.066, h: 0.016 }, display: { kind: 'seg2', digits: 10, z: -0.031, w: 0.066, bezelH: 0.034 },
    keys: { w: 0.012, h: 0.0085, gapX: 0.0025, gapZ: 0.0042, z0: -0.0055, rows: [
      R(['SHIFT', 'x²', '^', '√', '(', ')'], 0.01, 0.0068), R(['sin', 'cos', 'tan', 'log', 'ln', 'EXP'], 0.01, 0.0068),
      R(['7', '8', '9', 'DEL', 'AC']), R(['4', '5', '6', '×', '÷']), R(['1', '2', '3', '+', '−']), R(['0', '.', '±', 'Ans', '='])] },
    keyColors: { s: '#d9a21b' } },
  { id: 'DT-12', badge: ['DT-12  DESK', 'desk printing'], case: { w: 0.14, l: 0.17, t: 0.013, tb: 0.03, color: '#c3c0b5', r: 0.006 }, tape: true,
    face: { z: -0.034, w: 0.07, h: 0.011, dark: true }, display: { kind: 'seg', digits: 12, z: -0.0575, w: 0.118, bezelH: 0.03 },
    keys: { w: 0.019, h: 0.016, gapX: 0.005, gapZ: 0.006, z0: -0.017, wide: ['='], rows: [
      R(['TAX+', 'TAX−', 'MU', 'C', 'AC']), R(['7', '8', '9', '÷', '×']), R(['4', '5', '6', '−', '%']), R(['1', '2', '3', '+', '√']), R(['0', '00', '.', '='])] },
    keyColors: { d: '#f3f2ec', o: '#5a5e66', f: '#5a5e66', e: '#e07a2e', c: '#c4483c' } },
  { id: 'RP-11', badge: ['RP-11  FINANCIAL', 'RPN financial'], case: { w: 0.13, l: 0.08, t: 0.012, color: '#2a221d', r: 0.005 }, gold: '#c9a24a',
    face: { x: 0.045, z: -0.024, w: 0.03, h: 0.02 }, display: { kind: 'seg', digits: 10, x: -0.018, z: -0.024, w: 0.08, bezelH: 0.02 },
    keys: { w: 0.0098, h: 0.0075, gapX: 0.0022, gapZ: 0.003, z0: -0.004, wide: ['ENTER'], rows: [
      R(['n', 'i', 'PV', 'PMT', 'FV', '±', '7', '8', '9', '÷']), R(['%', 'Δ%', 'NPV', 'IRR', 'R↓', 'x⇄y', '4', '5', '6', '×']),
      R(['ENTER', 'CLR', 'STO', 'RCL', 'AMORT', '1', '2', '3', '−']), R(['ON', 'f', 'g', 'BEG', 'END', 'PRICE', '0', '.', 'Σ+', '+'])] },
    keyColors: { d: '#e9e2d2', o: '#3a302a', f: '#3a302a', e: '#b8862b', c: '#3a302a', s: '#c9a24a', g: '#3d7bd9' } },
  { id: 'GX-84', badge: ['GX-84  GRAPHING', 'graphing'], case: { w: 0.088, l: 0.19, t: 0.016, color: '#2b2d33', r: 0.007 },
    face: { z: -0.0245, w: 0.07, h: 0.011 }, display: { kind: 'pixel', digits: 12, z: -0.059, w: 0.07, bezelH: 0.058 },
    keys: { w: 0.011, h: 0.0072, gapX: 0.0045, gapZ: 0.0038, z0: -0.013, rows: [
      R(['F1', 'F2', 'F3', 'F4', 'F5'], 0.0105, 0.006), R(['2nd', 'MODE', 'DEL', '', '▲', ''], 0.011, 0.0072, 0.002), R(['ALPHA', 'X,T,θ', 'STAT', '◀', '', '▶'], 0.011, 0.0072, 0.002),
      R(['MATH', 'APPS', 'PRGM', '', '▼', ''], 0.011, 0.0072, 0.002), R(['x⁻¹', 'sin', 'cos', 'tan', '^']), R(['x²', ',', '(', ')', '÷']), R(['log', '7', '8', '9', '×']),
      R(['ln', '4', '5', '6', '−']), R(['STO', '1', '2', '3', '+']), R(['ON', '0', '.', '(−)', 'ENTER'])] },
    keyColors: { s: '#d9a21b', g: '#3f9b5a' } },
];
export const MODEL_IDS = MODELS.map((m) => m.id);
export const modelOf = (id) => MODELS.find((m) => m.id === String(id || '').toUpperCase()) || MODELS[0];
const kindOf = (lab) => { const c = CANON[lab] || lab; return /^(\d+|\.)$/.test(c) ? 'd' : c === '=' ? 'e' : c === 'C' ? 'c' : /^(SHIFT|2nd|f)$/.test(lab) ? 's' : /^(ALPHA|g)$/.test(lab) ? 'g' : /^[+−×÷%±]$/.test(c) ? 'o' : 'f'; };
/** every key of a model on its top face: { lab, x, z, w, h, kind } (pure; the unit test checks each lies inside the case) */
export function layoutKeys(spec) {
  const K = spec.keys, out = []; let z = K.z0, prevH = null;
  for (const row of K.rows) {
    const w = row.w || K.w, h = row.h || K.h, gapX = row.gapX !== undefined ? row.gapX : K.gapX;
    if (prevH !== null) z += prevH / 2 + K.gapZ + h / 2;
    const units = row.k.reduce((n, lab) => n + ((K.wide || []).includes(lab) ? 2 : 1), 0), total = units * w + (units - 1) * gapX;
    let x = -total / 2;
    for (const lab of row.k) {
      const u = (K.wide || []).includes(lab) ? 2 : 1, kw = u * w + (u - 1) * gapX;
      if (lab) out.push({ lab, x: x + kw / 2, z, w: kw, h, kind: kindOf(lab) });
      x += kw + gapX;
    }
    prevH = h;
  }
  return out;
}
/** true when every key sits on the case with a 3 mm margin at the sides and 4 mm at the front (owner, 2026-10-25: "the bottom keys hang over") */
export function keysFit(spec) {
  const { w, l } = spec.case;
  return layoutKeys(spec).every((k) => k.x - k.w / 2 >= -w / 2 + 0.003 && k.x + k.w / 2 <= w / 2 - 0.003 && k.z - k.h / 2 >= -l / 2 && k.z + k.h / 2 <= l / 2 - 0.004);
}
/** the keys a person would press for this expression */
export function keysFor(expr) {
  const s = String(expr || '').toLowerCase().replace(/\s*of\s*/g, '×').replace(/\*\*|\^/g, '').replace(/[x*]/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  const out = []; for (const ch of s) if (/[0-9.+×÷−%]/.test(ch)) out.push(ch);
  return out;
}
function fitDisplay(v, digits = 10) {
  const n = Number(v); if (!isFinite(n)) return v === '' || v === undefined || v === null ? '0' : 'Error'; // NaN (8 ÷ 0) is an Error, an empty result is 0
  let s = String(n); if (s.replace(/[-.]/g, '').length > digits) { s = n.toPrecision(digits - 1); if (s.includes('e')) s = n.toExponential(Math.min(4, digits - 4)).replace('e+', 'E').replace('e', 'E'); s = s.replace(/(\.\d*?)0+(E|$)/, '$1$2').replace(/\.(E|$)/, '$1'); }
  return s;
}
// seven-segment digits across `cells` cells; the small line above them on a seg2 display; a graphing screen for 'pixel'
function lcdTexture(THREE, disp) {
  const cells = disp.digits, two = disp.kind === 'seg2', px = disp.kind === 'pixel';
  const c = document.createElement('canvas'); c.width = px ? 560 : cells * 56 + 80; c.height = px ? 400 : two ? 240 : 160;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const draw = (text, op, line) => {
    const g = c.getContext('2d'), Wc = c.width, Hc = c.height; const grad = g.createLinearGradient(0, 0, 0, Hc); grad.addColorStop(0, px ? '#a9b8a2' : '#c3cbb0'); grad.addColorStop(1, px ? '#93a28d' : '#aab396'); g.fillStyle = grad; g.fillRect(0, 0, Wc, Hc);
    if (px) { // a graphing screen: dotted grid, axes, a pixel sine wave, and the number in the status line at the top
      g.fillStyle = 'rgba(40,50,40,0.18)'; for (let x = 20; x < Wc; x += 20) for (let y = 70; y < Hc; y += 20) g.fillRect(x, y, 3, 3);
      g.fillStyle = '#1d221b'; g.fillRect(20, 235, Wc - 40, 4); g.fillRect(Wc / 2 - 2, 70, 4, Hc - 90);
      for (let x = 20; x < Wc - 20; x += 4) { const y = 235 - Math.sin((x - Wc / 2) / 44) * 120; g.fillRect(x, Math.round(y / 4) * 4, 4, 5); }
      g.font = 'bold 30px "Courier New", monospace'; g.textAlign = 'left'; g.fillText('Y1=sin(X)', 24, 390);
      g.fillStyle = 'rgba(29,34,27,0.9)'; g.fillRect(0, 0, Wc, 56); g.fillStyle = '#c3cbb0'; g.font = 'bold 40px "Courier New", monospace'; g.textAlign = 'right'; g.fillText(text, Wc - 20, 42); g.textAlign = 'left'; g.fillText(op || '', 20, 42);
      t.needsUpdate = true; return;
    }
    const cw = 56, dh = 104, top = two ? 114 : 34, right = Wc - 24;
    if (two) { g.fillStyle = '#1d221b'; g.font = '700 46px "Courier New", monospace'; g.textAlign = 'left'; g.fillText(line || '', 24, 66); g.textAlign = 'start'; }
    let chars = []; for (const ch of String(text)) { if (ch === '.') { if (chars.length) chars[chars.length - 1].dot = true; else chars.push({ ch: '0', dot: true }); } else chars.push({ ch }); }
    if (text === 'Error') chars = [...'Error'].map((ch) => ({ ch }));
    chars = chars.slice(-cells);
    for (let i = 0; i < cells; i++) {
      const x = right - (cells - i) * cw, cell = chars[i - (cells - chars.length)];
      seg(g, x + 6, top, cw - 14, dh, 'abcdefg', 'rgba(60,70,50,0.07)', true); // ghost segments, the way a real LCD shows them
      if (cell) seg(g, x + 6, top, cw - 14, dh, SEG[cell.ch] || '', '#1d221b', cell.dot);
    }
    if (op) { g.fillStyle = '#1d221b'; g.font = 'bold 26px Arial, sans-serif'; g.textAlign = 'left'; g.fillText(op, 18, top + 6); }
    t.needsUpdate = true;
  };
  return { t, draw, aspect: c.width / c.height };
}
function seg(g, x, y, w, h, on, color, dot) {
  const k = 0.12 * h, th = Math.max(5, w * 0.17), hh = h / 2; g.fillStyle = color;
  const P = (pts) => { g.beginPath(); pts.forEach(([px, py], i) => { const sx = x + px + (h - py) * k / h; i ? g.lineTo(sx, y + py) : g.moveTo(sx, y + py); }); g.closePath(); g.fill(); };
  const hor = (yy) => P([[th * 0.6, yy], [th * 1.1, yy - th / 2], [w - th * 1.1, yy - th / 2], [w - th * 0.6, yy], [w - th * 1.1, yy + th / 2], [th * 1.1, yy + th / 2]]);
  const ver = (xx, y0, y1) => P([[xx, y0 + th * 0.6], [xx + th / 2, y0 + th * 1.1], [xx + th / 2, y1 - th * 1.1], [xx, y1 - th * 0.6], [xx - th / 2, y1 - th * 1.1], [xx - th / 2, y0 + th * 1.1]]);
  if (on.includes('a')) hor(th / 2); if (on.includes('g')) hor(hh); if (on.includes('d')) hor(h - th / 2);
  if (on.includes('f')) ver(th / 2, 0, hh); if (on.includes('b')) ver(w - th / 2, 0, hh); if (on.includes('e')) ver(th / 2, hh, h); if (on.includes('c')) ver(w - th / 2, hh, h);
  if (dot === true && color !== 'rgba(60,70,50,0.07)') { g.beginPath(); g.arc(x + w + th * 0.5, y + h - th / 2, th * 0.55, 0, Math.PI * 2); g.fill(); }
}
function rrect(THREE, w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
// the side profile of a wedge case (thicker at the back), to extrude across the width
function wedge(THREE, l, tb, tf) { const s = new THREE.Shape(); s.moveTo(-l / 2, 0); s.lineTo(-l / 2, tb); s.lineTo(l / 2, tf); s.lineTo(l / 2, 0); s.closePath(); return s; }
// the badge: VERSE, the model line, what kind it is; the pocket one has its solar strip beside them
function badgeTexture(THREE, spec) {
  const f = spec.face, c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * f.h / f.w); const g = c.getContext('2d'), H = c.height;
  g.fillStyle = f.dark ? '#2a2b2e' : spec.gold ? '#1f1915' : '#1b1c1f'; g.fillRect(0, 0, 512, H);
  const textW = f.solar ? 230 : 512, cx = f.solar ? 26 : 256; g.textAlign = f.solar ? 'left' : 'center';
  if (f.solar) { const cg = g.createLinearGradient(0, 0, 512, 0); cg.addColorStop(0, '#3a2620'); cg.addColorStop(0.5, '#4a3026'); cg.addColorStop(1, '#3a2620');
    g.fillStyle = cg; g.fillRect(250, H * 0.14, 236, H * 0.36); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(250 + i * 59, H * 0.14); g.lineTo(250 + i * 59, H * 0.5); g.stroke(); } }
  const brand = spec.gold || '#c9cbd0', dim = spec.gold ? '#a8894a' : '#8b8e95', fit = (txt, px, maxW) => { let s = px; g.font = `600 ${s}px Arial, sans-serif`; while (s > 8 && g.measureText(txt).width > maxW) { s -= 1; g.font = `600 ${s}px Arial, sans-serif`; } };
  g.fillStyle = brand; fit('VERSE', Math.round(H * 0.3), textW - 20); g.font = g.font.replace('600', 'italic 700'); g.fillText('VERSE', cx, H * 0.38);
  g.fillStyle = dim; fit(spec.badge[0], Math.round(H * 0.16), textW - 20); g.fillText(spec.badge[0], cx, H * 0.62);
  fit(spec.badge[1], Math.round(H * 0.13), textW - 20); g.fillText(spec.badge[1], cx, H * 0.86);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export default function build(ctx, data) {
  const { THREE, root } = ctx;
  let d = data || {}; const spec = modelOf(d.model), { w: W, l: L, t: T } = spec.case, TB = spec.case.tb || T, DIG = spec.display.digits;
  const geos = [], mats = [], texs = [], G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);
  const body = M(new THREE.MeshPhysicalMaterial({ color: spec.case.color, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5 }));
  const bezelM = M(new THREE.MeshPhysicalMaterial({ color: '#0d0e10', roughness: 0.15, clearcoat: 1 }));
  const KC = { d: '#d8d7d2', o: '#3c3f45', f: '#2f3238', e: '#e07a2e', c: '#b8463b', s: '#d9a21b', g: '#3d7bd9', ...(spec.keyColors || {}) };
  const keyMat = Object.fromEntries(Object.entries(KC).map(([k, color]) => [k, M(new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.3 }))]));
  // case: a rounded slab, or a wedge thicker at the back (the desk model); the top face is a group everything else sits on
  const top = new THREE.Group(); let caseM;
  if (TB > T) {
    caseM = new THREE.Mesh(G(new THREE.ExtrudeGeometry(wedge(THREE, L, TB, T), { depth: W, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 4 }).rotateY(-Math.PI / 2).translate(W / 2, 0, 0)), body);
    top.rotation.x = Math.atan((TB - T) / L); top.position.y = (TB + T) / 2 + 0.0012;
  } else {
    caseM = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(THREE, W, L, spec.case.r), { depth: T - 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 4, curveSegments: 10 }).rotateX(-Math.PI / 2)), body);
    caseM.position.y = 0.0015; top.position.y = T;
  }
  caseM.castShadow = caseM.receiveShadow = true; root.add(caseM, top);
  // the badge, printed on a thin plate
  const faceT = badgeTexture(THREE, spec); texs.push(faceT);
  const face = new THREE.Mesh(G(new THREE.PlaneGeometry(spec.face.w, spec.face.h).rotateX(-Math.PI / 2)), M(new THREE.MeshPhysicalMaterial({ map: faceT, roughness: 0.3, clearcoat: 0.6 })));
  face.position.set(spec.face.x || 0, 0.0002, spec.face.z); face.receiveShadow = true;
  // the display in a glossy bezel (a gold frame on the financial one)
  const DS = spec.display, lcd = lcdTexture(THREE, DS); texs.push(lcd.t);
  const bez = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(THREE, DS.w + 0.008, DS.bezelH, 0.002), { depth: 0.0008, bevelEnabled: false }).rotateX(-Math.PI / 2)), bezelM);
  bez.position.set(DS.x || 0, 0, DS.z); bez.receiveShadow = true;
  if (spec.gold) { const ring = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(THREE, DS.w + 0.012, DS.bezelH + 0.004, 0.003), { depth: 0.0006, bevelEnabled: false }).rotateX(-Math.PI / 2)), M(new THREE.MeshStandardMaterial({ color: spec.gold, metalness: 0.9, roughness: 0.3 }))); ring.position.set(DS.x || 0, 0, DS.z); top.add(ring); }
  const lcdM = new THREE.Mesh(G(new THREE.PlaneGeometry(DS.w, DS.w / lcd.aspect).rotateX(-Math.PI / 2)), M(new THREE.MeshPhysicalMaterial({ map: lcd.t, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 })));
  lcdM.position.set(DS.x || 0, 0.0009, DS.z);
  top.add(face, bez, lcdM);
  // the desk model prints: a paper roll at the back and the tape rising from it
  let tapeDraw = null; const tape = [];
  if (spec.tape) {
    const paper = M(new THREE.MeshStandardMaterial({ color: '#f4f2ea', roughness: 0.9 }));
    const roll = new THREE.Mesh(G(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 48).rotateZ(Math.PI / 2)), paper); roll.position.set(0, 0.009, -L / 2 + 0.002); roll.castShadow = true;
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = 256; const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace; texs.push(tt);
    tapeDraw = () => { const g = tc.getContext('2d'); g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#2a2e55'; g.font = '700 34px "Courier New", monospace'; g.textAlign = 'right'; tape.slice(-6).forEach((ln, i, a) => g.fillText(ln, 236, 236 - (a.length - 1 - i) * 40)); tt.needsUpdate = true; };
    tapeDraw();
    const strip = new THREE.Mesh(G(new THREE.PlaneGeometry(0.056, 0.056)), M(new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9, side: THREE.DoubleSide }))); strip.position.set(0, 0.009 + 0.03, -L / 2 - 0.004); strip.rotation.x = -0.2; strip.castShadow = true;
    top.add(roll, strip);
  }
  // keys: one label atlas (8 x 8 cells of 192 x 96)
  const AC = document.createElement('canvas'); AC.width = 1536; AC.height = 768; const ag = AC.getContext('2d'); ag.textAlign = 'center'; ag.textBaseline = 'middle';
  const keysInside = keysFit(spec), laid = layoutKeys(spec);
  const geoFor = new Map(), keyGeo = (w, h) => { const id = w.toFixed(5) + 'x' + h.toFixed(5); if (!geoFor.has(id)) geoFor.set(id, G(new THREE.ExtrudeGeometry(rrect(THREE, w, h, Math.min(w, h) * 0.22), { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0007, bevelSegments: 3, curveSegments: 6 }).rotateX(-Math.PI / 2))); return geoFor.get(id); };
  const keys = new Map(); let n = 0;
  const atlasT = new THREE.CanvasTexture(AC); atlasT.colorSpace = THREE.SRGBColorSpace; atlasT.anisotropy = 8; texs.push(atlasT);
  const labelMat = M(new THREE.MeshBasicMaterial({ map: atlasT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }));
  for (const k of laid) {
    const canon = CANON[k.lab] || k.lab;
    const m = new THREE.Mesh(keyGeo(k.w, k.h), keyMat[k.kind] || keyMat.f); m.position.set(k.x, 0, k.z); m.castShadow = m.receiveShadow = true; m.userData.key = canon;
    const cx = (n % 8) * 192 + 96, cy = Math.floor(n / 8) * 96 + 48; ag.fillStyle = k.kind === 'd' ? '#2a2b2f' : '#ffffff';
    let px = k.lab.length > 1 ? 54 : 72; ag.font = `600 ${px}px "Helvetica Neue", Arial, sans-serif`; while (px > 20 && ag.measureText(k.lab).width > 176) { px -= 2; ag.font = `600 ${px}px "Helvetica Neue", Arial, sans-serif`; }
    ag.fillText(k.lab, cx, cy + 3);
    const ph = Math.min(k.h * 0.92, k.w * 0.95 / 2), pg = G(new THREE.PlaneGeometry(ph * 2, ph).rotateX(-Math.PI / 2)); const uv = pg.attributes.uv; const u0 = (n % 8) / 8, v0 = 1 - (Math.floor(n / 8) + 1) / 8;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 + uv.getY(i) / 8);
    const lm = new THREE.Mesh(pg, labelMat); lm.position.y = 0.0018 + 0.0008 + 0.00005; m.add(lm); lm.raycast = () => {};
    top.add(m); if (!keys.has(canon)) keys.set(canon, { m, y: 0, t: 0 }); n++;
    if (n >= 64) break;
  }
  atlasT.needsUpdate = true;
  root.rotation.y = -0.18;
  ctx.frame(root, { view: [0.12, 1, 0.75], pad: 0.86, light: [0.45, 1.3, 0.55], minZoom: 0.55, maxZoom: 2 });
  // behaviour
  let shown = '0', op = '', line = '', queue = [], wait = 0;
  const show = (txt, o = op, ln = line) => { shown = txt; op = o; line = ln; lcd.draw(txt, o, ln); };
  const print = (ln) => { if (tapeDraw) { tape.push(ln); tapeDraw(); } };
  function play(expr, result) {
    queue = []; let cur = '', typedLine = '';
    for (const k of keysFor(expr)) {
      typedLine += k;
      if (/[0-9.]/.test(k)) { cur += k; queue.push({ k, txt: cur, op: '', line: typedLine }); } else { queue.push({ k, txt: cur || shown, op: k === '%' ? '' : k, line: typedLine }); if (k !== '%') cur = ''; }
    }
    queue.push({ k: '=', txt: fitDisplay(result, DIG), op: '', line: typedLine + '=' });
    wait = 0.25;
  }
  function apply(nd, first) {
    const prev = d; d = nd || {};
    const fresh = first ? !!d.typed : (d.expression !== prev.expression || d.result !== prev.result);
    if (d.expression && fresh && !ctx.still) { show('0', '', ''); play(d.expression, d.result); }
    else { queue = []; show(d.result !== undefined && d.result !== '' ? fitDisplay(d.result, DIG) : '0', '', d.expression ? keysFor(d.expression).join('') + (d.result ? '=' : '') : ''); }
  }
  apply(d, true);
  // a tapped key works the calculator by hand: a four-function pocket calculator's rules (a new number after an operator or =; = repeats nothing)
  let cur = '', acc = null, pend = '', fresh = true;
  const num = () => (cur === '' || cur === '-' ? (acc === null ? 0 : acc) : Number(cur));
  const run = (a, o, b) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : o === '÷' ? (b === 0 ? NaN : a / b) : b);
  const fd = (v) => fitDisplay(v, DIG);
  function press(label) {
    const lab = CANON[label] || label;
    queue = []; const k = keys.get(lab); if (k) k.t = 1;
    const typed = (line.endsWith('=') ? '' : line) + lab; // the small expression line: a new number after = starts it over
    if (/^\d+$/.test(lab)) { if (fresh) cur = ''; if (cur === '0') cur = ''; const add = cur === '' && lab === '00' ? '0' : lab; if (cur.replace(/[-.]/g, '').length + add.length <= DIG) cur += add; fresh = false; show(cur || '0', pend, typed); }
    else if (lab === '.') { if (fresh) cur = ''; if (!cur.includes('.')) cur = (cur || '0') + '.'; fresh = false; show(cur, pend, typed); }
    else if (lab === 'C') { cur = ''; acc = null; pend = ''; fresh = true; show('0', '', ''); print('0 C'); }
    else if (lab === '±') { cur = cur === '' || cur === '0' ? (acc === null ? '0' : fd(-acc)) : cur.startsWith('-') ? cur.slice(1) : '-' + cur; if (acc !== null && (cur === '0' || fresh)) acc = -acc; show(cur, pend); }
    else if (lab === '%') { const v = pend && acc !== null ? acc * num() / 100 : num() / 100; cur = fd(v); fresh = true; show(cur, pend, line + '%'); }
    else if (lab === '√' || lab === 'x²') { const v = lab === '√' ? Math.sqrt(num()) : num() * num(); cur = fd(v); fresh = true; show(cur, pend, (lab === '√' ? '√(' : '(') + line.replace(/^.*[+−×÷]/, '') + (lab === '√' ? ')' : ')²')); }
    else if (lab === '=') { const v = pend ? run(acc, pend, num()) : num(); acc = v; cur = ''; pend = ''; fresh = true; show(fd(v), '', line + '='); print(fd(v) + ' ='); }
    else if (/^[+−×÷]$/.test(lab)) { const v = pend && !fresh ? run(acc, pend, num()) : num(); acc = v; cur = ''; pend = lab; fresh = true; show(fd(v), lab, (line.endsWith('=') ? fd(v) : line) + lab); print(fd(v) + ' ' + lab); }
    // any other key (sin, PMT, F3, an arrow) presses and does nothing else
    ctx.requestRender();
  }
  ctx.onTap((hits) => { const o = hits && hits.find((h) => h.object.userData.key); if (o) press(o.object.userData.key); });
  return {
    update(nd) { apply(nd, false); ctx.requestRender(); },
    press,
    state: () => ({ display: shown, op, pending: queue.length, keysInside, model: spec.id, line }), // for tests (keysInside: every key sits on the case)
    tick(dt) {
      let moved = false;
      if (queue.length) { wait -= dt; if (wait <= 0) { const s = queue.shift(); keys.get(s.k) && (keys.get(s.k).t = 1); show(s.txt, s.op, s.line); if (s.k === '=' || /^[+−×÷]$/.test(s.k)) print(s.txt + ' ' + s.k); wait = s.k === '=' ? 0.3 : 0.17; moved = true; } }
      for (const k of keys.values()) if (k.t > 0) { k.t = Math.max(0, k.t - dt * 7); k.m.position.y = k.y - Math.sin(k.t * Math.PI) * 0.0012; moved = true; }
      return moved ? 'view' : false;
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const t of texs) t.dispose(); },
  };
}
