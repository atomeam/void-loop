"use strict";
// ---------- music helpers ----------
const A4=440, midiOf=f=>69+12*Math.log2(f/A4), freqOf=m=>A4*Math.pow(2,(m-69)/12);
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const nameOf=m=>NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1);

// ---------- pitch detector: normalized squared difference (YIN-style) ----------
function detectPitch(buf,sr){
  const n=buf.length; let rms=0; for(let i=0;i<n;i++) rms+=buf[i]*buf[i]; rms=Math.sqrt(rms/n);
  if(rms<0.012) return {f:0,clarity:0,rms};
  const minLag=Math.floor(sr/1000), maxLag=Math.min(Math.floor(sr/70), n>>1), W=n-maxLag;
  const d=new Float32Array(maxLag+1);
  for(let lag=minLag;lag<=maxLag;lag++){let s=0;for(let i=0;i<W;i++){const x=buf[i]-buf[i+lag];s+=x*x}d[lag]=s}
  // cumulative mean normalized difference
  let run=0; const cm=new Float32Array(maxLag+1); cm[minLag]=1;
  for(let lag=minLag;lag<=maxLag;lag++){run+=d[lag]; cm[lag]=run>0? d[lag]*(lag-minLag+1)/run:1}
  let best=-1; for(let lag=minLag+1;lag<maxLag;lag++){ if(cm[lag]<0.15){ while(lag+1<maxLag&&cm[lag+1]<cm[lag]) lag++; best=lag; break; } }
  if(best<0){let mv=1e9;for(let lag=minLag+1;lag<maxLag;lag++) if(cm[lag]<mv){mv=cm[lag];best=lag} if(mv>0.35) return {f:0,clarity:0,rms}}
  const a=cm[best-1],b=cm[best],c=cm[best+1], den=a-2*b+c, off=den?0.5*(a-c)/den:0;
  return {f:sr/(best+off),clarity:1-cm[best],rms};
}
// frames -> notes (segmenting stable pitch runs)
function makeSegmenter(onNote){
  let cur=null, last=-1, frames=0;
  return {push(f,t){
    const m=f>0?midiOf(f):null;
    if(m!==null && cur && Math.abs(m-cur.sum/cur.k)<0.8){cur.sum+=m;cur.k++;cur.end=t;return}
    if(cur && cur.k>=3){const midi=Math.round(cur.sum/cur.k); onNote({midi,start:cur.start,dur:Math.max(.08,cur.end-cur.start)})}
    cur = m!==null? {sum:m,k:1,start:t,end:t}:null;
  }, flush(t){this.push(0,t)}};
}

