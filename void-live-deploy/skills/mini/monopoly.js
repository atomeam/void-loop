/**
 * monopoly miniature — the property board standing in the void: the forty spaces with their colour bands and names drawn on
 * the top, a pawn per seat that walks round space by space, owner markers, green houses and red hotels, and the last roll on
 * two dice in the middle. Built from code. The card keeps every rule (skills/monopoly-rules.js); a tap presses the card's space.
 * data: { owner: { space: seat }, houses: { space: n }, players: [{ pos, out }], picked, dice: [a, b] | null, onTap(selector) }
 */
import { tweens } from './tabletop.js';

const B = 0.5, C = B / 11, H = 0.016; // a 50 cm board, eleven spaces a side
const BAND = { brown: '#8a5a3c', lightblue: '#9fd3ef', pink: '#d9559c', orange: '#f08a2c', red: '#d9353a', yellow: '#f2d23a', green: '#2f9b57', darkblue: '#1f4fa8' };
const SEATS = ['#e9e4d8', '#7b6cff', '#3ec7b0', '#f0a64a'];
const cellOf = (i) => (i <= 10 ? [10, 10 - i] : i <= 20 ? [10 - (i - 10), 0] : i <= 30 ? [0, i - 20] : [i - 30, 10]); // [row, col], as on the card

