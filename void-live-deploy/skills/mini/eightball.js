/**
 * eightball miniature — a Magic 8 Ball: glossy black ball, the white "8" circle on its back, and on the side facing you a
 * dark window where the answer floats up on the blue triangle. A new answer (data.n changes) shakes the ball, the
 * triangle sinks into the ink and rises with the new words. Tap it to shake (data.onShake). Built from code.
 * data: { answer: 'Signs point to yes', n: <shake count>, onShake() }
 */
const R = 0.05;
export default async function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const ball = new THREE.Group(); root.add(ball);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 }));
  shell.castShadow = true; shell.userData.ball = true; ball.add(shell);
  // the "8" on the back: a white circle with a black 8, laid on the sphere as a slightly larger cap
  const eightC = document.createElement('canvas'); eightC.width = eightC.height = 256;
  const e = eightC.getContext('2d'); e.fillStyle = '#f7f5ef'; e.beginPath(); e.arc(128, 128, 120, 0, Math.PI * 2); e.fill();
  e.fillStyle = '#0b0b0d'; e.font = 'bold 190px Georgia, serif'; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillText('8', 128, 140);
  const eightTex = new THREE.CanvasTexture(eightC); eightTex.colorSpace = THREE.SRGBColorSpace;
  const capGeo = new THREE.SphereGeometry(R * 1.002, 64, 16, 0, Math.PI * 2, 0, 0.62);
  // project the 8 straight down onto the cap
  const uv = capGeo.attributes.uv, p = capGeo.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (R * 1.16), 0.5 - p.getZ(i) / (R * 1.16));
  const cap = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({ map: eightTex, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
  cap.rotation.x = Math.PI / 2; ball.add(cap); // faces +z: away from you
  // the window facing you (-z): a curved cap like the 8's, painted dark blue with the answer triangle floating in it
  const winC = document.createElement('canvas'); winC.width = winC.height = 512;
  const winTex = new THREE.CanvasTexture(winC); winTex.colorSpace = THREE.SRGBColorSpace;
  const winGeo = new THREE.SphereGeometry(R * 1.002, 64, 16, 0, Math.PI * 2, 0, 0.56);
  const wuv = winGeo.attributes.uv, wp = winGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) wuv.setXY(i, 0.5 - wp.getX(i) / (R * 1.06), 0.5 + wp.getZ(i) / (R * 1.06)); // seen from the front, so mirror u
  const win = new THREE.Mesh(winGeo, new THREE.MeshPhysicalMaterial({ map: winTex, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }));
  win.rotation.x = -Math.PI / 2; win.userData.ball = true; ball.add(win); // faces -z: toward you
  let text = '', alpha = 0;
  function paintWindow() {
    const g = winC.getContext('2d'), c = 256;
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, 512, 512);
    const ink = g.createRadialGradient(c, c * 0.9, 10, c, c, 250); ink.addColorStop(0, '#16307a'); ink.addColorStop(1, '#040b24');
    g.fillStyle = ink; g.beginPath(); g.arc(c, c, 236, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1b1b20'; g.lineWidth = 14; g.stroke();
    g.globalAlpha = alpha;
    g.fillStyle = '#2346c9'; g.beginPath(); g.moveTo(c, 430); g.lineTo(c - 190, 110); g.lineTo(c + 190, 110); g.closePath(); g.fill();
    g.fillStyle = '#e8f0ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = String(text).toUpperCase().split(/\s+/), lines = [];
    for (const w of words) { const l = lines[lines.length - 1]; if (l && (l + ' ' + w).length <= 10) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); }
    const size = lines.length > 3 ? 34 : 42; g.font = `bold ${size}px 'Helvetica Neue', Arial, sans-serif`;
    const shown4 = lines.slice(0, 4);
    shown4.forEach((l, i) => g.fillText(l, c, 210 + (i - (shown4.length - 1) / 2) * size * 1.12));
    g.globalAlpha = 1; winTex.needsUpdate = true;
  }
  function paintTriangle(t) { text = t; paintWindow(); }
  let shown = null, n = data.n, t = 0, phase = 'rise';
  paintTriangle(data.answer); shown = data.answer;
  ctx.onTap((hits) => { if (hits.some((h) => h.object.userData.ball) && ctx.handle.data.onShake) ctx.handle.data.onShake(); });
  ctx.addContactShadow({ y: 0, size: R * 6, opacity: 0.75, blur: 3, darkness: 1, exclude: [] });
  ball.position.y = R;
  ctx.frame(ball, { view: [0, 0.25, -1], pad: 0.78, ground: 'none', minZoom: 0.6, maxZoom: 2.2, light: [-0.6, 1.2, -0.9] });
  return {
    update(d) {
      if (d.n !== n) { n = d.n; phase = 'shake'; t = 0; }
      ctx.requestRender();
    },
    tick(dt) {
      t += dt;
      if (phase === 'shake') { // a few hard wobbles; the old answer sinks into the ink
        const k = Math.min(1, t / 0.7);
        ball.rotation.z = still ? 0 : Math.sin(t * 38) * 0.22 * (1 - k); ball.rotation.x = still ? 0 : Math.cos(t * 31) * 0.14 * (1 - k);
        alpha = Math.max(0, 1 - t * 3); paintWindow();
        if (k >= 1) { phase = 'rise'; t = 0; paintTriangle(ctx.handle.data.answer); shown = ctx.handle.data.answer; }
        return true;
      }
      if (phase === 'rise') { // the triangle floats up out of the dark
        alpha = Math.min(1, t / 0.9); paintWindow();
        if (t >= 0.9) phase = 'rest';
        return true;
      }
      return false;
    },
    state() { return { answer: shown, opacity: alpha, phase }; },
    dispose() { for (const o of [shell, cap, win]) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } },
  };
}
