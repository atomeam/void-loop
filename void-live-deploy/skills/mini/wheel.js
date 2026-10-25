/**
 * wheel miniature: the wheel card's 3D figure (owner, 2026-10-25: "should be a card for all too and 3d figure if possible"). A prize wheel on a
 * stand: one coloured slice per choice with its name printed on it (a weighted choice gets a wider slice), a brass hub, and a red pointer at the
 * top. The card's winner is drawn by the card (lib/wheel.js, fair); the wheel spins two turns and stops with that slice under the pointer. With
 * reduced motion it is shown stopped there at once.
 * data: { entries: [{ label, weight? }], win: label }. state(): { win, spinning, angle }.
 */
const HUES = ['#e8505b', '#f9a03f', '#f6d55c', '#3caea3', '#20639b', '#7a5195', '#ef5675', '#58b368', '#ff7c43', '#2f4b7c'];
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const R = 0.06, T = 0.008; // a 12 cm wheel
  const tex = (entries) => { // the face as one canvas: slices, names, rim
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), mid = 512, total = entries.reduce((s, e) => s + e.w, 0);
    let a = -Math.PI / 2;
    entries.forEach((e, i) => {
      const span = (e.w / total) * Math.PI * 2; g.beginPath(); g.moveTo(mid, mid); g.arc(mid, mid, 500, a, a + span); g.closePath(); g.fillStyle = HUES[i % HUES.length]; g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.stroke();
      g.save(); g.translate(mid, mid); g.rotate(a + span / 2); g.fillStyle = '#ffffff'; g.textAlign = 'right'; g.textBaseline = 'middle';
      const t = e.label; g.font = '700 ' + Math.max(t.length > 16 ? 16 : 30, Math.min(120, Math.round(span * 70), Math.round(900 / Math.max(3, t.length)))) + 'px system-ui, sans-serif';
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.fillText(t, 470, 0); g.restore();
      a += span;
    });
    g.lineWidth = 18; g.strokeStyle = '#2b2b33'; g.beginPath(); g.arc(mid, mid, 503, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const discGeo = new THREE.CylinderGeometry(R, R, T, 96); discGeo.rotateX(Math.PI / 2); // faces the viewer (+z)
  const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.45 }), rimMat = new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.4, metalness: 0.3 });
  const disc = new THREE.Mesh(discGeo, rimMat); disc.castShadow = true;
  const faceGeo = new THREE.CircleGeometry(R * 0.985, 96), face = new THREE.Mesh(faceGeo, faceMat); face.position.z = T / 2 + 0.0002; // the canvas face, straight on (a circle's UVs are x and y)
  const hubGeo = new THREE.CylinderGeometry(0.007, 0.007, T + 0.006, 32); hubGeo.rotateX(Math.PI / 2);
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.3 }); const hub = new THREE.Mesh(hubGeo, brass);
  const spinner = new THREE.Group(); spinner.add(disc, face, hub);
  const standGeo = new THREE.BoxGeometry(0.012, 0.08, 0.012), baseGeo = new THREE.BoxGeometry(0.06, 0.008, 0.04), wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.7 });
  const stand = new THREE.Mesh(standGeo, wood); stand.position.set(0, 0.04, -T); const base = new THREE.Mesh(baseGeo, wood); base.position.set(0, 0.004, -T);
  for (const m of [stand, base]) { m.castShadow = true; m.receiveShadow = true; }
  spinner.position.set(0, 0.08, 0);
  const ptrShape = new THREE.Shape(); ptrShape.moveTo(-0.007, 0.012); ptrShape.lineTo(0.007, 0.012); ptrShape.lineTo(0, -0.004); ptrShape.closePath();
  const ptrGeo = new THREE.ExtrudeGeometry(ptrShape, { depth: 0.004, bevelEnabled: false }), ptrMat = new THREE.MeshStandardMaterial({ color: '#d32f2f', roughness: 0.35 });
  const ptr = new THREE.Mesh(ptrGeo, ptrMat); ptr.position.set(0, 0.08 + R - 0.002, T / 2 + 0.001); ptr.castShadow = true;
  root.add(spinner, stand, base, ptr);
  let entries = [], win = '', angle = 0, from = 0, to = 0, left = 0, map = null;
  const SPIN = 2.2; let t0 = 0; // seconds, by the wall clock: a slow device sees the same spin, never a longer one
  const target = () => { // the angle that puts the winner's slice middle under the pointer (the slices start at the top, clockwise on the canvas)
    const total = entries.reduce((s, e) => s + e.w, 0); let a = 0; for (const e of entries) { if (e.label === win) return -(a + e.w / 2) / total * Math.PI * 2; a += e.w; } return 0;
  };
  const set = (d) => {
    entries = (Array.isArray(d.entries) ? d.entries : []).map((e) => ({ label: String(e && e.label != null ? e.label : e), w: Math.max(1, Number(e && e.weight) || 1) })).filter((e) => e.label).slice(0, 40);
    if (!entries.length) entries = [{ label: '?', w: 1 }];
    win = String(d.win || ''); if (map) map.dispose(); map = tex(entries); faceMat.map = map; faceMat.needsUpdate = true;
  };
  set(data);
  ctx.frame(root, { view: [0.15, 0.25, 1], pad: 1.2 });
  const aim = (spin) => { const t = target(), base0 = angle - (angle % (Math.PI * 2)); from = angle; to = base0 + t - (spin ? Math.PI * 4 : 0); if (to > from && spin) to -= Math.PI * 2; left = spin ? SPIN : 0; t0 = performance.now(); if (!spin) { angle = t; spinner.rotation.z = -angle; } };
  aim(!still);
  return {
    update(d) { const changed = String(d.win || '') !== win || JSON.stringify(d.entries) !== JSON.stringify(entries.map((e) => ({ label: e.label, weight: e.w }))); set(d); if (changed) aim(!still); ctx.requestRender(); },
    tick(dt) {
      if (left <= 0) return false;
      left = Math.max(0, SPIN - (performance.now() - t0) / 1000); const k = 1 - left / SPIN, e = 1 - Math.pow(1 - k, 3); // ease out: a strong start, a slow stop
      angle = from + (to - from) * e; spinner.rotation.z = -angle; return true;
    },
    state() { return { win, spinning: left > 0, angle }; },
    dispose() { for (const g of [discGeo, faceGeo, hubGeo, standGeo, baseGeo, ptrGeo]) g.dispose(); for (const m of [faceMat, rimMat, brass, wood, ptrMat]) m.dispose(); if (map) map.dispose(); },
  };
}
