const Q=new URLSearchParams(location.search), $=id=>document.getElementById(id);
const S={x:.5,y:.5,h:0,food:[],eaten:0,ms:0,mSpk:[0,0],dopa:0,W:null,idx:0,trail:[],mode:'-',saved:0,loadedIdx:null,eatTimes:[]};
const F={S,ready:false,mode:null,opfs:null,events:[]}; window.__f217=F;
// synapse wall: 32 input rows x 32 motor columns, DOM cells whose opacity/scale are the weights
const wall=$('wall'), cells=[]; for(let i=0;i<32*32;i++){const c=document.createElement('i');wall.appendChild(c);cells.push(c);}
function paintWall(W){ if(!W)return; for(let i=0;i<32;i++)for(let j=0;j<32;j++){const w=W[i*32+j]/6, c=cells[i*32+j]; const same=(i<16)===(j<16);
  c.style.opacity=(0.08+0.92*w).toFixed(2); c.style.background=same?'#a9b4ff':'#ff8fc8'; }
  wall.style.transform=`skewY(${(-S.idx*3).toFixed(2)}deg) scale(${(1+Math.min(.08,S.idx*.03)).toFixed(3)})`;
  document.documentElement.style.setProperty('--glow',Math.max(0,Math.min(1,S.idx/2)).toFixed(2)); $('idx').textContent='wiring '+S.idx.toFixed(2); }
// ---------- OPFS synapse memory ----------
const FILE='f217-synapses.bin';
async function opfsDir(){ try{ return await navigator.storage.getDirectory(); }catch(e){ return null; } }
async function saveW(W){ const d=await opfsDir(); if(!d||!W) return false; const fh=await d.getFileHandle(FILE,{create:true});
  if(fh.createWritable){const w=await fh.createWritable(); await w.write(new Float32Array(W).buffer); await w.close();} else return false; S.saved++; return true; }
async function loadW(){ const d=await opfsDir(); if(!d) return null; try{ const fh=await d.getFileHandle(FILE); const f=await fh.getFile(); const b=await f.arrayBuffer(); return b.byteLength===4096?new Float32Array(b):null; }catch(e){ return null; } }
async function forgetW(){ const d=await opfsDir(); if(d) try{ await d.removeEntry(FILE);}catch(e){} }
F.saveW=saveW; F.loadW=loadW; F.forgetW=forgetW;
// ---------- brain host: AudioWorklet, else main-thread fallback ----------
let node=null, ctx=null, fb=null, learnOn=Q.get('learn')!=='0', speed=+(Q.get('speed')||3);
function send(m){ if(node) node.port.postMessage(m); else if(fb) fbMsg(m); }
function onMsg(m){ if(m.type==='state'){ if(m.eaten>S.eaten) S.eatTimes.push(m.ms); Object.assign(S,m); S.trail.push([m.x,m.y]); if(S.trail.length>240)S.trail.shift(); }
  else if(m.type==='weights'){ S.W=m.W; S.idx=m.idx; paintWall(m.W); } else if(m.type==='loaded'){ S.loadedIdx=m.idx; F.events.push('loaded '+m.idx.toFixed(3)); } }
async function start(){
  $('gate').remove(); const stored=Q.get('fresh')==='1'?null:await loadW();
  try{ ctx=new AudioContext({latencyHint:'interactive'}); await ctx.audioWorklet.addModule('brain-worklet.js');
    node=new AudioWorkletNode(ctx,'synapse-forager',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{seed:+(Q.get('seed')||7),learn:learnOn,speed,vol:Q.get('mute')==='1'?0:0.5}});
    node.port.onmessage=e=>onMsg(e.data); node.connect(ctx.destination); if(ctx.state!=='running') await ctx.resume(); F.mode='audioworklet';
  }catch(e){ F.events.push('worklet failed: '+e.message); node=null; startFallback(); }
  if(stored){ send({cmd:'load',W:stored}); F.events.push('restored synapses from OPFS'); }
  F.ready=true; setInterval(()=>{ if(S.W) saveW(S.W); },10000);
}
function startFallback(){ F.mode='main-thread'; const B=makeBrain({seed:+(Q.get('seed')||7),learn:learnOn}); fb={B,k:speed};
  setInterval(()=>{ for(let t=0;t<fb.k*6;t++) stepMs(B); const w=B.world; onMsg({type:'state',x:w.x,y:w.y,h:w.h,food:w.food.map(a=>a.slice()),eaten:B.eaten,ms:B.ms,sm:B.sm,mSpk:B.mSpk.slice(),dopa:B.dopa-B.base}); },16);
  setInterval(()=>onMsg({type:'weights',W:B.W.slice(),idx:wiring(B).index}),250); }
