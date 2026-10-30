/**
 * page miniature: the word count card's 3D figure (owner, 2026-10-25: "should be a card for all too and 3d figure if possible"). A sheet of paper
 * lying on a small stack, written over with as many lines of text as the words fill (about ten words a line, a full page past 250), with the count
 * pencilled big in the margin. A new count slides a fresh sheet on top of the stack; with reduced motion it is simply there.
 * data: { words: number, chars?: number }. state(): { words, sliding }.
 */
export default function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const W = 0.148, L = 0.21, T = 0.0006; // an A5 sheet
  const sheetGeo = new THREE.BoxGeometry(W, T, L), paper = new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 0.92 }), face = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const stack = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(sheetGeo, paper); m.position.set((i % 2) * 0.002 - 0.001, T * (i + 0.5), (i % 3) * 0.0015); m.rotation.y = (i - 1.5) * 0.02; m.receiveShadow = true; m.castShadow = true; return m; });
  const top = new THREE.Mesh(sheetGeo, [paper, paper, face, paper, paper, paper]); top.castShadow = true; top.receiveShadow = true;
  const TOP_Y = T * 4.5; top.position.y = TOP_Y;
  root.add(...stack, top);
  let words = 0, slide = 0, tex = null;
  const paint = (d) => {
    words = Math.max(0, Math.floor(Number(d.words) || 0));
    const c = document.createElement('canvas'); c.width = 512; c.height = 726; const g = c.getContext('2d');
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, 512, 726); g.strokeStyle = 'rgba(214,80,80,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(92, 0); g.lineTo(92, 726); g.stroke();
    const lines = Math.min(22, Math.ceil(words / 10)), last = words % 10 || 10; let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle = '#3b3a44';
    for (let i = 0; i < lines; i++) { // each line of words as short ink strokes, the last line shorter
      let x = 108; const n = i === lines - 1 && words < 250 ? last : 10;
      for (let k = 0; k < n && x < 488; k++) { const w = 16 + rnd() * 34; g.fillRect(x, 60 + i * 24, Math.min(w, 488 - x), 12); x += w + 9; }
    }
    g.fillStyle = '#2f5aa8'; g.font = '700 ' + (words > 99999 ? 64 : 92) + 'px "Comic Sans MS", "Segoe Print", cursive'; g.textAlign = 'center'; g.fillText(words.toLocaleString('en') + (words === 1 ? ' word' : ' words'), 300, 680); // the count, pencilled big at the foot
    if (tex) tex.dispose(); tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; face.map = tex; face.needsUpdate = true;
  };
  paint(data);
  ctx.frame(root, { view: [0, 1, 0.75], pad: 1.1 });
  const pose = () => { const k = 1 - Math.pow(1 - slide, 3); top.position.x = (1 - k) * -0.2; top.position.y = TOP_Y + Math.sin(k * Math.PI) * 0.01; };
  slide = 1; pose();
  return {
    update(d) { const changed = Math.floor(Number(d.words) || 0) !== words; paint(d); if (changed && !still) { slide = 0; pose(); } ctx.requestRender(); },
    tick(dt) { if (slide >= 1) return false; slide = Math.min(1, slide + dt * 1.5); pose(); return true; },
    state() { return { words, sliding: slide < 1 }; },
    dispose() { sheetGeo.dispose(); paper.dispose(); face.dispose(); if (tex) tex.dispose(); },
  };
}
