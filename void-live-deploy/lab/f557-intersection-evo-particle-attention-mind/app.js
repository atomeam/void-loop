const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const cards = [];
const cardData = [
  { id: 'a', title: 'Resonance', text: 'Visibility drives attraction' },
  { id: 'b', title: 'Evolution', text: 'GA optimizes for dwell' },
  { id: 'c', title: 'Density', text: 'Particles morph chrome' },
  { id: 'd', title: 'Seal', text: 'Persist best genome' },
  { id: 'e', title: 'Observer', text: 'Native Intersection' },
  { id: 'f', title: 'Verse', text: 'Living spatial cards' }
];
cardData.forEach((d, i) => {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<h3>${d.title}</h3><p>${d.text}</p>`;
  el.style.left = (80 + (i % 3) * 220) + 'px';
  el.style.top = (80 + Math.floor(i / 3) * 180) + 'px';
  el.dataset.id = d.id;
  document.body.appendChild(el);
  cards.push({ el, id: d.id, x: 0, y: 0, attention: 0.5, density: 0 });
  makeDraggable(el, cards[cards.length - 1]);
});

function makeDraggable(el, card) {
  let ox, oy;
  el.addEventListener('pointerdown', e => {
    ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (e.buttons) {
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
    }
  });
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(en => {
    const card = cards.find(c => c.el === en.target);
    if (card) card.attention = en.intersectionRatio;
  });
}, { threshold: [0, 0.25, 0.5, 0.75, 1] });
cards.forEach(c => observer.observe(c.el));

let particles = Array.from({ length: 600 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: 0, vy: 0, hue: Math.random() * 360
}));

let genome = { attract: 0.02, hueOff: 0, emit: 0.1, decay: 0.98 };
let gen = 0;
const worker = new Worker(URL.createObjectURL(new Blob([`
  let pop = Array.from({length:6}, () => ({attract:0.01+Math.random()*0.04, hueOff:Math.random()*60-30, emit:Math.random()*0.2, decay:0.95+Math.random()*0.04, fit:0}));
  let best = pop[0];
  onmessage = e => {
    const {attention, density} = e.data;
    const score = attention.reduce((s,a,i) => s + a * (density[i]||0), 0);
    pop.forEach(g => g.fit = score * (0.8 + Math.random()*0.4));
    pop.sort((a,b) => b.fit - a.fit);
    best = {...pop[0]};
    // mutate
    for (let i = 2; i < pop.length; i++) {
      pop[i] = {...best};
      pop[i].attract *= 0.9 + Math.random()*0.2;
      pop[i].hueOff += (Math.random()-0.5)*10;
      pop[i].emit *= 0.9 + Math.random()*0.2;
    }
    postMessage({genome: best, gen: ++genCount});
  };
  let genCount = 0;
`], {type:'application/javascript'})));
worker.onmessage = e => { genome = e.data.genome; gen = e.data.gen; };

let audioCtx, osc, gain;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator(); gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.type = 'sine'; osc.frequency.value = 220; gain.gain.value = 0.05;
  osc.start();
}
initAudio();

let last = performance.now(), frames = 0, fps = 0;
function loop(t) {
  const dt = Math.min(32, t - last); last = t;
  frames++; if (frames % 30 === 0) fps = Math.round(1000 / dt);
  ctx.fillStyle = 'rgba(10,10,18,0.25)'; ctx.fillRect(0,0,W,H);

  // update cards positions
  cards.forEach(c => {
    const r = c.el.getBoundingClientRect();
    c.x = r.left + r.width/2; c.y = r.top + r.height/2;
  });

  const attSum = cards.reduce((s,c) => s + c.attention, 0);
  document.getElementById('att').textContent = attSum.toFixed(2);
  document.getElementById('gen').textContent = gen;
  document.getElementById('fps').textContent = fps;

  // particles
  const dens = new Array(cards.length).fill(0);
  particles.forEach(p => {
    let fx = 0, fy = 0;
    cards.forEach((c, i) => {
      const dx = c.x - p.x, dy = c.y - p.y, d2 = dx*dx + dy*dy + 100;
      const f = genome.attract * c.attention * 2000 / d2;
      fx += dx * f; fy += dy * f;
      if (d2 < 4000) dens[i] += 0.01;
    });
    p.vx = (p.vx + fx) * genome.decay; p.vy = (p.vy + fy) * genome.decay;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.5;
    if (p.y < 0 || p.y > H) p.vy *= -0.5;
    p.hue = (p.hue + genome.hueOff * 0.01) % 360;
    ctx.fillStyle = `hsla(${p.hue},70%,60%,0.6)`;
    ctx.fillRect(p.x, p.y, 2, 2);
  });

  cards.forEach((c, i) => {
    c.density = dens[i];
    const scale = 0.9 + c.attention * 0.4 + c.density * 0.5;
    const hue = 200 + c.attention * 80 + c.density * 40;
    c.el.style.transform = `scale(${scale})`;
    c.el.style.filter = `hue-rotate(${hue}deg) brightness(${1 + c.density})`;
    c.el.style.background = `hsla(${hue},40%,20%,0.85)`;
  });

  if (gain) {
    gain.gain.value = 0.02 + attSum * 0.03;
    osc.frequency.value = 180 + attSum * 80;
  }

  if (frames % 60 === 0) {
    worker.postMessage({ attention: cards.map(c => c.attention), density: dens });
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// IndexedDB seal
let db;
const req = indexedDB.open('f557-attention', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genome');
req.onsuccess = e => db = e.target.result;
document.getElementById('seal').onclick = () => {
  if (!db) return;
  const tx = db.transaction('genome', 'readwrite');
  tx.objectStore('genome').put({ genome, att: cards.map(c => c.attention), ts: Date.now() }, 'best');
  alert('Sealed');
};
document.getElementById('reset').onclick = () => location.reload();

// load on start
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('genome');
  const g = tx.objectStore('genome').get('best');
  g.onsuccess = () => { if (g.result) genome = g.result.genome; };
};
