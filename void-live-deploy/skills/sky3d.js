/**
 * sky3d — the clouds, rain, snow and sun glow Void draws, in one place. The weather card's diorama (skills/mini/weather.js)
 * and the clouds summoned onto the stage (skills/figures3d.js) both build from here, so an improvement lands in both.
 * Nothing imports three.js here: the caller passes its THREE. Sizes are in the caller's units (metres in a miniature,
 * CSS px on the stage): a cloud is about `size` across, precipitation falls through the box it is given.
 */

// a small seeded generator (mulberry32): the same seed draws the same cloud in every browser
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A cumulus as lobes [x, y, z, r] in a cloud one unit across: big lobes heaped in the middle, smaller ones at the ends,
// and every lobe's bottom at or above one shared base line, which is what makes a real cumulus read flat underneath.
export function cloudPlan(seed, lobes = 0) {
  const r = rng(seed), n = lobes || 7 + Math.floor(r() * 5), out = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? (i / (n - 1)) * 2 - 1 : 0, mid = 1 - Math.abs(u);
    const rad = 0.13 + mid * 0.11 + r() * 0.05;
    const x = u * 0.36 + (r() - 0.5) * 0.06, y = -0.06 + rad + mid * 0.08 * r(), z = (r() - 0.5) * 0.16;
    out.push([x, y, z, rad]);
  }
  return out;
}

// One cloud: a group of lobes sharing one material and one geometry. The base is squashed flat.
export function makeCloud(THREE, { seed = 1, size = 1, mat, geo, lobes = 0 } = {}) {
  const g = new THREE.Group();
  for (const [x, y, z, rad] of cloudPlan(seed, lobes)) {
    const p = new THREE.Mesh(geo, mat); p.position.set(x * size, y * size, z * size);
    p.scale.set(rad * size, rad * size * (y - rad < 0 ? 0.8 : 1), rad * size * 0.9); p.castShadow = true; p.userData.noContactShadow = true; g.add(p);
  }
  return g;
}
export const cloudGeometry = (THREE) => new THREE.IcosahedronGeometry(1, 3);
// how a cloud looks by how much water it holds: white when light, slate when heavy (rain), darker in a storm
export function cloudShade(water) { const k = Math.max(0, Math.min(1, (water - 0.3) / 0.65)); const c = (a, b) => Math.round(a + (b - a) * k); return '#' + [c(0xf4, 0x56), c(0xf6, 0x5d), c(0xf8, 0x68)].map((v) => v.toString(16).padStart(2, '0')).join(''); }

// Precipitation: instanced streaks (rain) and flakes (snow) recycled from the top of a box to its bottom.
// box: { w, d, top, bottom, x?, z?, round? } in caller units (round: a disc w across, as over a plinth); speed in units per second for rain (snow falls at about 1/18 of it).
export function makePrecip(THREE, { n = 300, box, speed, drop = [0.0003, 0.007], flake = 0.0012 }) {
  const dropG = new THREE.CylinderGeometry(drop[0], drop[0], drop[1], 4), flakeG = new THREE.IcosahedronGeometry(flake, 0);
  const dropMat = new THREE.MeshBasicMaterial({ color: '#b8c8dc', transparent: true, opacity: 0.6 }), flakeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#555555' });
  const drops = new THREE.InstancedMesh(dropG, dropMat, n), flakes = new THREE.InstancedMesh(flakeG, flakeMat, n);
  drops.userData.noContactShadow = flakes.userData.noContactShadow = true; drops.frustumCulled = flakes.frustumCulled = false;
  drops.visible = flakes.visible = false;
  const spot = () => { if (!box.round) return [(Math.random() - 0.5) * box.w, (Math.random() - 0.5) * box.d]; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * box.w / 2; return [Math.cos(a) * r, Math.sin(a) * r]; };
  const P = Array.from({ length: n }, () => { const [x, z] = spot(); return { x: (box.x || 0) + x, z: (box.z || 0) + z, y: box.bottom + Math.random() * (box.top - box.bottom), s: 0.8 + Math.random() * 0.4, ph: Math.random() * 6.28 }; });
  const dummy = new THREE.Object3D();
  return {
    drops, flakes,
    set(kind) { drops.visible = kind === 'rain' || kind === 'storm' || kind === 'sleet'; flakes.visible = kind === 'snow' || kind === 'sleet'; },
    get on() { return drops.visible || flakes.visible; },
    step(dt, t, lean = 0) {
      for (const [m, snow] of [[drops, false], [flakes, true]]) {
        if (!m.visible) continue;
        const v = snow ? speed / 18 : speed, span = box.top - box.bottom;
        for (let i = 0; i < n; i++) { const q = P[i]; q.y -= v * q.s * dt; if (q.y < box.bottom) q.y = box.top - Math.random() * span * 0.1;
          const sx = snow ? Math.sin(t * 1.5 + q.ph) * box.w * 0.03 : 0;
          dummy.position.set(q.x + sx + lean * (q.y - box.bottom) * 0.3, q.y, q.z); dummy.rotation.set(0, 0, snow ? t + q.ph : -lean * 0.6); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
        m.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() { dropG.dispose(); flakeG.dispose(); dropMat.dispose(); flakeMat.dispose(); drops.dispose(); flakes.dispose(); },
  };
}

// a soft additive glow (the sun's halo); returns the sprite, its texture is the caller's to dispose via sprite.material.map
export function makeGlow(THREE, inner = 'rgba(255,220,140,0.9)', mid = 'rgba(255,200,110,0.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.3, mid); gr.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
