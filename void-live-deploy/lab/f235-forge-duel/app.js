"use strict";
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
// ---------- storage ----------
const LS={get(k,d){try{const v=localStorage.getItem("f235."+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem("f235."+k,JSON.stringify(v))}catch(e){}}};
let binder=LS.get("binder",[]);let stats=LS.get("stats",{w:0,l:0,d:0});
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
function think(s0,side,opt){opt=opt||{};const r=rngOf(opt.seed||(s0.seed+s0.turn*7919));const budget=opt.ms||140,cand=opt.cand||48,per=opt.per||24;const t0=performance.now();
  const plans=[[]];const seen=new Set([""]);for(let i=0;i<cand*4&&plans.length<cand;i++){const p=randomPlan(s0,side,r,i%3===0?1:.8);const k=p.map(x=>x.join(":")).sort().join("|");if(!seen.has(k)){seen.add(k);plans.push(p)}}
  const st=plans.map(p=>({p,w:0,n:0,lane:[0,0,0]}));let rounds=0;
  while(rounds<per&&performance.now()-t0<budget){for(const x of st){const s=clone(s0);s.log=[];determinize(s,side,r);if(leader(s.turn)===side){applyPlan(s,side,x.p);applyPlan(s,foe(side),randomPlan(s,foe(side),r,.85))}else{applyPlan(s,foe(side),randomPlan(s,foe(side),r,.85));applyPlan(s,side,x.p)}endTurn(s);const res=rollout(s,side,r);x.n++;if(res.w===side)x.w+=1;else if(res.w==="d")x.w+=.5;res.T.forEach((t,i)=>{const me=side==="v"?t.v:t.p,them=side==="v"?t.p:t.v;if(me>them)x.lane[i]++})}rounds++}
  st.sort((a,b)=>b.w/(b.n||1)-a.w/(a.n||1));const b=st[0];return {plan:b.p,win:b.w/(b.n||1),lane:b.lane.map(v=>v/(b.n||1)),sims:st.reduce((a,x)=>a+x.n,0),ms:Math.round(performance.now()-t0)}}
// ---------- UI ----------
const $=id=>document.getElementById(id);
let S=LS.get("game",null),sel=null,undoStack=[],pending=null,lastRead=null;
function save(){LS.set("game",S)}
function startGame(){S=newState(binder,(Date.now()^fnv(String(Math.random())))>>>0);undoStack=[];sel=null;lastRead=null;S.log.push("New duel. Verse shuffles its deck.");prepVerse();save();render()}
function prepVerse(){const t=think(S,"v");lastRead=t;S.read={win:t.win,lane:t.lane,sims:t.sims};if(leader(S.turn)==="v"){S.log.push("Verse leads turn "+S.turn+" and plays first.");applyPlanLogged(t.plan);S.vpending=[]}else S.vpending=t.plan}
function cardEl(c,cls){const d=document.createElement("div");d.className="card "+(c.rarity||"")+" "+(cls||"");d.style.setProperty("--c","var(--"+c.type+")");
  if(cls&&cls.includes("mini")){d.innerHTML="<b>"+(c.pow??c.power)+"</b><span></span>";d.querySelector("span").textContent=c.title;d.title=c.title+" · "+c.type+" · "+c.ability+"\n"+c.text;return d}
  d.innerHTML='<div class="cost">'+c.cost+'</div><div class="pow">'+(c.pow??c.power)+'</div><div class="t"></div><div class="ty">'+c.type+" · "+c.rarity+'</div><div class="ab">'+c.ability+'</div><div class="tx"></div>';
  d.querySelector(".t").textContent=c.title;d.querySelector(".tx").textContent=c.text;
  d.addEventListener("pointermove",e=>{const b=d.getBoundingClientRect();const x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;d.style.transform=(d.classList.contains("sel")?"translateY(-6px) ":"")+"rotateY("+x*18+"deg) rotateX("+(-y*18)+"deg)";d.style.setProperty("--a",(x*360|0)+"deg")});
  d.addEventListener("pointerleave",()=>d.style.transform="");return d}
function render(){
  $("score").textContent="Record "+stats.w+"W "+stats.l+"L "+stats.d+"D";
  if(!S){startGame();return}
  $("turnp").textContent="Turn "+S.turn+" / "+MAXT;const e=energy(S)-S.spent.p;$("energyp").textContent="Energy "+e;$("vhand").textContent="Verse holds "+S.hand.v.length+" cards";
  $("undo").disabled=!undoStack.length;$("end").disabled=S.over;
  const T=totals(S);const ln=$("lanes");ln.innerHTML="";
  S.lanes.forEach((L,i)=>{const d=document.createElement("div");d.className="lane"+(sel&&canPlay(S,"p",S.hand.p.find(c=>c.uid===sel)||{cost:99},i)?" target":"");
    const lr=S.read?S.read.lane[i]:.5;d.style.transform="rotateX("+((lr-.5)*-16).toFixed(1)+"deg)";
    d.innerHTML='<h3><span>Lane '+(i+1)+'</span><span>Verse</span></h3><div class="side vs"></div><div class="tot"><small class="note">Verse</small> '+T[i].v+' · '+T[i].p+' <small class="note">You</small></div><div class="read"><i style="width:'+(lr*100).toFixed(0)+'%"></i></div><div class="readtxt">Verse\'s read: '+(lr*100).toFixed(0)+'% it takes this lane</div><div class="side ps"></div><h3><span></span><span>You</span></h3>';
    L.v.forEach(c=>d.querySelector(".vs").appendChild(cardEl(c,"mini")));L.p.forEach(c=>d.querySelector(".ps").appendChild(cardEl(c,"mini")));
    d.onclick=()=>{if(!sel)return;const before=clone(S);if(play(S,"p",sel,i)){undoStack.push(before);sel=null;save();render()}};ln.appendChild(d)});
  const h=$("hand");h.innerHTML="";S.hand.p.forEach(c=>{const el=cardEl(c,(c.uid===sel?"sel":"")+(c.cost>e?" cant":""));el.onclick=ev=>{ev.stopPropagation();if(c.cost>e){$("hint").textContent="Not enough energy for that one this turn.";return}sel=sel===c.uid?null:c.uid;render()};h.appendChild(el)});
  $("hint").textContent=S.over?"Duel over.":sel?"Now tap a lane.":"Tap a card in your hand, then tap a lane. Verse ran "+(S.read?S.read.sims:0)+" private simulations and rates its chances at "+Math.round((S.read?S.read.win:.5)*100)+"%.";
  $("log").innerHTML="";S.log.slice(-40).reverse().forEach(t=>{const p=document.createElement("div");p.textContent=t;$("log").appendChild(p)});
  renderBinder();
}
function finishTurn(){if(S.over)return;applyPlanLogged(S.vpending||[]);undoStack=[];if(S.turn>=MAXT){S.over=true;save();render();showEnd();return}endTurn(S);S.log.push("Turn "+S.turn+" begins.");prepVerse();save();render()}
function applyPlanLogged(plan){for(const [u,l] of plan)play(S,"v",u,l)}
function showEnd(){const r=result(S);const k=r.w==="p"?"w":r.w==="v"?"l":"d";if(!S.counted){stats[k]++;S.counted=true;LS.set("stats",stats);save()}$("score").textContent="Record "+stats.w+"W "+stats.l+"L "+stats.d+"D";
  const b=$("endbox");b.innerHTML="<h2>"+(r.w==="p"?"You win!":r.w==="v"?"Verse wins.":"A draw.")+"</h2><p>Lanes: "+r.T.map((t,i)=>"Lane "+(i+1)+": you "+t.p+", Verse "+t.v).join("; ")+". Total power: you "+r.tp+", Verse "+r.tv+".</p>";
  if(r.w==="p"){b.insertAdjacentHTML("beforeend","<p>Pick one of Verse's cards to keep:</p>");const g=document.createElement("div");g.className="bar";const vs=S.lanes.flatMap(L=>L.v);const uniq=[...new Map(vs.map(c=>[c.id,c])).values()];uniq.forEach(c=>{const el=cardEl(c);el.onclick=()=>{addToBinder(c);b.querySelector(".kept").textContent="Kept "+c.title+" in your binder."};g.appendChild(el)});b.appendChild(g);b.insertAdjacentHTML("beforeend",'<p class="note kept"></p>')}
  const btn=document.createElement("button");btn.className="btn primary";btn.textContent="Play again";btn.onclick=()=>{$("endov").hidden=true;startGame()};b.appendChild(btn);$("endov").hidden=false}
function addToBinder(c){const base=forge(c.text,c.title);if(!binder.some(x=>x.id===base.id)){binder.push(base);LS.set("binder",binder)}renderBinder()}
function shareURL(c){const j=JSON.stringify({t:c.title,x:c.text});return location.href.split("#")[0]+"#c="+btoa(unescape(encodeURIComponent(j))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function renderBinder(){const g=$("binder");g.innerHTML="";$("bcount").textContent=binder.length+" cards";if(!binder.length)g.innerHTML='<p class="note">Empty. Forge a card, or win a duel and keep one of Verse\'s.</p>';
  binder.forEach((c,i)=>{const w=document.createElement("div");w.appendChild(cardEl(c,"full"));const bar=document.createElement("div");bar.className="bar";const s=document.createElement("button");s.className="btn";s.textContent="Copy link";s.onclick=()=>copy(shareURL(c),s);const del=document.createElement("button");del.className="btn";del.textContent="Remove";del.onclick=()=>{binder.splice(i,1);LS.set("binder",binder);renderBinder()};bar.append(s,del);w.appendChild(bar);g.appendChild(w)})}
function copy(t,btn){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{btn.textContent="Copied"},()=>{prompt("Copy this link:",t)})}
function preview(){const t=$("ftext").value;$("fprev").innerHTML="";if(t.trim())$("fprev").appendChild(cardEl(forge(t,$("ftitle").value),"full"))}
$("ftext").oninput=preview;$("ftitle").oninput=preview;
$("fsave").onclick=()=>{const t=$("ftext").value.trim();if(!t){$("fmsg").textContent="Paste some text first.";return}addToBinder(forge(t,$("ftitle").value));$("fmsg").textContent="Saved. It joins your next duel deck."};
$("fshare").onclick=()=>{const t=$("ftext").value.trim();if(t)copy(shareURL(forge(t,$("ftitle").value)),$("fshare"))};
$("undo").onclick=()=>{if(undoStack.length){S=undoStack.pop();save();render()}};
$("end").onclick=finishTurn;$("newg").onclick=()=>{if(S&&!S.over&&S.turn>1&&!confirm("Start over? This duel will be abandoned."))return;startGame()};
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.setAttribute("aria-pressed",x===b));document.querySelectorAll("main>section").forEach(s=>s.hidden=s.id!=="tab-"+b.dataset.tab)});
function readShare(){const m=location.hash.match(/#c=([\w-]+)/);if(!m)return;try{const j=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,"+").replace(/_/g,"/")))));const c=forge(j.x,j.t);const b=$("sharebox");b.innerHTML="<h2>Someone shared a card</h2>";b.appendChild(cardEl(c,"full"));const bar=document.createElement("div");bar.className="bar";const k=document.createElement("button");k.className="btn primary";k.textContent="Keep in binder";k.onclick=()=>{addToBinder(c);$("shareov").hidden=true;history.replaceState(null,"",location.pathname)};const n=document.createElement("button");n.className="btn";n.textContent="Close";n.onclick=()=>{$("shareov").hidden=true;history.replaceState(null,"",location.pathname)};bar.append(k,n);b.appendChild(bar);$("shareov").hidden=false}catch(e){}}
window.F235={leader,forge,newState,think,play,endTurn,result,randomPlan,applyPlan,rngOf,clone,STARTERS,VERSE,MAXT};
if(S&&S.over)S=null;
if(S&&!S.vpending)prepVerse();
window.addEventListener("hashchange",readShare);
render();readShare();
