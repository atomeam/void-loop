/**
 * moon miniature — explainer.moon-phases standing in the void: Earth in the middle, the Moon on a dashed orbit, and
 * sunlight from one side (+x, arrows show where it comes from). Both bodies are lit by the Sun alone: a small shader
 * lights the half that faces +x and leaves the other half dark, so the room light that makes other miniatures look good
 * never brightens the night side and the lit half is exactly the one the rules say (moon-phases-rules.js). Every frame
 * poses the Moon from the card's one state (data.state(), data.now()); drag the Moon to move it (data.onDrag(degrees,
 * end)); drag the space around it to look around.
 * data: { state: moon state, or () => moon state; now?: () => seconds; onDrag?(orbitAngleDegrees, end) }
 */
import * as M from '../moon-phases-rules.js';

const R = 0.42, EARTH = 0.12, MOON = 0.062;
const VERT = 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// lit by the Sun alone: a soft terminator, a faint night side so the shape still reads, a little procedural mottling
const FRAG = 'uniform vec3 uSun; uniform vec3 uDay; uniform vec3 uDay2; uniform vec3 uNight; uniform float uScale; varying vec3 vN; varying vec3 vP;'
  + 'float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }'
  + 'float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);'
  + ' return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }'
  + 'void main(){ vec3 p = normalize(vP) * uScale; float m = n3(p) * 0.6 + n3(p * 2.3) * 0.4;'
  + ' vec3 day = mix(uDay, uDay2, smoothstep(0.42, 0.62, m)); float d = dot(normalize(vN), uSun);'
  + ' float k = smoothstep(-0.04, 0.10, d) * (0.55 + 0.45 * max(d, 0.0));'
  + ' gl_FragColor = vec4(mix(uNight, day, k), 1.0); }';

export default async function build(ctx, data) {
  const { THREE, root } = ctx;
  const stateOf = (d) => (typeof d.state === 'function' ? d.state() : d.state);
  const nowOf = (d) => (typeof d.now === 'function' ? d.now() : Date.now() / 1000);
  const sun = new THREE.Vector3(...M.SUN_DIRECTION).normalize();
  const lit = (day, day2, night, scale) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, toneMapped: false,
    uniforms: { uSun: { value: sun }, uDay: { value: new THREE.Color(day) }, uDay2: { value: new THREE.Color(day2) }, uNight: { value: new THREE.Color(night) }, uScale: { value: scale } } });
  const mats = [], geos = [];
  const keep = (m, g) => { mats.push(m); geos.push(g); return new THREE.Mesh(g, m); };
  const earth = keep(lit('#2f6fc4', '#3f8f4a', '#04070d', 3.2), new THREE.SphereGeometry(EARTH, 48, 32)); root.add(earth);
  const moon = keep(lit('#d9d5c8', '#8e8a80', '#08080a', 4.5), new THREE.SphereGeometry(MOON, 40, 28)); moon.userData.moon = true; root.add(moon);
  // a bigger invisible ball round the Moon, so a finger can find it
  const grip = keep(new THREE.MeshBasicMaterial({ visible: false }), new THREE.SphereGeometry(MOON * 2.2, 12, 8)); grip.userData.moon = true; moon.add(grip);
  const ringPts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * R, 0, -Math.sin(a) * R)); }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts), ringMat = new THREE.LineDashedMaterial({ color: 0x8a8a96, dashSize: 0.012, gapSize: 0.012, transparent: true, opacity: 0.6 });
  const ring = new THREE.Line(ringGeo, ringMat); ring.computeLineDistances(); root.add(ring); geos.push(ringGeo); mats.push(ringMat);
  // the line of sight from Earth to the Moon: what we see is the Moon's face along this line
  const sightGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), sightMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  const sight = new THREE.Line(sightGeo, sightMat); root.add(sight); geos.push(sightGeo); mats.push(sightMat);
  // sunlight arrows on the +x side, pointing the way the light travels
  const rays = new THREE.Group(); root.add(rays);
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xffcf5a, toneMapped: false }); mats.push(rayMat);
  const shaft = new THREE.CylinderGeometry(0.003, 0.003, 0.16, 8).rotateZ(Math.PI / 2), head = new THREE.ConeGeometry(0.011, 0.03, 12).rotateZ(Math.PI / 2); geos.push(shaft, head);
  for (const z of [-0.3, -0.1, 0.1, 0.3]) for (const y of [0, 0.08]) {
    const s = new THREE.Mesh(shaft, rayMat); s.position.set(R + 0.2, y, z); rays.add(s);
    const hd = new THREE.Mesh(head, rayMat); hd.position.set(R + 0.105, y, z); rays.add(hd);
  }

  function apply() {
    const d = ctx.handle.data, s = stateOf(d), [x, y, z] = M.moonPosition(s, nowOf(d));
    moon.position.set(x * R, y * R, z * R);
    sight.geometry.attributes.position.setXYZ(1, x * (R - MOON * 1.4), 0, z * (R - MOON * 1.4)); sight.geometry.attributes.position.needsUpdate = true;
    rays.visible = s.showSunlight !== false;
  }
  apply();
  ctx.frame(root, { view: [0.35, 1.3, 1], pad: 0.95, ground: 'none', minZoom: 0.45, maxZoom: 2.5 });

  // drag the Moon: the pointer's angle round Earth on the orbit's plane is the orbital position
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const angleAt = (e) => {
    const r = ctx.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    return ray.ray.intersectPlane(plane, hit) ? Math.atan2(-hit.z, hit.x) * 180 / Math.PI : null;
  };
  let dragging = false;
  const host = ctx.canvas.parentElement || ctx.canvas;
  const send = (deg, end) => { const d = ctx.handle.data; if (d.onDrag && deg != null) d.onDrag(deg < 0 ? deg + 360 : deg, end); };
  const down = (e) => {
    if (e.button > 0) return;
    const hits = ctx.pick(e.clientX, e.clientY, [moon]) || [];
    if (!hits.some((x) => x.object && x.object.userData.moon)) return;
    e.stopPropagation(); e.preventDefault();
    if (ctx.controls) ctx.controls.enabled = false;
    dragging = true; ctx.canvas.style.cursor = 'grabbing';
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const move = (e) => { if (dragging) send(angleAt(e), false); };
  const up = (e) => {
    if (!dragging) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    dragging = false; ctx.canvas.style.cursor = 'grab';
    if (ctx.controls) ctx.controls.enabled = true;
    const a = e && e.clientX !== undefined ? angleAt(e) : null; send(a ?? M.orbitAngle(stateOf(ctx.handle.data), nowOf(ctx.handle.data)), true);
  };
  host.addEventListener('pointerdown', down, { capture: true });

  let lastKey = '';
  return {
    update() { ctx.requestRender(); },
    // every frame: pose from the authoritative state; draw only when something moved
    tick() {
      const s = stateOf(ctx.handle.data), key = s.revision + ':' + s.base + ':' + (s.showSunlight !== false);
      if (!s.playing && !dragging && key === lastKey) return false;
      lastKey = key; apply(); return 'view';
    },
    state() { const s = stateOf(ctx.handle.data); return { dragging, playing: !!s.playing, moon: moon.position.toArray(), angle: M.orbitAngle(s, nowOf(ctx.handle.data)), sunlight: rays.visible }; },
    dispose() { host.removeEventListener('pointerdown', down, { capture: true }); up(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
