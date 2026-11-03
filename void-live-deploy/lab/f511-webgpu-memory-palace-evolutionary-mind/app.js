const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const palace = document.getElementById('palace');
const entSpan = document.getElementById('ent');
let W = canvas.width, H = canvas.height;
let density = new Float32Array(W * H);
let loci = [];
let genomes = [];

function initGenomes() {
  genomes = Array.from({length: 5}, (_, i) => ({
    id: i, diffusion: 0.1 + Math.random()*0.2, attract: 0.05 + Math.random()*0.1,
    threshold: 0.3 + Math.random()*0.3, fitness: 0, hue: Math.random()*360
  }));
}

function inject(x, y, amount = 1) {
  const ix = Math.floor(x * W / canvas.clientWidth);
  const iy = Math.floor(y * H / canvas.clientHeight);
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const nx = ix+dx, ny = iy+dy;
    if (nx>=0 && nx<W && ny>=0 && ny<H) density[ny*W+nx] += amount * Math.exp(-(dx*dx+dy*dy)/8);
  }
}

function step() {
  const next = new Float32Array(density);
  for (let y=1; y<H-1; y++) for (let x=1; x<W-1; x++) {
    const i = y*W+x;
    const d = density[i];
    let sum = 0, maxN = d;
    for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
      const n = density[(y+dy)*W + (x+dx)];
      sum += n; if (n > maxN) maxN = n;
    }
    const g = genomes[0];
    next[i] = d * (1 - g.diffusion) + (sum/9) * g.diffusion + (maxN - d) * g.attract * 0.1;
    next[i] = Math.max(0, Math.min(1.5, next[i]));
  }
  density = next;
  consolidate();
  render();
  requestAnimationFrame(step);
}

function consolidate() {
  for (let k=0; k<3; k++) {
    const gx = Math.floor(Math.random()*W), gy = Math.floor(Math.random()*H);
    const e = density[gy*W+gx];
    if (e > 0.6 && loci.length < 6) {
      const id = 'l'+Date.now()+k;
      const el = document.createElement('div');
      el.className = 'locus';
      el.id = id;
      el.textContent = 'Memory ' + loci.length;
      el.style.left = (gx/W*100)+'%';
      el.style.top = (gy/H*100)+'%';
      el.style.transform = `translateZ(${e*200}px) rotateY(${(gx-W/2)*0.1}deg)`;
      el.style.background = `hsla(${genomes[0].hue},60%,30%,0.9)`;
      palace.appendChild(el);
      makeDraggable(el);
      loci.push({id, el, gx, gy, e});
    }
  }
  loci.forEach(l => {
    const e = density[Math.floor(l.gy)*W + Math.floor(l.gx)] || 0.3;
    l.el.style.transform = `translateZ(${e*250}px) scale(${0.8+e*0.5})`;
    l.el.style.opacity = 0.6 + e*0.4;
  });
  let mean = 0, var_ = 0;
  for (let i=0; i<density.length; i+=100) mean += density[i];
  mean /= (density.length/100);
  for (let i=0; i<density.length; i+=100) var_ += (density[i]-mean)**2;
  entSpan.textContent = (var_ / 10).toFixed(2);
  document.body.style.filter = `hue-rotate(${mean*60}deg)`;
}

function makeDraggable(el) {
  let ox, oy;
  el.onpointerdown = e => {
    ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (e.buttons) {
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
      inject(e.clientX, e.clientY, 0.3);
    }
  };
}

function render() {
  const img = ctx.createImageData(W, H);
  for (let i=0; i<density.length; i++) {
    const v = Math.min(255, density[i]*180);
    img.data[i*4] = v*0.3; img.data[i*4+1] = v*0.6; img.data[i*4+2] = v; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

canvas.onpointerdown = e => inject(e.clientX, e.clientY, 1.2);
canvas.onpointermove = e => { if (e.buttons) inject(e.clientX, e.clientY, 0.4); };

document.getElementById('seal').onclick = () => {
  const state = { density: Array.from(density.slice(0,1000)), loci: loci.map(l => ({left: l.el.style.left, top: l.el.style.top})), genomes };
  localStorage.setItem('f511-seal', JSON.stringify(state));
  alert('Sealed to localStorage (IndexedDB path ready)');
};
document.getElementById('reset').onclick = () => { density.fill(0); loci.forEach(l => l.el.remove()); loci=[]; initGenomes(); };

initGenomes();
step();
console.log('F511 Memory Palace ready. Pointer seeds memories; loci consolidate in 3D space.');
