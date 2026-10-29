/**
 * scene3d — Verse's shared realistic 3D: one WebGL renderer for every miniature on the page, and the mount API cards use
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
 * three.js r180 is vendored under /vendor/three-r180a (add-ons import it by relative path, so they resolve without an importmap).
 */
import * as guard from './guard3d.js';
import { heroView, inspectPrompt } from '../lib/hero-view.js';
const V = '/vendor/three-r180a/';
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

// ---------- detail: low-poly for older hardware (asked by Verse, ask-20261015-0347-2: "a 'low-poly' toggle for 3D miniatures to
// further optimize the 'smoother 3D on phones' shipment for older hardware") ----------
// Three settings in one key: 'low' (always), 'full' (never), or unset = auto, where the governor below turns low-poly on when
// a device still runs late at its lowest pixel step, and off again once it has kept up for a while. Low-poly draws every
// miniature at 1x pixels (REGRESS_DPR) with no key-light or contact shadows, and the stage figures (skills/figures3d.js) stay
// at their light mesh tier instead of re-meshing finer on zoom. "low poly 3d" / "full 3d" / "auto 3d" set it (skills/figures.js).
export const DETAIL_KEY = 'a2m.void.3d.v1';
let autoLow = false;
function detailMode() { try { const v = localStorage.getItem(DETAIL_KEY); return v === 'low' || v === 'full' ? v : 'auto'; } catch (_) { return 'auto'; } }
/** True while miniatures draw low-poly (the setting says so, or the governor stepped there on its own). */
export function lowPoly() { const m = detailMode(); return m === 'low' || (m === 'auto' && autoLow); }
/** The detail state: { mode: 'low' | 'full' | 'auto', low: drawing low-poly now, auto: the governor's own low step }. */
export function detail() { return { mode: detailMode(), low: lowPoly(), auto: autoLow }; }
/** Set 'low', 'full' or 'auto'. Every live miniature follows at once; a 'void:3d-detail' event tells the stage figures. */
export function setDetail(mode) {
  try { if (mode === 'low' || mode === 'full') localStorage.setItem(DETAIL_KEY, mode); else localStorage.removeItem(DETAIL_KEY); } catch (_) {}
  autoLow = false; // a person's choice, or back to auto, starts from full; the governor steps down again only if it must
  applyDetail();
}
function applyDetail() {
  for (const h of live.values()) { if (h.resize) h.resize(); h.shadowDirty = true; for (const c of h.contacts) c.dirty = true; h.dirty = true; }
  wake();
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('void:3d-detail', { detail: detail() }));
}
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === DETAIL_KEY) applyDetail(); });
/**
 * One governor decision, pure so it can be tested: s = { at: index into QUALITY_STEPS, ema: smoothed frame gap in ms, n: frames
 * since the last step, good: frames in a row that kept up, low: on the auto low-poly step, canLow: auto mode }, target = the
 * frame gap aimed at. Returns the next state. Late for 20 frames: one pixel step down, and past the last step, low-poly (when
 * canLow). Keeping up for 180 frames: one step back, low-poly first.
 */