function fbMsg(m){ const B=fb.B; if(m.cmd==='load'){B.W.set(m.W);onMsg({type:'loaded',idx:wiring(B).index});} if(m.cmd==='learn')B.learn=m.on; if(m.cmd==='speed')fb.k=m.k; if(m.cmd==='food')B.world.food.push([m.x,m.y]); }
F.send=send;
// ---------- offline bench: render the brain faster than real time and read telemetry channels ----------
F.offline=async function(simSec,learn,seed,load){ const k=40, sr=48000, blocks=Math.ceil(simSec*1000/k), len=blocks*128;
  const oc=new OfflineAudioContext(4,len,sr); await oc.audioWorklet.addModule('brain-worklet.js');
  const n=new AudioWorkletNode(oc,'synapse-forager',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[4],processorOptions:{seed,learn,speed:k,vol:0.5,W:load||null}});
  let lastW=null; n.port.onmessage=e=>{ if(e.data.type==='weights') lastW=e.data.W; };
  n.connect(oc.destination); const t0=performance.now(); const buf=await oc.startRendering(); const wall=performance.now()-t0; await new Promise(r=>setTimeout(r,300));
  const eat=buf.getChannelData(2), wi=buf.getChannelData(3), L=buf.getChannelData(0), R=buf.getChannelData(1);
  const per=[], spb=Math.round(sr*1000/ (k*1000) * 128 / 128); // samples per sim second
  const sps=Math.round(128*1000/k); for(let s=sps;s<=len;s+=sps) per.push(Math.round((eat[s-1]-(s-sps>0?eat[s-sps-1]:0))*1000));
  let eL=0,eR=0; for(let i=0;i<len;i+=7){eL+=L[i]*L[i];eR+=R[i]*R[i];}
  const fifth=Math.max(1,Math.floor(per.length/5)), avg=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
  return {simSec,learn,seed,wallMs:Math.round(wall),xRealtime:+(simSec*1000/wall).toFixed(1),eaten:Math.round(eat[len-1]*1000),first:+avg(per.slice(0,fifth)).toFixed(3),last:+avg(per.slice(-fifth)).toFixed(3),wiring:+wi[len-1].toFixed(3),rmsL:+Math.sqrt(eL/(len/7)).toFixed(4),rmsR:+Math.sqrt(eR/(len/7)).toFixed(4),W:lastW}; };
// ---------- render ----------
const cv=$('world'), g=cv.getContext('2d');
function frame(){ const r=devicePixelRatio||1, w=cv.clientWidth*r, h=cv.clientHeight*r; if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  const sz=Math.min(w,h), ox=(w-sz)/2, oy=(h-sz)/2, P=(x,y)=>[ox+x*sz,oy+(1-y)*sz];
  g.fillStyle='rgba(2,2,5,0.28)'; g.fillRect(0,0,w,h);
  for(const f of S.food){const [px,py]=P(f[0],f[1]); const rg=g.createRadialGradient(px,py,0,px,py,sz*.14); rg.addColorStop(0,'rgba(255,190,120,.22)'); rg.addColorStop(1,'rgba(255,190,120,0)'); g.fillStyle=rg; g.beginPath(); g.arc(px,py,sz*.14,0,7); g.fill(); g.fillStyle='#ffd7a0'; g.beginPath(); g.arc(px,py,sz*.008,0,7); g.fill();}
  g.strokeStyle='rgba(150,160,255,.35)'; g.lineWidth=r; g.beginPath(); S.trail.forEach((p,i)=>{const [a,b]=P(p[0],p[1]); if(i&&Math.hypot(p[0]-S.trail[i-1][0],p[1]-S.trail[i-1][1])<.2) g.lineTo(a,b); else g.moveTo(a,b);}); g.stroke();
  const [ax,ay]=P(S.x,S.y), hh=-S.h, d=Math.max(0,Math.min(1,.5+S.dopa*20));
  g.save(); g.translate(ax,ay); g.rotate(hh); g.fillStyle=`hsl(${240-d*120},90%,${60+d*15}%)`; g.beginPath(); g.moveTo(sz*.022,0); g.lineTo(-sz*.014,sz*.012); g.lineTo(-sz*.014,-sz*.012); g.fill();
  g.strokeStyle='rgba(200,210,255,.6)'; for(const s of [-1,1]){ g.beginPath(); g.moveTo(0,0); g.lineTo(Math.cos(.6*s)*sz*.05,Math.sin(.6*s)*sz*.05); g.stroke(); } g.restore();
  $('bL').style.height=Math.min(100,S.mSpk[0]*25)+'%'; $('bR').style.height=Math.min(100,S.mSpk[1]*25)+'%'; $('bD').style.height=Math.min(100,Math.abs(S.dopa)*600)+'%';
  const rec=S.eatTimes.filter(t=>t>S.ms-60000).length;
  $('stat').textContent=`engine ${F.mode||'-'} · brain time ${(S.ms/1000).toFixed(0)} s\nfood eaten ${S.eaten} · last brain-minute ${rec}\nOPFS saves ${S.saved}${S.loadedIdx!=null?' · restored wiring '+S.loadedIdx.toFixed(2):''}`;
  requestAnimationFrame(frame); }
requestAnimationFrame(frame);
cv.addEventListener('pointerdown',e=>{const b=cv.getBoundingClientRect(), sz=Math.min(b.width,b.height), x=(e.clientX-b.left-(b.width-sz)/2)/sz, y=1-(e.clientY-b.top-(b.height-sz)/2)/sz; if(x>=0&&x<=1&&y>=0&&y<=1) send({cmd:'food',x,y});});
$('learn').setAttribute('aria-pressed',learnOn); $('learn').textContent='Learning '+(learnOn?'on':'off');
$('go').onclick=start; if(Q.get('auto')==='1') start();
$('learn').onclick=e=>{learnOn=!learnOn; e.target.setAttribute('aria-pressed',learnOn); e.target.textContent='Learning '+(learnOn?'on':'off'); send({cmd:'learn',on:learnOn});};
$('fast').onclick=e=>{const on=e.target.getAttribute('aria-pressed')!=='true'; e.target.setAttribute('aria-pressed',on); send({cmd:'speed',k:on?60:speed});};
$('mute').onclick=e=>{const on=e.target.getAttribute('aria-pressed')!=='true'; e.target.setAttribute('aria-pressed',on); send({cmd:'vol',v:on?0:0.5});};
$('save').onclick=()=>saveW(S.W); $('forget').onclick=async()=>{await forgetW(); F.events.push('forgot');};
