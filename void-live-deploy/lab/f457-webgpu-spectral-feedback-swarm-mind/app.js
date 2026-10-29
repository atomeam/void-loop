const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 180;
let particles = [];
function rand(a,b){ return a + Math.random()*(b-a); }
function initParticles() {
  particles = [];
  for(let i=0;i<N;i++){
    particles.push({
      x: rand(0,W), y: rand(0,H),
      vx: rand(-0.5,0.5), vy: rand(-0.5,0.5),
      hue: rand(180,300),
      freqBias: rand(0.5,2.0),
      damp: rand(0.96,0.99)
    });
  }
}
initParticles();

// Audio
let audioCtx, analyser, oscs = [], gains = [];
let spectrum = new Float32Array(64);
let centroid = 0.5, rms = 0.1, bands = [0,0,0,0];
async function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    const master = audioCtx.createGain();
    master.gain.value = 0.15;
    master.connect(analyser);
    analyser.connect(audioCtx.destination);
    for(let i=0;i<8;i++){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 120 + i*40;
      g.gain.value = 0;
      o.connect(g); g.connect(master);
      o.start();
      oscs.push(o); gains.push(g);
    }
    document.getElementById('audioStatus').textContent = 'Audio: live';
    return true;
  } catch(e) {
    document.getElementById('audioStatus').textContent = 'Audio: blocked';
    return false;
  }
}
let audioReady = false;
document.body.addEventListener('click', async () => {
  if (!audioReady) audioReady = await initAudio();
}, {once:false});

// Gravity from orientation or pointer
let gx = 0, gy = 0.02;
window.addEventListener('deviceorientation', e => {
  if (e.gamma != null) {
    gx = (e.gamma / 90) * 0.15;
    gy = (e.beta / 90) * 0.15;
  }
});
let injecting = false;
canvas.addEventListener('pointerdown', e => { injecting = true; injectAt(e.clientX, e.clientY); });
canvas.addEventListener('pointermove', e => { if (injecting) injectAt(e.clientX, e.clientY); });
window.addEventListener('pointerup', () => injecting = false);
function injectAt(x,y) {
  for(let i=0;i<12;i++){
    const p = particles[Math.floor(Math.random()*N)];
    p.x = x + rand(-20,20); p.y = y + rand(-20,20);
    p.vx = rand(-1,1); p.vy = rand(-1,1);
    p.hue = rand(100,400);
    p.freqBias = rand(0.3,3);
  }
}

// Cards
const cards = [0,1,2,3].map(i => document.getElementById('card'+i));
function updateCards() {
  const regions = [
    {x:0,y:0,w:W/2,h:H/2}, {x:W/2,y:0,w:W/2,h:H/2},
    {x:0,y:H/2,w:W/2,h:H/2}, {x:W/2,y:H/2,w:W/2,h:H/2}
  ];
  regions.forEach((r,i) => {
    let count=0, avgHue=0, energy=0;
    particles.forEach(p => {
      if (p.x>=r.x && p.x<r.x+r.w && p.y>=r.y && p.y<r.y+r.h) {
        count++; avgHue += p.hue; energy += Math.hypot(p.vx,p.vy);
      }
    });
    if (count) avgHue /= count;
    const dens = count / (N/4);
    const card = cards[i];
    card.style.transform = `scale(${0.85 + dens*0.4})`;
    card.style.opacity = 0.5 + dens*0.5;
    card.style.borderColor = `hsl(${avgHue||200},60%,50%)`;
    card.style.background = `hsla(${avgHue||200},40%,15%,0.75)`;
    card.querySelector('.info').textContent = `n:${count} e:${energy.toFixed(1)} c:${centroid.toFixed(2)}`;
  });
}

// Simulation + feedback
function step() {
  // Audio feedback
  if (audioReady && analyser) {
    analyser.getFloatFrequencyData(spectrum);
    let sum=0, wsum=0, total=0;
    for(let i=0;i<spectrum.length;i++){
      const mag = Math.pow(10, spectrum[i]/20);
      total += mag;
      sum += i * mag;
      wsum += mag;
    }
    centroid = wsum ? sum/wsum / spectrum.length : 0.5;
    rms = Math.min(1, total / 20);
    // simple bands
    bands = [0,0,0,0];
    const bs = Math.floor(spectrum.length/4);
    for(let b=0;b<4;b++){
      for(let i=b*bs;i<(b+1)*bs;i++) bands[b] += Math.pow(10, spectrum[i]/20);
      bands[b] /= bs;
    }
    // drive oscillators from swarm
    let avgFreq = 0, avgHue = 0;
    particles.forEach(p => { avgFreq += p.freqBias; avgHue += p.hue; });
    avgFreq /= N; avgHue /= N;
    oscs.forEach((o,i) => {
      const target = 80 + avgFreq*60 + i*30 + centroid*200;
      o.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.05);
      gains[i].gain.setTargetAtTime(0.05 + rms*0.3 + bands[i%4]*0.2, audioCtx.currentTime, 0.08);
    });
  }

  // Physics with spectral feedback
  const forceScale = 0.08 + rms * 0.25;
  const dampMod = 0.98 - centroid * 0.04;
  particles.forEach(p => {
    // gravity
    p.vx += gx * forceScale;
    p.vy += gy * forceScale;
    // spectral attractors toward center modulated by bands
    const cx = W/2 + (centroid-0.5)*W*0.3;
    const cy = H/2 + (rms-0.5)*H*0.3;
    p.vx += (cx - p.x) * 0.0008 * (1+bands[0]);
    p.vy += (cy - p.y) * 0.0008 * (1+bands[1]);
    // damp
    p.vx *= p.damp * dampMod;
    p.vy *= p.damp * dampMod;
    // integrate
    p.x += p.vx; p.y += p.vy;
    // bounds
    if (p.x < 0 || p.x > W) p.vx *= -0.7;
    if (p.y < 0 || p.y > H) p.vy *= -0.7;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
    // gene drift from spectrum
    p.hue = (p.hue + centroid*2 + (Math.random()-0.5)*0.5) % 360;
    p.freqBias = Math.max(0.2, Math.min(3, p.freqBias + (rms-0.3)*0.01));
  });

  updateCards();
  render();
  requestAnimationFrame(step);
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    ctx.fillStyle = `hsla(${p.hue},70%,60%,0.8)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  });
}

// Seal / load
document.getElementById('seal').onclick = () => {
  const data = { particles: particles.map(p=>({hue:p.hue,freqBias:p.freqBias,damp:p.damp})), centroid, rms, ts: Date.now() };
  localStorage.setItem('f457-mind', JSON.stringify(data));
  document.getElementById('status').textContent = 'Mind sealed to localStorage';
};
document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f457-mind');
  if (!raw) return;
  const data = JSON.parse(raw);
  if (data.particles && data.particles.length === N) {
    data.particles.forEach((g,i) => { Object.assign(particles[i], g); });
  }
  document.getElementById('status').textContent = 'Mind loaded';
};
document.getElementById('reset').onclick = initParticles;

// Start
step();
// try audio on first interaction
document.getElementById('ui').addEventListener('click', async () => { if (!audioReady) audioReady = await initAudio(); });
