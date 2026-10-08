/**
 * piggybank miniature — a blown-glass piggy bank on the desk that fills with coins toward a savings goal. Silver coins
 * are what you put in, gold the growth interest added (the same colours as the coin stacks in mini/savings.js). On a
 * goal answer the level rises from where you start to the goal while coins drop in through the slot.
 * data: { from?: 0..1 (where the level starts), fill: 0..1 (where it ends), gold: 0..1 (growth's share), label?: string }
 */
const A = 0.052, B = 0.04, C = 0.038; // body semi-axes (x long, y up, z across)
const COIN_R = 0.0072, COIN_H = 0.0018;
function slots(phone) { // coin resting places inside the body, bottom first
  const out = [], step = COIN_R * 1.9, lift = COIN_H * 1.7; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = -B * 0.82; y < B * 0.8; y += lift) {
    const off = rnd() * step;
    for (let x = -A; x <= A; x += step) for (let z = -C; z <= C; z += step) {
      const px = x + off * 0.5 + (rnd() - 0.5) * 0.004, pz = z + (rnd() - 0.5) * 0.004;
      if ((px / (A * 0.86)) ** 2 + (y / (B * 0.86)) ** 2 + (pz / (C * 0.86)) ** 2 > 1) continue;
      out.push([px, y, pz, (rnd() - 0.5) * 0.7, rnd() * 6.28, (rnd() - 0.5) * 0.7]);
    }
  }
  const n = phone ? Math.min(out.length, 260) : out.length; // phones: a little coarser
  return phone ? out.filter((_, i) => i % Math.ceil(out.length / n) === 0) : out;
}
export default function build(ctx, data) {
  const { THREE, root, phone, still } = ctx;
  const geos = [], mats = [], G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);
  const glass = M(new THREE.MeshPhysicalMaterial({ color: '#ffe3ea', roughness: 0.04, transparent: true, opacity: 0.2, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide }));
  const frosted = M(new THREE.MeshPhysicalMaterial({ color: '#f4a9bb', roughness: 0.35, transparent: true, opacity: 0.72, clearcoat: 0.8 }));
  const dark = M(new THREE.MeshStandardMaterial({ color: '#2a1a1e', roughness: 0.4 }));
  const silver = M(new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.28 }));
  const gold = M(new THREE.MeshStandardMaterial({ color: '#e0b84a', metalness: 1, roughness: 0.24 }));
  const pig = new THREE.Group(); const lift = B + 0.012; // legs under the belly
  const body = new THREE.Mesh(G(new THREE.SphereGeometry(1, 72, 48)), glass); body.scale.set(A, B, C); body.renderOrder = 3;
  const snout = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0145, 0.016, 0.016, 40).rotateZ(Math.PI / 2)), frosted); snout.position.set(A * 0.98, -0.002, 0);
  const nose = new THREE.Mesh(G(new THREE.CircleGeometry(0.0145, 40).rotateY(Math.PI / 2)), frosted); nose.position.set(A * 0.98 + 0.0081, -0.002, 0);
  const nost = G(new THREE.CircleGeometry(0.0028, 20).rotateY(Math.PI / 2)); for (const z of [-0.005, 0.005]) { const n = new THREE.Mesh(nost, dark); n.position.set(A * 0.98 + 0.0083, -0.002, z); pig.add(n); }
  const earG = G(new THREE.ConeGeometry(0.011, 0.02, 20, 1)); for (const z of [-1, 1]) { const e = new THREE.Mesh(earG, frosted); e.position.set(A * 0.45, B * 0.86, z * C * 0.5); e.rotation.set(z * 0.5, 0, -0.5); e.scale.z = 0.35; pig.add(e); }
  const eyeG = G(new THREE.SphereGeometry(0.0032, 16, 12)); for (const z of [-1, 1]) { const e = new THREE.Mesh(eyeG, dark); e.position.set(A * 0.78, B * 0.42, z * C * 0.5); pig.add(e); }
  const legG = G(new THREE.CylinderGeometry(0.0085, 0.0095, 0.016, 28)); for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const l = new THREE.Mesh(legG, frosted); l.position.set(x * A * 0.52, -B * 0.9 - 0.002, z * C * 0.5); pig.add(l); }
  const curl = new THREE.Curve(); curl.getPoint = (t, v = new THREE.Vector3()) => v.set(-A - 0.004 - t * 0.008, 0.008 + Math.sin(t * Math.PI * 3) * 0.004, Math.cos(t * Math.PI * 3) * 0.004 - 0.004);
  const tail = new THREE.Mesh(G(new THREE.TubeGeometry(curl, 48, 0.0014, 10)), frosted);
  const slot = new THREE.Mesh(G(new THREE.BoxGeometry(0.022, 0.002, 0.004)), dark); slot.position.set(-0.004, B * 0.995, 0);
  for (const m of [snout, tail, ...pig.children]) { m.castShadow = true; }
  body.castShadow = false;
  pig.add(body, snout, nose, tail, slot);
  // coins: one instanced mesh per metal over the precomputed resting places
  const P = slots(phone), coinG = G(new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 32));
  const S = new THREE.InstancedMesh(coinG, silver, P.length), Gd = new THREE.InstancedMesh(coinG, gold, P.length); S.castShadow = Gd.castShadow = true;
  pig.add(S, Gd);
  const drop = new THREE.Mesh(coinG, gold); drop.rotation.x = Math.PI / 2; drop.visible = false; drop.castShadow = true; pig.add(drop);
  pig.position.y = lift; pig.rotation.y = -0.5; root.add(pig);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  let level = -1, shown = { coins: 0, gold: 0 };
  function setLevel(f, goldShare) {
    const n = Math.round(Math.max(0, Math.min(1, f)) * P.length), ng = Math.round(n * Math.max(0, Math.min(1, goldShare || 0))), ns = n - ng;
    let si = 0, gi = 0;
    for (let i = 0; i < n; i++) { const p = P[i]; m4.compose(v.set(p[0], p[1], p[2]), q.setFromEuler(e.set(p[3], p[4], p[5])), one); if (i < ns) S.setMatrixAt(si++, m4); else Gd.setMatrixAt(gi++, m4); }
    S.count = si; Gd.count = gi; S.instanceMatrix.needsUpdate = Gd.instanceMatrix.needsUpdate = true; level = f; shown = { coins: n, gold: ng };
  }
  let d = data || {}, t = 0, dropT = 0;
  const dur = () => (still ? 0 : 3.5);
  function start(nd) { d = nd || {}; t = d.from !== undefined && d.from < d.fill ? 0 : dur(); setLevel(t >= dur() ? d.fill : (d.from || 0), d.gold); }
  start(d);
  ctx.frame(root, { view: [0.55, 0.45, 1], pad: 0.8, light: [0.5, 1.3, 0.7], minZoom: 0.55, maxZoom: 2 });
  return {
    update(nd) { const n = nd || {}; if (n.fill !== d.fill || n.gold !== d.gold || n.from !== d.from) start(n); },
    state: () => ({ level, ...shown, total: P.length, dropping: drop.visible }), // for tests
    tick(dt) {
      if (t >= dur() && !drop.visible) return false;
      t += dt; const k = Math.min(1, t / Math.max(0.001, dur())), ease = 1 - (1 - k) ** 3;
      setLevel((d.from || 0) + (d.fill - (d.from || 0)) * ease, d.gold);
      // a coin falls into the slot now and then while it fills
      dropT -= dt; if (k < 1 && dropT <= 0 && !drop.visible) { drop.visible = true; drop.userData.y = B + 0.05; dropT = 0.45; }
      if (drop.visible) { drop.userData.y -= dt * 0.12; drop.position.set(-0.004, drop.userData.y, 0); drop.rotation.y += dt * 4; if (drop.userData.y < B * 0.8) drop.visible = false; }
      return true;
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); S.dispose(); Gd.dispose(); },
  };
}
