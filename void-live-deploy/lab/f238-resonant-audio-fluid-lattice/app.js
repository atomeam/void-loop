const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let w, h, particles = [], orbs = [], history = [];
let orient = {b:0, g:0, a:0}, audioLevel = 0, analyser, aiState = {visc: 0.85, force: 0.4, residual: 0};
let running = true;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize); resize();

function spawn(n=400) {
  particles = [];
  for (let i = 0; i < n; i++) {
    particles.push({
      x: Math.random()*w, y: Math.random()*h,
      vx: 0, vy: 0,
      life: Math.random(),
      hue: Math.random()*60 + 180
    });
  }
}
spawn();

function updateOrbs() {
  const grid = 8, peaks = [];
  for (let gy=0; gy<grid; gy++) for (let gx=0; gx<grid; gx++) {
    let count = 0, sx=0, sy=0;
    const cx = (gx+0.5)*w/grid, cy = (gy+0.5)*h/grid;
    for (const p of particles) {
      const dx = p.x-cx, dy = p.y-cy;
      if (dx*dx + dy*dy < (w/grid)**2) { count++; sx+=p.x; sy+=p.y; }
    }
    if (count > 12) peaks.push({x: sx/count, y: sy/count, d: count});
  }
  peaks.sort((a,b)=>b.d-a.d);
  while (orbs.length < Math.min(5, peaks.length)) {
    const el = document.createElement('div');
    el.className = 'orb';
    el.style.left = '0px'; el.style.top = '0px';
    document.body.appendChild(el);
    orbs.push({el, x:0, y:0, vx:0, vy:0});
  }
  orbs.forEach((o,i) => {
    if (i < peaks.length) {
      o.x = peaks[i].x; o.y = peaks[i].y;
      o.el.style.left = (o.x-24)+'px';
      o.el.style.top = (o.y-24)+'px';
      o.el.style.opacity = Math.min(1, peaks[i].d/40);
    } else o.el.style.opacity = 0;
  });
}

let drag = null;
document.addEventListener('pointerdown', e => {
  for (const o of orbs) {
    const r = o.el.getBoundingClientRect();
    if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) {
      drag = {o, ox: e.clientX - o.x, oy: e.clientY - o.y};
      break;
    }
  }
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.o.x = e.clientX - drag.ox;
  drag.o.y = e.clientY - drag.oy;
  drag.o.el.style.left = (drag.o.x-24)+'px';
  drag.o.el.style.top = (drag.o.y-24)+'px';
  for (const p of particles) {
    const dx = p.x - drag.o.x, dy = p.y - drag.o.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < 12000) {
      const f = 0.8 / (1 + d2*0.0005);
      p.vx += (e.movementX||0)*f*0.4;
      p.vy += (e.movementY||0)*f*0.4;
    }
  }
});
document.addEventListener('pointerup', () => drag = null);

function stepAI() {
  const feat = [orient.b/90, orient.g/90, audioLevel, aiState.residual, Math.sin(Date.now()*0.001)];
  let z = feat.reduce((s,v,i) => s + v * (0.3 - i*0.1), 0.1);
  z = Math.tanh(z);
  aiState.residual = 0.9*aiState.residual + 0.1*z;
  aiState.visc = 0.6 + 0.4*Math.abs(aiState.residual);
  aiState.force = 0.2 + 0.6*(audioLevel + Math.abs(orient.b)/180);
  history.push(aiState.residual);
  if (history.length > 60) history.shift();
}

function step() {
  if (!running) return;
  stepAI();
  const visc = aiState.visc;
  const force = aiState.force;
  const ox = Math.sin(orient.g * Math.PI/180) * force * 2;
  const oy = Math.sin(orient.b * Math.PI/180) * force * 2;
  for (const p of particles) {
    let ax=ox, ay=oy;
    for (const o of orbs) {
      if (o.el.style.opacity > 0.1) {
        const dx = o.x - p.x, dy = o.y - p.y;
        const d = Math.hypot(dx,dy)+1;
        ax += dx/d * 0.15 * force;
        ay += dy/d * 0.15 * force;
      }
    }
    p.vx = p.vx*visc + ax*0.4 + (Math.random()-0.5)*0.2;
    p.vy = p.vy*visc + ay*0.4 + (Math.random()-0.5)*0.2;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>w) p.vx*=-0.7;
    if (p.y<0||p.y>h) p.vy*=-0.7;
    p.x = Math.max(0,Math.min(w,p.x));
    p.y = Math.max(0,Math.min(h,p.y));
  }
  let dens = 0;
  for (const p of particles) dens += Math.abs(p.vx)+Math.abs(p.vy);
  dens /= particles.length * 5;
  document.documentElement.style.setProperty('--density', dens.toFixed(2));
  document.documentElement.style.setProperty('--ai', Math.abs(aiState.residual).toFixed(2));
  document.body.classList.toggle('morph', dens > 0.15);
  document.getElementById('stats').innerHTML =
    `orient β:${orient.b.toFixed(0)} γ:${orient.g.toFixed(0)}<br>` +
    `audio: ${audioLevel.toFixed(2)}<br>` +
    `ai residual: ${aiState.residual.toFixed(3)}<br>` +
    `density: ${dens.toFixed(3)} visc: ${visc.toFixed(2)}`;
  if (Math.random() < 0.05) updateOrbs();
  requestAnimationFrame(step);
}

function draw() {
  ctx.fillStyle = 'rgba(5,8,15,0.25)';
  ctx.fillRect(0,0,w,h);
  for (const p of particles) {
    ctx.fillStyle = `hsla(${p.hue + aiState.residual*40}, 80%, 60%, 0.7)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8 + Math.abs(p.vx)*0.5, 0, 6.28);
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
step(); draw();

document.getElementById('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const actx = new AudioContext();
    const src = actx.createMediaStreamSource(stream);
    analyser = actx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let s=0; for(let i=0;i<data.length;i++) s+=data[i];
      audioLevel = s / data.length / 255;
      requestAnimationFrame(tick);
    };
    tick();
    document.getElementById('mic').textContent = 'Mic On';
  } catch(e) { console.warn(e); }
};

document.getElementById('orient').onclick = async () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== 'granted') return;
  }
  window.addEventListener('deviceorientation', e => {
    orient.b = e.beta || 0;
    orient.g = e.gamma || 0;
    orient.a = e.alpha || 0;
  });
  document.getElementById('orient').textContent = 'Orient On';
};

document.getElementById('sealbtn').onclick = async () => {
  const snap = {
    t: Date.now(),
    residual: aiState.residual,
    history: history.slice(-30),
    particleCount: particles.length,
    density: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--density'))
  };
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open('void-f238', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('seals', {keyPath:'t'});
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
  const tx = db.transaction('seals','readwrite');
  tx.objectStore('seals').put(snap);
  document.getElementById('seal').textContent = 'Sealed ' + new Date().toLocaleTimeString();
};

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      orient.b = e.beta; orient.g = e.gamma; orient.a = e.alpha;
    }
  });
}
