const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const NTOK = 32;
let tokens = []; // {feat: Float32Array[5], text:'', ts}
let cards = [];
const cardTexts = [
  "Attending to pointer drift",
  "Tile content resonance",
  "Energy spike near center",
  "Surprise residual high",
  "Spatial co-activation"
];

function makeCard(i) {
  const el = document.createElement('div');
  el.className = 'thought';
  el.contentEditable = true;
  el.textContent = cardTexts[i % cardTexts.length];
  el.style.left = (20 + Math.random()*60) + '%';
  el.style.top = (15 + Math.random()*60) + '%';
  stage.appendChild(el);
  return { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0 };
}
for (let i=0; i<5; i++) cards.push(makeCard(i));

function addToken(type, x, y, intensity, content='') {
  const nx = x / W, ny = y / H;
  const ch = content.length ? (content.charCodeAt(0)%100)/100 : 0;
  const feat = new Float32Array([type, nx, ny, intensity, ch]);
  tokens.push({ feat, text: content.slice(0,40), ts: performance.now() });
  if (tokens.length > NTOK) tokens.shift();
}

let pointer = {x:W/2, y:H/2, down:false};
addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  addToken(0, e.clientX, e.clientY, pointer.down ? 1 : 0.3);
});
addEventListener('pointerdown', e => { pointer.down=true; addToken(1, e.clientX, e.clientY, 1); });
addEventListener('pointerup', () => pointer.down=false);

cards.forEach(c => {
  c.el.addEventListener('input', () => addToken(2, c.x*W/100, c.y*H/100, 0.8, c.el.textContent));
  c.el.addEventListener('pointerdown', e => e.stopPropagation());
});

// Simple attention
function computeAttention() {
  if (tokens.length < 2) return { entropy:0.5, energy:0.3, weights:[] };
  const d = 5;
  const scale = 1/Math.sqrt(d);
  const scores = [];
  let total = 0;
  for (let i=0; i<tokens.length; i++) {
    const row = [];
    for (let j=0; j<tokens.length; j++) {
      let s = 0;
      for (let k=0; k<d; k++) s += tokens[i].feat[k] * tokens[j].feat[k];
      const w = Math.exp(s * scale);
      row.push(w); total += w;
    }
    scores.push(row);
  }
  // normalize
  const weights = scores.map(row => row.map(w => w / (total/tokens.length + 1e-6)));
  // entropy approx
  let ent = 0, en = 0;
  weights.forEach(row => row.forEach(w => { if(w>0) ent -= w*Math.log(w+1e-9); en += w; }));
  ent /= (tokens.length * Math.log(tokens.length+1));
  return { entropy: Math.min(1, ent), energy: Math.min(1, en/tokens.length), weights };
}

let lastEnt = 0.5;
let residual = 0;
function step() {
  const att = computeAttention();
  residual = att.entropy - lastEnt;
  lastEnt = att.entropy * 0.9 + lastEnt * 0.1;

  // move cards based on attention to recent tokens
  cards.forEach((c, ci) => {
    let fx=0, fy=0;
    const recent = tokens.slice(-8);
    recent.forEach((t, ti) => {
      const w = att.weights.length ? att.weights[att.weights.length-1]?.[tokens.length-8+ti] || 0.1 : 0.2;
      const tx = t.feat[1]*100, ty = t.feat[2]*100;
      fx += (tx - c.x) * w * 0.02;
      fy += (ty - c.y) * w * 0.02;
    });
    // mutual card attraction on high residual
    if (Math.abs(residual) > 0.05) {
      cards.forEach((o, oi) => {
        if (oi===ci) return;
        const dx = o.x - c.x, dy = o.y - c.y;
        const dist = Math.hypot(dx,dy)+1;
        fx += dx/dist * 0.3 * Math.abs(residual);
        fy += dy/dist * 0.3 * Math.abs(residual);
      });
    }
    c.vx = c.vx*0.85 + fx;
    c.vy = c.vy*0.85 + fy;
    c.x = Math.max(5, Math.min(85, c.x + c.vx));
    c.y = Math.max(5, Math.min(80, c.y + c.vy));
    c.el.style.left = c.x + '%';
    c.el.style.top = c.y + '%';
    c.el.style.transform = `scale(${0.85 + att.energy*0.4})`;
    c.el.style.opacity = 0.6 + att.entropy*0.4;
  });

  // occasional reasoning inject
  if (Math.random() < 0.015 && tokens.length > 4) {
    const top = tokens[tokens.length-1];
    const msg = `Attending to ${top.feat[0]===0?'pointer':'event'} at (${(top.feat[1]*100)|0}%,${(top.feat[2]*100)|0}%) energy ${(att.energy*10|0)/10}`;
    const target = cards[Math.floor(Math.random()*cards.length)];
    target.el.textContent = msg;
    addToken(3, target.x*W/100, target.y*H/100, att.energy, msg);
  }

  // chrome
  document.documentElement.style.setProperty('--hue', 180 + att.entropy*120);
  document.documentElement.style.setProperty('--energy', att.energy);
  document.documentElement.style.setProperty('--entropy', att.entropy);
  document.getElementById('ent').textContent = att.entropy.toFixed(2);
  document.getElementById('en').textContent = att.energy.toFixed(2);

  // field viz
  ctx.fillStyle = 'rgba(10,10,20,0.15)';
  ctx.fillRect(0,0,W,H);
  const particles = 40;
  for (let i=0; i<particles; i++) {
    const t = tokens[i % Math.max(1,tokens.length)] || {feat:[0,0.5,0.5,0.3]};
    const px = t.feat[1]*W + (Math.random()-0.5)*40;
    const py = t.feat[2]*H + (Math.random()-0.5)*40;
    const r = 2 + att.energy*6 + Math.abs(residual)*8;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${180+att.entropy*100},70%,60%,${0.3+att.energy*0.4})`;
    ctx.arc(px, py, r, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Seal / Restore
const DB = 'f470-attention-mind';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('seal').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readwrite');
  const data = {
    tokens: tokens.map(t => ({feat: Array.from(t.feat), text:t.text})),
    cards: cards.map(c => ({text:c.el.textContent, x:c.x, y:c.y})),
    ent: lastEnt
  };
  tx.objectStore('seal').put(data, 'latest');
  alert('Sealed living attention state');
};
document.getElementById('restore').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readonly');
  const req = tx.objectStore('seal').get('latest');
  req.onsuccess = () => {
    const d = req.result;
    if (!d) return alert('No seal');
    tokens = d.tokens.map(t => ({feat: new Float32Array(t.feat), text:t.text, ts:0}));
    d.cards.forEach((cd,i) => {
      if (cards[i]) {
        cards[i].el.textContent = cd.text;
        cards[i].x = cd.x; cards[i].y = cd.y;
        cards[i].el.style.left = cd.x+'%'; cards[i].el.style.top = cd.y+'%';
      }
    });
    lastEnt = d.ent || 0.5;
    alert('Restored');
  };
};
document.getElementById('clear').onclick = () => { tokens=[]; cards.forEach(c => c.el.textContent='...'); };
