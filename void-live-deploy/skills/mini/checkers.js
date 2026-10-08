/**
 * checkers miniature — turned wooden draughts (rosewood for you, oak for Void) on the same maple and walnut board
 * and wooden table as chess. Playable: taps call data.onSquare(sq); the card owns the rules (skills/checkers-rules.js).
 * data: { board: Array(64) of 'd' 'D' 'l' 'L' | null, last: move | null (from checkers-rules play()), selected: sq | -1,
 *         targets: [sq], hops: [sq] (the path tapped so far), movable: [sq] (pieces that must or may move), onSquare(sq, candidates) }
 * A king is two men stacked, as on a real board. A new `last` that explains the change glides the man along its jumps.
 */
import { S, TOP_Y, HALF, MODELS, sqPos, tapSquares, table, highlights, tweens } from './tabletop.js';

const R = 0.0232, Hh = 0.0088; // a man: 46 mm across, 9 mm tall, like a tournament set scaled to this board
function profile(THREE) { // radius, height: a bevelled rim, a shallow dished top with a turned ring
  const p = [[0, 0], [R - 0.0012, 0], [R - 0.0002, 0.0007], [R, 0.0016], [R, Hh - 0.0018], [R - 0.0003, Hh - 0.0007], [R - 0.0013, Hh], [R - 0.0034, Hh],
    [R - 0.0042, Hh - 0.0006], [R - 0.005, Hh], [R - 0.0062, Hh - 0.0002], [R * 0.45, Hh - 0.0011], [R * 0.2, Hh - 0.0013], [0, Hh - 0.0013]];
  const g = new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 72);
  // grain projected from above (a lathe's own UVs would wrap the grain around the rim)
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (R * 5) + 0.5, pos.getZ(i) / (R * 5) + 0.5 + pos.getY(i) * 3);
  uv.needsUpdate = true; g.computeVertexNormals();
  return g;
}
export default async function build(ctx, data) {
  const { THREE, root, phone, loadTexture } = ctx;
  const url = MODELS + (phone ? 'chess-board-wood-v1-1k.glb' : 'chess-board-wood-v1-2k.glb');
  const tex = (n, srgb) => loadTexture(MODELS + 'wood-v1/' + n + '.webp', { srgb });
  const [{ scene: set }, tbl, oakC, oakR, roseC] = await Promise.all([ctx.loadGLTF(url), table(ctx, { bg: data.bg || '#0c0c0d' }),
    tex('oak-color', true), tex('oak-rough', false), tex('rosewood-color', true)]);
  const board = set.getObjectByName('board') || set;
  board.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
  board.userData.isBoard = true; root.add(set);
  const geo = profile(THREE);
  const mats = {
    l: new THREE.MeshPhysicalMaterial({ map: oakC, roughnessMap: oakR, roughness: 0.9, color: '#f2dfc0', clearcoat: 0.55, clearcoatRoughness: 0.32 }),
    d: new THREE.MeshPhysicalMaterial({ map: roseC, roughness: 0.42, color: '#9a5a44', clearcoat: 0.7, clearcoatRoughness: 0.22 }),
  };
  const crownMat = new THREE.MeshStandardMaterial({ color: '#d4a64a', metalness: 1, roughness: 0.32 });
  const crownGeo = new THREE.TorusGeometry(R * 0.42, 0.0011, 12, 48).rotateX(Math.PI / 2);
  const pieces = new THREE.Group(); pieces.name = 'pieces'; root.add(pieces);
  const hl = highlights(THREE, root), tw = tweens();
  const disc = (side) => { const m = new THREE.Mesh(geo, mats[side]); m.castShadow = m.receiveShadow = true; m.rotation.y = Math.random() * Math.PI * 2; return m; };
  function make(code) {
    const side = code.toLowerCase(), o = new THREE.Group(); o.add(disc(side)); o.userData.code = code;
    if (code !== side) crown(o);
    return o;
  }
  function crown(o) { // a king: a second man on top, with a thin brass ring so it reads at a glance
    const top = disc(o.userData.code.toLowerCase()); top.position.y = Hh; o.add(top);
    const ring = new THREE.Mesh(crownGeo, crownMat); ring.position.y = Hh * 2 - 0.0009; o.add(ring);
    o.userData.code = o.userData.code.toUpperCase();
  }
  let objs = Array(64).fill(null), lost = { d: 0, l: 0 }, shown = Array(64).fill(null), lastSeen = null;
  const lostPos = (side, i) => new THREE.Vector3((side === 'd' ? -1 : 1) * (HALF + 0.035 + Math.floor(i / 6) * 0.05), 0, (side === 'd' ? 1 : -1) * (2.5 - (i % 6)) * S * 0.9 + (i % 2) * 0.004);
  const toSide = (o, delay) => { const side = o.userData.code.toLowerCase(); const p = lostPos(side, lost[side]++); o.userData.sq = undefined; if (delay === undefined) o.position.copy(p); else tw.add(o, p, { dur: 0.45, hop: 0.04, delay }); };
  function relay(b) {
    tw.finish(); for (const o of [...pieces.children]) pieces.remove(o);
    objs = Array(64).fill(null); lost = { d: 0, l: 0 };
    const n = { d: 0, l: 0 };
    b.forEach((p, sq) => { if (!p) return; const o = make(p); o.position.copy(sqPos(THREE, sq)); o.userData.sq = sq; pieces.add(o); objs[sq] = o; n[p.toLowerCase()] += p === p.toLowerCase() ? 1 : 2; });
    for (const side of ['d', 'l']) for (let i = Math.min(12, n[side]); i < 12; i++) { const o = make(side); pieces.add(o); toSide(o); }
  }
  function slide(m, b) {
    const mover = objs[m.from]; if (!mover) return false;
    const nx = objs.slice(); nx[m.from] = null;
    let t = 0, from = mover.position.clone(); const step = 0.3;
    m.path.forEach((sq, i) => {
      const p = sqPos(THREE, sq);
      tw.add(mover, p, { from, dur: step, hop: m.captures.length ? 0.022 : 0.008, delay: t }); from = p;
      const cap = m.captures[i]; if (cap !== undefined && nx[cap]) { toSide(nx[cap], t + step * 0.6); nx[cap] = null; }
      t += step + 0.05;
    });
    const to = m.path[m.path.length - 1]; nx[to] = mover; mover.userData.sq = to;
    if (m.crown) tw.add(mover, sqPos(THREE, to), { from: sqPos(THREE, to), dur: 0.01, hop: 0, delay: t, done: () => crown(mover) }); // crowned on arrival
    objs = nx;
    return objs.every((o, sq) => (o ? (sq === to && m.crown ? o.userData.code.toUpperCase() : o.userData.code) : null) === (b[sq] || null));
  }
  function paint(d) {
    hl.clear();
    if (d.last) { hl.add(d.last.from, 'square', '#e8b04a', 0.26); for (const sq of d.last.path) hl.add(sq, 'square', '#e8b04a', 0.32); }
    for (const sq of d.movable || []) hl.add(sq, 'ring', '#ffd36b', 0.8, 1.14, 1); // wider than a man, so the ring shows around it
    if (d.selected >= 0) hl.add(d.selected, 'square', '#ffd36b', 0.55, 0.96, 2);
    for (const sq of d.hops || []) hl.add(sq, 'square', '#9fe08a', 0.35, 0.96, 2);
    for (const sq of d.targets || []) hl.add(sq, 'dot', '#a8f08f', 0.95, 0.38, 3);
  }
  function update(d) {
    const b = d.board || [];
    if (!(b.length === 64 && b.every((p, i) => (p || null) === shown[i]))) {
      if (!(d.last && d.last !== lastSeen && slide(d.last, b))) relay(b);
      shown = b.map((p) => p || null);
    }
    lastSeen = d.last || null; paint(d); ctx.requestRender();
  }
  ctx.onTap((hits) => { const sqs = tapSquares(hits); if (sqs.length && typeof ctx.handle.data.onSquare === 'function') ctx.handle.data.onSquare(sqs[0], sqs); });
  ctx.addContactShadow({ y: 0, size: 1.0, height: 0.05, opacity: 0.75, blur: 2.4, darkness: 1 });
  ctx.addContactShadow({ y: TOP_Y + 0.0002, size: HALF * 2, height: 0.025, opacity: 0.8, blur: 2.2, darkness: 1.2, exclude: [set], res: phone ? 512 : 1024 });
  update(data);
  ctx.frame(board, { view: data.view || [0, 0.95, -1], pad: 0.74, ground: false, minZoom: 0.45, maxZoom: 1.5, light: [-0.55, 1.35, -0.45] });
  return {
    update,
    tick(dt) { return tw.tick(dt); },
    dispose() { tbl.dispose(); hl.dispose(); geo.dispose(); crownGeo.dispose(); crownMat.dispose(); for (const m of Object.values(mats)) m.dispose(); oakC.dispose(); oakR.dispose(); roseC.dispose(); },
  };
}
