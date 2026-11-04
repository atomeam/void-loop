const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const status = document.getElementById('status');
const lightSlider = document.getElementById('lightSlider');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

let illuminance = 200;
let sensor = null;
let particles = [];
let portals = [];
let lightHistory = [200,200,200];
const MAX_PARTICLES = 100;
const MAX_PORTALS = 8;

function rand(a,b){ return a + Math.random()*(b-a); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

// Tiny MLP: 3 inputs -> 4 hidden -> 2 outputs
function mlp(w, x) {
  const h = new Array(4).fill(0);
  for(let i=0;i<4;i++) for(let j=0;j<3;j++) h[i] += w[i*3+j] * x[j];
  for(let i=0;i<4;i++) h[i] = Math.tanh(h[i]);
  const o = [0,0];
  for(let i=0;i<2;i++) for(let j=0;j<4;j++) o[i] += w[12 + i*4 + j] * h[j];
  return o.map(v => Math.tanh(v));
}

function makeWeights() {
  return Array.from({length:20}, () => rand(-0.5,0.5));
}

function spawnParticle(x,y) {
  if(particles.length >= MAX_PARTICLES) return;
  particles.push({
    x: x||rand(50,W-50), y: y||rand(50,H-50),
    vx:0, vy:0, energy: rand(10,40),
    w: makeWeights(), fitness:0, id: Math.random()
  });
}

function spawnPortal() {
  if(portals.length >= MAX_PORTALS) return;
  const p = document.createElement('div');
  p.className = 'portal';
  p.textContent = 'Portal';
  portalsEl.appendChild(p);
  portals.push({ el:p, x:rand(100,W-200), y:rand(100,H-150), vx:0, vy:0, scale:1 });
}

function update() {
  lightHistory.push(illuminance);
  if(lightHistory.length > 8) lightHistory.shift();
  const lightDelta = illuminance - lightHistory[0];

  // Particle metabolism + MLP control
  for(const p of particles) {
    const absorption = Math.min(illuminance / 500, 2) * 0.8;
    p.energy = Math.max(0, p.energy + absorption - 0.4);
    let nearest = 9999;
    for(const portal of portals) nearest = Math.min(nearest, dist(p, portal));
    const inputs = [p.energy/50, lightDelta/100, Math.min(nearest/200,1)];
    const out = mlp(p.w, inputs);
    p.vx += out[0]*0.6;
    p.vy += out[1]*0.6;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    if(p.x<0||p.x>W) p.vx*=-1;
    if(p.y<0||p.y>H) p.vy*=-1;
    p.fitness = p.energy * 0.7 + (1 - Math.min(nearest/300,1))*30;
  }

  // Soft forces on portals
  for(const portal of portals) {
    let fx=0, fy=0;
    for(const p of particles) {
      const d = dist(p, portal)+20;
      const force = (p.energy / 40) * 80 / (d*d);
      fx += (portal.x - p.x)/d * force;
      fy += (portal.y - p.y)/d * force;
    }
    portal.vx += fx * 0.02;
    portal.vy += fy * 0.02;
    portal.vx *= 0.9; portal.vy *= 0.9;
    portal.x += portal.vx; portal.y += portal.vy;
    portal.x = Math.max(20, Math.min(W-140, portal.x));
    portal.y = Math.max(20, Math.min(H-100, portal.y));
    const avgE = particles.length ? particles.reduce((s,p)=>s+p.energy,0)/particles.length : 20;
    portal.scale = 0.6 + Math.min(avgE/60, 1.2);
    portal.el.style.left = portal.x + 'px';
    portal.el.style.top = portal.y + 'px';
    portal.el.style.transform = `scale(${portal.scale})`;
    portal.el.style.opacity = 0.4 + Math.min(illuminance/800, 0.6);
    portal.el.style.background = `hsla(${200 + illuminance/20}, 70%, ${40 + avgE/2}%, 0.6)`;
  }

  // Genome transfer
  for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++) {
    if(dist(particles[i], particles[j]) < 30 && Math.abs(particles[i].fitness - particles[j].fitness) > 15) {
      const winner = particles[i].fitness > particles[j].fitness ? particles[i] : particles[j];
      const loser = winner === particles[i] ? particles[j] : particles[i];
      loser.w = winner.w.map(v => v + rand(-0.1,0.1));
    }
  }

  // Draw
  ctx.fillStyle = 'rgba(5,5,16,0.3)';
  ctx.fillRect(0,0,W,H);
  for(const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.energy/20, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${180 + p.energy}, 80%, 60%, 0.8)`;
    ctx.fill();
  }

  // Chrome reaction
  document.body.style.background = `radial-gradient(circle at 50% 50%, #0a0a${Math.floor(20+illuminance/30).toString(16)}, #050510)`;
  status.textContent = `Illuminance: ${Math.round(illuminance)} lux | Particles: ${particles.length} | Portals: ${portals.length}`;
  requestAnimationFrame(update);
}

// Sensor
document.getElementById('startSensor').onclick = async () => {
  if('AmbientLightSensor' in window) {
    try {
      sensor = new AmbientLightSensor({frequency: 5});
      sensor.onreading = () => { illuminance = sensor.illuminance || 200; };
      sensor.onerror = e => { console.warn(e); status.textContent += ' | sensor error'; };
      sensor.start();
      status.textContent = 'Sensor active';
    } catch(e) { status.textContent = 'Sensor failed: ' + e.message; }
  } else {
    status.textContent = 'No AmbientLightSensor; using slider';
  }
};
lightSlider.oninput = () => { illuminance = +lightSlider.value; };

document.getElementById('nucleate').onclick = () => { spawnParticle(); spawnPortal(); };
document.getElementById('clear').onclick = () => { particles=[]; portals.forEach(p=>p.el.remove()); portals=[]; };

document.getElementById('seal').onclick = async () => {
  const data = {
    particles: particles.map(p=>({x:p.x,y:p.y,energy:p.energy,w:p.w})),
    portals: portals.map(p=>({x:p.x,y:p.y})),
    illuminance, t: Date.now()
  };
  const json = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem('f501-seal', json);
  localStorage.setItem('f501-hash', hex);
  status.textContent += ' | sealed ' + hex.slice(0,8);
};

document.getElementById('restore').onclick = () => {
  const json = localStorage.getItem('f501-seal');
  if(!json) return;
  const data = JSON.parse(json);
  particles = data.particles.map(p=>({...p, vx:0, vy:0, fitness:0, id:Math.random()}));
  portals.forEach(p=>p.el.remove()); portals=[];
  data.portals.forEach(pos => {
    spawnPortal();
    const last = portals[portals.length-1];
    last.x = pos.x; last.y = pos.y;
  });
  illuminance = data.illuminance || 200;
  lightSlider.value = illuminance;
  status.textContent += ' | restored';
};

// Init
for(let i=0;i<20;i++) spawnParticle();
for(let i=0;i<3;i++) spawnPortal();
update();
