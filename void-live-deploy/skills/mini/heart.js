/**
 * heart miniature — a glossy red heart on a walnut stand beating at the card's rate (a lub-dub double pulse), beside a
 * small bedside monitor whose green ECG trace and bpm read-out run in step with it.
 * data: { bpm: number (30 to 220) }
 */
function heartShape(THREE) { // the classic heart curve, 16 sin^3 t / 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t
  const s = new THREE.Shape(), k = 0.0019;
  for (let i = 0; i <= 96; i++) { const t = (i / 96) * Math.PI * 2, x = 16 * Math.sin(t) ** 3 * k, y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * k; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return s;
}
// one beat, phase 0..1: P wave, QRS spike, T wave (ECG) and the matching squeeze (lub at QRS, dub at T)
const ecg = (p) => 0.12 * Math.exp(-(((p - 0.1) / 0.025) ** 2)) - 0.15 * Math.exp(-(((p - 0.185) / 0.008) ** 2)) + 1 * Math.exp(-(((p - 0.2) / 0.01) ** 2)) - 0.25 * Math.exp(-(((p - 0.215) / 0.009) ** 2)) + 0.28 * Math.exp(-(((p - 0.42) / 0.05) ** 2));
const squeeze = (p) => 0.085 * Math.exp(-(((p - 0.21) / 0.035) ** 2)) + 0.05 * Math.exp(-(((p - 0.43) / 0.04) ** 2));
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const geos = [], mats = [], G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);
  const red = M(new THREE.MeshPhysicalMaterial({ color: '#940816', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.15, sheenColor: new THREE.Color('#ff6070') }));
  const walnut = M(new THREE.MeshPhysicalMaterial({ color: '#4a2c1a', roughness: 0.45, clearcoat: 0.5 }));
  const brass = M(new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 1, roughness: 0.3 }));
  const plastic = M(new THREE.MeshPhysicalMaterial({ color: '#e9ebee', roughness: 0.5, clearcoat: 0.2 }));
  const bezel = M(new THREE.MeshPhysicalMaterial({ color: '#15171a', roughness: 0.3, clearcoat: 0.8 }));
  // heart: the curve extruded with a deep rounded bevel, so it is puffy like a real ornament
  const hg = G(new THREE.ExtrudeGeometry(heartShape(THREE), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.011, bevelSize: 0.008, bevelSegments: 14, curveSegments: 96 }));
  hg.center(); const heart = new THREE.Mesh(hg, red); heart.castShadow = true;
  const hp = new THREE.Group(); hp.add(heart); hp.position.set(-0.03, 0.062, 0); hp.rotation.y = 0.35;
  const base = new THREE.Mesh(G(new THREE.CylinderGeometry(0.026, 0.03, 0.01, 64)), walnut); base.position.set(-0.03, 0.005, 0);
  const pin = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0016, 0.0016, 0.03, 16)), brass); pin.position.set(-0.03, 0.022, 0);
  for (const m of [base, pin]) { m.castShadow = m.receiveShadow = true; }
  // monitor: a small white case with a dark screen tilted back
  const mon = new THREE.Group();
  const box = new THREE.Mesh(G(new THREE.BoxGeometry(0.07, 0.05, 0.03)), plastic); box.position.y = 0.025; box.castShadow = box.receiveShadow = true;
  const scr = new THREE.Mesh(G(new THREE.BoxGeometry(0.06, 0.038, 0.002)), bezel); scr.position.set(0, 0.027, 0.0151);
  const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const glow = M(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const screen = new THREE.Mesh(G(new THREE.PlaneGeometry(0.056, 0.035)), glow); screen.position.set(0, 0.027, 0.0163);
  const knobG = G(new THREE.CylinderGeometry(0.003, 0.003, 0.003, 20).rotateX(Math.PI / 2)); for (const x of [0.026, 0.018]) { const k = new THREE.Mesh(knobG, bezel); k.position.set(x, 0.004, 0.0155); mon.add(k); }
  mon.add(box, scr, screen); mon.position.set(0.042, 0, 0.006); mon.rotation.y = -0.35;
  root.add(hp, base, pin, mon);
  let bpm = 70, phase = 0, trace = new Float32Array(160), head = 0, acc = 0;
  const setBpm = (d) => { bpm = Math.max(30, Math.min(220, Math.round(+((d || {}).bpm) || 70))); };
  setBpm(data);
  function drawScreen() {
    g.fillStyle = '#04110a'; g.fillRect(0, 0, 320, 200);
    g.strokeStyle = 'rgba(40,120,70,0.25)'; g.lineWidth = 1; for (let x = 0; x < 320; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 200); g.stroke(); } for (let y = 0; y < 200; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(320, y); g.stroke(); }
    g.strokeStyle = '#3dff8a'; g.lineWidth = 3; g.shadowColor = '#3dff8a'; g.shadowBlur = 6; g.beginPath();
    for (let i = 0; i < trace.length; i++) { const v = trace[(head + i) % trace.length], x = i * 2, y = 130 - v * 80; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.shadowBlur = 0;
    g.fillStyle = '#3dff8a'; g.font = '700 46px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'right'; g.fillText(String(bpm), 308, 48);
    g.font = '600 18px Arial, sans-serif'; g.fillText('BPM', 308, 70); g.textAlign = 'left'; g.fillText('\u2665 HR', 10, 26);
    tex.needsUpdate = true;
  }
  for (let i = 0; i < trace.length; i++) trace[i] = ecg((i / trace.length * 2.2) % 1);
  drawScreen();
  ctx.frame(root, { view: [0.25, 0.42, 1], pad: 0.8, light: [0.5, 1.2, 0.8], minZoom: 0.55, maxZoom: 2 });
  return {
    update(d) { setBpm(d); drawScreen(); },
    state: () => ({ bpm, scale: hp.scale.x, phase }), // for tests
    tick(dt) {
      if (still) return false; // reduced motion: a still heart and a still trace
      const per = 60 / bpm; phase = (phase + dt / per) % 1;
      const s = 1 + squeeze(phase); hp.scale.set(s, s, s);
      acc += dt; const sample = per / 70; // the sweep: one beat spans 70 samples (a trace shows a little over two beats)
      while (acc >= sample) { acc -= sample; trace[head] = ecg(phase) + (Math.random() - 0.5) * 0.02; head = (head + 1) % trace.length; }
      drawScreen(); return true;
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); tex.dispose(); },
  };
}