// ---------- the learner: prediction by partial matching over (interval, duration) ----------
const MAXO=3;
class PPM{
  constructor(){this.t=[new Map(),new Map(),new Map(),new Map()];this.alpha=new Set()}
  sym(prev,n){const iv=Math.max(-12,Math.min(12,n.midi-prev.midi));const du=n.dur<.22?0:n.dur<.45?1:2;return iv+':'+du}
  learn(notes){const s=[];for(let i=1;i<notes.length;i++) s.push(this.sym(notes[i-1],notes[i]));this.learnSyms(s)}
  learnSyms(s){for(let i=0;i<s.length;i++){this.alpha.add(s[i]);for(let o=0;o<=MAXO&&o<=i;o++){const ctx=s.slice(i-o,i).join('|');const tb=this.t[o];let m=tb.get(ctx);if(!m){m=new Map();tb.set(ctx,m)}m.set(s[i],(m.get(s[i])||0)+1)}}}
  // PPM-C style blend: escape probability = distinct/(total+distinct)
  dist(hist){
    const out=new Map(); let mass=1; const seen=new Set();
    for(let o=Math.min(MAXO,hist.length);o>=0;o--){
      const m=this.t[o].get(hist.slice(hist.length-o).join('|')); if(!m) continue;
      let tot=0,dis=0; for(const [k,v] of m) if(!seen.has(k)){tot+=v;dis++}
      if(!tot) continue;
      for(const [k,v] of m) if(!seen.has(k)){out.set(k,(out.get(k)||0)+mass*v/(tot+dis));seen.add(k)}
      mass*=dis/(tot+dis);
    }
    const base=['0:1','2:1','-2:1','1:1','-1:1','3:1','-3:1','5:1','-5:1','4:1','-4:1','7:1','-7:1','0:0','2:0','-2:0','0:2'];
    const un=base.filter(k=>!seen.has(k)); for(const k of un) out.set(k,(out.get(k)||0)+mass/un.length);
    return out;
  }
  sample(hist,temp=0.8){
    const d=this.dist(hist); let ent=0,z=0; const ks=[],ws=[];
    for(const [k,p] of d){ent-=p*Math.log2(p);const w=Math.pow(p,1/temp);ks.push(k);ws.push(w);z+=w}
    let r=Math.random()*z; for(let i=0;i<ks.length;i++){r-=ws[i];if(r<=0) return {s:ks[i],ent}}
    return {s:ks[ks.length-1],ent};
  }
  toJSON(){return this.t.map(tb=>[...tb].map(([c,m])=>[c,[...m]]))}
  static from(j){const p=new PPM();if(Array.isArray(j))j.forEach((tb,o)=>tb.forEach(([c,m])=>{p.t[o].set(c,new Map(m));m.forEach(([k])=>p.alpha.add(k))}));return p}
}
// keep answers singable: snap to the key implied by the user's notes
function keyOf(notes){
  const major=[0,2,4,5,7,9,11]; let best=0,bs=-1;
  for(let r=0;r<12;r++){let s=0;for(const n of notes) if(major.includes(((n.midi-r)%12+12)%12)) s+=n.dur; if(s>bs){bs=s;best=r}}
  return m=>{for(let d=0;d<3;d++){for(const x of [m+d,m-d]) if(major.includes(((x-best)%12+12)%12)) return x}return m};
}
function answer(model,notes,len=8){
  if(notes.length<2) return [];
  const snap=keyOf(notes), hist=[]; for(let i=1;i<notes.length;i++) hist.push(model.sym(notes[i-1],notes[i]));
  const out=[]; let prev=notes[notes.length-1], t=prev.start+prev.dur+0.35;
  const lo=Math.min(...notes.map(n=>n.midi))-3, hi=Math.max(...notes.map(n=>n.midi))+3;
  for(let i=0;i<len;i++){
    const {s,ent}=model.sample(hist); const [iv,du]=s.split(':').map(Number);
    let midi=snap(Math.max(lo,Math.min(hi,prev.midi+iv)));
    if(i===len-1) midi=snap(notes[0].midi); // resolve home
    const dur=[.18,.34,.6][du]; const n={midi,start:t,dur,ai:true,ent};
    out.push(n); hist.push(model.sym(prev,n)); prev=n; t+=dur+.04;
  }
  return out;
}

// ---------- state ----------
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let model=PPM.from(store.get('f299.model',null));
let notes=[]; // {midi,start,dur,ai?,ent?}
const crystals=[]; // render objects
function addNote(n){notes.push(n);crystals.push({n,born:performance.now(),ring:1})}
function rebuild(){crystals.length=0;const now=performance.now();notes.forEach((n,i)=>crystals.push({n,born:now-2000+i*30,ring:0}))}

