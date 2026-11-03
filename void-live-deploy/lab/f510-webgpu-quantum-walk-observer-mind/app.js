const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const N = 48; // lattice size
let amp = new Float32Array(N*N*2); // real, imag for each site (coin collapsed to position for simplicity; full coin would be *2 more)
let policy = new Float32Array(4*6 + 6*2); // tiny residual MLP weights, random init
for (let i=0; i<policy.length; i++) policy[i] = (Math.random()-0.5)*0.2;

function initWalker(x, y, phase=0) {
  amp.fill(0);
  const i = (Math.floor(y)%N)*N + (Math.floor(x)%N);
  amp[i*2] = Math.cos(phase);
  amp[i*2+1] = Math.sin(phase);
}

initWalker(N/2, N/2);

function evolve() {
  const next = new Float32Array(amp.length);
  // simplified DTQW: Hadamard-like coin + shift (up/down/left/right with bias from policy)
  const bias = policy[0]*0.1;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const i = y*N + x;
    const re = amp[i*2], im = amp[i*2+1];
    if (re*re+im*im < 1e-8) continue;
    // coin: mix with neighbors conceptually; here diffuse + phase
    const dirs = [[1,0],[ -1,0],[0,1],[0,-1]];
    dirs.forEach(([dx,dy], k) => {
      const nx = (x + dx + N) % N;
      const ny = (y + dy + N) % N;
      const ni = ny*N + nx;
      const w = 0.25 + bias * Math.sin(k + performance.now()*0.001);
      next[ni*2] += re * w;
      next[ni*2+1] += im * w;
    });
  }
  // normalize
  let norm = 0;
  for (let i=0; i<next.length; i+=2) norm += next[i]*next[i] + next[i+1]*next[i+1];
  norm = Math.sqrt(norm) || 1;
  for (let i=0; i<next.length; i++) next[i] /= norm;
  amp = next;
}

function density(x,y) {
  const i = (y%N)*N + (x%N);
  return amp[i*2]*amp[i*2] + amp[i*2+1]*amp[i*2+1];
}

function measure(x, y) {
  const i = Math.floor(y)*N + Math.floor(x);
  const p = density(x,y);
  if (p > 0.01) {
    // collapse: set others near zero, keep phase
    const re = amp[i*2], im = amp[i*2+1];
    amp.fill(0);
    amp[i*2] = re; amp[i*2+1] = im;
    spawnCard(x/N*W, y/N*H, Math.atan2(im, re));
  }
}

const cards = [];
function spawnCard(px, py, phase) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = phase.toFixed(2);
  el.style.left = px + 'px';
  el.style.top = py + 'px';
  el.style.transform = `rotate(${phase}rad) scale(${1+Math.abs(phase)*0.3})`;
  document.body.appendChild(el);
  cards.push({el, phase, x:px, y:py});
  makeDraggable(el, (nx, ny) => {
    // re-inject walker at drag end
    const lx = Math.floor(nx / W * N);
    const ly = Math.floor(ny / H * N);
    initWalker(lx, ly, phase);
  });
}

function makeDraggable(el, onend) {
  let ox, oy, dragging=false;
  el.onpointerdown = e => { dragging=true; ox=e.clientX-parseFloat(el.style.left); oy=e.clientY-parseFloat(el.style.top); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (!dragging) return; el.style.left = (e.clientX-ox)+'px'; el.style.top = (e.clientY-oy)+'px'; };
  el.onpointerup = e => { dragging=false; onend(parseFloat(el.style.left), parseFloat(el.style.top)); };
}

let lastX=0, lastY=0;
canvas.onpointermove = e => {
  lastX = e.clientX / W * N;
  lastY = e.clientY / H * N;
  // policy uses trajectory to bias measure
  if (Math.random() < 0.05) measure(lastX, lastY);
};
canvas.onclick = e => initWalker(e.clientX/W*N, e.clientY/H*N);

function render() {
  evolve();
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const cellW = W/N, cellH = H/N;
  let coh = 0;
  for (let y=0; y<N; y++) for (let x=0; x<N; x++) {
    const p = density(x,y);
    const i = y*N+x;
    const phase = Math.atan2(amp[i*2+1], amp[i*2]);
    coh += Math.abs(amp[i*2]*amp[i*2+1]);
    const hue = (phase + Math.PI) / (2*Math.PI) * 360;
    ctx.fillStyle = `hsla(${hue},80%,${30+p*200}%,${0.3+p*2})`;
    ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
  }
  document.getElementById('coh').textContent = 'coherence: ' + (coh/N).toFixed(3);
  document.body.style.filter = `hue-rotate(${coh*10}deg)`;
  requestAnimationFrame(render);
}
render();

document.getElementById('reset').onclick = () => { initWalker(N/2,N/2); cards.forEach(c=>c.el.remove()); cards.length=0; };
document.getElementById('seal').onclick = () => {
  const data = { amp: Array.from(amp), policy: Array.from(policy) };
  localStorage.setItem('f510-seal', JSON.stringify(data));
  alert('Sealed to localStorage');
};
// restore
try {
  const s = localStorage.getItem('f510-seal');
  if (s) { const d = JSON.parse(s); amp = new Float32Array(d.amp); policy = new Float32Array(d.policy); }
} catch(e) {}
