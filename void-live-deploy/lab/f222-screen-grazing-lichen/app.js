const W=96,H=60,N=W*H,Q=new URLSearchParams(location.search);
const {Model,Colony,scene}=Lichen;
// Two identical models see the same frames with the same learning budget; only who spends it differs.
const mind=new Model(W,H), ghost=new Model(W,H);
const colony=new Colony(mind,64,{mode:'surprise',seed:7}), blind=new Colony(ghost,64,{mode:'random',seed:7});
const view=document.getElementById('view'),vx=view.getContext('2d'),fx=document.getElementById('fx').getContext('2d'),ch=document.getElementById('chart').getContext('2d');
const grab=document.createElement('canvas');grab.width=W;grab.height=H;const gx=grab.getContext('2d',{willReadFrequently:true});
const vid=document.getElementById('vid');let source='demo',t=0,repelRGB=null,frame=new Float32Array(N),rgb=new Uint8ClampedArray(N*4),errA=[],errB=[];
const F=window.__f222={source:()=>source,frames:0,mind,ghost,colony,errA,errB,repelCells:0};
async function share(opts){
  try{const s=await navigator.mediaDevices.getDisplayMedia(opts||{video:{frameRate:15},audio:false});vid.srcObject=s;await vid.play();source='screen';
    s.getVideoTracks()[0].onended=()=>{source='demo'};F.shareError=null;}
  catch(e){F.shareError=e.name+': '+e.message;stats.textContent='Screen share was not started ('+e.name+'). Running on the demo screen.';}
}
document.getElementById('share').onclick=()=>share();document.getElementById('demo').onclick=()=>{source='demo';if(vid.srcObject)vid.srcObject.getTracks().forEach(t=>t.stop())};
const col=document.getElementById('col');
document.getElementById('pick').onclick=async()=>{
  if('EyeDropper' in window){try{const r=await new EyeDropper().open();setRepel(r.sRGBHex)}catch(e){}}else{col.hidden=false;col.click()}};
col.oninput=()=>setRepel(col.value);
function setRepel(hex){repelRGB=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));F.repelHex=hex}
function readFrame(){
  if(source==='screen'&&vid.readyState>=2){gx.drawImage(vid,0,0,W,H);rgb=gx.getImageData(0,0,W,H).data;for(let i=0;i<N;i++)frame[i]=(rgb[i*4]*.299+rgb[i*4+1]*.587+rgb[i*4+2]*.114)/255}
  else{scene('mixed',W,H,t,frame);for(let i=0;i<N;i++){const v=frame[i]*255;rgb[i*4]=v*.8;rgb[i*4+1]=v*.85;rgb[i*4+2]=v;rgb[i*4+3]=255}}
  let rc=0;for(let i=0;i<N;i++){let r=0;if(repelRGB){const d=Math.abs(rgb[i*4]-repelRGB[0])+Math.abs(rgb[i*4+1]-repelRGB[1])+Math.abs(rgb[i*4+2]-repelRGB[2]);r=d<60?1:0;rc+=r}mind.repel[i]=r;ghost.repel[i]=r}F.repelCells=rc;
}
const img=vx.createImageData(W,H);
function draw(){
  const sS=showS.checked,sP=showP.checked,d=img.data;
  for(let i=0;i<N;i++){const base=sP?mind.pred[i]*255:frame[i]*255*.35,s=sS?Math.min(1,mind.surprise[i]*6):0;
    d[i*4]=base*.6+s*200;d[i*4+1]=base*.6+s*60;d[i*4+2]=base*.9+s*255;d[i*4+3]=255}
  vx.putImageData(img,0,0);fx.clearRect(0,0,960,600);
  for(let i=0;i<colony.n;i++){const e=Math.max(0,Math.min(1,colony.energy[i]*.02));fx.fillStyle=`hsla(${150+e*60},90%,${55+e*20}%,.9)`;fx.beginPath();fx.arc(colony.x[i]*10,colony.y[i]*10,3+e*3,0,6.283);fx.fill()}
  ch.clearRect(0,0,960,90);const mx=Math.max(.02,...errB.slice(-240),...errA.slice(-240));
  for(const [arr,c] of [[errB,'#ff6a8a'],[errA,'#7affc8']]){ch.strokeStyle=c;ch.beginPath();arr.slice(-240).forEach((v,k)=>ch.lineTo(k*4,88-v/mx*80));ch.stroke()}
}
function tick(){
  readFrame();colony.step();blind.step();mind.ingest(frame);ghost.ingest(frame);t++;F.frames++;
  if(mind.frames>2){errA.push(mind.err);errB.push(ghost.err);if(errA.length>2000){errA.shift();errB.shift()}}
  draw();
  if(F.frames%10===0){const a=avg(errA.slice(-200)),b=avg(errB.slice(-200));F.lastA=a;F.lastB=b;
    stats.textContent=`source: ${source}   frames: ${F.frames}   learning budget: ${Math.round(mind.updates/Math.max(1,mind.frames))} of ${N} cells per frame\n`+
    `prediction error, colony-led learning (green): ${(a*1000).toFixed(2)}   same budget spent at random (pink): ${(b*1000).toFixed(2)}   ${b>0?((1-a/b)*100).toFixed(0)+'% less error':''}`+(repelRGB?`\navoiding ${F.repelHex} on ${F.repelCells} cells`:'')}
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,stats=document.getElementById('stats');
setInterval(tick,1000/30);
if(Q.get('auto')==='tab')share({video:true,preferCurrentTab:true,audio:false});
if(Q.get('repel'))setRepel('#'+Q.get('repel'));
