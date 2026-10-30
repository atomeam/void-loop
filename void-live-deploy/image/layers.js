// /image/'s layer maker (owner, 2026-10-25: perchance's image-layer-combiner, safely): stack pictures made or kept on this page, or from the public
// gallery, move, size and fade each one, and save the stack as a PNG. No uploads: only pictures already on the page (data: or this site's own
// /api/gallery addresses) can be layers, so the canvas is never tainted and nothing new is sent anywhere. Loaded when the maker is opened.
const SIZE = 1024;
export function mountLayers(box) {
  const d = box.ownerDocument, mk = (t, p = {}) => Object.assign(d.createElement(t), p);
  const layers = []; let sel = -1;
  const pickH = mk('p', { className: 'note', textContent: 'Pictures on this page (tap one to add it as a layer):' }), picks = mk('div', { className: 'chips lm-picks' });
  const canvas = mk('canvas', { width: SIZE, height: SIZE, className: 'lm-canvas' }); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'The stacked picture');
  const list = mk('ol', { className: 'lm-list' }), acts = mk('div', { className: 'row' }), note = mk('p', { className: 'note' }); note.setAttribute('role', 'status');
  const save = mk('button', { type: 'button', className: 'go', textContent: 'Save as PNG' }), clear = mk('button', { type: 'button', textContent: 'Clear the layers' });
  acts.append(save, clear);
  const style = mk('style', { textContent: '.lm-canvas{width:100%;max-width:520px;aspect-ratio:1;border:1px solid var(--line);border-radius:12px;background:repeating-conic-gradient(#8882 0 25%,transparent 0 50%) 0 0/24px 24px;touch-action:none;display:block}.lm-picks img{width:56px;height:56px;object-fit:cover;border-radius:8px;display:block}.lm-picks button{padding:2px;min-height:60px}.lm-list{list-style:none;padding:0;margin:8px 0;display:grid;gap:8px}.lm-list li{border:1px solid var(--line);border-radius:12px;padding:8px;display:grid;gap:4px}.lm-list li[aria-current="true"]{border-color:var(--accent)}.lm-list label{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:6px;font-size:13px;color:var(--soft)}.lm-list input[type=range]{min-height:24px;padding:0}' });
  box.replaceChildren(style, pickH, picks, canvas, list, acts, note);
  const ok = (src) => /^data:image\/(?:jpeg|png);base64,/.test(src) || /^\/api\/gallery\?img=[a-z2-7]{8}$/.test(src) || src.startsWith(location.origin + '/api/gallery?img=');
  function refreshPicks() {
    const srcs = [...new Set([...d.querySelectorAll('#pics img, #gal img, #pub img')].map((i) => i.getAttribute('src')).filter(ok))].slice(0, 40);
    picks.replaceChildren(...(srcs.length ? srcs.map((src, i) => { const b = mk('button', { type: 'button' }); b.setAttribute('aria-label', 'Add picture ' + (i + 1) + ' as a layer'); b.append(mk('img', { src, alt: '' })); b.addEventListener('click', () => add(src)); return b; }) : [mk('span', { className: 'note', textContent: 'Make or keep a picture first, or open the public gallery below.' })]));
  }
  function add(src) {
    const img = new Image(); img.onload = () => { layers.push({ img, src, x: 50, y: 50, scale: layers.length ? 60 : 100, opacity: 100 }); sel = layers.length - 1; draw(); drawList(); }; img.onerror = () => { note.textContent = 'That picture could not be used.'; }; img.src = src;
  }
  function draw() {
    const x = canvas.getContext('2d'); if (!x) return; x.clearRect(0, 0, SIZE, SIZE);
    for (const l of layers) { const w = (SIZE * l.scale) / 100, h = (w * l.img.naturalHeight) / Math.max(1, l.img.naturalWidth); x.globalAlpha = l.opacity / 100; x.drawImage(l.img, (SIZE * l.x) / 100 - w / 2, (SIZE * l.y) / 100 - h / 2, w, h); }
    x.globalAlpha = 1;
  }
  function slider(l, key, label, min, max) { const lab = mk('label', { textContent: label }), r = mk('input', { type: 'range', min, max, value: l[key] }); r.setAttribute('aria-label', label); r.addEventListener('input', () => { l[key] = +r.value; draw(); }); lab.append(r); return lab; }
  function drawList() {
    list.replaceChildren(...layers.map((l, i) => {
      const li = mk('li'); li.setAttribute('aria-current', String(i === sel)); const head = mk('div', { className: 'row' }); head.style.margin = '0';
      const pickB = mk('button', { type: 'button', textContent: 'Layer ' + (i + 1) + (i === layers.length - 1 ? ' (top)' : i === 0 ? ' (bottom)' : '') }); pickB.addEventListener('click', () => { sel = i; drawList(); });
      const up = mk('button', { type: 'button', textContent: 'Up' }), down = mk('button', { type: 'button', textContent: 'Down' }), rm = mk('button', { type: 'button', textContent: 'Remove' });
      up.setAttribute('aria-label', 'Move layer ' + (i + 1) + ' up'); down.setAttribute('aria-label', 'Move layer ' + (i + 1) + ' down'); rm.setAttribute('aria-label', 'Remove layer ' + (i + 1));
      up.disabled = i === layers.length - 1; down.disabled = i === 0;
      up.addEventListener('click', () => { [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]]; sel = i + 1; draw(); drawList(); });
      down.addEventListener('click', () => { [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]]; sel = i - 1; draw(); drawList(); });
      rm.addEventListener('click', () => { layers.splice(i, 1); sel = Math.min(sel, layers.length - 1); draw(); drawList(); });
      head.append(pickB, up, down, rm);
      li.append(head, slider(l, 'x', 'Across', 0, 100), slider(l, 'y', 'Down', 0, 100), slider(l, 'scale', 'Size', 5, 200), slider(l, 'opacity', 'Opacity', 0, 100)); return li;
    }));
  }
  // drag the chosen layer on the canvas
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { if (sel < 0) return; drag = { id: e.pointerId }; canvas.setPointerCapture(e.pointerId); move(e); });
  const move = (e) => { if (!drag || sel < 0) return; const r = canvas.getBoundingClientRect(); layers[sel].x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); layers[sel].y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)); draw(); };
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', () => { drag = null; drawList(); });
  save.addEventListener('click', () => { if (!layers.length) { note.textContent = 'Add a layer first.'; return; } canvas.toBlob((b) => { if (!b) { note.textContent = 'This browser could not save it.'; return; } const a = mk('a', { href: URL.createObjectURL(b), download: 'layers.png' }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); note.textContent = 'Saved as layers.png.'; }, 'image/png'); });
  clear.addEventListener('click', () => { layers.length = 0; sel = -1; draw(); drawList(); });
  refreshPicks(); return { refreshPicks, add };
}
