/**
 * ringer miniature — Ringer's ring standing in the void: packed dirt with grit, a chalk ring drawn by hand, thirteen
 * glass marbles (cat's eyes with three vanes, swirls, clearies; each one its own from figures.js marbleLook) and a worn
 * agate shooter. Built from code. Nothing is simulated here: every frame poses the marbles from the card's one state
 * (skills/ringer-rules.js), and the spin of a rolling marble is the distance it moved over its radius.
 * Drag to flick: press the shooter, pull back and let go (data.onPull(x, y) while pulling, data.onRelease() on letting go);
 * a tap on the dirt aims, and a drag anywhere else looks around.
 * data: { state: ringer state, or () => ringer state; onAim?(x, y), onPull?(x, y), onRelease?() (metres on the ground, ring centre 0,0) }
 * (plain data works too, so the behaviour contract in tools/test_3d.mjs can drive it)
 */
import { marbleLook } from '../figures.js';
import * as R from '../ringer-rules.js';

export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const sh0 = (s) => s.marbles[0];
  const stateOf = (d) => (typeof d.state === 'function' ? d.state() : d.state);
  const made = []; // geometries, materials and textures to free
  const keep = (x) => { made.push(x); return x; };
  const noise = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; };
  let seedR = 7; const rnd = () => { seedR = (seedR * 16807) % 2147483647; return seedR / 2147483647; };

  // the ground: packed brown dirt with grit and a few pebbles, a little past the ring
  const G = R.FAR + 0.03; // out marbles are caught at R.FAR, so they always rest on the dirt
  const dirt = keep(new THREE.CanvasTexture(noise(512, 512, (g, w, h) => {
    g.fillStyle = '#6e5238'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 70 + rnd() * 60; g.fillStyle = 'rgba(' + (v + 40 | 0) + ',' + (v + 10 | 0) + ',' + (v - 20 | 0) + ',' + (0.15 + rnd() * 0.3).toFixed(2) + ')'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(' + (120 + rnd() * 60 | 0) + ',' + (110 + rnd() * 50 | 0) + ',' + (95 + rnd() * 40 | 0) + ',0.9)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1.5 + rnd() * 3, 1 + rnd() * 2.5, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  })));
  dirt.colorSpace = THREE.SRGBColorSpace;
  const groundMat = keep(new THREE.MeshStandardMaterial({ map: dirt, color: '#8c7a66', bumpMap: dirt, bumpScale: 1.5, roughness: 1, metalness: 0 })); // darkened under the filmic tone mapping; the grit stands up
  const ground = new THREE.Mesh(keep(new THREE.CircleGeometry(G, 96).rotateX(-Math.PI / 2)), groundMat);
  ground.receiveShadow = true; root.add(ground);

  // the chalk ring: a hand-drawn line, patchy where the chalk skipped over the grit
  const chalkAlpha = keep(new THREE.CanvasTexture(noise(1024, 8, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 150 + rnd() * 105; g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, 0, 1, h); } })));
  const chalkMat = keep(new THREE.MeshStandardMaterial({ color: '#f1eee4', roughness: 1, alphaMap: chalkAlpha, transparent: true, depthWrite: false }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(R.RING - 0.005, R.RING + 0.005, 192, 1).rotateX(-Math.PI / 2)), chalkMat);
  ring.position.y = 0.0006; ring.receiveShadow = true; root.add(ring);

  // the marbles: built per game (the seed decides every look), posed every frame from the state
  const sphere = keep(new THREE.SphereGeometry(1, 48, 32)), vaneGeo = keep(new THREE.SphereGeometry(1, 32, 16));
  const marbles = new THREE.Group(); root.add(marbles);
  let builtSeed = null, mats = [];
  function buildMarbles(s) {
    for (const m of mats) m.dispose(); mats = [];
    marbles.clear();
    for (const m of s.marbles) {
      const look = marbleLook(s.seed, m.id), grp = new THREE.Group();
      const glass = new THREE.MeshPhysicalMaterial({ color: look.glass, transmission: look.clarity, thickness: m.r * 2, ior: 1.52, roughness: 0.03 + look.wear * 0.3, clearcoat: 1, clearcoatRoughness: look.wear * 0.4, transparent: look.clarity > 0.2 });
      mats.push(glass);
      const body = new THREE.Mesh(sphere, glass); body.scale.setScalar(m.r); body.castShadow = true; grp.add(body);
      look.vanes.forEach((c, i) => { // the coloured vanes or ribbons inside the glass
        const vm = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }); mats.push(vm);
        const v = new THREE.Mesh(vaneGeo, vm); v.scale.set(m.r * 0.82, m.r * (look.kind === 'swirl' ? 0.3 : 0.1), m.r * 0.82);
        v.rotation.set(look.twist + i * Math.PI / look.vanes.length, i * 0.7, look.kind === 'swirl' ? 0.9 : 0); grp.add(v);
      });
      grp.userData = { id: m.id, x: m.x, y: m.y };
      grp.position.set(m.x, m.r, -m.y);
      marbles.add(grp);
    }
    builtSeed = s.seed;
  }

  // the aim: a faint chalk-white line from the shooter to where it would stop if it met nothing (ringer-rules.js reach), so
  // a stronger flick draws a longer line and the line is honest about the dirt; while pulling, a chalk arc round the shooter
  // fills with the power (a full circle is full power)
  const aimMat = keep(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
  const aimLine = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 0.0006, 0.0018)), aimMat); root.add(aimLine);
  const arcMat = keep(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  let arc = null, arcPower = -1;
  function powerArc(power, sh) {
    if (Math.abs(power - arcPower) > 1e-3 || !arc) {
      if (arc) { root.remove(arc); arc.geometry.dispose(); }
      const r0 = sh.r * 1.9, sweep = Math.max(0.02, power) * Math.PI * 2;
      arc = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 0.0016, 64, 1, 0, sweep).rotateX(-Math.PI / 2), arcMat); root.add(arc);
      arcPower = power;
    }
    arc.position.set(sh.x, 0.0013, -sh.y);
    arc.visible = true;
  }

  const axis = new THREE.Vector3(), q = new THREE.Quaternion();
  let sig = '', pulling = false;
  function pose() {
    const s = stateOf(ctx.handle ? ctx.handle.data : data);
    if (!s || !s.marbles) return false;
    const now = [s.seed, s.t, s.phase, s.angle, s.power, s.shots, pulling].join('|');
    if (now === sig) return false;
    if (s.seed !== builtSeed) buildMarbles(s);
    s.marbles.forEach((m, i) => {
      const grp = marbles.children[i]; if (!grp) return;
      const dx = m.x - grp.userData.x, dz = -(m.y - grp.userData.y), d = Math.hypot(dx, dz);
      if (d > 0 && d < 0.2) { axis.set(dz, 0, -dx).normalize(); q.setFromAxisAngle(axis, d / m.r); grp.quaternion.premultiply(q); } // rolled, not slid
      grp.userData.x = m.x; grp.userData.y = m.y;
      grp.position.set(m.x, m.r, -m.y);
    });
    const sh = s.marbles[0], gap = sh.r * 1.4, len = Math.max(0.004, R.reach(s).d - gap);
    aimLine.visible = s.phase === 'aim' && !s.over;
    aimLine.scale.x = len; aimLine.rotation.y = s.angle;
    aimLine.position.set(sh.x + Math.cos(s.angle) * (len / 2 + gap), 0.0012, -(sh.y + Math.sin(s.angle) * (len / 2 + gap)));
    if (pulling && aimLine.visible) powerArc(s.power, sh); else if (arc) arc.visible = false;
    sig = now;
    return true;
  }
  pose();

  ctx.onTap((hits) => {
    const h = hits.find((x) => x.object === ground || x.object === ring); if (!h) return;
    const d = ctx.handle.data; if (d.onAim) d.onAim(h.point.x, -h.point.z);
  });
  // drag to flick: a press on the shooter pulls it back (orbiting stops while pulling); the pointer's spot on the dirt goes to
  // the card, which turns it into aim and power through the rules (ringer-rules.js pull), and letting go flicks
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const onGround = (e) => {
    const r = ctx.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    return ray.ray.intersectPlane(plane, hit) ? [hit.x, -hit.z] : null;
  };
  const host = ctx.canvas.parentElement || ctx.canvas;
  const down = (e) => {
    if (e.button > 0) return;
    const s = stateOf(ctx.handle.data), shooter = marbles.children[0];
    if (!s || s.phase !== 'aim' || s.over || !shooter) return;
    const hits = ctx.pick(e.clientX, e.clientY, [shooter]) || [];
    if (!hits.length) return; // not on the shooter: a tap aims, a drag looks around
    e.stopPropagation(); e.preventDefault();
    if (ctx.controls) ctx.controls.enabled = false;
    pulling = true; ctx.canvas.style.cursor = 'grabbing'; if (pose()) ctx.requestRender();
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const move = (e) => {
    if (!pulling) return;
    const p = onGround(e), d = ctx.handle.data;
    if (p && d.onPull) d.onPull(p[0], p[1]);
  };
  const up = (e) => {
    if (!pulling) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    pulling = false; ctx.canvas.style.cursor = ''; if (pose()) ctx.requestRender();
    if (ctx.controls) ctx.controls.enabled = true;
    const d = ctx.handle.data;
    if (e.type === 'pointerup' && d.onRelease) d.onRelease();
  };
  host.addEventListener('pointerdown', down, { capture: true });

  ctx.addContactShadow({ y: 0.0008, size: G * 2.4, opacity: 0.55, blur: 2.4, darkness: 0.8, exclude: [ground, ring] });
  ctx.frame(ring, { view: [0, 1.15, 0.7], pad: 1, ground: 'none', minZoom: 0.6, maxZoom: 8, light: [-0.6, 1.4, 0.5] }); // fit the ring itself: the marbles read at card size
  return {
    update() { if (pose()) ctx.requestRender(); },
    tick() { return pose(); },
    state() { const s = stateOf(ctx.handle.data); return { marbles: marbles.children.length, left: R.left(s), out: s.out, shots: s.shots, phase: s.phase, rolling: s.phase === 'rolling', aiming: aimLine.visible, pulling, angle: s.angle, power: s.power, aimLength: aimLine.visible ? aimLine.scale.x + sh0(s).r * 1.4 : 0, reach: R.reach(s).d, arc: !!(arc && arc.visible), arcSweep: arc && arc.visible ? Math.max(0.02, arcPower) : 0 }; },
    dispose() { if (arc) arc.geometry.dispose(); host.removeEventListener('pointerdown', down, { capture: true }); for (const m of mats) m.dispose(); for (const x of made) x.dispose(); },
  };
}