export function governStep(s, target) {
  const last = QUALITY_STEPS.length - 1, r = { ...s };
  if (s.n > 20 && s.ema > target * 1.35) {
    if (s.at < last) { r.at = s.at + 1; r.n = 0; r.good = 0; }
    else if (s.canLow && !s.low) { r.low = true; r.n = 0; r.good = 0; }
  } else if (s.ema < target * 1.1 && (s.at > 0 || s.low)) {
    r.good = s.good + 1;
    if (r.good > 180) { if (s.low) r.low = false; else r.at = s.at - 1; r.good = 0; r.n = 0; }
  } else r.good = 0;
  return r;
}

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
    // the key-light shadow is world-space: an orbit or zoom never changes it, so it is redrawn only when the scene moves
    // (perf 2026-10-15, owner: "choppy and laggy on all devices, even the Victus"): an orbit frame is one pass, not two
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 0);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new lib.RoomEnvironment();
    const env = pmrem.fromScene(room, 0.035).texture;
    room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); pmrem.dispose();
    const gltf = new lib.GLTFLoader(); gltf.setMeshoptDecoder(lib.MeshoptDecoder);
    const ktx2 = new lib.KTX2Loader().setTranscoderPath(V + 'addons/libs/basis/').detectSupport(renderer); gltf.setKTX2Loader(ktx2);
    try { const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'); guard.setGpu(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (_) {}
    const E = { lib, THREE, renderer, canvas, env, gltf, ktx2, w: 0, h: 0, quality: 1, gov: { ema: 0, n: 0, good: 0 }, models: new Map(), textures: new Map(), maxAniso: renderer.capabilities.getMaxAnisotropy(), lost: false };
    // a lost context (a GPU reset, the driver's watchdog) used to leave every miniature dead until a reload: wait it out, then
    // recompile and redraw them all (three.js rebuilds its own GPU state when the context comes back)
    // the studio light: a CC0 Poly Haven HDRI (brown_photostudio_02, see docs/licenses.md) replaces the procedural room once it
    // has loaded, so glossy pieces show real softbox highlights; the room stays if the file can't load
    // only where half-float targets render (PMREM of a float HDRI stalls WebKit's GL without them), and after the first boards drew
    const ext = renderer.extensions; if (ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float')) setTimeout(() => studioHdri(E).catch((e) => console.warn('[scene3d] studio HDRI', e)), 1500);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); E.lost = true; guard.contextLost(); });
    canvas.addEventListener('webglcontextrestored', () => { E.lost = false; guard.contextRestored(); for (const h of live.values()) { h.needsCompile = true; h.dirty = true; h.shadowDirty = true; for (const c of h.contacts) c.dirty = true; } wake(); });
    return E;
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
    group, plane, dirty: true, materials: [plane.material, depth, hB, vB], // compiled ahead of the first draw (warmUp)
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
// key -> the load still in flight: a card re-rendered while its miniature loaded (a move made before 3D was up) asks again
// with the same key; it waits for that load and takes it over instead of building a second one (verify flake: two boards
// under one key, and the first one, freed off the page, took the key with it, so the board on screen was not in the list)
const loading = new Map();
/** Teach Verse a miniature: build(ctx, data) sets up ctx.root and returns { update(data), tick(dt, t), dispose() }. */
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
export const STUDIO_HDRI = '/models/hdri/brown_photostudio_02_1k.hdr';
async function studioHdri(E) {
  const { THREE } = E; const { HDRLoader } = await import(V + 'addons/HDRLoader.js');
  const tex = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(STUDIO_HDRI);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(E.renderer); const env = pm.fromEquirectangular(tex).texture; tex.dispose(); pm.dispose();
  E.env = env; E.studio = true;
  for (const h of live.values()) if (h.E === E) { h.scene.environment = env; h.needsCompile = true; h.requestRender(); }
}
export function liveMiniatures() { return [...live.values()].map((h) => ({ key: h.key, kind: h.kind, w: h.cssW, h: h.cssH, draws: h.draws, shadowDraws: h.shadowDraws || 0, ms: h.ms, visible: h.visible, ready: h.ready, rendered: h.draws > 0 })); }
export function unmountMiniature(key) { const h = live.get(key); if (h) h.dispose(); return !!h; }

let raf = 0, last = 0;
function wake() { if (!raf && live.size) raf = requestAnimationFrame(loop); }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake);
function loop(t) {
  raf = 0; const dt = Math.min(0.1, last ? (t - last) / 1000 : 0.016); last = t;
  let again = false, drew = null; const phone = isPhone();
  for (const h of [...live.values()]) {
    if (!h.wrap.isConnected) { // the card re-rendered (it comes straight back) or was thrown away (it doesn't)
      if (++h.gone > 90) h.dispose(); else again = true;
      continue;
    }
    h.gone = 0;
    if (!h.ready || !h.visible || document.hidden) continue;
    let dirty = h.dirty;
    if (h.controls && h.controls.update(dt)) dirty = true;
    if (h.inspecting && h.controls && h.controls.autoRotate) again = true; // the examined thing keeps turning until a hand takes hold
    if (h.anim.length) { for (const a of h.anim.splice(0)) a(); dirty = true; h.shadowDirty = true; for (const c of h.contacts) c.dirty = true; }
    if (h.inst && h.inst.tick) { try { const r = h.inst.tick(dt, t / 1000); if (r !== false) { dirty = true; h.shadowDirty = true; if (r !== 'view') for (const c of h.contacts) c.dirty = true; } /* 'view': redraw, shadows unchanged */ } catch (e) { console.warn('[miniature ' + h.kind + '] tick', e); h.inst.tick = null; } again = true; }
    if (h.moving) again = true;
    // on a phone, motion nobody is steering (a beating heart, falling rain, a sweeping hand) draws at most every PHONE_FRAME_MS:
    // a steady 30 fps instead of 60 that drops frames (owner, 2026-10-15: "the 3d was still choppy and laggy"); a drag stays 60
    if (dirty && phone && !h.moving && t - (h.lastDraw || 0) < PHONE_FRAME_MS) { h.dirty = true; again = true; continue; }
    if (dirty && !h.E.lost) { if (h.needsCompile && h.E.renderer.compileAsync) { h.dirty = true; warmUp(h); } else if (!h.compiling) { draw(h); h.lastDraw = t; drew = h; } }
    if (h.dirty && !h.compiling && !h.E.lost) again = true;
  }
  if (drew) govern(drew, t, phone && !drew.moving ? PHONE_FRAME_MS + 2 : 0);
  if (again) raf = requestAnimationFrame(loop); else { last = 0; prevT = 0; }
}
// ---------- the quality governor: holds the frame rate while something moves ----------
// While frames are being drawn back to back it watches the gap between them. Slower than the screen's refresh for a
// stretch, it lowers the miniatures' pixel ratio one step (QUALITY_STEPS); fast again for a while, it climbs back. The
// screen's refresh is learnt from idle frames, so a 120 Hz display aims at 120. Nothing changes while the board is still.
export const QUALITY_STEPS = [1, 0.85, 0.7, 0.55];
/** The most pixels per CSS pixel a miniature draws at (devicePixelRatio is capped here; a phone's 3x screen gets 1.5). */
export const MAX_DPR = 1.5;
let refreshMs = 1000 / 60, prevT = 0, idleGaps = [];
function govern(drew, t, floor) {
  const E = drew.E, g = E.gov, gap = prevT ? t - prevT : 0; prevT = t;
  if (!gap || gap > 250) return;
  if (!floor && idleGaps.length < 30) { idleGaps.push(gap); if (idleGaps.length === 30) { const s = [...idleGaps].sort((a, b) => a - b); refreshMs = Math.max(1000 / 165, Math.min(1000 / 30, s[10])); } }
  g.ema = g.ema ? g.ema * 0.9 + gap * 0.1 : gap; g.n++;
  const at = QUALITY_STEPS.indexOf(E.quality), target = Math.max(refreshMs, floor || 0);
  const next = governStep({ at, ema: g.ema, n: g.n, good: g.good, low: autoLow, canLow: detailMode() === 'auto' }, target);
  g.n = next.n; g.good = next.good;
  if (next.at !== at) setQuality(E, QUALITY_STEPS[next.at]);
  if (next.low !== autoLow) { autoLow = next.low; applyDetail(); } // the step below the last pixel step: low-poly, and back
}
function setQuality(E, q) { E.quality = q; for (const h of live.values()) if (h.E === E && h.resize) h.resize(); }
/** The governor's state, for tests and the console. */
export function quality() { return engineP ? engineP.then((E) => ({ quality: E.quality, refreshMs, ema: E.gov.ema })) : Promise.resolve(null); }
// Shaders compile before a miniature draws, off the main thread where the browser can (KHR_parallel_shader_compile, in
// Chrome on a real GPU). Compiling them inside the first render froze the whole page for seconds per board (every 3D game
// on first open, and again on its first move), long enough on some GPUs for the driver to reset and the page to crash.
// A compile that never settles (a lost context, a starved GPU process) kept a miniature blank for good: the go board and the
// tally counter never drew on loaded CI runners (2026-10-12/13). Past this bound the first draw compiles what is left itself,
// a slow first frame instead of none.
export const COMPILE_BOUND_MS = 6000;
/** On a phone, the shortest gap between two frames of motion nobody is steering (about 30 fps). */
export const PHONE_FRAME_MS = 31;
/** The pixel ratio a phone draws a miniature at while a finger orbits it (full sharpness again when it lifts). */
export const REGRESS_DPR = 1;
function warmUp(h) {
  if (h.compiling) return;
  h.compiling = true; h.needsCompile = false;
  const { renderer: r, THREE } = h.E, extra = new THREE.Scene(); // the contact-shadow passes, drawn with materials no mesh in the scene wears
  for (const c of h.contacts) for (const m of c.materials) extra.add(new THREE.Mesh(c.plane.geometry, m));
  let settled = false;
  const finish = () => { if (settled) return; settled = true; clearTimeout(bound); uploadTextures(h, () => { h.compiling = false; h.dirty = true; wake(); }); };
  const bound = setTimeout(() => { console.warn('[miniature ' + h.kind + '] compile still running after ' + COMPILE_BOUND_MS + ' ms: drawing anyway'); finish(); }, COMPILE_BOUND_MS);
  const p = Promise.all([r.compileAsync(h.scene, h.camera), extra.children.length ? r.compileAsync(extra, h.camera, h.scene) : null])
    .catch((e) => console.warn('[miniature ' + h.kind + '] compile', e));
  h.compiles.add(p); // whenCompiled() waits on every compile still in flight, also one the bound gave up on
  p.finally(() => { h.compiles.delete(p); finish(); });
}
// three's compileAsync checks each material's program on a timer until it is ready; a material freed under it throws "reading
// 'isReady'" from that timer. Freeing GPU resources waits for every compile in flight: dispose() when a miniature unmounts
// mid-compile, and setGround() when an update reframes it mid-compile (the gear explainer going 16:32 -> 24:32, shard 3, 2026-10-29)
function whenCompiled(h, f) { if (h.compiles.size && !h.E.lost) Promise.allSettled([...h.compiles]).then(f); else f(); }
// Textures go to the GPU one per frame before the first draw. The first draw used to upload them all at once: the chess set's
// nine 2k textures held the main thread for seconds in one task (cleanup step 5, 2026-10-11), the freeze when a 3D game opened.
export function texturesOf(scene) {
  const out = new Set();
  scene.traverse((o) => { for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture) out.add(v); });
  return [...out];
}
function uploadTextures(h, done) {
  const r = h.E.renderer, todo = r.initTexture ? texturesOf(h.scene) : [];
  const next = () => {
    if (!todo.length || h.E.lost || !h.wrap.isConnected) return done();
    try { r.initTexture(todo.shift()); } catch (e) { console.warn('[miniature ' + h.kind + '] texture', e); }
    requestAnimationFrame(next);
  };
  next();
}
function draw(h) {
  const E = h.E, r = E.renderer, pw = h.canvas.width, ph = h.canvas.height;
  if (!pw || !ph) return;
  h.dirty = false; const t0 = performance.now();
  if (E.w < pw || E.h < ph) { E.w = Math.max(E.w, pw); E.h = Math.max(E.h, ph); r.setSize(E.w, E.h, false); }
  r.toneMappingExposure = h.exposure;
  // low-poly: the key light casts no shadow and the contact shadows are skipped (their planes hidden); the dirt stays so the
  // first full frame afterwards redraws them
  const low = lowPoly(); r.shadowMap.enabled = !low;
  r.shadowMap.needsUpdate = !low && !!h.shadowDirty; if (!low) h.shadowDirty = false; if (r.shadowMap.needsUpdate) h.shadowDraws = (h.shadowDraws || 0) + 1;
  for (const c of h.contacts) { c.plane.visible = !low; if (!low && c.dirty) { c.render(r, h.scene); c.dirty = false; } }
  r.setRenderTarget(null); r.setViewport(0, 0, pw, ph); r.setScissor(0, 0, pw, ph); r.setScissorTest(true);
  r.setClearColor(0x000000, 0); r.clear();
  r.render(h.scene, h.camera);
  r.setScissorTest(false);
  h.g2d.clearRect(0, 0, pw, ph);
  h.g2d.drawImage(E.canvas, 0, E.h - ph, pw, ph, 0, 0, pw, ph);
  h.draws += 1; h.ms = Math.round(performance.now() - t0);
  if (h.draws === 1) rendered(h);
}
// the first frame is on the canvas: say so on the page (data-rendered, aria-busy), fade it in, and tell anyone listening
function rendered(h) {
  h.wrap.dataset.rendered = 'true'; h.canvas.setAttribute('aria-busy', 'false'); h.canvas.style.opacity = '1';
  if (h.wire) { h.wire.stop(); h.wire = null; }
  try { h.wrap.dispatchEvent(new CustomEvent('void:mini-rendered', { bubbles: true, detail: { key: h.key, kind: h.kind } })); } catch (_) {}
}

