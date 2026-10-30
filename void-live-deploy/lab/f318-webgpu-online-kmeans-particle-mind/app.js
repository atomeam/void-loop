const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const chrome = document.getElementById('chrome');
const status = document.getElementById('status');
const orbsEl = document.getElementById('orbs');
const sealBtn = document.getElementById('seal');

let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 180;
const particles = Array.from({length:N}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

let centroids = []; // {x,y,count,sumX,sumY,purity}
const K = 4;
let frame = 0;
let purity = 0;

// Simple main-thread online k-means stub (Worker-ready)
function updateKMeans(feat) {
  if (centroids.length < K) {
    centroids.push({x:feat.x, y:feat.y, count:1, sumX:feat.x, sumY:feat.y, purity:1});
    return;
  }
  // assign to nearest
  let best = 0, bestD = 1e9;
  for (let i=0; i<centroids.length; i++) {
    const d = Math.hypot(centroids[i].x - feat.x, centroids[i].y - feat.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  const c = centroids[best];
  c.count++;
  c.sumX += feat.x; c.sumY += feat.y;
  c.x = c.sumX / c.count; c.y = c.sumY / c.count;
  // crude purity: inverse of recent variance proxy
  c.purity = Math.max(0, 1 - bestD / 200);
}

let mx = W/2, my = H/2, lastX = mx, lastY = my;
addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
addEventListener('click', e => {
  updateKMeans({x:e.clientX, y:e.clientY, speed:0});
});

function step() {
  const speed = Math.hypot(mx-lastX, my-lastY);
  lastX = mx; lastY = my;
  // density proxy
  let dens = 0;
  for (const p of particles) dens += Math.hypot(p.x-mx, p.y-my) < 80 ? 1 : 0;
  dens /= N;
  updateKMeans({x:mx, y:my, speed, dens});

  // particles
  for (const p of particles) {
    let ax=0, ay=0;
    if (centroids.length) {
      let best=0, bestD=1e9;
      for (let i=0; i<centroids.length; i++) {
        const d = Math.hypot(centroids[i].x-p.x, centroids[i].y-p.y);
        if (d < bestD) { bestD=d; best=i; }
      }
      const c = centroids[best];
      const dx = c.x - p.x, dy = c.y - p.y;
      const d = Math.hypot(dx,dy)+1;
      ax += dx/d * 0.15; ay += dy/d * 0.15;
    }
    ax += (Math.random()-0.5)*0.05; ay += (Math.random()-0.5)*0.05;
    p.vx = p.vx*0.92 + ax; p.vy = p.vy*0.92 + ay;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-1; if (p.y<0||p.y>H) p.vy*=-1;
  }

  // purity global
  purity = centroids.reduce((s,c)=>s+c.purity,0) / (centroids.length||1);
  const hue = 200 + purity*80;
  chrome.style.borderColor = `hsl(${hue},70%,55%)`;
  chrome.style.transform = `scale(${1 + (1-purity)*0.03})`;
  status.textContent = `K-Means Mind · ${centroids.length} clusters · purity ${purity.toFixed(2)}`;

  // render
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = `hsla(${hue},80%,70%,0.8)`;
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill();
  }

  // orbs
  orbsEl.innerHTML = '';
  centroids.forEach((c,i) => {
    const orb = document.createElement('div');
    orb.className = 'orb';
    orb.style.left = c.x+'px';
    orb.style.top = c.y+'px';
    orb.style.setProperty('--h', (i*90 + purity*60) % 360);
    orb.style.transform = `translate(-50%,-50%) scale(${0.7 + Math.min(c.count,40)/40})`;
    orb.textContent = `#${i}\n${c.count}`;
    orb.onpointerdown = ev => {
      // drag to reseed
      const move = m => { c.x = m.clientX; c.y = m.clientY; c.sumX = c.x*c.count; c.sumY = c.y*c.count; };
      const up = () => { removeEventListener('pointermove',move); removeEventListener('pointerup',up); };
      addEventListener('pointermove',move); addEventListener('pointerup',up);
      ev.preventDefault();
    };
    orbsEl.appendChild(orb);
  });

  frame++;
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Seal to IndexedDB
sealBtn.onclick = async () => {
  const data = {centroids: centroids.map(c=>({x:c.x,y:c.y,count:c.count,purity:c.purity})), t:Date.now()};
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('void-f318',1);
      r.onupgradeneeded = () => r.result.createObjectStore('mind');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind','readwrite');
    tx.objectStore('mind').put(data,'champion');
    await new Promise(r => tx.oncomplete = r);
    status.textContent += ' · sealed';
  } catch(e) { status.textContent += ' · seal failed'; }
};

// Load on start
(async () => {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('void-f318',1);
      r.onupgradeneeded = () => r.result.createObjectStore('mind');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind');
    const req = tx.objectStore('mind').get('champion');
    req.onsuccess = () => {
      if (req.result?.centroids) {
        centroids = req.result.centroids.map(c => ({...c, sumX:c.x*c.count, sumY:c.y*c.count}));
        status.textContent = 'Loaded sealed mind · ' + status.textContent;
      }
    };
  } catch (e) { console.warn('f318-webgpu-online-kmeans-particle-mind:', e); }
})();
