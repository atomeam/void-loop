/**
 * scene3d — Void's shared realistic 3D: one WebGL renderer for every miniature on the page, and the mount API cards use
 * to show a small, detailed 3D version of themselves. Not a skill: nothing imports this file until a card asks for a
 * miniature, so the empty page loads zero 3D bytes. API and how-to for builders: docs/miniatures.md.
 *
 *   registerMiniature(kind, build)                 build(ctx, data) -> { update?(data), tick?(dt, t) -> bool, dispose?() } (may be async)
 *   mountMiniature(host, kind, data, opts) -> Promise<handle>   a canvas inside host (or beside it) showing that kind
 *       opts: { key, place: 'inside'|'beside', width, height, orbit, zoom, ground: 'shadow'|'none', view: [x,y,z], fov, pad,
 *               minPolar, maxPolar, exposure, label }
 *       handle: { key, kind, canvas, ctx, update(data), requestRender(), pick(x, y, objects?), onTap(fn), dispose() }
 *   unmountMiniature(key), liveMiniatures(), loadThree(), engine(), webglOk()
 * A kind that is not registered yet is loaded from /skills/mini/<kind>.js (its default export is the build function).
 *
 * How it draws: one hidden WebGL canvas renders each visible miniature in turn (its own scene, camera and lights; one shared
 * room-light environment map) and copies the frame into that card's own 2D canvas. Cards keep their DOM order, tilt and
 * drag, a covered card stays covered, and the page never runs out of WebGL contexts however many cards have miniatures.
 * Light: ACES filmic tone mapping, sRGB output, a PMREM RoomEnvironment for reflections, a warm key light casting soft
 * PCF shadows, a cool sky fill, and blurred contact shadows under the model. Models: GLTFLoader with meshopt and KTX2.
 * three.js r180 is vendored under /vendor/three-r180 (add-ons import it by relative path, so they resolve without an importmap).
 */
const V = '/vendor/three-r180/';
export const THREE_URL = V + 'build/three.module.min.js';
export const MOTION_KEY = 'a2m.void.motion.v1';
const KIND_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

let libP = null;
/** three.js and the add-ons the scene uses, loaded once. */
export function loadThree() {
  if (!libP) libP = Promise.all([
    import(THREE_URL), import(V + 'addons/GLTFLoader.js'), import(V + 'addons/OrbitControls.js'), import(V + 'addons/RoomEnvironment.js'),
    import(V + 'addons/meshopt_decoder.module.js'), import(V + 'addons/KTX2Loader.js'), import(V + 'addons/HorizontalBlurShader.js'), import(V + 'addons/VerticalBlurShader.js'),
  ]).then(([THREE, g, o, r, m, k, hb, vb]) => ({ THREE, GLTFLoader: g.GLTFLoader, OrbitControls: o.OrbitControls, RoomEnvironment: r.RoomEnvironment,
    MeshoptDecoder: m.MeshoptDecoder, KTX2Loader: k.KTX2Loader, HorizontalBlurShader: hb.HorizontalBlurShader, VerticalBlurShader: vb.VerticalBlurShader }))
    .catch((e) => { libP = null; throw e; });
  return libP;
}
const mq = (q) => { try { return matchMedia(q).matches; } catch (_) { return false; } };
export const isPhone = () => mq('(pointer: coarse)') && Math.min(screen.width || 9999, screen.height || 9999) < 760;
export function motionStill() { let mine = false; try { mine = localStorage.getItem(MOTION_KEY) === 'still'; } catch (_) {} return mq('(prefers-reduced-motion: reduce)') || mine; }
/** Can this browser draw WebGL at all? (cheap; no three.js needed) */
export function webglOk() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } }

