const { chromium } = require('/workspace/void-loop/node_modules/playwright-core');
const URL='http://localhost:8717/F217-audible-synapse-forager/index.html';
(async()=>{ const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--autoplay-policy=no-user-gesture-required']});
 const ctxB=await b.newContext(); const p=await ctxB.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto(URL); const out={offline:[]};
 const sim=+(process.env.SIM||600);
 for(const seed of [1,2,3]){ for(const learn of [true,false]){ const r=await p.evaluate(([s,l,sim])=>window.__f217.offline(sim,l,s).then(r=>{window['W'+s+l]=r.W;delete r.W;return r;}),[seed,learn,sim]); out.offline.push(r); console.error(JSON.stringify(r)); } }
 // transfer: learned synapses from seed 1, frozen, in a fresh world seed 9 vs naive seed 9
 out.transfer=await p.evaluate(async()=>{const a=await window.__f217.offline(300,false,9,window.W1true);const n=await window.__f217.offline(300,false,9);delete a.W;delete n.W;return {learnedFrozen:a,naive:n};});
 // live: AudioWorklet + OPFS persistence across reload
 await p.evaluate(()=>window.__f217.forgetW()); await p.goto(URL+'?auto=1&speed=60&mute=1');
 await p.waitForFunction(()=>window.__f217.ready,null,{timeout:15000}); await p.waitForTimeout(12000);
 out.live1=await p.evaluate(async()=>{const F=window.__f217; await F.saveW(F.S.W); const back=await F.loadW(); return {mode:F.mode,brainSec:F.S.ms/1000,eaten:F.S.eaten,idx:F.S.idx,saves:F.S.saved,roundTrip:back&&back.every((v,i)=>v===F.S.W[i]),events:F.events};});
 await p.goto(URL+'?auto=1&speed=3&mute=1&learn=0'); await p.waitForFunction(()=>window.__f217.ready,null,{timeout:15000}); await p.waitForTimeout(2500);
 out.live2=await p.evaluate(()=>{const F=window.__f217;return {mode:F.mode,restoredIdx:F.S.loadedIdx,idxNow:F.S.idx,events:F.events,brainSec:F.S.ms/1000};});
 await p.screenshot({path:'/workspace/f217/shot.png'}); out.errs=errs.slice(0,5); console.log(JSON.stringify(out,null,1)); await b.close(); })();
