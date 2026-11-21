const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const status = document.getElementById('status');
const sealBtn = document.getElementById('seal');

let W = 120, H = 68;
function resize() {
  canvas.width = W; canvas.height = H;
  canvas.style.width = '100vw'; canvas.style.height = '100vh';
}
resize();

// SDF spheres
const N = 5;
let spheres = Array.from({length:N}, (_,i) => ({
  x: (Math.random()-0.5)*1.6,
  y: (Math.random()-0.5)*1.2,
  z: 2.5 + Math.random()*1.5,
  r: 0.35 + Math.random()*0.25
}));

// Policy: features → actions
// features: gazeX, gazeY, gazeVx, gazeVy, densitySample, timeSin
let weights = new Float32Array(6 * 4); // 6 in → 4 out (dx,dy,dz,dr)
for (let i=0;i<weights.length;i++) weights[i] = (Math.random()-0.5)*0.08;

let pointer = {x:0.5, y:0.5, vx:0, vy:0, prevX:0.5, prevY:0.5};
let lastReward = 0;
let frame = 0;

function policyStep(features) {
  const out = new Float32Array(4);
  for (let o=0;o<4;o++) {
    let s = 0;
    for (let f=0;f<6;f++) s += features[f] * weights[o*6 + f];
    out[o] = Math.tanh(s) * 0.012;
  }
  return out;
}

function updatePolicy(features, reward) {
  if (Math.abs(reward) < 0.01) return;
  const lr = 0.015 * Math.sign(reward);
  for (let o=0;o<4;o++) {
    for (let f=0;f<6;f++) {
      weights[o*6 + f] += lr * features[f] * 0.1;
    }
  }
  // soft clip
  for (let i=0;i<weights.length;i++) weights[i] = Math.max(-0.4, Math.min(0.4, weights[i]));
}

function sdf(p) {
  let d = 1e6;
  for (const s of spheres) {
    const dx = p.x - s.x, dy = p.y - s.y, dz = p.z - s.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) - s.r;
    d = Math.min(d, dist);
  }
  return d;
}

function raymarch(ro, rd) {
  let t = 0.1;
  for (let i=0;i<20;i++) {
    const p = {x: ro.x + rd.x*t, y: ro.y + rd.y*t, z: ro.z + rd.z*t};
    const d = sdf(p);
    if (d < 0.01) return t;
    t += d * 0.8;
    if (t > 8) break;
  }
  return -1;
}

function render() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const u = (x / W) * 2 - 1;
      const v = (y / H) * 2 - 1;
      const ro = {x:0, y:0, z:0};
      const rd = {x: u*0.9, y: -v*0.6, z: 1};
      const len = Math.sqrt(rd.x*rd.x + rd.y*rd.y + rd.z*rd.z);
      rd.x/=len; rd.y/=len; rd.z/=len;
      const t = raymarch(ro, rd);
      let r=8,g=8,b=18;
      if (t > 0) {
        const p = {x: ro.x + rd.x*t, y: ro.y + rd.y*t, z: ro.z + rd.z*t};
        const d = sdf(p);
        const shade = Math.max(0, 1 - Math.abs(d)*4);
        const hue = 200 + p.y * 40;
        r = Math.min(255, 40 + shade*180);
        g = Math.min(255, 30 + shade*140);
        b = Math.min(255, 80 + shade*160);
      }
      const i = (y*W + x)*4;
      data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function sampleDensity(gx, gy) {
  const u = gx*2-1, v = gy*2-1;
  const ro = {x:0,y:0,z:0};
  const rd = {x:u*0.9, y:-v*0.6, z:1};
  const len = Math.sqrt(rd.x*rd.x+rd.y*rd.y+rd.z*rd.z);
  rd.x/=len; rd.y/=len; rd.z/=len;
  const t = raymarch(ro, rd);
  if (t < 0) return 0;
  const p = {x:ro.x+rd.x*t, y:ro.y+rd.y*t, z:ro.z+rd.z*t};
  return Math.max(0, 1 - Math.abs(sdf(p))*3);
}

