/**
 * growthtree miniature — Void's growth tree (frontier #3), standing in the growth card: one branch per ledger entry, laid
 * out by skills/growth-tree.js (the oldest entry is the trunk, the newest are at the tips), barked wood tapering by the
 * pipe model, each branch ending in a cluster of real leaves (the season of its entry's date) with a berry in its kind's
 * colour (the card's chips). The think tank's open tracks are faint shoots with no leaves, and the claim being built now
 * glows. Touch a branch, leaf or berry to read its entry (data.onPick(ledgerIndex)), a faint shoot to read what it is
 * (data.onPickGhost(ghost)); the picked one is lit. data.until grows the tree as it stood then (the time slider): going
 * forward, new branches grow in; under reduced motion they are simply there. Everything is posed from data; nothing is kept.
 * data: { entries: the ledger (a list), until?: ISO time, tracks?: [{ name, last }], building?: { what, at, item },
 *   selected?: ledger index, onPick?(ledgerIndex), onPickGhost?(ghost) }
 */
import { layout, hash32, rng } from '../growth-tree.js';

const LEAVES = 9, LEAF = 0.11, BERRIES = 3, BERRY = 0.011, GROW_S = 0.9; // per tip: leaves, leaf length (m), berries, berry radius (m); seconds a branch takes to grow in

