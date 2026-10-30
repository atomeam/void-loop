/**
 * padlock miniature: the password cards' 3D figure (owner, 2026-10-25: "should be a card for all too and 3d figure if possible"). A brass-bodied
 * padlock with a steel shackle and a keyhole, standing on the desk, with a strength strip across its face: one to five lit bars in the colour of
 * the rating. A strong password (score 3 or 4) keeps the shackle shut; a weak one (0 to 2) springs it open. A changed rating moves the shackle and
 * the bars; with reduced motion they land at once.
 * data: { score: 0..4 }. state(): { score, open, moving }.
 */
const COLOURS = ['#d93025', '#f28b20', '#f2c230', '#62b84a', '#1e9e5a'];
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const W = 0.05, H = 0.042, D = 0.018; // a 5 cm lock body
  const made = [];
  const keep = (m) => { made.push(m); return m; };
  const brass = keep(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.3 }));
  const steel = keep(new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.18 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: '#1c1a17', roughness: 0.8 }));
  const shape = new THREE.Shape(); const r = 0.006; // a rounded rectangle, extruded with a bevel
  shape.moveTo(-W / 2 + r, 0); shape.lineTo(W / 2 - r, 0); shape.quadraticCurveTo(W / 2, 0, W / 2, r); shape.lineTo(W / 2, H - r); shape.quadraticCurveTo(W / 2, H, W / 2 - r, H);
  shape.lineTo(-W / 2 + r, H); shape.quadraticCurveTo(-W / 2, H, -W / 2, H - r); shape.lineTo(-W / 2, r); shape.quadraticCurveTo(-W / 2, 0, -W / 2 + r, 0);
  const bodyGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: D - 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 4, curveSegments: 16 }));
  bodyGeo.translate(0, 0, -(D - 0.003) / 2);
  const body = new THREE.Mesh(bodyGeo, brass); body.castShadow = true; body.receiveShadow = true;
  // the shackle: a half torus over two legs; the right leg is long, so an open shackle stays caught in the body
  const SR = 0.016, ST = 0.0032;
  const arcGeo = keep(new THREE.TorusGeometry(SR, ST, 20, 64, Math.PI)), legGeo = keep(new THREE.CylinderGeometry(ST, ST, 0.016, 20)), longGeo = keep(new THREE.CylinderGeometry(ST, ST, 0.03, 20));
  const shackle = new THREE.Group();
  const arc = new THREE.Mesh(arcGeo, steel); arc.position.y = 0.016;
  const legL = new THREE.Mesh(legGeo, steel); legL.position.set(-SR, 0.008, 0);
  const legR = new THREE.Mesh(longGeo, steel); legR.position.set(SR, 0.001, 0);
  for (const m of [arc, legL, legR]) { m.castShadow = true; shackle.add(m); }
  const pivot = new THREE.Group(); pivot.position.set(SR, H - 0.004, 0); shackle.position.x = -SR; pivot.add(shackle); // it swings about its long leg
  // the keyhole and the strength strip on the face
  const holeGeo = keep(new THREE.CircleGeometry(0.0034, 24)), slotGeo = keep(new THREE.PlaneGeometry(0.0022, 0.007));
  const hole = new THREE.Mesh(holeGeo, dark), slot = new THREE.Mesh(slotGeo, dark);
  hole.position.set(0, 0.014, D / 2 + 0.0002); slot.position.set(0, 0.0105, D / 2 + 0.0002);
  const barGeo = keep(new THREE.BoxGeometry(0.0068, 0.004, 0.001)), bars = [];
  for (let i = 0; i < 5; i++) { const m = keep(new THREE.MeshStandardMaterial({ color: '#3a3328', roughness: 0.5, emissive: '#000000' })); const b = new THREE.Mesh(barGeo, m); b.position.set(-0.016 + i * 0.008, 0.031, D / 2 + 0.0006); bars.push(b); }
  const lock = new THREE.Group(); lock.add(body, pivot, hole, slot, ...bars); root.add(lock);
  let score = -1, lift = 0, target = 0;
  const OPEN_LIFT = 0.011;
  const pose = () => { pivot.position.y = H - 0.004 + lift; pivot.rotation.y = (lift / OPEN_LIFT) * -1.1; };
  const set = (d) => {
    score = Math.max(0, Math.min(4, Math.round(Number(d.score) || 0)));
    bars.forEach((b, i) => { const on = i <= score; b.material.color.set(on ? COLOURS[score] : '#3a3328'); b.material.emissive.set(on ? COLOURS[score] : '#000000'); b.material.emissiveIntensity = on ? 0.35 : 0; });
    target = score <= 2 ? OPEN_LIFT : 0; if (still) { lift = target; pose(); }
  };
  set(data); lift = target; pose();
  ctx.frame(root, { view: [0.25, 0.35, 1], pad: 1.3 });
  return {
    update(d) { set(d); ctx.requestRender(); },
    tick(dt) {
      if (lift === target) return false;
      const step = dt * 0.05; lift = Math.abs(target - lift) <= step ? target : lift + Math.sign(target - lift) * step; pose();
      return true;
    },
    state() { return { score, open: target > 0, moving: lift !== target }; },
    dispose() { for (const m of made) m.dispose(); },
  };
}
