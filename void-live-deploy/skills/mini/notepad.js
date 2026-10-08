/**
 * notepad miniature — a yellow legal pad on the desk with your note handwritten on its ruled top sheet (red margin, gummed
 * red binding, a stack of pages under it, the corner lifting a little) and a sharpened pencil beside it.
 * data: { title?: string, text: string }
 */
import { HAND, wrap, rng, pencil } from './paper.js';
const PW = 0.1, PL = 0.14; // the page, metres
function pageTexture(THREE, phone) {
  const Wc = phone ? 512 : 768, Hc = Math.round(Wc * PL / PW); const c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const draw = (title, text) => {
    const g = c.getContext('2d'), u = Wc / 768;
    g.fillStyle = '#f8e36e'; g.fillRect(0, 0, Wc, Hc);
    const noise = rng('pad'); g.fillStyle = 'rgba(160,130,40,0.05)'; for (let i = 0; i < 900; i++) g.fillRect(noise() * Wc, noise() * Hc, 2 * u, 2 * u); // paper tooth
    const top = 150 * u, step = 58 * u, margin = 112 * u;
    g.strokeStyle = 'rgba(60,110,185,0.75)'; g.lineWidth = 2 * u; for (let y = top; y < Hc - 10 * u; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(Wc, y); g.stroke(); }
    g.strokeStyle = 'rgba(200,50,50,0.85)'; g.lineWidth = 2.5 * u; for (const dx of [0, 7 * u]) { g.beginPath(); g.moveTo(margin + dx, 0); g.lineTo(margin + dx, Hc); g.stroke(); }
    const R = rng(String(title) + String(text)); let line = 0;
    g.fillStyle = '#121c52'; g.textBaseline = 'alphabetic';
    if (title) { g.font = '700 ' + Math.round(54 * u) + 'px ' + HAND; g.fillText(String(title).slice(0, 28), margin + 20 * u, top - 14 * u); }
    g.font = '600 ' + Math.round(44 * u) + 'px ' + HAND;
    const lines = wrap(g, text, Wc - margin - 50 * u, Math.floor((Hc - top) / step) - 1);
    for (const l of lines) { line++; g.save(); g.translate(margin + 20 * u + (R() - 0.5) * 6 * u, top + line * step - 9 * u); g.rotate((R() - 0.5) * 0.02); g.fillText(l, 0, 0); g.restore(); }
    t.needsUpdate = true; return lines.length;
  };
  return { t, draw };
}
export default function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const geos = [], mats = [], G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);
  const page = pageTexture(THREE, phone);
  const paperSide = M(new THREE.MeshStandardMaterial({ color: '#efd862', roughness: 0.95 }));
  const pageMat = M(new THREE.MeshStandardMaterial({ map: page.t, roughness: 0.92, side: THREE.DoubleSide }));
  const card = M(new THREE.MeshStandardMaterial({ color: '#8a7a64', roughness: 0.9 }));
  const gum = M(new THREE.MeshPhysicalMaterial({ color: '#a8231f', roughness: 0.4, clearcoat: 0.7 }));
  const stackH = 0.006;
  const back = new THREE.Mesh(G(new THREE.BoxGeometry(PW, 0.0012, PL + 0.012)), card); back.position.set(0, 0.0006, -0.006);
  const stack = new THREE.Mesh(G(new THREE.BoxGeometry(PW - 0.0008, stackH, PL - 0.0006)), paperSide); stack.position.set(0, 0.0012 + stackH / 2, 0);
  // page edges: faint lines down the stack's sides
  const binding = new THREE.Mesh(G(new THREE.BoxGeometry(PW + 0.0006, stackH + 0.0034, 0.013)), gum); binding.position.set(0, 0.0012 + (stackH + 0.0034) / 2, -PL / 2 - 0.0035);
  // the top sheet: a plane bent up at the bottom right corner
  const sheetG = G(new THREE.PlaneGeometry(PW - 0.0008, PL - 0.0006, 24, 32).rotateX(-Math.PI / 2)); const pos = sheetG.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / PW + 0.5, z = pos.getZ(i) / PL + 0.5; const k = Math.max(0, x + z - 1.45); pos.setY(i, k * k * 0.05); }
  sheetG.computeVertexNormals();
  const sheet = new THREE.Mesh(sheetG, pageMat); sheet.position.y = 0.0012 + stackH + 0.0002;
  for (const m of [back, stack, binding]) { m.castShadow = m.receiveShadow = true; } sheet.castShadow = sheet.receiveShadow = true;
  const pen = pencil(THREE, 0.14, G, M); pen.rotation.y = 2.6; pen.position.set(PW * 0.3, 0.0012 + 0.006 + 0.0002 + pen.position.y, PL * 0.12);
  const pad = new THREE.Group(); pad.add(back, stack, binding, sheet); pad.rotation.y = 0.12;
  root.add(pad, pen);
  let lines = page.draw(data && data.title, data && data.text);
  // frame the written top of the pad (the band is wide and short; the blank lines below can run off the bottom)
  const focus = new THREE.Mesh(G(new THREE.BoxGeometry(PW * 1.05, 0.01, PL * 0.62)), M(new THREE.MeshBasicMaterial({ visible: false }))); focus.position.set(0, 0.005, -PL * 0.2); root.add(focus);
  ctx.frame(focus, { view: [0.05, 1, 0.5], pad: 0.92, light: [0.4, 1.3, 0.5], minZoom: 0.5, maxZoom: 2 });
  let d = data || {};
  return {
    update(nd) { const n = nd || {}; if (n.text !== d.text || n.title !== d.title) { lines = page.draw(n.title, n.text); } d = n; },
    state: () => ({ lines, text: d.text || '' }), // for tests
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); page.t.dispose(); },
  };
}
