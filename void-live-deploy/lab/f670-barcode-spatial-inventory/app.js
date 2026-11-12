const board = document.getElementById('board');
const status = document.getElementById('status');
const video = document.getElementById('video');
const preview = document.getElementById('preview');
const fileIn = document.getElementById('fileIn');
let items = [];
let stream = null;
let detecting = false;
let drag = null;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function save() {
  localStorage.setItem('verse-f670-inventory', JSON.stringify(items));
  try {
    const slim = items.map(({code,name,qty,notes}) => ({code,name,qty,notes}));
    history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(slim)));
  } catch (e) { console.debug("lab f670-barcode-spatial-inventory:", e); }
}

function load() {
  try {
    const raw = localStorage.getItem('verse-f670-inventory');
    if (raw) items = JSON.parse(raw);
  } catch (e) { console.debug("lab f670-barcode-spatial-inventory:", e); }
  if (location.hash.length > 1) {
    try {
      const fromHash = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (Array.isArray(fromHash) && fromHash.length) {
        items = fromHash.map(it => ({...it, id:uid(), x: 40+Math.random()*200, y:40+Math.random()*200}));
      }
    } catch (e) { console.debug("lab f670-barcode-spatial-inventory:", e); }
  }
  render();
}

function render() {
  board.innerHTML = '';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.left = (it.x||40) + 'px';
    el.style.top = (it.y||40) + 'px';
    el.dataset.id = it.id;
    el.innerHTML = `
      <div class="code">${escape(it.code)}</div>
      <input placeholder="Name" value="${escape(it.name||'')}" data-f="name">
      <div class="row">
        <button data-act="dec">−</button>
        <input type="number" min="1" value="${it.qty||1}" data-f="qty" style="width:60px;text-align:center">
        <button data-act="inc">+</button>
        <button data-act="del" class="secondary" style="margin-left:auto">✕</button>
      </div>
      <textarea placeholder="Notes" rows="2" data-f="notes">${escape(it.notes||'')}</textarea>
    `;
    board.appendChild(el);
    el.querySelectorAll('input,textarea').forEach(inp => {
      inp.addEventListener('input', e => {
        const item = items.find(i => i.id === it.id);
        if (!item) return;
        const f = e.target.dataset.f;
        item[f] = f === 'qty' ? (+e.target.value||1) : e.target.value;
        save();
      });
    });
    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const item = items.find(i => i.id === it.id);
        if (act === 'del') { items = items.filter(i => i.id !== it.id); }
        if (act === 'inc') item.qty = (item.qty||1)+1;
        if (act === 'dec') item.qty = Math.max(1, (item.qty||1)-1);
        save(); render();
      });
    });
    el.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      drag = { el, id: it.id, ox: e.clientX - el.offsetLeft, oy: e.clientY - el.offsetTop };
      el.setPointerCapture(e.pointerId);
    });
  });
}

function escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function addItem(code, name='') {
  if (items.some(i => i.code === code)) {
    status.textContent = 'Already have ' + code;
    return;
  }
  const it = { id:uid(), code, name, qty:1, notes:'', x: 30 + Math.random()*120, y: 30 + Math.random()*80 };
  items.push(it);
  save(); render();
  status.textContent = 'Added ' + code;
}

async function startCam() {
  if (!('BarcodeDetector' in window)) {
    status.textContent = 'BarcodeDetector not available. Use photo upload.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.classList.remove('hidden');
    await video.play();
    detecting = true;
    document.getElementById('startCam').disabled = true;
    document.getElementById('stopCam').disabled = false;
    detectLoop();
  } catch(e) {
    status.textContent = 'Camera permission denied or unavailable.';
  }
}

function stopCam() {
  detecting = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  video.classList.add('hidden');
  document.getElementById('startCam').disabled = false;
  document.getElementById('stopCam').disabled = true;
}

async function detectLoop() {
  if (!detecting) return;
  try {
    const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','qr_code','code_39'] });
    const codes = await detector.detect(video);
    for (const c of codes) {
      if (c.rawValue) addItem(c.rawValue);
    }
  } catch (e) { console.debug("lab f670-barcode-spatial-inventory:", e); }
  requestAnimationFrame(detectLoop);
}

fileIn.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    preview.width = img.width;
    preview.height = img.height;
    preview.getContext('2d').drawImage(img,0,0);
    preview.classList.remove('hidden');
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector();
        const codes = await detector.detect(preview);
        if (codes.length) {
          codes.forEach(c => c.rawValue && addItem(c.rawValue));
        } else {
          addItem(file.name, file.name);
          status.textContent = 'No barcode found; added filename. You can rename it.';
        }
      } catch(err) {
        addItem(file.name, file.name);
      }
    } else {
      addItem(file.name, file.name);
      status.textContent = 'No BarcodeDetector; added filename.';
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

document.getElementById('addManual').onclick = () => {
  const code = prompt('Enter code or name:');
  if (code) addItem(code.trim());
};

document.getElementById('exportCsv').onclick = () => {
  const rows = [['code','name','qty','notes']];
  items.forEach(it => rows.push([it.code, it.name||'', it.qty||1, it.notes||'']));
  const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'inventory.csv';
  a.click();
};

document.getElementById('exportPng').onclick = () => {
  const c = document.createElement('canvas');
  c.width = Math.max(board.scrollWidth, 800);
  c.height = Math.max(board.scrollHeight, 600);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#12141a';
  ctx.fillRect(0,0,c.width,c.height);
  ctx.font = '14px system-ui';
  items.forEach(it => {
    const x = it.x||40, y = it.y||40;
    ctx.fillStyle = '#1a1d24';
    ctx.strokeStyle = '#2a2e36';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, 180, 110, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4cc9f0';
    ctx.font = '12px monospace';
    ctx.fillText(it.code.slice(0,22), x+8, y+18);
    ctx.fillStyle = '#e8eaed';
    ctx.font = '14px system-ui';
    ctx.fillText((it.name||'unnamed').slice(0,20), x+8, y+40);
    ctx.fillText('Qty: '+(it.qty||1), x+8, y+60);
    if (it.notes) ctx.fillText(it.notes.slice(0,24), x+8, y+80);
  });
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'inventory-board.png';
  a.click();
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

document.getElementById('clearAll').onclick = () => {
  if (confirm('Clear all items?')) { items = []; save(); render(); }
};

document.addEventListener('pointermove', e => {
  if (!drag) return;
  const el = drag.el;
  const nx = e.clientX - drag.ox;
  const ny = e.clientY - drag.oy;
  el.style.left = nx + 'px';
  el.style.top = ny + 'px';
  const item = items.find(i => i.id === drag.id);
  if (item) { item.x = nx; item.y = ny; }
});
document.addEventListener('pointerup', () => { if (drag) { save(); drag = null; } });

document.getElementById('startCam').onclick = startCam;
document.getElementById('stopCam').onclick = stopCam;

load();
