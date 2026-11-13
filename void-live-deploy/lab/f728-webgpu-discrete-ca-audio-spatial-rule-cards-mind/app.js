const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 128;
let grid = new Uint8Array(N*N);
let next = new Uint8Array(N*N);
function seed() {
  for (let i=0;i<N*N;i++) grid[i] = Math.random()<0.25?1:0;
  const cx=N/2|0, cy=N/2|0;
  [[0,1],[1,2],[2,0],[2,1],[2,2]].forEach(([dx,dy])=> grid[(cy+dy)*N + (cx+dx)] = 1);
}
seed();

let auto = false;
let stepCount = 0;
const cards = [];
let fitness = 0;

function addCard(x=100,y=100) {
  const el = document.createElement('div');
  el.className = 'rule-card';
  el.innerHTML = `<h4>Rule ${cards.length+1}</h4>
    <label>B <input type="number" class="b" value="3" min="0" max="8"></label>
    <label>S <input type="number" class="s" value="23" min="0" max="8"></label>
    <label>R <input type="number" class="r" value="40" min="10" max="120"></label>`;
  el.style.left = x+'px'; el.style.top = y+'px';
  document.body.appendChild(el);
  let dx=0,dy=0,drag=false;
  el.addEventListener('pointerdown', e=>{ drag=true; dx=e.clientX-parseInt(el.style.left); dy=e.clientY-parseInt(el.style.top); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e=>{ if(!drag)return; el.style.left=(e.clientX-dx)+'px'; el.style.top=(e.clientY-dy)+'px'; });
  el.addEventListener('pointerup', ()=>drag=false);
  el.addEventListener('click', ()=>{ fitness+=1; status(`Rewarded card. Fitness ${fitness}`); });
  cards.push({el, getB:()=>+el.querySelector('.b').value, getS:()=>+el.querySelector('.s').value, getR:()=>+el.querySelector('.r').value});
}
addCard(200,150); addCard(400,200); addCard(600,120);

function getLocalRule(px,py) {
  let b=3, s=23;
  for (const c of cards) {
    const cx = parseInt(c.el.style.left)+70;
    const cy = parseInt(c.el.style.top)+40;
    const r = c.getR();
    const dx=px-cx, dy=py-cy;
    if (dx*dx+dy*dy < r*r) { b=c.getB(); s=c.getS(); break; }
  }
  return {b,s};
}

function stepCA() {
  const scaleX = W/N, scaleY = H/N;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    let n=0;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
      if (dx||dy) {
        const nx=(x+dx+N)%N, ny=(y+dy+N)%N;
        n += grid[ny*N+nx];
      }
    }
    const px = x*scaleX + scaleX/2, py = y*scaleY + scaleY/2;
    const {b,s} = getLocalRule(px,py);
    const live = grid[y*N+x];
    const birth = (b.toString().includes(n));
    const surv = (s.toString().includes(n));
    next[y*N+x] = live ? (surv?1:0) : (birth?1:0);
  }
  [grid,next] = [next,grid];
  stepCount++;
  render();
  updateAudio();
}

function render() {
  const img = ctx.createImageData(N,N);
  for (let i=0;i<N*N;i++) {
    const v = grid[i]*255;
    img.data[i*4]=v; img.data[i*4+1]=v*0.6; img.data[i*4+2]=v*0.3; img.data[i*4+3]=255;
  }
  const tmp = document.createElement('canvas'); tmp.width=N; tmp.height=N;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(tmp,0,0,W,H);
  cards.forEach(c=>{
    const cx=parseInt(c.el.style.left)+70, cy=parseInt(c.el.style.top)+40, r=c.getR();
    ctx.strokeStyle='rgba(100,150,255,0.4)'; ctx.beginPath(); ctx.arc(cx,cy,r,0,6.28); ctx.stroke();
  });
}

let ac, osc, filter, gain, noise;
function initAudio() {
  if (ac) { ac.resume(); return; }
  ac = new AudioContext();
  osc = ac.createOscillator(); osc.type='sawtooth'; osc.frequency.value=110;
  filter = ac.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=400;
  gain = ac.createGain(); gain.gain.value=0.05;
  osc.connect(filter); filter.connect(gain); gain.connect(ac.destination);
  osc.start();
  const buf = ac.createBuffer(1, ac.sampleRate*2, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
  noise = ac.createBufferSource(); noise.buffer=buf; noise.loop=true;
  const ng = ac.createGain(); ng.gain.value=0.02;
  noise.connect(ng); ng.connect(gain);
  noise.start();
}
function updateAudio() {
  if (!ac) return;
  let dens=0; for (let i=0;i<N*N;i++) dens+=grid[i]; dens/=N*N;
  const ent = -dens*Math.log2(dens+1e-9)-(1-dens)*Math.log2(1-dens+1e-9);
  osc.frequency.setTargetAtTime(80 + dens*400 + Math.sin(stepCount*0.1)*20, ac.currentTime, 0.05);
  filter.frequency.setTargetAtTime(200 + ent*2000, ac.currentTime, 0.1);
  gain.gain.setTargetAtTime(0.03 + dens*0.1, ac.currentTime, 0.05);
}

function status(msg) { document.getElementById('status').textContent = msg; }

document.getElementById('start').onclick = ()=>{ initAudio(); status('Audio running. CA density → pitch/filter.'); };
document.getElementById('step').onclick = stepCA;
document.getElementById('play').onclick = ()=>{ auto=!auto; status(auto?'Auto on':'Auto off'); };
document.getElementById('reset').onclick = ()=>{ seed(); stepCount=0; fitness=0; render(); status('Reset'); };
document.getElementById('add').onclick = ()=> addCard(100+Math.random()*400,100+Math.random()*300);
document.getElementById('seal').onclick = async ()=>{
  const data = {fitness, cards: cards.map(c=>({x:c.el.style.left,y:c.el.style.top,b:c.getB(),s:c.getS(),r:c.getR()})), step:stepCount};
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f728',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('g'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx=db.transaction('g','readwrite'); tx.objectStore('g').put(data,'genome');
    status('Sealed to IndexedDB. Fitness '+fitness);
  } catch(e) { status('Seal failed: '+e.message); }
  try { const bc=new BroadcastChannel('f728-genome'); bc.postMessage(data); } catch (e) { console.debug("lab f728-webgpu-discrete-ca-audio-spatial-rule-cards-mind:", e); }
};

setInterval(()=>{ if(auto) stepCA(); }, 80);
render();
status('Drag rule cards over the field. Start audio, toggle auto.');
