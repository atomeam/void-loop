const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = innerWidth, H = innerHeight;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

const N_AGENTS = 3;
const N_PTS = 8;
const agents = [];

function rand(a,b){ return a + Math.random()*(b-a); }
function createMLP() {
  // 5 inputs -> 6 hidden -> 2 outputs (dx,dy bias)
  const w1 = Array.from({length:6}, () => Array.from({length:5}, () => rand(-0.5,0.5)));
  const b1 = Array.from({length:6}, () => rand(-0.2,0.2));
  const w2 = Array.from({length:2}, () => Array.from({length:6}, () => rand(-0.4,0.4)));
  const b2 = Array.from({length:2}, () => rand(-0.1,0.1));
  return {w1,b1,w2,b2, fitness:1};
}
function mlpForward(m, inp) {
  const h = m.b1.map((b,i) => Math.tanh(b + m.w1[i].reduce((s,w,j)=>s+w*inp[j],0)));
  return m.b2.map((b,i) => b + m.w2[i].reduce((s,w,j)=>s+w*h[j],0));
}
function cloneMLP(m) {
  return {w1:m.w1.map(r=>r.slice()), b1:m.b1.slice(), w2:m.w2.map(r=>r.slice()), b2:m.b2.slice(), fitness:m.fitness};
}
function avgMLP(a,b) {
  const m = cloneMLP(a);
  for(let i=0;i<m.w1.length;i++) for(let j=0;j<m.w1[i].length;j++) m.w1[i][j]=(a.w1[i][j]+b.w1[i][j])/2;
  for(let i=0;i<m.b1.length;i++) m.b1[i]=(a.b1[i]+b.b1[i])/2;
  for(let i=0;i<m.w2.length;i++) for(let j=0;j<m.w2[i].length;j++) m.w2[i][j]=(a.w2[i][j]+b.w2[i][j])/2;
  for(let i=0;i<m.b2.length;i++) m.b2[i]=(a.b2[i]+b.b2[i])/2;
  m.fitness = Math.max(a.fitness,b.fitness)*0.95;
  return m;
}
function mutateMLP(m, amt=0.05) {
  const n = cloneMLP(m);
  for(let i=0;i<n.w1.length;i++) for(let j=0;j<n.w1[i].length;j++) n.w1[i][j]+=rand(-amt,amt);
  for(let i=0;i<n.w2.length;i++) for(let j=0;j<n.w2[i].length;j++) n.w2[i][j]+=rand(-amt,amt);
  return n;
}

for(let a=0;a<N_AGENTS;a++) {
  const pts = [];
  const cx = rand(W*0.2, W*0.8), cy = rand(H*0.2, H*0.8);
  for(let i=0;i<N_PTS;i++) {
    const ang = (i/N_PTS)*Math.PI*2;
    pts.push({x:cx+Math.cos(ang)*60, y:cy+Math.sin(ang)*40, vx:0, vy:0});
  }
  agents.push({pts, mlp:createMLP(), color:`hsl(${a*120},70%,60%)`, portal:null, fitness:1});
}

// Portals
agents.forEach((ag,i) => {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = `A${i+1}`;
  el.draggable = false;
  portalsEl.appendChild(el);
  ag.portal = el;
  el.addEventListener('pointerdown', e => { e.stopPropagation(); rewardAgent(i); });
});

let ori = {x:0,y:0}, oriOk = false;
let pointer = {x:W/2, y:H/2, down:false};
let hand = null; // {x,y} in canvas coords if XR

document.getElementById('oriBtn').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try { await DeviceOrientationEvent.requestPermission(); } catch (e) { console.debug("lab f690-webxr-hand-constraint-path-morph-mind:", e); }
  }
  window.addEventListener('deviceorientation', e => {
    ori.x = (e.gamma||0)/90;
    ori.y = (e.beta||0)/90;
    oriOk = true;
    status.textContent = `Orientation active · γ${ori.x.toFixed(2)} β${ori.y.toFixed(2)}`;
  });
  status.textContent = 'Orientation requested';
};

cv.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
cv.addEventListener('pointerdown', e => { pointer.down = true; pointer.x = e.clientX; pointer.y = e.clientY; });
cv.addEventListener('pointerup', () => pointer.down = false);

function rewardAgent(i) {
  agents[i].fitness += 1.5;
  agents[i].mlp = mutateMLP(agents[i].mlp, 0.03);
  agents[i].mlp.fitness = agents[i].fitness;
  status.textContent = `Rewarded agent ${i+1} · fitness ${agents[i].fitness.toFixed(1)}`;
}
cv.addEventListener('click', e => {
  // simple hit test
  let best = -1, bestD = 40;
  agents.forEach((ag,i) => {
    ag.pts.forEach(p => {
      const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
      if (d < bestD) { bestD = d; best = i; }
    });
  });
  if (best >= 0) rewardAgent(best);
});

// WebXR probe
let xrSession = null;
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['hand-tracking'] });
    status.textContent = 'WebXR AR session active · hand tracking if supported';
    // Minimal: we just note it; full hand joint extraction would require reference space + frame.getPose etc.
    // For this prototype the pointer/orientation path remains primary; XR confirms capability.
    xrSession.addEventListener('end', () => { xrSession = null; status.textContent = 'XR ended'; });
  } catch(e) { status.textContent = 'XR request failed: ' + e.message; }
};

