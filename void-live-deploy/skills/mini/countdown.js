/**
 * The countdown card's miniature (docs/miniatures.md): a desk flip-calendar on a walnut stand, brass rings at the top.
 * The front leaf shows the days left; at midnight (or when the card's count changes) the old leaf flips up over the
 * rings and the new count is underneath, like tearing a day off a real one.
 * data: { days: number, label: string, target?: 'YYYY-MM-DD' (local date; when given, the count follows the clock) }
 */
const W = 0.09, H = 0.072, TILT = 0.2; // leaf size in metres, and how far the leaves lean back

export function daysTo(target, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(target || ''));
  if (!m) return null;
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()), b = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round((b - a) / 86400000);
}

// one leaf face: cream paper, a red header band with the label, the big number, "days" under it
function leafCanvas(days, label) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 410;
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe4'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#b3261e'; g.fillRect(0, 0, c.width, 92);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 44; const text = String(label || '').toUpperCase().slice(0, 28);
  g.font = '600 ' + size + 'px system-ui, sans-serif';
  while (size > 20 && g.measureText(text).width > c.width - 60) { size -= 2; g.font = '600 ' + size + 'px system-ui, sans-serif'; }
  g.fillText(text, c.width / 2, 50);
  const n = days == null ? '–' : String(Math.abs(days));
  g.fillStyle = '#1c1b19'; g.font = '700 ' + (n.length > 3 ? 150 : 200) + 'px Georgia, serif';
  g.fillText(n, c.width / 2, 236);
  g.fillStyle = '#5b574f'; g.font = '500 40px system-ui, sans-serif';
  g.fillText(days === 0 ? 'today' : days < 0 ? (days === -1 ? 'day ago' : 'days ago') : days === 1 ? 'day to go' : 'days to go', c.width / 2, 360);
  return c;
}

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => { made.push(x); return x; };
  const tex = (days, label) => { const t = keep(new THREE.CanvasTexture(leafCanvas(days, label))); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  // walnut stand with a bevelled slot the leaves sit in
  const wood = keep(new THREE.MeshPhysicalMaterial({ color: '#5a3a22', roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
  const base = new THREE.Mesh(keep(new THREE.BoxGeometry(W + 0.022, 0.014, 0.05)), wood);
  base.position.y = 0.007; base.castShadow = true; base.receiveShadow = true;
  const back = new THREE.Mesh(keep(new THREE.BoxGeometry(W + 0.01, H + 0.012, 0.006)), wood);
  const easel = new THREE.Group(); easel.position.set(0, 0.014, 0.004); easel.rotation.x = -TILT;
  back.position.set(0, (H + 0.012) / 2, -0.006); back.castShadow = true; back.receiveShadow = true;
  easel.add(back);

  // the pad of leaves: paper edges, then the front face with today's count
  const paperSide = keep(new THREE.MeshStandardMaterial({ color: '#ebe4d6', roughness: 0.9 }));
  const pad = new THREE.Mesh(keep(new THREE.BoxGeometry(W, H, 0.004)), paperSide);
  pad.position.set(0, H / 2 + 0.004, -0.001); pad.castShadow = true; pad.receiveShadow = true;
  const faceMat = keep(new THREE.MeshStandardMaterial({ map: null, roughness: 0.85 }));
  const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, H)), faceMat);
  face.position.set(0, H / 2 + 0.004, 0.00105); face.receiveShadow = true;
  easel.add(pad, face);

  // the leaf that flips: hinged at the top edge, front shows the old count, back is plain paper
  const hinge = new THREE.Group(); hinge.position.set(0, H + 0.004, 0.0013);
  const flipMat = keep(new THREE.MeshStandardMaterial({ map: null, roughness: 0.85 }));
  const leaf = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, H)), flipMat);
  leaf.position.y = -H / 2; leaf.castShadow = true;
  const leafBack = new THREE.Mesh(leaf.geometry, keep(new THREE.MeshStandardMaterial({ color: '#e6dfd0', roughness: 0.9, side: THREE.BackSide })));
  leafBack.position.y = -H / 2;
  hinge.add(leaf, leafBack); hinge.visible = false; easel.add(hinge);

  // brass binding rings over the top edge
  const brass = keep(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.28 }));
  const ringGeo = keep(new THREE.TorusGeometry(0.0055, 0.0008, 16, 64));
  for (const x of [-W * 0.3, W * 0.3]) {
    const r = new THREE.Mesh(ringGeo, brass); r.rotation.y = Math.PI / 2; r.position.set(x, H + 0.004, -0.002); r.castShadow = true; easel.add(r);
  }
  root.add(base, easel);
  ctx.frame(root, { view: [0.12, 0.2, 1], pad: 1.02 });

  let label = data.label || '', target = data.target || null;
  let days = target != null && daysTo(target) != null ? daysTo(target) : (data.days ?? null);
  let faceTex = tex(days, label); faceMat.map = faceTex; faceMat.needsUpdate = true;
  let flip = null; // { t: 0..1 } while a leaf is flipping
  let lastCheck = 0;

  function show(next, nextLabel) {
    if (next === days && nextLabel === label) return;
    const old = faceTex;
    label = nextLabel; days = next;
    faceTex = tex(days, label); faceMat.map = faceTex; faceMat.needsUpdate = true;
    if (still) { old.dispose(); ctx.requestRender(); return; }
    if (flipMat.map && flipMat.map !== old) flipMat.map.dispose();
    flipMat.map = old; flipMat.needsUpdate = true; hinge.rotation.x = 0; hinge.visible = true; flip = { t: 0 };
    ctx.requestRender();
  }

  return {
    get days() { return days; },
    state() { return { days, label, flipping: !!flip }; }, // what it shows, for the behaviour contract (tools/test_3d.mjs miniContract)
    update(d) {
      if (d.target !== undefined) target = d.target;
      const next = target != null && daysTo(target) != null ? daysTo(target) : (d.days ?? days);
      show(next, d.label ?? label);
    },
    tick(dt, t) {
      // the count follows the clock: check about once a second whether the day has turned
      if (target && t - lastCheck > 1) { lastCheck = t; const n = daysTo(target); if (n !== null && n !== days) show(n, label); }
      if (!flip) return false;
      flip.t = Math.min(1, flip.t + dt / 0.9);
      const e = flip.t < 0.5 ? 2 * flip.t * flip.t : 1 - Math.pow(-2 * flip.t + 2, 2) / 2; // ease in and out
      hinge.rotation.x = -e * (Math.PI - TILT * 2) ; // up and over the rings, coming to rest against the back
      if (flip.t >= 1) { hinge.visible = false; if (flipMat.map) { flipMat.map.dispose(); flipMat.map = null; } flip = null; }
      return true;
    },
    dispose() { for (const x of made) x.dispose(); if (flipMat.map) flipMat.map.dispose(); faceTex.dispose(); },
  };
}
