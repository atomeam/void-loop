/**
 * stopwatch miniature — a chrome mechanical stopwatch lying on the desk (enamel dial with a fifth-second track, red sweep
 * hand, 30-minute register, crown with a bow, reset pusher). It runs with the card: tap the crown (or the watch) to
 * start and stop, the pusher to reset; the crown dips when pressed.
 * data: { read: () => ({ ms, running }), press?: () => void, reset?: () => void }
 */
const R = 0.025; // a 55 mm watch
function dialTexture(THREE) {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), cx = N / 2, r = N / 2;
  const grad = g.createRadialGradient(cx, cx * 0.85, r * 0.1, cx, cx, r); grad.addColorStop(0, '#fdfcf8'); grad.addColorStop(1, '#e9e6dc');
  g.fillStyle = grad; g.fillRect(0, 0, N, N); g.translate(cx, cx);
  for (let i = 0; i < 300; i++) { // fifth-second ticks
    const big = i % 25 === 0, mid = i % 5 === 0; g.save(); g.rotate(i / 300 * Math.PI * 2); g.fillStyle = '#16161a';
    g.fillRect(big ? -3.5 : mid ? -2 : -0.9, -r * 0.95, big ? 7 : mid ? 4 : 1.8, r * (big ? 0.09 : mid ? 0.06 : 0.035)); g.restore();
  }
  g.fillStyle = '#16161a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 ' + Math.round(r * 0.12) + 'px "Helvetica Neue", Arial, sans-serif';
  for (let i = 5; i <= 60; i += 5) { const a = i / 60 * Math.PI * 2; g.fillText(String(i), Math.sin(a) * r * 0.74, -Math.cos(a) * r * 0.74); }
  // 30-minute register at 12
  g.save(); g.translate(0, -r * 0.42); g.strokeStyle = '#2a2a30'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.24, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 30; i++) { g.save(); g.rotate(i / 30 * Math.PI * 2); g.fillStyle = '#2a2a30'; g.fillRect(i % 5 ? -0.8 : -2, -r * 0.24, i % 5 ? 1.6 : 4, r * (i % 5 ? 0.025 : 0.045)); g.restore(); }
  g.font = '600 ' + Math.round(r * 0.055) + 'px Arial, sans-serif'; for (const m of [5, 10, 15, 20, 25, 30]) { const a = m / 30 * Math.PI * 2; g.fillText(String(m), Math.sin(a) * r * 0.165, -Math.cos(a) * r * 0.165); }
  g.restore();
  g.font = 'italic ' + Math.round(r * 0.07) + 'px Georgia, serif'; g.fillStyle = '#44444c'; g.fillText('Void', 0, r * 0.28);
  g.font = '600 ' + Math.round(r * 0.045) + 'px Arial, sans-serif'; g.fillText('1/5 SECOND', 0, r * 0.4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export default function build(ctx, data) {
  const { THREE, root } = ctx;
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#e6e8ec', metalness: 1, roughness: 0.12, clearcoat: 0.3 });
  const satin = new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 1, roughness: 0.38 });
  const steel = new THREE.MeshStandardMaterial({ color: '#1a1a1e', metalness: 0.7, roughness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: '#c0261d', metalness: 0.2, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transparent: true, opacity: 0.14, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false });
  const dialMat = new THREE.MeshPhysicalMaterial({ map: dialTexture(THREE), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const geos = [], mats = [chrome, satin, steel, red, glass, dialMat], G = (g) => (geos.push(g), g);
  const w = new THREE.Group(); // built facing +z, then laid face-up on the desk
  const caseM = new THREE.Mesh(G(new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.012, 96, 1, true).rotateX(Math.PI / 2)), chrome); caseM.position.z = -0.003;
  const back = new THREE.Mesh(G(new THREE.SphereGeometry(R * 1.12, 64, 12, 0, Math.PI * 2, 0, 0.55).rotateX(-Math.PI / 2).scale(1, 1, 0.3)), satin); back.position.z = -0.009;
  const bezel = new THREE.Mesh(G(new THREE.TorusGeometry(R * 1.08, 0.0026, 20, 128)), chrome); bezel.position.z = 0.003;
  const dial = new THREE.Mesh(G(new THREE.CircleGeometry(R, 96)), dialMat); dial.position.z = 0.0012;
  const dome = new THREE.Mesh(G(new THREE.SphereGeometry(R * 1.7, 64, 12, 0, Math.PI * 2, 0, 0.62).rotateX(Math.PI / 2)), glass);
  dome.position.z = 0.0035 - R * 1.7 * Math.cos(0.62); dome.renderOrder = 3;
  // crown at 12 with its stem and bow, reset pusher at 2 o'clock
  const stem = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0022, 0.0022, 0.006, 20)), satin); stem.position.set(0, R * 1.2, -0.003);
  const crown = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 32)), chrome); crown.position.set(0, R * 1.36, -0.003); crown.name = 'crown';
  const knurl = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0044, 0.0044, 0.0024, 32, 1, true)), satin); crown.add(knurl);
  const bow = new THREE.Mesh(G(new THREE.TorusGeometry(0.0075, 0.0011, 12, 48, Math.PI * 1.25).rotateZ(-Math.PI * 0.125)), chrome); bow.position.set(0, R * 1.36 + 0.004, -0.003);
  const pusher = new THREE.Group(); pusher.rotation.z = -Math.PI / 3;
  const pStem = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0016, 0.0016, 0.005, 16)), satin); pStem.position.set(0, R * 1.18, -0.003);
  const pCap = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0026, 0.0026, 0.003, 24)), chrome); pCap.position.set(0, R * 1.29, -0.003); pCap.name = 'pusher';
  pusher.add(pStem, pCap);
  // hands
  const secShape = new THREE.Shape(); secShape.moveTo(-0.0006, -0.007); secShape.lineTo(0.0006, -0.007); secShape.lineTo(0.00025, R * 0.93); secShape.lineTo(-0.00025, R * 0.93); secShape.closePath();
  const sec = new THREE.Mesh(G(new THREE.ExtrudeGeometry(secShape, { depth: 0.0003, bevelEnabled: false })), red); sec.position.z = 0.0022;
  const tail = new THREE.Mesh(G(new THREE.CircleGeometry(0.0016, 20)), red); tail.position.set(0, -0.0055, 0.0003); sec.add(tail);
  const minShape = new THREE.Shape(); minShape.moveTo(-0.0005, -0.001); minShape.lineTo(0.0005, -0.001); minShape.lineTo(0.0002, R * 0.22); minShape.lineTo(-0.0002, R * 0.22); minShape.closePath();
  const min = new THREE.Mesh(G(new THREE.ExtrudeGeometry(minShape, { depth: 0.0003, bevelEnabled: false })), steel); min.position.set(0, R * 0.42, 0.0016);
  const cap = new THREE.Mesh(G(new THREE.SphereGeometry(0.0015, 16, 10)), chrome); cap.scale.z = 0.5; cap.position.z = 0.0027;
  const cap2 = new THREE.Mesh(G(new THREE.CircleGeometry(0.0009, 16)), steel); cap2.position.set(0, R * 0.42, 0.002);
  for (const m of [caseM, back, bezel, stem, crown, bow, pStem, pCap, sec, min, cap]) { m.castShadow = true; m.receiveShadow = true; }
  dial.receiveShadow = true;
  w.add(caseM, back, bezel, dial, dome, stem, crown, bow, pusher, sec, min, cap, cap2);
  w.rotation.x = -Math.PI / 2; w.rotation.z = 0.35; w.position.y = 0.012;
  root.add(w);
  ctx.frame(root, { view: [0.18, 1, 0.62], pad: 0.72, light: [0.5, 1.3, 0.6], minZoom: 0.55, maxZoom: 2 });
  let d = data || {}, press = 0, pressWhich = null, lastMs = -1;
  const read = () => { try { const r = d.read ? d.read() : d; return { ms: +r.ms || 0, running: !!r.running }; } catch (_) { return { ms: 0, running: false }; } };
  function setHands(ms) {
    const s = ms / 1000, s60 = s % 60; sec.rotation.z = -(ctx.still ? Math.floor(s60 * 5) / 5 : s60) / 60 * Math.PI * 2;
    min.rotation.z = -((s / 60) % 30) / 30 * Math.PI * 2; lastMs = ms;
  }
  setHands(read().ms);
  ctx.onTap((hits) => {
    const o = hits && hits[0] && hits[0].object; const which = o && (o === pCap || o === pStem) ? 'reset' : 'press';
    pressWhich = which; press = 1;
    if (which === 'reset') { if (d.reset) d.reset(); } else if (d.press) d.press();
    ctx.requestRender();
  });
  return {
    update(nd) { d = nd || {}; setHands(read().ms); },
    state: () => ({ second: -sec.rotation.z, minute: -min.rotation.z, ms: lastMs }), // for tests
    tick(dt) {
      let moved = false;
      if (press > 0) { press = Math.max(0, press - dt * 6); const k = Math.sin(press * Math.PI) * 0.0016; crown.position.y = R * 1.36 - (pressWhich === 'press' ? k : 0); bow.position.y = crown.position.y + 0.004; pCap.position.y = R * 1.29 - (pressWhich === 'reset' ? k : 0); moved = true; }
      const r = read();
      if (r.ms !== lastMs) { setHands(r.ms); moved = true; }
      return moved ? 'view' : false;
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); dialMat.map.dispose(); },
  };
}
