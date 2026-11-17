const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
addEventListener('resize', () => { W = cv.width = innerWidth; H = cv.height = innerHeight; });

const N = 180;
const particles = [];
const portals = [];
let weights = JSON.parse(localStorage.getItem('verse-f777-sph') || 'null') || Array(8).fill(0).map(() => (Math.random()-0.5)*0.2);
let orient = {x:0, y:0};

class Particle {
  constructor() {
    this.x = Math.random()*W; this.y = Math.random()*H;
    this.vx = (Math.random()-0.5)*2; this.vy = (Math.random()-0.5)*2;
    this.density = 1; this.pressure = 0;
  }
}

for (let i=0; i<N; i++) particles.push(new Particle());

for (let i=0; i<4; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Buoy '+(i+1);
  el.style.left = (100 + i*150)+'px';
  el.style.top = (100 + i*80)+'px';
  document.getElementById('portals').appendChild(el);
  portals.push({el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0});
}

function policy(inputs) {
  const h = [0,0,0,0];
  for (let i=0; i<4; i++) {
    h[i] = Math.tanh(inputs[0]*weights[i*2] + inputs[1]*weights[i*2+1] + (weights[8+i]||0));
  }
  return [h[0]*0.5 + h[1]*0.3, h[2]*0.5 + h[3]*0.3];
}

let mx=0, my=0, pmx=0, pmy=0;
addEventListener('pointermove', e => { pmx=mx; pmy=my; mx=e.clientX; my=e.clientY; });
addEventListener('pointerdown', e => { mx=e.clientX; my=e.clientY; });

window.addEventListener('deviceorientation', e => {
  orient.x = (e.gamma||0)/90;
  orient.y = (e.beta||0)/90;
});

function sphStep() {
  const h = 40;
  const rest = 5;
  for (let p of particles) {
    p.density = 0;
    for (let q of particles) {
      const dx=p.x-q.x, dy=p.y-q.y, r2=dx*dx+dy*dy;
      if (r2 < h*h) p.density += Math.max(0, 1 - Math.sqrt(r2)/h);
    }
    p.density = Math.max(0.1, p.density / 8);
    p.pressure = Math.max(0, p.density - rest) * 20;
  }
  const inputs = [orient.x, orient.y, (mx-pmx)*0.1, (my-pmy)*0.1, particles.reduce((s,p)=>s+p.density,0)/N, Date.now()*0.001 % 10];
  const [fx, fy] = policy(inputs);
  for (let p of particles) {
    let ax=fx*2, ay=fy*2 + 0.05;
    for (let q of particles) {
      if (p===q) continue;
      const dx=p.x-q.x, dy=p.y-q.y, r=Math.hypot(dx,dy)+0.1;
      if (r < h) {
        const f = (p.pressure + q.pressure) / (2 * q.density) * (1 - r/h) * 0.5;
        ax -= (dx/r)*f; ay -= (dy/r)*f;
      }
    }
    p.vx = p.vx*0.98 + ax;
    p.vy = p.vy*0.98 + ay;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-0.8;
    if (p.y<0||p.y>H) p.vy*=-0.8;
    p.x = Math.max(0,Math.min(W,p.x));
    p.y = Math.max(0,Math.min(H,p.y));
  }
  for (let po of portals) {
    let dens=0, cx=0, cy=0, c=0;
    for (let p of particles) {
      const d = Math.hypot(p.x-po.x, p.y-po.y);
      if (d < 60) { dens += p.density; cx += p.x; cy += p.y; c++; }
    }
    if (c) {
      po.vx += (cx/c - po.x)*0.02;
      po.vy += (cy/c - po.y)*0.02;
    }
    po.vx *= 0.95; po.vy *= 0.95;
    po.x += po.vx; po.y += po.vy;
    po.el.style.left = po.x+'px';
    po.el.style.top = po.y+'px';
    po.el.style.transform = `scale(${1 + dens*0.05})`;
    po.el.style.background = `rgba(${40+dens*10}, ${60}, ${120+dens*5}, 0.7)`;
  }
  if (navigator.vibrate && Math.abs(fx)+Math.abs(fy) > 0.4) {
    navigator.vibrate(10);
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  for (let p of particles) {
    const a = Math.min(1, p.density/8);
    ctx.fillStyle = `hsla(${200 + p.pressure*2}, 70%, ${50+a*30}%, ${0.4+a*0.4})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + p.density*0.5, 0, Math.PI*2);
    ctx.fill();
  }
}

function loop() {
  sphStep();
  draw();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = () => {
  weights = weights.map(w => w + (Math.random()-0.5)*0.05);
  localStorage.setItem('verse-f777-sph', JSON.stringify(weights));
  document.getElementById('status').textContent = 'Genome sealed';
};
document.getElementById('reset').onclick = () => {
  weights = Array(12).fill(0).map(() => (Math.random()-0.5)*0.3);
  localStorage.removeItem('verse-f777-sph');
  document.getElementById('status').textContent = 'Reset';
};
