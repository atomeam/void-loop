/**
 * swarm miniature — Verse's agents (salvaged from the Frontier-Engine experiment F-020, drafts/020-webgpu-void-agents on
 * atomeam/a-to-mind.com, docs/SALVAGE.md): a field of glowing agents, each running its own small state machine
 * (explore / cluster / disperse) from where the pointer is and how many neighbours it has, with separation from close
 * neighbours. The whole field's speed and clustering make a mood (idle, clustering, dispersing) and a hue, and the card
 * around it changes with that mood: its border, glow and status line (the "UI that physically responds" half of F-020).
 * Built on scene3d.js like every miniature (one shared WebGL renderer, three.js Points, no new engine). Neighbours come from
 * a uniform grid, not the draft's every-agent-against-every-agent search, so a step stays well inside a frame.
 * Reduced motion: one settled frame, no animation; the mood is still reported.
 * data: { count?: number (24 to 240), onMood?(mood) }
 */
export const STATES = ['explore', 'cluster', 'disperse'];
export const MAX_AGENTS = 240;
const R_SEP = 0.06, R_NEAR = 0.12, R_CLUSTER = 0.25, R_FAR = 0.7; // field units: the field is [-1, 1] square

/** a seeded random source (mulberry32), so a field and its tests repeat */
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** a fresh field: { n, x, y, vx, vy, s (state index), rnd } in typed arrays. Pure apart from its own rng. */
export function makeField(count = 140, seed = 7) {
  const n = Math.max(24, Math.min(MAX_AGENTS, Math.round(+count) || 140)), rnd = rng(seed);
  const f = { n, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), s: new Uint8Array(n), rnd, cell: new Int32Array(0), next: new Int32Array(n) };
  for (let i = 0; i < n; i++) { f.x[i] = rnd() * 2 - 1; f.y[i] = rnd() * 2 - 1; f.vx[i] = (rnd() - 0.5) * 0.02; f.vy[i] = (rnd() - 0.5) * 0.02; }
  return f;
}
const wrap = (v) => (v < -1 ? v + 2 : v > 1 ? v - 2 : v);

/** one step of the swarm toward the pointer (px, py in field units, or null when nobody is pointing). Returns the mood. */
export function stepField(f, px = null, py = null) {
  const G = Math.ceil(2 / R_NEAR), cells = G * G;
  if (f.cell.length !== cells) f.cell = new Int32Array(cells);
  f.cell.fill(-1);
  const cellOf = (x, y) => Math.min(G - 1, Math.max(0, ((x + 1) / R_NEAR) | 0)) + G * Math.min(G - 1, Math.max(0, ((y + 1) / R_NEAR) | 0));
  for (let i = 0; i < f.n; i++) { const c = cellOf(f.x[i], f.y[i]); f.next[i] = f.cell[c]; f.cell[c] = i; }
  const tx = px == null ? Math.sin(f.n * 0.01) * 0.2 : px, ty = py == null ? 0 : py;
  let speed = 0, clustered = 0;
  for (let i = 0; i < f.n; i++) {
    const x = f.x[i], y = f.y[i], dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
    // the agent's own reasoning: close to the pointer it clusters, far away it explores, in between it now and then disperses
    if (d < R_CLUSTER) f.s[i] = 1; else if (d > R_FAR) f.s[i] = 0; else if (f.s[i] === 2 ? f.rnd() < 0.03 : f.rnd() < 0.01) f.s[i] = f.s[i] === 2 ? 0 : 2;
    let ax = 0, ay = 0, near = 0;
    if (f.s[i] === 1) { ax += dx * 0.004; ay += dy * 0.004; }
    else if (f.s[i] === 2) { ax -= dx * 0.002; ay -= dy * 0.002; }
    else { ax += (f.rnd() - 0.5) * 0.002; ay += (f.rnd() - 0.5) * 0.002; if (px != null && d < R_FAR) { ax += dx * 0.0012; ay += dy * 0.0012; } } // a pointer in reach draws explorers in
    const cx = Math.min(G - 1, Math.max(0, ((x + 1) / R_NEAR) | 0)), cy = Math.min(G - 1, Math.max(0, ((y + 1) / R_NEAR) | 0));
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy; if (gx < 0 || gy < 0 || gx >= G || gy >= G) continue;
      for (let j = f.cell[gx + G * gy]; j !== -1; j = f.next[j]) {
        if (j === i) continue; const ex = f.x[j] - x, ey = f.y[j] - y, e = Math.hypot(ex, ey);
        if (e < R_NEAR) near++;
        if (e > 0 && e < R_SEP) { ax -= (ex / e) * 0.0016; ay -= (ey / e) * 0.0016; }
      }
    }
    if (near > 6 && f.s[i] === 0) f.s[i] = 1; // a crowd pulls an explorer in
    f.vx[i] = (f.vx[i] + ax) * 0.96; f.vy[i] = (f.vy[i] + ay) * 0.96;
    const v = Math.hypot(f.vx[i], f.vy[i]); if (v > 0.03) { f.vx[i] *= 0.03 / v; f.vy[i] *= 0.03 / v; }
    f.x[i] = wrap(x + f.vx[i]); f.y[i] = wrap(y + f.vy[i]);
    speed += Math.hypot(f.vx[i], f.vy[i]); if (f.s[i] === 1) clustered++;
  }
  return moodOf(speed / f.n, clustered / f.n, f);
}

