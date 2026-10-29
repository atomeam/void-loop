const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W=0, H=0;
function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; }
addEventListener('resize', resize); resize();

let genome = [0.5, 1.2, 0.8, 2.1, 0.3, 1.7];
let bestFitness = 0;
let fragments = [];

let ox=0, oy=0;
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { ox=(e.gamma||0)/90; oy=(e.beta||0)/90; });
}
let px=0, py=0, pvx=0, pvy=0, lastX=0, lastY=0;
canvas.addEventListener('pointermove', e => {
  pvx = e.clientX - lastX; pvy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  px = e.clientX; py = e.clientY;
});

let worker;
try {
  const code = `
  let pop = [];
  function randomGenome(){ return Array.from({length:6}, ()=>Math.random()*3); }
  for(let i=0;i<8;i++) pop.push(randomGenome());
  self.onmessage = e => {
    if(e.data.type === 'fitness'){
      const fit = e.data.fit || 0;
      pop[0] = e.data.genome || pop[0];
      for(let i=1;i<pop.length;i++){
        for(let j=0;j<6;j++) if(Math.random()<0.3) pop[i][j] += (Math.random()-0.5)*0.4;
      }
      self.postMessage({type:'genomes', genomes:pop.slice(0,4)});
    }
  };
  self.postMessage({type:'genomes', genomes:pop});
  `;
  const blob = new Blob([code], {type:'application/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = e => {
    if(e.data.genomes && e.data.genomes.length) genome = e.data.genomes[0];
  };
} catch(e){ status.textContent += ' (no worker)'; }

function evaluate(x, y, t){
  const g = genome;
  const nx = x/W, ny = y/H;
  const v = Math.sin(nx*g[0]*10 + t*g[1]) * Math.cos(ny*g[2]*8 - t*g[3]) +
            Math.sin((nx+ny)*g[4]*6 + ox*2) * g[5];
  return (v + 1) * 0.5;
}

function step(t){
  const img = ctx.createImageData(W, H);
  const data = img.data;
  let entropy = 0, samples = 0;
  const stepSize = 4;
  for(let y=0; y<H; y+=stepSize){
    for(let x=0; x<W; x+=stepSize){
      const v = evaluate(x, y, t);
      const c = Math.floor(v*255);
      for(let dy=0; dy<stepSize && y+dy<H; dy++){
        for(let dx=0; dx<stepSize && x+dx<W; dx++){
          const i = ((y+dy)*W + (x+dx))*4;
          data[i] = c; data[i+1] = c*0.6; data[i+2] = 255-c; data[i+3] = 255;
        }
      }
      if(samples < 200){ entropy -= v*Math.log(v+1e-6); samples++; }
    }
  }
  ctx.putImageData(img, 0, 0);

  const resp = Math.abs(pvx)+Math.abs(pvy);
  document.documentElement.style.setProperty('--verse-entropy', Math.min(1, entropy/50));
  document.documentElement.style.setProperty('--verse-response', Math.min(1, resp/40));

  const fit = entropy*0.01 + resp*0.02 + Math.abs(ox)*0.1;
  if(fit > bestFitness) bestFitness = fit;
  if(worker && Math.random()<0.05) worker.postMessage({type:'fitness', fit, genome});

  if(fragments.length < 6 && Math.random()<0.015){
    const fx = Math.random()*W, fy = Math.random()*H;
    const el = document.createElement('div');
    el.className = 'fragment';
    const hash = genome.map(n=>n.toFixed(2)).join(',');
    el.textContent = 'verse:' + hash.slice(0,24);
    el.style.left = fx+'px';
    el.style.top = fy+'px';
    el.onclick = () => sealFragment(el, hash);
    document.body.appendChild(el);
    fragments.push({el, life:1});
  }
  for(const f of fragments){
    f.life *= 0.992;
    f.el.style.opacity = f.life;
    if(f.life < 0.05){ f.el.remove(); f.dead=true; }
  }
  fragments = fragments.filter(f=>!f.dead);

  status.textContent = `F322 verse · genome:${genome.map(n=>n.toFixed(1)).join(' ')} · fit:${bestFitness.toFixed(2)} · frags:${fragments.length}`;
}

async function sealFragment(el, hash){
  el.classList.add('sealed');
  try{
    const req = indexedDB.open('f322verse',1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put({hash, genome, t:Date.now()}, hash);
    };
  }catch (e) { console.warn('f322-verse-self-mutating-shader-mind:', e); }
  status.textContent = 'sealed ' + hash.slice(0,16);
}

function loop(ts){
  step(ts*0.001);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.getElementById('mutate').onclick = () => {
  for(let i=0;i<genome.length;i++) genome[i] += (Math.random()-0.5)*0.5;
};
document.getElementById('sealBest').onclick = () => {
  const h = genome.map(n=>n.toFixed(2)).join(',');
  status.textContent = 'best sealed ' + h.slice(0,20);
};
document.getElementById('reset').onclick = () => {
  genome = [0.5,1.2,0.8,2.1,0.3,1.7];
  bestFitness = 0;
  fragments.forEach(f=>f.el.remove());
  fragments = [];
};
