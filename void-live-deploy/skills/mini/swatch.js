/**
 * swatch miniature: the colour card's 3D figure (owner, 2026-10-25: "should be a card for all too and 3d figure if possible"). A paint-chip fan
 * riveted at one end and spread on the desk: the asked colour on the top chip with its hex code printed on it, and its tints and shades on the
 * chips under it, light to dark. A new colour re-paints the chips and the fan sweeps open again; with reduced motion it is open at once.
 * data: { hex: '#rrggbb' }. state(): { hex, opening }.
 */
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hexOf = (s) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s || '').trim()); if (!m) return '#6d4aff'; const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]; return '#' + h.toLowerCase(); };
const mix = (hex, to, k) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return '#' + c.map((v) => clamp(v + (to - v) * k).toString(16).padStart(2, '0')).join(''); };
const ink = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 140 ? '#111111' : '#ffffff'; };

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const L = 0.13, Wd = 0.03, T = 0.0012, N = 7; // 13 cm chips
  const geo = new THREE.BoxGeometry(Wd, T, L); geo.translate(0, 0, -L / 2 + Wd / 2); // pivot at the rivet end
  const card = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.85 });
  const chips = [], fan = new THREE.Group();
  for (let i = 0; i < N; i++) {
    const top = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const m = new THREE.Mesh(geo, [card, card, top, card, card, card]); m.position.y = i * T * 1.05; m.castShadow = true; m.receiveShadow = true;
    chips.push(m); fan.add(m);
  }
  const rivetGeo = new THREE.CylinderGeometry(0.0035, 0.0035, N * T * 1.1 + 0.002, 24), rivetMat = new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 1, roughness: 0.25 });
  const rivet = new THREE.Mesh(rivetGeo, rivetMat); rivet.position.y = (N * T * 1.05) / 2; rivet.castShadow = true; fan.add(rivet);
  fan.rotation.y = 0.9; root.add(fan);
  let hex = '', open = 0, label = null;
  const SPREAD = 0.22; // radians between chips when open
  const pose = () => chips.forEach((m, i) => { m.rotation.y = -(N - 1 - i) * SPREAD * open; });
  const paint = (d) => {
    hex = hexOf(d.hex);
    const shades = [mix(hex, 255, 0.75), mix(hex, 255, 0.5), mix(hex, 255, 0.25), mix(hex, 0, 0.45), mix(hex, 0, 0.3), mix(hex, 0, 0.15), hex]; // the top chip is the colour itself
    chips.forEach((m, i) => m.material[2].color.set(shades[i]));
    const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, 256, 1024); g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 256, 204); // the label at the free end, away from the rivet
    g.fillStyle = '#222'; g.font = '700 44px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(hex.toUpperCase(), 128, 95); g.font = '28px system-ui, sans-serif'; g.fillStyle = '#666'; g.fillText('VERSE', 128, 150);
    g.fillStyle = ink(hex); g.globalAlpha = 0.15; g.beginPath(); g.arc(128, 900, 30, 0, Math.PI * 2); g.fill();
    if (label) label.dispose(); label = new THREE.CanvasTexture(c); label.colorSpace = THREE.SRGBColorSpace; label.anisotropy = 4;
    const top = chips[N - 1].material[2]; top.map = label; top.color.set('#ffffff'); top.needsUpdate = true;
  };
  paint(data); open = 1; pose();
  ctx.frame(root, { view: [0, 1, 0.55], pad: 1.15 });
  open = still ? 1 : 0; pose();
  return {
    update(d) { const was = hex; paint(d); if (hexOf(d.hex) !== was) { open = still ? 1 : 0; pose(); } ctx.requestRender(); },
    tick(dt) { if (open >= 1) return false; open = Math.min(1, open + dt * 1.6); pose(); return true; },
    state() { return { hex, opening: open < 1 }; },
    dispose() { geo.dispose(); card.dispose(); chips.forEach((m) => m.material[2].dispose()); rivetGeo.dispose(); rivetMat.dispose(); if (label) label.dispose(); },
  };
}
