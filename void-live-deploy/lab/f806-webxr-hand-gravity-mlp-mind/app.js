const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 180;
let particles = [];
function resetParticles() {
  particles = Array.from({length:N}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*1, vy: (Math.random()-0.5)*1,
    m: 0.5 + Math.random()*1.5
  }));
}
resetParticles();

// Tiny MLP: 6 -> 8 -> 2 (grav_scale, damping)
let w1 = Array.from({length:6}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5));
let b1 = Array(8).fill(0);
let w2 = Array.from({length:8}, () => Array.from({length:2}, () => (Math.random()-0.5)*0.5));
let b2 = Array(2).fill(0);
function mlp(input) {
  let h = b1.map((b,i) => b + input.reduce((s,x,j)=>s+x*w1[j][i],0));
  h = h.map(x => Math.tanh(x));
  let o = b2.map((b,i) => b + h.reduce((s,x,j)=>s+x*w2[j][i],0));
  return o.map(x => Math.tanh(x));
}

let handX = W/2, handY = H/2, pinch = 0, gravScale = 1, damping = 0.99;
let xrSession = null, refSpace = null;

// Pointer fallback
let pointerDown = false;
canvas.addEventListener('pointerdown', e => { pointerDown = true; updateHand(e); });
canvas.addEventListener('pointermove', e => { if (pointerDown || !xrSession) updateHand(e); });
canvas.addEventListener('pointerup', () => { pointerDown = false; pinch = 0; });
function updateHand(e) {
  handX = e.clientX; handY = e.clientY;
  pinch = pointerDown ? 1 : 0;
}

// WebXR hand tracking
async function enterXR() {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    refSpace = await xrSession.requestReferenceSpace('local');
    xrSession.addEventListener('end', () => { xrSession = null; document.getElementById('status').textContent = 'Verse · F806 · pointer fallback'; });
    xrSession.requestAnimationFrame(onXRFrame);
    document.getElementById('status').textContent = 'Verse · F806 · WebXR hand active';
  } catch(e) { console.warn(e); alert('XR failed: ' + e.message); }
}
document.getElementById('xrBtn').onclick = enterXR;

function onXRFrame(t, frame) {
  if (!xrSession) return;
  xrSession.requestAnimationFrame(onXRFrame);
  const poses = [];
  for (const source of xrSession.inputSources) {
    if (source.hand) {
      const index = source.hand.get('index-finger-tip');
      const thumb = source.hand.get('thumb-tip');
      if (index && thumb) {
        const ip = frame.getPose(index, refSpace);
        const tp = frame.getPose(thumb, refSpace);
        if (ip && tp) {
          const dx = ip.transform.position.x - tp.transform.position.x;
          const dy = ip.transform.position.y - tp.transform.position.y;
          const dist = Math.hypot(dx,dy);
          pinch = dist < 0.03 ? 1 : 0;
          // Map to screen approx (simple)
          handX = W/2 + ip.transform.position.x * 400;
          handY = H/2 - ip.transform.position.y * 400;
        }
      }
    }
  }
  step();
}

// Portals
const portals = [];
for (let i=0; i<3; i++) {
  const p = document.createElement('div');
  p.className = 'portal';
  p.style.left = (100 + i*120) + 'px';
  p.style.top = (H - 100) + 'px';
  p.textContent = 'Portal ' + (i+1);
  p.dataset.mass = 2;
  document.body.appendChild(p);
  makeDraggable(p);
  portals.push(p);
}
function makeDraggable(el) {
  let ox, oy;
  el.onpointerdown = e => { ox = e.clientX - parseFloat(el.style.left); oy = e.clientY - parseFloat(el.style.top); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (e.buttons) { el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; } };
}

// Seal
async function seal() {
  const genome = { w1, b1, w2, b2, particles: particles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,m:p.m})) };
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open('verse-f806',1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(genome, 'sealed');
  document.getElementById('status').textContent = 'Sealed to IndexedDB';
}
document.getElementById('sealBtn').onclick = seal;
document.getElementById('resetBtn').onclick = resetParticles;

// Main loop
function step() {
  // MLP input
  const cx = particles.reduce((s,p)=>s+p.x,0)/N;
  const cy = particles.reduce((s,p)=>s+p.y,0)/N;
  const energy = particles.reduce((s,p)=>s+p.vx*p.vx+p.vy*p.vy,0)/N;
  const inp = [(handX-cx)/W, (handY-cy)/H, 0, 0, pinch, Math.min(energy,2)];
  const out = mlp(inp);
  gravScale = 0.5 + out[0]*1.5;
  damping = 0.98 + out[1]*0.015;

  // Physics
  for (let i=0; i<N; i++) {
    let fx=0, fy=0;
    const p = particles[i];
    // pairwise (sparse for speed)
    for (let j=i+1; j<N; j+=3) {
      const q = particles[j];
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = gravScale * 80 * p.m * q.m / d2;
      const inv = 1/Math.sqrt(d2);
      fx += f * dx * inv; fy += f * dy * inv;
    }
    // hand
    const hdx = handX - p.x, hdy = handY - p.y;
    const hd2 = hdx*hdx + hdy*hdy + 200;
    const hf = (pinch ? -1 : 1) * gravScale * 200 / hd2;
    const hinv = 1/Math.sqrt(hd2);
    fx += hf * hdx * hinv; fy += hf * hdy * hinv;
    // portals
    for (const port of portals) {
      const px = parseFloat(port.style.left)+40, py = parseFloat(port.style.top)+30;
      const dx = px - p.x, dy = py - p.y;
      const d2 = dx*dx + dy*dy + 150;
      const f = 1.5 * 100 / d2;
      const inv = 1/Math.sqrt(d2);
      fx += f * dx * inv; fy += f * dy * inv;
    }
    p.vx = (p.vx + fx*0.01) * damping;
    p.vy = (p.vy + fy*0.01) * damping;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx *= -0.8;
    if (p.y<0||p.y>H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }

  // Draw
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#aaf';
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.m*1.2, 0, 6.28); ctx.fill();
  }
  // hand marker
  ctx.strokeStyle = pinch ? '#f66' : '#6f6';
  ctx.beginPath(); ctx.arc(handX, handY, 20, 0, 6.28); ctx.stroke();
  document.getElementById('info').textContent = `Particles: ${N} | Grav: ${gravScale.toFixed(2)} | Pinch: ${pinch}`;
}

function loop() { if (!xrSession) step(); requestAnimationFrame(loop); }
loop();
