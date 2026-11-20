// The world in 3D: one engine for Verse's own version of a real thing. It draws with WebGPU and, where
// the browser has none, with WebGL 2 (three.js r180's WebGPURenderer chooses; vendored at /vendor/three-r180a), with physically based materials,
// a sun with soft shadows, an image-based sky, and bloom. It starts on the light tier so a phone paints at once, then moves to the full tier when
// the frame rate allows, and drops back when it does not. A scene is a module in /world/<thing>.js: `manifest` (its facts with sources, parts, behaviors,
// the plus) and `build(ctx, detail)`. Targets are measured by tools/world-probe.mjs through window.__world, never by looking at names.
const q = new URLSearchParams(location.search);
const THING = /^[a-z0-9-]{2,30}$/.test(q.get('thing') || '') ? q.get('thing') : 'snail';
const $ = (id) => document.getElementById(id);
const W = (window.__world = { thing: THING, backend: '', tier: '', fps: 0, frames: 0, errors: [], ready: false, parts: [], behaviors: [], plus: [], state: {} });
addEventListener('error', (e) => W.errors.push(String(e.message || e).slice(0, 160)));
addEventListener('unhandledrejection', (e) => W.errors.push(String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); for (const k of [].concat(kids)) n.append(k); return n; };
const phone = matchMedia('(pointer:coarse)').matches || innerWidth < 720 || (navigator.deviceMemory && navigator.deviceMemory <= 4);

