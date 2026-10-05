/**
 * make skill ΓÇö things that materialize: playable games (Connect 4 against Void, tic-tac-toe) and 3D objects
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "play connect 4", "make me a tic tac toe game", "make a 3d torus", "a gold 3d diamond".
 * Each runs in a sandboxed frame (scripts only: no network, no cookies, no access to the page or to Void's data)
 * and arrives with a materialize animation. Everything is drawn here: no libraries, no downloads.
 * Tools: the fringe drafts wired live (tools/fringe.mjs --publish writes void-live-deploy/fringe/<family>.html);
 * "timing game", "what did void get wrong", "idea vault", "uap timeline"ΓÇª open the page in a frame.
 */
const GAMES = [
  [/^(?:connect\s*(?:4|four)|four\s+in\s+a\s+row)$/, 'connect4', 'Connect 4'],
];
const SHAPES = { cube: 'cube', box: 'cube', sphere: 'sphere', ball: 'sphere', orb: 'sphere', torus: 'torus', donut: 'torus', doughnut: 'torus', ring: 'torus',
  pyramid: 'pyramid', cone: 'cone', cylinder: 'cylinder', diamond: 'diamond', gem: 'diamond', crystal: 'diamond', octahedron: 'diamond',
  planet: 'planet', icosahedron: 'ico', dice: 'cube', die: 'cube' };
const COLORS = { red: [235, 70, 70], orange: [245, 150, 60], gold: [235, 190, 80], golden: [235, 190, 80], yellow: [240, 220, 90], green: [80, 200, 120],
  blue: [80, 150, 245], cyan: [80, 210, 230], purple: [160, 110, 240], violet: [160, 110, 240], pink: [240, 120, 190], white: [225, 228, 235],
  silver: [190, 196, 210], black: [70, 72, 80], glass: [150, 210, 255], chrome: [200, 205, 215] };

const OPEN = '(?:(?:show|open|play|start|launch|give)\\s+(?:me\\s+)?)?(?:the\\s+|my\\s+|a\\s+)?';
const TOOLS = [
  ['(?:timing game|interval timing|time sense game|test my (?:sense of time|timing))', 'interval-timing', 'Timing game', 'How well do you feel time pass? Stop the clock by feel.'],
  ['(?:miss board|what did void get wrong|what has void (?:missed|got wrong))', 'miss-board', 'Miss board', 'Asks Void could not answer yet, and what it learned from them.'],
  ['(?:quiet(?:[\\s-]signal)? filter|headline filter|news without the noise)', 'quiet-signal-filter', 'Quiet filter', 'Paste headlines; the loud ones fade, the quiet signal stays.'],
  ['(?:idea vault|incubation log|incubate an idea|seal an idea)', 'private-incubation-log', 'Idea vault', 'Seal a half-formed idea; it comes back to you later. Kept on this device only.'],
  ['(?:void(?:\'s)? (?:growth chart|progress|growth)|void progress|how is void growing)', 'correlation-view', 'Void growth', 'The benchmark score round by round, and what moved it.'],
  ['(?:hypothesis ledger|weak signal ledger|weak signals)', 'weak-signal-hypothesis-ledger', 'Hypothesis ledger', 'Weak signals held as hypotheses, each with its confidence and source.'],
  ['(?:(?:uap|ufo) (?:disclosure )?timeline|uap disclosure)', 'anomalous-event-timeline', 'UAP timeline', 'Public steps in US UAP disclosure, each with its confidence. Releases are events; the cases stay unresolved.'],
].map(([re, id, label, sub]) => [new RegExp('^' + OPEN + re + '$'), id, label, sub]);

