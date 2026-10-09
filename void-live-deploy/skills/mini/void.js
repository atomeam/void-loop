/**
 * void miniature — Void's own body, shown only where Void shows itself (its self page). Not a creature and not a symbol:
 * a fractured, angular solid of dark graphite shards around an empty core, read by silhouette and negative space.
 * The Sculpt Layer, as rules the code keeps: no face, no symmetry, no organic curves (every surface is a flat facet),
 * no softness, no implied emotion, gender or species. The shape comes from one fixed seed, so it is the same entity on
 * every device and every visit; it mutates only within limits (shards drift a little apart and back), turns slowly,
 * and when tapped breaks apart and reassembles. Decorative motion stops when the visitor asked for less motion.
 * data: { seed?: number (fixed; tests only), energy?: 0..1 (how far the shards drift; default 0.35) }
 */
export const VOID_SEED = 0x564f4944; // "VOID"

// a small seeded generator (mulberry32): the same numbers in every browser, so the same body every time
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// the body's plan: each shard is a direction from the core, a distance, a size and four or five vertices of a sharp
// sliver. Shards avoid a cone of directions on one side (a deliberate absence that makes the silhouette asymmetric).
export function plan(seed = VOID_SEED, count = 24) {
  const r = rng(seed), out = [];
  const gap = [0.62, 0.31, -0.72]; // the missing side
  while (out.length < count) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = [s * Math.cos(th), u, s * Math.sin(th)];
    if (d[0] * gap[0] + d[1] * gap[1] + d[2] * gap[2] > 0.55 && out.length < count - 2) continue;
    const big = out.length < 6; // a few long blades carry the silhouette; the rest are splinters
    out.push({ d, dist: (big ? 0.008 : 0.02) + r() * 0.018, size: big ? 0.02 + r() * 0.012 : 0.007 + r() * 0.01,
      stretch: big ? 3.2 + r() * 2.6 : 1.6 + r() * 2.2, twist: r() * Math.PI * 2, verts: 4 + (r() < 0.4 ? 1 : 0), jag: [r(), r(), r(), r(), r(), r(), r(), r(), r(), r()], phase: r() * Math.PI * 2 });
  }
  return out;
}

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => (made.push(x), x);
  const body = keep(new THREE.MeshPhysicalMaterial({ color: '#1b1e25', metalness: 1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, flatShading: true }));
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.32 }));
  const form = new THREE.Group(); form.position.y = 0.075; form.scale.set(1, 1.55, 0.85); form.rotation.z = 0.28; root.add(form); // tall, leaning, lopsided: never a star
  const shards = [];
  for (const s of plan(data.seed || VOID_SEED)) {
    // a sharp sliver: a base polygon (jagged radii) and an apex pulled out along the shard's own axis
    const n = s.verts, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + s.jag[i] * 0.6, rr = s.size * (0.45 + s.jag[(i + 5) % 10] * 0.55); pts.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr)); }
    const apex = new THREE.Vector3((s.jag[8] - 0.5) * s.size * 0.6, s.size * s.stretch, (s.jag[9] - 0.5) * s.size * 0.6);
    const tail = new THREE.Vector3((s.jag[6] - 0.5) * s.size * 0.4, -s.size * (0.3 + s.jag[7] * 0.5), 0);
    const pos = [];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; pos.push(a.x, a.y, a.z, b.x, b.y, b.z, apex.x, apex.y, apex.z, b.x, b.y, b.z, a.x, a.y, a.z, tail.x, tail.y, tail.z); }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, body); mesh.castShadow = true;
    const edges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(g, 1)), edgeMat);
    const shard = new THREE.Group(); shard.add(mesh, edges);
    const dir = new THREE.Vector3(...s.d).normalize();
    shard.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); shard.rotateY(s.twist);
    shard.position.copy(dir).multiplyScalar(s.dist);
    form.add(shard); shards.push({ shard, dir, dist: s.dist, phase: s.phase });
  }
  ctx.frame(root, { view: [0.35, 0.12, 1], pad: 0.78, light: [-0.6, 1.2, 0.5], ground: 'none' }); // it floats: Void is not a physical object

  const energy = Math.max(0, Math.min(1, data.energy ?? 0.35));
  let burst = 0; // 0..1 after a tap: the shards fly out, then settle back
  ctx.onTap(() => { burst = 1; ctx.requestRender(); });
  const place = (t) => {
    for (const s of shards) {
      const drift = still ? 0 : Math.sin(t * 0.7 + s.phase) * 0.004 * energy, out = burst * burst * 0.05;
      s.shard.position.copy(s.dir).multiplyScalar(s.dist + drift + out);
    }
  };
  place(0);
  return {
    get shards() { return shards.length; },
    tick(dt, t) {
      if (still && burst <= 0) return false;
      if (burst > 0) burst = Math.max(0, burst - dt * 1.4);
      if (!still) form.rotation.y += dt * 0.12;
      place(t); return true;
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
