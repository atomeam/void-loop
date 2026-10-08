/**
 * tic-tac-toe miniature — a maple board where the grid, every X and every O are carved into the wood (Adam, 2026-10-08:
 * "the x and o should be carved into the wood"). The top is a drawn grain texture plus a matching depth (bump) map, so
 * the cuts read as real grooves under the light; a new mark carves itself in stroke by stroke, and a winning line's
 * grooves fill with gold. Built from code. The card keeps the rules and Void's replies (skills/tictactoe.js).
 * data: { board: Array(9) of 'X'|'O'|null, win: [i], onTap(selector) }  Square i = row * 3 + col, row 0 far, col 0 left.
 */
const S = 0.07, H = 0.026, half = S * 1.5 + 0.02, CARVE = 0.45; // seconds to carve one mark
export default async function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const px = phone ? 512 : 1024, k = px / (half * 2);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = px; return c; };
  const colC = mk(), bumpC = mk(), col = colC.getContext('2d'), bump = bumpC.getContext('2d');
  // the wood, drawn once: warm maple with long grain
  const grain = mk(), g = grain.getContext('2d');
  const base = g.createLinearGradient(0, 0, px, px); base.addColorStop(0, '#d29a5c'); base.addColorStop(1, '#b77c42');
  g.fillStyle = base; g.fillRect(0, 0, px, px);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < px; y += 2 + rnd() * 6) {
    g.strokeStyle = `rgba(${110 + rnd() * 40},${60 + rnd() * 25},${20 + rnd() * 10},${0.06 + rnd() * 0.1})`; g.lineWidth = 0.8 + rnd() * 2.2;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(px * 0.3, y + rnd() * 14 - 7, px * 0.7, y + rnd() * 14 - 7, px, y + rnd() * 8 - 4); g.stroke();
  }
  // board point (x, z) -> canvas pixel on the top face (canvas x follows +x, canvas y follows +z)
  const P = (cx, cz) => [(cx + half) * k, (half + cz) * k];
  const cellC = (i) => [(1 - (i % 3)) * S, (1 - Math.floor(i / 3)) * S];
  // one carved stroke: a dark cut with a lit lower lip and a shadowed upper lip in colour, a deep line in the depth map
  function cut(path, w, t, gold) {
    col.save(); bump.save();
    for (const [ctx2, style, lw, dx, dy] of [
      [col, 'rgba(255,225,180,.35)', w * 1.25, 0, w * 0.18], // the lit far wall
      [col, 'rgba(40,20,6,.55)', w * 1.15, 0, -w * 0.12],     // the shadowed near wall
      [col, gold ? '#d9a93c' : '#5a3214', w * 0.8, 0, 0],      // the floor of the cut
      [bump, '#000', w * 0.8, 0, 0],
    ]) { ctx2.strokeStyle = style; ctx2.lineWidth = lw; ctx2.lineCap = 'round'; ctx2.translate(dx, dy); path(ctx2, t); ctx2.stroke(); ctx2.translate(-dx, -dy); }
    col.restore(); bump.restore();
  }
  const line = (a, b) => (c, t) => { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); };
  const arc = (cx, cy, r) => (c, t) => { c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t); };
  function mark(i, v, t, gold) {
    const [x, z] = cellC(i), [cx, cy] = P(x, z), r = S * 0.3 * k, w = S * 0.085 * k;
    if (v === 'O') cut(arc(cx, cy, r), w, t, gold);
    else { cut(line([cx - r, cy - r], [cx + r, cy + r]), w, Math.min(1, t * 2), gold); if (t > 0.5) cut(line([cx + r, cy - r], [cx - r, cy + r]), w, (t - 0.5) * 2, gold); }
  }
  let board = Array(9).fill(null), win = [], carving = {}, acc = 0; // i -> 0..1 while a new mark is being cut
  function draw() {
    col.drawImage(grain, 0, 0); bump.fillStyle = '#fff'; bump.fillRect(0, 0, px, px);
    const gw = S * 0.05 * k;
    for (const s of [-0.5, 0.5]) { cut(line(P(-S * 1.5, s * S), P(S * 1.5, s * S)), gw, 1); cut(line(P(s * S, -S * 1.5), P(s * S, S * 1.5)), gw, 1); }
    for (let i = 0; i < 9; i++) if (board[i]) mark(i, board[i], carving[i] ?? 1, win.includes(i));
    colTex.needsUpdate = true; bumpTex.needsUpdate = true;
  }
  const colTex = new THREE.CanvasTexture(colC); colTex.colorSpace = THREE.SRGBColorSpace; colTex.anisotropy = 8;
  const bumpTex = new THREE.CanvasTexture(bumpC);
  const topM = new THREE.MeshPhysicalMaterial({ map: colTex, bumpMap: bumpTex, bumpScale: 2.2, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const sideM = new THREE.MeshPhysicalMaterial({ color: '#a8703a', roughness: 0.55, clearcoat: 0.3 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(half * 2, H, half * 2), [sideM, sideM, topM, sideM, sideM, sideM]);
  slab.position.y = H / 2; slab.castShadow = slab.receiveShadow = true; slab.userData.isBoard = true; root.add(slab);
  function paint(d) {
    const b = (d.board || []).slice(0, 9);
    for (let i = 0; i < 9; i++) if (b[i] && !board[i]) carving[i] = 0; // new marks carve in
    for (const i of Object.keys(carving)) if (!b[i]) delete carving[i];
    board = b.map((v) => (v === 'X' || v === 'O' ? v : null)); win = (d.win || []).slice();
    draw();
  }
  paint(data);
  ctx.onTap((hits) => {
    const h = hits.find((x) => x.object.userData.isBoard);
    if (!h) return;
    const l = slab.worldToLocal(h.point.clone()), c = Math.round(1 - l.x / S), r = Math.round(1 - l.z / S);
    if (c >= 0 && c < 3 && r >= 0 && r < 3 && ctx.handle.data.onTap) ctx.handle.data.onTap('button[data-i="' + (r * 3 + c) + '"]');
  });
  ctx.addContactShadow({ y: 0.0005, size: half * 3.4, opacity: 0.7, blur: 3.2, darkness: 0.9, exclude: [] });
  ctx.frame(slab, { view: [0, 1.4, -1], pad: 0.78, ground: 'none', minZoom: 0.5, maxZoom: 1.8, light: [-0.7, 1.2, -0.2] });
  return {
    update(d) { paint(d); ctx.requestRender(); },
    tick(dt) {
      const busy = Object.keys(carving).filter((i) => carving[i] < 1);
      if (!busy.length) return false;
      for (const i of busy) carving[i] = Math.min(1, carving[i] + dt / CARVE);
      acc += dt; if (acc < 1 / 30 && busy.every((i) => carving[i] < 1)) return false; // ~30 carve steps a second; the last step always draws
      acc = 0; draw(); return 'view'; // the cut is in the texture: redraw the view, the soft shadows don't change
    },
    state() { return { marks: board.filter(Boolean).length, carving: Object.values(carving).some((t) => t < 1) }; },
    dispose() { slab.geometry.dispose(); colTex.dispose(); bumpTex.dispose(); topM.dispose(); sideM.dispose(); },
  };
}
