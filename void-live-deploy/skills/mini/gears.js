/**
 * gears miniature — explainer.gear-pair standing in the void: a brass driver and a steel driven gear lying on a walnut
 * plate on their shafts, each with a red revolution marker so turns can be counted. Teeth come from the same outline as
 * the card's flat drawing (gear-pair-rules.js toothOutline), and every frame poses both gears from the card's one
 * authoritative state (data.state(), data.now()): nothing is accumulated here, so the pair never drifts. Drag a gear
 * to turn it (data.onDrag(which, degrees, end)); drag the space around it to look around.
 * data: { state: gear state, or () => gear state; now?: () => seconds (default: the clock); onDrag?(which, deg, end) }
 * (plain data works too, so the behaviour contract in tools/test_3d.mjs can drive it)
 */
import * as G from '../gear-pair-rules.js';

const T = 0.008, LIFT = 0.006, MARGIN = 0.03; // gear thickness, the gap under the gears, the plate's border round the pair
export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const stateOf = (d) => (typeof d.state === 'function' ? d.state() : d.state);
  const nowOf = (d) => (typeof d.now === 'function' ? d.now() : Date.now() / 1000);
  const rad = (d) => (d % 360) * Math.PI / 180;
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.33 });
  const steel = new THREE.MeshStandardMaterial({ color: '#aab3be', metalness: 0.9, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2b30', metalness: 0.6, roughness: 0.4 });
  const marker = new THREE.MeshStandardMaterial({ color: '#e0303e', roughness: 0.45 });
  const wood = new THREE.MeshPhysicalMaterial({ color: '#3d2716', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  // the plate fits the pair it carries: more teeth, bigger gears, a bigger plate (and the view re-frames to it)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 1), wood);
  plate.position.y = -0.006; plate.receiveShadow = plate.castShadow = true; root.add(plate);

  const pair = new THREE.Group(); root.add(pair);
  let built = '', parts = null;
  function gearGroup(teeth, r, mat) {
    const shape = new THREE.Shape(G.toothOutline(teeth, r).map(([x, y]) => new THREE.Vector2(x, y)));
    const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.16, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 24 }).rotateX(-Math.PI / 2);
    const g = new THREE.Group(), body = new THREE.Mesh(geo, mat); body.castShadow = body.receiveShadow = true; body.position.y = LIFT; g.add(body);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.0025, r * 0.08), Math.max(0.0025, r * 0.08), 0.0012, 20), marker);
    dot.position.set(r * 0.62, LIFT + T + 0.0012, 0); g.add(dot); // the revolution marker sits on +x of the gear, like the flat drawing
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r * 0.15, LIFT + T + 0.01, 24), dark); shaft.position.y = (LIFT + T + 0.01) / 2; shaft.castShadow = true;
    g.userData.which = mat === brass ? 'driver' : 'driven';
    body.userData.which = dot.userData.which = g.userData.which;
    return { g, shaft, geos: [geo, dot.geometry, shaft.geometry] };
  }
  function rebuild(s) {
    if (parts) { pair.clear(); for (const x of parts.geos) x.dispose(); }
    const gm = G.geometry(s), off = gm.centerDistance / 2;
    const a = gearGroup(s.driverTeeth, gm.driverPitchRadius, brass), b = gearGroup(s.drivenTeeth, gm.drivenPitchRadius, steel);
    a.g.position.x = a.shaft.position.x = -off; b.g.position.x = b.shaft.position.x = off; // driver left, driven right, as on the card
    pair.add(a.g, b.g, a.shaft, b.shaft);
    parts = { driver: a.g, driven: b.g, geos: [...a.geos, ...b.geos] };
    const m = G.PITCH_DIAMETER_PER_TOOTH, w = gm.centerDistance + gm.driverPitchRadius + gm.drivenPitchRadius + 2 * m + 2 * MARGIN, dpt = 2 * (Math.max(gm.driverPitchRadius, gm.drivenPitchRadius) + m + MARGIN);
    plate.scale.set(w, 1, dpt);
    const first = !built;
    built = s.driverTeeth + ':' + s.drivenTeeth;
    if (!first) frame();
  }
  const frame = () => ctx.frame(plate, { view: [0, 1.15, 1], pad: 0.8, ground: 'none', minZoom: 0.5, maxZoom: 2.5, light: [-0.5, 1.4, 0.6] });
  function apply() {
    const d = ctx.handle.data, s = stateOf(d);
    let rebuilt = false;
    if (s.driverTeeth + ':' + s.drivenTeeth !== built) { rebuild(s); rebuilt = true; }
    const p = G.pose(s, nowOf(d));
    parts.driver.rotation.y = rad(p.driverAngleDegrees); parts.driven.rotation.y = rad(p.drivenAngleDegrees);
    return rebuilt;
  }
  apply();

  // drag a gear to turn it: the pointer's angle around that gear's centre, on the plane of the gear tops
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(LIFT + T)), ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const angleAt = (e, g) => {
    const r = ctx.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const c = g.getWorldPosition(new THREE.Vector3());
    return Math.atan2(-(hit.z - c.z), hit.x - c.x) * 180 / Math.PI;
  };
  let dragging = null;
  const host = ctx.canvas.parentElement || ctx.canvas;
  const down = (e) => {
    if (e.button > 0) return;
    const hits = ctx.pick(e.clientX, e.clientY, [parts.driver, parts.driven]) || [];
    const h = hits.find((x) => x.object && x.object.userData.which);
    if (!h) return; // not on a gear: the space around orbits as usual
    const which = h.object.userData.which, g = which === 'driver' ? parts.driver : parts.driven, a = angleAt(e, g);
    if (a == null) return;
    e.stopPropagation(); e.preventDefault();
    if (ctx.controls) ctx.controls.enabled = false;
    dragging = { which, last: a, g };
    ctx.canvas.style.cursor = 'grabbing';
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const move = (e) => {
    if (!dragging) return;
    const a = angleAt(e, dragging.g); if (a == null) return;
    let delta = a - dragging.last; if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
    dragging.last = a;
    if (delta) ctx.handle.data.onDrag && ctx.handle.data.onDrag(dragging.which, delta, false);
  };
  const up = () => {
    if (!dragging) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    ctx.handle.data.onDrag && ctx.handle.data.onDrag(dragging.which, 0, true);
    dragging = null; ctx.canvas.style.cursor = 'grab';
    if (ctx.controls) ctx.controls.enabled = true;
  };
  host.addEventListener('pointerdown', down, { capture: true });

  ctx.addContactShadow({ y: -0.0125, size: 0.6, opacity: 0.6, blur: 3, darkness: 0.85, exclude: [pair] });
  frame();

  let lastKey = '';
  return {
    update() { ctx.requestRender(); },
    // every frame: pose from the authoritative state; draw only when something moved (playing, dragging, or a change)
    tick() {
      const s = stateOf(ctx.handle.data), key = s.revision + ':' + s.driverTeeth + ':' + s.drivenTeeth + ':' + s.base;
      if (!s.playing && !dragging && key === lastKey) return false;
      lastKey = key;
      return apply() ? true : 'view'; // a rebuilt pair needs its shadows redrawn; a turn only needs the view
    },
    state() { const s = stateOf(ctx.handle.data); return { built, dragging: !!dragging, playing: !!s.playing, driver: parts.driver.rotation.y, driven: parts.driven.rotation.y }; },
    dispose() { host.removeEventListener('pointerdown', down, { capture: true }); up(); for (const x of parts.geos) x.dispose(); plate.geometry.dispose(); for (const m of [brass, steel, dark, marker, wood]) m.dispose(); },
  };
}
