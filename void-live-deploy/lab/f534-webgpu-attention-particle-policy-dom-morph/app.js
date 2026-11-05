const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const cardsEl = document.getElementById('cards');
const info = document.getElementById('info');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 160;
let particles = [];
function resetParticles() {
  particles = Array.from({length:N}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    e: 0
  }));
}
resetParticles();

// Tiny MLP: 6 in -> 8 hidden -> 4 out
let W1 = Array.from({length:8}, () => Array.from({length:6}, () => (Math.random()-0.5)*0.6));
let b1 = Array(8).fill(0);
let W2 = Array.from({length:4}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.6));
let b2 = Array(4).fill(0);
let fitness = 0, bestFitness = 0;
let pointer = {x: W/2, y: H/2, active: false};

function relu(x) { return Math.max(0, x); }
function forward(input) {
  const h = W1.map((row,i) => relu(row.reduce((s,w,j)=>s+w*input[j],0) + b1[i]));
  return W2.map((row,i) => row.reduce((s,w,j)=>s+w*h[j],0) + b2[i]);
}
function mutate() {
  const rate = 0.08;
  W1 = W1.map(row => row.map(w => w + (Math.random()-0.5)*rate));
  W2 = W2.map(row => row.map(w => w + (Math.random()-0.5)*rate));
}

// Cards
const cards = [];
for (let i=0; i<6; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = `Probe ${i+1}`;
  el.style.left = (80 + i*160) % (W-160) + 'px';
  el.style.top = (60 + (i%3)*140) + 'px';
  el.addEventListener('click', () => {
    fitness += 1.5;
    if (fitness > bestFitness) {
      bestFitness = fitness;
      mutate(); // evolve on improvement
    }
    el.style.boxShadow = '0 0 40px #fff';
    setTimeout(()=>el.style.boxShadow='', 300);
  });
  // simple drag
  let dragging = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if(dragging){ el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; }});
  el.addEventListener('pointerup', () => dragging=false);
  cardsEl.appendChild(el);
  cards.push(el);
}

canvas.addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; pointer.active=true; });
canvas.addEventListener('pointerleave', () => pointer.active=false);

// Optional orientation
let orient = {beta:0, gamma:0};
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if(p==='granted') window.addEventListener('deviceorientation', e => { orient.beta=e.beta||0; orient.gamma=e.gamma||0; }); });
  } else {
    window.addEventListener('deviceorientation', e => { orient.beta=e.beta||0; orient.gamma=e.gamma||0; });
  }
};

function step() {
  // Aggregate stats
  let mx=0, my=0, vx2=0, vy2=0, energy=0;
  for (const p of particles) { mx+=p.x; my+=p.y; energy += p.vx*p.vx + p.vy*p.vy; }
  mx/=N; my/=N; energy/=N;
  for (const p of particles) { vx2 += (p.x-mx)**2; vy2 += (p.y-my)**2; }
  vx2/=N; vy2/=N;

  const input = [
    (mx/W)*2-1, (my/H)*2-1,
    Math.min(vx2/10000,1), Math.min(vy2/10000,1),
    (pointer.x/W)*2-1, Math.min(energy/4,1)
  ];
  const out = forward(input);
  const scale = 0.7 + Math.tanh(out[0])*0.6;
  const hue = ((out[1]*40 + 200) % 360 + 360) % 360;
  const blur = Math.max(0, Math.min(10, out[2]*3));
  const pulse = 0.5 + Math.tanh(out[3])*0.4;

  document.documentElement.style.setProperty('--scale', scale);
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--blur', blur+'px');
  document.documentElement.style.setProperty('--pulse', pulse);

  // Particle update with attention
  const meanX = mx, meanY = my;
  for (const p of particles) {
    // Global attention to mean
    let ax = (meanX - p.x) * 0.002;
    let ay = (meanY - p.y) * 0.002;
    // Pointer attractor
    if (pointer.active) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      ax += dx / d2 * 80;
      ay += dy / d2 * 80;
    }
    // Orientation bias
    ax += orient.gamma * 0.0005;
    ay += orient.beta * 0.0005;
    p.vx = (p.vx + ax) * 0.96;
    p.vy = (p.vy + ay) * 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-0.8;
    if (p.y<0||p.y>H) p.vy*=-0.8;
    p.x = Math.max(0,Math.min(W,p.x));
    p.y = Math.max(0,Math.min(H,p.y));
  }

  // Draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = `hsla(${hue},80%,70%,0.8)`;
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  }

  // Local density for cards
  cards.forEach((el,i) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    let dens = 0;
    for (const p of particles) {
      const d = Math.hypot(p.x-cx, p.y-cy);
      if (d < 80) dens += 1 - d/80;
    }
    el.textContent = `Probe ${i+1}\nρ=${dens.toFixed(1)}`;
    el.style.background = `hsla(${hue + dens*10},70%,${30+dens*5}%,0.75)`;
  });

  info.textContent = `Particles: ${N} | Fitness: ${fitness.toFixed(1)} | Best: ${bestFitness.toFixed(1)} | Seal: ${window.lastSeal||'none'}`;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Seal
document.getElementById('seal').onclick = async () => {
  const payload = {W1,W2,b1,b2,fitness:bestFitness};
  const buf = new TextEncoder().encode(JSON.stringify(payload));
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  window.lastSeal = hash.slice(0,12);
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f534',1);
      r.onupgradeneeded = () => r.result.createObjectStore('policy');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('policy','readwrite');
    tx.objectStore('policy').put({hash, payload, t:Date.now()}, 'latest');
    const bc = new BroadcastChannel('f534-attention');
    bc.postMessage({hash, payload});
  } catch(e) { console.warn(e); }
  info.textContent += ' | sealed';
};

document.getElementById('reset').onclick = () => { resetParticles(); fitness=0; };

// Listen for adoption
try {
  const bc = new BroadcastChannel('f534-attention');
  bc.onmessage = e => {
    if (e.data.payload && e.data.payload.fitness > bestFitness) {
      ({W1,W2,b1,b2} = e.data.payload);
      bestFitness = e.data.payload.fitness;
      window.lastSeal = e.data.hash.slice(0,12);
    }
  };
} catch(e){}