function tick() {
  frame++;
  // features
  const dens = sampleDensity(pointer.x, pointer.y);
  const features = new Float32Array([
    pointer.x - 0.5,
    pointer.y - 0.5,
    pointer.vx,
    pointer.vy,
    dens,
    Math.sin(frame * 0.02)
  ]);
  const act = policyStep(features);
  // apply to spheres (soft)
  for (let i=0;i<N;i++) {
    const s = spheres[i];
    s.x += act[0] * (0.4 + i*0.1);
    s.y += act[1] * (0.4 + i*0.1);
    s.z += act[2] * 0.3;
    s.r += act[3] * 0.15;
    s.r = Math.max(0.15, Math.min(0.8, s.r));
    s.x = Math.max(-2, Math.min(2, s.x));
    s.y = Math.max(-1.5, Math.min(1.5, s.y));
    s.z = Math.max(1.2, Math.min(5, s.z));
  }
  // light diffusion / attraction toward gaze
  const targetX = (pointer.x-0.5)*1.2;
  const targetY = (0.5-pointer.y)*0.8;
  spheres[0].x += (targetX - spheres[0].x) * 0.01;
  spheres[0].y += (targetY - spheres[0].y) * 0.01;

  render();
  hud.textContent = `Gaze SDF · dens ${dens.toFixed(2)} · reward ${lastReward.toFixed(2)} · sealed`;
  requestAnimationFrame(tick);
}

canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  pointer.vx = nx - pointer.prevX;
  pointer.vy = ny - pointer.prevY;
  pointer.prevX = pointer.x;
  pointer.prevY = pointer.y;
  pointer.x = nx;
  pointer.y = ny;
});

canvas.addEventListener('pointerdown', e => {
  const dens = sampleDensity(pointer.x, pointer.y);
  lastReward = dens > 0.35 ? 1 : -0.2;
  const features = new Float32Array([
    pointer.x-0.5, pointer.y-0.5, pointer.vx, pointer.vy, dens, Math.sin(frame*0.02)
  ]);
  updatePolicy(features, lastReward);
  status.textContent = lastReward > 0 ? 'rewarded high density' : 'low density';
});

// Seal
async function seal() {
  const payload = {
    spheres: spheres.map(s => ({...s})),
    weights: Array.from(weights),
    ts: Date.now()
  };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f870', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put(payload, 'genome');
    await new Promise(r => tx.oncomplete = r);
  } catch(e) {
    sessionStorage.setItem('verse-f870', JSON.stringify(payload));
  }
  try {
    const bc = new BroadcastChannel('f870-sdf');
    bc.postMessage(payload);
  } catch (e) { console.debug("lab f870-webxr-gaze-sdf-policy-sculptor-mind:", e); }
  status.textContent = 'sealed + broadcast';
}

async function loadSeal() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f870', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('genome');
    const payload = await new Promise(r => { req.onsuccess = () => r(req.result); });
    if (payload) {
      spheres = payload.spheres;
      weights.set(payload.weights);
      status.textContent = 'restored from seal';
    }
  } catch(e) {
    const s = sessionStorage.getItem('verse-f870');
    if (s) {
      const payload = JSON.parse(s);
      spheres = payload.spheres;
      weights.set(payload.weights);
    }
  }
  try {
    const bc = new BroadcastChannel('f870-sdf');
    bc.onmessage = e => {
      if (e.data && e.data.spheres) {
        spheres = e.data.spheres;
        weights.set(e.data.weights);
        status.textContent = 'adopted from other tab';
      }
    };
  } catch (e) { console.debug("lab f870-webxr-gaze-sdf-policy-sculptor-mind:", e); }
}

sealBtn.addEventListener('click', seal);
loadSeal().then(() => requestAnimationFrame(tick));

// optional WebXR probe
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (supported) status.textContent += ' · WebXR available';
  }).catch(()=>{});
}
