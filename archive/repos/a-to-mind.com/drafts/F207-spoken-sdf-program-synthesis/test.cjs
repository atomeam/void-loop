const C = require('./core.js'); const assert = require('assert');
// interpreter sanity
assert(Math.abs(C.ev({t:'sph',r:1},2,0,0)-1)<1e-9);
assert(C.ev({t:'tor',R:1,r:0.2},1,0,0) < 0);
assert(C.ev({t:'rep',n:4,R:1,c:{t:'sph',r:0.2}},0,0,1) < 0, 'polar repeat places copy on +z');
// compiler output shape
const g = C.compile({t:'su',k:0.2,a:{t:'tw',k:1,c:{t:'box',s:[.3,1,.3]}},b:{t:'rep',n:5,R:1,c:{t:'sph',r:.2}}});
assert(/^float map\(vec3 p\)\{/.test(g) && /smin\(/.test(g) && /tw\(p,/.test(g) && /prep\(p,5\.000,1\.000\)/.test(g));
// intent parsing
const it = C.parseIntent('a tall twisted spiral tower with a hollow arch');
assert(it.target[0] > .9 && it.target[2] > .9 && it.target[5] === 1, JSON.stringify(it));
// features discriminate
const tower = C.features({t:'cyl',r:.25,h:1.6}).v, disc = C.features({t:'cyl',r:1.4,h:.15}).v;
assert(tower[0] > disc[0], 'tall feature');
const crown = C.features({t:'rep',n:6,R:1.1,c:{t:'sph',r:.25}}).v; assert(crown[3] > .5 && crown[2] > .5, 'crown has parts and is hollow '+crown);
// search improves toward intent
const S = new C.Searcher(C.parseIntent('a crown of many tiny pieces, hollow')); const s0 = S.beam[0].s; let r;
for (let i=0;i<60;i++) r = S.step(32);
assert(r.top[0].s >= s0, 'beam never regresses'); console.log('gen', r.gen, 'best', r.top[0].s.toFixed(3), 'from', s0.toFixed(3), r.top[0].label, r.top[0].v.map(x=>x.toFixed(2)).join(' '));
for (const t of r.top) { assert(C.compile(t.p).includes('return')); }
console.log('ok');
