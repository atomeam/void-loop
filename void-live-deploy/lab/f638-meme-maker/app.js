const c = document.getElementById('c');
const ctx = c.getContext('2d');
const topIn = document.getElementById('top');
const botIn = document.getElementById('bot');
const sizeIn = document.getElementById('size');
const sizeVal = document.getElementById('sizeVal');
const colorIn = document.getElementById('color');
const outlineIn = document.getElementById('outline');
const weightIn = document.getElementById('weight');
const fileIn = document.getElementById('file');
const camBtn = document.getElementById('camBtn');
const blankBtn = document.getElementById('blankBtn');
const downloadBtn = document.getElementById('download');
const copyLinkBtn = document.getElementById('copyLink');
const resetBtn = document.getElementById('reset');
const vid = document.getElementById('vid');

let img = null;
let topPos = { x: 0.5, y: 0.15 };
let botPos = { x: 0.5, y: 0.85 };
let drag = null; // 'top' | 'bot' | null
let stream = null;

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('f638') || '{}');
    if (s.top) topIn.value = s.top;
    if (s.bot) botIn.value = s.bot;
    if (s.size) sizeIn.value = s.size;
    if (s.color) colorIn.value = s.color;
    if (s.outline) outlineIn.value = s.outline;
    if (s.weight) weightIn.value = s.weight;
    if (s.topPos) topPos = s.topPos;
    if (s.botPos) botPos = s.botPos;
  } catch (e) { console.debug("lab f638-meme-maker:", e); }
  const params = new URLSearchParams(location.search);
  if (params.get('t')) topIn.value = decodeURIComponent(params.get('t'));
  if (params.get('b')) botIn.value = decodeURIComponent(params.get('b'));
  sizeVal.textContent = sizeIn.value;
}
function saveState() {
  try {
    localStorage.setItem('f638', JSON.stringify({
      top: topIn.value, bot: botIn.value, size: sizeIn.value,
      color: colorIn.value, outline: outlineIn.value, weight: weightIn.value,
      topPos, botPos
    }));
  } catch (e) { console.debug("lab f638-meme-maker:", e); }
}

function fitImage(source) {
  const max = 1200;
  let w = source.videoWidth || source.naturalWidth || source.width;
  let h = source.videoHeight || source.naturalHeight || source.height;
  if (w > max || h > max) {
    const r = Math.min(max / w, max / h);
    w = Math.round(w * r); h = Math.round(h * r);
  }
  c.width = w; c.height = h;
  draw();
}

function draw() {
  ctx.clearRect(0, 0, c.width, c.height);
  if (img) {
    const r = Math.max(c.width / img.width, c.height / img.height);
    const nw = img.width * r, nh = img.height * r;
    ctx.drawImage(img, (c.width - nw)/2, (c.height - nh)/2, nw, nh);
  } else {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#555';
    ctx.font = '24px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Drop a photo or use the camera', c.width/2, c.height/2);
  }
  const size = +sizeIn.value;
  const weight = +weightIn.value;
  ctx.font = `bold ${size}px Impact, Arial Black, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = outlineIn.value;
  ctx.lineWidth = weight;
  ctx.fillStyle = colorIn.value;

  function drawText(text, pos) {
    if (!text) return;
    const x = pos.x * c.width;
    const y = pos.y * c.height;
    const lines = wrap(text, c.width * 0.9);
    const lh = size * 1.1;
    const startY = y - (lines.length - 1) * lh / 2;
    lines.forEach((line, i) => {
      const ly = startY + i * lh;
      ctx.strokeText(line, x, ly);
      ctx.fillText(line, x, ly);
    });
  }
  drawText(topIn.value.toUpperCase(), topPos);
  drawText(botIn.value.toUpperCase(), botPos);
}

function wrap(text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function hit(pos, mx, my) {
  const size = +sizeIn.value;
  const x = pos.x * c.width;
  const y = pos.y * c.height;
  return Math.abs(mx - x) < size * 3 && Math.abs(my - y) < size * 1.5;
}

c.addEventListener('pointerdown', e => {
  const rect = c.getBoundingClientRect();
  const scaleX = c.width / rect.width;
  const scaleY = c.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  if (hit(topPos, mx, my)) drag = 'top';
  else if (hit(botPos, mx, my)) drag = 'bot';
  else drag = null;
  if (drag) c.setPointerCapture(e.pointerId);
});
c.addEventListener('pointermove', e => {
  if (!drag) return;
  const rect = c.getBoundingClientRect();
  const scaleX = c.width / rect.width;
  const scaleY = c.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const pos = drag === 'top' ? topPos : botPos;
  pos.x = Math.max(0.05, Math.min(0.95, mx / c.width));
  pos.y = Math.max(0.05, Math.min(0.95, my / c.height));
  draw();
});
c.addEventListener('pointerup', () => { drag = null; saveState(); });

fileIn.addEventListener('change', () => {
  const f = fileIn.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => { img = im; fitImage(im); saveState(); };
    im.src = reader.result;
  };
  reader.readAsDataURL(f);
});

blankBtn.addEventListener('click', () => {
  img = null;
  c.width = 800; c.height = 600;
  draw();
});

camBtn.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    vid.srcObject = stream;
    vid.classList.remove('hidden');
    await vid.play();
    const capture = () => {
      const cc = document.getElementById('camCan');
      cc.width = vid.videoWidth; cc.height = vid.videoHeight;
      cc.getContext('2d').drawImage(vid, 0, 0);
      const im = new Image();
      im.onload = () => { img = im; fitImage(im); };
      im.src = cc.toDataURL('image/jpeg', 0.9);
      stream.getTracks().forEach(t => t.stop());
      vid.classList.add('hidden');
    };
    setTimeout(capture, 300); // brief live preview then snap
  } catch (err) {
    alert('Camera not available. Use the file picker instead.');
  }
});

[topIn, botIn, sizeIn, colorIn, outlineIn, weightIn].forEach(el => {
  el.addEventListener('input', () => {
    if (el === sizeIn) sizeVal.textContent = sizeIn.value;
    draw();
    saveState();
  });
});

downloadBtn.addEventListener('click', () => {
  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'meme.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

copyLinkBtn.addEventListener('click', async () => {
  const u = new URL(location.href);
  u.searchParams.set('t', encodeURIComponent(topIn.value));
  u.searchParams.set('b', encodeURIComponent(botIn.value));
  try {
    await navigator.clipboard.writeText(u.toString());
    copyLinkBtn.textContent = 'Copied';
    setTimeout(() => copyLinkBtn.textContent = 'Copy share link', 1500);
  } catch {
    prompt('Copy this link:', u.toString());
  }
});

resetBtn.addEventListener('click', () => {
  topPos = { x: 0.5, y: 0.15 };
  botPos = { x: 0.5, y: 0.85 };
  draw();
  saveState();
});

loadState();
draw();
window.addEventListener('resize', draw);