// ---------- before the first frame, and when there is none ----------
// A low-poly wire shape turns slowly on its own small canvas over the (still transparent) miniature canvas from the moment a
// card asks for 3D, so the space is never blank while three.js, the kind's module and its model load; it fades out as the
// first real frame fades in (rendered). Plain 2D canvas: nothing of three.js is needed to draw it. Still with reduced motion.
function wireFrame(wrap) {
  const c = document.createElement('canvas'); c.className = 'void-mini-wire'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:.9;transition:opacity .3s ease-out';
  wrap.appendChild(c);
  const g = c.getContext('2d'), still = motionStill(), t0 = performance.now(), V = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]);
  const EDGES = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (V[i].filter((v, k) => v !== V[j][k]).length === 1) EDGES.push([i, j]);
  let gone = false, raf = 0, lastAt = 0;
  const draw = (now) => {
    raf = 0; if (gone || !c.isConnected) return;
    const w = Math.max(1, wrap.clientWidth), hh = Math.max(1, wrap.clientHeight);
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    const a = still ? 0.7 : (now - t0) / 1400, s = Math.min(w, hh) * 0.17, cx = w / 2, cy = hh / 2 - s * 0.15, ca = Math.cos(a), sa = Math.sin(a);
    const P = V.map(([x, y, z]) => { const rx = x * ca - z * sa, rz = x * sa + z * ca; return [cx + rx * s, cy - y * s * 0.85 + rz * s * 0.32]; });
    g.clearRect(0, 0, w, hh); g.lineWidth = 1; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.34)'; g.beginPath(); for (const [i, j] of EDGES) { g.moveTo(P[i][0], P[i][1]); g.lineTo(P[j][0], P[j][1]); } g.stroke();
    // the ground it stands on: a wire diamond, where the contact shadow will be
    const gy = cy + s * 0.85 + s * 0.42; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.beginPath();
    g.moveTo(cx - s * 1.5, gy); g.lineTo(cx, gy + s * 0.48); g.lineTo(cx + s * 1.5, gy); g.lineTo(cx, gy - s * 0.48); g.closePath(); g.stroke();
    lastAt = now;
    if (!still) raf = requestAnimationFrame((t) => (t - lastAt < 45 ? (raf = requestAnimationFrame(draw)) : draw(t))); // about 20 fps is plenty for a placeholder
  };
  draw(t0);
  return { el: c, stop(now) { gone = true; if (raf) cancelAnimationFrame(raf); if (now) c.remove(); else { c.style.opacity = '0'; setTimeout(() => c.remove(), 320); } } };
}
// A 3D model that could not be built or drawn leaves a small status card in its place (asked by Verse, ask-20261012-0856-1:
// "a visual 'error state' for 3D models that fail their self-check, replacing the empty space with a clear status card"):
// the kind, what went wrong in plain words, and how to retry. Only where WebGL works: without it the card's flat version is the
// answer, not an error. The wrap is marked data-rendered="failed" and one void:mini-failed event bubbles up with { key, kind, why }.
let styled = false;
function failCard(host, wrap, kind, key, err) {
  const msg = String((err && err.message) || err || '').replace(/\s+/g, ' ').trim();
  const why = /^no miniature for /.test(msg) ? 'there is no 3D model for this yet'
    : /Failed to fetch|import|Loading|network|404|HTTP/i.test(msg) ? 'its model could not be fetched'
    : msg ? 'its model failed its check: ' + msg.slice(0, 90) : 'its model failed its check';
  if (!styled && typeof document !== 'undefined') { styled = true; const st = document.createElement('style'); st.textContent = '.void-mini-status{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:12px;box-sizing:border-box;text-align:center;font:13px/1.4 ui-sans-serif,system-ui,sans-serif;color:#cfcfcf;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.22);border-radius:12px}.void-mini-status b{font-weight:500;color:#fff}.void-mini-status small{color:#8a8a8a}'; document.head.appendChild(st); }
  const card = document.createElement('div'); card.className = 'void-mini-status'; card.setAttribute('role', 'status');
  const b = document.createElement('b'); b.textContent = '3D ' + kind + ' did not load';
  const w = document.createElement('span'); w.textContent = why;
  const hint = document.createElement('small'); hint.textContent = 'Ask for it again to retry.';
  card.append(b, w, hint);
  wrap.replaceChildren(card); wrap.dataset.rendered = 'failed';
  if (!wrap.isConnected && host && host.isConnected) host.appendChild(wrap);
  try { wrap.dispatchEvent(new CustomEvent('void:mini-failed', { bubbles: true, detail: { key, kind, why } })); } catch (_) {}
}