// ---------- audio ----------
let ac=null; const getAC=()=>ac||(ac=new (window.AudioContext||window.webkitAudioContext)());
function voice(ctx,dest,midi,t,dur,ai){
  const f=freqOf(midi), g=ctx.createGain(), o=ctx.createOscillator(), o2=ctx.createOscillator();
  o.type='sine'; o2.type='triangle'; o.frequency.value=f; o2.frequency.value=f*(ai?2.003:3.01);
  const g2=ctx.createGain(); g2.gain.value=ai?.18:.1;
  o.connect(g); o2.connect(g2).connect(g); g.connect(dest);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.28,t+.008); g.gain.exponentialRampToValueAtTime(.001,t+dur+.9);
  o.start(t);o2.start(t);o.stop(t+dur+1);o2.stop(t+dur+1);
}
function playList(list){
  if(!list.length) return; const ctx=getAC(); ctx.resume(); const t0=ctx.currentTime+.08, s0=list[0].start;
  list.forEach(n=>{voice(ctx,ctx.destination,n.midi,t0+(n.start-s0),n.dur,n.ai);
    const c=crystals.find(c=>c.n===n); if(c) setTimeout(()=>c.ring=1,(n.start-s0)*1000+80)});
}
async function renderWav(list){
  const s0=list[0].start, len=list[list.length-1].start-s0+list[list.length-1].dur+1.5, sr=44100;
  const oc=new OfflineAudioContext(1,Math.ceil(len*sr),sr); list.forEach(n=>voice(oc,oc.destination,n.midi,n.start-s0+.02,n.dur,n.ai));
  const b=(await oc.startRendering()).getChannelData(0); const dv=new DataView(new ArrayBuffer(44+b.length*2));
  const w=(o,s)=>[...s].forEach((ch,i)=>dv.setUint8(o+i,ch.charCodeAt(0)));
  w(0,'RIFF');dv.setUint32(4,36+b.length*2,true);w(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
  dv.setUint32(24,sr,true);dv.setUint32(28,sr*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,b.length*2,true);
  for(let i=0;i<b.length;i++) dv.setInt16(44+i*2,Math.max(-1,Math.min(1,b[i]))*32767,true);
  return new Blob([dv],{type:'audio/wav'});
}

// ---------- mic ----------
let mic=null;
async function startMic(){
  const ctx=getAC(); await ctx.resume();
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
  const src=ctx.createMediaStreamSource(stream), an=ctx.createAnalyser(); an.fftSize=2048; src.connect(an);
  const buf=new Float32Array(an.fftSize), t0=performance.now(), offset=notes.length?notes[notes.length-1].start+notes[notes.length-1].dur+.4:0;
  const seg=makeSegmenter(n=>{n.start+=offset;addNote(n);status(`heard ${nameOf(n.midi)}`)});
  const tick=()=>{ if(!mic) return; an.getFloatTimeDomainData(buf); const p=detectPitch(buf,ctx.sampleRate);
    live.f=p.f; seg.push(p.f,(performance.now()-t0)/1000); mic.raf=requestAnimationFrame(tick)};
  mic={stream,seg,t0,raf:requestAnimationFrame(tick)};
}
function stopMic(){ if(!mic) return; mic.seg.flush((performance.now()-mic.t0)/1000); mic.stream.getTracks().forEach(t=>t.stop()); cancelAnimationFrame(mic.raf); mic=null; live.f=0; learnMine(); }
const live={f:0};
function learnMine(){const mine=notes.filter(n=>!n.ai); if(mine.length>2){model.learn(mine);store.set('f299.model',model.toJSON())}}

// ---------- 3D spiral (plain canvas projection: runs on every phone) ----------
const cv=document.getElementById('c'), g=cv.getContext('2d'); let W=0,H=0,DPR=1;
function size(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;g.setTransform(DPR,0,0,DPR,0,0)}
addEventListener('resize',size); size();
let yaw=0.4,pitch=0.38,dragging=null,auto=true;
cv.addEventListener('pointerdown',e=>{dragging={x:e.clientX,y:e.clientY};auto=false;cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-dragging.x)*.008;pitch=Math.max(.05,Math.min(1.2,pitch+(e.clientY-dragging.y)*.006));dragging={x:e.clientX,y:e.clientY}});
cv.addEventListener('pointerup',()=>dragging=null);
const stars=Array.from({length:260},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),tw:Math.random()*6}));
function proj(x,y,z){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  let X=x*cy-z*sy, Z=x*sy+z*cy; let Y=y*cp-Z*sp; Z=y*sp+Z*cp; const d=7+Z, s=Math.min(W,H*.8)*(W<560?.95:.62)/d; return {x:W/2+X*s,y:H*(W<560?.42:.56)-Y*s,s,d}}
function posOf(i,n){const a=i*0.62, r=1.6+i*0.035, h=(n.midi-60)*0.09; return [Math.cos(a)*r,h,Math.sin(a)*r]}
function hue(m,ai){return ai? (200+((m%12)*9))%360 : (300+(m%12)*12)%360}
function frame(now){
  if(auto) yaw+=0.0016;
  g.fillStyle='#03030a';g.fillRect(0,0,W,H);
  const rg=g.createRadialGradient(W/2,H*.56,0,W/2,H*.56,Math.max(W,H)*.7); rg.addColorStop(0,'rgba(60,40,120,.35)');rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=rg;g.fillRect(0,0,W,H);
  for(const s of stars){const a=.25+.25*Math.sin(now*.001+s.tw);g.fillStyle=`rgba(200,210,255,${a})`;g.fillRect((s.x*.5+.5)*W,(s.y*.5+.5)*H,1.2,1.2)}
  // the spiral thread
  const pts=crystals.map((c,i)=>proj(...posOf(i,c.n)));
  g.lineWidth=1;g.strokeStyle='rgba(160,170,255,.25)';g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.stroke();
  const order=crystals.map((c,i)=>i).sort((a,b)=>pts[b].d-pts[a].d);
  for(const i of order){const c=crystals[i],p=pts[i],n=c.n,age=Math.min(1,(now-c.born)/600);c.ring*=0.96;
    const base=proj(posOf(i,n)[0],-1.2,posOf(i,n)[2]);
    const h=hue(n.midi,n.ai), hgt=(14+n.dur*40)*p.s/60*age, wdt=7*p.s/60*(1+c.ring*.6);
    const cloud=n.ai? Math.min(1,(n.ent||0)/4):0; // uncertain answers look frosted
    g.strokeStyle=`hsla(${h},80%,70%,.12)`;g.beginPath();g.moveTo(base.x,base.y);g.lineTo(p.x,p.y);g.stroke();
    const glow=g.createRadialGradient(p.x,p.y,0,p.x,p.y,wdt*5*(1+c.ring));glow.addColorStop(0,`hsla(${h},90%,65%,${.35+c.ring*.5})`);glow.addColorStop(1,'hsla(0,0%,0%,0)');
    g.fillStyle=glow;g.beginPath();g.arc(p.x,p.y,wdt*5*(1+c.ring),0,7);g.fill();
    g.beginPath();g.moveTo(p.x,p.y-hgt);g.lineTo(p.x+wdt,p.y);g.lineTo(p.x,p.y+hgt*.45);g.lineTo(p.x-wdt,p.y);g.closePath();
    const lg=g.createLinearGradient(p.x-wdt,p.y-hgt,p.x+wdt,p.y+hgt*.45);
    lg.addColorStop(0,`hsla(${h},100%,${92-cloud*20}%,${.95-cloud*.45})`);lg.addColorStop(1,`hsla(${h},80%,${45+cloud*25}%,${.85-cloud*.4})`);
    g.fillStyle=lg;g.fill();g.strokeStyle=`hsla(${h},100%,90%,${.6-cloud*.4})`;g.stroke();
    if(c.ring>.3){g.fillStyle=`rgba(255,255,255,${c.ring})`;g.font='12px system-ui';g.textAlign='center';g.fillText(nameOf(n.midi),p.x,p.y-hgt-6)}
  }
  if(live.f){const m=midiOf(live.f);const p=proj(0,(m-60)*.09,0);g.fillStyle='rgba(255,120,160,.9)';g.beginPath();g.arc(p.x,p.y,6+4*Math.sin(now*.02),0,7);g.fill()}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- share via URL ----------
function encode(list){return list.map(n=>(n.midi).toString(36).padStart(2,'0')+Math.round(n.dur*20).toString(36)+(n.ai?'a':'u')).join('')}
function decode(s){const out=[];let t=0;for(let i=0;i+3<=s.length;i+=4){const midi=parseInt(s.slice(i,i+2),36),dur=parseInt(s[i+2],36)/20,ai=s[i+3]==='a';out.push({midi,start:t,dur,ai,ent:ai?1:0});t+=dur+.05}return out}

// ---------- UI ----------
const $=id=>document.getElementById(id), st=$('status');
function status(s){st.textContent=s+`\n${notes.length} notes · box knows ${model.t[0].get('')?[...model.t[0].get('').values()].reduce((a,b)=>a+b,0):0} steps`}
function toast(s){const t=$('toast');t.textContent=s;t.style.opacity=1;clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.opacity=0,1800)}
$('rec').onclick=async()=>{ if(mic){stopMic();$('rec').classList.remove('on');$('rec').setAttribute('aria-pressed','false');$('rec').textContent='● Hum';status('learned your tune');return}
  try{await startMic();$('rec').classList.add('on');$('rec').setAttribute('aria-pressed','true');$('rec').textContent='■ Stop';status('listening… hum one note at a time')}catch(e){toast('The mic is off. Try a tune instead.')}};
