const S = window.SonarCore, W = 48, H = 32;
const params = new URLSearchParams(location.search);
let seed = +params.get('seed') || ((Math.random()*1e9)|0);
let A = S.agent(); A.eps = .2;
try { const saved = localStorage.getItem('f301-q'); if (saved) { A.Q = new Float32Array(JSON.parse(saved)); A.eps = .05; } } catch (e) {}
let w = S.world(W, H, seed), memory = new Float32Array(W*H), human = null, lastInfo = null, surprise = 0;
const cv = document.getElementById('c'), cx = cv.getContext('2d');
function fit(){ cv.width = innerWidth*devicePixelRatio; cv.height = innerHeight*devicePixelRatio; } addEventListener('resize', fit); fit();
let actx = null, soundOn = false;
function chirp(echoes, h, pan0=0, base=2400) {
  if (!soundOn || !actx) return; const t = actx.currentTime;
  echoes.forEach((d, k) => { const o = actx.createOscillator(), g = actx.createGain(), p = actx.createStereoPanner();
    o.frequency.value = base - d*90; p.pan.value = Math.max(-1, Math.min(1, pan0 + S.RAYS[k]*.45));
    const at = t + .02 + d*.018; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12/(1+d*.4), at); g.gain.exponentialRampToValueAtTime(.0001, at+.06);
    o.connect(g).connect(p).connect(actx.destination); o.start(t); o.stop(at+.08); });
}
function paintEchoes(b, echoes) { echoes.forEach((d, k) => { const [dx,dy] = S.DIRS[(b.h+S.RAYS[k]+8)%8];
  for (let i=1;i<=d+1;i++){ const x=b.x+dx*i, y=b.y+dy*i; if (x>=0&&y>=0&&x<W&&y<H) memory[y*W+x] = Math.max(memory[y*W+x], i===d+1?1:.25); } }); }