export function makeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  for (const [re, id, label, sub] of TOOLS) if (re.test(t)) return { kind: 'tool', id, label, sub };
  let m = t.match(/^(?:let'?s\s+|can\s+we\s+|i\s+want\s+to\s+)?(?:play|make|build|create|start|open|give\s+me|code)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:game\s+of\s+|round\s+of\s+)?(.+?)(?:\s+game|\s+app)?$/);
  if (m) for (const [re, id, label] of GAMES) if (re.test(m[1])) return { kind: 'game', id, label };
  for (const [re, id, label] of GAMES) if (re.test(t)) return { kind: 'game', id, label }; // just "connect 4"
  m = t.match(/^(?:make|build|create|show|render|draw|give|materiali[sz]e|summon|spawn)?\s*(?:me\s+)?(?:a\s+|an\s+)?(?:([a-z]+)\s+)?(?:3d|3-d|three[\s-]?d)\s+(?:([a-z]+)\s+)?([a-z]+)$/);
  if (m && SHAPES[m[3]]) { const c = [m[1], m[2]].find((w) => w && COLORS[w]); return { kind: '3d', shape: SHAPES[m[3]], color: c || null, word: m[3] }; }
  return null;
}

const FRAME_CSS = ':root{color-scheme:dark}html,body{margin:0;height:100%;background:#0b0b13;color:#e6e6ea;font:14px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;user-select:none}'
  + '.bar{display:flex;justify-content:space-between;align-items:center;padding:6px 4px;color:#9a9aa6}'
  + 'button{font:inherit;color:#e6e6ea;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:4px 12px;cursor:pointer}';

function connect4Doc() {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + FRAME_CSS
    + 'canvas{display:block;margin:0 auto;max-width:100%;height:auto;touch-action:manipulation;cursor:pointer}</style></head><body>'
    + '<div class="bar"><span id="s">your move ┬╖ you are red</span><button id="r">new game</button></div><canvas id="c" width="490" height="470"></canvas><script>'
    + `(function(){var C=7,R=6,S=70,c=document.getElementById('c'),x=c.getContext('2d'),st=document.getElementById('s');
var b,turn,over,drops,hover=-1;
function reset(){b=[];for(var i=0;i<R;i++)b.push([0,0,0,0,0,0,0]);turn=1;over=false;drops=[];st.textContent='your move ┬╖ you are red';}
function row(bb,col){for(var r=R-1;r>=0;r--)if(!bb[r][col])return r;return -1}
function win(bb,p){var d=[[0,1],[1,0],[1,1],[1,-1]];for(var r=0;r<R;r++)for(var k=0;k<C;k++)if(bb[r][k]===p)for(var j=0;j<4;j++){var ok=1;for(var n=1;n<4;n++){var rr=r+d[j][0]*n,kk=k+d[j][1]*n;if(rr<0||rr>=R||kk<0||kk>=C||bb[rr][kk]!==p){ok=0;break}}if(ok)return [[r,k],[r+d[j][0]*3,k+d[j][1]*3]]}return null}
function full(bb){for(var k=0;k<C;k++)if(!bb[0][k])return false;return true}
function score(bb){var s=0,d=[[0,1],[1,0],[1,1],[1,-1]];for(var r=0;r<R;r++)s+=(bb[r][3]===2?3:bb[r][3]===1?-3:0);
for(var r=0;r<R;r++)for(var k=0;k<C;k++)for(var j=0;j<4;j++){var a=0,h=0,e=0;for(var n=0;n<4;n++){var rr=r+d[j][0]*n,kk=k+d[j][1]*n;if(rr<0||rr>=R||kk<0||kk>=C){a=-9;break}var v=bb[rr][kk];if(v===2)a++;else if(v===1)h++;else e++}
if(a<0)continue;if(a===4)s+=1000;else if(a===3&&e===1)s+=6;else if(a===2&&e===2)s+=2;if(h===3&&e===1)s-=8;else if(h===2&&e===2)s-=2}return s}
var ORDER=[3,2,4,1,5,0,6];
function mm(bb,depth,al,be,maxi){if(win(bb,2))return 100000+depth;if(win(bb,1))return -100000-depth;if(depth===0||full(bb))return score(bb);
if(maxi){var v=-1e9;for(var i=0;i<7;i++){var k=ORDER[i],r=row(bb,k);if(r<0)continue;bb[r][k]=2;v=Math.max(v,mm(bb,depth-1,al,be,false));bb[r][k]=0;al=Math.max(al,v);if(al>=be)break}return v}
var v=1e9;for(var i=0;i<7;i++){var k=ORDER[i],r=row(bb,k);if(r<0)continue;bb[r][k]=1;v=Math.min(v,mm(bb,depth-1,al,be,true));bb[r][k]=0;be=Math.min(be,v);if(al>=be)break}return v}
function best(){var bk=-1,bv=-1e9;for(var i=0;i<7;i++){var k=ORDER[i],r=row(b,k);if(r<0)continue;b[r][k]=2;var v=mm(b,5,-1e9,1e9,false);b[r][k]=0;if(v>bv){bv=v;bk=k}}return bk}
function play(k,p){var r=row(b,k);if(r<0)return false;b[r][k]=p;drops.push({r:r,k:k,p:p,y:-S/2,t:performance.now()});return true}
function after(p){var w=win(b,p);if(w){over=w;st.textContent=p===1?'you win! four in a row':'Void wins this one';return true}if(full(b)){over=true;st.textContent='a draw';return true}return false}
c.addEventListener('pointermove',function(e){var q=c.getBoundingClientRect();hover=Math.floor((e.clientX-q.left)/q.width*C)});
c.addEventListener('pointerleave',function(){hover=-1});
c.addEventListener('click',function(e){if(over||turn!==1)return;var q=c.getBoundingClientRect(),k=Math.floor((e.clientX-q.left)/q.width*C);if(!play(k,1))return;if(after(1))return;turn=2;st.textContent='Void is thinkingΓÇª';
setTimeout(function(){var k2=best();if(k2>=0)play(k2,2);if(!after(2)){turn=1;st.textContent='your move'}},420)});
document.getElementById('r').onclick=reset;
function disc(cx,cy,p,a){var g=x.createRadialGradient(cx-10,cy-12,4,cx,cy,30);if(p===1){g.addColorStop(0,'#ff8a8a');g.addColorStop(1,'#c41f2e')}else{g.addColorStop(0,'#fff1a0');g.addColorStop(1,'#d4a017')}x.globalAlpha=a;x.fillStyle=g;x.beginPath();x.arc(cx,cy,28,0,7);x.fill();x.globalAlpha=1}
function draw(now){x.clearRect(0,0,c.width,c.height);var top=20;
if(hover>=0&&!over&&turn===1&&row(b,hover)>=0)disc(hover*S+S/2,top-2,1,.35);
x.fillStyle='#1d3fa8';x.beginPath();x.roundRect?x.roundRect(0,top+16,C*S,R*S,16):x.rect(0,top+16,C*S,R*S);x.fill();
for(var r=0;r<R;r++)for(var k=0;k<C;k++){var cx=k*S+S/2,cy=top+16+r*S+S/2,p=b[r][k],d=null;for(var i=0;i<drops.length;i++)if(drops[i].r===r&&drops[i].k===k)d=drops[i];
x.fillStyle='#050510';x.beginPath();x.arc(cx,cy,28,0,7);x.fill();
if(p){if(d){var t=Math.min(1,(now-d.t)/420),e=1-Math.pow(1-t,3),yy=-20+(cy+20)*e;if(t<1){x.save();x.beginPath();x.arc(cx,cy,28,0,7);x.restore();disc(cx,yy,p,1)}else disc(cx,cy,p,1)}else disc(cx,cy,p,1)}}
if(over&&over.length){var a=over[0],z=over[1];x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=6;x.lineCap='round';x.beginPath();x.moveTo(a[1]*S+S/2,top+16+a[0]*S+S/2);x.lineTo(z[1]*S+S/2,top+16+z[0]*S+S/2);x.stroke()}
requestAnimationFrame(draw)}
reset();requestAnimationFrame(draw);window.__c4={get board(){return b},get over(){return over},play:function(k){c.dispatchEvent(new MouseEvent('click',{clientX:c.getBoundingClientRect().left+(k+.5)*c.getBoundingClientRect().width/C}))}};})();`
    + '</script></body></html>';
}

function tictactoeDoc() {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + FRAME_CSS
    + '.g{display:grid;grid-template-columns:repeat(3,96px);gap:8px;justify-content:center;margin-top:10px}'
    + '.g button{height:96px;font-size:44px;border-radius:14px;padding:0;transition:transform .15s}.g button:hover{transform:scale(1.04)}'
    + '.x{color:#ff7a8a}.o{color:#7cd4ff}</style></head><body>'
    + '<div class="bar"><span id="s">your move ┬╖ you are X</span><button id="r">new game</button></div><div class="g" id="g"></div><script>'
    + `(function(){var b,over,g=document.getElementById('g'),st=document.getElementById('s'),L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function w(bb){for(var i=0;i<8;i++){var l=L[i];if(bb[l[0]]&&bb[l[0]]===bb[l[1]]&&bb[l[0]]===bb[l[2]])return bb[l[0]]}return bb.every(Boolean)?'d':null}
function mm(bb,p){var r=w(bb);if(r==='O')return 1;if(r==='X')return -1;if(r==='d')return 0;var best=p==='O'?-2:2;for(var i=0;i<9;i++)if(!bb[i]){bb[i]=p;var v=mm(bb,p==='O'?'X':'O');bb[i]=null;best=p==='O'?Math.max(best,v):Math.min(best,v)}return best}
function ai(){var bi=-1,bv=-2;for(var i=0;i<9;i++)if(!b[i]){b[i]='O';var v=mm(b,'X');b[i]=null;if(v>bv){bv=v;bi=i}}return bi}
function end(){var r=w(b);if(!r)return false;over=true;st.textContent=r==='d'?'a draw (Void never loses)':r==='X'?'you win!':'Void wins';return true}
function render(){g.innerHTML='';b.forEach(function(v,i){var e=document.createElement('button');e.textContent=v||'';if(v)e.className=v.toLowerCase();e.setAttribute('aria-label','square '+(i+1)+(v?' '+v:''));e.onclick=function(){if(over||b[i])return;b[i]='X';render();if(end())return;st.textContent='Void is thinkingΓÇª';setTimeout(function(){b[ai()]='O';render();if(!end())st.textContent='your move'},300)};g.appendChild(e)})}
function reset(){b=[null,null,null,null,null,null,null,null,null];over=false;st.textContent='your move ┬╖ you are X';render()}
document.getElementById('r').onclick=reset;reset();})();`
    + '</script></body></html>';
}

function shapeDoc(shape, rgb) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + FRAME_CSS + 'canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}</style></head><body>'
    + '<canvas id="c"></canvas><script>'
    + `(function(){var SH=${JSON.stringify(shape)},COL=${JSON.stringify(rgb)},c=document.getElementById('c'),x=c.getContext('2d'),W,H,dpr=Math.min(devicePixelRatio||1,2);
function size(){W=c.clientWidth;H=c.clientHeight;c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)}size();addEventListener('resize',size);
var V=[],F=[];function v(a,b,cc){V.push([a,b,cc]);return V.length-1}function f(a,b,cc,col){F.push({i:[a,b,cc],col:col})}
function quad(a,b,cc,d,col){f(a,b,cc,col);f(a,cc,d,col)}
function sphere(rad,sub,col,off){var t=(1+Math.sqrt(5))/2,base=V.length,P=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]],T=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
var pts=P.map(function(p){var l=Math.hypot(p[0],p[1],p[2]);return [p[0]/l,p[1]/l,p[2]/l]});for(var s=0;s<sub;s++){var nt=[],cache={};function mid(a,b){var k=a<b?a+'_'+b:b+'_'+a;if(cache[k]!=null)return cache[k];var p=pts[a],q=pts[b],m=[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2],l=Math.hypot(m[0],m[1],m[2]);pts.push([m[0]/l,m[1]/l,m[2]/l]);return cache[k]=pts.length-1}
T.forEach(function(tr){var a=mid(tr[0],tr[1]),b=mid(tr[1],tr[2]),cc=mid(tr[2],tr[0]);nt.push([tr[0],a,cc],[tr[1],b,a],[tr[2],cc,b],[a,b,cc])});T=nt}
pts.forEach(function(p){v(p[0]*rad+(off?off[0]:0),p[1]*rad+(off?off[1]:0),p[2]*rad+(off?off[2]:0))});T.forEach(function(tr){f(base+tr[0],base+tr[1],base+tr[2],col)})}
function torus(R,r,a,bn,col,tilt){var base=V.length;for(var i=0;i<a;i++)for(var j=0;j<bn;j++){var u=i/a*Math.PI*2,w=j/bn*Math.PI*2,px=(R+r*Math.cos(w))*Math.cos(u),py=r*Math.sin(w),pz=(R+r*Math.cos(w))*Math.sin(u);if(tilt){var cy=Math.cos(tilt),sy=Math.sin(tilt),ny=py*cy-pz*sy,nz=py*sy+pz*cy;py=ny;pz=nz}v(px,py,pz)}
for(var i=0;i<a;i++)for(var j=0;j<bn;j++){var i2=(i+1)%a,j2=(j+1)%bn;quad(base+i*bn+j,base+i2*bn+j,base+i2*bn+j2,base+i*bn+j2,col)}}
function lathe(prof,n,col){var base=V.length;prof.forEach(function(p){for(var i=0;i<n;i++){var u=i/n*Math.PI*2;v(p[0]*Math.cos(u),p[1],p[0]*Math.sin(u))}});for(var k=0;k<prof.length-1;k++)for(var i=0;i<n;i++){var i2=(i+1)%n,a=base+k*n+i,b2=base+k*n+i2,cc=base+(k+1)*n+i2,d=base+(k+1)*n+i;quad(a,d,cc,b2,col)}}
var C2=COL.map(function(z){return Math.round(z*.55)});
if(SH==='cube'){var s=1;[[-s,-s,-s],[s,-s,-s],[s,s,-s],[-s,s,-s],[-s,-s,s],[s,-s,s],[s,s,s],[-s,s,s]].forEach(function(p){v(p[0],p[1],p[2])});[[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]].forEach(function(q){quad(q[0],q[1],q[2],q[3],COL)})}
else if(SH==='sphere')sphere(1.3,3,COL);else if(SH==='ico')sphere(1.3,0,COL);
else if(SH==='torus')torus(1.05,.42,40,18,COL,.5);
else if(SH==='pyramid')lathe([[0,1.3],[1.3,-1],[0,-1]],4,COL);else if(SH==='cone')lathe([[0,1.4],[1.1,-1],[0,-1]],36,COL);
else if(SH==='cylinder')lathe([[0,1.1],[1,1.1],[1,-1.1],[0,-1.1]],36,COL);else if(SH==='diamond')lathe([[0,1.5],[.95,.25],[0,-1.5]],8,COL);
else if(SH==='planet'){sphere(1,3,COL);torus(1.75,.07,64,6,C2,.42)}
var cx=0,cy=0,rx=-.35,ry=.6,drag=null,t0=performance.now(),seeds=F.map(function(){return [Math.random()*2-1,Math.random()*2-1,Math.random()*2-1,Math.random()]});
c.addEventListener('pointerdown',function(e){drag=[e.clientX,e.clientY,rx,ry];c.setPointerCapture(e.pointerId);c.style.cursor='grabbing'});
c.addEventListener('pointermove',function(e){if(!drag)return;ry=drag[3]+(e.clientX-drag[0])*.01;rx=drag[2]+(e.clientY-drag[1])*.01});
c.addEventListener('pointerup',function(){drag=null;c.style.cursor='grab'});
var L=[-.4,.7,.6],ll=Math.hypot(L[0],L[1],L[2]);L=L.map(function(z){return z/ll});
// the loop only runs while the shape is on screen; once built it idles at 30 fps, and with reduced motion it stops and redraws only while dragged
var running=false,onScreen=true,last=0,MQ=null;try{MQ=matchMedia('(prefers-reduced-motion: reduce)');MQ.addEventListener('change',function(){if(!MQ.matches)kick()})}catch(_){}
// read live: in a sandboxed frame the setting can arrive a moment after the script starts
function RMnow(){return !!(MQ&&MQ.matches)}
function kick(){if(!running){running=true;requestAnimationFrame(frame)}}
try{new IntersectionObserver(function(es){onScreen=es[es.length-1].isIntersecting;if(onScreen)kick()}).observe(c)}catch(_){}
c.addEventListener('pointerdown',kick);c.addEventListener('pointermove',function(){if(drag)kick()});
function frame(now){if(!onScreen){running=false;return}var built=(now-t0)/1000>2.2;if(built&&!drag&&now-last<33){requestAnimationFrame(frame);return}var dt=last?Math.min(100,now-last):16.7;last=now;
if(c.clientWidth!==W||c.clientHeight!==H)size();if(!W||!H){requestAnimationFrame(frame);return}var T=(now-t0)/1000;if(!drag&&!RMnow())ry+=.006*dt/16.7;x.clearRect(0,0,W,H);var sc=Math.min(W,H)*.26,ox=W/2,oy=H/2;
var g=x.createRadialGradient(ox,oy,0,ox,oy,sc*2.4);g.addColorStop(0,'rgba('+COL.join(',')+',.18)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
var cxr=Math.cos(rx),sxr=Math.sin(rx),cyr=Math.cos(ry),syr=Math.sin(ry);
var P=V.map(function(p){var X=p[0]*cyr+p[2]*syr,Z=-p[0]*syr+p[2]*cyr,Y=p[1]*cxr-Z*sxr;Z=p[1]*sxr+Z*cxr;return [X,Y,Z]});
var list=[];for(var i=0;i<F.length;i++){var fa=F[i],a=P[fa.i[0]],b=P[fa.i[1]],cc=P[fa.i[2]],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=cc[0]-a[0],vy=cc[1]-a[1],vz=cc[2]-a[2];
var nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,nl=Math.hypot(nx,ny,nz)||1;nx/=nl;ny/=nl;nz/=nl;
var sd=seeds[i],k=Math.max(0,Math.min(1,(T-.15-sd[3]*.9)/.9)),e=1-Math.pow(1-k,3);if(k<=0)continue.
var spread=(1-e)*3.2,sx2=sd[0]*spread,sy2=sd[1]*spread,sz2=sd[2]*spread;var pts=[a,b,cc].map(function(p){var X=p[0]+sx2,Y=p[1]+sy2,Z=p[2]+sz2+4.2,s2=sc*4.2/Z;return [ox+X*s2,oy-Y*s2,Z]});
var vis=(pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-(pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]);if(vis>0&&e>.98)continue.
var lam=Math.max(0,nx*L[0]+ny*L[1]-nz*L[2]),hz=L[2]+1,hl=Math.hypot(L[0],L[1],hz),spec=Math.pow(Math.max(0,(nx*L[0]+ny*L[1]-nz*hz)/hl),24),rim=Math.pow(1-Math.abs(nz),2.5),glow=(1-e)*1.4.
var col=fa.col.map(function(z){return Math.min(255,Math.round(z*(.42+.7*lam)+spec*200+rim*70+glow*160))});list.push({p:pts,z:(pts[0][2]+pts[1][2]+pts[2][2])/3,col:col,a:Math.min(1,.15+e)})}
list.sort(function(p,q){return q.z-p.z});list.forEach(function(o){x.globalAlpha=o.a;x.fillStyle='rgb('+o.col.join(',')+')';x.strokeStyle=x.fillStyle;x.lineWidth=.6;x.beginPath();x.moveTo(o.p[0][0],o.p[1][1]);x.lineTo(o.p[1][0],o.p[1][1]);x.lineTo(o.p[2][0],o.p[2][1]);x.closePath();x.fill();x.stroke()});x.globalAlpha=1;
if(RMnow()&&built&&!drag){running=false;return}requestAnimationFrame(frame)}kick();window.__shape={faces:F.length,get running(){return running}};})();`
    + '</script></body></html>';
}

