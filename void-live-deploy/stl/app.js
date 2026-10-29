// a-to-mind.com/stl/: the page. The check is lib/stl-check.js (pure); this file reads the file, draws the report and the 3D view, and
// hands the report on (copy, .txt, .json, a mended copy). Nothing leaves the device: a file is read with FileReader-style arrayBuffer(),
// and the only fetches are this site's own (?src= a same-origin STL path, ?forge= a forge recipe made here, three.js from /vendor/).
import { parseStl, analyze, mend, binaryStl, sample, reportText, reportJson, DEFAULT_TOL } from '/lib/stl-check.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 2) => (Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('en') : String(+(+x).toFixed(d)));
let cur = null; // { parsed, report, file, link }
let view = null; // the 3D view in use: { dispose() }

const say = (t) => { $('status').textContent = t; };
const tolNow = () => { const v = parseFloat($('tol').value); return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_TOL; };

/** read bytes, check them, show it. link: the query that brings this file back, or '' for a file only this device has */
async function run(bytes, file, link = '') {
  say('Reading ' + file + ' on this device.');
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); // the status paints before a big file is worked on
  const t0 = performance.now(), parsed = parseStl(bytes);
  if (!parsed.count) { cur = null; $('out').hidden = true; say(file + ': ' + (parsed.problems[0] || 'no facets found') + '.'); return; }
  say('Checking ' + parsed.count.toLocaleString('en') + ' triangles.');
  await new Promise((r) => setTimeout(r, 0));
  const report = analyze(parsed, { tol: tolNow() });
  cur = { parsed, report, file, link };
  show(report, file);
  say('Checked ' + report.triangles.toLocaleString('en') + ' triangles in ' + Math.max(1, Math.round(performance.now() - t0)).toLocaleString('en') + ' ms, on this device.');
  draw3d(report).catch(() => {});
}

function show(r, file) {
  $('out').hidden = false;
  const v = $('verdict'); v.textContent = r.verdict; v.className = r.ok ? 'ok' : r.watertight ? 'warn' : 'bad';
  $('fname').textContent = file + ' · ' + (r.format === 'ascii' ? 'ASCII' : 'binary') + ' STL' + (r.name ? ' · "' + r.name.slice(0, 80) + '"' : '');
  const rows = [
    ['Watertight', r.watertight ? 'yes' : 'no', r.watertight ? 'good' : 'bad'],
    ['Triangles', r.triangles.toLocaleString('en')],
    ['Vertices (welded)', r.vertices.toLocaleString('en')],
    ['Duplicate vertices merged', r.dupVertices.toLocaleString('en')],
    ['Size (mm)', r.size.map((x) => fmt(x)).join(' × ')],
    ['Volume', fmt(r.volume / 1000, 3) + ' cm³' + (r.volumeExact ? '' : ' (approx.)')],
    ['Surface area', fmt(r.area / 100, 2) + ' cm²'],
    ['Open edges', r.openEdges.toLocaleString('en') + (r.holes ? ' (' + r.holes + ' hole' + (r.holes === 1 ? '' : 's') + ')' : ''), r.openEdges ? 'bad' : 'good'],
    ['Non-manifold edges', r.nonManifoldEdges.toLocaleString('en'), r.nonManifoldEdges ? 'bad' : 'good'],
    ['Flipped faces (normals)', r.flippedFaces.toLocaleString('en'), r.flippedFaces ? 'bad' : 'good'],
    ['Inside-out shells', r.insideOutShells.toLocaleString('en'), r.insideOutShells ? 'bad' : 'good'],
    ['Degenerate faces', r.degenerate.toLocaleString('en'), r.degenerate ? 'warn' : 'good'],
    ['Duplicate faces', r.duplicates.toLocaleString('en'), r.duplicates ? 'warn' : 'good'],
    ['Shells', r.shells.toLocaleString('en')],
    ['Self-intersections', r.selfChecked ? r.selfIntersections.toLocaleString('en') : 'not checked (too many faces)', r.selfIntersections ? 'bad' : r.selfChecked ? 'good' : 'warn'],
  ];
  const dl = $('stats'); dl.textContent = '';
  for (const [k, val, cls] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = val; if (cls) dd.className = cls; dl.append(dt, dd); }
  const ul = $('where'); ul.textContent = '';
  for (const w of r.where) { const li = document.createElement('li'); li.textContent = 'Hole near x ' + fmt(w.at[0], 1) + ', y ' + fmt(w.at[1], 1) + ', z ' + fmt(w.at[2], 1) + ' mm (' + w.edges + ' open edges)'; ul.appendChild(li); }
  $('notes').textContent = [r.unitsHint ? 'Units: ' + r.unitsHint + '.' : '', ...r.problems.map((p) => 'File: ' + p + '.')].filter(Boolean).join(' ');
  $('dlMend').hidden = r.ok;
  for (const s of $('legend').querySelectorAll('[data-k]')) { const k = s.dataset.k, n = { open: r.openEdges, nm: r.nonManifoldEdges, flip: r.flippedFaces, cross: r.selfIntersections || 0 }[k]; s.className = n ? '' : 'hide'; }
}

