const probes = [];
const N = 5;
let motion = {ax:0, ay:0, az:0, rx:0, ry:0, rz:0};
let pointer = {x: innerWidth/2, y: innerHeight/2, vx:0, vy:0};
let lastPointer = {x:0, y:0};
const channel = new BroadcastChannel('f525-verse-probes');
let db;

function makeRNN() {
  // 6 in → 8 hidden → 4 out; weights
  return {
    Wh: Array.from({length:8*8}, () => (Math.random()-0.5)*0.3),
    Wi: Array.from({length:8*6}, () => (Math.random()-0.5)*0.5),
    Wo: Array.from({length:4*8}, () => (Math.random()-0.5)*0.5),
    h: new Float32Array(8)
  };
}

function rnnForward(rnn, input) {
  const h = rnn.h;
  const newh = new Float32Array(8);
  for (let i=0; i<8; i++) {
    let s = 0;
    for (let j=0; j<8; j++) s += rnn.Wh[i*8+j] * h[j];
    for (let j=0; j<6; j++) s += rnn.Wi[i*6+j] * input[j];
    newh[i] = Math.tanh(s);
  }
  rnn.h.set(newh);
  const out = new Float32Array(4);
  for (let i=0; i<4; i++) {
    let s = 0;
    for (let j=0; j<8; j++) s += rnn.Wo[i*8+j] * newh[j];
    out[i] = Math.tanh(s);
  }
  return out;
}

function init() {
  for (let i=0; i<N; i++) {
    const el = document.createElement('div');
    el.className = 'probe';
    el.textContent = 'Probe ' + (i+1);
    el.style.left = (100 + i*120) + 'px';
    el.style.top = (150 + (i%2)*80) + 'px';
    document.body.appendChild(el);
    const p = {
      el, x:100+i*120, y:150+(i%2)*80, vx:0, vy:0, rot:0,
      rnn: makeRNN(), fitness: 0, id: i
    };
    probes.push(p);
    el.addEventListener('pointerdown', e => { p.dragging = true; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (p.dragging) { p.x = e.clientX - 45; p.y = e.clientY - 35; }
    });
    el.addEventListener('pointerup', () => { p.dragging = false; });
  }
  status('Ready – move device or pointer');
  requestAnimationFrame(loop);
  setupMotion();
  setupDB();
  channel.onmessage = e => adoptGenome(e.data);
}

function setupMotion() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => {
      DeviceMotionEvent.requestPermission().then(p => {
        if (p === 'granted') window.addEventListener('devicemotion', onMotion);
      });
    }, {once:true});
  } else if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', onMotion);
  } else {
    status('No motion sensor – pointer mode');
  }
  window.addEventListener('pointermove', e => {
    pointer.vx = e.clientX - lastPointer.x;
    pointer.vy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX; lastPointer.y = e.clientY;
    pointer.x = e.clientX; pointer.y = e.clientY;
    // synthetic motion
    motion.ax = pointer.vx * 0.05;
    motion.ay = pointer.vy * 0.05;
  });
}

function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration || {};
  const r = e.rotationRate || {};
  motion.ax = a.x || 0; motion.ay = a.y || 0; motion.az = a.z || 0;
  motion.rx = r.alpha || 0; motion.ry = r.beta || 0; motion.rz = r.gamma || 0;
}

function loop() {
  const input = [motion.ax*0.1, motion.ay*0.1, motion.az*0.1, motion.rx*0.01, motion.ry*0.01, motion.rz*0.01];
  probes.forEach(p => {
    if (p.dragging) return;
    const out = rnnForward(p.rnn, input);
    p.vx = p.vx * 0.92 + out[0] * 2.5;
    p.vy = p.vy * 0.92 + out[1] * 2.5;
    p.rot += out[2] * 4 + motion.rz * 0.05;
    p.x += p.vx; p.y += p.vy;
    // soft bounds
    if (p.x < 10) p.x = 10; if (p.x > innerWidth-100) p.x = innerWidth-100;
    if (p.y < 40) p.y = 40; if (p.y > innerHeight-80) p.y = innerHeight-80;
    // fitness: proximity to center or pointer
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    p.fitness = p.fitness * 0.98 + (1 / (1 + Math.hypot(dx,dy)/100));
    // style
    const hue = (p.rnn.h[0]*180 + 180) % 360;
    const scale = 0.8 + Math.abs(out[3]) * 0.6;
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `rotate(${p.rot}deg) scale(${scale})`;
    p.el.style.filter = `hue-rotate(${hue}deg)`;
  });
  requestAnimationFrame(loop);
}

async function setupDB() {
  const req = indexedDB.open('f525', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => { db = e.target.result; };
}

function sealBest() {
  const best = probes.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const genome = {
    Wh: Array.from(best.rnn.Wh), Wi: Array.from(best.rnn.Wi), Wo: Array.from(best.rnn.Wo),
    fitness: best.fitness, ts: Date.now()
  };
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(genome)))
    .then(buf => {
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      genome.hash = hash;
      if (db) {
        const tx = db.transaction('genomes', 'readwrite');
        tx.objectStore('genomes').put(genome, hash);
      }
      channel.postMessage(genome);
      best.el.classList.add('sealed');
      status('Sealed ' + hash.slice(0,8) + '… fitness ' + best.fitness.toFixed(2));
    });
}

function adoptGenome(data) {
  if (!data || !data.hash) return;
  const worst = probes.reduce((a,b) => a.fitness < b.fitness ? a : b);
  worst.rnn.Wh = data.Wh; worst.rnn.Wi = data.Wi; worst.rnn.Wo = data.Wo;
  worst.rnn.h.fill(0);
  worst.fitness = data.fitness * 0.5;
  worst.el.classList.add('sealed');
  status('Adopted genome ' + data.hash.slice(0,8));
}

function status(msg) { document.getElementById('status').textContent = msg; }

document.getElementById('seal').onclick = sealBest;
init();
