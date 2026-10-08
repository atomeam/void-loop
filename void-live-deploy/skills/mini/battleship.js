/**
 * battleship miniature — the classic folding case standing in the void: your ocean lies flat with your grey ships on it
 * and Void's pegs where it has fired, and your target board stands upright behind it with your own pegs (white for a miss,
 * red for a hit). A ship you sink shows on the target board. Void's fleet is never in `data` (the card sends only rules
 * view()), so it can't be drawn. Built from code. A tap on the upright board presses the card's target cell.
 * data: { own: { ships: [{ name, cells, sunk }], shotsAt: { cell: 'miss'|'hit'|'sunk' } }, target: { shots, sunk: [{ cells }] }, onTap(selector) }
 */
const CS = 0.022, N = 10, G = CS * N, T = 0.012; // a 22 cm grid of 2.2 cm squares
export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const gridTex = (title) => {
    const px = 1024, c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'), m = px * 0.08, cp = (px - m) / N;
    const sea = g.createLinearGradient(0, 0, px, px); sea.addColorStop(0, '#2a7fae'); sea.addColorStop(1, '#16577e'); g.fillStyle = sea; g.fillRect(0, 0, px, px);
    g.strokeStyle = 'rgba(220,240,255,.55)'; g.lineWidth = 2;
    for (let k = 0; k <= N; k++) { g.beginPath(); g.moveTo(m + k * cp, m); g.lineTo(m + k * cp, px); g.moveTo(m, m + k * cp); g.lineTo(px, m + k * cp); g.stroke(); }
    g.fillStyle = '#e8f4ff'; g.font = `600 ${Math.round(cp * 0.42)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < N; k++) { g.fillText(String(k + 1), m + (k + 0.5) * cp, m / 2); g.fillText('ABCDEFGHIJ'[k], m / 2, m + (k + 0.5) * cp); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData = { title }; return { t, m: m / px };
  };
  const shell = new THREE.MeshPhysicalMaterial({ color: '#3d4650', roughness: 0.45, clearcoat: 0.4 });
  const W = G * 1.08 + 0.02, D = G * 1.08 + 0.02;
  // the flat half: your ocean
  const oceanTex = gridTex('ocean'); oceanTex.t.center.set(0.5, 0.5); oceanTex.t.rotation = Math.PI; // the labels sit on the far left from you
  const oceanM = new THREE.MeshStandardMaterial({ map: oceanTex.t, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), [shell, shell, oceanM, shell, shell, shell]);
  base.position.y = T / 2; base.castShadow = base.receiveShadow = true; root.add(base);
  // labels take the first m of the texture: the grid squares start after it (top-left on the texture = far left from you)
  const off = oceanTex.m * W;
  const oceanAt = (cell, y) => { const r = Math.floor(cell / N), c = cell % N, s = (W - off) / N;
    return new THREE.Vector3(W / 2 - off - (c + 0.5) * s, y, D / 2 - off - (r + 0.5) * s); };
  // the upright half: your target board, facing you from behind the ocean
  const targetTex = gridTex('target'), targetM = new THREE.MeshStandardMaterial({ map: targetTex.t, roughness: 0.35 });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, D, T), [shell, shell, shell, shell, shell, targetM]);
  lid.position.set(0, T + D / 2, D / 2 + T / 2 + 0.004); lid.castShadow = lid.receiveShadow = true; lid.userData.lid = true; root.add(lid);
  const s2 = (W - off) / N;
  const targetAt = (cell) => { const r = Math.floor(cell / N), c = cell % N; return new THREE.Vector3(W / 2 - off - (c + 0.5) * s2, T + D - off - (r + 0.5) * s2, D / 2 - 0.002); };
  // pegs and ships
  const pegGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 0.012, 20), headGeo = new THREE.SphereGeometry(0.0042, 20, 12);
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.4 }), red = new THREE.MeshStandardMaterial({ color: '#d8302b', roughness: 0.35 });
  const hull = new THREE.MeshPhysicalMaterial({ color: '#9aa4ab', roughness: 0.4, metalness: 0.35, clearcoat: 0.4 }), wreck = new THREE.MeshStandardMaterial({ color: '#4b5157', roughness: 0.7 });
  const pegs = new THREE.Group(), ships = new THREE.Group(); root.add(pegs, ships);
  const peg = (pos, hit, upright) => { const g = new THREE.Group(), p = new THREE.Mesh(pegGeo, hit ? red : white), h = new THREE.Mesh(headGeo, hit ? red : white); h.position.y = 0.007; g.add(p, h); g.position.copy(pos); if (upright) g.rotation.x = -Math.PI / 2; p.castShadow = h.castShadow = true; pegs.add(g); };
  function paint(d) {
    for (const o of [...pegs.children]) pegs.remove(o);
    for (const o of [...ships.children]) { o.geometry.dispose(); ships.remove(o); }
    for (const sh of (d.own && d.own.ships) || []) { // a hull along its cells, rounded at the ends
      const a = oceanAt(sh.cells[0], T + 0.005), b = oceanAt(sh.cells[sh.cells.length - 1], T + 0.005), len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(CS * 0.36, len, 8, 20).rotateZ(Math.PI / 2).scale(1, 0.55, 1), sh.sunk ? wreck : hull);
      m.position.copy(a).lerp(b, 0.5); if (Math.abs(a.z - b.z) > 1e-6) m.rotation.y = Math.PI / 2; m.castShadow = true; ships.add(m);
    }
    for (const [c, r] of Object.entries((d.own && d.own.shotsAt) || {})) peg(oceanAt(+c, T + 0.012), r !== 'miss', false);
    for (const [c, r] of Object.entries((d.target && d.target.shots) || {})) peg(targetAt(+c), r !== 'miss', true);
  }
  paint(data);
  ctx.onTap((hits) => {
    const h = hits.find((x) => x.object.userData.lid || x.object.parent === pegs || (x.object.parent && x.object.parent.parent === pegs)); if (!h) return;
    const c = Math.round((W / 2 - off - h.point.x) / s2 - 0.5), r = Math.round((T + D - off - h.point.y) / s2 - 0.5);
    if (c >= 0 && c < N && r >= 0 && r < N && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + (r * N + c) + '"]');
  });
  ctx.addContactShadow({ y: 0.0005, size: W * 2.4, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  const both = new THREE.Group(); both.add(base.clone(), lid.clone()); both.visible = false; root.add(both); // fit the camera to the whole case
  ctx.frame(both, { view: [0, 0.75, -1], pad: 0.9, ground: 'none', minZoom: 0.5, maxZoom: 2.2, light: [-0.6, 1.3, -0.6] });
  root.remove(both);
  return {
    update(d) { paint(d); ctx.requestRender(); },
    state() { return { pegs: pegs.children.length, ships: ships.children.length }; },
    dispose() { for (const x of [base.geometry, lid.geometry, pegGeo, headGeo]) x.dispose(); for (const m of [shell, oceanM, targetM, white, red, hull, wreck]) { if (m.map) m.map.dispose(); m.dispose(); } },
  };
}
