/**
 * The tip page's miniature (docs/miniatures.md): a slate check tray with a printed receipt (bill, tip, total) that slides
 * out when the answer appears, and the share each person pays as small coin stacks, one per person (up to 8), the gold
 * coins on top being the tip part.
 * data: { bill, tip, total, people, pct, currency? ('$' by default) }
 */
const COIN_R = 0.0065, COIN_H = 0.0019;

export function receiptLines(d) {
  const c = d.currency || '$', f = (n) => c + (Math.round((+n || 0) * 100) / 100).toFixed(2);
  const lines = [['Bill', f(d.bill)]];
  if (+d.tip > 0) lines.push(['Tip' + (+d.pct > 0 ? ' ' + (Math.round(d.pct * 10) / 10) + '%' : ''), f(d.tip)]);
  lines.push(['Total', f(d.total)]);
  if (+d.people >= 2) lines.push(['Each (' + d.people + ')', f(d.total / d.people)]);
  return lines;
}
// coins per person: bill part silver, tip part gold, the share scaled so the stack stays a sensible height
export function stackFor(d) {
  const n = Math.max(1, Math.min(8, Math.round(+d.people || 1)));
  const each = (+d.total || 0) / Math.max(1, +d.people || 1), tipEach = (+d.tip || 0) / Math.max(1, +d.people || 1);
  const coins = Math.max(1, Math.min(18, Math.round(each > 0 ? 6 + Math.log10(each) * 4 : 1)));
  const gold = each > 0 ? Math.min(coins - (coins > 1 ? 1 : 0), Math.max(tipEach > 0 ? 1 : 0, Math.round(coins * tipEach / each))) : 0;
  return { people: n, silver: coins - gold, gold };
}

export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const made = [];
  const keep = (x) => { made.push(x); return x; };
  const slate = keep(new THREE.MeshPhysicalMaterial({ color: '#1f2226', roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  const tray = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.005, 0.07)), slate); tray.position.y = 0.0025; tray.receiveShadow = true; tray.castShadow = true;
  const rim = new THREE.Mesh(keep(new THREE.BoxGeometry(0.123, 0.004, 0.073)), keep(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: 0.3 }))); rim.position.y = 0.0019;
  root.add(rim, tray);

  // the receipt: thermal paper with a slight curl, drawn from the numbers
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 560;
  const tex = keep(new THREE.CanvasTexture(canvas)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const paperGeo = keep(new THREE.PlaneGeometry(0.046, 0.08, 1, 24));
  { const p = paperGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.max(0, y - 0.026) * Math.max(0, y - 0.026) * 9); } paperGeo.computeVertexNormals(); }
  const receipt = new THREE.Mesh(paperGeo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })));
  receipt.rotation.x = -Math.PI / 2; receipt.rotation.z = 0.08; receipt.castShadow = true; receipt.receiveShadow = true;
  const slide = new THREE.Group(); slide.add(receipt); slide.position.set(-0.029, 0.0056, 0); root.add(slide);

  const coinGeo = keep(new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H * 0.92, 40));
  const coinMat = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.26 })); // tinted per coin
  let coins = null, d = { ...data }, t0 = 0, moving = false;

  function draw() {
    const g = canvas.getContext('2d');
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, 320, 560);
    g.fillStyle = '#2a2a2c'; g.textBaseline = 'middle';
    g.font = '700 38px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.fillText('RECEIPT', 160, 54);
    g.font = '20px ui-monospace, Menlo, monospace'; g.fillText('- - - - - - - - - - -', 160, 92);
    receiptLines(d).forEach(([k, v], i) => {
      const y = 150 + i * 72, bold = k === 'Total' || /^Each/.test(k);
      g.font = (bold ? '700 ' : '') + '30px ui-monospace, Menlo, monospace';
      g.textAlign = 'left'; g.fillText(k, 22, y); g.textAlign = 'right'; g.fillText(v, 300, y);
    });
    g.textAlign = 'center'; g.font = '20px ui-monospace, Menlo, monospace'; g.fillText('THANK YOU', 160, 500);
    tex.needsUpdate = true;
  }
  function lay() {
    if (coins) { root.remove(coins); coins.dispose(); }
    const s = stackFor(d), per = s.silver + s.gold, total = per * s.people;
    coins = new THREE.InstancedMesh(coinGeo, coinMat, total); coins.castShadow = true; coins.receiveShadow = true;
    const gc = new THREE.Color('#e0b84a'), sc = new THREE.Color('#c8ccd2'), m4 = new THREE.Matrix4();
    const cols = Math.min(4, s.people), rows = Math.ceil(s.people / cols);
    for (let p = 0, k = 0; p < s.people; p++) {
      const cx = 0.026 + (p % cols - (cols - 1) / 2) * 0.0155, cz = (Math.floor(p / cols) - (rows - 1) / 2) * 0.016;
      for (let i = 0; i < per; i++, k++) {
        const j = Math.sin((p * 31 + i) * 12.9898) * 0.0003;
        m4.makeTranslation(cx + j, 0.005 + COIN_H * (i + 0.5), cz + j); coins.setMatrixAt(k, m4);
        coins.setColorAt(k, i >= s.silver ? gc : sc);
      }
    }
    root.add(coins);
  }
  draw(); lay();
  ctx.frame(root, { view: [0.0, 1, 0.55], pad: 0.98 });
  moving = !still; slide.position.z = still ? 0 : 0.05;

  return {
    get lines() { return receiptLines(d); },
    update(next) { if (JSON.stringify(next) !== JSON.stringify(d)) { d = { ...next }; draw(); lay(); ctx.requestRender(); } },
    tick(dt) { // the receipt slides out of the tray's far edge
      if (!moving) return false;
      t0 += dt; const k = Math.min(1, t0 / 0.7), e = 1 - Math.pow(1 - k, 3);
      slide.position.z = 0.05 * (1 - e); if (k >= 1) moving = false; return true;
    },
    dispose() { for (const x of made) x.dispose(); if (coins) coins.dispose(); },
  };
}
