const N = 10;
const EMB = 4;
const THRESH = 180;
const cards = [];
const embeds = Array.from({length: N}, () => Array(EMB).fill(0).map(() => (Math.random()-0.5)*0.5));
let Wself = Array.from({length: EMB}, () => Array(EMB).fill(0).map(() => (Math.random()-0.5)*0.3));
let Wmsg  = Array.from({length: EMB}, () => Array(EMB).fill(0).map(() => (Math.random()-0.5)*0.3));
let bias  = Array(EMB).fill(0).map(() => (Math.random()-0.5)*0.1);
const pos = Array.from({length: N}, () => ({x: 100+Math.random()*window.innerWidth*0.7, y: 100+Math.random()*window.innerHeight*0.7, vx:0, vy:0}));
const edges = Array.from({length: N}, () => new Map());
let pointer = {x:0, y:0, active:false, boost:0};
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function makeCard(i) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = 'C' + i;
  el.dataset.i = i;
  document.body.appendChild(el);
  el.addEventListener('pointerdown', e => { pointer.active = true; pointer.boost = 12; el.classList.add('hot'); });
  el.addEventListener('pointerup', () => { pointer.active = false; el.classList.remove('hot'); });
  return el;
}
for (let i=0; i<N; i++) cards.push(makeCard(i));

function relu(x) { return Math.max(0, x); }
function norm(v) {
  let s = 0; for (let i=0;i<v.length;i++) s += v[i]*v[i];
  s = Math.sqrt(s) || 1;
  return v.map(x => x/s);
}
function matvec(M, v) {
  return M.map(row => row.reduce((a,w,j) => a + w*v[j], 0));
}

function buildEdges() {
  for (let i=0; i<N; i++) edges[i].clear();
  for (let i=0; i<N; i++) {
    for (let j=i+1; j<N; j++) {
      const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
      const d = Math.hypot(dx, dy);
      if (d < THRESH) {
        let w = Math.exp(-d / 80);
        if (pointer.boost > 0) {
          const dp1 = Math.hypot(pos[i].x-pointer.x, pos[i].y-pointer.y);
          const dp2 = Math.hypot(pos[j].x-pointer.x, pos[j].y-pointer.y);
          if (dp1 < 120 || dp2 < 120) w += 0.6;
        }
        edges[i].set(j, w);
        edges[j].set(i, w);
      }
    }
  }
}

function gnnStep() {
  const newE = embeds.map(e => [...e]);
  for (let i=0; i<N; i++) {
    let msg = Array(EMB).fill(0);
    let totalW = 0;
    for (const [j, w] of edges[i]) {
      for (let k=0; k<EMB; k++) msg[k] += w * embeds[j][k];
      totalW += w;
    }
    if (totalW > 0) for (let k=0; k<EMB; k++) msg[k] /= totalW;
    const selfPart = matvec(Wself, embeds[i]);
    const msgPart  = matvec(Wmsg, msg);
    const updated = selfPart.map((s,k) => relu(s + msgPart[k] + bias[k]));
    newE[i] = norm(updated);
  }
  for (let i=0; i<N; i++) embeds[i] = newE[i];
}

function physics() {
  for (let i=0; i<N; i++) {
    let fx = 0, fy = 0;
    for (const [j, w] of edges[i]) {
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
      const d = Math.hypot(dx, dy) || 1;
      let sim = 0;
      for (let k=0; k<EMB; k++) sim += embeds[i][k] * embeds[j][k];
      const force = sim * w * 0.8;
      fx += (dx/d) * force;
      fy += (dy/d) * force;
    }
    fx += (window.innerWidth/2 - pos[i].x) * 0.0008;
    fy += (window.innerHeight/2 - pos[i].y) * 0.0008;
    pos[i].vx = (pos[i].vx + fx) * 0.92;
    pos[i].vy = (pos[i].vy + fy) * 0.92;
    pos[i].x += pos[i].vx;
    pos[i].y += pos[i].vy;
    pos[i].x = Math.max(50, Math.min(window.innerWidth-50, pos[i].x));
    pos[i].y = Math.max(40, Math.min(window.innerHeight-40, pos[i].y));
  }
}

function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.lineWidth = 1;
  for (let i=0; i<N; i++) {
    for (const [j, w] of edges[i]) {
      if (j < i) continue;
      ctx.strokeStyle = `rgba(100,180,255,${Math.min(0.7, w*0.6)})`;
      ctx.beginPath();
      ctx.moveTo(pos[i].x, pos[i].y);
      ctx.lineTo(pos[j].x, pos[j].y);
      ctx.stroke();
    }
  }
  for (let i=0; i<N; i++) {
    const el = cards[i];
    el.style.left = (pos[i].x - 44) + 'px';
    el.style.top  = (pos[i].y - 32) + 'px';
    const e0 = embeds[i][0], e1 = embeds[i][1];
    const hue = 200 + e0 * 80;
    const sat = 40 + Math.abs(e1)*60;
    el.style.background = `hsla(${hue}, ${sat}%, 28%, 0.9)`;
    const scale = 0.9 + Math.abs(embeds[i][2]) * 0.4;
    el.style.transform = `scale(${scale})`;
    el.textContent = 'C' + i + ' ' + embeds[i][0].toFixed(2);
  }
}

function hebbianUpdate() {
  const eta = 0.04;
  for (let i=0; i<N; i++) {
    if (edges[i].size === 0) continue;
    for (let a=0; a<EMB; a++) {
      for (let b=0; b<EMB; b++) {
        Wmsg[a][b] += eta * embeds[i][a] * embeds[i][b];
        Wself[a][b] *= 0.995;
      }
    }
  }
  for (let a=0; a<EMB; a++) {
    let s = 0;
    for (let b=0; b<EMB; b++) s += Wmsg[a][b]*Wmsg[a][b];
    s = Math.sqrt(s) || 1;
    if (s > 1.5) for (let b=0; b<EMB; b++) Wmsg[a][b] /= (s/1.2);
  }
}

function loop() {
  if (pointer.boost > 0) pointer.boost--;
  buildEdges();
  gnnStep();
  physics();
  render();
  requestAnimationFrame(loop);
}
loop();

window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

document.getElementById('seal').onclick = async () => {
  const genome = { Wself, Wmsg, bias, embeds: embeds.map(e=>[...e]) };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f810', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'main');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'sealed';
    setTimeout(() => status.textContent = 'ready', 1500);
  } catch (err) { status.textContent = 'seal failed (private?)'; }
};

document.getElementById('reset').onclick = () => location.reload();

(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f810', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('main');
    req.onsuccess = () => {
      if (req.result) {
        const g = req.result;
        Wself = g.Wself; Wmsg = g.Wmsg; bias = g.bias;
        if (g.embeds) for (let i=0;i<N;i++) embeds[i] = g.embeds[i] || embeds[i];
        status.textContent = 'restored';
        setTimeout(() => status.textContent = 'ready', 1200);
      }
    };
  } catch (e) { console.debug("lab f810-local-gnn-dynamic-graph-spatial-mind:", e); }
})();

document.addEventListener('pointerup', () => { if (pointer.boost > 4) hebbianUpdate(); });
