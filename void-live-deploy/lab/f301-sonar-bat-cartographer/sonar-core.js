// F301 Sonar Bat Cartographer core: cave gen, echo perception, tabular Q-learning.
// Runs in browser (window.SonarCore) and Node (module.exports).
(function (root) {
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]; // 8 headings
  function makeCave(W, H, seed) {
    const r = rng(seed); let g = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y*W+x] = (x===0||y===0||x===W-1||y===H-1||r()<0.45) ? 1 : 0;
    for (let it = 0; it < 5; it++) { const n = new Uint8Array(W*H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (x===0||y===0||x===W-1||y===H-1) { n[y*W+x]=1; continue; }
        let c = 0; for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) if (dx||dy) c += g[(y+dy)*W+x+dx];
        n[y*W+x] = c >= 5 ? 1 : (c <= 3 ? 0 : g[y*W+x]); }
      g = n; }
    // keep largest open region
    const lab = new Int32Array(W*H).fill(-1); let best = -1, bestN = 0, id = 0;
    for (let i = 0; i < W*H; i++) if (!g[i] && lab[i] < 0) { const st=[i]; lab[i]=id; let n=0;
      while (st.length) { const j=st.pop(); n++; const x=j%W, y=(j/W)|0;
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const k=(y+dy)*W+x+dx; if (!g[k] && lab[k]<0) { lab[k]=id; st.push(k); } } }
      if (n > bestN) { bestN=n; best=id; } id++; }
    const open = []; for (let i = 0; i < W*H; i++) { if (!g[i] && lab[i] !== best) g[i] = 1; if (!g[i]) open.push(i); }
    return { W, H, g, open, r };
  }
  const wall = (c, x, y) => x<0||y<0||x>=c.W||y>=c.H||c.g[y*c.W+x]===1;
  // Echo ray: cells travelled before hitting a wall (max 12)
  function echo(c, x, y, h) { const [dx,dy]=DIRS[h]; let d=0; while (d<12) { const nx=x+dx*(d+1), ny=y+dy*(d+1); if (wall(c,nx,ny)) break; d++; } return d; }
  const RAYS = [-2,-1,0,1,2]; // relative headings (x45deg)
  const qd = d => d < 1 ? 0 : d < 3 ? 1 : 2;
  function los(c, x0, y0, x1, y1) { const n = Math.max(Math.abs(x1-x0), Math.abs(y1-y0)); for (let i=1;i<n;i++){ const x=Math.round(x0+(x1-x0)*i/n), y=Math.round(y0+(y1-y0)*i/n); if (wall(c,x,y)) return false; } return true; }
  function mothBin(c, b, m) { const dx=m.x-b.x, dy=m.y-b.y, dist=Math.hypot(dx,dy); if (dist>10 || !los(c,b.x,b.y,m.x,m.y)) return 8;
    const a = Math.round(Math.atan2(dy,dx)/(Math.PI/4)); return ((a - b.h) % 8 + 16) % 8; }
  function perceive(c, b, m) { const e = RAYS.map(k => echo(c, b.x, b.y, (b.h+k+8)%8)); let s = 0; for (const d of e) s = s*3 + qd(d); return { s: s*9 + mothBin(c,b,m), echoes: e }; }
  const NS = 243*9, NA = 3;
  function agent(opts={}) { return { Q: opts.Q || new Float32Array(NS*NA), alpha: .2, gamma: .95, eps: opts.eps ?? .3 }; }
  function act(A, s, r) { if (r() < A.eps) return (r()*NA)|0; let b=0; for (let a=1;a<NA;a++) if (A.Q[s*NA+a] > A.Q[s*NA+b]) b=a; return b; }
  function placeMoth(c, b) { for (let t=0;t<500;t++){ const i=c.open[(c.r()*c.open.length)|0], x=i%c.W, y=(i/c.W)|0; if (Math.hypot(x-b.x,y-b.y)>6) return {x,y}; } const i=c.open[0]; return {x:i%c.W,y:(i/c.W)|0}; }
  function world(W, H, seed) { const c = makeCave(W, H, seed); const i = c.open[(c.r()*c.open.length)|0]; const b = { x:i%c.W, y:(i/c.W)|0, h:0 }; return { c, b, m: placeMoth(c,b), caught: 0, bumps: 0, steps: 0 }; }
  // One step. learn=false for pure evaluation / random baseline. Returns info for UI.
  function step(w, A, learn=true, policy) {
    const { c, b } = w; const p = perceive(c, b, w.m); const a = policy ? policy(p) : act(A, p.s, c.r);
    let rew = -1, hit = false, caught = false;
    if (a === 1) b.h = (b.h+7)%8; else if (a === 2) b.h = (b.h+1)%8;
    else { const [dx,dy]=DIRS[b.h]; if (wall(c,b.x+dx,b.y+dy)) { rew = -5; hit = true; w.bumps++; } else { b.x+=dx; b.y+=dy; } }
    if (b.x===w.m.x && b.y===w.m.y) { rew = 50; caught = true; w.caught++; w.m = placeMoth(c,b); }
    const p2 = perceive(c, b, w.m); let td = 0;
    if (learn && A) { let mx=-1e9; for (let k=0;k<NA;k++) mx=Math.max(mx,A.Q[p2.s*NA+k]); const i=p.s*NA+a; td = rew + A.gamma*mx - A.Q[i]; A.Q[i] += A.alpha*td; }
    w.steps++; return { a, rew, hit, caught, td, echoes: p.echoes, s: p.s };
  }
  const api = { rng, DIRS, RAYS, makeCave, echo, perceive, agent, act, world, step, wall, NS, NA };
  if (typeof module !== 'undefined') module.exports = api; else root.SonarCore = api;
})(this);