// ---- the 3D view: three.js from /vendor/ when WebGL is there; a flat drawing on a 2D canvas when it is not ----
const COL = { body: 0x8f9bd8, open: 0xff4d6d, nm: 0xffa53b, flip: 0xd77bff, cross: 0xffe14d };
async function draw3d(r) {
  if (view) { view.dispose(); view = null; }
  const host = $('view'); host.textContent = '';
  try { view = await webgl(host, r); } catch (_) { view = flat(host, r); }
}

async function webgl(host, r) {
  const THREE = await import('/vendor/three-r180a/build/three.module.min.js'), { OrbitControls } = await import('/vendor/three-r180a/addons/OrbitControls.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // throws when the device has no WebGL: the flat view takes over
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.appendChild(renderer.domElement);
  const { positions: P, indices: I } = r.mesh, c = [0, 1, 2].map((a) => (r.min[a] + r.max[a]) / 2), rad = Math.max(Math.hypot(...r.size) / 2, 1e-3);
  const pos = new Float32Array(P.length); for (let i = 0; i < P.length; i++) pos[i] = P[i] - c[i % 3];
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, rad / 100, rad * 50); cam.up.set(0, 0, 1);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(I, 1));
  // the outside of each face in the body colour, its inside dark red: a hole shows as a dark gap, an inside-out part shows dark all over (as slicers draw it)
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL.body, roughness: 0.55, metalness: 0.08, flatShading: true, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x5a1f33, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  const faces = (list, color) => { if (!list.length) return; const idx = new Uint32Array(list.length * 3); list.forEach((f, i) => { idx[i * 3] = I[f * 3]; idx[i * 3 + 1] = I[f * 3 + 1]; idx[i * 3 + 2] = I[f * 3 + 2]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.getAttribute('position')); g.setIndex(new THREE.BufferAttribute(idx, 1));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }))); };
  faces(r.mesh.flippedFaces, COL.flip); faces(r.mesh.crossingFaces, COL.cross);
  const edges = (pairs, color) => { if (!pairs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.getAttribute('position')); g.setIndex(new THREE.BufferAttribute(pairs, 1));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })); l.renderOrder = 2; scene.add(l);
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 7, sizeAttenuation: false, depthTest: false, transparent: true })); pts.renderOrder = 3; scene.add(pts); };
  edges(r.mesh.openEdges, COL.open); edges(r.mesh.nonManifoldEdges, COL.nm);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1d2e, 1.4)); const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1, -1.2, 1.6); cam.add(key); scene.add(cam);
  const d = (rad / Math.sin((35 / 2) * Math.PI / 180)) * 1.25 / Math.hypot(1.9, 2.4, 1.7); cam.position.set(d * 1.9, -d * 2.4, d * 1.7); // the whole part in view with a margin cam.lookAt(0, 0, 0);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.enableDamping = false;
  const render = () => renderer.render(scene, cam);
  const fit = () => { const w = host.clientWidth || 300, h = host.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); render(); };
  ctl.addEventListener('change', render); const ro = new ResizeObserver(fit); ro.observe(host); fit();
  host.dataset.rendered = 'webgl';
  return { dispose() { ro.disconnect(); ctl.dispose(); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); renderer.dispose(); renderer.domElement.remove(); } };
}

/** the flat view: faces shaded and drawn back to front (up to 80,000 of them), the problems on top; drag to turn it */
function flat(host, r) {
  const cv = document.createElement('canvas'); host.appendChild(cv); const g = cv.getContext('2d');
  const { positions: P, indices: I } = r.mesh, c = [0, 1, 2].map((a) => (r.min[a] + r.max[a]) / 2), rad = Math.max(Math.hypot(...r.size) / 2, 1e-3), F = I.length / 3, step = Math.max(1, Math.ceil(F / 80000));
  let yaw = -0.7, pitch = 0.55;
  const paint = () => {
    const W = (cv.width = (host.clientWidth || 300) * 2), H = (cv.height = (host.clientHeight || 300) * 2), s = Math.min(W, H) / (rad * 2.3), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const pr = (i) => { const x = P[i * 3] - c[0], y = P[i * 3 + 1] - c[1], z = P[i * 3 + 2] - c[2], rx = x * cy - y * sy, ry = x * sy + y * cy; return [W / 2 + rx * s, H / 2 - (z * cp - ry * sp) * s, z * sp + ry * cp]; };
    const tris = []; for (let f = 0; f < F; f += step) { const a = pr(I[f * 3]), b = pr(I[f * 3 + 1]), d = pr(I[f * 3 + 2]); tris.push([a[2] + b[2] + d[2], a, b, d]); }
    tris.sort((u, v) => v[0] - u[0]); g.clearRect(0, 0, W, H);
    for (const [, a, b, d] of tris) { const nz = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])), l = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(d[0] - a[0], d[1] - a[1]) || 1, k = Math.round(70 + 120 * Math.min(1, nz / l));
      g.fillStyle = 'rgb(' + k + ',' + (k + 8) + ',' + Math.min(255, k + 60) + ')'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); }
    const line = (pairs, col) => { g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); for (let e = 0; e < pairs.length; e += 2) { const a = pr(pairs[e]), b = pr(pairs[e + 1]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); };
    line(r.mesh.openEdges, '#ff4d6d'); line(r.mesh.nonManifoldEdges, '#ffa53b');
  };
  let drag = null; cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; yaw += (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - drag[1]) * 0.01)); drag = [e.clientX, e.clientY]; paint(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  const ro = new ResizeObserver(paint); ro.observe(host); paint(); host.dataset.rendered = 'flat';
  return { dispose() { ro.disconnect(); cv.remove(); } };
}