/**
 * Show a miniature of `kind` in host. Re-mounting the same key (a card that re-rendered) moves the live miniature into the
 * new host and hands it the new data, so nothing is rebuilt. Rejects where WebGL is unavailable.
 */
// a miniature beside its card stays on the screen (owner, 2026-10-11: "things should smartly try to autofit in Verse"): to the
// right when it fits, else to the left, else under the card
function fitBeside(wrap) {
  if (typeof innerWidth !== 'number' || !wrap.isConnected) return;
  const put = (side) => { wrap.style.top = side === 'below' ? 'calc(100% + 10px)' : '0'; wrap.style.left = side === 'right' ? 'calc(100% + 14px)' : side === 'below' ? '0' : 'auto'; wrap.style.right = side === 'left' ? 'calc(100% + 14px)' : 'auto'; };
  put('right'); if (wrap.getBoundingClientRect().right <= innerWidth - 4) return;
  put('left'); if (wrap.getBoundingClientRect().left >= 4) return;
  put('below');
}

export async function mountMiniature(host, kind, data = {}, opts = {}) {
  const key = String(opts.key || kind + ':' + Math.random().toString(36).slice(2, 9));
  const old = live.get(key);
  if (old) { old.attach(host); if (data !== undefined && data !== old.data) old.update(data); return old; }
  const inFlight = loading.get(key);
  if (inFlight) {
    const h = await inFlight;
    if (!h || h.disposed) { // freed before this caller took it: load afresh (never waiting on the same finished load again)
      if (loading.get(key) === inFlight) loading.delete(key);
      return mountMiniature(host, kind, data, opts);
    }
    h.attach(host); if (data !== undefined && data !== h.data) h.update(data); return h;
  }
  const p = mountFresh(host, kind, data, opts, key);
  loading.set(key, p);
  try { return await p; } finally { if (loading.get(key) === p) loading.delete(key); }
}
async function mountFresh(host, kind, data, opts, key) {
  const wrap = document.createElement('div');
  wrap.className = 'void-mini'; wrap.dataset.kind = kind; wrap.dataset.key = key;
  wrap.dataset.rendered = 'false'; // until its first frame (asked by Verse: a rendered signal checks and people can wait for)
  const place = opts.place || 'inside';
  wrap.style.cssText = place === 'beside'
    ? 'position:absolute;left:calc(100% + 14px);top:0;width:' + (opts.width || 220) + 'px;height:' + (opts.height || 220) + 'px;pointer-events:auto'
    : 'position:relative;width:' + (opts.width ? opts.width + 'px' : '100%') + ';height:' + (opts.height ? opts.height + 'px' : '100%');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', opts.label || ('3D ' + kind));
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none;opacity:0;transition:opacity .25s ease-out';
  canvas.setAttribute('aria-busy', 'true');
  wrap.appendChild(canvas);
  for (const ev of ['pointerdown', 'mousedown', 'touchstart']) canvas.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // orbit, not a card drag
  // Where WebGL exists the wrap goes in now, with a wire placeholder on it, before three.js, the kind's module or its model
  // have loaded (asked by Verse, ask-20261014-1025-1: "a progressive mesh loading state where a low-poly wireframe appears
  // instantly during 3D card transitions"); the real canvas stays transparent until its first frame, as before. Where WebGL
  // is missing nothing is put in and the mount rejects as it always did, so the card shows its flat version.
  const canDraw = webglOk();
  if (canDraw) { host.appendChild(wrap); if (place === 'beside') fitBeside(wrap); }
  const wire = canDraw ? wireFrame(wrap) : null;
  let E, build;
  try { E = await engine(); build = await builderFor(kind); }
  catch (e) { if (canDraw) failCard(host, wrap, kind, key, e); else wrap.remove(); throw e; } // the engine or the kind: a status card says which (ask-20261012-0856-1)
  const { THREE, lib } = E;
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
    key, kind, E, wrap, canvas, scene, camera, controls, root, keyLight, sky, data, wire, draws: 0, gone: 0, dirty: true, shadowDirty: true, visible: true, ready: false, needsCompile: true, compiling: false,
    anim: [], compiles: new Set(), moving: false, exposure: opts.exposure ?? 1.0, contact: null, contacts: [], cssW: 0, cssH: 0, inst: null, taps: [],
    attach(host2) { if (host2 && wrap.parentNode !== host2) host2.appendChild(wrap); if (place === 'beside') fitBeside(wrap); h.dirty = true; wake(); },
    update(d) { h.data = d; h.needsCompile = true; if (h.inst && h.inst.update) { try { h.inst.update(d); } catch (e) { console.warn('[miniature ' + kind + '] update', e); } } h.requestRender(); },
    requestRender(opts2 = {}) { h.dirty = true; h.shadowDirty = true; if (opts2.shadows !== false) for (const c of h.contacts) c.dirty = true; wake(); },
    /** Another blurred contact shadow, e.g. pieces on a board: { y, size, exclude: [objects that must not cast it], opacity, blur, darkness, height }. */
    addContactShadow(o = {}) { const c = contactShadows(E, o.size || 1, o); c.group.position.y = o.y || 0; if (o.x || o.z) c.group.position.set(o.x || 0, o.y || 0, o.z || 0); scene.add(c.group); h.contacts.push(c); h.requestRender(); return c; },
    /** Rays from a client point into the scene: hits sorted near to far (objects default to everything under root). */
    pick(clientX, clientY, objects) {
      const r = canvas.getBoundingClientRect(); const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(v, camera); return ray.intersectObjects(objects || [root], true);
    },
    /** fn(hits, event) on a tap or click that did not orbit (moved under 6 px). */
    onTap(fn) { h.taps.push(fn); },
    /** Examine it the way a game's inventory does (owner, 2026-10-16: Resident Evil, Skyrim): the stage dims behind it, the camera
     *  comes up to the hero angle (or o.view/o.pad), it turns slowly until a hand takes hold (o.turn false: it holds still), a
     *  prompt bar says what a hand can do (o.prompt), and Esc puts it back (o.onEsc runs instead when given: the book shuts its
     *  cover). inspect(false) restores the view it had. */
    inspect(on, o = {}) {
      if (on) {
        if (h.inspecting) { if (o.view || o.pad) h.frame(root, { view: o.view, pad: o.pad, ground: false }); return; }
        h.inspecting = true; h.before = { pos: camera.position.clone(), target: controls ? controls.target.clone() : camera.position.clone(), minD: controls && controls.minDistance, maxD: controls && controls.maxDistance };
        inspectStyle(); document.documentElement.classList.add('v-inspect'); wrap.classList.add('inspecting');
        // a small miniature (a clock beside its readout) comes up to the middle of the screen at a size worth examining, like a game's
        // inventory view (owner, 2026-10-17: "zoom failed"); its place in the card is held so it goes back where it was
        const rc = wrap.getBoundingClientRect();
        if (o.enlarge !== false && wrap.parentNode && rc.width && Math.min(rc.width, rc.height) < Math.min(innerWidth, innerHeight) * 0.6) {
          const ph = document.createElement('div'); ph.className = 'mini-ph'; ph.style.cssText = 'width:' + rc.width + 'px;height:' + rc.height + 'px;flex:none';
          wrap.parentNode.insertBefore(ph, wrap); h.ph = ph; h.prevStyle = wrap.getAttribute('style');
          document.body.appendChild(wrap); wrap.classList.add('enlarged');
          if (h.resize) h.resize();
        }
        h.frame(root, { view: o.view, pad: o.pad, ground: false });
        if (controls) { controls.autoRotate = o.turn !== false && !motionStill(); controls.autoRotateSpeed = 1.1; }
        let bar = wrap.querySelector('.mini-prompt'); if (!bar) { bar = document.createElement('div'); bar.className = 'mini-prompt'; wrap.appendChild(bar); }
        bar.textContent = o.prompt || inspectPrompt({ turn: o.turn !== false, zoom: opts.zoom !== false });
        h.onEsc = (e) => { if (e.key !== 'Escape') return; e.stopImmediatePropagation(); e.preventDefault(); if (o.onEsc) o.onEsc(); else h.inspect(false); };
        document.addEventListener('keydown', h.onEsc, true);
        if (h.examine) h.examine.hidden = true;
      } else {
        if (!h.inspecting) return;
        h.inspecting = false; document.documentElement.classList.remove('v-inspect'); wrap.classList.remove('inspecting');
        if (h.ph) { h.ph.replaceWith(wrap); h.ph = null; wrap.classList.remove('enlarged'); if (h.prevStyle == null) wrap.removeAttribute('style'); else wrap.setAttribute('style', h.prevStyle); h.prevStyle = null; if (h.resize) h.resize(); }
        if (h.onEsc) { document.removeEventListener('keydown', h.onEsc, true); h.onEsc = null; }
        const bar = wrap.querySelector('.mini-prompt'); if (bar) bar.remove();
        if (controls) { controls.autoRotate = false; }
        if (h.before) { camera.position.copy(h.before.pos); if (controls) { controls.target.copy(h.before.target); controls.minDistance = h.before.minD; controls.maxDistance = h.before.maxD; controls.update(); } else camera.lookAt(h.before.target); h.before = null; }
        if (h.examine) h.examine.hidden = false;
      }
      h.requestRender();
    },
    /** Fit the camera to an object: target its centre, distance from its bounding sphere, key light and shadow box around it. */
    frame(obj = root, o = {}) {
      const box = new THREE.Box3().setFromObject(obj), sph = box.getBoundingSphere(new THREE.Sphere()), c = sph.center, rad = Math.max(sph.radius, 1e-3);
      // a miniature that names no view is framed the way a game's inventory frames an item: the angle its shape asks for (lib/hero-view.js)
      const hero = o.view || opts.view ? null : heroView(box.getSize(new THREE.Vector3()));
      const dir = new THREE.Vector3(...(o.view || opts.view || hero.view)).normalize();
      const fit = (o.pad || opts.pad || (hero ? hero.pad : 1.15)) * rad / Math.sin((camera.fov * Math.PI / 180) / 2);
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
      if (h.ground) { const g = h.ground; scene.remove(g.group); h.ground = null; whenCompiled(h, () => g.dispose()); }
      if (h.contact) { const c = h.contact; scene.remove(c.group); h.contacts = h.contacts.filter((x) => x !== c); h.contact = null; whenCompiled(h, () => c.dispose()); }
      if (mode === 'none') return;
      const size = rad * 3.2;
      h.contact = contactShadows(E, size, { height: rad * 1.6 }); h.contact.group.position.y = y; scene.add(h.contact.group); h.contacts.push(h.contact);
      const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.32 }));
      g.position.y = y + 0.0002; g.receiveShadow = true; g.userData.noContactShadow = true;
      h.ground = { group: g, dispose() { g.geometry.dispose(); g.material.dispose(); } }; scene.add(g);
    },
    dispose() {
      if (h.disposed) return; h.disposed = true; if (live.get(key) === h) live.delete(key);
      if (h.wire) { h.wire.stop(true); h.wire = null; }
      if (controls) controls.dispose(); if (h.ro) h.ro.disconnect(); if (h.io) h.io.disconnect();
      wrap.remove();
      // the GPU side waits for a compile still in flight (see whenCompiled); the miniature is already gone from the page and from live
      const free = () => {
        try { h.inst && h.inst.dispose && h.inst.dispose(); } catch (_) {}
        for (const c of h.contacts) c.dispose(); if (h.ground) h.ground.dispose();
        scene.traverse((o) => { if (o.isMesh && !o.userData.shared) { o.geometry && o.geometry.dispose(); } });
      };
      whenCompiled(h, free);
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
  // a phone orbits at a lower resolution and sharpens when the finger lifts (react-three-fiber's "regress"; owner, 2026-10-15:
  // "on my phone the 3d was still choppy and laggy"): a drag redraws every frame, and pixels are what a phone's GPU runs short of
  const regress = (on) => { if (!isPhone() || h.regressed === on) return; h.regressed = on; resize(); };
  if (controls) { controls.addEventListener('start', () => { h.moving = true; canvas.style.cursor = 'grabbing'; controls.autoRotate = false; regress(true); wake(); }); controls.addEventListener('end', () => { h.moving = false; canvas.style.cursor = 'grab'; regress(false); wake(); }); controls.addEventListener('change', () => { h.dirty = true; wake(); }); }
  // the Examine button at the corner (a game's inventory prompt): a kind may give it its own word and its own act (the book's "Read" opens the cover)
  if (opts.examine !== false) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mini-examine'; b.textContent = 'Examine';
    b.addEventListener('click', (e) => { e.stopPropagation(); if (h.onExamine) h.onExamine(); else h.inspect(true); });
    for (const ev of ['pointerdown', 'mousedown', 'touchstart']) b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    wrap.appendChild(b); h.examine = b; inspectStyle();
  }
  // capped at MAX_DPR (a 3x phone screen drew 9x the pixels for no visible gain; desktop no longer supersamples 1x screens:
  // antialias already smooths edges) and scaled by the governor's quality while frames run late
  const pr = () => h.regressed || lowPoly() ? REGRESS_DPR : Math.min(MAX_DPR, window.devicePixelRatio || 1) * (h.E.quality || 1);
  const resize = () => {
    const w = Math.max(1, Math.round(wrap.clientWidth)), hh = Math.max(1, Math.round(wrap.clientHeight)); h.cssW = w; h.cssH = hh;
    const p = pr(); canvas.width = Math.round(w * p); canvas.height = Math.round(hh * p); camera.aspect = w / hh; camera.updateProjectionMatrix(); h.dirty = true; wake();
  };
  h.resize = resize; h.ro = new ResizeObserver(resize); h.ro.observe(wrap);
  h.io = new IntersectionObserver((es) => { for (const e of es) h.visible = e.isIntersecting; if (h.visible) { h.dirty = true; wake(); } }); h.io.observe(wrap);
  live.set(key, h);
  h.attach(host); resize();
  const ctx = { THREE, lib, scene, root, camera, controls, keyLight, sky, canvas, handle: h, still: motionStill(), phone: isPhone(),
    loadGLTF, loadTexture, frame: (o, x) => h.frame(o, x), addContactShadow: (o) => h.addContactShadow(o), requestRender: (x) => h.requestRender(x), onTap: (fn) => h.onTap(fn), pick: (x, y, o) => h.pick(x, y, o),
    inspect: (on, o) => h.inspect(on, o), examine: (label, act) => { if (h.examine && label) h.examine.textContent = label; h.onExamine = act || null; },
    animate: (fn) => { h.anim.push(fn); wake(); } };
  h.ctx = ctx;
  try { h.inst = (await build(ctx, data)) || {}; } catch (e) { h.dispose(); failCard(host, wrap, kind, key, e); throw e; } // the model failed its own build: a status card, not empty space
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
if (typeof window !== 'undefined') window.__voidMini = { list: liveMiniatures, keys: () => [...live.keys()], project: projectPoint, detail, setDetail,
  inspect: (key, on, o) => { const h = live.get(key); if (h) h.inspect(on !== false, o); return !!(h && h.inspecting); }, inspecting: (key) => { const h = live.get(key); return !!(h && h.inspecting); },
  state: (key) => { const h = live.get(key); try { return h && h.inst && h.inst.state ? h.inst.state() : null; } catch (_) { return null; } } }; // a kind's own state(), for tests
