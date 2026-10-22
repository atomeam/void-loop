const {makeBrain,stepMs,wiring}=require('./brain-worklet.js');
const learn=process.argv[2]!=='off', T=+(process.argv[3]||600), seed=+(process.argv[4]||7);
const B=makeBrain({seed,learn}); const per=[];
for(let s=0;s<T;s++){const e0=B.eaten;for(let m=0;m<1000;m++)stepMs(B);per.push(B.eaten-e0);}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length; const k=Math.floor(T/5);
console.log(JSON.stringify({learn,seed,first:avg(per.slice(0,k)).toFixed(3),last:avg(per.slice(-k)).toFixed(3),w:wiring(B)}));
