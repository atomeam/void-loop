/**
 * Shared helpers for the paper miniatures (notepad, clipboard): handwriting on a page canvas, a sharpened pencil.
 * Not a miniature kind itself.
 */
export const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive';
/** wrap text into lines that fit maxW at the current font */
export function wrap(g, text, maxW, maxLines) {
  const out = [];
  for (const para of String(text || '').split(/\n/)) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      if (out.length >= maxLines) break;
    }
    out.push(line);
    if (out.length >= maxLines) break;
  }
  if (out.length > maxLines) out.length = maxLines;
  return out;
}
/** a little seeded wobble so handwriting is not perfectly straight */
export function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/** a yellow hex pencil, sharpened, lying along +x; length in metres */
export function pencil(THREE, len = 0.13, G = (g) => g, M = (m) => m) {
  const grp = new THREE.Group(), r = 0.0036;
  const body = new THREE.Mesh(G(new THREE.CylinderGeometry(r, r, len * 0.78, 6).rotateZ(Math.PI / 2)), M(new THREE.MeshPhysicalMaterial({ color: '#f2b51c', roughness: 0.35, clearcoat: 0.6 })));
  const fer = new THREE.Mesh(G(new THREE.CylinderGeometry(r * 1.04, r * 1.04, len * 0.07, 24).rotateZ(Math.PI / 2)), M(new THREE.MeshStandardMaterial({ color: '#c9ad6a', metalness: 1, roughness: 0.3 })));
  const eraser = new THREE.Mesh(G(new THREE.CylinderGeometry(r * 0.98, r * 0.98, len * 0.06, 24).rotateZ(Math.PI / 2)), M(new THREE.MeshStandardMaterial({ color: '#e88f8f', roughness: 0.9 })));
  const wood = new THREE.Mesh(G(new THREE.ConeGeometry(r, len * 0.1, 6, 1, true).rotateZ(-Math.PI / 2)), M(new THREE.MeshStandardMaterial({ color: '#e7c89a', roughness: 0.8 })));
  const lead = new THREE.Mesh(G(new THREE.ConeGeometry(r * 0.32, len * 0.035, 12).rotateZ(-Math.PI / 2)), M(new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.4, roughness: 0.4 })));
  body.position.x = 0; fer.position.x = -len * 0.39 - len * 0.035; eraser.position.x = -len * 0.39 - len * 0.07 - len * 0.03;
  wood.position.x = len * 0.39 + len * 0.05; lead.position.x = len * 0.39 + len * 0.1 - len * 0.0175 + len * 0.0175;
  for (const m of [body, fer, eraser, wood, lead]) { m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  grp.position.y = r * 0.87; return grp;
}