// the examine look: the stage dims behind the thing, the prompt bar and the Examine button sit on the miniature (once per page)
function inspectStyle() {
  if (typeof document === 'undefined' || document.getElementById('void-mini-inspect')) return;
  const s = document.createElement('style'); s.id = 'void-mini-inspect';
  s.textContent = '#stage>*{transition:filter .45s ease}html.v-inspect #stage>:not(:has(.void-mini.inspecting)){filter:brightness(.5) blur(2px)}html.v-inspect #void-syn{opacity:.3}'
    + '.void-mini.enlarged{position:fixed!important;left:6vw!important;right:6vw!important;top:6vh!important;bottom:14vh!important;width:auto!important;height:auto!important;z-index:60;transition:none}'
    + '.void-mini .mini-prompt{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);padding:5px 13px;border-radius:999px;background:rgba(10,12,20,.74);color:#e9e2cf;font:13px Georgia,"Times New Roman",serif;letter-spacing:.02em;white-space:nowrap;pointer-events:none;border:1px solid rgba(233,226,207,.18);box-shadow:0 4px 14px rgba(0,0,0,.35)}'
    + '.void-mini .mini-examine{position:absolute;right:8px;bottom:8px;padding:3px 10px;border-radius:999px;background:rgba(10,12,20,.6);color:#e9e2cf;font:12px Georgia,"Times New Roman",serif;letter-spacing:.03em;border:1px solid rgba(233,226,207,.22);cursor:pointer;opacity:0;transition:opacity .2s}'
    + '.void-mini:hover .mini-examine,.void-mini .mini-examine:focus-visible{opacity:1}@media (hover:none){.void-mini .mini-examine{opacity:.85}}.void-mini .mini-examine[hidden]{display:none}';
  document.head.appendChild(s);
}
