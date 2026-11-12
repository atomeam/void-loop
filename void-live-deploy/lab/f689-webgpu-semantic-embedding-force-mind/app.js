const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const notes = [];
let mlp = { w1: Array(16*8).fill(0).map(()=>Math.random()*0.2-0.1), b1:Array(8).fill(0), w2:Array(8*3).fill(0).map(()=>Math.random()*0.2-0.1), b2:[0.5,0.3,0.1] };
const DIM = 16;
const proj = Array.from({length:DIM}, () => Array.from({length:256}, () => Math.random()*2-1));

function embed(text) {
  const v = new Float32Array(DIM);
  const s = text.toLowerCase();
  for (let i=0; i<s.length-2; i++) {
    const h = (s.charCodeAt(i)*31 + s.charCodeAt(i+1)*17 + s.charCodeAt(i+2)) & 255;
    for (let d=0; d<DIM; d++) v[d] += proj[d][h];
  }
  let n = 0; for (let d=0; d<DIM; d++) n += v[d]*v[d]; n = Math.sqrt(n)||1;
  for (let d=0; d<DIM; d++) v[d] /= n;
  return v;
}

function addNote(text, x, y) {
  const el = document.createElement('div');
  el.className = 'note';
  el.contentEditable = true;
  el.textContent = text;
  el.style.left = (x||Math.random()*W*0.8+W*0.1)+'px';
  el.style.top = (y||Math.random()*H*0.6+H*0.1)+'px';
  document.body.appendChild(el);
  const note = { el, emb: embed(text), x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, id: Date.now()+Math.random() };
  notes.push(note);
  el.addEventListener('input', () => { note.emb = embed(el.textContent); });
  makeDraggable(note);
  updateStatus();
  return note;
}

function makeDraggable(note) {
  let ox, oy, dragging=false;
  note.el.onpointerdown = e => { dragging=true; ox=e.clientX-note.x; oy=e.clientY-note.y; note.el.setPointerCapture(e.pointerId); };
  note.el.onpointermove = e => { if (!dragging) return; note.x = e.clientX-ox; note.y = e.clientY-oy; note.vx = e.movementX*0.5; note.vy = e.movementY*0.5; note.el.style.left=note.x+'px'; note.el.style.top=note.y+'px'; reward(0.1); };
  note.el.onpointerup = () => dragging=false;
}

let ori = {x:0,y:0};
addEventListener('deviceorientation', e => { ori.x = (e.gamma||0)/90; ori.y = (e.beta||0)/90; });
let px=0, py=0;
addEventListener('pointermove', e => { ori.x = (e.clientX/W-0.5)*2; ori.y = (e.clientY/H-0.5)*2; });

function mlpForward(inputs) {
  const h = mlp.b1.map((b,i) => Math.tanh(b + inputs.reduce((s,x,j)=>s+x*mlp.w1[j*8+i],0)));
  return mlp.b2.map((b,i) => Math.tanh(b + h.reduce((s,v,j)=>s+v*mlp.w2[j*3+i],0)));
}
function reward(r) {
  // simple mutation toward higher reward
  for (let i=0;i<mlp.w2.length;i++) mlp.w2[i] += (Math.random()-0.5)*0.01*r;
}

function step() {
  const stats = [ori.x, ori.y, notes.length/10, Math.random()*0.1];
  const [forceScale, damp, noise] = mlpForward(stats).map(v => (v+1)/2);
  for (let i=0;i<notes.length;i++) {
    let fx = ori.x * forceScale * 20, fy = ori.y * forceScale * 20;
    for (let j=0;j<notes.length;j++) if (i!==j) {
      const dx = notes[j].x - notes[i].x, dy = notes[j].y - notes[i].y;
      const d2 = dx*dx+dy*dy+100;
      let cos = 0; for (let d=0;d<DIM;d++) cos += notes[i].emb[d]*notes[j].emb[d];
      const f = (cos*2-1) * forceScale * 8000 / d2;
      fx += dx * f; fy += dy * f;
    }
    notes[i].vx = notes[i].vx * (1-damp*0.05) + fx * 0.001 + (Math.random()-0.5)*noise;
    notes[i].vy = notes[i].vy * (1-damp*0.05) + fy * 0.001 + (Math.random()-0.5)*noise;
    notes[i].x += notes[i].vx; notes[i].y += notes[i].vy;
    notes[i].x = Math.max(20, Math.min(W-140, notes[i].x));
    notes[i].y = Math.max(20, Math.min(H-60, notes[i].y));
    notes[i].el.style.left = notes[i].x+'px'; notes[i].el.style.top = notes[i].y+'px';
  }
  // draw trails
  ctx.fillStyle = 'rgba(10,10,18,0.15)'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#4af'; ctx.lineWidth=1;
  for (const n of notes) {
    ctx.beginPath(); ctx.arc(n.x+60, n.y+20, 3+Math.abs(n.vx)+Math.abs(n.vy), 0, Math.PI*2); ctx.stroke();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

document.getElementById('add').onclick = () => {
  const t = document.getElementById('newnote').value.trim();
  if (t) { addNote(t); document.getElementById('newnote').value=''; }
};
document.getElementById('newnote').onkeydown = e => { if (e.key==='Enter') document.getElementById('add').click(); };

let rec;
document.getElementById('speak').onclick = () => {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return alert('Speech not supported');
  rec = new (window.SpeechRecognition||window.webkitSpeechRecognition)();
  rec.onresult = e => { const t = e.results[0][0].transcript; document.getElementById('newnote').value=t; document.getElementById('add').click(); };
  rec.start();
};

function updateStatus() { document.getElementById('status').textContent = `F689 Semantic Force Mind | notes:${notes.length} | sealed genome ready`; }

document.getElementById('seal').onclick = async () => {
  const data = { notes: notes.map(n=>({text:n.el.textContent, x:n.x, y:n.y, emb:Array.from(n.emb)})), mlp, ts:Date.now() };
  const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f689',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('seal'); r.onsuccess=e=>res(e.target.result); });
  const tx = db.transaction('seal','readwrite'); tx.objectStore('seal').put(data,'genome');
  const bc = new BroadcastChannel('verse-f689'); bc.postMessage(data);
  updateStatus(); alert('Genome sealed');
};

document.getElementById('export').onclick = () => {
  const data = { notes: notes.map(n=>({text:n.el.textContent, x:n.x, y:n.y})), mlp };
  const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)])); a.download='f689-genome.json'; a.click();
};

document.getElementById('reset').onclick = () => { notes.forEach(n=>n.el.remove()); notes.length=0; updateStatus(); };

// load sealed
(async () => {
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f689',1); r.onsuccess=e=>res(e.target.result); r.onerror=()=>res(null); });
    if (!db) return;
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('genome');
    req.onsuccess = () => {
      const data = req.result;
      if (data) {
        data.notes.forEach(n => { const note=addNote(n.text, n.x, n.y); note.emb=new Float32Array(n.emb); });
        if (data.mlp) mlp=data.mlp;
      }
    };
  } catch (e) { console.debug("lab f689-webgpu-semantic-embedding-force-mind:", e); }
})();

// initial notes
addNote('The Verse is a living canvas of thought');
addNote('Semantic clusters form by embedding affinity');
addNote('Tilt or drag to reshape the mind');
