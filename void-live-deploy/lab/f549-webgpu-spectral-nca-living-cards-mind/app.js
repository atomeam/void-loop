const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const cardsEl = document.getElementById('cards');
let W=0, H=0, grid=32, cell, field=[], kernel=[], audioCtx, analyser, micStream, useMic=false;
let cards = [];
const N_CARDS = 4;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.min(W,H) / grid;
}
addEventListener('resize', resize);
resize();

function initField() {
  field = Array.from({length:grid*grid}, () => Math.random()*0.1);
  kernel = Array.from({length:9}, () => (Math.random()-0.5)*0.8);
  cards = [];
  cardsEl.innerHTML = '';
  for (let i=0; i<N_CARDS; i++) {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<h4>Organ ${i+1}</h4>activity: 0.00`; // void-review: ok (constant labels, numbers or a hash only; no visitor text)
    cardsEl.appendChild(d);
    cards.push({ el:d, x: Math.random()*W, y: Math.random()*H, vx:0, vy:0, act:0 });
  }
}
initField();

function ncaStep() {
  const next = new Float32Array(field.length);
  for (let y=0; y<grid; y++) for (let x=0; x<grid; x++) {
    let s=0, k=0;
    for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
      const nx = (x+dx+grid)%grid, ny = (y+dy+grid)%grid;
      s += field[ny*grid+nx] * kernel[k++];
    }
    next[y*grid+x] = Math.max(0, Math.min(1, s * 0.7 + field[y*grid+x]*0.3));
  }
  field = Array.from(next);
}

function injectSpectral(bins) {
  if (!bins) return;
  for (let i=0; i<Math.min(16, bins.length); i++) {
    const idx = Math.floor(Math.random()*field.length);
    field[idx] = Math.min(1, field[idx] + bins[i]*0.4);
  }
}

function updateCards() {
  cards.forEach((c,i) => {
    const gx = Math.floor((c.x/W)*grid), gy = Math.floor((c.y/H)*grid);
    const act = field[(gy*grid+gx+field.length)%field.length] || 0;
    c.act = act;
    let fx=0, fy=0;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
      if (dx===0&&dy===0) continue;
      const nx=(gx+dx+grid)%grid, ny=(gy+dy+grid)%grid;
      const a = field[ny*grid+nx];
      fx += (a-act)*dx*2;
      fy += (a-act)*dy*2;
    }
    c.vx = c.vx*0.85 + fx*0.8;
    c.vy = c.vy*0.85 + fy*0.8;
    c.x = (c.x + c.vx + W) % W;
    c.y = (c.y + c.vy + H) % H;
    const scale = 0.8 + act*1.4;
    const rot = (act-0.5)*30;
    c.el.style.transform = `translate(${c.x-70}px,${c.y-45}px) scale(${scale}) rotate(${rot}deg)`;
    c.el.style.opacity = 0.6 + act*0.4;
    c.el.querySelector('h4').nextSibling.textContent = `activity: ${act.toFixed(2)}`;
  });
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  for (let y=0; y<grid; y++) for (let x=0; x<grid; x++) {
    const v = field[y*grid+x];
    ctx.fillStyle = `hsla(${200+v*80},70%,${30+v*50}%,${0.4+v*0.6})`;
    ctx.fillRect(x*cell, y*cell, cell-1, cell-1);
  }
}

let frame=0;
function loop() {
  frame++;
  if (useMic && analyser) {
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    const norm = Array.from(bins.slice(0,16)).map(b => b/255);
    injectSpectral(norm);
  } else {
    if (frame%8===0) field[Math.floor(Math.random()*field.length)] += 0.05;
  }
  ncaStep();
  updateCards();
  draw();
  status.textContent = `NCA ${frame} | Mic:${useMic?'on':'off'} | cards active`;
  requestAnimationFrame(loop);
}
loop();

document.getElementById('mic').onclick = async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({audio:true});
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const src = audioCtx.createMediaStreamSource(micStream);
    src.connect(analyser);
    useMic = true;
    status.textContent = 'Mic active';
  } catch(e) { status.textContent = 'Mic denied, using residual'; }
};

document.getElementById('seal').onclick = () => {
  const data = {kernel, field: field.slice(0,64)};
  try {
    const req = indexedDB.open('verse-f549',1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('minds');
    req.onsuccess = e => {
      const tx = e.target.result.transaction('minds','readwrite');
      tx.objectStore('minds').put(data, 'current');
      status.textContent = 'Sealed to IndexedDB';
    };
  } catch(e) { status.textContent = 'Seal failed (memory only)'; }
};

document.getElementById('load').onclick = () => {
  try {
    const req = indexedDB.open('verse-f549',1);
    req.onsuccess = e => {
      const tx = e.target.result.transaction('minds','readonly');
      const get = tx.objectStore('minds').get('current');
      get.onsuccess = () => {
        if (get.result) {
          kernel = get.result.kernel;
          status.textContent = 'Loaded sealed mind';
        }
      };
    };
  } catch(e) { status.textContent = 'No sealed mind'; }
};

setInterval(() => {
  kernel = kernel.map(k => k + (Math.random()-0.5)*0.05);
}, 4000);
