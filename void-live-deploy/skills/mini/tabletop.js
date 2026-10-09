/**
 * tabletop — the shared wooden table, board, highlights and piece tweening behind the chess and checkers miniatures.
 * Not a miniature itself (no default export): chess.js and checkers.js import it.
 * Board geometry comes from the Poly Haven chess set (metres): 8 x 8 squares of S = 0.0579, playing surface at TOP_Y.
 * Square sq = rank * 8 + file (a1 = 0). You sit on the -z side looking toward +z, so rank 1 is nearest you and the a-file
 * is on your left (+x in three.js when looking down +z).
 */
export const S = 0.0579, TOP_Y = 0.0174, HALF = 0.2766;
export const MODELS = '/models/';
export const sqPos = (THREE, sq, y = TOP_Y) => new THREE.Vector3((3.5 - (sq & 7)) * S, y, ((sq >> 3) - 3.5) * S);
export function sqAt(p) { // board-space point -> square, or -1 off the board
  const f = Math.round(3.5 - p.x / S), r = Math.round(p.z / S + 3.5);
  return f < 0 || f > 7 || r < 0 || r > 7 || Math.abs(p.x) > 4 * S || Math.abs(p.z) > 4 * S ? -1 : r * 8 + f;
}
/** Every square along a tap's ray, nearest first: each piece hit (its userData.sq), then the board point under them.
 * The card picks the first one that means something (a piece you can move, a square you can move to), so a tall king
 * in front never swallows a tap meant for the pawn peeking out behind it. */
export function tapSquares(hits) {
  const out = [];
  for (const h of hits) {
    if (!h.object.visible || h.object.userData.noContactShadow) continue;
    let o = h.object; while (o && o.userData.sq === undefined && !o.userData.isBoard && o.parent) o = o.parent;
    const sq = o && o.userData.sq !== undefined ? o.userData.sq : o && o.userData.isBoard ? sqAt(h.point) : -1;
    if (sq >= 0 && !out.includes(sq)) out.push(sq);
    if (o && o.userData.isBoard) break; // nothing under the board counts
  }
  return out;
}
export const tapSquare = (hits) => tapSquares(hits)[0] ?? -1;

/** A big wooden table that fades into the card's colour, so the set sits on furniture, not in a void (or none: free). */
// free: no table at all, so the board stands on the stage with its own soft shadow (the card is only a control strip)
export async function table(ctx, { bg = '#0d0d0f', free = false } = {}) {
  const { THREE, scene, loadTexture, phone } = ctx;
  if (free) { scene.background = null; scene.fog = null; return { top: null, dispose() {} }; }
  const rep = [3, 3];
  const [map, nor, rough] = await Promise.all([
    loadTexture(MODELS + 'wood-v1/table-color.webp', { srgb: true, repeat: rep }),
    loadTexture(MODELS + 'wood-v1/table-normal.webp', { repeat: rep }),
    loadTexture(MODELS + 'wood-v1/table-rough.webp', { repeat: rep }),
  ]);
  const mat = new THREE.MeshPhysicalMaterial({ map, normalMap: nor, roughnessMap: rough, roughness: 1.6, color: '#d8c8b8', normalScale: new THREE.Vector2(0.5, 0.5), envMap: scene.environment, envMapIntensity: 0.14, specularIntensity: 0.35 });
  // a dim, rough, low-specular finish (an oiled table, not a lacquered one): at this grazing angle any shine turns the far
  // edge into grey haze, and the fog melts that edge into the card instead
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2), mat);
  top.receiveShadow = true; top.userData.noContactShadow = true; top.name = 'table';
  scene.add(top);
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 0.8, 1.75); // the far edge of the table melts into the card
  return { top, dispose() { top.geometry.dispose(); mat.dispose(); map.dispose(); nor.dispose(); rough.dispose(); } };
}

/** Soft square/dot/ring/glow decals that lie on the board (they never cast contact shadows). */
export function highlights(THREE, parent) {
  const tex = {};
  const make = (name, paint) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); paint(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tex[name] = t; };
  make('square', (g) => { g.fillStyle = '#fff'; const r = 10; g.beginPath(); g.roundRect(4, 4, 120, 120, r); g.fill(); });
  make('dot', (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  make('ring', (g) => { g.strokeStyle = '#fff'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke(); });
  make('glow', (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pool = []; let used = 0;
  const group = new THREE.Group(); group.name = 'highlights'; parent.add(group);
  return {
    group,
    clear() { for (let i = 0; i < pool.length; i++) pool[i].visible = false; used = 0; },
    /** kind: square | dot | ring | glow; size in squares; lift stacks decals so they never z-fight. */
    add(sq, kind, color, opacity = 0.5, size = 0.96, lift = 0) {
      let m = pool[used];
      if (!m) { m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); m.userData.noContactShadow = true; m.renderOrder = 2; pool.push(m); group.add(m); }
      used++;
      m.material.map = tex[kind]; m.material.color.set(color); m.material.opacity = opacity; m.material.needsUpdate = true;
      m.position.copy(sqPos(THREE, sq, TOP_Y + 0.0006 + lift * 0.0003)); m.scale.setScalar(S * size); m.visible = true;
      return m;
    },
    dispose() { geo.dispose(); for (const m of pool) m.material.dispose(); for (const t of Object.values(tex)) t.dispose(); },
  };
}

/** Tweens: glide a piece from A to B with a little hop, as a hand would lift it. tick(dt) returns true while moving. */
export function tweens() {
  const list = [];
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  return {
    get busy() { return list.length > 0; },
    add(obj, to, { dur = 0.38, hop = 0.018, delay = 0, done, from = null } = {}) { // from: where this leg starts (for chained hops)
      list.push({ obj, from: (from || obj.position).clone(), to: to.clone(), dur, hop, t: -delay, done });
    },
    tick(dt) {
      if (!list.length) return false;
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i]; a.t += dt; if (a.t < 0) continue;
        const k = Math.min(1, a.t / a.dur), e = ease(k);
        a.obj.position.lerpVectors(a.from, a.to, e); a.obj.position.y += Math.sin(Math.PI * k) * a.hop;
        if (k >= 1) { list.splice(i, 1); a.done && a.done(); }
      }
      return true;
    },
    finish() { for (const a of list.splice(0)) { a.obj.position.copy(a.to); a.done && a.done(); } },
  };
}
