/**
 * dice miniature: the random-number card's answer on a big ivory number die lying on the desk (owner, 2026-10-25: "should be a card for all too
 * and 3d figure if possible"). The number drawn is on the top face; the side faces carry other numbers from the same range, so it reads as a die
 * of that size. A new number tumbles the die and it lands with the new number up; with reduced motion it lands at once.
 * data: { value: number|string, lo?: number, hi?: number }. state(): { value, rolling }.
 */
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const S = 0.03; // a 3 cm die
  const geo = new THREE.BoxGeometry(S, S, S, 1, 1, 1);
  const face = (text, top) => { // ivory face with a carved number; the top face is the answer, in red
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 30, 128, 128, 190); grd.addColorStop(0, '#fbf6ea'); grd.addColorStop(1, '#e6dcc4'); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120,100,70,.35)'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
    const t = String(text); g.fillStyle = top ? '#b3261e' : '#3a3428'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 ' + Math.round(Math.min(150, 360 / Math.max(1, t.length))) + 'px system-ui, sans-serif'; g.fillText(t, 128, 136);
    if (t === '6' || t === '9') g.fillRect(96, 214, 64, 8); // a 6 and a 9 are underlined, as on a real die
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
  };
  // BoxGeometry face order: +x, -x, +y (top), -y, +z, -z
  const mats = Array.from({ length: 6 }, () => new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  const die = new THREE.Mesh(geo, mats); die.castShadow = true; die.receiveShadow = true; die.position.y = S / 2;
  const holder = new THREE.Group(); holder.add(die); root.add(holder);
  let value = '', lo = 1, hi = 100, rolling = 0, from = null;
  const paint = (d) => {
    value = String(d.value == null ? '' : d.value); lo = Number.isFinite(+d.lo) ? +d.lo : 1; hi = Number.isFinite(+d.hi) ? +d.hi : Math.max(6, +value || 6);
    const span = Math.max(1, hi - lo + 1), v = +value, side = (k) => (Number.isFinite(v) ? String(lo + ((v - lo + k * 7 + span) % span)) : '?');
    const texts = [side(1), side(2), value, side(3), side(4), side(5)];
    mats.forEach((m, i) => { if (m.map) m.map.dispose(); m.map = face(texts[i], i === 2); m.needsUpdate = true; });
  };
  paint(data);
  ctx.frame(root, { view: [0.35, 0.75, 1], pad: 1.6 });
  const ROLL = 0.9;
  return {
    update(d) {
      const changed = String(d.value) !== value; paint(d);
      if (changed && !still) { rolling = ROLL; from = { x: Math.PI * 2 * (1 + Math.random()), z: Math.PI * 2 * (1 + Math.random()), y: Math.random() * Math.PI }; }
      ctx.requestRender();
    },
    tick(dt) {
      if (!rolling) return false;
      rolling = Math.max(0, rolling - dt); const k = rolling / ROLL, e = k * k; // eases out: fast tumble, gentle landing
      die.rotation.set(from.x * e, from.y * e, from.z * e); die.position.y = S / 2 + Math.abs(Math.sin(k * Math.PI * 3)) * S * 1.2 * k;
      if (!rolling) { die.rotation.set(0, 0, 0); die.position.y = S / 2; }
      return true;
    },
    state() { return { value, rolling: rolling > 0 }; },
    dispose() { geo.dispose(); mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); },
  };
}
