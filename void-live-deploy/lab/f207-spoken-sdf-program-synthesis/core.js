// F-207 core: SDF scene DSL, interpreter, GLSL compiler, intent parser, feature scorer, beam search.
// Pure JS, shared by the page, the Worker (importScripts) and node tests.
(function (root) {
  'use strict';
  var LEAVES = ['sph', 'box', 'tor', 'cyl'];
  var COMBS = ['u', 'su', 'sub', 'int'];
  var WRAPS = ['tr', 'tw', 'rep'];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r2(x) { return Math.round(x * 100) / 100; }

  function leaf(t) {
    t = t || pick(LEAVES);
    if (t === 'sph') return { t: t, r: r2(rnd(0.25, 0.9)) };
    if (t === 'box') return { t: t, s: [r2(rnd(0.15, 0.8)), r2(rnd(0.15, 1.2)), r2(rnd(0.15, 0.8))] };
    if (t === 'tor') return { t: t, R: r2(rnd(0.4, 1.0)), r: r2(rnd(0.08, 0.3)) };
    return { t: 'cyl', r: r2(rnd(0.1, 0.6)), h: r2(rnd(0.2, 1.4)) };
  }
  function clone(n) { return JSON.parse(JSON.stringify(n)); }
  function size(n) { return 1 + (n.a ? size(n.a) : 0) + (n.b ? size(n.b) : 0) + (n.c ? size(n.c) : 0); }
  function depth(n) { return 1 + Math.max(n.a ? depth(n.a) : 0, n.b ? depth(n.b) : 0, n.c ? depth(n.c) : 0); }
  function nodes(n, out) { out = out || []; out.push(n); if (n.a) nodes(n.a, out); if (n.b) nodes(n.b, out); if (n.c) nodes(n.c, out); return out; }

  // ---- interpreter (CPU) ----
  function len3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }
  function smin(a, b, k) { var h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }
  function ev(n, x, y, z) {
    switch (n.t) {
      case 'sph': return len3(x, y, z) - n.r;
      case 'box': {
        var qx = Math.abs(x) - n.s[0], qy = Math.abs(y) - n.s[1], qz = Math.abs(z) - n.s[2];
        return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
      }
      case 'tor': { var qx2 = Math.sqrt(x * x + z * z) - n.R; return Math.sqrt(qx2 * qx2 + y * y) - n.r; }
      case 'cyl': {
        var dx = Math.sqrt(x * x + z * z) - n.r, dy = Math.abs(y) - n.h;
        return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) * Math.max(dx, 0) + Math.max(dy, 0) * Math.max(dy, 0));
      }
      case 'u': return Math.min(ev(n.a, x, y, z), ev(n.b, x, y, z));
      case 'su': return smin(ev(n.a, x, y, z), ev(n.b, x, y, z), n.k);
      case 'sub': return Math.max(ev(n.a, x, y, z), -ev(n.b, x, y, z));
      case 'int': return Math.max(ev(n.a, x, y, z), ev(n.b, x, y, z));
      case 'tr': return ev(n.c, x - n.v[0], y - n.v[1], z - n.v[2]);
      case 'tw': { var an = n.k * y, c = Math.cos(an), s = Math.sin(an); return ev(n.c, c * x - s * z, y, s * x + c * z) * 0.7; }
      case 'rep': {
        var sec = 6.283185307 / n.n, a = Math.atan2(z, x), r = Math.sqrt(x * x + z * z);
        a = ((a + sec / 2) % sec + sec) % sec - sec / 2;
        return ev(n.c, r * Math.cos(a) - n.R, y, r * Math.sin(a));
      }
    }
    return 1e3;
  }

  // ---- GLSL compiler ----
  function f(x) { var s = (+x).toFixed(3); return s; }
  function compile(prog) {
    var lines = [], id = 0;
    function go(n, p) {
      var v;
      switch (n.t) {
        case 'sph': return 'sdS(' + p + ',' + f(n.r) + ')';
        case 'box': return 'sdB(' + p + ',vec3(' + n.s.map(f).join(',') + '))';
        case 'tor': return 'sdT(' + p + ',' + f(n.R) + ',' + f(n.r) + ')';
        case 'cyl': return 'sdC(' + p + ',' + f(n.r) + ',' + f(n.h) + ')';
        case 'u': case 'su': case 'sub': case 'int': {
          var A = go(n.a, p), B = go(n.b, p); v = 'd' + (id++);
          var e = n.t === 'u' ? 'min(' + A + ',' + B + ')' : n.t === 'su' ? 'smin(' + A + ',' + B + ',' + f(n.k) + ')' :
            n.t === 'sub' ? 'max(' + A + ',-(' + B + '))' : 'max(' + A + ',' + B + ')';
          lines.push('float ' + v + '=' + e + ';'); return v;
        }
        case 'tr': v = 'p' + (id++); lines.push('vec3 ' + v + '=' + p + '-vec3(' + n.v.map(f).join(',') + ');'); return go(n.c, v);
        case 'tw': v = 'p' + (id++); lines.push('vec3 ' + v + '=tw(' + p + ',' + f(n.k) + ');'); return '(0.7*' + go(n.c, v) + ')';
        case 'rep': v = 'p' + (id++); lines.push('vec3 ' + v + '=prep(' + p + ',' + f(n.n) + ',' + f(n.R) + ');'); return go(n.c, v);
      }
      return '1e3';
    }
    var r = go(prog, 'p');
    return 'float map(vec3 p){\n' + lines.join('\n') + '\nreturn ' + r + ';\n}';
  }

  // ---- short text form for the hanging cards ----
  function show(n) {
    switch (n.t) {
      case 'sph': return 'sphere'; case 'box': return 'box'; case 'tor': return 'ring'; case 'cyl': return 'pillar';
      case 'u': return show(n.a) + '+' + show(n.b); case 'su': return '(' + show(n.a) + '~' + show(n.b) + ')';
      case 'sub': return show(n.a) + '-' + show(n.b); case 'int': return show(n.a) + '&' + show(n.b);
      case 'tr': return show(n.c); case 'tw': return 'twist(' + show(n.c) + ')'; case 'rep': return n.n + 'x' + show(n.c);
    }
    return '?';
  }

  // ---- intent: words to a target feature vector [height, volume, hollow, parts, detail, twist] ----
  var FEAT = ['tall', 'mass', 'hollow', 'parts', 'detail', 'twist'];
  var LEX = [
    [/\b(tall|tower|spire|pillar|column|high|cathedral|obelisk)\b/, 0, 0.95],
    [/\b(flat|wide|low|plate|disc|disk|table|plain)\b/, 0, 0.1],
    [/\b(big|huge|heavy|massive|solid|mountain|giant)\b/, 1, 0.9],
    [/\b(tiny|small|thin|light|delicate|fragile)\b/, 1, 0.12],
    [/\b(hollow|ring|arch|portal|gate|halo|empty|cave|tunnel|door)\b/, 2, 0.95],
    [/\b(many|crowd|swarm|crown|circle|petals|flower|forest|several|ring of)\b/, 3, 0.9],
    [/\b(one|single|alone|simple|lone)\b/, 3, 0.05],
    [/\b(intricate|sharp|crystal|lace|spiky|detailed|complex|carved)\b/, 4, 0.9],
    [/\b(smooth|soft|blob|calm|round|pebble|melted)\b/, 4, 0.15],
    [/\b(twist|spiral|helix|swirl|screw|vortex|dna)\b/, 5, 1.0],
    [/\b(straight|still|plain|upright)\b/, 5, 0.0]
  ];
  function parseIntent(text) {
    var t = (text || '').toLowerCase(), target = [0.5, 0.35, 0.3, 0.2, 0.4, 0.2], hit = [0, 0, 0, 0, 0, 0], words = [];
    LEX.forEach(function (e) { var m = t.match(e[0]); if (m) { target[e[1]] = e[2]; hit[e[1]] = 1; words.push(m[1]); } });
    return { target: target, hit: hit, words: words };
  }

  // ---- features from a CPU voxel probe ----
  var G = 18, LO = -2, ST = 4 / (G - 1);
  function features(prog) {
    var N = G * G * G, inside = new Uint8Array(N), cnt = 0, mnx = 9, mxx = -9, mny = 9, mxy = -9, mnz = 9, mxz = -9, axial = 0, axialAll = 0;
    for (var i = 0; i < G; i++) for (var j = 0; j < G; j++) for (var k = 0; k < G; k++) {
      var x = LO + i * ST, y = LO + j * ST, z = LO + k * ST, id = i + G * (j + G * k);
      var rr = Math.sqrt(x * x + z * z); if (rr < 0.45) axialAll++;
      if (ev(prog, x, y, z) < 0) {
        inside[id] = 1; cnt++;
        if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (z < mnz) mnz = z; if (z > mxz) mxz = z;
        if (rr < 0.45) axial++;
      }
    }
    if (cnt < 4) return { v: [0, 0, 0, 0, 0, 0], empty: true };
    var ex = Math.max(mxx - mnx, mxz - mnz, ST), ey = mxy - mny + ST;
    var tall = clamp((ey / (ex + ST)) / 3, 0, 1);
    var mass = clamp(cnt / N * 6, 0, 1);
    var dens = cnt / N, axd = axial / Math.max(axialAll, 1);
    var hollow = clamp(1 - axd / (dens * 3 + 1e-3), 0, 1);
    // connected components (6-neighbour flood) and surface ratio
    var seen = new Uint8Array(N), comps = 0, surf = 0, stack = [];
    for (var s = 0; s < N; s++) {
      if (!inside[s]) continue;
      var si = s % G, sj = ((s / G) | 0) % G, sk = (s / (G * G)) | 0;
      if (si === 0 || si === G - 1 || sj === 0 || sj === G - 1 || sk === 0 || sk === G - 1 ||
        !inside[s - 1] || !inside[s + 1] || !inside[s - G] || !inside[s + G] || !inside[s - G * G] || !inside[s + G * G]) surf++;
      if (seen[s]) continue;
      comps++; stack.push(s); seen[s] = 1;
      while (stack.length) {
        var c = stack.pop(), ci = c % G, cj = ((c / G) | 0) % G, ck = (c / (G * G)) | 0;
        var nb = [ci > 0 ? c - 1 : -1, ci < G - 1 ? c + 1 : -1, cj > 0 ? c - G : -1, cj < G - 1 ? c + G : -1, ck > 0 ? c - G * G : -1, ck < G - 1 ? c + G * G : -1];
        for (var q = 0; q < 6; q++) { var d = nb[q]; if (d >= 0 && inside[d] && !seen[d]) { seen[d] = 1; stack.push(d); } }
      }
    }
    var parts = clamp((comps - 1) / 7, 0, 1);
    var detail = clamp((surf / cnt - 0.35) / 0.6, 0, 1);
    var tw = 0; nodes(prog).forEach(function (n) { if (n.t === 'tw') tw = Math.max(tw, clamp(Math.abs(n.k) / 1.5, 0, 1)); });
    return { v: [tall, mass, hollow, parts, detail, tw], empty: false };
  }
  function score(prog, intent) {
    var F = features(prog); if (F.empty) return { s: -9, v: F.v };
    var d = 0; for (var i = 0; i < 6; i++) { var w = intent.hit[i] ? 2.2 : 0.6, e = F.v[i] - intent.target[i]; d += w * e * e; }
    var s = -d - 0.004 * size(prog) - (depth(prog) > 7 ? 1 : 0);
    return { s: s, v: F.v };
  }

  // ---- mutation ----
  function randomWrap(c) {
    var t = pick(WRAPS);
    if (t === 'tr') return { t: t, v: [r2(rnd(-0.8, 0.8)), r2(rnd(-0.9, 0.9)), r2(rnd(-0.8, 0.8))], c: c };
    if (t === 'tw') return { t: t, k: r2(rnd(-2, 2)), c: c };
    return { t: 'rep', n: 3 + ((Math.random() * 6) | 0), R: r2(rnd(0.4, 1.2)), c: c };
  }
  function randomComb(a, b) { var t = pick(COMBS); var n = { t: t, a: a, b: b }; if (t === 'su') n.k = r2(rnd(0.05, 0.5)); return n; }
  function jitter(n) {
    var j = function (x, a, b) { return r2(clamp(x + rnd(-0.25, 0.25) * (b - a), a, b)); };
    switch (n.t) {
      case 'sph': n.r = j(n.r, 0.1, 1.2); break;
      case 'box': n.s = n.s.map(function (x) { return j(x, 0.08, 1.5); }); break;
      case 'tor': n.R = j(n.R, 0.2, 1.4); n.r = j(n.r, 0.04, 0.5); break;
      case 'cyl': n.r = j(n.r, 0.05, 0.9); n.h = j(n.h, 0.1, 1.8); break;
      case 'su': n.k = j(n.k, 0.02, 0.8); break;
      case 'tr': n.v = n.v.map(function (x) { return j(x, -1.2, 1.2); }); break;
      case 'tw': n.k = j(n.k, -3, 3); break;
      case 'rep': n.R = j(n.R, 0.2, 1.5); if (Math.random() < 0.3) n.n = clamp(n.n + pick([-1, 1]), 2, 12); break;
      default: if (Math.random() < 0.5) { n.t = pick(COMBS); if (n.t === 'su' && !n.k) n.k = 0.2; }
    }
  }
  function mutate(prog) {
    var p = clone(prog), all = nodes(p), n = pick(all), r = Math.random();
    function replaceIn(root, target, repl) {
      if (root === target) return repl;
      ['a', 'b', 'c'].forEach(function (key) { if (root[key]) root[key] = replaceIn(root[key], target, repl); });
      return root;
    }
    if (r < 0.45) { jitter(n); return p; }
    if (r < 0.6 && size(p) < 14) return replaceIn(p, n, randomComb(clone(n), Math.random() < 0.5 ? leaf() : randomWrap(leaf())));
    if (r < 0.75 && size(p) < 14) return replaceIn(p, n, randomWrap(clone(n)));
    if (r < 0.87) { var kid = n.c || (Math.random() < 0.5 ? n.a : n.b); if (kid) return replaceIn(p, n, clone(kid)); }
    return replaceIn(p, n, leaf());
  }

  // ---- beam search, one generation at a time (Worker or main-thread fallback) ----
  function Searcher(intent, seeds) {
    this.intent = intent; this.gen = 0;
    var start = (seeds || []).slice(0, 8).map(clone);
    while (start.length < 16) start.push(Math.random() < 0.5 ? leaf() : randomComb(leaf(), randomWrap(leaf())));
    var self = this;
    this.beam = start.map(function (p) { var sc = score(p, intent); return { p: p, s: sc.s, v: sc.v }; });
    this.beam.sort(function (a, b) { return b.s - a.s; });
  }
  Searcher.prototype.step = function (children) {
    children = children || 32; var kids = [];
    for (var i = 0; i < children; i++) {
      var parent = this.beam[Math.min((Math.random() * Math.random() * this.beam.length) | 0, this.beam.length - 1)].p;
      var c = mutate(parent); var sc = score(c, this.intent); kids.push({ p: c, s: sc.s, v: sc.v });
    }
    var pool = this.beam.concat(kids), seen = {}, out = [];
    pool.sort(function (a, b) { return b.s - a.s; });
    for (var j = 0; j < pool.length && out.length < 16; j++) { var key = JSON.stringify(pool[j].p); if (!seen[key]) { seen[key] = 1; out.push(pool[j]); } }
    this.beam = out; this.gen++;
    return { gen: this.gen, top: out.slice(0, 5).map(function (e) { return { p: e.p, s: e.s, v: e.v, size: size(e.p), label: show(e.p) }; }) };
  };

  var API = { leaf: leaf, ev: ev, compile: compile, show: show, parseIntent: parseIntent, features: features, score: score,
    mutate: mutate, Searcher: Searcher, size: size, depth: depth, FEAT: FEAT };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.F207 = API;
})(typeof self !== 'undefined' ? self : this);