let engineP = null;
/** The one renderer: created on first use, throws (rejects) where WebGL is unavailable so callers can show their 2D version. */
export function engine() {
  if (!engineP) engineP = (async () => {
    const lib = await loadThree(); const { THREE } = lib;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: isPhone() ? 'default' : 'high-performance' });
    renderer.setPixelRatio(1); // each miniature picks its own pixel ratio; the shared canvas is sized in device pixels
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new lib.RoomEnvironment();
    const env = pmrem.fromScene(room, 0.035).texture;
    room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); pmrem.dispose();
    const gltf = new lib.GLTFLoader(); gltf.setMeshoptDecoder(lib.MeshoptDecoder);
    const ktx2 = new lib.KTX2Loader().setTranscoderPath(V + 'addons/libs/basis/').detectSupport(renderer); gltf.setKTX2Loader(ktx2);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
    return { lib, THREE, renderer, canvas, env, gltf, ktx2, w: 0, h: 0, models: new Map(), textures: new Map(), maxAniso: renderer.capabilities.getMaxAnisotropy() };
  })().catch((e) => { engineP = null; throw e; });
  return engineP;
}
/** A glTF/GLB, loaded once per URL; every caller gets its own clone of the scene graph (geometry and materials shared). */
export async function loadGLTF(url) {
  const E = await engine();
  if (!E.models.has(url)) E.models.set(url, new Promise((res, rej) => E.gltf.load(url, res, undefined, rej)).catch((e) => { E.models.delete(url); throw e; }));
  const g = await E.models.get(url);
  return { scene: g.scene.clone(true), gltf: g };
}
/** An image texture, loaded once per URL. srgb for colour maps; repeat [u, v] wraps it. */
export async function loadTexture(url, { srgb = false, repeat = null } = {}) {
  const E = await engine(), { THREE } = E, k = url + (srgb ? '#srgb' : '');
  if (!E.textures.has(k)) E.textures.set(k, new THREE.TextureLoader().loadAsync(url).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(8, E.maxAniso); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })
    .catch((e) => { E.textures.delete(k); throw e; }));
  const t = (await E.textures.get(k)).clone(); t.needsUpdate = true; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t;
}

// ---------- contact shadows (three.js webgl_shadow_contact, made reusable) ----------
function contactShadows(E, size, { res = 512, opacity = 0.62, blur = 3, darkness = 0.85, height = 0.25, exclude = [] } = {}) {
  const { THREE, lib } = E;
  const group = new THREE.Group(); group.name = 'contact-shadows';
  const rt = new THREE.WebGLRenderTarget(res, res), rtB = new THREE.WebGLRenderTarget(res, res);
  rt.texture.generateMipmaps = rtB.texture.generateMipmaps = false;
  const geo = new THREE.PlaneGeometry(size, size).rotateX(Math.PI / 2);
  const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rt.texture, opacity, transparent: true, depthWrite: false, toneMapped: false }));
  plane.renderOrder = 1; plane.scale.y = -1; plane.position.y = 0.0004; group.add(plane);
  const blurPlane = new THREE.Mesh(geo); blurPlane.visible = false; group.add(blurPlane);
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, height); cam.rotation.x = Math.PI / 2; group.add(cam);
  const depth = new THREE.MeshDepthMaterial(); depth.userData.darkness = { value: darkness };
  depth.onBeforeCompile = (s) => { s.uniforms.darkness = depth.userData.darkness;
    s.fragmentShader = 'uniform float darkness;\n' + s.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'); };
  depth.depthTest = depth.depthWrite = false;
  const hB = new THREE.ShaderMaterial(lib.HorizontalBlurShader), vB = new THREE.ShaderMaterial(lib.VerticalBlurShader); hB.depthTest = vB.depthTest = false;
  const blurPass = (r, amount) => {
    blurPlane.visible = true;
    blurPlane.material = hB; hB.uniforms.tDiffuse.value = rt.texture; hB.uniforms.h.value = amount / 256; r.setRenderTarget(rtB); r.render(blurPlane, cam);
    blurPlane.material = vB; vB.uniforms.tDiffuse.value = rtB.texture; vB.uniforms.v.value = amount / 256; r.setRenderTarget(rt); r.render(blurPlane, cam);
    blurPlane.visible = false;
  };
  return {
    group, plane, dirty: true,
    render(r, scene) {
      const bg = scene.background, cc = r.getClearAlpha(); scene.background = null; plane.visible = false;
      const hidden = []; scene.traverse((o) => { if ((o.userData.noContactShadow || exclude.includes(o)) && o.visible) { o.visible = false; hidden.push(o); } });
      scene.overrideMaterial = depth; r.setClearAlpha(0); r.setRenderTarget(rt); r.clear(); r.render(scene, cam); scene.overrideMaterial = null;
      blurPass(r, blur); blurPass(r, blur * 0.4);
      r.setRenderTarget(null); r.setClearAlpha(cc); scene.background = bg; plane.visible = true; for (const o of hidden) o.visible = true;
    },
    dispose() { rt.dispose(); rtB.dispose(); geo.dispose(); plane.material.dispose(); depth.dispose(); hB.dispose(); vB.dispose(); },
  };
}