function tick() {
  const n = +document.getElementById('speed').value;
  for (let i=0;i<(n>30?n-29:1);i++) {
    lastInfo = S.step(w, A, true); paintEchoes(w.b, lastInfo.echoes);
    surprise = surprise*.85 + Math.min(1, Math.abs(lastInfo.td)/20)*.15;
  }
  if (frame % Math.max(1, Math.round(12 - n/3)) === 0) chirp(lastInfo.echoes, w.b.h);
}
let frame = 0;
function draw() {
  frame++; if (frame % Math.max(1, 7 - Math.min(6, +document.getElementById('speed').value)) === 0 || +document.getElementById('speed').value > 6) tick();
  const cw = cv.width, ch = cv.height, s = Math.min(cw/W, ch/H), ox = (cw - s*W)/2, oy = (ch - s*H)/2;
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0,0,cw,ch);
  for (let i=0;i<W*H;i++) { const m = memory[i]; if (m < .02) continue; memory[i] *= .985;
    const x = i%W, y = (i/W)|0; const isWall = w.c.g[i];
    cx.fillStyle = isWall ? `rgba(120,255,240,${m})` : `rgba(40,90,110,${m*.35})`;
    cx.fillRect(ox+x*s+s*.1, oy+y*s+s*.1, s*.8, s*.8); }
  const drawBat = (b, col) => { const px = ox+(b.x+.5)*s, py = oy+(b.y+.5)*s, a = b.h*Math.PI/4;
    cx.save(); cx.translate(px,py); cx.rotate(a); cx.fillStyle = col; cx.beginPath(); cx.moveTo(s*.6,0); cx.lineTo(-s*.4,s*.45); cx.lineTo(-s*.2,0); cx.lineTo(-s*.4,-s*.45); cx.fill(); cx.restore(); };
  drawBat(w.b, '#fff'); if (human) drawBat(human, '#fc6');
  // moth only "glows" when heard (in line of sight within range)
  const p = S.perceive(w.c, w.b, w.m); if (p.s % 9 !== 8) { cx.fillStyle = `rgba(255,220,120,${.5+.5*Math.sin(frame*.3)})`; cx.beginPath(); cx.arc(ox+(w.m.x+.5)*s, oy+(w.m.y+.5)*s, s*.3, 0, 7); cx.fill(); }
  // HUD: Q bars + physical wobble driven by learning surprise (TD error)
  const q = [0,1,2].map(a => A.Q[p.s*3+a]), mn = Math.min(...q), mx = Math.max(...q);
  q.forEach((v,a) => { const el = document.getElementById('q'+a); el.style.width = (8 + 92*(mx>mn?(v-mn)/(mx-mn):.5)) + '%'; el.style.background = v===mx ? '#7ff' : '#3a7a88'; });
  const hud = document.getElementById('mind'); hud.style.transform = `rotate(${(Math.sin(frame*.2)*surprise*4).toFixed(2)}deg) scale(${1+surprise*.03})`;
  hud.style.borderRadius = (12 + surprise*30) + 'px'; hud.style.boxShadow = `0 0 ${surprise*40}px rgba(120,255,240,${surprise})`;
  document.getElementById('stats').textContent = `cave ${seed} · steps ${w.steps} · moths ${w.caught} · bumps ${w.bumps} · surprise ${(surprise*100|0)}%` + (human ? ` · your moths ${human.caught}` : '');
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
setInterval(() => { try { localStorage.setItem('f301-q', JSON.stringify(Array.from(A.Q, v => Math.round(v*100)/100))); } catch (e) {} }, 5000);
document.getElementById('ttl').onclick = () => document.getElementById('hud').classList.toggle('fold');
const note = t => document.getElementById('note').textContent = t;
document.getElementById('snd').onclick = e => { actx = actx || new AudioContext(); actx.resume(); soundOn = !soundOn; e.target.textContent = soundOn ? 'Sound on' : 'Sound off'; };
document.getElementById('train').onclick = () => { const t0 = performance.now(); const tw = S.world(W, H, (Math.random()*1e9)|0); const e0 = A.eps; A.eps = Math.max(.05, A.eps);
  for (let i=0;i<20000;i++) S.step(tw, A, true); A.eps = Math.max(.05, e0*.7); note(`Trained 20,000 steps in a hidden cave in ${Math.round(performance.now()-t0)} ms: ${tw.caught} moth${tw.caught===1?"":"s"}. It now hunts with ${Math.round(A.eps*100)}% exploration.`); };
document.getElementById('cave').onclick = () => { seed = (Math.random()*1e9)|0; w = S.world(W, H, seed); memory.fill(0); if (human) human = { ...w.b, caught: 0 }; note('A brand-new cave. The bat has never seen it, so this tests what it really learned.'); };
document.getElementById('you').onclick = () => { human = human ? null : { ...w.b, caught: 0 }; note(human ? 'Arrow keys steer the gold bat, Space chirps. Fly blind and listen.' : ''); };
document.getElementById('share').onclick = () => { const u = location.origin + location.pathname + '?seed=' + seed; navigator.clipboard?.writeText(u); note('Link copied: ' + u); };
document.getElementById('forget').onclick = () => { A = S.agent(); A.eps = .3; localStorage.removeItem('f301-q'); note('Memory wiped. The bat starts from nothing.'); };
addEventListener('keydown', e => { if (!human) return; const k = e.key; let moved = false;
  if (k === 'ArrowLeft') { human.h = (human.h+7)%8; moved = true; } else if (k === 'ArrowRight') { human.h = (human.h+1)%8; moved = true; }
  else if (k === 'ArrowUp') { const [dx,dy] = S.DIRS[human.h]; if (!S.wall(w.c, human.x+dx, human.y+dy)) { human.x += dx; human.y += dy; } moved = true; }
  else if (k === ' ') { const e2 = S.RAYS.map(r => S.echo(w.c, human.x, human.y, (human.h+r+8)%8)); paintEchoes(human, e2); const was = soundOn; actx = actx || new AudioContext(); soundOn = true; chirp(e2, human.h, 0, 1600); soundOn = was; moved = true; }
  if (human.x === w.m.x && human.y === w.m.y) { human.caught++; note('You caught a moth by ear!'); }
  if (moved) e.preventDefault(); });
