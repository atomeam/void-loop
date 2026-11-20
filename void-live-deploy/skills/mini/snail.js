/**
 * snail miniature: a garden snail (Cornu aspersum), the light version of the 3D scene on /world/ (same shell: a banded logarithmic spiral
 * that closes, 4.5 whorls, the soft body coming out of its opening, two long eye stalks). Idles with a slow turn and a feeler sway; the
 * visitor can drag to look around. The full scene (slow time, look inside, weather, sourced facts) is the page at /world/.
 * data: { spin?: turns per second }
 */
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const G = 0.155, R0 = 0.0215, HC = -0.0125, V0 = 0.9, V1 = 4.5 * 2 * Math.PI, S = 0.46; // shell sizes in cm (as /world/snail.js); S scales them to the card
  const US = 28, VS = 150, pos = new Float32Array((US + 1) * (VS + 1) * 3), col = new Float32Array((US + 1) * (VS + 1) * 3), idx = [];
  const lo = new THREE.Color('#d8a45e'), band = new THREE.Color('#5a2f12'), tmp = new THREE.Color();
  for (let j = 0; j <= VS; j++) for (let i = 0; i <= US; i++) {
    const u = (i / US) * Math.PI * 2, v = V0 + (j / VS) * (V1 - V0), k = Math.exp(G * v), r = R0 * k, n = (j * (US + 1) + i) * 3;
    const rad = R0 * 1.05 * k;
    pos[n] = (rad * Math.cos(v) + r * Math.cos(u) * Math.cos(v)) * S; pos[n + 1] = (HC * k + r * Math.sin(u)) * S; pos[n + 2] = (rad * Math.sin(v) + r * Math.cos(u) * Math.sin(v)) * S;
    const b = Math.sin(u * 2 + 0.6) > 0.55 ? 1 : 0; tmp.copy(lo).lerp(band, b * 0.85); col.set([tmp.r, tmp.g, tmp.b], n);
  }
  for (let j = 0; j < VS; j++) for (let i = 0; i < US; i++) { const a = j * (US + 1) + i, b = a + 1, c = a + US + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.setIndex(idx); sg.computeVertexNormals();
  const shellMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(sg, shellMat); shell.castShadow = true;
  const skin = new THREE.MeshPhysicalMaterial({ color: '#b9a98a', roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color('#e8dcc0') });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), skin); body.scale.set(1.9, 0.34, 0.46); body.position.set(0.95, -0.02, 0); body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin); head.scale.set(0.42, 0.34, 0.42); head.position.set(2.55, 0.13, 0);
  const stalkGeo = new THREE.CylinderGeometry(0.025, 0.04, 1, 8); const stalks = [];
  for (const z of [-0.2, 0.2]) {
    const st = new THREE.Group(), cyl = new THREE.Mesh(stalkGeo, skin); cyl.position.y = 0.5; const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: '#2a2a22', roughness: 0.3 }));
    tip.position.y = 1; st.add(cyl, tip); st.position.set(2.7, 0.3, z); st.rotation.set(z * 1.2, 0, -0.5); st.scale.setScalar(0.85); stalks.push(st);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.7, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a3a26', roughness: 0.95 })); ground.position.y = -0.34; ground.receiveShadow = true;
  const g = new THREE.Group(); shell.position.set(0.1, 0.5, 0); g.add(shell, body, head, ...stalks, ground); g.position.x = -0.9; root.add(g);
  ctx.frame(root, { view: [0.3, 0.55, 1], pad: 0.78 });
  const spin = data.spin ?? 0.03;
  return {
    update(d) { if (d && d.spin !== undefined) g.userData.spin = d.spin; },
    tick(dt, t) { // decorative idle motion stays off when the visitor asked for less motion
      if (still) return false;
      g.rotation.y += dt * (g.userData.spin ?? spin) * Math.PI * 2; stalks.forEach((s, i) => { s.rotation.z = -0.5 + Math.sin(t * 0.9 + i * 1.7) * 0.12; s.rotation.x = (i ? 0.24 : -0.24) + Math.sin(t * 0.7 + i) * 0.1; });
      return true;
    },
    dispose() { sg.dispose(); shellMat.dispose(); skin.dispose(); stalkGeo.dispose(); },
  };
}