// ---------- registry and live miniatures ----------
const builders = new Map();
const live = new Map(); // key -> handle
/** Teach Void a miniature: build(ctx, data) sets up ctx.root and returns { update(data), tick(dt, t), dispose() }. */
export function registerMiniature(kind, build) {
  if (!KIND_RE.test(String(kind))) throw new Error('miniature kind must be lowercase letters, digits and dashes: ' + kind);
  if (typeof build !== 'function') throw new Error('registerMiniature(' + kind + '): build must be a function');
  builders.set(kind, build);
}
export const hasMiniature = (kind) => builders.has(kind);
async function builderFor(kind) {
  if (!KIND_RE.test(String(kind))) throw new Error('bad miniature kind: ' + kind);
  if (!builders.has(kind)) { const m = await import('/skills/mini/' + kind + '.js'); if (!builders.has(kind) && typeof m.default === 'function') builders.set(kind, m.default); }
  if (!builders.has(kind)) throw new Error('no miniature for ' + kind);
  return builders.get(kind);
}
export function liveMiniatures() { return [...live.values()].map((h) => ({ key: h.key, kind: h.kind, w: h.cssW, h: h.cssH, draws: h.draws, ms: h.ms, visible: h.visible, ready: h.ready })); }
export function unmountMiniature(key) { const h = live.get(key); if (h) h.dispose(); return !!h; }

let raf = 0, last = 0;
function wake() { if (!raf && live.size) raf = requestAnimationFrame(loop); }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake);
function loop(t) {
  raf = 0; const dt = Math.min(0.1, last ? (t - last) / 1000 : 0.016); last = t;
  let again = false;
  for (const h of [...live.values()]) {
    if (!h.wrap.isConnected) { // the card re-rendered (it comes straight back) or was thrown away (it doesn't)
      if (++h.gone > 90) h.dispose(); else again = true;
      continue;
    }
    h.gone = 0;
    if (!h.ready || !h.visible || document.hidden) continue;
    let dirty = h.dirty;
    if (h.controls && h.controls.update(dt)) dirty = true;
    if (h.anim.length) { for (const a of h.anim.splice(0)) a(); dirty = true; for (const c of h.contacts) c.dirty = true; }
    if (h.inst && h.inst.tick) { try { const r = h.inst.tick(dt, t / 1000); if (r !== false) { dirty = true; if (r !== 'view') for (const c of h.contacts) c.dirty = true; } /* 'view': redraw, shadows unchanged */ } catch (e) { console.warn('[miniature ' + h.kind + '] tick', e); h.inst.tick = null; } again = true; }
    if (h.moving) again = true;
    if (dirty) draw(h);
    if (h.dirty) again = true;
  }
  if (again) raf = requestAnimationFrame(loop); else last = 0;
}
function draw(h) {
  const E = h.E, r = E.renderer, pw = h.canvas.width, ph = h.canvas.height;
  if (!pw || !ph) return;
  h.dirty = false; const t0 = performance.now();
  if (E.w < pw || E.h < ph) { E.w = Math.max(E.w, pw); E.h = Math.max(E.h, ph); r.setSize(E.w, E.h, false); }
  r.toneMappingExposure = h.exposure;
  for (const c of h.contacts) if (c.dirty) { c.render(r, h.scene); c.dirty = false; }
  r.setRenderTarget(null); r.setViewport(0, 0, pw, ph); r.setScissor(0, 0, pw, ph); r.setScissorTest(true);
  r.setClearColor(0x000000, 0); r.clear();
  r.render(h.scene, h.camera);
  r.setScissorTest(false);
  h.g2d.clearRect(0, 0, pw, ph);
  h.g2d.drawImage(E.canvas, 0, E.h - ph, pw, ph, 0, 0, pw, ph);
  h.draws += 1; h.ms = Math.round(performance.now() - t0);
}

