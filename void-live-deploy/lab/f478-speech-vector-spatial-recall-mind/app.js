const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const input = document.getElementById('input');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const orbs = [];
const DIM = 8;
let activeQuery = null;
let recognition = null;

function embed(text) {
  const v = new Float32Array(DIM);
  const s = text.toLowerCase().replace(/[^a-z0-9 ]/g,'');
  for (let i = 0; i < s.length - 1; i++) {
    const h = (s.charCodeAt(i) * 31 + s.charCodeAt(i+1)) % DIM;
    v[h] += 1;
  }
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i]*v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

function cosine(a, b) {
  let d = 0;
  for (let i = 0; i < DIM; i++) d += a[i]*b[i];
  return d;
}

function addMemory(text) {
  if (!text.trim() || orbs.length >= 32) return;
  const vec = embed(text);
  orbs.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: 0, vy: 0,
    vec, text: text.slice(0,40),
    age: 0
  });
  status.textContent = `Memory added (${orbs.length}). Entropy rising.`;
  updateChrome();
}

function updateChrome() {
  const ent = Math.min(1, orbs.length / 20);
  document.documentElement.style.setProperty('--entropy', ent);
  document.body.style.background = `hsl(${220 + ent*40}, 40%, ${8 + ent*4}%)`;
}

function step() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  const q = activeQuery;
  for (const o of orbs) {
    o.age++;
    if (q) {
      const sim = cosine(o.vec, q.vec);
      if (sim > 0.35) {
        const dx = q.x - o.x, dy = q.y - o.y;
        const dist = Math.hypot(dx,dy) || 1;
        o.vx += (dx/dist) * sim * 0.8;
        o.vy += (dy/dist) * sim * 0.8;
      }
    }
    // mild repulsion
    for (const p of orbs) if (p !== o) {
      const dx = o.x - p.x, dy = o.y - p.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 900 && d2 > 0) {
        const f = 200 / d2;
        o.vx += dx * f; o.vy += dy * f;
      }
    }
    o.vx *= 0.92; o.vy *= 0.92;
    o.x += o.vx; o.y += o.vy;
    if (o.x < 20) o.vx += 0.5; if (o.x > W-20) o.vx -= 0.5;
    if (o.y < 20) o.vy += 0.5; if (o.y > H-20) o.vy -= 0.5;
    const hue = 200 + (cosine(o.vec, orbs[0]?.vec || o.vec)*60);
    ctx.fillStyle = `hsl(${hue},70%,60%)`;
    ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '10px system-ui';
    ctx.fillText(o.text, o.x+8, o.y+4);
  }
  if (q) {
    ctx.strokeStyle = '#0ff'; ctx.beginPath(); ctx.arc(q.x, q.y, 12, 0, Math.PI*2); ctx.stroke();
  }
  requestAnimationFrame(step);
}
step();

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    addMemory(input.value);
    activeQuery = { x: W/2, y: H/2, vec: embed(input.value) };
    input.value = '';
  }
});

document.getElementById('speak').onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { status.textContent = 'SpeechRecognition unavailable — use keyboard.'; return; }
  if (recognition) { recognition.stop(); recognition = null; status.textContent = 'Speech stopped.'; return; }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.onresult = ev => {
    const t = ev.results[ev.results.length-1][0].transcript;
    addMemory(t);
    activeQuery = { x: W/2 + Math.random()*100-50, y: H/2, vec: embed(t) };
    status.textContent = `Heard: ${t.slice(0,30)}`;
  };
  recognition.onerror = () => status.textContent = 'Speech error — keyboard fallback.';
  recognition.start();
  status.textContent = 'Listening...';
};

async function seal() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f478',1);
      r.onupgradeneeded = () => r.result.createObjectStore('mem', {keyPath:'id'});
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem','readwrite');
    const store = tx.objectStore('mem');
    store.clear();
    orbs.forEach((o,i) => store.put({id:i, text:o.text, vec:Array.from(o.vec), x:o.x, y:o.y}));
    await new Promise(r => tx.oncomplete = r);
    status.textContent = `Sealed ${orbs.length} memories to IndexedDB.`;
  } catch(e) { status.textContent = 'Seal failed (private mode?).'; }
}
async function restore() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f478',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem','readonly');
    const req = tx.objectStore('mem').getAll();
    const data = await new Promise(r => req.onsuccess = () => r(req.result));
    orbs.length = 0;
    data.forEach(d => orbs.push({x:d.x, y:d.y, vx:0, vy:0, vec:new Float32Array(d.vec), text:d.text, age:0}));
    status.textContent = `Restored ${orbs.length} memories.`;
    updateChrome();
  } catch(e) { status.textContent = 'Restore failed.'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
addEventListener('keydown', e => {
  if (e.key === 's' || e.key === 'S') seal();
  if (e.key === 'r' || e.key === 'R') restore();
});

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null, bestD = 1e9;
  for (const o of orbs) {
    const d = Math.hypot(o.x-x, o.y-y);
    if (d < bestD) { bestD = d; best = o; }
  }
  if (best && bestD < 40) {
    activeQuery = { x, y, vec: best.vec };
    status.textContent = `Querying: ${best.text}`;
  }
});
