"use strict";
const F236=(()=>{
const PROPS={table:[1.8,.78,1,"#7a5a3c"],window:[1.6,1.7,.12,"#3c5a8a",1],door:[1.1,2.1,.12,"#5a4632",1],chair:[.5,.9,.5,"#6b4e36"],sofa:[2,.8,.9,"#5b3f6b"],couch:[2,.8,.9,"#5b3f6b"],bed:[1.6,.6,2.1,"#6a6a8a"],desk:[1.4,.76,.7,"#6d5236"],lamp:[.35,1.6,.35,"#d8c27a"],piano:[1.5,1.1,.7,"#222"],car:[1.9,1.4,4.2,"#8a2b2b"],tree:[1,3,1,"#2e5a35"],fire:[.9,.5,.9,"#e07a2a"],fireplace:[1.6,1.3,.5,"#7a4a3a",1],bench:[1.6,.5,.5,"#6b5a40"],boat:[1.4,.8,3,"#4a6a7a"],box:[.6,.6,.6,"#8a7a50"],stairs:[1.2,2.2,2,"#55505f"],mirror:[.8,1.6,.08,"#9fb4cf",1],counter:[2.2,.92,.65,"#7d7d86"],fridge:[.8,1.8,.7,"#c9ccd3"],shelf:[1.2,1.9,.35,"#6a5038",1],sink:[.9,.9,.6,"#a0a8b0"],stove:[.8,.9,.65,"#3a3a40"],tv:[1.2,.75,.12,"#111",1],moon:[.01,.01,.01,"#000"]};
const STOP=new Set("The A An She He They It We I You Close Wide Scene Int Ext Later Night Then Day Morning After Before Meanwhile Suddenly Everyone Nobody Someone This That There Here Her His Their Our Silence Pause Cut Fade".split(" "));
const MOVE=/\b(walks|moves|crosses|runs|goes|steps|wanders|paces|approaches|returns|heads|drifts|hurries|backs|turns)\b/i;
const COLORS=["#c9b6ff","#ffcf9e","#9fe3c9","#ff9fb5","#a8d4ff","#f3f0a0"];
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0||1;return()=>{a^=a<<13;a>>>=0;a^=a>>17;a^=a<<5;a>>>=0;return a/4294967296}}
function findProps(text){const out=[];const re=/\b([a-z]+?)(s)?\b/gi;let m;const low=text.toLowerCase();for(const k of Object.keys(PROPS)){const r=new RegExp("\\b"+k+"s?\\b");if(r.test(low)&&k!=="moon")out.push(k)}return out}
function parse(src){
  const lines=src.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const beats=[],actors=[],props=new Set();let setting="";
  const addActor=n=>{if(!actors.includes(n)&&actors.length<6)actors.push(n)};
  // pass 1: names
  for(const L of lines){const d=L.match(/^([A-Z][a-zA-Z'\-]{1,20})\s*:\s*(.+)$/);if(d&&!/^(SCENE|INT|EXT)$/i.test(d[1]))addActor(d[1]);
    const a=L.match(/^([A-Z][a-zA-Z'\-]{1,20})\s+(is|stands|sits|walks|moves|crosses|runs|goes|steps|waits|leans|looks|turns|wanders|paces|approaches|returns|heads|drifts|hurries|backs|kneels|laughs|cries|reads|plays|enters|watches|smiles|freezes)\b/);
    if(a&&!STOP.has(a[1]))addActor(a[1])}
  for(const L of lines){
    if(/^(SCENE|INT\.?|EXT\.?)\b/i.test(L)){setting=L.replace(/^(SCENE\s*:?|INT\.?|EXT\.?)\s*/i,"");findProps(L).forEach(p=>props.add(p));continue}
    const b={text:L,kind:"action",subject:null,other:null,move:null,rel:null,close:false,sit:false};
    const d=L.match(/^([A-Z][a-zA-Z'\-]{1,20})\s*:\s*(.+)$/);
    const c=L.match(/^(close(?:[- ]?up)? on|tight on)\s+([A-Z][a-zA-Z'\-]+)/i);
    const w=/^(wide|establishing)\b/i.test(L);
    if(c&&actors.includes(c[2])){b.kind="close";b.subject=c[2];b.close=true}
    else if(d&&actors.includes(d[1])){b.kind="line";b.subject=d[1];b.line=d[2];b.loud=/[!?]/.test(d[2])}
    else{const first=actors.find(n=>new RegExp("^"+n+"\\b").test(L))||actors.find(n=>new RegExp("\\b"+n+"\\b").test(L));b.subject=first||null;if(w)b.kind="wide"}
    findProps(L).forEach(p=>props.add(p));
    const tgt=L.match(/\b(by|near|beside|next to|at|to|toward|towards|behind|in front of|left of|right of|on|from)\s+(?:the\s+|a\s+|an\s+)?([A-Za-z]+)/i);
    if(tgt){const word=tgt[2];const kind=/behind/i.test(tgt[1])?"behind":/front/i.test(tgt[1])?"front":/left/i.test(tgt[1])?"left":/right/i.test(tgt[1])?"right":"near";
      const pk=Object.keys(PROPS).find(k=>new RegExp("^"+k+"s?$","i").test(word));
      const ak=actors.find(n=>n===word);
      if(pk||ak)b.rel={kind,target:pk?{prop:pk}:{actor:ak}}}
    if(b.subject&&b.kind==="action"&&MOVE.test(L)&&b.rel){b.kind="move";b.move=b.rel}
    if(/\bsits?\b|\bseated\b/i.test(L))b.sit=true;
    beats.push(b)}
  // dialogue partners: the most recent other speaker or actor
  let last=[];for(const b of beats){if(b.subject){b.other=last.find(n=>n!==b.subject)||actors.find(n=>n!==b.subject)||null;last=[b.subject,...last.filter(n=>n!==b.subject)]}}
  return{setting,actors,props:[...props],beats}}
// ---------- layout solver: relaxation over soft constraints ----------
const BX=[-5,5],BZ=[-2.6,3.9];
function solve(sc,seed){
  const R=rng(seed||hash(sc.actors.join()+sc.props.join()));const ents={};
  sc.props.forEach((p,i)=>{const [w,h,d,col,wall]=PROPS[p];ents["#"+p]={id:"#"+p,prop:p,w,h,d,col,wall:!!wall,x:(R()*2-1)*3.6,z:wall?BZ[1]:(R()*2-1)*2,r:Math.max(w,d)/2+.15}});
  sc.actors.forEach((a,i)=>{ents[a]={id:a,actor:a,x:(i-(sc.actors.length-1)/2)*1.6,z:.2+R()*.6,r:.32,col:COLORS[i%COLORS.length],h:1.72,sit:false}});
  const cons=[];
  // static placement: first relation of each actor before it ever moves
  const placed=new Set();
  for(const b of sc.beats){if(!b.subject)continue;if(b.kind==="move"){placed.add(b.subject);continue}
    if(b.rel&&!placed.has(b.subject)){cons.push({a:b.subject,...b.rel});placed.add(b.subject);if(b.sit)ents[b.subject].sit=true}}
  const energy=relax(ents,cons,400);return{ents,cons,energy}}
function tgtEnt(ents,t){return t.prop?ents["#"+t.prop]:ents[t.actor]}
function relax(ents,cons,iters,fixed){
  const list=Object.values(ents);let E=0;
  for(let it=0;it<iters;it++){E=0;const k=.35*(1-it/iters)+.05;
    for(const c of cons){const a=ents[c.a],t=tgtEnt(ents,c.target);if(!a||!t)continue;let gx=0,gz=0;
      if(c.kind==="near"){const want=t.r+a.r+.2;const dx=a.x-t.x,dz=a.z-t.z,dd=Math.hypot(dx,dz)||1e-3;const e=dd-want;E+=e*e;gx=-e*dx/dd;gz=-e*dz/dd;if(t.wall&&a.z>t.z-.5){gz-=.5;E+=.2}}
      else if(c.kind==="behind"){const e=Math.max(0,(t.z+t.r+.3)-a.z);E+=e*e;gz=e;gx=(t.x-a.x)*.3}
      else if(c.kind==="front"){const e=Math.max(0,a.z-(t.z-t.r-.3));E+=e*e;gz=-e;gx=(t.x-a.x)*.3}
      else if(c.kind==="left"){const e=Math.max(0,a.x-(t.x-t.r-.5));E+=e*e;gx=-e;gz=(t.z-a.z)*.3}
      else if(c.kind==="right"){const e=Math.max(0,(t.x+t.r+.5)-a.x);E+=e*e;gx=e;gz=(t.z-a.z)*.3}
      if(!(fixed&&fixed.has(a.id))){a.x+=gx*k;a.z+=gz*k}}
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];const dx=b.x-a.x,dz=b.z-a.z,dd=Math.hypot(dx,dz)||1e-3,m=a.r+b.r+.08;
      if(dd<m){const e=m-dd;E+=e*e;const ux=dx/dd,uz=dz/dd;const fa=a.wall?0:(b.wall?1:.5),fb=1-fa;
        if(!(fixed&&fixed.has(a.id))){a.x-=ux*e*fa;if(!a.wall)a.z-=uz*e*fa}if(!(fixed&&fixed.has(b.id))){b.x+=ux*e*fb;if(!b.wall)b.z+=uz*e*fb}}}
    for(const a of list){const lx=a.wall?a.w/2:a.r;a.x=Math.min(BX[1]-lx,Math.max(BX[0]+lx,a.x));if(a.wall)a.z=BZ[1];else a.z=Math.min(BZ[1]-a.r-.15,Math.max(BZ[0]+a.r,a.z))}}
  return E}
function clone(e){const o={};for(const k in e)o[k]={...e[k]};return o}
// per-beat positions: movers walk to targets, everyone else holds
function blockBeats(sc,lay){
  let cur=clone(lay.ents);const frames=[];
  for(const b of sc.beats){const start=clone(cur);
    if(b.kind==="move"&&cur[b.subject]){const a=cur[b.subject];a.sit=false;const fixed=new Set(Object.keys(cur).filter(k=>k!==b.subject));relax(cur,[{a:b.subject,...b.move}],160,fixed)}
    else if(b.sit&&cur[b.subject])cur[b.subject].sit=true;
    frames.push({start,end:clone(cur)})}
  return frames}
// ---------- camera director ----------
const V={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}};
function camBasis(c){const f=V.norm(V.sub(c.tgt,c.pos));let r=[f[2],0,-f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];return{f,r,u}}
function project(c,B,p,W,H){const d=V.sub(p,c.pos);const cz=V.dot(d,B.f);if(cz<.05)return null;const fo=H*(c.fov||1.25);return{x:W/2+V.dot(d,B.r)/cz*fo,y:H/2-V.dot(d,B.u)/cz*fo,z:cz}}
function headY(a){return a.sit?1.15:a.h}
function candidates(b,ents){
  const out=[];const S=ents[b.subject];const list=Object.values(ents);
  const cx=list.reduce((s,e)=>s+e.x,0)/list.length,cz=list.reduce((s,e)=>s+e.z,0)/list.length;
  out.push({type:"wide",pos:[cx,4.2,BZ[0]-6.5],tgt:[cx,.8,cz+.6],fov:1.05});
  out.push({type:"wide",pos:[cx-5,3.6,BZ[0]-4.5],tgt:[cx,.8,cz+.4],fov:1.05});
  out.push({type:"wide",pos:[cx+5,3.6,BZ[0]-4.5],tgt:[cx,.8,cz+.4],fov:1.05});
  if(!S)return out;const hy=headY(S);
  for(let i=0;i<8;i++){const a=-Math.PI/2+(i-3.5)*Math.PI/7;const dx=Math.cos(a),dz=Math.sin(a);
    out.push({type:"medium",ang:a,pos:[S.x+dx*3.2,1.55,S.z+dz*3.2],tgt:[S.x,hy-.45,S.z]});
    out.push({type:"close",ang:a,pos:[S.x+dx*1.5,hy-.1,S.z+dz*1.5],tgt:[S.x,hy-.12,S.z],fov:1.35})}
  const O=b.other&&ents[b.other];
  if(O){const dx=O.x-S.x,dz=O.z-S.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;for(const s of[-1,1]){const px=-uz*s,pz=ux*s;
    out.push({type:"ots",side:s,pos:[O.x+ux*.9+px*.55,headY(O)+.05,O.z+uz*.9+pz*.55],tgt:[S.x,hy-.2,S.z],fov:1.3})}}
  return out}
function side2(a,b,p){return Math.sign((b.x-a.x)*(p[2]-a.z)-(b.z-a.z)*(p[0]-a.x))||1}
function pairKey(a,b){return[a,b].sort().join("|")}
function scoreCam(c,b,ents,mem){
  const W=16,H=9,B=camBasis(c);const terms={};let s=0;const add=(k,v)=>{terms[k]=(terms[k]||0)+v;s+=v};
  const S=b.subject&&ents[b.subject];
  if(S){const p=project(c,B,[S.x,headY(S)-.15,S.z],W,H);
    if(!p||p.x<W*.08||p.x>W*.92||p.y<H*.04||p.y>H*.9)add("subject off frame",-6);
    else{add("subject framed",2);const th=Math.min(Math.abs(p.x/W-1/3),Math.abs(p.x/W-2/3));if(c.type!=="wide")add("rule of thirds",1-4*th)}
    // occlusion: anything between camera and subject
    const sx=S.x-c.pos[0],sz=S.z-c.pos[2],sd=Math.hypot(sx,sz);let occ=0;
    for(const e of Object.values(ents)){if(e===S)continue;if(c.type==="ots"&&e.id===b.other)continue;const ex=e.x-c.pos[0],ez=e.z-c.pos[2];const t=(ex*sx+ez*sz)/(sd*sd);if(t<=0||t>=.97)continue;
      const dist=Math.hypot(ex-sx*t,ez-sz*t);const tall=e.actor?headY(e):e.h;if(dist<e.r+.12&&tall>.9+(1-t)*.0)occ++}
    if(occ)add("blocked view",-3.5*occ);
    if(b.other&&ents[b.other]&&c.type!=="wide"){const k=pairKey(b.subject,b.other);const [n1,n2]=k.split("|");const sd2=side2(ents[n1],ents[n2],c.pos);
      if(mem.sides[k]&&mem.sides[k]!==sd2)add("crosses the line",-4.5)}
    if(c.type==="ots"&&ents[b.other]){const q=project(c,B,[ents[b.other].x,headY(ents[b.other])-.3,ents[b.other].z],W,H);if(q)add("listener shoulder in frame",.6)}}
  // intent
  const intent={close:{close:3.5},line:{ots:1.4,medium:.9,close:b.loud?1.1:.2},move:{wide:1.8,medium:.6},wide:{wide:3},action:{medium:1,wide:.6}}[b.kind]||{};
  if(intent[c.type])add("fits the beat",intent[c.type]);
  if(mem.n===0&&c.type==="wide")add("establishing shot",2.5);
  if(mem.prev){if(mem.prev.type===c.type)add("same shot again",-.9);
    if(mem.prev.type===c.type&&mem.prev.subject===b.subject&&c.ang!=null&&mem.prev.ang!=null&&Math.abs(c.ang-mem.prev.ang)<.55)add("jump cut",-1.6)}
  // keep cameras on the audience side of the set
  if(c.pos[2]>BZ[1]-.3)add("inside the back wall",-8);
  if(Math.abs(c.pos[0])>BX[1]+3)add("off the set",-2);
  return{s,terms}}
function direct(sc,frames,mode,seed){
  const R=rng(seed||7);const mem={sides:{},prev:null,n:0};const shots=[];
  sc.beats.forEach((b,i)=>{const ents=frames[i].end;const cands=candidates(b,ents);
    const scored=cands.map(c=>({c,...scoreCam(c,b,ents,mem)})).sort((x,y)=>y.s-x.s);
    const pick=mode==="random"?scored[Math.floor(R()*scored.length)]:scored[0];
    const c={...pick.c,subject:b.subject};
    if(b.subject&&b.other&&ents[b.other]&&c.type!=="wide"){const k=pairKey(b.subject,b.other);const [n1,n2]=k.split("|");if(!mem.sides[k])mem.sides[k]=side2(ents[n1],ents[n2],c.pos)}
    shots.push({cam:c,score:pick.s,terms:pick.terms,top:scored.slice(0,4).map(x=>({type:x.c.type,s:+x.s.toFixed(2)})),n:cands.length});
    mem.prev=c;mem.n++});
  return shots}
function metrics(sc,frames,shots){
  let off=0,occ=0,cross=0,jump=0,sum=0;
  for(const sh of shots){const t=sh.terms;if(t["subject off frame"])off++;if(t["blocked view"])occ++;if(t["crosses the line"])cross++;if(t["jump cut"])jump++;sum+=sh.score}
  return{beats:shots.length,offFrame:off,blocked:occ,lineCrossings:cross,jumpCuts:jump,avgScore:+(sum/(shots.length||1)).toFixed(2)}}
// ---------- renderer (no floor grid: a soft pool of light on the void) ----------
function render(ctx,W,H,ents,cam,opt){
  opt=opt||{};const B=camBasis(cam);
  ctx.fillStyle="#020208";ctx.fillRect(0,0,W,H);
  const R=rng(11);for(let i=0;i<140;i++){ctx.fillStyle=`rgba(200,190,255,${.15+R()*.4})`;ctx.fillRect(R()*W,R()*H*.75,1.2,1.2)}
  // floor pool
  const poly=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;const p=project(cam,B,[Math.cos(a)*6.2,0,.6+Math.sin(a)*4],W,H);if(p)poly.push(p)}
  if(poly.length>2){const g=ctx.createRadialGradient(W/2,H*.75,10,W/2,H*.75,W*.7);g.addColorStop(0,"#1c1836");g.addColorStop(1,"#07060f");ctx.fillStyle=g;ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()}
  const items=[];
  for(const e of Object.values(ents)){
    // shadow
    const sh=[];for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const p=project(cam,B,[e.x+Math.cos(a)*(e.actor?.42:(e.w/2+.1)),0.002,e.z+Math.sin(a)*(e.actor?.42:(e.d/2+.1))],W,H);if(p)sh.push(p)}
    if(sh.length>3){ctx.fillStyle="rgba(0,0,0,.45)";ctx.beginPath();sh.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.fill()}
    if(e.prop){const hw=e.w/2,hd=e.d/2,v=[];for(const y of[0,e.h])for(const dz of[-hd,hd])for(const dx of[-hw,hw])v.push([e.x+dx,y,e.z+dz]);
      const F=[[0,1,3,2,.55],[4,5,7,6,1],[0,1,5,4,.75],[2,3,7,6,.6],[0,2,6,4,.65],[1,3,7,5,.65]];
      for(const f of F){const ps=f.slice(0,4).map(k=>project(cam,B,v[k],W,H));if(ps.some(p=>!p))continue;const cxz=f.slice(0,4).reduce((s,k)=>[s[0]+v[k][0]/4,s[1]+v[k][1]/4,s[2]+v[k][2]/4],[0,0,0]);
        items.push({z:V.len(V.sub(cxz,cam.pos)),draw(){const ar=(ps[1].x-ps[0].x)*(ps[2].y-ps[0].y)-(ps[1].y-ps[0].y)*(ps[2].x-ps[0].x);ctx.fillStyle=shade(e.col,f[4]);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(255,255,255,.06)";ctx.stroke()}})}}
    else{const top=project(cam,B,[e.x,headY(e),e.z],W,H),foot=project(cam,B,[e.x,0,e.z],W,H);if(!top||!foot)continue;
      items.push({z:V.len(V.sub([e.x,1,e.z],cam.pos)),draw(){const hgt=foot.y-top.y,w=hgt*.24;const g=ctx.createLinearGradient(foot.x-w,0,foot.x+w,0);g.addColorStop(0,shade(e.col,.45));g.addColorStop(.6,e.col);g.addColorStop(1,shade(e.col,.6));
        ctx.fillStyle=g;rr(ctx,foot.x-w/2,top.y+hgt*.16,w,hgt*.84,w*.45);ctx.fill();ctx.beginPath();ctx.arc(top.x,top.y+hgt*.08,hgt*.085,0,7);ctx.fillStyle=shade(e.col,1.1);ctx.fill();
        if(opt.labels!==false&&hgt>30){ctx.font=`${Math.max(11,Math.min(22,hgt*.07))}px system-ui`;ctx.textAlign="center";ctx.fillStyle="rgba(240,236,255,.9)";ctx.fillText(e.actor,top.x,top.y-hgt*.04)}}})}}
  items.sort((a,b)=>b.z-a.z).forEach(i=>i.draw());
  const vg=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,W*.75);vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.6)");ctx.fillStyle=vg;ctx.fillRect(0,0,W,H)}
function shade(hex,k){const n=parseInt(hex.slice(1),16);const f=c=>Math.max(0,Math.min(255,Math.round(c*k)));return`rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function lerpEnts(a,b,t){const o=clone(b);for(const k in o){if(a[k]){o[k].x=a[k].x+(b[k].x-a[k].x)*t;o[k].z=a[k].z+(b[k].z-a[k].z)*t}}return o}
function build(src,mode){const sc=parse(src);const lay=solve(sc);const frames=blockBeats(sc,lay);const shots=direct(sc,frames,mode);return{sc,lay,frames,shots,m:metrics(sc,frames,shots)}}
return{parse,solve,blockBeats,direct,metrics,render,build,candidates,scoreCam,lerpEnts,camBasis,project,headY,BX,BZ,hash}})();

// ---------------- UI ----------------
const DEF=`SCENE: a quiet kitchen at night
Mara stands by the window.
Jo sits at the table.
Jo: You're up late.
Mara: I couldn't sleep. The moon is too loud.
Jo walks to the window.
Close on Mara.
Mara: Do you hear it too?
Jo: Every night.
Mara walks to the door.`;
const $=id=>document.getElementById(id);const ta=$("script"),cv=$("stage"),ctx=cv.getContext("2d"),pl=$("plan"),pctx=pl.getContext("2d");
let mode="smart",S=null,cur=0,playing=false,raf=0;
function fromHash(){const m=location.hash.match(/#s=([A-Za-z0-9_\-]+)/);if(!m)return null;try{return decodeURIComponent(escape(atob(m[1].replace(/-/g,"+").replace(/_/g,"/"))))}catch(e){return null}}
ta.value=fromHash()||localStorage.getItem("f236.script")||DEF;
function rebuild(){
  localStorage.setItem("f236.script",ta.value);S=F236.build(ta.value,mode);
  $("err").textContent=S.sc.beats.length?(S.sc.actors.length?"":"No characters found. Start a line with a name, like \"Mara stands by the window.\""):"Write at least one line.";
  cur=0;strip();show(0,1)}
function strip(){const st=$("strip");st.innerHTML="";S.shots.forEach((sh,i)=>{const d=document.createElement("div");d.className="shot";d.tabIndex=0;d.setAttribute("role","button");
  const c=document.createElement("canvas");c.width=320;c.height=180;F236.render(c.getContext("2d"),320,180,S.frames[i].end,sh.cam,{labels:true});
  const t=document.createElement("div");t.textContent=`${i+1}. ${sh.cam.type.toUpperCase()} · ${S.sc.beats[i].text}`;d.append(c,t);d.onclick=d.onkeydown=e=>{if(e.type==="keydown"&&e.key!=="Enter"&&e.key!==" ")return;e.preventDefault&&e.preventDefault();stop();cur=i;show(i,1)};st.append(d)})}
function show(i,t){if(!S||!S.shots.length){ctx.fillStyle="#020208";ctx.fillRect(0,0,cv.width,cv.height);return}
  const ents=F236.lerpEnts(S.frames[i].start,S.frames[i].end,Math.min(1,t));F236.render(ctx,cv.width,cv.height,ents,S.shots[i].cam);
  const b=S.sc.beats[i],sh=S.shots[i];
  $("hud").textContent=`${i+1}/${S.shots.length} · ${sh.cam.type.toUpperCase()}${b.subject?" on "+b.subject:""}${b.line?' — "'+b.line+'"':""}`;
  document.querySelectorAll(".shot").forEach((e,k)=>e.classList.toggle("cur",k===i));
  plan(ents,sh.cam,b);why(sh)}
function why(sh){const T=Object.entries(sh.terms).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));const mx=Math.max(...sh.top.map(x=>Math.abs(x.s)),1);
  $("why").innerHTML=`<b>Why this shot</b> (${sh.n} cameras weighed${mode==="random"?", random director":""}): `+T.map(([k,v])=>`${k} ${v>0?"+":""}${v.toFixed(1)}`).join(", ")+
  "<br>"+sh.top.map(x=>`${x.type} ${x.s}<span class=bar style="width:${Math.max(2,Math.abs(x.s)/mx*60)}px;opacity:${x.s<0?.35:1}"></span>`).join(" &nbsp; ")+
  `<br>Scene check: ${S.m.offFrame} off-frame, ${S.m.blocked} blocked, ${S.m.lineCrossings} line crossings, ${S.m.jumpCuts} jump cuts. Layout strain ${S.lay.energy.toFixed(3)}.`}
function plan(ents,cam,b){const W=pl.width,H=pl.height;pctx.fillStyle="#07060f";pctx.fillRect(0,0,W,H);
  const sx=x=>(x+6.5)/13*W,sz=z=>H-(z+4.5)/9*H;
  for(const e of Object.values(ents)){if(e.prop){pctx.fillStyle=e.col;pctx.globalAlpha=.8;pctx.fillRect(sx(e.x-e.w/2),sz(e.z+e.d/2),e.w/13*W,Math.max(2,e.d/9*H));pctx.globalAlpha=1;pctx.fillStyle="#9a94b8";pctx.font="10px system-ui";pctx.fillText(e.prop,sx(e.x-e.w/2),sz(e.z+e.d/2)-2)}}
  if(b&&b.subject&&b.other&&ents[b.other]){pctx.setLineDash([4,4]);pctx.strokeStyle="#ff9fb5";pctx.beginPath();const a=ents[b.subject],o=ents[b.other];const dx=o.x-a.x,dz=o.z-a.z;pctx.moveTo(sx(a.x-dx*3),sz(a.z-dz*3));pctx.lineTo(sx(o.x+dx*3),sz(o.z+dz*3));pctx.stroke();pctx.setLineDash([])}
  for(const e of Object.values(ents))if(e.actor){pctx.fillStyle=e.col;pctx.beginPath();pctx.arc(sx(e.x),sz(e.z),5,0,7);pctx.fill();pctx.fillStyle="#ddd";pctx.font="10px system-ui";pctx.fillText(e.actor,sx(e.x)+7,sz(e.z)+3)}
  const cx=Math.max(-6.4,Math.min(6.4,cam.pos[0])),cz=Math.max(-4.4,Math.min(4.4,cam.pos[2]));const a=Math.atan2(cam.tgt[2]-cam.pos[2],cam.tgt[0]-cam.pos[0]);
  pctx.fillStyle="rgba(185,166,255,.25)";pctx.beginPath();pctx.moveTo(sx(cx),sz(cz));for(const s of[-.5,.5])pctx.lineTo(sx(cx+Math.cos(a+s)*4),sz(cz+Math.sin(a+s)*4));pctx.fill();
  pctx.fillStyle="#b9a6ff";pctx.fillRect(sx(cx)-4,sz(cz)-4,8,8)}
function stop(){playing=false;cancelAnimationFrame(raf);$("play").textContent="Play"}
function play(){if(playing)return stop();if(!S||!S.shots.length)return;playing=true;$("play").textContent="Pause";let i=cur>=S.shots.length-1?0:cur,t0=performance.now();
  const step=now=>{if(!playing)return;const t=(now-t0)/1700;show(i,t);if(t>=1.25){i++;t0=now;if(i>=S.shots.length){stop();cur=S.shots.length-1;return}cur=i}raf=requestAnimationFrame(step)};raf=requestAnimationFrame(step)}
$("block").onclick=()=>{stop();rebuild()};$("play").onclick=play;
$("mode").onclick=()=>{mode=mode==="smart"?"random":"smart";$("mode").textContent="Director: "+mode;$("mode").setAttribute("aria-pressed",mode==="random");$("mode").classList.toggle("on",mode==="random");stop();rebuild()};
$("png").onclick=()=>{const n=S.shots.length,cols=Math.min(4,n),rows=Math.ceil(n/cols),tw=400,th=225,cap=44;const c=document.createElement("canvas");c.width=cols*tw+(cols+1)*12;c.height=rows*(th+cap)+(rows+1)*12+40;const x=c.getContext("2d");
  x.fillStyle="#04040a";x.fillRect(0,0,c.width,c.height);x.fillStyle="#e9e6ff";x.font="600 18px system-ui";x.fillText("Storyboard"+(S.sc.setting?" · "+S.sc.setting:""),12,28);
  S.shots.forEach((sh,i)=>{const cx=12+(i%cols)*(tw+12),cy=40+Math.floor(i/cols)*(th+cap+12);const o=document.createElement("canvas");o.width=tw;o.height=th;F236.render(o.getContext("2d"),tw,th,S.frames[i].end,sh.cam);x.drawImage(o,cx,cy);
    x.fillStyle="#b9a6ff";x.font="600 12px system-ui";x.fillText(`${i+1}. ${sh.cam.type.toUpperCase()}`,cx,cy+th+16);x.fillStyle="#cfc9e8";x.font="12px system-ui";x.fillText(S.sc.beats[i].text.slice(0,58),cx,cy+th+33)});
  const a=document.createElement("a");a.download="storyboard.png";a.href=c.toDataURL("image/png");a.click()};
$("share").onclick=async()=>{const h="#s="+btoa(unescape(encodeURIComponent(ta.value))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");history.replaceState(null,"",h);
  try{await navigator.clipboard.writeText(location.href);$("err").textContent="Share link copied."}catch(e){$("err").textContent="Link is in the address bar."}};
addEventListener("keydown",e=>{if(e.target===ta)return;if(e.key==="ArrowRight"&&S){stop();cur=Math.min(S.shots.length-1,cur+1);show(cur,1)}if(e.key==="ArrowLeft"&&S){stop();cur=Math.max(0,cur-1);show(cur,1)}});
rebuild();