export default async function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const { SPACES } = await import('../monopoly-rules.js');
  // world position of a space's centre: you sit at the bottom of the card's board (Go is near you on the right)
  const at = (i, y, dx = 0, dz = 0) => { const [r, c] = cellOf(i); return new THREE.Vector3((5 - c) * C + dx, y, (5 - r) * C + dz); };
  // the top, drawn as the card shows it, then turned half round onto the box so it lands the right way up
  const px = phone ? 1024 : 2048, cp = px / 11, flat = document.createElement('canvas'); flat.width = flat.height = px;
  const g = flat.getContext('2d');
  g.fillStyle = '#cfe2c8'; g.fillRect(0, 0, px, px);
  SPACES.forEach((sp, i) => {
    const [r, c] = cellOf(i), x = c * cp, y = r * cp;
    g.fillStyle = '#eef4ea'; g.fillRect(x + 1, y + 1, cp - 2, cp - 2);
    if (sp.g) { g.fillStyle = BAND[sp.g]; const side = r === 10 ? 'top' : r === 0 ? 'bottom' : c === 0 ? 'right' : 'left';
      if (side === 'top') g.fillRect(x + 1, y + 1, cp - 2, cp * 0.24); else if (side === 'bottom') g.fillRect(x + 1, y + cp * 0.76, cp - 2, cp * 0.24 - 1);
      else if (side === 'right') g.fillRect(x + cp * 0.76, y + 1, cp * 0.24 - 1, cp - 2); else g.fillRect(x + 1, y + 1, cp * 0.24, cp - 2); }
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = sp.n.split(' '), fs = Math.round(cp * (sp.t === 'street' || sp.t === 'station' ? 0.13 : 0.15));
    g.font = `600 ${fs}px 'Helvetica Neue', Arial, sans-serif`;
    words.forEach((w, k) => g.fillText(w, x + cp / 2, y + cp * 0.5 + (k - (words.length - 1) / 2) * fs * 1.1));
    if (sp.p) { g.font = `${Math.round(fs * 0.9)}px Arial, sans-serif`; g.fillText(String(sp.p), x + cp / 2, y + cp * 0.86); }
  });
  g.fillStyle = '#2b4a33'; g.font = `700 ${Math.round(cp * 0.9)}px Georgia, serif`; g.textAlign = 'center'; g.fillText('MONOPOLY', px / 2, px / 2);
  const c2 = document.createElement('canvas'); c2.width = c2.height = px;
  const g2 = c2.getContext('2d'); g2.translate(px, px); g2.rotate(Math.PI); g2.drawImage(flat, 0, 0);
  const topMap = new THREE.CanvasTexture(c2); topMap.colorSpace = THREE.SRGBColorSpace; topMap.anisotropy = 8;
  const topM = new THREE.MeshPhysicalMaterial({ map: topMap, roughness: 0.55, clearcoat: 0.3 });
  const edgeM = new THREE.MeshPhysicalMaterial({ color: '#2b4a33', roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(B, H, B), [edgeM, edgeM, topM, edgeM, edgeM, edgeM]);
  board.position.y = H / 2; board.castShadow = board.receiveShadow = true; board.userData.isBoard = true; root.add(board);
  // pawns: a turned piece per seat, in the seat's colour
  const pawnGeo = new THREE.LatheGeometry([[0, 0], [0.009, 0], [0.009, 0.002], [0.005, 0.004], [0.0032, 0.012], [0.0045, 0.0145], [0.0045, 0.016]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const headGeo = new THREE.SphereGeometry(0.0052, 24, 16);
  const pawns = (data.players || []).map((_, k) => {
    const m = new THREE.MeshPhysicalMaterial({ color: SEATS[k], roughness: 0.3, metalness: 0.4, clearcoat: 0.6 });
    const o = new THREE.Group(), body = new THREE.Mesh(pawnGeo, m), head = new THREE.Mesh(headGeo, m);
    head.position.y = 0.02; body.castShadow = head.castShadow = true; o.add(body, head); root.add(o);
    return { o, m, pos: -1 };
  });
  const offset = (k) => [(k % 2 ? 1 : -1) * C * 0.18, (k < 2 ? -1 : 1) * C * 0.18]; // seats share a space side by side
  const houseGeo = new THREE.BoxGeometry(C * 0.16, C * 0.14, C * 0.16), roofGeo = new THREE.ConeGeometry(C * 0.13, C * 0.1, 4);
  const hotelGeo = new THREE.BoxGeometry(C * 0.5, C * 0.18, C * 0.2);
  const greenM = new THREE.MeshStandardMaterial({ color: '#1f8a45', roughness: 0.5 }), redM = new THREE.MeshStandardMaterial({ color: '#c0262b', roughness: 0.5 });
  const markGeo = new THREE.CylinderGeometry(C * 0.1, C * 0.1, 0.002, 24);
  const ringGeo = new THREE.RingGeometry(C * 0.44, C * 0.5, 4, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 4);
  const ringM = new THREE.MeshBasicMaterial({ color: '#ffd76a' });
  const marks = new THREE.Group(), builds = new THREE.Group(), pickG = new THREE.Group(); root.add(marks, builds, pickG);
  // dice in the middle
  const pip = (n) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#1b1b1f';
    const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] };
    for (const [a, b] of P[n]) { x.beginPath(); x.arc(a, b, 11, 0, Math.PI * 2); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const faces = [1, 2, 3, 4, 5, 6].map((n) => new THREE.MeshStandardMaterial({ map: pip(n), roughness: 0.4 }));
  const dieGeo = new THREE.BoxGeometry(0.016, 0.016, 0.016);
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z; the +y face shows the roll
  const dieFor = (n) => { const rest = [1, 2, 3, 4, 5, 6].filter((f) => f !== n && f !== 7 - n); return new THREE.Mesh(dieGeo, [rest[0], rest[1], n, 7 - n, rest[2], rest[3]].map((v) => faces[v - 1])); };
  let dice = [];
  const tw = tweens();
  function paint(d) {
    for (const o of [...marks.children]) marks.remove(o);
    for (const o of [...builds.children]) builds.remove(o);
    for (const o of [...pickG.children]) pickG.remove(o);
    for (const [i, o] of Object.entries(d.owner || {})) { const m = new THREE.Mesh(markGeo, new THREE.MeshStandardMaterial({ color: SEATS[o], roughness: 0.4 })); m.position.copy(at(+i, H + 0.001, 0, 0)); m.position.lerp(new THREE.Vector3(0, H + 0.001, 0), 0.06); marks.add(m); }
    for (const [i, n] of Object.entries(d.houses || {})) {
      if (n === 5) { const h = new THREE.Mesh(hotelGeo, redM); h.position.copy(at(+i, H + C * 0.09)); h.castShadow = true; builds.add(h); continue; }
      for (let k = 0; k < n; k++) { const h = new THREE.Group(), b = new THREE.Mesh(houseGeo, greenM), roof = new THREE.Mesh(roofGeo, greenM); roof.position.y = C * 0.12; roof.rotation.y = Math.PI / 4; h.add(b, roof);
        h.position.copy(at(+i, H + C * 0.07, (k - 1.5) * C * 0.2, 0)); b.castShadow = true; builds.add(h); }
    }
    if (d.picked >= 0) { const r = new THREE.Mesh(ringGeo, ringM); r.position.copy(at(d.picked, H + 0.0012)); pickG.add(r); }
    (d.players || []).forEach((p, k) => {
      const pw = pawns[k]; if (!pw) return;
      pw.o.visible = !p.out;
      const [dx, dz] = offset(k);
      if (pw.pos < 0) { pw.o.position.copy(at(p.pos, H, dx, dz)); pw.pos = p.pos; return; }
      if (pw.pos === p.pos) return;
      // walk round space by space (a card that sends you back, or to Jail, jumps straight there)
      const steps = (p.pos - pw.pos + 40) % 40;
      if (steps > 0 && steps <= 12) { let from = pw.o.position.clone(); for (let s = 1; s <= steps; s++) { const to = at((pw.pos + s) % 40, H, dx, dz); tw.add(pw.o, to, { dur: 0.16, hop: 0.012, delay: (s - 1) * 0.16, from }); from = to; } }
      else tw.add(pw.o, at(p.pos, H, dx, dz), { dur: 0.5, hop: 0.04 });
      pw.pos = p.pos;
    });
    for (const o of dice) root.remove(o);
    dice = (d.dice || []).map((n, k) => { const m = dieFor(n); m.position.set((k ? -1 : 1) * 0.014, H + 0.008, -C * 1.2); m.rotation.y = (k ? -0.3 : 0.25); m.castShadow = true; root.add(m); return m; });
  }
  paint(data);
  ctx.onTap((hits) => {
    const h = hits.find((x) => x.object.userData.isBoard); if (!h) return;
    const l = board.worldToLocal(h.point.clone()), c = Math.round(5 - l.x / C), r = Math.round(5 - l.z / C);
    if (r < 0 || r > 10 || c < 0 || c > 10 || (r > 0 && r < 10 && c > 0 && c < 10)) return;
    const i = SPACES.findIndex((_, k) => { const [rr, cc] = cellOf(k); return rr === r && cc === c; });
    if (i >= 0 && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + i + '"]');
  });
  ctx.addContactShadow({ y: 0.0005, size: B * 1.6, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(board, { view: [0, 1.5, -1], pad: 0.72, ground: 'none', minZoom: 0.5, maxZoom: 2.4, light: [-0.55, 1.4, -0.4] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) { return tw.tick(dt); },
    state() { return { pawns: pawns.map((p) => p.pos), marks: marks.children.length, builds: builds.children.length, dice: dice.length }; },
    dispose() { for (const x of [board.geometry, pawnGeo, headGeo, houseGeo, roofGeo, hotelGeo, markGeo, ringGeo, dieGeo]) x.dispose(); for (const m of [topM, edgeM, greenM, redM, ringM, ...faces, ...pawns.map((p) => p.m)]) { if (m.map) m.map.dispose(); m.dispose(); } topMap.dispose(); },
  };
}
