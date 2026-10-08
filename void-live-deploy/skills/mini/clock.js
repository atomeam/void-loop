/**
 * clock miniature — a brass desk clock (enamel dial, blued-steel hands, domed glass, ball feet, carry ring) that keeps
 * real time in the asked time zone with a smoothly sweeping second hand.
 * data: { clocks: [{ tz: 'Asia/Tokyo', label: 'Tokyo' }, ...] (1 to 4), at?: epoch ms (a fixed moment: the hands stop
 *         there, for "3pm London in Tokyo") }
 */
const DIAL_R = 0.042; // a 10 cm clock
function offsetMs(tz, at) { // the zone's wall clock minus UTC at this moment
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(at)).filter((x) => x.type !== 'literal').map((x) => [x.type, +x.value]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(at / 1000) * 1000;
  } catch (_) { return -new Date(at).getTimezoneOffset() * 60000; }
}
function dialTexture(THREE, label) {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  const cx = N / 2, R = N / 2;
  const grad = g.createRadialGradient(cx, cx * 0.9, R * 0.1, cx, cx, R); grad.addColorStop(0, '#fbf6ea'); grad.addColorStop(0.85, '#f1e8d4'); grad.addColorStop(1, '#ddcfb2');
  g.fillStyle = grad; g.fillRect(0, 0, N, N);
  g.translate(cx, cx);
  g.strokeStyle = '#2a2420'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R * 0.9, 0, Math.PI * 2); g.stroke(); // chapter ring
  g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R * 0.83, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) { // minute track
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0; g.save(); g.rotate(a);
    g.fillStyle = '#231d19'; if (big) g.fillRect(-5, -R * 0.9, 10, R * 0.07); else g.fillRect(-1.6, -R * 0.9, 3.2, R * 0.05);
    g.restore();
  }
  g.fillStyle = '#1f1a16'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 ' + Math.round(R * 0.19) + 'px Georgia, "Times New Roman", serif';
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillText(String(i), Math.sin(a) * R * 0.68, -Math.cos(a) * R * 0.68 + R * 0.012); }
  g.font = 'italic ' + Math.round(R * 0.075) + 'px Georgia, serif'; g.fillStyle = '#5a4a3a'; g.fillText('Void', 0, -R * 0.33);
  if (label) { g.font = '600 ' + Math.round(R * 0.072) + 'px Georgia, serif'; g.fillStyle = '#3b3028'; g.fillText(String(label).toUpperCase().slice(0, 18), 0, R * 0.36); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function handShape(THREE, len, w, tail, kind) {
  const s = new THREE.Shape();
  if (kind === 'second') { s.moveTo(-w / 2, -tail); s.lineTo(w / 2, -tail); s.lineTo(w * 0.3, len); s.lineTo(-w * 0.3, len); s.closePath();
    const disc = new THREE.Path(); s.holes = []; return s; }
  // a spade hand: a slim shaft that swells to a leaf near the tip
  s.moveTo(-w * 0.28, -tail); s.lineTo(w * 0.28, -tail); s.lineTo(w * 0.22, len * 0.62);
  s.quadraticCurveTo(w * 0.9, len * 0.74, w * 0.08, len); s.lineTo(-w * 0.08, len); s.quadraticCurveTo(-w * 0.9, len * 0.74, -w * 0.22, len * 0.62); s.closePath();
  return s;
}
export default function build(ctx, data) {
  const { THREE, root } = ctx;
  const brass = new THREE.MeshPhysicalMaterial({ color: '#d0a85a', metalness: 1, roughness: 0.24, clearcoat: 0.4, clearcoatRoughness: 0.15 });
  const darkBrass = new THREE.MeshStandardMaterial({ color: '#8a6a32', metalness: 1, roughness: 0.4 });
  const blued = new THREE.MeshPhysicalMaterial({ color: '#1d2a4a', metalness: 0.9, roughness: 0.25, clearcoat: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: '#a8231c', metalness: 0.3, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false });
  const geos = [], mats = [brass, darkBrass, blued, red, glass], texs = [];
  const G = (g) => (geos.push(g), g);
  const clocks = [];
  function makeClock(label) {
    const grp = new THREE.Group();
    const dialMat = new THREE.MeshPhysicalMaterial({ map: dialTexture(THREE, label), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }); mats.push(dialMat); texs.push(dialMat.map);
    // case: a turned drum with a rolled bezel at the front and a domed back
    const drum = new THREE.Mesh(G(new THREE.CylinderGeometry(DIAL_R * 1.1, DIAL_R * 1.1, 0.028, 96, 1, true).rotateX(Math.PI / 2)), brass); drum.position.z = -0.006;
    const back = new THREE.Mesh(G(new THREE.SphereGeometry(DIAL_R * 1.1, 64, 16, 0, Math.PI * 2, 0, 0.5).rotateX(-Math.PI / 2).scale(1, 1, 0.35)), darkBrass); back.position.z = -0.02;
    const bezel = new THREE.Mesh(G(new THREE.TorusGeometry(DIAL_R * 1.06, 0.0042, 24, 128)), brass); bezel.position.z = 0.008;
    const dial = new THREE.Mesh(G(new THREE.CircleGeometry(DIAL_R, 96)), dialMat); dial.position.z = 0.004;
    const dome = new THREE.Mesh(G(new THREE.SphereGeometry(DIAL_R * 1.6, 64, 16, 0, Math.PI * 2, 0, 0.68).rotateX(Math.PI / 2)), glass);
    dome.position.z = 0.009 - DIAL_R * 1.6 * Math.cos(0.68); dome.castShadow = false; dome.renderOrder = 3;
    // feet, carry ring and the winding crown on top
    const footG = G(new THREE.SphereGeometry(0.0055, 24, 16)), legG = G(new THREE.CylinderGeometry(0.0022, 0.0028, 0.012, 16));
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(legG, brass); leg.position.set(sx * DIAL_R * 0.62, -DIAL_R * 1.02, -0.008); leg.rotation.z = sx * 0.45; grp.add(leg);
      const foot = new THREE.Mesh(footG, brass); foot.position.set(sx * DIAL_R * 0.72, -DIAL_R * 1.16, -0.008); grp.add(foot);
    }
    const ring = new THREE.Mesh(G(new THREE.TorusGeometry(0.011, 0.0018, 16, 48)), brass); ring.position.set(0, DIAL_R * 1.32, -0.008);
    const crown = new THREE.Mesh(G(new THREE.CylinderGeometry(0.004, 0.004, 0.006, 24)), darkBrass); crown.position.set(0, DIAL_R * 1.13, -0.008);
    // hands (z-stacked over the dial, under the glass)
    const hourM = new THREE.Mesh(G(new THREE.ExtrudeGeometry(handShape(THREE, DIAL_R * 0.52, 0.0068, 0.006), { depth: 0.0006, bevelEnabled: false })), blued);
    const minM = new THREE.Mesh(G(new THREE.ExtrudeGeometry(handShape(THREE, DIAL_R * 0.8, 0.0052, 0.008), { depth: 0.0006, bevelEnabled: false })), blued);
    const secM = new THREE.Mesh(G(new THREE.ExtrudeGeometry(handShape(THREE, DIAL_R * 0.86, 0.0012, 0.012, 'second'), { depth: 0.0004, bevelEnabled: false })), red);
    const counter = new THREE.Mesh(G(new THREE.CircleGeometry(0.0022, 24)), red); counter.position.set(0, -0.009, 0.0005); secM.add(counter);
    hourM.position.z = 0.0046; minM.position.z = 0.0054; secM.position.z = 0.0062;
    const cap = new THREE.Mesh(G(new THREE.SphereGeometry(0.0022, 16, 12)), brass); cap.position.z = 0.0068; cap.scale.z = 0.5;
    for (const m of [drum, back, bezel, ring, crown, hourM, minM, secM, cap]) { m.castShadow = true; m.receiveShadow = true; }
    dial.receiveShadow = true;
    grp.add(drum, back, bezel, dial, dome, ring, crown, hourM, minM, secM, cap);
    return { grp, hourM, minM, secM, tz: null, off: 0, offAt: 0 };
  }
  let list = [], at = null;
  function layout(d) {
    const want = (d.clocks && d.clocks.length ? d.clocks : [{ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, label: '' }]).slice(0, 4);
    const key = want.map((c) => c.tz + '|' + (c.label || '')).join(',');
    if (key !== list.key) {
      for (const c of clocks.splice(0)) root.remove(c.grp);
      want.forEach((w, i) => { const c = makeClock(w.label); c.tz = w.tz; c.grp.position.x = (i - (want.length - 1) / 2) * DIAL_R * 2.7; c.grp.position.y = DIAL_R * 1.21; root.add(c.grp); clocks.push(c); });
      list = want; list.key = key;
      ctx.frame(root, { view: want.length > 1 ? [0.12, 0.18, 1] : [0.32, 0.2, 1], pad: want.length > 1 ? 0.74 : 0.8, light: [0.5, 1.1, 0.9], minZoom: 0.5, maxZoom: 2 });
    }
    at = d.at || null;
  }
  let lastSec = -1;
  function setHands(now) {
    for (const c of clocks) {
      if (!c.offAt || Math.abs(now - c.offAt) > 60000) { c.off = offsetMs(c.tz, now); c.offAt = now; }
      const wall = (now + c.off) % 86400000, s = (wall % 60000) / 1000, m = (wall % 3600000) / 60000, hr = (wall % 43200000) / 3600000;
      c.secM.rotation.z = -(ctx.still ? Math.floor(s) : s) / 60 * Math.PI * 2;
      c.minM.rotation.z = -m / 60 * Math.PI * 2; c.hourM.rotation.z = -hr / 12 * Math.PI * 2;
    }
  }
  layout(data); setHands(at || Date.now());
  return {
    update(d) { layout(d); setHands(at || Date.now()); },
    state: () => clocks.map((c) => ({ tz: c.tz, hour: -c.hourM.rotation.z, minute: -c.minM.rotation.z, second: -c.secM.rotation.z })), // for tests: hand angles, radians clockwise from 12
    tick() {
      if (at) return false; // a fixed moment does not move
      const now = Date.now();
      if (ctx.still) { const sec = Math.floor(now / 1000); if (sec === lastSec) return false; lastSec = sec; } // tick once a second, no sweep
      setHands(now); return 'view';
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const t of texs) t.dispose(); },
  };
}
