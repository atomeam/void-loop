// Forge Duel (F-235, drafts/F235-forge-duel in the a-to-mind.com repo, folded into Verse Rally on 2026-10-22; owner: "combine ... without removing
// anything from either"). Pure engine, as the draft built it: paste any text and it is forged into a card (deterministic, no model); a six-turn,
// three-lane duel, win two lanes; Verse plans by playing out quick practice games from a fair view (it reshuffles your unseen cards first).
// Rules: energy each turn is the turn number plus one; four cards a side per lane; odd turns you lead, even turns Verse's plays land first.
// Abilities: Steady (Fact, can't be weakened), Spark (Idea, +1 to your other cards in the lane), Rally (Feeling, +2 if you already hold a card
// there), Strike (Action, -2 to the strongest non-Fact enemy card in the lane), Surge (Wonder, +3 on the last turn). UI: skills/rally.js.
/* eslint-disable */
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
// ---------- deterministic forge ----------
function fnv(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h}
const LEX={
  Fact:/^(is|are|was|were|percent|year|years|km|miles|million|billion|made|contains|measured|equals|means|called)$/,
  Idea:/^(could|might|maybe|imagine|idea|why|how|what|if|perhaps|suppose|wonder|invent|new)$/,
  Feeling:/^(love|happy|sad|fear|hope|joy|angry|miss|feel|feels|heart|glad|sorry|lonely|proud|excited|calm|grateful|afraid|care)$/,
  Action:/^(do|build|make|run|go|start|try|fix|get|play|cook|write|move|open|send|grab|push|pull|lift|plant|ship|learn)$/,
  Wonder:/^(star|stars|space|void|dream|universe|sky|ocean|infinite|light|time|moon|planet|galaxy|cosmic|deep|dark|forever)$/
};
const ABIL={Fact:"Steady: can't be weakened.",Idea:"Spark: your other cards here get +1.",Feeling:"Rally: +2 if you already have a card here.",Action:"Strike: strongest enemy card here loses 2.",Wonder:"Surge: +3 if played on the last turn."};
const TYPES=Object.keys(LEX);
function forge(text,title){
  text=String(text||"").trim().slice(0,1200);
  const words=(text.toLowerCase().match(/[a-z0-9']+/g)||[]);
  const h=fnv(text);
  const sc={Fact:0,Idea:0,Feeling:0,Action:0,Wonder:0};
  for(const w of words){if(/\d/.test(w))sc.Fact+=2;for(const t of TYPES)if(LEX[t].test(w))sc[t]+=1}
  sc.Idea+=2*(text.split("?").length-1);sc.Feeling+=(text.split("!").length-1);
  if(words[0]&&LEX.Action.test(words[0]))sc.Action+=2;
  let type=TYPES[h%5],best=0;for(const t of TYPES)if(sc[t]>best){best=sc[t];type=t}
  const n=Math.max(1,words.length);
  const cost=Math.min(6,Math.max(1,Math.round((n-2)/3.5)));
  const uniq=new Set(words).size/n;
  const longest=words.reduce((m,w)=>Math.max(m,w.length),0);
  const r=uniq*.35+Math.min(1,longest/14)*.25+Math.min(1,n/40)*.3+((h>>>8)%100)/1000;
  const rarity=r<.62?"Common":r<.74?"Uncommon":r<.84?"Rare":"Legendary";
  let power=cost*2+((h>>>16)%3)-1+(type==="Fact"||type==="Feeling"?0:-1)+(rarity==="Rare"?1:rarity==="Legendary"?2:0);
  power=Math.max(1,power);
  const t=(title&&title.trim())||words.slice(0,5).join(" ").replace(/^./,c=>c.toUpperCase())||"Blank";
  return {id:(h>>>0).toString(36),title:t.slice(0,60),text,type,cost,power,rarity,ability:ABIL[type]};
}
// ---------- pools ----------
const STARTERS=["Water boils at 100 degrees Celsius at sea level.","What if every chair in the room could talk back?","I miss the smell of rain on hot pavement.","Grab a pencil and sketch the first thing you see.","The night sky over the desert is endless and deep.","A year on Mars lasts about 687 Earth days.","Why do we remember songs better than speeches?","I feel proud when a hard thing finally clicks.","Start the timer, run two laps, then stretch.","Light from distant stars left them before you were born.","Honey found in old tombs was still edible after 3000 years.","Could a city be built entirely out of gardens?","Some days the heart just needs a quiet window.","Fix the squeaky hinge with one drop of oil.","Somewhere a planet has two suns setting at once.","An octopus has three hearts and blue blood.","How might a song look if you could hold it?","Thank you for staying when it was hard.","Plant the seed, water it, and wait a week.","The ocean holds more history than every library."];
const VERSE=["Verse remembers 12 things you said and forgets the rest on purpose.","What would a map of your best ideas look like?","I love it when a stranger shares a card they made.","Build the game first, then make it beautiful.","The void is not empty; it is waiting for light.","A card has 5 types and 4 rarities, measured from its words.","Imagine a deck that grows every time you ask a question.","Joy is a small thing done well, twice.","Ship one fix every day and the site gets better forever.","Every star you see is a story still in transit.","Sound travels about 343 meters per second in air.","Why not let the game teach you while you play?","Being curious together feels like home.","Open the binder, pick three, and play.","Deep time makes every mountain a wave.","Could two lanes be a conversation instead of a fight?"];
// ---------- rng ----------
function rngOf(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
// ---------- engine (pure, cloneable) ----------
const MAXT=6,CAP=4;const energy=s=>s.turn+1;let uidc=0;
function inst(c){return {...c,uid:"u"+(uidc++),pow:c.power}}
function buildDeck(cards,fill,r){const d=cards.slice(0,12).map(inst);const pool=shuffle(fill.slice(),r);let i=0;while(d.length<12)d.push(inst(forge(pool[i++%pool.length])));return shuffle(d,r)}
function newState(pCards,seed){const r=rngOf(seed||Date.now());const s={turn:1,lanes:[0,1,2].map(()=>({p:[],v:[]})),deck:{p:buildDeck(pCards,STARTERS.concat(VERSE),r),v:buildDeck([],VERSE.concat(STARTERS),r)},hand:{p:[],v:[]},log:[],over:false,seed:seed||Date.now()};for(let i=0;i<3;i++){draw(s,"p");draw(s,"v")}draw(s,"p");draw(s,"v");s.spent={p:0,v:0};return s}
function draw(s,side){if(s.deck[side].length&&s.hand[side].length<8)s.hand[side].push(s.deck[side].pop())}
const clone=s=>JSON.parse(JSON.stringify(s));
const foe=x=>x==="p"?"v":"p";
const leader=t=>t%2?"p":"v"; // odd turns you resolve first, even turns Verse leads
function canPlay(s,side,c,l){return !s.over&&c.cost<=energy(s)-s.spent[side]&&s.lanes[l][side].length<CAP}
function play(s,side,uid,l,quiet){
  const h=s.hand[side],i=h.findIndex(c=>c.uid===uid);if(i<0)return false;const c=h[i];if(!canPlay(s,side,c,l))return false;
  h.splice(i,1);s.spent[side]+=c.cost;const lane=s.lanes[l];const mine=lane[side],theirs=lane[foe(side)];let note="";
  if(c.type==="Idea"&&mine.length){mine.forEach(x=>x.pow+=1);note=" (+1 to "+mine.length+")"}
  if(c.type==="Feeling"&&mine.length){c.pow+=2;note=" (rally +2)"}
  if(c.type==="Wonder"&&s.turn===MAXT){c.pow+=3;note=" (surge +3)"}
  if(c.type==="Action"){const t=theirs.filter(x=>x.type!=="Fact").sort((a,b)=>b.pow-a.pow)[0];if(t){t.pow=Math.max(0,t.pow-2);note=" (strikes "+t.title+")"}}
  mine.push(c);if(!quiet)s.log.push((side==="p"?"You":"Verse")+" played "+c.title+" ["+c.pow+"] in lane "+(l+1)+note);return true}
function totals(s){return s.lanes.map(L=>({p:L.p.reduce((a,c)=>a+c.pow,0),v:L.v.reduce((a,c)=>a+c.pow,0)}))}
function result(s){const T=totals(s);let p=0,v=0,tp=0,tv=0;T.forEach(t=>{tp+=t.p;tv+=t.v;if(t.p>t.v)p++;else if(t.v>t.p)v++});const w=p>v?"p":v>p?"v":tp>tv?"p":tv>tp?"v":"d";return {w,p,v,T,tp,tv}}
function endTurn(s){if(s.turn>=MAXT){s.over=true;return}s.turn++;s.spent={p:0,v:0};draw(s,"p");draw(s,"v")}
// ---------- Verse's mind: determinized Monte-Carlo rollouts ----------
function randomPlan(s,side,r,greed){const plan=[];let e=energy(s)-s.spent[side];const cnt=[0,1,2].map(l=>s.lanes[l][side].length);const h=shuffle(s.hand[side].slice(),r);for(const c of h){if(c.cost>e||r()>greed)continue;const ls=[0,1,2].filter(l=>cnt[l]<CAP);if(!ls.length)break;const l=ls[Math.floor(r()*ls.length)];plan.push([c.uid,l]);cnt[l]++;e-=c.cost}return plan}
function applyPlan(s,side,plan){for(const [u,l] of plan)play(s,side,u,l,true)}
function determinize(s,side,r){const o=foe(side);const hid=shuffle(s.hand[o].concat(s.deck[o]),r);const n=s.hand[o].length;s.hand[o]=hid.slice(0,n);s.deck[o]=hid.slice(n)}
function rollout(s,side,r){while(!s.over){const L=leader(s.turn),F=foe(L);applyPlan(s,L,randomPlan(s,L,r,.85));applyPlan(s,F,randomPlan(s,F,r,.85));endTurn(s)}return result(s)}
function think(s0,side,opt){opt=opt||{};const r=rngOf(opt.seed||(s0.seed+s0.turn*7919));const budget=opt.ms||140,cand=opt.cand||48,per=opt.per||24;const t0=now();
  const plans=[[]];const seen=new Set([""]);for(let i=0;i<cand*4&&plans.length<cand;i++){const p=randomPlan(s0,side,r,i%3===0?1:.8);const k=p.map(x=>x.join(":")).sort().join("|");if(!seen.has(k)){seen.add(k);plans.push(p)}}
  const st=plans.map(p=>({p,w:0,n:0,lane:[0,0,0]}));let rounds=0;
  while(rounds<per&&now()-t0<budget){for(const x of st){const s=clone(s0);s.log=[];determinize(s,side,r);if(leader(s.turn)===side){applyPlan(s,side,x.p);applyPlan(s,foe(side),randomPlan(s,foe(side),r,.85))}else{applyPlan(s,foe(side),randomPlan(s,foe(side),r,.85));applyPlan(s,side,x.p)}endTurn(s);const res=rollout(s,side,r);x.n++;if(res.w===side)x.w+=1;else if(res.w==="d")x.w+=.5;res.T.forEach((t,i)=>{const me=side==="v"?t.v:t.p,them=side==="v"?t.p:t.v;if(me>them)x.lane[i]++})}rounds++}
  st.sort((a,b)=>b.w/(b.n||1)-a.w/(a.n||1));const b=st[0];return {plan:b.p,win:b.w/(b.n||1),lane:b.lane.map(v=>v/(b.n||1)),sims:st.reduce((a,x)=>a+x.n,0),ms:Math.round(now()-t0)}}

export { fnv, forge, LEX, ABIL, TYPES, STARTERS, VERSE, rngOf, shuffle, MAXT, CAP, energy, newState, draw, canPlay, play, totals, result, endTurn, randomPlan, applyPlan, determinize, rollout, think, clone, foe, leader };