/**
 * Show a miniature of `kind` in host. Re-mounting the same key (a card that re-rendered) moves the live miniature into the
 * new host and hands it the new data, so nothing is rebuilt. Rejects where WebGL is unavailable.
 */
export async function mountMiniature(host, kind, data = {}, opts = {}) {
  const key = String(opts.key || kind + ':' + Math.random().toString(36).slice(2, 9));
  const old = live.get(key);
  if (old) { old.attach(host); if (data !== undefined && data !== old.data) old.update(data); return old; }
  const E = await engine(); const { THREE, lib } = E;
  const build = await builderFor(kind);
  const wrap = document.createElement('div');
  wrap.className = 'void-mini'; wrap.dataset.kind = kind; wrap.dataset.key = key;
  const place = opts.place || 'inside';
  wrap.style.cssText = place === 'beside'
    ? 'position:absolute;left:calc(100% + 14px);top:0;width:' + (opts.width || 220) + 'px;height:' + (opts.height || 220) + 'px;pointer-events:auto'
    : 'position:relative;width:' + (opts.width ? opts.width + 'px' : '100%') + ';height:' + (opts.height ? opts.height + 'px' : '100%');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', opts.label || ('3D ' + kind));
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none';
  wrap.appendChild(canvas);
  for (const ev of ['pointerdown', 'mousedown', 'touchstart']) canvas.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // orbit, not a card drag
  const scene = new THREE.Scene(); scene.environment = E.env; scene.environmentIntensity = opts.envIntensity ?? 0.85;
  const camera = new THREE.PerspectiveCamera(opts.fov || 32, 1, 0.01, 100);
  const keyLight = new THREE.DirectionalLight(0xfff0dc, opts.keyIntensity ?? 2.4); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(isPhone() ? 1024 : 2048, isPhone() ? 1024 : 2048); keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.015; keyLight.shadow.radius = 5;
  const sky = new THREE.HemisphereLight(0xdce6ff, 0x3a2c22, opts.skyIntensity ?? 0.45);
  const root = new THREE.Group(); root.name = 'miniature-root';
  scene.add(keyLight, keyLight.target, sky, root);
  let controls = null;
  if (opts.orbit !== false) {
    controls = new lib.OrbitControls(camera, canvas);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.55, zoomSpeed: 0.7, enableZoom: opts.zoom !== false });
    controls.minPolarAngle = opts.minPolar ?? 0.12; controls.maxPolarAngle = opts.maxPolar ?? 1.38;
  }
  const h = {
    key, kind, E, wrap, canvas, scene, camera, controls, root, keyLight, sky, data, draws: 0, gone: 0, dirty: true, visible: true, ready: false,
    anim: [], moving: false, exposure: opts.exposure ?? 1.0, contact: null, contacts: [], cssW: 0, cssH: 0, inst: null, taps: [],
    attach(host2) { if (host2 && wrap.parentNode !== host2) host2.appendChild(wrap); h.dirty = true; wake(); },
    update(d) { h.data = d; if (h.inst && h.inst.update) { try { h.inst.update(d); } catch (e) { console.warn('[miniature ' + kind + '] update', e); } } h.requestRender(); },
    requestRender(opts2 = {}) { h.dirty = true; if (opts2.shadows !== false) for (const c of h.contacts) c.dirty = true; wake(); },
    /** Another blurred contact shadow, e.g. pieces on a board: { y, size, exclude: [objects that must not cast it], opacity, blur, darkness, height }. */
    addContactShadow(o = {}) { const c = contactShadows(E, o.size || 1, o); c.group.position.y = o.y || 0; if (o.x || o.z) c.group.position.set(o.x || 0, o.y || 0, o.z || 0); scene.add(c.group); h.contacts.push(c); h.requestRender(); return c; },
    /** Rays from a client point into the scene: hits sorted near to far (objects default to everything under root). */
    pick(clientX, clientY, objects) {
      const r = canvas.getBoundingClientRect(); const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(v, camera); return ray.intersectObjects(objects || [root], true);
    },
    /** fn(hits, event) on a tap or click that did not orbit (moved under 6 px). */
    onTap(fn) { h.taps.push(fn); },
    /** Fit the camera to an object: target its centre, distance from its bounding sphere, key light and shadow box around it. */
    frame(obj = root, o = {}) {
      const box = new THREE.Box3().setFromObject(obj), sph = box.getBoundingSphere(new THREE.Sphere()), c = sph.center, rad = Math.max(sph.radius, 1e-3);
      const dir = new THREE.Vector3(...(o.view || opts.view || [0, 0.75, 1])).normalize();
      const fit = (o.pad || opts.pad || 1.15) * rad / Math.sin((camera.fov * Math.PI / 180) / 2);
      const dist = Math.max(fit, fit / Math.max(0.6, camera.aspect) * (camera.aspect < 1 ? 1 : 0.85));
      camera.near = rad / 50; camera.far = dist + rad * 10; camera.position.copy(c).addScaledVector(dir, dist); camera.updateProjectionMatrix();
      if (controls) { controls.target.copy(c); controls.minDistance = dist * (o.minZoom || 0.45); controls.maxDistance = dist * (o.maxZoom || 1.8); controls.update(); }
      else camera.lookAt(c);
      const L = new THREE.Vector3(...(o.light || [0.55, 1.25, 0.65])).normalize();
      keyLight.position.copy(c).addScaledVector(L, rad * 4); keyLight.target.position.copy(c);
      const sc = keyLight.shadow.camera; sc.left = sc.bottom = -rad * 1.3; sc.right = sc.top = rad * 1.3; sc.near = rad * 1.5; sc.far = rad * 7; sc.updateProjectionMatrix();
      h.home = { pos: camera.position.clone(), target: c.clone(), rad, floor: box.min.y };
      if (o.ground !== undefined ? o.ground : (opts.ground ?? 'shadow')) h.setGround(box.min.y, rad, o.groundMode || opts.ground || 'shadow');
      h.requestRender(); return h.home;
    },
    /** Soft ground under the model: 'shadow' = contact shadow plus key-light shadow on an invisible floor; 'none' removes it. */
    setGround(y, rad, mode = 'shadow') {
      if (h.ground) { h.ground.dispose(); scene.remove(h.ground.group); h.ground = null; }
      if (h.contact) { h.contact.dispose(); scene.remove(h.contact.group); h.contacts = h.contacts.filter((c) => c !== h.contact); h.contact = null; }
      if (mode === 'none') return;
      const size = rad * 3.2;
      h.contact = contactShadows(E, size, { height: rad * 1.6 }); h.contact.group.position.y = y; scene.add(h.contact.group); h.contacts.push(h.contact);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.32 }));
      g.position.y = y + 0.0002; g.receiveShadow = true; g.userData.noContactShadow = true;
      h.ground = { group: g, dispose() { g.geometry.dispose(); g.material.dispose(); } }; scene.add(g);
    },
    dispose() {
      if (h.disposed) return; h.disposed = true; live.delete(key);
      try { h.inst && h.inst.dispose && h.inst.dispose(); } catch (_) {}
      if (controls) controls.dispose(); for (const c of h.contacts) c.dispose(); if (h.ground) h.ground.dispose(); if (h.ro) h.ro.disconnect(); if (h.io) h.io.disconnect();
      scene.traverse((o) => { if (o.isMesh && !o.userData.shared) { o.geometry && o.geometry.dispose(); } });
      wrap.remove();
    },
  };
  h.g2d = canvas.getContext('2d');
  // tap vs orbit
  let down = null;
  // event timestamps, not handler time: a slow frame between down and up must not turn a tap into a long press
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || e.timeStamp - down.t > 700) { down = null; return; }
    down = null; if (!h.taps.length) return; const hits = h.pick(e.clientX, e.clientY); for (const fn of h.taps) { try { fn(hits, e); } catch (err) { console.warn(err); } }
  });
  if (controls) { controls.addEventListener('start', () => { h.moving = true; canvas.style.cursor = 'grabbing'; wake(); }); controls.addEventListener('end', () => { h.moving = false; canvas.style.cursor = 'grab'; wake(); }); controls.addEventListener('change', () => { h.dirty = true; wake(); }); }
  const pr = () => Math.min(2, Math.max(window.devicePixelRatio || 1, isPhone() ? 1 : 1.5)); // a little supersampling on desktop: no jaggies
  const resize = () => {
    const w = Math.max(1, Math.round(wrap.clientWidth)), hh = Math.max(1, Math.round(wrap.clientHeight)); h.cssW = w; h.cssH = hh;
    const p = pr(); canvas.width = Math.round(w * p); canvas.height = Math.round(hh * p); camera.aspect = w / hh; camera.updateProjectionMatrix(); h.dirty = true; wake();
  };
  h.ro = new ResizeObserver(resize); h.ro.observe(wrap);
  h.io = new IntersectionObserver((es) => { for (const e of es) h.visible = e.isIntersecting; if (h.visible) { h.dirty = true; wake(); } }); h.io.observe(wrap);
  live.set(key, h);
  h.attach(host); resize();
  const ctx = { THREE, lib, scene, root, camera, controls, keyLight, sky, canvas, handle: h, still: motionStill(), phone: isPhone(),
    loadGLTF, loadTexture, frame: (o, x) => h.frame(o, x), addContactShadow: (o) => h.addContactShadow(o), requestRender: (x) => h.requestRender(x), onTap: (fn) => h.onTap(fn), pick: (x, y, o) => h.pick(x, y, o),
    animate: (fn) => { h.anim.push(fn); wake(); } };
  h.ctx = ctx;
  try { h.inst = (await build(ctx, data)) || {}; } catch (e) { h.dispose(); throw e; }
  if (h.disposed) return h;
  if (!h.home) h.frame(root);
  h.ready = true; h.dirty = true; wake();
  return h;
}

// tests and the console can see what is live
/** Where a point inside a miniature (its scene's coordinates) shows on screen, in client pixels: tests tap real squares with it. */
export function projectPoint(key, [x, y, z]) {
  const h = live.get(key); if (!h || !h.ready) return null;
  const v = new h.E.THREE.Vector3(x, y, z).project(h.camera), r = h.canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
}
if (typeof window !== 'undefined') window.__voidMini = { list: liveMiniatures, keys: () => [...live.keys()], project: projectPoint,
  state: (key) => { const h = live.get(key); try { return h && h.inst && h.inst.state ? h.inst.state() : null; } catch (_) { return null; } } }; // a kind's own state(), for tests
