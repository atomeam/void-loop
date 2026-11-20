const canvas = document.getElementById('activity');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');

// Low-res activity map (logical 40x30)
const W = 40, H = 30;
const scaleX = canvas.width / W, scaleY = canvas.height / H;
let activity = new Float32Array(W * H);

// Tiny CNN: two conv layers
const filters1 = 4, filters2 = 4;
let kernels1 = initKernels(filters1, 1, 3);
let kernels2 = initKernels(filters2, filters1, 3);

function initKernels(outC, inC, k) {
  const arr = new Float32Array(outC * inC * k * k);
  for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 0.4;
  return arr;
}

function conv2d(input, inH, inW, inC, kernels, outC, k=3) {
  const outH = inH - k + 1, outW = inW - k + 1;
  const out = new Float32Array(outC * outH * outW);
  for (let oc = 0; oc < outC; oc++) {
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        let sum = 0;
        for (let ic = 0; ic < inC; ic++) {
          for (let ky = 0; ky < k; ky++) {
            for (let kx = 0; kx < k; kx++) {
              const ix = x + kx, iy = y + ky;
              const iIdx = ic * inH * inW + iy * inW + ix;
              const kIdx = ((oc * inC + ic) * k + ky) * k + kx;
              sum += input[iIdx] * kernels[kIdx];
            }
          }
        }
        out[oc * outH * outW + y * outW + x] = Math.max(0, sum); // ReLU
      }
    }
  }
  return { data: out, h: outH, w: outW, c: outC };
}

function pool2d(input, inH, inW, inC, s=2) {
  const outH = Math.floor(inH / s), outW = Math.floor(inW / s);
  const out = new Float32Array(inC * outH * outW);
  for (let c = 0; c < inC; c++) {
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        let maxv = -Infinity;
        for (let dy = 0; dy < s; dy++) {
          for (let dx = 0; dx < s; dx++) {
            const ix = x*s + dx, iy = y*s + dy;
            const idx = c * inH * inW + iy * inW + ix;
            if (idx < input.length) maxv = Math.max(maxv, input[idx]);
          }
        }
        out[c * outH * outW + y * outW + x] = maxv;
      }
    }
  }
  return { data: out, h: outH, w: outW, c: inC };
}

// Portals
const N = 6;
const portals = [];
for (let i = 0; i < N; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `Portal ${i+1}\nClick to reward`;
  el.style.left = (20 + Math.random()*60) + '%';
  el.style.top = (20 + Math.random()*50) + '%';
  el.onclick = () => reward();
  portalsEl.appendChild(el);
  portals.push({ el, x: Math.random(), y: Math.random(), hue: i*60 });
}

function reward() {
  // Mutate a random kernel weight
  const which = Math.random() < 0.5 ? kernels1 : kernels2;
  const idx = Math.floor(Math.random() * which.length);
  which[idx] += (Math.random() - 0.5) * 0.15;
  statusEl.textContent = 'Kernel mutated by reward. Continue exploring.';
}

function updateActivity(px, py) {
  const x = Math.floor(px * W), y = Math.floor(py * H);
  if (x>=0 && x<W && y>=0 && y<H) activity[y*W + x] = Math.min(1, activity[y*W + x] + 0.4);
}

function decayActivity() {
  for (let i = 0; i < activity.length; i++) activity[i] *= 0.92;
}

function drawActivity() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = activity[y*W + x];
      const c = Math.floor(v * 255);
      for (let dy = 0; dy < scaleY; dy++) {
        for (let dx = 0; dx < scaleX; dx++) {
          const px = Math.floor(x*scaleX + dx), py = Math.floor(y*scaleY + dy);
          const idx = (py * canvas.width + px) * 4;
          img.data[idx] = c; img.data[idx+1] = c*0.6; img.data[idx+2] = 255-c; img.data[idx+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

let mouseX = 0.5, mouseY = 0.5;
document.addEventListener('pointermove', e => {
  mouseX = e.clientX / window.innerWidth;
  mouseY = e.clientY / window.innerHeight;
  updateActivity(mouseX, mouseY);
});

function step() {
  decayActivity();
  updateActivity(mouseX, mouseY);

  // CNN forward
  const in1 = { data: activity, h: H, w: W, c: 1 };
  const c1 = conv2d(in1.data, in1.h, in1.w, in1.c, kernels1, filters1);
  const p1 = pool2d(c1.data, c1.h, c1.w, c1.c);
  const c2 = conv2d(p1.data, p1.h, p1.w, p1.c, kernels2, filters2);
  const p2 = pool2d(c2.data, c2.h, c2.w, c2.c);

  // Global features: mean per filter
  const feats = new Float32Array(filters2);
  const sz = p2.h * p2.w;
  for (let f = 0; f < filters2; f++) {
    let s = 0;
    for (let i = 0; i < sz; i++) s += p2.data[f*sz + i];
    feats[f] = s / sz;
  }

  // Drive portals
  portals.forEach((p, i) => {
    const f = feats[i % filters2] || 0;
    const scale = 0.7 + Math.min(1.2, f * 2);
    const hue = (p.hue + f * 180) % 360;
    const ox = (feats[(i+1)%filters2] - 0.2) * 40;
    const oy = (feats[(i+2)%filters2] - 0.2) * 30;
    p.el.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
    p.el.style.background = `hsl(${hue}, 70%, 18%)`;
    p.el.style.borderRadius = `${8 + f*20}px`;
  });

  drawActivity();
  requestAnimationFrame(step);
}
step();

// Persistence
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f835', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('mind');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind', 'readwrite');
    tx.objectStore('mind').put({ kernels1: Array.from(kernels1), kernels2: Array.from(kernels2) }, 'state');
    statusEl.textContent = 'Mind sealed to IndexedDB.';
  } catch(e) { statusEl.textContent = 'Seal failed (private mode?).'; }
}
document.getElementById('seal').onclick = seal;

document.getElementById('reset').onclick = () => {
  kernels1 = initKernels(filters1, 1, 3);
  kernels2 = initKernels(filters2, filters1, 3);
  statusEl.textContent = 'Kernels reset to random.';
};

document.getElementById('demo').onclick = () => {
  // Synthetic activity bursts
  for (let i = 0; i < 20; i++) {
    const x = Math.random(), y = Math.random();
    for (let j = 0; j < 5; j++) updateActivity(x + (Math.random()-0.5)*0.1, y + (Math.random()-0.5)*0.1);
  }
  statusEl.textContent = 'Demo activity injected.';
};

// Try restore
(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f835', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind', 'readonly');
    const req = tx.objectStore('mind').get('state');
    req.onsuccess = () => {
      if (req.result) {
        kernels1 = new Float32Array(req.result.kernels1);
        kernels2 = new Float32Array(req.result.kernels2);
        statusEl.textContent = 'Previous mind restored.';
      }
    };
  } catch (e) { console.debug("lab f835-canvas-cnn-spatial-feature-portal-mind:", e); }
})();
