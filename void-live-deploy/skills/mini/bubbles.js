/**
 * bubbles miniature: the translate card's 3D figure (owner, 2026-10-25: "should be a card for all too and 3d figure if possible"). Two speech
 * bubbles standing face to face: the words you asked in a white bubble on the left, the translation in a violet bubble on the right with the
 * language under it. A new translation swings the right bubble round once to show it; with reduced motion it lands at
 * once.
 * data: { from: text, to: text, lang?: 'Spanish' }. state(): { from, to, turning }.
 */
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const W = 0.07, H = 0.045, R = 0.01, D = 0.008; // 7 cm bubbles
  const outline = (tailLeft) => { // a rounded box with a tail at the bottom, toward the other bubble
    const s = new THREE.Shape(), x0 = -W / 2, y0 = 0, x1 = W / 2, y1 = H, tx = tailLeft ? x0 + 0.014 : x1 - 0.014;
    s.moveTo(x0 + R, y0);
    if (tailLeft) { s.lineTo(tx - 0.004, y0); s.lineTo(x0 + 0.002, y0 - 0.012); s.lineTo(tx + 0.006, y0); }
    s.lineTo(tailLeft ? x1 - R : tx - 0.006, y0); if (!tailLeft) { s.lineTo(x1 - 0.002, y0 - 0.012); s.lineTo(tx + 0.004, y0); s.lineTo(x1 - R, y0); }
    s.quadraticCurveTo(x1, y0, x1, y0 + R); s.lineTo(x1, y1 - R); s.quadraticCurveTo(x1, y1, x1 - R, y1); s.lineTo(x0 + R, y1); s.quadraticCurveTo(x0, y1, x0, y1 - R); s.lineTo(x0, y0 + R); s.quadraticCurveTo(x0, y0, x0 + R, y0);
    const g = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 12 }); g.translate(0, 0, -D / 2); return g;
  };
  const words = (text, sub, bg, fg) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 320);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; const t = String(text || '').slice(0, 60);
    let size = 84; g.font = '600 ' + size + 'px system-ui, sans-serif'; while (size > 26 && g.measureText(t).width > 470) { size -= 4; g.font = '600 ' + size + 'px system-ui, sans-serif'; }
    if (g.measureText(t).width > 470) { const half = t.lastIndexOf(' ', Math.ceil(t.length / 2)) > 0 ? t.lastIndexOf(' ', Math.ceil(t.length / 2)) : Math.ceil(t.length / 2); g.fillText(t.slice(0, half).trim(), 256, 130); g.fillText(t.slice(half).trim(), 256, 130 + size); }
    else g.fillText(t, 256, sub ? 140 : 160);
    if (sub) { g.globalAlpha = 0.75; g.font = '500 34px system-ui, sans-serif'; g.fillText(sub, 256, 262); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
  };
  const geoL = outline(false), geoR = outline(true); // the left bubble's tail points right, toward the reply
  const shellL = new THREE.MeshPhysicalMaterial({ color: '#f5f5f7', roughness: 0.35, clearcoat: 0.5 }), shellR = new THREE.MeshPhysicalMaterial({ color: '#6d4aff', roughness: 0.35, clearcoat: 0.5 });
  const plane = new THREE.PlaneGeometry(W - 0.008, H - 0.008), faceL = new THREE.MeshBasicMaterial({ toneMapped: false }), faceR = new THREE.MeshBasicMaterial({ toneMapped: false });
  const bubble = (geo, shell, face, x) => { const g = new THREE.Group(), b = new THREE.Mesh(geo, shell), f = new THREE.Mesh(plane, face); b.castShadow = true; f.position.set(0, H / 2, D / 2 + 0.0016); g.add(b, f); g.position.set(x, 0.016, 0); return g; };
  const left = bubble(geoL, shellL, faceL, -0.042), right = bubble(geoR, shellR, faceR, 0.042); right.position.y = 0.024;
  root.add(left, right);
  let from = '', to = '', swing = 0;
  const set = (d) => {
    from = String(d.from || ''); to = String(d.to || '');
    if (faceL.map) faceL.map.dispose(); if (faceR.map) faceR.map.dispose();
    faceL.map = words(from, '', '#f5f5f7', '#1d1b22'); faceR.map = words(to, d.lang ? String(d.lang) : '', '#6d4aff', '#ffffff'); faceL.needsUpdate = faceR.needsUpdate = true;
  };
  set(data);
  ctx.frame(root, { view: [0, 0.2, 1], pad: 1.15, ground: 'none' });
  return {
    update(d) { const changed = String(d.to || '') !== to || String(d.from || '') !== from; set(d); if (changed && !still) swing = 1; ctx.requestRender(); },
    tick(dt) {
      if (swing > 0) { swing = Math.max(0, swing - dt * 1.2); right.rotation.y = swing * Math.PI * 2; if (!swing) right.rotation.y = 0; return true; }
      return false; // idle costs nothing: they stand facing you until the words change
    },
    state() { return { from, to, turning: swing > 0 }; },
    dispose() { for (const g of [geoL, geoR, plane]) g.dispose(); for (const m of [shellL, shellR, faceL, faceR]) { if (m.map) m.map.dispose(); m.dispose(); } },
  };
}