$('ans').onclick=()=>{const mine=notes.filter(n=>!n.ai);if(mine.length<2){toast('Hum a few notes first, or try a tune.');return}
  const a=answer(model,mine.slice(-12),8); a.forEach(addNote); playList(a); status('the box answered')};
$('play').onclick=()=>playList(notes);
$('demo').onclick=()=>{const tune=[60,62,64,60,60,62,64,60,64,65,67,64,65,67];let t=notes.length?notes[notes.length-1].start+1:0;
  tune.forEach((m,i)=>{const d=(i===10||i===13)?.6:.3;const n={midi:m,start:t,dur:d};addNote(n);t+=d+.05});learnMine();playList(notes.filter(n=>!n.ai).slice(-tune.length));status('a tune to start from')};
$('share').onclick=async()=>{if(!notes.length){toast('Nothing to share yet.');return}const url=location.href.split('#')[0]+'#t='+encode(notes);
  try{if(navigator.share) await navigator.share({title:'My hum crystals',url}); else {await navigator.clipboard.writeText(url);toast('Link copied')}}catch(e){toast('Link: '+url.slice(0,60)+'…')}};
$('wav').onclick=async()=>{if(!notes.length){toast('Nothing to save yet.');return}const b=await renderWav(notes);const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hum-crystals.wav';a.click();toast('Saved')};
$('clr').onclick=()=>{notes=[];crystals.length=0;status('cleared (the box still remembers how you hum)')};
const h=location.hash.match(/t=([0-9a-z]+)/); if(h){notes=decode(h[1]);rebuild();status('a shared tune — press Play')} else status('ready');

// ---------- self-test (?selftest) : measures detector + learner honestly ----------
async function selftest(){
  const R={};
  // 1) pitch detector on synthetic hums with vibrato, breathiness and harmonics
  const sr=44100, tune=[57,60,62,64,67,69,72,64,60,55,59,62,65,70,52,74];
  const oc=new OfflineAudioContext(1,Math.ceil(sr*tune.length*.4),sr);
  tune.forEach((m,i)=>{const t=i*.4, f=freqOf(m);const o=oc.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f,t);
    const lfo=oc.createOscillator(),lg=oc.createGain();lfo.frequency.value=5.5;lg.gain.value=f*.012;lfo.connect(lg).connect(o.frequency);
    const lp=oc.createBiquadFilter();lp.frequency.value=1400;const gg=oc.createGain();gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(.4,t+.03);gg.gain.setValueAtTime(.4,t+.3);gg.gain.linearRampToValueAtTime(0,t+.34);
    o.connect(lp).connect(gg).connect(oc.destination);o.start(t);o.stop(t+.36);lfo.start(t);lfo.stop(t+.36)});
  const nb=oc.createBuffer(1,oc.length,sr),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=(Math.random()*2-1)*.02;
  const ns=oc.createBufferSource();ns.buffer=nb;ns.connect(oc.destination);ns.start();
  const data=(await oc.startRendering()).getChannelData(0); const got=[]; const seg=makeSegmenter(n=>got.push(n));
  const hop=735,win=2048; for(let i=0;i+win<data.length;i+=hop){const p=detectPitch(data.subarray(i,i+win),sr);seg.push(p.f,i/sr)} seg.flush(data.length/sr);
  let hit=0; tune.forEach((m,i)=>{if(got.some(n=>Math.abs(n.start-i*.4)<.15&&n.midi===m))hit++});
  R.detector={notesPlayed:tune.length,notesFound:got.length,exactPitchHits:hit,accuracy:+(hit/tune.length).toFixed(3)};
  // 2) learner: does PPM predict the next step of a user's style better than order-0 and uniform?
  const rnd=(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647})();
  const motifs=[[2,2,-4],[0,7,-2,-2],[-1,-2,3],[5,-3,-2]];
  const gen=k=>{const out=[{midi:60,dur:.3}];for(let i=0;i<k;i++){const mo=motifs[Math.floor(rnd()*motifs.length)];for(const iv of mo){const p=out[out.length-1];out.push({midi:Math.max(48,Math.min(84,p.midi+iv)),dur:rnd()<.8?.3:.6})}}return out.map((n,i)=>({...n,start:i*.4}))};
  const ppm=new PPM(); for(let i=0;i<12;i++) ppm.learn(gen(6));
  const order0=new Map(); ppm.t[0].get('').forEach((v,k)=>order0.set(k,v)); const tot0=[...order0.values()].reduce((a,b)=>a+b,0);
  let bitsP=0,bits0=0,top1=0,cnt=0; const test=gen(40); const syms=[];for(let i=1;i<test.length;i++)syms.push(ppm.sym(test[i-1],test[i]));
  for(let i=0;i<syms.length;i++){const d=ppm.dist(syms.slice(Math.max(0,i-MAXO),i));const p=d.get(syms[i])||1e-6;bitsP-=Math.log2(p);
    bits0-=Math.log2(((order0.get(syms[i])||0)+.5)/(tot0+.5*25));
    let bk=null,bp=-1;d.forEach((v,k)=>{if(v>bp){bp=v;bk=k}});if(bk===syms[i])top1++;cnt++}
  R.learner={testSteps:cnt,ppmBitsPerNote:+(bitsP/cnt).toFixed(3),order0BitsPerNote:+(bits0/cnt).toFixed(3),uniformBitsPerNote:+Math.log2(25*3).toFixed(3),ppmTop1:+(top1/cnt).toFixed(3)};
  // 3) answers stay in key and in range
  const userT=gen(3); const ans=answer(ppm,userT,8); const snap=keyOf(userT);
  R.answer={len:ans.length,inKey:ans.filter(n=>snap(n.midi)===n.midi).length,endsHome:ans.length?ans[ans.length-1].midi===snap(userT[0].midi):false};
  // 4) share link round trip
  const enc=encode(userT.concat(ans)), dec=decode(enc); R.share={chars:enc.length,roundTrip:dec.every((n,i)=>n.midi===userT.concat(ans)[i].midi)};
  window.__F299=R; document.title='SELFTEST DONE'; console.log('F299',JSON.stringify(R)); return R;
}
if(/selftest/.test(location.search)) selftest();
