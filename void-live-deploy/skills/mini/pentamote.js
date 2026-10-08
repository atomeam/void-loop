/**
 * pentamote miniature — Pentamote-1 from the same boxes as its 3MF (skills/motorbody.js), so the 3D view and the file
 * are one body: an ivory printed housing, three flat copper coils with an iron-filled core tooth through each, the dark
 * ferrite magnet slab above them, and two green TPU flexures holding it from the end walls. Driven slowed down: the
 * coils light in three-phase order and the slab shuttles its 1 mm stroke, stretching one flexure and easing the other.
 * The real printed motor runs far faster and smaller (318 µm at 41.6 Hz); this is the motion, not the speed.
 * Motion is illustration, so it rests when the visitor asked for less motion. data: {} (nothing to set yet).
 */
import { pentamoteParts, PENTAMOTE } from '../motorbody.js';

const S = 0.001; // millimetres to metres
const [W, D] = PENTAMOTE.size;
const toScene = (p) => [(p[0] - W / 2) * S, p[2] * S, (D / 2 - p[1]) * S]; // file is z-up; the scene is y-up

const F = 0.5; // shuttles per second, slowed down so the eye can follow it
/** The drive at time t (seconds): the slab's offset in mm (±stroke/2) and each coil's glow (three-phase, peak 0.55). */
export function driveAt(t) {
  const ph = 2 * Math.PI * F * t;
  return { d: (PENTAMOTE.stroke / 2) * Math.sin(ph), glow: [0, 1, 2].map((k) => 0.55 * Math.max(0, Math.cos(ph - (k * 2 * Math.PI) / 3))) };
}

export default function build(ctx) {
  const { THREE, root, still } = ctx;
  const geos = [], mats = [];
  const M = (m) => (mats.push(m), m);
  const look = [
    M(new THREE.MeshPhysicalMaterial({ color: '#e6dfcc', roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6 })), // printed dielectric
    null, // copper: one material per coil, so each can glow on its own phase
    M(new THREE.MeshStandardMaterial({ color: '#5d6168', metalness: 0.55, roughness: 0.48 })), // iron-filled soft-magnetic
    M(new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.15, roughness: 0.78 })), // ferrite hard-magnetic
    M(new THREE.MeshPhysicalMaterial({ color: '#3f9a4d', roughness: 0.82, sheen: 0.3, sheenColor: new THREE.Color('#9fe3a8') })), // TPU
  ];
  const coilMat = [0, 1, 2].map(() => M(new THREE.MeshStandardMaterial({ color: '#c27a45', metalness: 1, roughness: 0.32, emissive: '#ff6a1a', emissiveIntensity: 0 })));
  const mesh = (tris, mat) => {
    const pos = new Float32Array(tris.length * 9); let o = 0;
    for (const t of tris) for (const p of t) { const q = toScene(p); pos[o++] = q[0]; pos[o++] = q[1]; pos[o++] = q[2]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const parts = pentamoteParts();
  const body = new THREE.Group(); root.add(body);
  body.add(mesh(parts[0].tris, look[0]), mesh(parts[2].tris, look[2]));
  // the coils, split by which of the three rings each triangle belongs to
  const rings = [[], [], []];
  for (const t of parts[1].tris) { const cx = (t[0][0] + t[1][0] + t[2][0]) / 3; rings[Math.max(0, Math.min(2, Math.floor((cx - 3.5) / 5.5)))].push(t); }
  rings.forEach((r, k) => body.add(mesh(r, coilMat[k])));
  // the moving parts as boxes, so they can slide and stretch
  const boxMesh = (b, mat, pivotX) => {
    const g = new THREE.BoxGeometry((b[1] - b[0]) * S, (b[5] - b[4]) * S, (b[3] - b[2]) * S);
    g.translate(((b[1] - b[0]) / 2 - (pivotX - b[0])) * S, 0, 0); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    const c = toScene([pivotX, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2]); m.position.set(c[0], c[1], c[2]); body.add(m); return m;
  };
  const mb = PENTAMOTE.boxes[3][0], [fl, fr] = PENTAMOTE.boxes[4];
  const magnet = boxMesh(mb, look[3], (mb[0] + mb[1]) / 2);
  const left = boxMesh(fl, look[4], fl[0]), right = boxMesh(fr, look[4], fr[1]);
  const home = magnet.position.x, lenL = fl[1] - fl[0], lenR = fr[1] - fr[0];
  ctx.frame(root, { view: [0.3, 1.7, 0.9], pad: 1.02 });

  function pose(t) {
    const { d, glow } = driveAt(t); // d in mm
    magnet.position.x = home + d * S;
    left.scale.x = (lenL + d) / lenL; right.scale.x = (lenR - d) / lenR;
    coilMat.forEach((m, k) => { m.emissiveIntensity = glow[k]; });
  }
  pose(0);
  return {
    update() {},
    tick(dt, t) { if (still) return false; pose(t); return 'view'; },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
  };
}
