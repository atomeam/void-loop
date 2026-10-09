/**
 * The timer card's miniature (docs/miniatures.md): a 12 cm hourglass, glass bulbs in a turned walnut frame with brass
 * posts. The sand follows the timer: the top drains and the bottom piles up as time runs out, the thin stream falls
 * only while the timer runs, and starting a fresh run turns the glass over.
 * data: { duration: ms, remaining: ms, running: bool, startedAt: ms epoch (while running) }
 */
export function leftFraction(d, now = Date.now()) {
  const total = +d.duration || 0;
  if (total <= 0) return 0;
  const rem = d.running ? Math.max(0, (+d.remaining || 0) - (now - (+d.startedAt || now))) : Math.max(0, +d.remaining || 0);
  return Math.min(1, rem / total);
}

const NECK = 0.05; // height of the narrow waist, metres

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => { made.push(x); return x; };
  const lathe = (pts, seg = 72) => keep(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));

  const glassGroup = new THREE.Group(); // everything that turns over together
  // the glass: two bulbs joined at a narrow neck
  const glassMat = keep(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.09, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide }));
  const glass = new THREE.Mesh(lathe([[0.003, 0.002], [0.016, 0.005], [0.026, 0.014], [0.028, 0.026], [0.024, 0.037], [0.012, 0.046], [0.0028, NECK - 0.001], [0.0028, NECK + 0.001], [0.012, 0.054], [0.024, 0.063], [0.028, 0.074], [0.026, 0.086], [0.016, 0.095], [0.003, 0.098]]), glassMat);
  glass.renderOrder = 2;

  // sand: the top heap is a lathe shape hanging from the neck that shrinks toward it; the bottom is a cone that grows
  const sandMat = keep(new THREE.MeshStandardMaterial({ color: '#d9b26f', roughness: 0.95, side: THREE.DoubleSide }));
  const topSand = new THREE.Mesh(lathe([[0, 0], [0.0026, 0], [0.011, 0.0035], [0.022, 0.012], [0.026, 0.021], [0.0262, 0.026], [0, 0.026]]), sandMat);
  const topPivot = new THREE.Group(); topPivot.position.y = NECK + 0.001; topPivot.add(topSand);
  const pile = new THREE.Mesh(keep(new THREE.ConeGeometry(0.025, 0.024, 72, 1, false)), sandMat);
  const pilePivot = new THREE.Group(); pilePivot.position.y = 0.004; pile.position.y = 0.012; pilePivot.add(pile);
  const bed = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0205, 0.0205, 0.004, 72)), sandMat); bed.position.y = 0.006;
  const stream = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0007, 0.0007, NECK - 0.006, 12)), sandMat);
  stream.position.y = (NECK + 0.006) / 2;
  for (const m of [topSand, pile, bed, stream]) { m.castShadow = true; m.receiveShadow = true; }

  // the frame: walnut end caps, three brass posts
  const wood = keep(new THREE.MeshPhysicalMaterial({ color: '#5a3a22', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 }));
  const capGeo = keep(new THREE.CylinderGeometry(0.035, 0.037, 0.007, 72));
  const capLow = new THREE.Mesh(capGeo, wood); capLow.position.y = -0.0035;
  const capHigh = new THREE.Mesh(capGeo, wood); capHigh.position.y = 0.1015; capHigh.rotation.x = Math.PI;
  const brass = keep(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.25 }));
  const postGeo = keep(new THREE.CylinderGeometry(0.0022, 0.0022, 0.098, 24));
  const frame = [capLow, capHigh];
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const p = new THREE.Mesh(postGeo, brass); p.position.set(Math.cos(a) * 0.031, 0.049, Math.sin(a) * 0.031); frame.push(p); }
  for (const m of frame) { m.castShadow = true; m.receiveShadow = true; }

  glassGroup.add(capLow, capHigh, ...frame.slice(2), topPivot, pilePivot, bed, stream, glass);
  const turner = new THREE.Group(); turner.position.y = 0.0525; glassGroup.position.y = -0.0525; turner.add(glassGroup);
  const stand = new THREE.Group(); stand.position.y = 0.007; stand.add(turner);
  root.add(stand);
  ctx.frame(root, { view: [0.25, 0.22, 1], pad: 1.08 });

  let d = { ...data };
  let shown = -1, turn = null; // turn: { t } while the glass turns over

  function setSand(f) {
    const a = Math.max(0.0001, f), b = Math.max(0.0001, 1 - f);
    topSand.visible = f > 0.002;
    topPivot.scale.set(0.55 + 0.45 * Math.cbrt(a), a, 0.55 + 0.45 * Math.cbrt(a));
    pilePivot.scale.set(0.45 + 0.55 * Math.cbrt(b), b, 0.45 + 0.55 * Math.cbrt(b));
    stream.visible = !!d.running && f > 0.002 && f < 0.999;
    shown = f;
  }
  setSand(leftFraction(d));

  return {
    get fraction() { return shown; },
    get turning() { return !!turn; },
    update(next) {
      const before = leftFraction(d);
      d = { ...d, ...next };
      const now = leftFraction(d);
      // a fresh run (the sand jumps back up) turns the glass over, the way you would turn a real one
      if (now - before > 0.5 && !still) turn = { t: 0 };
      setSand(now); ctx.requestRender();
    },
    tick(dt) {
      let changed = false;
      if (turn) {
        turn.t = Math.min(1, turn.t + dt / 0.8);
        const e = turn.t < 0.5 ? 2 * turn.t * turn.t : 1 - Math.pow(-2 * turn.t + 2, 2) / 2;
        turner.rotation.z = (1 - e) * Math.PI; // starts upside down (the old bottom on top) and comes to rest upright
        if (turn.t >= 1) { turner.rotation.z = 0; turn = null; }
        changed = true;
      }
      const f = leftFraction(d);
      if (Math.abs(f - shown) > 0.0015 || (f === 0 && shown !== 0)) { setSand(f); changed = true; }
      return changed;
    },
    dispose() { for (const x of made) x.dispose(); },
  };
}