// ---- reading files and links ----
const base = (n) => String(n || 'mesh').replace(/\.stl$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'mesh';
function save(data, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function fromFile(f) { if (!f) return; if (f.size > 1.5e9) { say(f.name + ' is too big to read in a browser.'); return; } run(new Uint8Array(await f.arrayBuffer()), f.name, ''); }

$('file').addEventListener('change', (e) => { fromFile(e.target.files && e.target.files[0]); e.target.value = ''; });
const drop = $('drop');
for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('over'); });
document.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) fromFile(f); });
const samples = { sCube: ['cube', 'sample-cube.stl'], sHole: ['hole', 'sample-cube-with-hole.stl'], sFlip: ['flipped', 'sample-cube-flipped-face.stl'] };
for (const [id, [kind, name]] of Object.entries(samples)) $(id).addEventListener('click', () => run(sample(kind), name, '?sample=' + kind));
$('tol').addEventListener('change', () => { // the same file again at the new weld distance
  if (!cur) return; const report = analyze(cur.parsed, { tol: tolNow() }); cur.report = report; show(report, cur.file); draw3d(report).catch(() => {}); say('Checked again, welding within ' + report.tol + ' mm.');
});

$('copy').addEventListener('click', async () => { if (!cur) return; const t = reportText(cur.report, cur.file); try { await navigator.clipboard.writeText(t); say('Report copied.'); } catch (_) { say('Could not copy here: use Download report.'); } });
$('dlTxt').addEventListener('click', () => { if (cur) save(reportText(cur.report, cur.file), base(cur.file) + '-check.txt', 'text/plain'); });
$('dlJson').addEventListener('click', () => { if (cur) save(JSON.stringify(reportJson(cur.report, cur.file), null, 2) + '\n', base(cur.file) + '-check.json', 'application/json'); });
$('dlMend').addEventListener('click', () => {
  if (!cur) return; const m = mend(cur.parsed, cur.report), after = analyze(m, { tol: tolNow() });
  save(binaryStl(m.tris, 'Mended by Verse (a-to-mind.com/stl/)'), base(cur.file) + '-mended.stl', 'model/stl');
  say('Mended copy saved: ' + (after.ok ? 'it checks watertight and ready.' : after.verdict.replace(/^Not watertight: |^Watertight, but not ready: /, 'still: ')));
});
$('link').addEventListener('click', async () => {
  const u = location.origin + location.pathname + (cur && cur.link ? cur.link : '');
  try { await navigator.clipboard.writeText(u); say(cur && !cur.link ? 'Link copied. A file from your device stays on your device, so the link opens the empty checker.' : 'Link copied.'); } catch (_) { say(u); }
});

// a link that carries a file: ?sample=hole, ?forge=vase (a forge recipe, made here exactly as the forge's "Print it" makes it), or ?src=/a/same-site/file.stl
const q = new URLSearchParams(location.search);
if (q.get('tol') && Number.isFinite(+q.get('tol'))) $('tol').value = String(Math.min(1, Math.max(0, +q.get('tol'))));
if (/^(cube|hole|flipped)$/.test(q.get('sample') || '')) run(sample(q.get('sample')), 'sample-' + q.get('sample') + '.stl', '?sample=' + q.get('sample'));
else if (/^[a-z][a-z0-9-]{0,30}$/.test(q.get('forge') || '')) {
  const key = q.get('forge');
  import('/skills/forge-rules.js').then((F) => { if (!F.THINGS[key]) { say('The forge has no recipe called ' + key + '.'); return; } const m = F.build(key); run(new Uint8Array(F.stl(m)), 'void-' + key + (F.recipeId(key) ? '-' + F.recipeId(key) : '') + '.stl', '?forge=' + key); })
    .catch(() => say('Could not load the forge here.'));
} else if (q.get('src')) {
  const s = q.get('src'); // this site's own files only: a path, never another site (the page fetches nothing from anywhere else)
  if (!/^\/(?!\/)[A-Za-z0-9/_.-]{1,200}\.stl$/i.test(s) || s.includes('..')) say('Only an .stl on this site can be opened by link; pick or drop your own file instead.');
  else fetch(s).then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(res.status))).then((b) => run(new Uint8Array(b), s.split('/').pop(), '?src=' + encodeURIComponent(s))).catch(() => say('Could not read ' + s + '.'));
}

mountRelated(document.getElementById('related'), '/stl/');