function step() {
  const t = performance.now() * 0.001;
  agents.forEach((ag, ai) => {
    const inp = [ori.x, ori.y, (pointer.x/W-0.5)*2, (pointer.y/H-0.5)*2, Math.sin(t*0.7)];
    const bias = mlpForward(ag.mlp, inp);
    const targetPull = pointer.down ? 0.15 : 0.02;
    ag.pts.forEach((p, pi) => {
      // MLP bias + orientation force
      p.vx += bias[0]*0.4 + ori.x*0.3;
      p.vy += bias[1]*0.4 + ori.y*0.3;
      // pointer attraction when down
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const d = Math.hypot(dx,dy)+1;
      if (pointer.down && d < 180) {
        p.vx += (dx/d)*targetPull*8;
        p.vy += (dy/d)*targetPull*8;
      }
      // soft length constraints to neighbors
      const prev = ag.pts[(pi-1+N_PTS)%N_PTS];
      const next = ag.pts[(pi+1)%N_PTS];
      const rest = 55;
      [prev, next].forEach(o => {
        const ox = p.x - o.x, oy = p.y - o.y;
        const od = Math.hypot(ox,oy)+0.1;
        const f = (od - rest)*0.08;
        p.vx -= (ox/od)*f;
        p.vy -= (oy/od)*f;
      });
      // repulsion from other agents
      agents.forEach((other, oi) => {
        if (oi === ai) return;
        other.pts.forEach(op => {
          const rx = p.x - op.x, ry = p.y - op.y;
          const rd = Math.hypot(rx,ry);
          if (rd < 70 && rd > 1) {
            const rf = (70-rd)*0.02;
            p.vx += (rx/rd)*rf;
            p.vy += (ry/rd)*rf;
          }
        });
      });
      p.vx *= 0.92; p.vy *= 0.92;
      p.x += p.vx; p.y += p.vy;
      p.x = Math.max(20, Math.min(W-20, p.x));
      p.y = Math.max(20, Math.min(H-20, p.y));
    });
  });

  // genome transfer on proximity
  for(let i=0;i<agents.length;i++) for(let j=i+1;j<agents.length;j++) {
    let close = false;
    outer: for(const p of agents[i].pts) for(const q of agents[j].pts) {
      if (Math.hypot(p.x-q.x, p.y-q.y) < 28) { close = true; break outer; }
    }
    if (close && Math.random() < 0.02) {
      if (agents[i].fitness > agents[j].fitness) {
        agents[j].mlp = avgMLP(agents[j].mlp, agents[i].mlp);
        agents[j].fitness = agents[j].mlp.fitness;
      } else {
        agents[i].mlp = avgMLP(agents[i].mlp, agents[j].mlp);
        agents[i].fitness = agents[i].mlp.fitness;
      }
      status.textContent = `Genome transfer ${i+1}↔${j+1}`;
    }
  }

  // portals ride centroids
  agents.forEach(ag => {
    let cx=0, cy=0;
    ag.pts.forEach(p => { cx+=p.x; cy+=p.y; });
    cx/=N_PTS; cy/=N_PTS;
    ag.portal.style.left = cx+'px';
    ag.portal.style.top = cy+'px';
    ag.portal.style.borderColor = ag.color;
  });
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  agents.forEach(ag => {
    ctx.beginPath();
    ctx.strokeStyle = ag.color;
    ctx.lineWidth = 2.5;
    ctx.moveTo(ag.pts[0].x, ag.pts[0].y);
    for(let i=1;i<ag.pts.length;i++) ctx.lineTo(ag.pts[i].x, ag.pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ag.pts.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = ag.color;
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
      ctx.fill();
    });
  });
}

function loop() { step(); draw(); requestAnimationFrame(loop); }
loop();

// Seal
document.getElementById('sealBtn').onclick = async () => {
  const data = { agents: agents.map(ag => ({mlp: ag.mlp, fitness: ag.fitness, pts: ag.pts.map(p=>({x:p.x,y:p.y})) })), ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f690', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'best');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'Sealed to IndexedDB verse-f690';
    // also download
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'f690-genome.json';
    a.click();
  } catch(e) { status.textContent = 'Seal failed (session only): '+e.message; }
};

document.getElementById('resetBtn').onclick = () => location.reload();

// Restore on load
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f690', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!db.objectStoreNames.contains('seal')) return;
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('best');
    req.onsuccess = () => {
      const d = req.result;
      if (!d || !d.agents) return;
      d.agents.forEach((saved, i) => {
        if (!agents[i]) return;
        agents[i].mlp = saved.mlp;
        agents[i].fitness = saved.fitness || 1;
        if (saved.pts) saved.pts.forEach((p,pi) => { if(agents[i].pts[pi]) { agents[i].pts[pi].x=p.x; agents[i].pts[pi].y=p.y; } });
      });
      status.textContent = 'Restored sealed genome';
    };
  } catch (e) { console.debug("lab f690-webxr-hand-constraint-path-morph-mind:", e); }
})();