/** the field's mood from its mean speed and the share clustering: { name, hue, intensity, speed, cluster }. Pure (hue drifts on f). */
export function moodOf(speed, cluster, f = {}) {
  const entropy = (speed / 0.03) * (1 - cluster);
  const intensity = Math.max(0, Math.min(1, entropy * 1.6));
  f.hue = ((f.hue ?? 190) + entropy * 1.2) % 360;
  const name = cluster > 0.4 ? 'clustering' : speed > 0.018 ? 'dispersing' : 'idle';
  return { name, hue: Math.round(f.hue), intensity: Math.round(intensity * 100) / 100, speed, cluster: Math.round(cluster * 100) / 100 };
}

export default function build(ctx, data = {}) {
  const { THREE, root, still, phone, canvas } = ctx;
  const f = makeField(phone ? Math.min(110, data.count || 110) : (data.count || 160));
  const S = 0.09; // the field is 18 cm across on the table
  const pos = new Float32Array(f.n * 3), col = new Float32Array(f.n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: phone ? 0.0042 : 0.0036, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(S * 1.15, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#07080c', roughness: 0.9, metalness: 0.1 }));
  disc.receiveShadow = true; disc.position.y = -0.0005;
  root.add(disc, pts);
  ctx.frame(root, { view: [0, 1, 0.75], pad: 1.1 });
  const c = new THREE.Color();
  let px = null, py = null, mood = null, onMood = data.onMood;
  const onMove = (e) => { const r = canvas.getBoundingClientRect(); if (!r.width) return; px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1; };
  const onLeave = () => { px = py = null; };
  canvas.addEventListener('pointermove', onMove, { passive: true }); canvas.addEventListener('pointerleave', onLeave, { passive: true });
  function paint() {
    for (let i = 0; i < f.n; i++) {
      pos[i * 3] = f.x[i] * S; pos[i * 3 + 1] = 0.004 + (f.s[i] === 1 ? 0.004 : 0); pos[i * 3 + 2] = f.y[i] * S;
      c.setHSL((((mood ? mood.hue : 190) + (f.s[i] === 1 ? 30 : f.s[i] === 2 ? -30 : 0)) % 360) / 360, 0.8, 0.6); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  let frames = 0;
  const tell = () => { if (typeof onMood === 'function') try { onMood(mood); } catch (_) {} };
  // reduced motion: settle the field (60 quiet steps) and draw it once
  for (let k = 0; k < (still ? 60 : 1); k++) mood = stepField(f, null, null);
  paint(); tell();
  return {
    update(d) { if (d && d.onMood) onMood = d.onMood; },
    state: () => ({ n: f.n, mood, still }), // for tests
    tick() {
      if (still) return false;
      mood = stepField(f, px, py); paint();
      if (++frames % 15 === 0) tell(); // the card's chrome changes four times a second, not every frame
      return 'view';
    },
    dispose() { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); geo.dispose(); mat.dispose(); disc.geometry.dispose(); disc.material.dispose(); },
  };
}