async function main() {
  const THREE = await import('three/webgpu'), TSL = await import('three/tsl');
  const canvas = $('c');
  let tier = ['light', 'full'].includes(q.get('tier')) ? q.get('tier') : 'light';
  const pinned = !!q.get('tier');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: tier !== 'light', forceWebGL: q.get('backend') === 'webgl', powerPreference: 'high-performance' });
  await renderer.init();
  W.backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.05, 400);
  const mod = await import('/world/' + THING + '.js'), man = mod.manifest;
  W.parts = man.parts.map((p) => p.id); W.behaviors = man.behaviors.map((b) => b.id); W.plus = man.plus.map((p) => p.id);
  document.title = man.title + ' · Verse'; $('title').textContent = man.title; $('sub').textContent = man.sub;

  // ---- the sky: a gradient dome, a low sun, and the light it casts on everything (image-based, so the shell shines and the dew glints) ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, vertexColors: true }));
  { const p = sky.geometry.attributes.position, c = new Float32Array(p.count * 3), top = new THREE.Color(man.sky.top), mid = new THREE.Color(man.sky.mid), low = new THREE.Color(man.sky.low), k = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const h = p.getY(i) / 300; if (h > 0.25) k.copy(mid).lerp(top, Math.min(1, (h - 0.25) / 0.75)); else k.copy(low).lerp(mid, Math.max(0, (h + 0.1) / 0.35)); c.set([k.r, k.g, k.b], i * 3); }
    sky.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  scene.add(sky);
  const sunDir = new THREE.Vector3(...man.sun).normalize(), sunCol = new THREE.Color(man.sunColor);
  const envScene = new THREE.Scene(); envScene.add(sky.clone());
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 8), new THREE.MeshBasicMaterial({ color: sunCol.clone().multiplyScalar(14), fog: false })); sunBall.position.copy(sunDir).multiplyScalar(240);
  envScene.add(sunBall); const glow = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 8), new THREE.MeshBasicMaterial({ color: sunCol.clone().multiplyScalar(1.4), fog: false, transparent: true, opacity: 0.35 })); glow.position.copy(sunBall.position); envScene.add(glow);
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.02).texture; scene.environmentIntensity = 0.9; } catch (e) { W.errors.push('environment: ' + String(e.message || e).slice(0, 100)); scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a4a2a, 1.4)); }
  scene.fog = new THREE.FogExp2(new THREE.Color(man.sky.low).getHex(), man.fog);
  const sun = new THREE.DirectionalLight(sunCol, 3.2); sun.castShadow = true; scene.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(0xbfd8ff, 0x4a5a30, 0.5); scene.add(fill);

  // ---- tiers: light loads first (a phone paints at once), full adds detail, shadows and bloom ----
  const post = { node: null, on: false };
  function setTier(t) {
    tier = t; W.tier = t;
    const dpr = Math.min(devicePixelRatio || 1, t === 'full' ? (phone ? 1.75 : 2) : 1.25);
    renderer.setPixelRatio(dpr);
    sun.shadow.mapSize.set(t === 'full' ? 2048 : 1024, t === 'full' ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.shadow.bias = -0.001; sun.shadow.normalBias = 0.06; sun.shadow.radius = t === 'full' ? 4 : 2;
    const s = man.shadowBox; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 120 }); sun.shadow.camera.updateProjectionMatrix();
    if (t === 'full' && !post.node) {
      import('three/addons/tsl/display/BloomNode.js').then(({ bloom }) => {
        const pass = TSL.pass(scene, camera), color = pass.getTextureNode('output');
        post.node = new THREE.PostProcessing(renderer); post.node.outputNode = color.add(bloom(color, 0.28, 0.6, 0.9)); post.on = true;
      }).catch((e) => W.errors.push('post: ' + String(e.message || e).slice(0, 100)));
    }
    post.on = t === 'full' && !!post.node; chipText(t);
  }
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize);

  // ---- the scene, light first ----
  const ctx = { THREE, TSL, scene, camera, renderer, sun, sunDir, params: { time: 1, ...Object.fromEntries((man.variables || []).map((v) => [v.id, v.value])) }, phone, surface: 'ground' };
  let handle = await mod.build(ctx, 'light'); let detail = 'light';
  setTier(tier); resize();
  if (tier === 'full') { handle.dispose && handle.dispose(); handle = await mod.build(ctx, 'full'); detail = 'full'; }

  // ---- orbit: drag to turn, pinch or wheel to zoom ----
  const cam = { az: 0.35, pol: 1.2, dist: man.view.dist, min: man.view.min, max: man.view.max, target: new THREE.Vector3(), follow: true };
  const ptrs = new Map(); let pinch = 0, moved = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 2) { ptrs.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.min(cam.max, Math.max(cam.min, cam.dist * pinch / d)); pinch = d; moved = 9; return; }
    cam.az -= (e.clientX - p[0]) * 0.006; const lo = ctx.surface === 'glass' ? 0.2 : 0.12, hi = ctx.surface === 'glass' ? Math.PI - 0.2 : 1.5;
    cam.pol = Math.min(hi, Math.max(lo, cam.pol - (e.clientY - p[1]) * 0.006)); moved += Math.abs(e.clientX - p[0]) + Math.abs(e.clientY - p[1]); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  });
  const up = (e) => { const had = ptrs.delete(e.pointerId); pinch = 0; if (had && moved < 6 && e.type === 'pointerup') pick(e.clientX, e.clientY); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.min(cam.max, Math.max(cam.min, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  canvas.addEventListener('keydown', (e) => { const k = { ArrowLeft: [0.15, 0], ArrowRight: [-0.15, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key]; if (k) { cam.az += k[0]; cam.pol = Math.min(1.5, Math.max(0.12, cam.pol + k[1])); e.preventDefault(); } if (e.key === '+' || e.key === '=') cam.dist = Math.max(cam.min, cam.dist * 0.85); if (e.key === '-') cam.dist = Math.min(cam.max, cam.dist / 0.85); });

  // ---- tapping: a part says what it is; the ground drops food ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function showCard(c) { const card = $('card'); if (!c) { card.hidden = true; return; } card.hidden = false; card.replaceChildren(el('h2', { textContent: c.title }), ...(c.lines || []).map((t) => el('p', { textContent: t })), ...(c.source ? [el('small', { textContent: 'Source: ' + c.source })] : [])); }
  function pick(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(handle.pickables || [], true)[0]; const r = handle.pick && handle.pick(hit || null, ray);
    if (r) showCard(r);
  }
  W.pickPart = (id) => { const r = handle.partCard && handle.partCard(id); if (r) showCard(r); return !!r; };

  // ---- the controls: time first (the plus), then the thing's own, then looking inside ----
  const timeStops = [0, 0.05, 0.2, 1, 3, 10], timeNames = ['paused', 'real time ÷20', 'real time ÷5', 'real time', 'sped up ×3', 'sped up ×10'];
  const tl = el('input', { type: 'range', min: 0, max: timeStops.length - 1, step: 1, value: 4, ariaLabel: 'Speed of time' }), to = el('output', { textContent: timeNames[4] });
  tl.oninput = () => { ctx.params.time = timeStops[+tl.value]; to.textContent = timeNames[+tl.value]; W.state.time = ctx.params.time; };
  ctx.params.time = timeStops[4]; W.state.time = ctx.params.time;
  $('vars').append(el('div', { className: 'sl' }, [el('label', { textContent: 'Time', htmlFor: '' }), tl, to]));
  for (const v of man.variables || []) {
    const inp = el('input', { type: 'range', min: v.min, max: v.max, step: v.step || 1, value: v.value, ariaLabel: v.label }), out = el('output', { textContent: v.value + ' ' + v.unit });
    inp.oninput = () => { ctx.params[v.id] = +inp.value; out.textContent = inp.value + ' ' + v.unit; W.state[v.id] = +inp.value; handle.vary && handle.vary(v.id, +inp.value); };
    W.state[v.id] = v.value; $('vars').append(el('div', { className: 'sl', title: v.why }, [el('label', { textContent: v.label }), inp, out]));
  }
  const toggles = {};
  for (const b of man.toggles || []) {
    const btn = el('button', { textContent: b.label, type: 'button' }); btn.setAttribute('aria-pressed', 'false');
    btn.onclick = () => { const on = btn.getAttribute('aria-pressed') !== 'true'; btn.setAttribute('aria-pressed', String(on)); W.state[b.id] = on; if (b.id === 'glass') { ctx.surface = on ? 'glass' : 'ground'; if (on) cam.pol = Math.PI - 0.5; else cam.pol = Math.min(cam.pol, 1.2); } handle.toggle && handle.toggle(b.id, on); showCard(on && b.say ? { title: b.label, lines: [b.say] } : null); };
    toggles[b.id] = btn; $('btns').append(btn);
  }
  $('btns').append(el('button', { textContent: 'Facts and sources', type: 'button', onclick: () => { const c = $('card'); if (!c.hidden && c.dataset.k === 'facts') { c.hidden = true; return; } showCard({ title: 'What is true about it, and where that comes from', lines: man.facts.map((f) => '• ' + f.text), source: [...new Set(man.facts.map((f) => f.source))].join('; ') }); c.dataset.k = 'facts'; } }));
  W.setToggle = (id, on) => { const b = toggles[id]; if (b && (b.getAttribute('aria-pressed') === 'true') !== on) b.click(); };
  W.setTime = (i) => { tl.value = i; tl.oninput(); };
  W.setVar = (id, v) => { const i = [...$('vars').querySelectorAll('input')].find((n) => n.ariaLabel === (man.variables.find((x) => x.id === id) || {}).label); if (i) { i.value = v; i.oninput(); } };

  // ---- the loop ----
  const tags = $('tags'), tagEls = new Map(), v3 = new THREE.Vector3();
  let last = performance.now(), acc = 0, n = 0, t = 0, since = performance.now(), slow = 0, up2 = 0, frames = [];
  function labelsTick() {
    const want = handle.labels ? handle.labels() : [];
    for (const [id, e] of tagEls) if (!want.find((w) => w.id === id)) { e.remove(); tagEls.delete(id); }
    for (const w of want) {
      let e = tagEls.get(w.id); if (!e) { e = el('div', { className: 'tag', textContent: w.text }); tags.append(e); tagEls.set(w.id, e); }
      v3.copy(w.at).project(camera); e.style.left = ((v3.x * 0.5 + 0.5) * innerWidth) + 'px'; e.style.top = ((-v3.y * 0.5 + 0.5) * innerHeight) + 'px'; e.style.display = v3.z < 1 ? 'block' : 'none';
    }
  }
  function chipText(t) { $('chip').textContent = W.backend + ' · ' + (t === 'full' ? 'full detail' : 'light') + ' · ' + (W.fps > 0 ? Math.round(W.fps) + ' fps' : 'measuring'); } // the real frame rate, from the browser's own frame times
  function frame(now) {
    const real = Math.max(0, (now - last) / 1000), raw = Math.min(0.1, real); last = now; frames.push(raw); if (frames.length > 90) frames.shift();
    const dt = raw * ctx.params.time; t += dt;
    handle.tick(dt, t, raw);
    const f = handle.focus ? handle.focus() : cam.target; if (cam.follow) cam.target.lerp(f, 1 - Math.exp(-raw * 4));
    const sp = Math.sin(cam.pol), cp = Math.cos(cam.pol);
    camera.position.set(cam.target.x + cam.dist * sp * Math.sin(cam.az), cam.target.y + cam.dist * cp, cam.target.z + cam.dist * sp * Math.cos(cam.az)); camera.lookAt(cam.target);
    sun.position.copy(cam.target).addScaledVector(sunDir, 60); sun.target.position.copy(cam.target); sun.target.updateMatrixWorld();
    labelsTick();
    if (post.on && post.node) post.node.render(); else renderer.render(scene, camera);
    W.frames++; acc += real; n++;
    if (acc > 0.5) { W.fps = n / acc; W.frameMs = Math.round(1000 * acc / n); acc = 0; n = 0; chipText(tier); }
    const age = (performance.now() - since) / 1000;
    if (!pinned && !W.switching) {
      if (tier === 'light' && age > 2.5 && W.fps >= 50 && !(phone && W.fps < 58)) { W.switching = true; upgrade('full'); }
      else if (tier === 'full' && age > 6 && W.fps > 0 && W.fps < 24) { slow++; if (slow > 4) { W.switching = true; upgrade('light'); } } else slow = 0;
    }
  }
  async function upgrade(to) { handle.dispose && handle.dispose(); handle = await mod.build(ctx, to); detail = to; setTier(to); since = performance.now(); slow = 0; W.switching = false; Object.entries(W.state).forEach(([k, v]) => { if (typeof v === 'boolean') handle.toggle && handle.toggle(k, v); else if (k !== 'time') handle.vary && handle.vary(k, v); }); }
  W.manifest = man; W.chipText = chipText; W.scene = scene; W.renderer = renderer; W.handle = () => handle; W.camera = cam; W.setTier = (t2) => upgrade(t2); W.detail = () => detail;
  renderer.setAnimationLoop(frame);
  W.ready = true; document.body.dataset.ready = '1';
}
main().catch((e) => { W.errors.push(String((e && e.message) || e).slice(0, 200)); console.error(e); $('msg').classList.add('on'); $('sub').textContent = ''; });
