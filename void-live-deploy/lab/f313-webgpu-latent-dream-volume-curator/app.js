const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const phraseEl = document.getElementById('phrase');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Volume slices (2D fallback representing 3D latent)
const GRID = 48;
let density = new Float32Array(GRID * GRID);
let seeds = []; // {x,y,phrase,id}
let cards = [];
let walker = { state: new Float32Array(8), genes: [0.12, 0.4, 0.3, 0.05] }; // step, attract, noise, mut
let variance = 0;

function noise(x,y,t) {
  return Math.sin(x*0.2 + t) * Math.cos(y*0.15 + t*0.7) * 0.5 + 0.5;
}

function stepVolume(t) {
  const [step, attract, nse, mut] = walker.genes;
  walker.state[0] = (walker.state[0] + (Math.random()-0.5)*step) % 1;
  walker.state[1] = (walker.state[1] + (Math.random()-0.5)*step) % 1;
  let sum = 0, sum2 = 0, n = 0;
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    let d = noise(x + walker.state[0]*10, y + walker.state[1]*10, t*0.01) * 0.6;
    for (const s of seeds) {
      const dx = x/GRID - s.x, dy = y/GRID - s.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      d += attract * Math.exp(-dist*dist * 40) * 0.8;
    }
    d += (Math.random()-0.5) * nse * 0.2;
    d = Math.max(0, Math.min(1, d));
    density[y*GRID + x] = d;
    sum += d; sum2 += d*d; n++;
  }
  variance = n ? (sum2/n - (sum/n)**2) : 0;
  // mutate genes occasionally
  if (Math.random() < 0.02) {
    walker.genes[0] = Math.max(0.02, Math.min(0.3, walker.genes[0] + (Math.random()-0.5)*mut));
    walker.genes[1] = Math.max(0.1, Math.min(0.8, walker.genes[1] + (Math.random()-0.5)*mut));
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const scaleX = W / GRID, scaleY = H / GRID;
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    const d = density[y*GRID + x];
    if (d < 0.15) continue;
    const hue = 200 + d * 80 + variance * 40;
    ctx.fillStyle = `hsla(${hue}, 70%, ${30 + d*40}%, ${0.4 + d*0.5})`;
    ctx.fillRect(x*scaleX, y*scaleY, scaleX+0.5, scaleY+0.5);
  }
  // seeds
  ctx.fillStyle = '#fff';
  for (const s of seeds) {
    ctx.beginPath();
    ctx.arc(s.x*W, s.y*H, 4, 0, Math.PI*2);
    ctx.fill();
  }
}

function spawnCard(x, y, phrase) {
  const card = document.createElement('div');
  card.className = 'card';
  card.textContent = phrase;
  card.style.left = (x * W - 90) + 'px';
  card.style.top = (y * H - 20) + 'px';
  let ox, oy, dragging = false;
  card.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - parseFloat(card.style.left); oy = e.clientY - parseFloat(card.style.top); card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => { if (!dragging) return; card.style.left = (e.clientX - ox) + 'px'; card.style.top = (e.clientY - oy) + 'px'; });
  card.addEventListener('pointerup', e => {
    dragging = false;
    const nx = (parseFloat(card.style.left) + 90) / W;
    const ny = (parseFloat(card.style.top) + 20) / H;
    // find nearest seed and relocate
    let best = null, bd = 1e9;
    for (const s of seeds) {
      const dd = (s.x-nx)**2 + (s.y-ny)**2;
      if (dd < bd) { bd = dd; best = s; }
    }
    if (best && bd < 0.05) { best.x = Math.max(0,Math.min(1,nx)); best.y = Math.max(0,Math.min(1,ny)); }
  });
  document.body.appendChild(card);
  cards.push(card);
}

function curator() {
  // sample a high density cell and spawn/update card
  let best = 0, bx=0, by=0;
  for (let i=0; i<density.length; i++) if (density[i] > best) { best = density[i]; bx = i % GRID; by = Math.floor(i / GRID); }
  if (best > 0.4 && cards.length < 6) {
    const px = bx / GRID, py = by / GRID;
    const phrase = seeds.length ? seeds[Math.floor(Math.random()*seeds.length)].phrase + ' · ' + ['echo','fold','drift','seed','wake'][Math.floor(Math.random()*5)] : 'latent form';
    spawnCard(px, py, phrase);
  }
  // morph chrome
  document.body.style.filter = `hue-rotate(${variance*120}deg) saturate(${1+variance})`;
  document.body.style.transform = `scale(${1 + variance*0.02})`;
}

function addSeed(phrase) {
  const x = 0.3 + Math.random()*0.4, y = 0.3 + Math.random()*0.4;
  seeds.push({x, y, phrase: phrase || 'unnamed', id: Date.now()});
  spawnCard(x, y, phrase || 'seed');
  statusEl.textContent = `seeded “${phrase}” · variance ${(variance*100).toFixed(1)}%`;
}

document.getElementById('seed').onclick = () => { addSeed(phraseEl.value.trim()); phraseEl.value = ''; };
document.getElementById('seal').onclick = async () => {
  const data = { genes: [...walker.genes], state: [...walker.state], seeds };
  try {
    const db = await new Promise((res,rej) => { const r = indexedDB.open('f313',1); r.onupgradeneeded = () => r.result.createObjectStore('seal'); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'latest');
    statusEl.textContent = 'sealed genome + ' + seeds.length + ' seeds';
  } catch(e) { statusEl.textContent = 'seal failed (private?)'; }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => { const r = indexedDB.open('f313',1); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        walker.genes = req.result.genes;
        walker.state = new Float32Array(req.result.state);
        seeds = req.result.seeds || [];
        cards.forEach(c => c.remove()); cards = [];
        seeds.forEach(s => spawnCard(s.x, s.y, s.phrase));
        statusEl.textContent = 'loaded sealed state';
      }
    };
  } catch(e) { statusEl.textContent = 'no seal'; }
};

let t = 0;
function loop() {
  t++;
  stepVolume(t);
  render();
  if (t % 40 === 0) curator();
  requestAnimationFrame(loop);
}
loop();

// initial seed
addSeed('origin');
statusEl.textContent = 'volume evolving · click Seed or drag cards';
