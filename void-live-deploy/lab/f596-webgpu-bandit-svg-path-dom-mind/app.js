const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const svg = document.getElementById('svg');
let W, H, gridW = 80, gridH = 50, cellW, cellH;
const density = new Float32Array(gridW * gridH);
const decay = 0.96;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cellW = W / gridW; cellH = H / gridH;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}
addEventListener('resize', resize); resize();

// Bandit arms: [curvature, growth, attract, noise]
const arms = Array.from({length: 6}, () => [
  Math.random()*0.4 + 0.1,
  Math.random()*0.8 + 0.2,
  Math.random()*0.6 + 0.2,
  Math.random()*0.3
]);
let estimates = new Array(6).fill(0.5);
let counts = new Array(6).fill(1);
let currentArm = 0;
let epsilon = 0.15;

const workerCode = `
let estimates = ${JSON.stringify(estimates)};
let counts = ${JSON.stringify(counts)};
self.onmessage = e => {
  if (e.data.type === 'reward') {
    const {arm, r} = e.data;
    counts[arm]++;
    estimates[arm] += (r - estimates[arm]) / counts[arm];
  }
  if (e.data.type === 'step') {
    const ent = -estimates.reduce((s,p) => p>0 ? s + p*Math.log(p) : s, 0);
    const best = estimates.indexOf(Math.max(...estimates));
    const arm = Math.random() < 0.15 ? Math.floor(Math.random()*6) : best;
    self.postMessage({arm, estimates: [...estimates], entropy: ent});
  }
};
`;
const worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
worker.onmessage = e => {
  currentArm = e.data.arm;
  estimates = e.data.estimates;
  document.getElementById('arm').textContent = currentArm;
  document.getElementById('ent').textContent = e.data.entropy.toFixed(2);
  document.documentElement.style.setProperty('--hue', 180 + e.data.entropy * 40);
};

// Paths
const paths = [];
for (let i = 0; i < 5; i++) {
  const pts = Array.from({length: 5}, (_,j) => ({
    x: W*0.2 + Math.random()*W*0.6,
    y: H*0.2 + Math.random()*H*0.6
  }));
  const el = document.createElementNS('http://www.w3.org/2000/svg','path');
  el.addEventListener('click', () => {
    worker.postMessage({type:'reward', arm: currentArm, r: 1});
  });
  svg.appendChild(el);
  paths.push({pts, el});
}

// Cards
const cards = [];
paths.forEach((p, i) => {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<input value="idea ${i+1}">`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
  document.body.appendChild(card);
  let drag = false, ox, oy;
  card.addEventListener('pointerdown', e => { drag=true; ox=e.offsetX; oy=e.offsetY; });
  addEventListener('pointermove', e => {
    if (!drag) return;
    card.style.left = (e.clientX - ox) + 'px';
    card.style.top = (e.clientY - oy) + 'px';
    // seed density
    const gx = Math.floor(e.clientX / cellW), gy = Math.floor(e.clientY / cellH);
    if (gx>=0 && gx<gridW && gy>=0 && gy<gridH) density[gy*gridW+gx] += 0.8;
  });
  addEventListener('pointerup', () => drag=false);
  cards.push(card);
});

function sampleDensity(x, y) {
  const gx = Math.floor(x / cellW), gy = Math.floor(y / cellH);
  if (gx<0||gx>=gridW||gy<0||gy>=gridH) return 0;
  return density[gy*gridW + gx];
}

function step() {
  // decay density
  for (let i=0; i<density.length; i++) density[i] *= decay;

  // pointer deposit
  if (pointer.x) {
    const gx = Math.floor(pointer.x / cellW), gy = Math.floor(pointer.y / cellH);
    if (gx>=0&&gx<gridW&&gy>=0&&gy<gridH) density[gy*gridW+gx] += 0.4;
  }

  const style = arms[currentArm];
  paths.forEach((p, pi) => {
    const pts = p.pts;
    // attract last point to density
    const last = pts[pts.length-1];
    let bestX=last.x, bestY=last.y, bestD=0;
    for (let s=0; s<8; s++) {
      const sx = last.x + (Math.random()-0.5)*80;
      const sy = last.y + (Math.random()-0.5)*80;
      const d = sampleDensity(sx, sy);
      if (d > bestD) { bestD=d; bestX=sx; bestY=sy; }
    }
    last.x += (bestX - last.x) * style[2] * 0.05;
    last.y += (bestY - last.y) * style[2] * 0.05;
    // grow intermediate
    for (let j=1; j<pts.length-1; j++) {
      pts[j].x += (pts[j+1].x - pts[j].x) * style[1] * 0.02 + (Math.random()-0.5)*style[3]*10;
      pts[j].y += (pts[j+1].y - pts[j].y) * style[1] * 0.02 + (Math.random()-0.5)*style[3]*10;
    }
    // rebuild path d
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let j=1; j<pts.length-1; j+=1) {
      d += ` C ${pts[j].x} ${pts[j].y}, ${pts[j].x} ${pts[j].y}, ${pts[Math.min(j+1,pts.length-1)].x} ${pts[Math.min(j+1,pts.length-1)].y}`;
    }
    p.el.setAttribute('d', d);
    // position card
    const mid = pts[Math.floor(pts.length/2)];
    cards[pi].style.left = mid.x + 'px';
    cards[pi].style.top = mid.y + 'px';
  });

  // render density
  const img = ctx.createImageData(W, H);
  for (let y=0; y<H; y++) {
    for (let x=0; x<W; x++) {
      const gx = Math.floor(x / cellW), gy = Math.floor(y / cellH);
      const v = Math.min(1, density[gy*gridW+gx] * 2);
      const i = (y*W + x)*4;
      img.data[i] = v*40; img.data[i+1] = v*80; img.data[i+2] = v*160; img.data[i+3] = v*80;
    }
  }
  ctx.putImageData(img, 0, 0);

  worker.postMessage({type:'step'});
  requestAnimationFrame(step);
}

let pointer = {};
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

document.getElementById('seal').onclick = async () => {
  const db = await indexedDB.open('verse-f596', 1);
  db.onupgradeneeded = () => db.result.createObjectStore('state');
  db.onsuccess = () => {
    const tx = db.result.transaction('state','readwrite');
    tx.objectStore('state').put({estimates, counts, arms}, 'main');
  };
};
document.getElementById('restore').onclick = async () => {
  const db = await indexedDB.open('verse-f596', 1);
  db.onsuccess = () => {
    const tx = db.result.transaction('state');
    const req = tx.objectStore('state').get('main');
    req.onsuccess = () => {
      if (req.result) {
        estimates = req.result.estimates;
        counts = req.result.counts;
        // arms could be restored too
      }
    };
  };
};

step();
