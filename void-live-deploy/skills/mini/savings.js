/**
 * The savings page's miniature (docs/miniatures.md): stacks of coins on a walnut tray, one stack per point in time.
 * Each stack is silver for what you put in and gold on top for what interest added, so compounding shows as the gold
 * growing faster than the silver. The stacks rise one after another when the answer appears.
 * data: { cols: [{ label: string, paid: number, total: number }] }   (up to 6 columns)
 */
const COIN_R = 0.0085, COIN_H = 0.0021, MAX_COINS = 34, GAP = 0.024;

// coins per stack: the tallest stack gets MAX_COINS; silver = share paid in, gold = the rest (at least 1 coin when growth > 0)
export function coinsFor(cols) {
  const list = (Array.isArray(cols) ? cols : []).slice(0, 6);
  const top = Math.max(1, ...list.map((c) => +c.total || 0));
  return list.map((c) => {
    const total = Math.max(0, +c.total || 0), paid = Math.max(0, Math.min(total, +c.paid || 0));
    const n = Math.max(total > 0 ? 1 : 0, Math.round(total / top * MAX_COINS));
    let gold = total > 0 ? Math.round(n * (total - paid) / total) : 0;
    if (total - paid > 0.005 * total && gold === 0 && n > 1) gold = 1;
    return { silver: n - gold, gold, label: String(c.label || '') };
  });
}

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => { made.push(x); return x; };
  const coinGeo = keep(new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H * 0.92, 48));
  const silver = keep(new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.28 }));
  const gold = keep(new THREE.MeshStandardMaterial({ color: '#e0b84a', metalness: 1, roughness: 0.24 }));
  const tray = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 0.006, 0.05)), keep(new THREE.MeshPhysicalMaterial({ color: '#5a3a22', roughness: 0.5, clearcoat: 0.35 })));
  tray.receiveShadow = true; tray.castShadow = true; tray.position.y = -0.003;
  root.add(tray);
  let silverMesh = null, goldMesh = null, labels = [], plan = [], t0 = 0, rising = false;

  function labelSprite(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#f2ede2'; g.font = '700 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 32);
    const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.024, 0.006)), keep(new THREE.MeshBasicMaterial({ map: t, transparent: true })));
    m.rotation.x = -Math.PI / 2 + 0.35; return m;
  }

  function lay(cols) {
    for (const m of [silverMesh, goldMesh, ...labels]) if (m) root.remove(m);
    labels = [];
    const stacks = coinsFor(cols), n = stacks.length;
    const ns = stacks.reduce((a, s) => a + s.silver, 0), ng = stacks.reduce((a, s) => a + s.gold, 0);
    silverMesh = new THREE.InstancedMesh(coinGeo, silver, Math.max(1, ns)); goldMesh = new THREE.InstancedMesh(coinGeo, gold, Math.max(1, ng));
    silverMesh.count = ns; goldMesh.count = ng;
    for (const m of [silverMesh, goldMesh]) { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); }
    tray.scale.x = Math.max(0.05, n * GAP + 0.01);
    plan = []; let si = 0, gi = 0;
    stacks.forEach((s, k) => {
      const x = (k - (n - 1) / 2) * GAP;
      for (let i = 0; i < s.silver + s.gold; i++) {
        const isGold = i >= s.silver; // a slight jitter so the stacks look hand-made
        const j = Math.sin((k * 37 + i) * 12.9898) * 0.00045, jz = Math.cos((k * 11 + i) * 78.233) * 0.00045;
        plan.push({ mesh: isGold ? goldMesh : silverMesh, idx: isGold ? gi++ : si++, x: x + j, z: jz, y: COIN_H * (i + 0.5), col: k, i });
      }
      if (s.label) { const l = labelSprite(s.label); l.position.set(x, 0.0005, 0.017); labels.push(l); root.add(l); }
    });
    ctx.frame(root, { view: [0.05, 0.42, 1], pad: 1.06 });
    t0 = 0; rising = !still; place(still ? 1e9 : 0);
  }

  const m4 = new THREE.Matrix4();
  // each column starts 0.18 s after the one before; each coin drops into place 25 ms after the one below
  function place(t) {
    let moving = false;
    for (const p of plan) {
      const start = p.col * 0.18 + p.i * 0.025, k = Math.min(1, Math.max(0, (t - start) / 0.22));
      if (k < 1) moving = true;
      const e = 1 - Math.pow(1 - k, 3);
      m4.makeTranslation(p.x, p.y + (1 - e) * 0.03, p.z);
      if (k === 0) m4.makeScale(0, 0, 0);
      p.mesh.setMatrixAt(p.idx, m4);
    }
    silverMesh.instanceMatrix.needsUpdate = true; goldMesh.instanceMatrix.needsUpdate = true;
    return moving;
  }
  lay(data.cols);

  return {
    get stacks() { return coinsFor(data.cols); },
    get rising() { return rising; },
    update(d) { if (d.cols && JSON.stringify(d.cols) !== JSON.stringify(data.cols)) { data = d; lay(d.cols); ctx.requestRender(); } },
    tick(dt) { if (!rising) return false; t0 += dt; rising = place(t0); return true; },
    dispose() { for (const x of made) x.dispose(); silverMesh && silverMesh.dispose(); goldMesh && goldMesh.dispose(); },
  };
}
