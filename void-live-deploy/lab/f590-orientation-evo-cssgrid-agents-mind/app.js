const stage = document.getElementById('stage');
const status = document.getElementById('status');
const fitEl = document.getElementById('fit');
const N = 6;
let agents = [];
let genomes = [];
let fitness = Array(N).fill(0);
let bestFitness = 0;
let bestGenome = null;
let orient = { beta: 0, gamma: 0 };
let pointer = { x: 0, y: 0, vx: 0, vy: 0 };

function rand(a=0,b=1){ return a + Math.random()*(b-a); }
function mutate(g, bias=0){
  return g.map(v => Math.max(0, Math.min(1, v + (Math.random()-0.5)*0.15 + bias*0.05)));
}
function hashStr(s){ let h=0; for(let c of s) h = (h*31 + c.charCodeAt(0))|0; return h.toString(16); }

function init(){
  stage.innerHTML = '';
  agents = []; genomes = [];
  for(let i=0;i<N;i++){
    const g = Array.from({length:8}, ()=>rand());
    genomes.push(g);
    const el = document.createElement('div');
    el.className = 'agent';
    el.textContent = `Agent ${i}`;
    el.dataset.i = i;
    el.onclick = () => reward(i);
    stage.appendChild(el);
    agents.push(el);
  }
  applyAll();
}

function apply(i){
  const g = genomes[i];
  const el = agents[i];
  const hue = Math.floor(g[0]*360);
  const scale = 0.8 + g[1]*0.6;
  const span = 1 + Math.floor(g[2]*2);
  el.style.setProperty('--hue', hue);
  el.style.background = `linear-gradient(135deg,hsl(${hue},70%,40%),#1a1a2a)`;
  el.style.transform = `scale(${scale}) rotate(${(g[3]-0.5)*20}deg)`;
  el.style.gridColumn = `span ${span}`;
  el.style.order = Math.floor(g[4]*N);
  el.style.filter = `hue-rotate(${g[5]*30}deg) saturate(${0.8+g[6]*0.8})`;
  el.textContent = `A${i} f:${fitness[i].toFixed(1)}`;
}

function applyAll(){ for(let i=0;i<N;i++) apply(i); }

function reward(i){
  fitness[i] += 2 + Math.abs(orient.beta)*0.1;
  if(fitness[i] > bestFitness){
    bestFitness = fitness[i];
    bestGenome = genomes[i].slice();
  }
  // transfer to neighbor
  const j = (i+1)%N;
  if(fitness[i] > fitness[j]){
    genomes[j] = mutate(genomes[i], orient.gamma/90);
    fitness[j] = fitness[i]*0.8;
  }
  applyAll();
  fitEl.textContent = `best: ${bestFitness.toFixed(1)}`;
}

function step(){
  // bias mutation from orientation
  const bias = (orient.beta || pointer.vy*10) / 180;
  if(Math.random() < 0.05){
    const i = Math.floor(Math.random()*N);
    genomes[i] = mutate(genomes[i], bias);
    fitness[i] *= 0.95;
  }
  // soft coverage fitness
  agents.forEach((el,i)=>{
    const r = el.getBoundingClientRect();
    const cov = Math.min(1, (r.width*r.height)/ (window.innerWidth*window.innerHeight*0.1));
    fitness[i] += cov * 0.01;
  });
  applyAll();
  requestAnimationFrame(step);
}

window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
  status.textContent = `\u03b2${orient.beta.toFixed(0)} \u03b3${orient.gamma.toFixed(0)} \u00b7 `;
});
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});

document.getElementById('seal').onclick = async () => {
  const data = { genomes, fitness, bestFitness, bestGenome, ts: Date.now() };
  const key = 'verse-f590';
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('verse',1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('minds');
      r.onsuccess = ()=> res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('minds','readwrite');
    tx.objectStore('minds').put(data, key);
    status.textContent = 'Sealed to IndexedDB \u00b7 ';
  } catch(e){ status.textContent = 'Seal failed (memory) \u00b7 '; }
  // Broadcast
  try {
    const bc = new BroadcastChannel('f590-genome');
    bc.postMessage({ type:'genome', data, hash: hashStr(JSON.stringify(bestGenome)) });
  } catch (e) { console.debug("lab f590-orientation-evo-cssgrid-agents-mind:", e); }
};

document.getElementById('reset').onclick = () => { fitness.fill(0); bestFitness=0; init(); };

init();
step();

// Restore attempt
(async ()=>{
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('verse',1);
      r.onsuccess = ()=> res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('minds');
    const req = tx.objectStore('minds').get('verse-f590');
    req.onsuccess = () => {
      if(req.result){
        genomes = req.result.genomes || genomes;
        fitness = req.result.fitness || fitness;
        bestFitness = req.result.bestFitness || 0;
        status.textContent = 'Restored sealed mind \u00b7 ';
        applyAll();
      }
    };
  } catch (e) { console.debug("lab f590-orientation-evo-cssgrid-agents-mind:", e); }
})();
