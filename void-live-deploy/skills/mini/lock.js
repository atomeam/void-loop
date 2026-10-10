/**
 * lock miniature — explainer.pin-lock standing in the void: a brass housing cut away on the visitor's side, a brass plug
 * that turns about its own axis, five steel driver pins and brass key pins in their bores, springs above them, the key
 * and a green shear line between plug and housing. Realistic materials (brass, steel, nickel key), invented
 * dimensionless profile. Every frame poses every part from the card's one state through lock-rules.js pose(): the plug
 * carries the key and the key pins, the driver pins stay in the housing, each spring only follows its driver pin.
 * Drag the key to slide it in or out (data.onInsert(fraction, end)); drag the space around it to look around.
 * data: { state: lock state, or () => lock state; onInsert?(fraction, end) }
 */
import * as L from '../lock-rules.js';

const U = 0.012;                               // metres per pin unit
const C = (L.SHEAR / 2) * U;                   // the plug's axis height: the plug spans 0..SHEAR, so the shear line is its top
const PX = (i) => (i - 2) * 0.03;              // pin pair i along the key's axis
const PIN_R = 0.0042;

export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const stateOf = (d) => (typeof d.state === 'function' ? d.state() : d.state);
  const mats = [], geos = [];
  const mat = (o) => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; };
  const geo = (g) => { geos.push(g); return g; };
  const brass = mat({ color: 0xb8913f, metalness: 0.85, roughness: 0.38 });
  const housingMat = mat({ color: 0xa8832f, metalness: 0.8, roughness: 0.45, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const plugMat = mat({ color: 0xc9a24a, metalness: 0.85, roughness: 0.32 });
  const steel = mat({ color: 0xc4c9cf, metalness: 0.9, roughness: 0.28 });
  const springMat = mat({ color: 0x8e949b, metalness: 0.9, roughness: 0.4 });
  const nickel = mat({ color: 0xd9dde2, metalness: 0.95, roughness: 0.22 });
  const shearMat = new THREE.MeshBasicMaterial({ color: 0x5dffa5, transparent: true, opacity: 0.55, toneMapped: false }); mats.push(shearMat);
  const blockMat = mat({ color: 0xd8462f, metalness: 0.6, roughness: 0.4, emissive: 0x5a1208 });

  const len = 0.17, top = (L.SPRING_TOP + 1) * U;
  // housing: the block above the plug, and a shell round it; the visitor's side fades with the cutaway amount
  const housing = new THREE.Mesh(geo(new THREE.BoxGeometry(len, top - L.SHEAR * U, 0.034)), housingMat);
  housing.position.set(0, (top + L.SHEAR * U) / 2, 0); root.add(housing);
  const shell = new THREE.Mesh(geo(new THREE.CylinderGeometry(C * 1.28, C * 1.28, len, 40, 1, true).rotateZ(Math.PI / 2)), housingMat);
  shell.position.set(0, C, 0); root.add(shell);
  const base = new THREE.Mesh(geo(new THREE.BoxGeometry(len * 1.1, 0.008, 0.06)), mat({ color: 0x3b2f22, roughness: 0.9 }));
  base.position.set(0, -C * 0.4 - 0.004, 0); root.add(base);
  // the plug turns about its axis (x); its children turn with it
  const plug = new THREE.Group(); plug.position.set(0, C, 0); root.add(plug);
  plug.add(new THREE.Mesh(geo(new THREE.CylinderGeometry(C * 0.98, C * 0.98, len, 40).rotateZ(Math.PI / 2)), plugMat));
  const shear = new THREE.Mesh(geo(new THREE.BoxGeometry(len, 0.0008, 0.036)), shearMat); shear.position.set(0, L.SHEAR * U, 0.0005); root.add(shear);

  // pins: key pins in the plug (turn with it), driver pins and springs in the housing
  const keyPins = [], drivers = [], springs = [];
  const springGeo = (() => { const pts = []; for (let k = 0; k <= 120; k++) { const a = k / 120 * Math.PI * 2 * 7; pts.push(new THREE.Vector3(Math.cos(a) * PIN_R * 0.85, k / 120, Math.sin(a) * PIN_R * 0.85)); } return geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0006, 6)); })();
  for (let i = 0; i < L.PINS; i++) {
    const kp = new THREE.Mesh(geo(new THREE.CylinderGeometry(PIN_R, PIN_R, L.KEY_PIN[i] * U - 0.0006, 20)), brass); plug.add(kp); keyPins.push(kp);
    const dp = new THREE.Mesh(geo(new THREE.CylinderGeometry(PIN_R, PIN_R, L.DRIVER * U - 0.0006, 20)), steel); root.add(dp); drivers.push(dp);
    const sp = new THREE.Mesh(springGeo, springMat); root.add(sp); springs.push(sp);
  }
  // the key: a nickel blade cut to the preset's profile, rebuilt only when the preset changes
  const keyGroup = new THREE.Group(); plug.add(keyGroup);
  let keyMesh = null, keyFor = '';
  function buildKey(cuts) {
    if (keyMesh) { keyGroup.remove(keyMesh); keyMesh.geometry.dispose(); }
    const sh = new THREE.Shape(), dx = 0.03, x0 = -dx * 2.5, y0 = -C;
    sh.moveTo(x0 - 0.05, y0 - 0.6 * U); sh.lineTo(x0 + dx * 5 + 0.004, y0 - 0.6 * U); sh.lineTo(x0 + dx * 5 + 0.004, y0);
    for (let j = L.PINS - 1; j >= 0; j--) { sh.lineTo(x0 + dx * (j + 1) - 0.006, y0 + cuts[j] * U); sh.lineTo(x0 + dx * j + 0.004, y0 + cuts[j] * U); }
    sh.lineTo(x0 - 0.05, y0 + 1.5 * U); sh.lineTo(x0 - 0.05, y0 - 0.6 * U);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }); g.translate(0, 0, -0.002);
    keyMesh = new THREE.Mesh(g, nickel); keyMesh.userData.key = true; keyGroup.add(keyMesh);
    const bow = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 32).rotateX(Math.PI / 2)), nickel); bow.position.set(x0 - 0.068, y0 + 0.4 * U, 0); bow.userData.key = true; keyMesh.add(bow);
  }

  function apply() {
    const s = stateOf(ctx.handle.data), p = L.pose(s), bad = s.lastAttempt && s.lastAttempt.reason === 'misaligned' ? s.lastAttempt.pin : -1;
    const k = p.key.cuts.join(','); if (k !== keyFor) { keyFor = k; buildKey(p.key.cuts); }
    plug.rotation.x = -p.plug.angle * Math.PI / 180;
    keyGroup.position.x = (p.key.insertion - 1) * 0.15;
    housingMat.opacity = 1 - 0.82 * p.cutaway;
    shear.visible = s.showShearLine !== false;
    for (const pr of p.pairs) {
      const kp = keyPins[pr.i], dp = drivers[pr.i], sp = springs[pr.i];
      kp.position.set(PX(pr.i), (pr.keyPin.bottom + pr.keyPin.length / 2) * U - C, 0); // in the plug's frame
      dp.position.set(PX(pr.i), (pr.driverPin.bottom + pr.driverPin.length / 2) * U, 0);
      sp.position.set(PX(pr.i), pr.spring.bottom * U, 0); sp.scale.set(1, Math.max(0.001, pr.spring.length * U), 1);
      dp.material = pr.i === bad ? blockMat : steel; kp.material = pr.i === bad ? blockMat : brass;
    }
  }
  apply();
  ctx.frame(root, { view: [0.15, 0.55, 1], pad: 0.9, minZoom: 0.5, maxZoom: 3 });

  // drag the key along its axis: how far along the lock the pointer is, is how far in the key is
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  const fractionAt = (e) => {
    const r = ctx.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    return ray.ray.intersectPlane(plane, hit) ? Math.max(0, Math.min(1, (hit.x - grabX) / 0.15 + grabF)) : null;
  };
  let dragging = false, grabX = 0, grabF = 0;
  const host = ctx.canvas.parentElement || ctx.canvas;
  const send = (f, end) => { const d = ctx.handle.data; if (d.onInsert && f != null) d.onInsert(Math.round(f * 20) / 20, end); };
  const down = (e) => {
    if (e.button > 0 || !keyMesh) return;
    const hits = ctx.pick(e.clientX, e.clientY, [keyMesh]) || [];
    if (!hits.some((x) => x.object && x.object.userData.key)) return;
    e.stopPropagation(); e.preventDefault();
    const r = ctx.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera); grabX = ray.ray.intersectPlane(plane, hit) ? hit.x : 0; grabF = stateOf(ctx.handle.data).insertion;
    if (ctx.controls) ctx.controls.enabled = false;
    dragging = true; ctx.canvas.style.cursor = 'grabbing';
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const move = (e) => { if (dragging) send(fractionAt(e), false); };
  const up = (e) => {
    if (!dragging) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    dragging = false; ctx.canvas.style.cursor = 'grab';
    if (ctx.controls) ctx.controls.enabled = true;
    send(e && e.clientX !== undefined ? fractionAt(e) : stateOf(ctx.handle.data).insertion, true);
  };
  host.addEventListener('pointerdown', down, { capture: true });

  let lastKey = '';
  return {
    update() { ctx.requestRender(); },
    // every frame: pose from the authoritative state; draw only when something changed
    tick() {
      const s = stateOf(ctx.handle.data), key = s.revision + ':' + s.cutawayAmount + ':' + (s.showShearLine !== false);
      if (!dragging && key === lastKey) return false;
      lastKey = key; apply(); return 'view';
    },
    state() {
      const s = stateOf(ctx.handle.data);
      return { dragging, insertion: s.insertion, angle: Math.round(-plug.rotation.x * 180 / Math.PI), state: L.mechanismState(s), aligned: L.alignedPinCount(s),
        driverY: drivers.map((d) => Math.round(d.position.y / U * 100) / 100), keyPinY: keyPins.map((k) => Math.round((k.position.y + C) / U * 100) / 100), cutaway: housingMat.opacity };
    },
    dispose() { host.removeEventListener('pointerdown', down, { capture: true }); up(); if (keyMesh) keyMesh.geometry.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