const STYLE_ID = 'void-make-style';
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID;
  s.textContent = '.vmake{position:relative;border-radius:14px;overflow:hidden;margin-top:8px;perspective:900px}'
    + '.vmake iframe{display:block;width:100%;border:0;border-radius:14px;background:radial-gradient(ellipse at center,rgba(120,140,255,.08),rgba(0,0,0,0) 70%);transform-origin:50% 60%;animation:vmat 1.1s cubic-bezier(.16,1,.3,1) both}'
    + '.vmake::after{content:"";position:absolute;left:0;right:0;height:38%;top:-40%;pointer-events:none;background:linear-gradient(180deg,rgba(124,204,255,0),rgba(124,204,255,.22),rgba(124,204,255,0));animation:vscan 1.2s ease-out .1s both}'
    + '@keyframes vmat{0%{opacity:0;transform:rotateX(58deg) translateY(40px) scale(.72);filter:blur(14px) brightness(2.2)}55%{opacity:1;filter:blur(2px) brightness(1.4)}100%{opacity:1;transform:none;filter:none}}'
    + '@keyframes vscan{0%{top:-40%}100%{top:110%}}'
    + '@media (prefers-reduced-motion:reduce){.vmake iframe,.vmake::after{animation:none}}';
  document.head.appendChild(s);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = makeOf(text);
  if (!q) return 'none';
  ensureStyle();
  let title, doc, h, sub;
  if (q.kind === 'tool') {
    const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.label) + '</h2><div class="sub">' + esc(q.sub) + '</div><div class="vmake"></div>'; });
    const f = document.createElement('iframe');
    // our own pages (same origin): the incubation log keeps its ideas in this browser's storage; links open in a new tab
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    f.setAttribute('title', q.label);
    f.style.height = '560px';
    f.src = '/fringe/' + q.id + '.html';
    const box = el.querySelector('.vmake');
    if (box) box.appendChild(f);
    return 'make';
  }
  if (q.kind === 'game') {
    title = q.label;
    if (q.id === 'connect4') { h = 520; doc = connect4Doc(); sub = 'You are red. Void looks five moves ahead.'; }
    else { h = 380; doc = tictactoeDoc(); sub = 'You are X. Void plays perfectly: a draw is a good result.'; }
  } else {
    const rgb = COLORS[q.color] || [124, 180, 255];
    const cap = (w) => w[0].toUpperCase() + w.slice(1); title = q.color ? cap(q.color) + ' ' + q.word : cap(q.word); h = 360;
    doc = shapeDoc(q.shape, rgb); sub = 'Drag to turn it.';
  }
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">' + esc(sub) + '</div><div class="vmake"></div>'; });
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('title', title);
  f.style.height = h + 'px';
  f.srcdoc = doc;
  const box = el.querySelector('.vmake');
  if (box) box.appendChild(f);
  return 'make';
}

export default {
  name: 'make',
  examples: ['play connect 4', 'make a 3d torus', 'show me a gold 3d diamond', 'connect four', 'timing game', 'uap timeline'],
  nearMisses: ['what is connect 4', 'who invented tic tac toe', 'how to make a 3d model', 'make a list', 'what is a uap', 'news filter settings'],
  match(lower, text) { return !!makeOf(text); },
  run,
};
