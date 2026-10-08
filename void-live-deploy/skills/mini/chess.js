/**
 * chess miniature — the Poly Haven chess set (CC0, retextured as maple/walnut board with boxwood and rosewood pieces)
 * on a wooden table. Playable: taps call data.onSquare(sq); the card owns the rules (skills/chess-rules.js).
 * data: { board: Array(64) of FEN letters | null, last: move | null (from chess-rules play()), selected: sq | -1,
 *         targets: [{ to, capture }], check: sq | -1, onSquare(sq, candidates) } (candidates: every square along the tap, nearest first)
 * When `last` is new and explains the change, the piece glides there (captured pieces go to the side of the board);
 * any other change (new game, a reload) re-lays the set in place.
 */
import { S, TOP_Y, HALF, MODELS, sqPos, tapSquares, table, highlights, tweens } from './tabletop.js';

const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export default async function build(ctx, data) {
  const { THREE, root, phone } = ctx;
  const url = MODELS + (phone ? 'chess-set-wood-v1-1k.glb' : 'chess-set-wood-v1-2k.glb');
  const [{ scene: set }, tbl] = await Promise.all([ctx.loadGLTF(url), table(ctx, { bg: data.bg || '#0c0c0d' })]);
  const templates = {}; let board = null;
  for (const o of [...set.children]) {
    const m = /^piece_(\w+)_(white|black)$/.exec(o.name);
    if (m) { const code = Object.keys(NAMES).find((k) => NAMES[k] === m[1]); templates[m[2] === 'white' ? code.toUpperCase() : code] = o; set.remove(o); }
    else if (o.name === 'board') board = o;
  }
  if (!board || Object.keys(templates).length < 12) throw new Error('chess set model is missing pieces');
  board.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
  board.userData.isBoard = true;
  root.add(set);
  const pieces = new THREE.Group(); pieces.name = 'pieces'; root.add(pieces);
  const hl = highlights(THREE, root);
  const tw = tweens();
  const make = (code) => {
    // the model's node keeps its own transform (meshopt quantisation stores scale and a lift there), so wrap it
    const inner = templates[code].clone(true); inner.position.x = inner.position.z = 0;
    inner.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (/n/i.test(code)) inner.rotation.y = code === 'N' ? -Math.PI / 2 : Math.PI / 2; // knights in profile, the way players usually set them
    const o = new THREE.Group(); o.add(inner); o.userData.code = code; o.name = 'piece-' + code;
    return o;
  };
  let objs = Array(64).fill(null), lost = { w: [], b: [] }, shown = Array(64).fill(null), lastSeen = null;
  const lostPos = (color, i) => new THREE.Vector3((color === 'w' ? -1 : 1) * (HALF + 0.035 + Math.floor(i / 8) * 0.042), TOP_Y - 0.0174, (color === 'w' ? 1 : -1) * (3.5 - (i % 8)) * S * 0.92);
  const toGrave = (o, animate) => { const c = o.userData.code === o.userData.code.toUpperCase() ? 'w' : 'b'; const p = lostPos(c, lost[c].length); lost[c].push(o); o.userData.sq = undefined; if (animate) tw.add(o, p, { dur: 0.5, hop: 0.05, delay: 0.12 }); else o.position.copy(p); };
  function relay(b) { // lay the whole set from scratch
    tw.finish();
    for (const o of [...pieces.children]) pieces.remove(o);
    objs = Array(64).fill(null); lost = { w: [], b: [] };
    const count = {}; for (const p of b) if (p) count[p] = (count[p] || 0) + 1;
    b.forEach((p, sq) => { if (!p) return; const o = make(p); o.position.copy(sqPos(THREE, sq)); o.userData.sq = sq; pieces.add(o); objs[sq] = o; });
    for (const [p, n] of Object.entries({ P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 })) for (let i = count[p] || 0; i < n; i++) { const o = make(p); pieces.add(o); toGrave(o, false); }
  }
  function slide(m, b) { // animate one legal move; false when it doesn't explain the new board
    const mover = objs[m.from]; if (!mover) return false;
    const white = mover.userData.code === mover.userData.code.toUpperCase();
    const capSq = m.ep ? m.to + (white ? -8 : 8) : m.to;
    const nx = objs.slice();
    if (m.captured && nx[capSq]) { toGrave(nx[capSq], true); nx[capSq] = null; }
    nx[m.from] = null; nx[m.to] = mover; mover.userData.sq = m.to;
    tw.add(mover, sqPos(THREE, m.to), { hop: /n/i.test(mover.userData.code) ? 0.03 : 0.012, done: m.promo ? () => {
      const o = make(m.promo); o.position.copy(mover.position); o.userData.sq = m.to; pieces.remove(mover); pieces.add(o); objs[m.to] = o; ctx.requestRender(); } : null });
    if (m.castle) { const rf = m.castle === 'k' ? m.to + 1 : m.to - 2, rt = m.castle === 'k' ? m.to - 1 : m.to + 1; const rook = nx[rf]; if (rook) { nx[rf] = null; nx[rt] = rook; rook.userData.sq = rt; tw.add(rook, sqPos(THREE, rt), { delay: 0.18, hop: 0.02 }); } }
    objs = nx;
    return objs.every((o, sq) => (o ? (sq === m.to && m.promo ? m.promo : o.userData.code) : null) === (b[sq] || null));
  }
  function paint(d) {
    hl.clear();
    if (d.last) { hl.add(d.last.from, 'square', '#e8b04a', 0.28); hl.add(d.last.to, 'square', '#e8b04a', 0.36); }
    if (d.check >= 0) hl.add(d.check, 'glow', '#ff3b2f', 0.85, 1.25, 2);
    if (d.selected >= 0) hl.add(d.selected, 'square', '#ffd36b', 0.55, 0.96, 1);
    for (const t of d.targets || []) t.capture ? hl.add(t.to, 'ring', '#9fe08a', 0.85, 0.98, 3) : hl.add(t.to, 'dot', '#a8f08f', 0.95, 0.38, 3);
  }
  function update(d) {
    const b = d.board || [];
    const same = b.length === 64 && b.every((p, i) => (p || null) === shown[i]);
    if (!same) {
      const fresh = d.last && d.last !== lastSeen;
      if (!(fresh && slide(d.last, b))) relay(b);
      shown = b.map((p) => p || null);
    }
    lastSeen = d.last || null;
    paint(d); ctx.requestRender();
  }
  ctx.onTap((hits) => { const sqs = tapSquares(hits); if (sqs.length && typeof ctx.handle.data.onSquare === 'function') ctx.handle.data.onSquare(sqs[0], sqs); });
  // shadows: the board darkens the table around its edge; the pieces settle onto the squares
  ctx.addContactShadow({ y: 0, size: 1.0, height: 0.05, opacity: 0.75, blur: 2.4, darkness: 1 });
  ctx.addContactShadow({ y: TOP_Y + 0.0002, size: HALF * 2, height: 0.05, opacity: 0.85, blur: 2.6, darkness: 1.2, exclude: [board, set], res: phone ? 512 : 1024 });
  update(data);
  ctx.frame(board, { view: data.view || [0, 0.86, -1], pad: 0.74, ground: false, minZoom: 0.45, maxZoom: 1.5, light: [-0.55, 1.35, -0.45] });
  return {
    update,
    tick(dt) { return tw.tick(dt); },
    dispose() { tbl.dispose(); hl.dispose(); },
  };
}