// bark: vertical fissures over a grey-brown ground, drawn once on a canvas (colour and bump from the same picture)
function barkTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d'), r = rng(7);
  g.fillStyle = '#7a6a58'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i++) { const v = 70 + r() * 70; g.fillStyle = 'rgba(' + v + ',' + (v * 0.88) + ',' + (v * 0.74) + ',0.35)'; g.fillRect(r() * 128, r() * 256, 1 + r() * 3, 2 + r() * 10); }
  g.strokeStyle = 'rgba(30,22,15,0.85)';
  for (let i = 0; i < 16; i++) { // the fissures wander a little as they run up the bark, and wrap round seamlessly
    let x = (i + r() * 0.6) * 8; g.lineWidth = 1 + r() * 2.2; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 256; y += 16) { x += (r() - 0.5) * 4; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function leafGeometry(THREE) { // a simple elliptic leaf with a pointed tip, lying in its own XY plane, stem at the origin
  const s = new THREE.Shape(); s.moveTo(0, 0);
  s.bezierCurveTo(LEAF * 0.32, LEAF * 0.2, LEAF * 0.3, LEAF * 0.7, 0, LEAF);
  s.bezierCurveTo(-LEAF * 0.3, LEAF * 0.7, -LEAF * 0.32, LEAF * 0.2, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const barkMap = barkTexture(THREE);
  const bark = new THREE.MeshStandardMaterial({ color: '#8a7764', map: barkMap, bumpMap: barkMap, bumpScale: 2.2, roughness: 0.95 });
  const lit = new THREE.MeshStandardMaterial({ color: '#c9a77e', map: barkMap, bumpMap: barkMap, bumpScale: 2.2, roughness: 0.8, emissive: '#5a3a12', emissiveIntensity: 0.6 });
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.62, side: THREE.DoubleSide });
  const berryMat = new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 }); // glossy, like a ripe berry
  const ghostMat = new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.9, transparent: true, opacity: 0.5, depthWrite: false }); // pale bare wood, half there
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffd28a', roughness: 0.6, emissive: '#ff9a2e', emissiveIntensity: 2.4 });
  const leafGeo = leafGeometry(THREE), jointGeo = new THREE.SphereGeometry(1, 16, 12), berryGeo = new THREE.SphereGeometry(1, 14, 10);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.05, 64), new THREE.MeshStandardMaterial({ color: '#3b2c20', roughness: 1 }));
  soil.position.y = -0.025; soil.receiveShadow = true; root.add(soil);
  const tree = new THREE.Group(); root.add(tree);

  let shape = '', T = null, wood = [], ghosts = [], joints = null, leaves = null, berries = null, leafOf = [], leafBase = [], berryBase = [], grownAt = new Map(), selected = null;
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  let lastList = null, lastSig = '';
  const ledgerSig = (list) => { if (list !== lastList) { lastList = list; lastSig = Array.isArray(list) ? list.length + ':' + hash32(JSON.stringify(list)) : '0'; } return lastSig; };
  const signature = (d) => ledgerSig(d.entries) + '|' + (d.until || '') + '|' + hash32(JSON.stringify([d.tracks || null, d.building || null]));
  const nowS = () => performance.now() / 1000;

  function clear() {
    for (const w of wood) { tree.remove(w); w.geometry.dispose(); }
    for (const g of ghosts) { tree.remove(g); g.geometry.dispose(); }
    if (leaves) { tree.remove(leaves); leaves.dispose(); }
    if (berries) { tree.remove(berries); berries.dispose(); }
    if (joints) { tree.remove(joints); joints.dispose(); }
    wood = []; ghosts = []; joints = null; leaves = null; berries = null; leafOf = []; leafBase = []; berryBase = [];
  }
  const lathe = (b) => {
    const geo = new THREE.LatheGeometry(b.profile.map(([f, r]) => new THREE.Vector2(r, f * b.length)), Math.max(8, Math.min(32, Math.round(b.radius * 260))));
    const pos = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / 0.35); // bark keeps its scale up the branch
    return geo;
  };
  function rebuild(d) {
    const first = !T, before = new Set(T ? T.branches.map((b) => b.index + '@' + b.at) : []);
    clear();
    T = layout(d.entries, { until: d.until || undefined, tracks: d.tracks, building: d.building });
    for (const b of T.branches) {
      const mesh = new THREE.Mesh(lathe(b), bark); mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(...b.start); mesh.quaternion.setFromUnitVectors(up, v.set(...b.dir));
      mesh.userData.entry = b.index; tree.add(mesh); wood.push(mesh);
      // a new branch grows in (not on the first build, and not under reduced motion)
      const key = b.index + '@' + b.at;
      if (!first && !ctx.still && !before.has(key)) grownAt.set(key, nowS());
    }
    // knuckles: bark-covered spheres where each branch leaves its parent and at its tip, so no cut end ever shows
    joints = new THREE.InstancedMesh(jointGeo, bark, T.branches.length * 2); joints.castShadow = true;
    T.branches.forEach((b, bi) => {
      joints.setMatrixAt(bi * 2, m4.compose(v.set(...b.start), q.identity(), s3.setScalar(b.radius)));
      joints.setMatrixAt(bi * 2 + 1, m4.compose(v.set(...b.end), q.identity(), s3.setScalar(b.tipRadius)));
    });
    joints.userData.joints = true; tree.add(joints);
    // what is not grown yet: faint bare shoots (the think tank's tracks) and the claim being built, glowing
    T.ghosts.forEach((g, gi) => {
      const mesh = new THREE.Mesh(lathe(g), g.kind === 'building' ? glowMat : ghostMat);
      mesh.position.set(...g.start); mesh.quaternion.setFromUnitVectors(up, v.set(...g.dir));
      mesh.userData.ghost = gi; tree.add(mesh); ghosts.push(mesh);
      if (g.kind === 'building') { // its bud, at the tip, lit from inside
        const bud = new THREE.Mesh(berryGeo, glowMat); bud.scale.setScalar(BERRY * 1.6); bud.position.set(0, g.length, 0); bud.userData.ghost = gi; mesh.add(bud);
      }
    });
    leaves = new THREE.InstancedMesh(leafGeo, leafMat, T.branches.length * LEAVES); leaves.castShadow = true;
    const col = new THREE.Color();
    T.branches.forEach((b, bi) => {
      const r = rng(hash32('leaf|' + b.index + '|' + b.at));
      col.set(b.leaf);
      for (let k = 0; k < LEAVES; k++) {
        const n = bi * LEAVES + k, back = r() * 0.35 * b.length; // clustered on the last third of the branch
        v.set(...b.end).addScaledVector(s3.set(...b.dir), -back);
        e.set((r() - 0.5) * 2.4, r() * Math.PI * 2, (r() - 0.5) * 2.4); q.setFromEuler(e);
        const size = 0.75 + r() * 0.5;
        leafBase.push([v.x, v.y, v.z, q.x, q.y, q.z, q.w, size]);
        leaves.setColorAt(n, col.clone().offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08)); // no two leaves quite the same
        leafOf.push(b.index);
      }
    });
    leaves.userData.leaves = true; tree.add(leaves);
    // the kind, as a small cluster of berries in the card's colour where the leaves are
    berries = new THREE.InstancedMesh(berryGeo, berryMat, T.branches.length * BERRIES); berries.castShadow = true;
    T.branches.forEach((b, bi) => {
      const r = rng(hash32('berry|' + b.index + '|' + b.at));
      col.set(b.color);
      for (let k = 0; k < BERRIES; k++) {
        const along = b.length * (0.88 + r() * 0.1), side = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(BERRY * 1.4);
        v.set(...b.start).addScaledVector(s3.set(...b.dir), along).add(side);
        berryBase.push([v.x, v.y, v.z, BERRY * (0.85 + r() * 0.3)]);
        berries.setColorAt(bi * BERRIES + k, col.clone().offsetHSL(0, 0, (r() - 0.5) * 0.06));
      }
    });
    berries.userData.berries = true; tree.add(berries);
    shape = signature(d);
    pose();
    if (first) ctx.frame(root, { view: [0.35, 0.32, 1], pad: 0.72, minZoom: 0.6, maxZoom: 6, light: [-0.6, 1.3, 0.7] });
  }
  // where every branch and leaf is now: grown branches at full size, new ones growing in, the picked one lit
  function pose() {
    const t = nowS();
    let growing = false;
    T.branches.forEach((b, bi) => {
      const key = b.index + '@' + b.at, at = grownAt.get(key);
      let g = 1;
      if (at != null) { g = Math.min(1, (t - at) / GROW_S); if (g >= 1) grownAt.delete(key); else growing = true; }
      const ease = g * g * (3 - 2 * g), w = wood[bi];
      w.scale.set(Math.max(0.001, ease), Math.max(0.001, ease), Math.max(0.001, ease));
      w.material = b.index === selected ? lit : bark;
      joints.setMatrixAt(bi * 2, m4.compose(v.set(...b.start), q.identity(), s3.setScalar(Math.max(0.001, b.radius * ease))));
      joints.setMatrixAt(bi * 2 + 1, m4.compose(v.set(...b.start).addScaledVector(s3.set(...b.dir), b.length * ease), q.identity(), s3.setScalar(Math.max(0.001, b.tipRadius * ease))));
      for (let k = 0; k < LEAVES; k++) {
        const n = bi * LEAVES + k, [x, y, z, qx, qy, qz, qw, size] = leafBase[n];
        const sz = size * ease * (b.index === selected ? 1.35 : 1);
        // a growing branch carries its leaves out from where it sprouts
        v.set(...b.start).lerp(s3.set(x, y, z), ease);
        m4.compose(v, q.set(qx, qy, qz, qw), s3.set(Math.max(0.001, sz), Math.max(0.001, sz), Math.max(0.001, sz)));
        leaves.setMatrixAt(n, m4);
      }
      for (let k = 0; k < BERRIES; k++) {
        const [x, y, z, size] = berryBase[bi * BERRIES + k];
        v.set(...b.start).lerp(s3.set(x, y, z), ease);
        berries.setMatrixAt(bi * BERRIES + k, m4.compose(v, q.identity(), s3.setScalar(Math.max(0.0005, size * ease * (b.index === selected ? 1.3 : 1)))));
      }
    });
    berries.instanceMatrix.needsUpdate = true; if (berries.instanceColor) berries.instanceColor.needsUpdate = true; berries.computeBoundingSphere();
    ghosts.forEach((g) => { g.visible = !growing; }); // the not-yet-grown shoots wait until the tree has finished growing in
    leaves.instanceMatrix.needsUpdate = true; joints.instanceMatrix.needsUpdate = true; joints.computeBoundingSphere();
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    leaves.computeBoundingSphere();
    return growing;
  }
  function apply() {
    const d = ctx.handle.data || data;
    const sel = d.selected == null ? null : d.selected;
    if (signature(d) !== shape) { rebuild(d); selected = sel; pose(); return true; }
    if (sel !== selected) { selected = sel; pose(); return true; }
    return false;
  }
  rebuild(data); selected = data.selected == null ? null : data.selected; pose();

  // touch a branch or its leaves to read its entry
  ctx.onTap((hits) => {
    const u = (x) => x.object.userData;
    const h = (hits || []).find((x) => x.object && x.object.visible !== false && (u(x).entry != null || u(x).ghost != null || ((u(x).leaves || u(x).joints || u(x).berries) && x.instanceId != null)));
    if (!h) return;
    const d = ctx.handle.data || data;
    if (u(h).ghost != null) { if (d.onPickGhost) d.onPickGhost(T.ghosts[u(h).ghost]); return; }
    const index = u(h).leaves ? leafOf[h.instanceId] : u(h).joints ? T.branches[h.instanceId >> 1].index : u(h).berries ? T.branches[Math.floor(h.instanceId / BERRIES)].index : u(h).entry;
    if (d.onPick) d.onPick(index);
  });

  let growing = false;
  return {
    update() { apply(); ctx.requestRender(); },
    tick() {
      const changed = apply();
      if (!grownAt.size && !changed) { growing = false; return false; }
      growing = pose();
      return true;
    },
    state() {
      const newest = T.branches.reduce((a, b) => (Date.parse(b.at) >= Date.parse(a.at) ? b : a), T.branches[0] || { index: null, at: '' });
      return { branches: T.branches.length, leaves: T.branches.length * LEAVES, berries: T.branches.length * BERRIES, ghosts: T.ghosts.length, building: T.ghosts.some((g) => g.kind === 'building'), until: (ctx.handle.data || data).until || null, height: Math.round(T.height * 100) / 100, newest: newest.index, selected, growing: growing || grownAt.size > 0 };
    },
    dispose() { clear(); leafGeo.dispose(); jointGeo.dispose(); soil.geometry.dispose(); soil.material.dispose(); berryGeo.dispose(); for (const m of [bark, lit, leafMat, berryMat, ghostMat, glowMat]) m.dispose(); barkMap.dispose(); },
  };
}
