const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

let audioCtx, analyser, masterGain;
let cards = [];
let particles = [];
let genomes = [];
let fitnesses = [];
const N_CARDS = 7;
const POP = 5;
let running = false;
let clickRewards = new Array(N_CARDS).fill(0);
const channel = new BroadcastChannel('f529-resonators');

function hash(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
  );
}

function initCards() {
  cards = [];
  for (let i = 0; i < N_CARDS; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = `R${i}`;
    el.style.left = (100 + i * 120) % (W-100) + 'px';
    el.style.top = (80 + (i%3)*150) + 'px';
    document.body.appendChild(el);
    let dragging = false, ox, oy;
    el.onpointerdown = e => { dragging=true; ox=e.clientX-parseFloat(el.style.left); oy=e.clientY-parseFloat(el.style.top); el.setPointerCapture(e.pointerId); };
    el.onpointermove = e => { if(dragging){ el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; updateSpatial(); } };
    el.onpointerup = () => dragging=false;
    el.onclick = () => { clickRewards[i] += 2; el.classList.add('high'); setTimeout(()=>el.classList.remove('high'),300); };
    cards.push({ el, freq: 220 + i*40, gain: 0.1, q: 2, osc:null, filter:null, panner:null, delay:null });
  }
}

function initParticles() {
  particles = [];
  for (let i = 0; i < 180; i++) {
    particles.push({ x: Math.random()*W, y: Math.random()*H, vx:0, vy:0, life:1 });
  }
}

async function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.connect(masterGain);
  for (let c of cards) {
    c.osc = audioCtx.createOscillator();
    c.osc.type = 'sine';
    c.osc.frequency.value = c.freq;
    c.filter = audioCtx.createBiquadFilter();
    c.filter.type = 'lowpass';
    c.filter.frequency.value = c.freq * 2;
    c.filter.Q.value = c.q;
    c.panner = audioCtx.createStereoPanner();
    c.delay = audioCtx.createDelay(1.0);
    c.delay.delayTime.value = 0.05;
    const g = audioCtx.createGain();
    g.gain.value = c.gain;
    c.osc.connect(c.filter);
    c.filter.connect(g);
    g.connect(c.panner);
    c.panner.connect(c.delay);
    c.delay.connect(analyser);
    c.osc.start();
    c.gainNode = g;
  }
  running = true;
  statusEl.textContent = 'Audio live. Drag cards, click for energy. Evolution running.';
  evolve();
  requestAnimationFrame(loop);
}

function updateSpatial() {
  if (!running) return;
  for (let c of cards) {
    const x = parseFloat(c.el.style.left) + 45;
    const y = parseFloat(c.el.style.top) + 35;
    const nx = (x / W - 0.5) * 2;
    c.panner.pan.value = Math.max(-1, Math.min(1, nx));
    const dist = Math.hypot(x - W/2, y - H/2) / Math.hypot(W,H);
    c.delay.delayTime.value = dist * 0.15;
  }
}

function computeFitness() {
  if (!analyser) return;
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);
  let sum = 0, entropy = 0;
  for (let v of bins) sum += v;
  if (sum < 1) return;
  for (let v of bins) {
    const p = v / sum;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  let high = 0;
  for (let i = bins.length*0.6; i < bins.length; i++) high += bins[i];
  for (let i = 0; i < N_CARDS; i++) {
    fitnesses[i] = entropy * 0.4 + clickRewards[i] * 0.3 - (high/sum)*0.2;
    clickRewards[i] *= 0.95;
  }
}

let genIndex = 0;
function evolve() {
  if (!running) return;
  computeFitness();
  let best = 0, worst = 0;
  for (let i = 1; i < N_CARDS; i++) {
    if (fitnesses[i] > fitnesses[best]) best = i;
    if (fitnesses[i] < fitnesses[worst]) worst = i;
  }
  if (Math.random() < 0.4) {
    cards[worst].freq = cards[best].freq * (0.9 + Math.random()*0.2);
    cards[worst].q = Math.max(0.5, cards[best].q + (Math.random()-0.5)*1);
    if (cards[worst].osc) {
      cards[worst].osc.frequency.setTargetAtTime(cards[worst].freq, audioCtx.currentTime, 0.1);
      cards[worst].filter.frequency.setTargetAtTime(cards[worst].freq*2, audioCtx.currentTime, 0.1);
      cards[worst].filter.Q.value = cards[worst].q;
    }
  }
  for (let i = 0; i < cards.length; i++) {
    const hue = (cards[i].freq % 360);
    cards[i].el.style.borderColor = `hsl(${hue},80%,60%)`;
    cards[i].el.style.boxShadow = `0 0 12px hsl(${hue},80%,50%)`;
  }
  setTimeout(evolve, 500);
}

function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  if (analyser && running) {
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    for (let p of particles) {
      const bin = Math.floor((p.x / W) * bins.length);
      const mag = bins[bin] / 255;
      p.vx += (Math.random()-0.5)*0.2 + mag * (p.x > W/2 ? 1 : -1) * 0.5;
      p.vy += (Math.random()-0.5)*0.2 + mag * 0.3;
      p.vx *= 0.96; p.vy *= 0.96;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.fillStyle = `hsla(${200 + mag*160},70%,60%,0.7)`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }
  requestAnimationFrame(loop);
}

async function seal() {
  const data = { genomes: cards.map(c => ({freq:c.freq, q:c.q, gain:c.gain})), fitness: fitnesses.slice() };
  const h = await hash(JSON.stringify(data));
  statusEl.textContent = `Sealed: ${h.slice(0,16)}...`;
  const req = indexedDB.open('f529', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('seals');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put({hash:h, data, ts:Date.now()}, h);
  };
  channel.postMessage({type:'seal', hash:h, data});
}

channel.onmessage = e => {
  if (e.data.type === 'seal') {
    statusEl.textContent = `Adopted remote seal ${e.data.hash.slice(0,12)}`;
    if (e.data.data && e.data.data.genomes) {
      e.data.data.genomes.forEach((g,i) => {
        if (cards[i]) {
          cards[i].freq = (cards[i].freq + g.freq)/2;
          if (cards[i].osc) cards[i].osc.frequency.setTargetAtTime(cards[i].freq, audioCtx?.currentTime||0, 0.2);
        }
      });
    }
  }
};

document.getElementById('start').onclick = startAudio;
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => location.reload();

initCards();
initParticles();
statusEl.textContent = 'Ready. Drag cards, then Start Audio.';
