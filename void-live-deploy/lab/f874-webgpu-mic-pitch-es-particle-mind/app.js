const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Simple MLP policy
class MLP {
  constructor() {
    this.w1 = Array(4).fill(0).map(()=>Array(6).fill(0).map(()=>Math.random()*0.4-0.2));
    this.b1 = Array(6).fill(0).map(()=>Math.random()*0.2-0.1);
    this.w2 = Array(6).fill(0).map(()=>Array(3).fill(0).map(()=>Math.random()*0.4-0.2));
    this.b2 = Array(3).fill(0).map(()=>Math.random()*0.2-0.1);
  }
  forward(x) { // x: [pitch, energy, dx, dy]
    const h = this.w1.map((row,i)=> Math.tanh(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2.map((row,i)=> row.reduce((s,w,j)=>s+w*h[j], this.b2[i]));
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r=>r.slice()); m.b1=this.b1.slice();
    m.w2 = this.w2.map(r=>r.slice()); m.b2=this.b2.slice();
    return m;
  }
  mutate(sigma=0.05) {
    const m = this.clone();
    const noise = a => a.map(v=>v + (Math.random()-0.5)*sigma);
    m.w1 = m.w1.map(noise); m.b1=noise(m.b1);
    m.w2 = m.w2.map(noise); m.b2=noise(m.b2);
    return m;
  }
}
let policy = new MLP();
let bestFitness = 0;
let fitness = 0;

// Particles
const N = 280;
let particles = Array.from({length:N}, ()=>({
  x: Math.random()*canvas.width, y: Math.random()*canvas.height,
  vx:0, vy:0, hue:200
}));

// Audio
let analyser, dataArray, timeArray;
let pitch=0, energy=0;
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    timeArray = new Float32Array(analyser.fftSize);
    status.textContent = 'Mic active — hum or speak';
  } catch(e) {
    status.textContent = 'Mic denied — pointer mode';
  }
}
function estimatePitch() {
  if (!analyser) return;
  analyser.getFloatTimeDomainData(timeArray);
  // simple zero-crossing rate as pitch proxy
  let crossings = 0;
  for (let i=1;i<timeArray.length;i++) if ((timeArray[i-1]<0 && timeArray[i]>=0) || (timeArray[i-1]>=0 && timeArray[i]<0)) crossings++;
  pitch = Math.min(1, crossings / 80);
  analyser.getByteFrequencyData(dataArray);
  let sum=0; for (let i=0;i<dataArray.length;i++) sum+=dataArray[i];
  energy = Math.min(1, sum / (dataArray.length*40));
}

// Pointer residual
let px=0, py=0, dx=0, dy=0;
canvas.addEventListener('pointermove', e=>{
  dx = (e.clientX - px)/canvas.width * 4;
  dy = (e.clientY - py)/canvas.height * 4;
  px = e.clientX; py = e.clientY;
});
canvas.addEventListener('click', e=>{
  // reward
  fitness += 1.5;
  if (fitness > bestFitness) {
    bestFitness = fitness;
    // simple ES: keep mutated if better (here just mutate toward reward)
    policy = policy.mutate(0.08);
  }
  status.textContent = `Rewarded! fitness ${fitness.toFixed(1)} best ${bestFitness.toFixed(1)}`;
});

// Seal
document.getElementById('seal').onclick = async ()=>{
  const genome = {w1:policy.w1, b1:policy.b1, w2:policy.w2, b2:policy.b2, fitness:bestFitness};
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('verse-f874',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('genomes');
      r.onsuccess = ()=>res(r.result);
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(genome, 'current');
    status.textContent = 'Sealed to IndexedDB';
  } catch (e) { console.debug("lab f874-webgpu-mic-pitch-es-particle-mind:", e); }
  try {
    const bc = new BroadcastChannel('f874-genome');
    bc.postMessage(genome);
  } catch (e) { console.debug("lab f874-webgpu-mic-pitch-es-particle-mind:", e); }
};
document.getElementById('reset').onclick = ()=>{ policy = new MLP(); fitness=0; bestFitness=0; status.textContent='Policy reset'; };

// Listen for adoption
try {
  const bc = new BroadcastChannel('f874-genome');
  bc.onmessage = e=>{
    if (e.data && e.data.fitness > bestFitness) {
      policy.w1 = e.data.w1; policy.b1=e.data.b1; policy.w2=e.data.w2; policy.b2=e.data.b2;
      bestFitness = e.data.fitness;
      status.textContent = 'Adopted higher-fitness genome';
    }
  };
} catch (e) { console.debug("lab f874-webgpu-mic-pitch-es-particle-mind:", e); }

function step() {
  estimatePitch();
  const input = [pitch, energy, dx*0.5, dy*0.5];
  const out = policy.forward(input);
  const fx = out[0]*2, fy=out[1]*2, hueBias = out[2]*40;
  // update particles
  for (const p of particles) {
    p.vx += (fx - p.vx)*0.02 + (Math.random()-0.5)*0.1;
    p.vy += (fy - p.vy)*0.02 + (Math.random()-0.5)*0.1;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>canvas.width) p.vx*=-0.8;
    if (p.y<0||p.y>canvas.height) p.vy*=-0.8;
    p.hue = (200 + hueBias + pitch*80) % 360;
  }
  // draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (const p of particles) {
    ctx.fillStyle = `hsl(${p.hue},70%,${50+energy*30}%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2+energy*3, 0, Math.PI*2);
    ctx.fill();
  }
  fitness *= 0.995; // decay
  requestAnimationFrame(step);
}
initAudio().then(()=>requestAnimationFrame(step));
