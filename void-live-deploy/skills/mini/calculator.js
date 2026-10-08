/**
 * calculator miniature — a solar pocket calculator on the desk (charcoal case, solar strip, seven-segment LCD with ghost
 * segments, sculpted keys). When the card gets a new sum the keys press one by one for the expression, the display
 * follows what was typed, then "=" and the result. Tapping a key presses it.
 * data: { expression: '12*7', result: '84', typed?: bool (true = play the key presses now) }
 */
const W = 0.074, L = 0.118, T = 0.01;
const ROWS = [['C', '±', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['0', '.', '=']];
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', E: 'afged', r: 'eg', o: 'cdeg' };
/** the keys a person would press for this expression */
export function keysFor(expr) {
  const s = String(expr || '').toLowerCase().replace(/\s*of\s*/g, '×').replace(/\*\*|\^/g, '').replace(/[x*]/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  const out = []; for (const ch of s) if (/[0-9.+×÷−%]/.test(ch)) out.push(ch);
  return out;
}
function fitDisplay(v) {
  const n = Number(v); if (!isFinite(n)) return String(v || '').trim() ? 'Error' : '0';
  let s = String(n); if (s.replace(/[-.]/g, '').length > 10) { s = n.toPrecision(9); if (s.includes('e')) s = n.toExponential(4).replace('e+', 'E').replace('e', 'E'); s = s.replace(/(\.\d*?)0+(E|$)/, '$1$2').replace(/\.(E|$)/, '$1'); }
  return s;
}
function lcdTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 160; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const draw = (text, op) => {
    const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 160); grad.addColorStop(0, '#c3cbb0'); grad.addColorStop(1, '#aab396'); g.fillStyle = grad; g.fillRect(0, 0, 640, 160);
    const cells = 10, cw = 56, dh = 104, top = 34, right = 616;
    let chars = []; for (const ch of String(text)) { if (ch === '.') { if (chars.length) chars[chars.length - 1].dot = true; else chars.push({ ch: '0', dot: true }); } else chars.push({ ch: ch === 'r' || ch === 'o' ? ch : ch === 'E' ? 'E' : ch }); }
    if (text === 'Error') chars = [...'Error'].map((ch) => ({ ch: ch === 'E' ? 'E' : ch }));
    chars = chars.slice(-cells);
    for (let i = 0; i < cells; i++) {
      const x = right - (cells - i) * cw, cell = chars[i - (cells - chars.length)];
      seg(g, x + 6, top, cw - 14, dh, 'abcdefg', 'rgba(60,70,50,0.07)', true); // ghost segments, the way a real LCD shows them
      if (cell) seg(g, x + 6, top, cw - 14, dh, SEG[cell.ch] || '', '#1d221b', cell.dot);
    }
    if (op) { g.fillStyle = '#1d221b'; g.font = 'bold 26px Arial, sans-serif'; g.fillText(op, 18, 40); }
    t.needsUpdate = true;
  };
  return { t, draw };
}
function seg(g, x, y, w, h, on, color, dot) {
  const k = 0.12 * h, th = Math.max(5, w * 0.17), hh = h / 2; g.fillStyle = color;
  const P = (pts) => { g.beginPath(); pts.forEach(([px, py], i) => { const sx = x + px + (h - py) * k / h; i ? g.lineTo(sx, y + py) : g.moveTo(sx, y + py); }); g.closePath(); g.fill(); };
  const hor = (yy) => P([[th * 0.6, yy], [th * 1.1, yy - th / 2], [w - th * 1.1, yy - th / 2], [w - th * 0.6, yy], [w - th * 1.1, yy + th / 2], [th * 1.1, yy + th / 2]]);
  const ver = (xx, y0, y1) => P([[xx, y0 + th * 0.6], [xx + th / 2, y0 + th * 1.1], [xx + th / 2, y1 - th * 1.1], [xx, y1 - th * 0.6], [xx - th / 2, y1 - th * 1.1], [xx - th / 2, y0 + th * 1.1]]);
  if (on.includes('a')) hor(th / 2); if (on.includes('g')) hor(hh); if (on.includes('d')) hor(h - th / 2);
  if (on.includes('f')) ver(th / 2, 0, hh); if (on.includes('b')) ver(w - th / 2, 0, hh); if (on.includes('e')) ver(th / 2, hh, h); if (on.includes('c')) ver(w - th / 2, hh, h);
  if (dot === true && color !== 'rgba(60,70,50,0.07)') { g.beginPath(); g.arc(x + w + th * 0.5, y + h - th / 2, th * 0.55, 0, Math.PI * 2); g.fill(); }
}
function rrect(THREE, w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
export default function build(ctx, data) {
  const { THREE, root } = ctx;
  const geos = [], mats = [], texs = [], G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);
  const body = M(new THREE.MeshPhysicalMaterial({ color: '#1e2023', roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5 }));
  const bezelM = M(new THREE.MeshPhysicalMaterial({ color: '#0d0e10', roughness: 0.15, clearcoat: 1 }));
  const keyMat = { d: M(new THREE.MeshPhysicalMaterial({ color: '#d8d7d2', roughness: 0.45, clearcoat: 0.3 })), o: M(new THREE.MeshPhysicalMaterial({ color: '#3c3f45', roughness: 0.45, clearcoat: 0.3 })),
    e: M(new THREE.MeshPhysicalMaterial({ color: '#e07a2e', roughness: 0.4, clearcoat: 0.4 })), c: M(new THREE.MeshPhysicalMaterial({ color: '#b8463b', roughness: 0.4, clearcoat: 0.4 })) };
  // case: a rounded slab, slightly wedged (thicker at the top, like a real one)
  const caseG = G(new THREE.ExtrudeGeometry(rrect(THREE, W, L, 0.008), { depth: T - 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 4, curveSegments: 10 }).rotateX(-Math.PI / 2));
  const caseM = new THREE.Mesh(caseG, body); caseM.position.y = 0.0015; caseM.castShadow = caseM.receiveShadow = true;
  // faceplate: solar cells and the brand, printed on a thin plate
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 160; const fg = fc.getContext('2d');
  fg.fillStyle = '#1b1c1f'; fg.fillRect(0, 0, 512, 160);
  const cg = fg.createLinearGradient(0, 0, 512, 0); cg.addColorStop(0, '#3a2620'); cg.addColorStop(0.5, '#4a3026'); cg.addColorStop(1, '#3a2620');
  fg.fillStyle = cg; fg.fillRect(250, 22, 236, 58); fg.strokeStyle = 'rgba(0,0,0,0.6)'; fg.lineWidth = 2; for (let i = 1; i < 4; i++) { fg.beginPath(); fg.moveTo(250 + i * 59, 22); fg.lineTo(250 + i * 59, 80); fg.stroke(); }
  fg.fillStyle = '#c9cbd0'; fg.font = 'italic 700 40px Arial, sans-serif'; fg.fillText('VOID', 26, 62); fg.font = '600 20px Arial, sans-serif'; fg.fillStyle = '#8b8e95'; fg.fillText('SL-200  SOLAR', 28, 96);
  const faceT = new THREE.CanvasTexture(fc); faceT.colorSpace = THREE.SRGBColorSpace; faceT.anisotropy = 8; texs.push(faceT);
  const face = new THREE.Mesh(G(new THREE.PlaneGeometry(W - 0.01, (W - 0.01) * 160 / 512).rotateX(-Math.PI / 2)), M(new THREE.MeshPhysicalMaterial({ map: faceT, roughness: 0.3, clearcoat: 0.6 })));
  const topY = 0.0015 + T - 0.003 + 0.0015; face.position.set(0, topY + 0.0002, -L / 2 + 0.013); face.receiveShadow = true;
  // LCD in a glossy bezel
  const bez = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(THREE, W - 0.01, 0.024, 0.002), { depth: 0.0008, bevelEnabled: false }).rotateX(-Math.PI / 2)), bezelM);
  bez.position.set(0, topY, -L / 2 + 0.038); bez.receiveShadow = true;
  const lcd = lcdTexture(THREE); texs.push(lcd.t);
  const lcdM = new THREE.Mesh(G(new THREE.PlaneGeometry(W - 0.018, (W - 0.018) / 4).rotateX(-Math.PI / 2)), M(new THREE.MeshPhysicalMaterial({ map: lcd.t, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 })));
  lcdM.position.set(0, topY + 0.0009, -L / 2 + 0.038);
  root.add(caseM, face, bez, lcdM);
  // key labels: one atlas
  const AC = document.createElement('canvas'); AC.width = 1024; AC.height = 512; const ag = AC.getContext('2d'); ag.textAlign = 'center'; ag.textBaseline = 'middle';
  const keyW = 0.0128, keyH = 0.0098, gapX = (W - 0.012 - 4 * keyW) / 3, gapZ = 0.0042, z0 = -L / 2 + 0.06;
  const keyGeo = (w) => G(new THREE.ExtrudeGeometry(rrect(THREE, w, keyH, 0.0022), { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0007, bevelSegments: 3, curveSegments: 6 }).rotateX(-Math.PI / 2));
  const kg1 = keyGeo(keyW), kg2 = keyGeo(keyW * 2 + gapX);
  const keys = new Map(); let n = 0;
  const atlasT = new THREE.CanvasTexture(AC); atlasT.colorSpace = THREE.SRGBColorSpace; atlasT.anisotropy = 8; texs.push(atlasT);
  const labelMat = M(new THREE.MeshBasicMaterial({ map: atlasT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }));
  ROWS.forEach((row, r) => {
    let col = 0;
    for (const lab of row) {
      const wide = lab === '0', w = wide ? keyW * 2 + gapX : keyW, x = -W / 2 + 0.006 + col * (keyW + gapX) + w / 2, z = z0 + r * (keyH + gapZ);
      const kind = /\d|\./.test(lab) ? 'd' : lab === '=' ? 'e' : lab === 'C' ? 'c' : 'o';
      const m = new THREE.Mesh(wide ? kg2 : kg1, keyMat[kind]); m.position.set(x, topY, z); m.castShadow = m.receiveShadow = true; m.userData.key = lab;
      // label cell in the atlas (8 x 4 cells of 128 x 128)
      const cx = (n % 8) * 128 + 64, cy = Math.floor(n / 8) * 128 + 64; ag.fillStyle = kind === 'd' ? '#2a2b2f' : '#ffffff'; ag.font = (lab.length > 1 ? '600 60px' : '600 72px') + ' "Helvetica Neue", Arial, sans-serif'; ag.fillText(lab, cx, cy + 4);
      const pg = G(new THREE.PlaneGeometry(keyH * 0.9, keyH * 0.9).rotateX(-Math.PI / 2)); const uv = pg.attributes.uv; const u0 = (n % 8) / 8, v0 = 1 - (Math.floor(n / 8) + 1) / 4;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 + uv.getY(i) / 4);
      const lm = new THREE.Mesh(pg, labelMat); lm.position.y = 0.0018 + 0.0008 + 0.00005; m.add(lm); lm.raycast = () => {};
      root.add(m); keys.set(lab, { m, y: topY, t: 0 }); n++; col += wide ? 2 : 1;
    }
  });
  atlasT.needsUpdate = true;
  root.rotation.y = -0.18;
  ctx.frame(root, { view: [0.12, 1, 0.75], pad: 0.86, light: [0.45, 1.3, 0.55], minZoom: 0.55, maxZoom: 2 });
  // behaviour
  let shown = '0', op = '', queue = [], wait = 0, d = data || {};
  const show = (txt, o = op) => { shown = txt; op = o; lcd.draw(txt, o); };
  function play(expr, result) {
    queue = []; let cur = '';
    for (const k of keysFor(expr)) {
      if (/[0-9.]/.test(k)) { cur += k; queue.push({ k, txt: cur, op: '' }); } else { queue.push({ k, txt: cur || shown, op: k === '%' ? '' : k }); if (k !== '%') cur = ''; }
    }
    queue.push({ k: '=', txt: fitDisplay(result), op: '' });
    wait = 0.25;
  }
  function apply(nd, first) {
    const prev = d; d = nd || {};
    const fresh = first ? !!d.typed : (d.expression !== prev.expression || d.result !== prev.result);
    if (d.expression && fresh && !ctx.still) { show('0', ''); play(d.expression, d.result); }
    else { queue = []; show(d.result !== undefined && d.result !== '' ? fitDisplay(d.result) : '0', ''); }
  }
  apply(d, true);
  ctx.onTap((hits) => { const o = hits && hits.find((h) => h.object.userData.key); if (o) { keys.get(o.object.userData.key).t = 1; ctx.requestRender(); } });
  return {
    update(nd) { apply(nd, false); ctx.requestRender(); },
    state: () => ({ display: shown, op, pending: queue.length }), // for tests
    tick(dt) {
      let moved = false;
      if (queue.length) { wait -= dt; if (wait <= 0) { const s = queue.shift(); keys.get(s.k) && (keys.get(s.k).t = 1); show(s.txt, s.op); wait = s.k === '=' ? 0.3 : 0.17; moved = true; } }
      for (const k of keys.values()) if (k.t > 0) { k.t = Math.max(0, k.t - dt * 7); k.m.position.y = k.y - Math.sin(k.t * Math.PI) * 0.0012; moved = true; }
      return moved ? 'view' : false;
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const t of texs) t.dispose(); },
  };
}
