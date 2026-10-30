// F-217 Audible Synapse Forager: a spiking brain that lives on the audio thread.
// Izhikevich neurons + reward-modulated STDP (eligibility traces + dopamine), closed loop
// with a tiny forager world, stepped inside an AudioWorklet so you hear every spike.
// Same file runs in Node (module.exports) for headless tuning.
function mulberry(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function makeBrain(opt){
  opt=opt||{}; const rnd=mulberry(opt.seed||7);
  const G=opt.group||16, NI=2*G, NM=2*G, N=NI+NM;      // inputs L,R ; motors ML,MR
  const W=new Float32Array(NI*NM); const wmax=opt.wmax||6;
  for(let i=0;i<W.length;i++) W[i]=wmax*(0.35+0.3*rnd());
  const v=new Float32Array(N).fill(-65), u=new Float32Array(N).fill(-13);
  const pre=new Float32Array(NI), post=new Float32Array(NM), elig=new Float32Array(NI*NM);
  const fired=new Uint8Array(N);
  const B={G,NI,NM,N,W,wmax,v,u,pre,post,elig,fired,rnd,learn:opt.learn!==false,lr:opt.lr||0.01,ed:opt.ed||0.995,rk:opt.rk||40,norm:opt.norm!==false,tg:opt.tg||0.004,dd:opt.dd==null?0:opt.dd,eb:opt.eb==null?0.1:opt.eb,
    dopa:0,base:0,ms:0,eaten:0,spikes:new Uint32Array(N),mSpk:[0,0],
    world:{x:.5,y:.5,h:0,food:[],r:.035,rewardFlash:0}, sm:[0,0], lastSmell:0, eatLog:[]};
  for(let k=0;k<(opt.food||6);k++) B.world.food.push([rnd(),rnd()]);
  return B;
}
function smellAt(B,x,y){let s=0;for(const f of B.world.food){let dx=Math.abs(f[0]-x),dy=Math.abs(f[1]-y);dx=Math.min(dx,1-dx);dy=Math.min(dy,1-dy);s+=Math.exp(-(dx*dx+dy*dy)/0.02);}return s;}
// one millisecond of brain + world
function stepMs(B,out){
  const {G,NI,NM,N,W,v,u,pre,post,elig,fired,rnd}=B, w=B.world;
  // sensors: two antennas
  const a=0.6, L=0.05;
  const sl=smellAt(B,w.x+L*Math.cos(w.h+a),w.y+L*Math.sin(w.h+a)), sr=smellAt(B,w.x+L*Math.cos(w.h-a),w.y+L*Math.sin(w.h-a));
  const tot=sl+sr+1e-6, dl=sl/tot, dr=sr/tot;           // normalised left/right contrast
  B.sm[0]=dl;B.sm[1]=dr;
  // input neurons: Poisson-ish drive proportional to contrast (rate up to ~60 Hz)
  for(let i=0;i<NI;i++){ const p=(i<G?dl:dr); fired[i]=0; if(rnd()<0.06*p*p*1.6){fired[i]=1;} }
  // motor neurons: Izhikevich RS, input = synaptic + noise
  for(let j=0;j<NM;j++){
    let I=rnd()<0.012?14:0; // exploration noise
    for(let i=0;i<NI;i++) if(fired[i]) I+=W[i*NM+j];
    const n=NI+j; let vv=v[n],uu=u[n];
    vv+=0.5*(0.04*vv*vv+5*vv+140-uu+I); vv+=0.5*(0.04*vv*vv+5*vv+140-uu+I); uu+=0.02*(0.2*vv-uu);
    fired[n]=0; if(vv>=30){vv=-65;uu+=8;fired[n]=1;} v[n]=vv;u[n]=uu;
  }
  // STDP into eligibility traces (tau_pre=tau_post=20ms), eligibility tau 1s
  for(let i=0;i<NI;i++){pre[i]*=0.951; if(fired[i])pre[i]+=1;}
  for(let j=0;j<NM;j++){post[j]*=0.951; if(fired[NI+j])post[j]+=1;}
  for(let i=0;i<NI;i++){ const fi=fired[i]; const row=i*NM;
    for(let j=0;j<NM;j++){ let c=elig[row+j]*B.ed;
      if(fired[NI+j]) c+=pre[i];          // pre before post: potentiate
      if(fi) c-=0.8*post[j];              // post before pre: depress
      elig[row+j]=c; } }
  // motors -> turn; spikes count in a 20ms leaky window
  let ml=0,mr=0; for(let j=0;j<G;j++){ml+=fired[NI+j];mr+=fired[NI+G+j];}
  B.mSpk[0]=B.mSpk[0]*0.95+ml; B.mSpk[1]=B.mSpk[1]*0.95+mr;
  w.h+=B.tg*(B.mSpk[0]-B.mSpk[1]);
  const sp=0.00022; w.x=(w.x+sp*Math.cos(w.h)+1)%1; w.y=(w.y+sp*Math.sin(w.h)+1)%1;
  // reward: dopamine from approach (smell gradient) + burst on eating
  const s=smellAt(B,w.x,w.y); let r=(s-B.lastSmell)*B.rk; B.lastSmell=s;
  for(const f of w.food){let dx=Math.abs(f[0]-w.x),dy=Math.abs(f[1]-w.y);dx=Math.min(dx,1-dx);dy=Math.min(dy,1-dy);
    if(dx*dx+dy*dy<w.r*w.r){B.eaten++;B.eatLog.push(B.ms);r+=B.eb;w.rewardFlash=1;f[0]=rnd();f[1]=rnd();B.lastSmell=smellAt(B,w.x,w.y);}}
  B.dopa=B.dopa*B.dd+r; B.base=B.base*0.9995+0.0005*B.dopa;
  if(B.learn){ const d=(B.dopa-B.base)*B.lr; if(d!==0){ for(let k=0;k<W.length;k++){let x=W[k]+d*elig[k]; W[k]=x<0?0:x>B.wmax?B.wmax:x;} }
    // homeostatic synaptic scaling every 10 ms: each motor neuron keeps a fixed total input,
    // so dopamine can only redistribute weight between left and right inputs, not inflate it.
    if(B.norm && B.ms%10===0){ const tgt=B.wmax*0.5*NI; for(let j=0;j<NM;j++){let t=0;for(let i=0;i<NI;i++)t+=W[i*NM+j]; const f=tgt/(t||1); for(let i=0;i<NI;i++){let x=W[i*NM+j]*f; W[i*NM+j]=x>B.wmax?B.wmax:x;}} } }
  for(let n=0;n<N;n++) if(fired[n]) B.spikes[n]++;
  B.ms++; if(out) out.fired=fired; return fired;
}
// how "correct" the wiring is: same-side minus cross-side mean weight
function wiring(B){const {G,NM,W}=B;let same=0,cross=0;for(let i=0;i<2*G;i++)for(let j=0;j<NM;j++){const s=(i<G)===(j<G);if(s)same+=W[i*NM+j];else cross+=W[i*NM+j];}const n=2*G*G;return{same:same/n,cross:cross/n,index:(same-cross)/n};}
if(typeof module!=='undefined') module.exports={makeBrain,stepMs,wiring,smellAt};
// ---------------- AudioWorklet wrapper ----------------
if(typeof registerProcessor!=='undefined'){
  class SynapseForager extends AudioWorkletProcessor{
    constructor(o){ super(); const p=(o&&o.processorOptions)||{};
      this.B=makeBrain({seed:p.seed||7,learn:p.learn!==false}); if(p.W&&p.W.length===this.B.W.length) this.B.W.set(p.W); this.lastWOut=0; this.k=p.speed||3; this.blocks=0;
      this.env=[0,0,0,0]; this.ph=[0,0,0,0]; this.chime=0; this.vol=p.vol==null?0.5:p.vol;
      this.port.onmessage=e=>{const m=e.data;
        if(m.cmd==='load'&&m.W&&m.W.length===this.B.W.length){this.B.W.set(m.W);this.port.postMessage({type:'loaded',idx:wiring(this.B).index});}
        if(m.cmd==='learn') this.B.learn=!!m.on;
        if(m.cmd==='speed') this.k=Math.max(1,Math.min(200,m.k|0));
        if(m.cmd==='vol') this.vol=m.v;
        if(m.cmd==='food'){this.B.world.food.push([m.x,m.y]); if(this.B.world.food.length>14) this.B.world.food.shift();}
        if(m.cmd==='weights') this.port.postMessage({type:'weights',W:this.B.W.slice(),idx:wiring(this.B).index,ms:this.B.ms,eaten:this.B.eaten});
      };
    }
    process(inputs,outputs){
      const out=outputs[0], n=out[0].length, B=this.B, k=this.k, NI=B.NI, G=B.G, f=[440,660,185,1320];
      const sr=(typeof sampleRate!=='undefined'?sampleRate:48000);
      let m=0, nextAt=0; const e0=B.eaten;
      for(let s=0;s<n;s++){
        while(m<k && s>=nextAt){ const fired=stepMs(B); m++; nextAt=Math.floor(m*n/k);
          let ml=0,mr=0,inp=0; for(let j=0;j<G;j++){ml+=fired[NI+j];mr+=fired[NI+G+j];} for(let i=0;i<NI;i++)inp+=fired[i];
          this.env[0]+=0.35*ml; this.env[1]+=0.35*mr; this.env[2]+=0.04*inp; }
        if(B.eaten>e0 && this.chime<0.01) this.chime=1;
        let L=0,R=0;
        for(let c=0;c<3;c++){ this.ph[c]+=f[c]/sr; if(this.ph[c]>1)this.ph[c]-=1; const v=this.env[c]*Math.sin(6.2831853*this.ph[c]); this.env[c]*=0.9975;
          if(c===0)L+=v; else if(c===1)R+=v; else {L+=v*0.5;R+=v*0.5;} }
        this.ph[3]+=f[3]/sr; if(this.ph[3]>1)this.ph[3]-=1; const ch=this.chime*Math.sin(6.2831853*this.ph[3]); this.chime*=0.9993; L+=ch*0.3;R+=ch*0.3;
        out[0][s]=Math.tanh(L*0.3)*this.vol; if(out[1]) out[1][s]=Math.tanh(R*0.3)*this.vol;
        if(out[2]) out[2][s]=B.eaten/1000; if(out[3]) out[3][s]=wiringFast(B);
      }
      while(m<k){stepMs(B);m++;}
      this.blocks++;
      if(this.blocks%6===0){const w=B.world; this.port.postMessage({type:'state',x:w.x,y:w.y,h:w.h,food:w.food.map(a=>[a[0],a[1]]),eaten:B.eaten,ms:B.ms,sm:B.sm.slice(),mSpk:B.mSpk.slice(),dopa:B.dopa-B.base,learn:B.learn});}
      if(this.blocks%48===0) this.port.postMessage({type:'weights',W:B.W.slice(),idx:wiring(B).index,ms:B.ms,eaten:B.eaten});
      return true;
    }
  }
  let _wc=0,_wv=0; function wiringFast(B){ if(B.ms-_wc>200||B.ms<_wc){_wc=B.ms;_wv=wiring(B).index;} return _wv; }
  registerProcessor('synapse-forager',SynapseForager);
}
