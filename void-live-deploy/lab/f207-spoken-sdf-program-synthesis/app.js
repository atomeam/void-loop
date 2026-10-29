(function () {
  'use strict';
  var C = window.F207, cv = document.getElementById('gl'), gl = cv.getContext('webgl2', { antialias: false });
  var note = document.getElementById('note'), stat = document.getElementById('stat');
  var SEAL_KEY = 'f207-seals';
  function seals() { try { return JSON.parse(localStorage.getItem(SEAL_KEY) || '[]'); } catch (e) { return []; } }

  // ---------- renderer: shader is rebuilt every time the mind adopts a new program ----------
  var VS = '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}';
  var HEAD = '#version 300 es\nprecision highp float;out vec4 o;uniform vec2 R;uniform float T;uniform vec2 M;uniform float H;\n' +
    'float sdS(vec3 p,float r){return length(p)-r;}\n' +
    'float sdB(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}\n' +
    'float sdT(vec3 p,float R,float r){vec2 q=vec2(length(p.xz)-R,p.y);return length(q)-r;}\n' +
    'float sdC(vec3 p,float r,float h){vec2 d=vec2(length(p.xz)-r,abs(p.y)-h);return min(max(d.x,d.y),0.)+length(max(d,0.));}\n' +
    'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}\n' +
    'vec3 tw(vec3 p,float k){float a=k*p.y,c=cos(a),s=sin(a);return vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z);}\n' +
    'vec3 prep(vec3 p,float n,float R){float s=6.2831853/n,a=atan(p.z,p.x),r=length(p.xz);a=mod(a+s*.5,s)-s*.5;return vec3(r*cos(a)-R,p.y,r*sin(a));}\n';
  var TAIL = '\nvec3 nrm(vec3 p){vec2 e=vec2(.0015,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}\n' +
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' +
    'vec3 sky(vec3 rd){float s=pow(hash(floor(rd.xy*420.)+floor(rd.z*420.)),180.)*1.6;vec3 neb=vec3(.05,.03,.12)*pow(max(0.,1.-abs(rd.y+.15)),3.)+vec3(.0,.02,.05)*pow(max(dot(rd,normalize(vec3(.6,.3,-1.))),0.),6.);return neb+vec3(s);}\n' +
    'void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;float ay=T*.15+M.x*3.,ax=.25+M.y*.8;\n' +
    'vec3 ro=vec3(sin(ay)*cos(ax),sin(ax),cos(ay)*cos(ax))*5.2;vec3 f=normalize(-ro),r=normalize(cross(vec3(0,1,0),f)),u=cross(f,r);vec3 rd=normalize(f*1.8+uv.x*r+uv.y*u);\n' +
    'float t=0.,d;bool hit=false;for(int i=0;i<110;i++){d=map(ro+rd*t);if(d<.001*t){hit=true;break;}t+=d*.9;if(t>14.)break;}\n' +
    'vec3 col=sky(rd);if(hit){vec3 p=ro+rd*t,n=nrm(p);vec3 L=normalize(vec3(.6,.9,-.4));float dif=max(dot(n,L),0.),ao=clamp(map(p+n*.12)/.12,0.,1.),rim=pow(1.-max(dot(n,-rd),0.),3.);\n' +
    'vec3 base=mix(vec3(.55,.62,1.),vec3(1.,.82,.6),.5+.5*n.y);col=base*(.08+.85*dif)*(.4+.6*ao)+rim*vec3(.5,.6,1.)*(.6+H);col=mix(col,sky(rd),1.-exp(-.004*t*t));}\n' +
    'col=pow(col,vec3(.4545));o=vec4(col,1);}';
  var prog = null, buf, uR, uT, uM, uH, mouse = [0, 0], heat = 0;
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function install(mapSrc) {
    if (!gl) return false;
    try {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + mapSrc + TAIL));
      gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      if (prog) gl.deleteProgram(prog); prog = p;
      uR = gl.getUniformLocation(p, 'R'); uT = gl.getUniformLocation(p, 'T'); uM = gl.getUniformLocation(p, 'M'); uH = gl.getUniformLocation(p, 'H');
      document.getElementById('glsl').textContent = mapSrc; return true;
    } catch (e) { note.textContent = 'shader rejected, kept previous: ' + String(e.message).slice(0, 120); return false; }
  }
  if (gl) {
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  } else note.textContent = 'WebGL2 unavailable: the mind still runs and the mobile still moves; the sculpture is not drawn.';
  var scale = Math.min(1, 900 / Math.max(innerWidth, 1)), fpsAvg = 60, last = performance.now();
  function resize() { cv.width = Math.round(innerWidth * devicePixelRatio * scale); cv.height = Math.round(innerHeight * devicePixelRatio * scale); }
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', function (e) { mouse = [e.clientX / innerWidth - .5, .5 - e.clientY / innerHeight]; });

  // ---------- the mind (Worker, or main-thread fallback) ----------
  var worker = null, fallback = null, current = null, bestScore = -Infinity, lastInstall = 0, intent = C.parseIntent('');
  try { worker = new Worker('worker.js'); worker.onmessage = function (e) { onThought(e.data); }; worker.onerror = function () { worker = null; note.textContent = 'Worker blocked; thinking on the main thread.'; start(intent); }; } catch (e) { worker = null; }
  function start(it) {
    intent = it; bestScore = -Infinity; drawBars(null);
    var seeds = seals().map(function (s) { return s.p; });
    if (worker) worker.postMessage({ type: 'intent', intent: it, seeds: seeds });
    else { fallback = new C.Searcher(it, seeds); (function tick() { if (!fallback || fallback.intent !== it) return; var t0 = performance.now(), r; while (performance.now() - t0 < 12) r = fallback.step(8); onThought(r); if (r.gen < 1500) setTimeout(tick, 30); })(); }
  }
  function onThought(r) {
    var top = r.top[0];
    heat = Math.min(1, heat * .9 + Math.max(0, top.s - bestScore) * 3);
    stat.textContent = 'generation ' + r.gen + ' · best fit ' + top.s.toFixed(3) + ' · ' + top.size + ' nodes · ' + top.label;
    var key = JSON.stringify(top.p), now = performance.now();
    if (top.s > bestScore + 1e-4 && key !== current && now - lastInstall > 350) {
      if (install(C.compile(top.p)) || !gl) { current = key; bestScore = top.s; lastInstall = now; window.F207_current = top; }
    }
    drawBars(top.v); hang(r.top);
  }

  // ---------- intent meters ----------
  function drawBars(v) {
    var el = document.getElementById('bars'), h = '';
    C.FEAT.forEach(function (name, i) { h += '<span>' + name + '</span><div class="meter"><i style="width:' + ((v ? v[i] : 0) * 100).toFixed(0) + '%"></i><b style="left:' + (intent.target[i] * 100).toFixed(0) + '%;opacity:' + (intent.hit[i] ? 1 : .35) + '"></b></div>'; });
    el.innerHTML = h;
  }

  // ---------- the hanging mobile: physics driven by the search's own scores ----------
  var mob = document.getElementById('mobile'), bar = document.getElementById('bar'), cards = [], tilt = 0, tiltV = 0;
  for (var i = 0; i < 5; i++) {
    var c = document.createElement('div'); c.className = 'card'; c.innerHTML = '<div class="str"></div><div class="body"></div>';
    c.style.left = (14 + i * 56) + 'px'; mob.appendChild(c);
    cards.push({ el: c, len: 60, lenT: 60, ang: 0, angV: 0, s: 0, data: null });
    c.addEventListener('click', (function (k) { return function () { var d = cards[k].data; if (d && install(C.compile(d.p))) { current = JSON.stringify(d.p); window.F207_current = d; stat.textContent = 'you adopted candidate ' + (k + 1) + ': ' + d.label; } }; })(i));
  }
  var torque = 0;
  function hang(top) {
    var lo = Math.min.apply(null, top.map(function (t) { return t.s; })), hi = Math.max.apply(null, top.map(function (t) { return t.s; })) + 1e-6;
    torque = 0;
    top.forEach(function (t, i) {
      var k = cards[i]; if (!k) return; var w = (t.s - lo) / (hi - lo);
      if (k.data && JSON.stringify(k.data.p) !== JSON.stringify(t.p)) k.angV += (Math.random() - .5) * 0.25; // a new idea arrives: the card is jolted
      k.data = t; k.lenT = 40 + (1 - w) * 170; k.mass = 0.5 + t.size / 6;
      torque += (i - 2) * k.mass * (0.3 + w);
      k.el.classList.toggle('best', i === 0);
      k.el.querySelector('.body').innerHTML = t.label.slice(0, 48) + '<br><span class="s">' + t.s.toFixed(2) + '</span>';
    });
  }
  function physics(dt) {
    tiltV += (torque * 1.2 - tilt) * dt * 6 - tiltV * dt * 3; tilt += tiltV * dt;
    bar.style.setProperty('--tilt', Math.max(-14, Math.min(14, tilt)).toFixed(2) + 'deg');
    document.documentElement.style.setProperty('--glow', (0.2 + heat * .8).toFixed(2));
    var tr = tilt * Math.PI / 180;
    cards.forEach(function (k, i) {
      k.len += (k.lenT - k.len) * Math.min(1, dt * 4);
      k.angV += (-Math.sin(k.ang) * 9 / (k.len / 60) - tr * 2) * dt - k.angV * dt * 0.8; k.ang += k.angV * dt;
      var x = (i - 2) * 56, y = 10 + Math.sin(tr) * x;
      k.el.style.transform = 'translate(0,' + y.toFixed(1) + 'px) rotate(' + (k.ang * 57.3).toFixed(2) + 'deg)';
      k.el.querySelector('.str').style.height = k.len.toFixed(1) + 'px';
    });
  }

  // ---------- frame loop with adaptive resolution ----------
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; fpsAvg = fpsAvg * .95 + (1 / Math.max(dt, 1e-3)) * .05;
    if (fpsAvg < 40 && scale > .35) { scale *= .85; resize(); fpsAvg = 55; } else if (fpsAvg > 58 && scale < 1) { scale = Math.min(1, scale * 1.05); resize(); fpsAvg = 50; }
    physics(dt); heat *= .995;
    if (gl && prog) { gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(prog); gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, now / 1000); gl.uniform2f(uM, mouse[0], mouse[1]); gl.uniform1f(uH, heat); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- input: text, voice, seal ----------
  var q = document.getElementById('q');
  document.getElementById('ask').addEventListener('submit', function (e) { e.preventDefault(); var it = C.parseIntent(q.value || q.placeholder); note.textContent = it.words.length ? 'heard: ' + it.words.join(', ') : 'no shape words recognised; the mind will improvise near the defaults'; start(it); });
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = document.getElementById('mic');
  if (!SR) { mic.disabled = true; mic.title = 'Speech recognition is not available in this browser; type instead'; }
  else mic.addEventListener('click', function () {
    var rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; mic.classList.add('on');
    rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; q.value = t; var it = C.parseIntent(t); if (it.words.length) start(it); };
    rec.onend = function () { mic.classList.remove('on'); }; rec.onerror = function (e) { note.textContent = 'voice: ' + e.error; };
    rec.start();
  });
  document.getElementById('seal').addEventListener('click', function () {
    if (!window.F207_current) return; var s = seals(); s.unshift({ p: window.F207_current.p, at: Date.now(), words: intent.words }); localStorage.setItem(SEAL_KEY, JSON.stringify(s.slice(0, 12)));
    note.textContent = 'sealed locally (' + Math.min(s.length, 12) + ' in memory). Future searches start from your seals.';
  });
  install(C.compile({ t: 'su', k: .3, a: { t: 'tw', k: .8, c: { t: 'box', s: [.25, 1.1, .25] } }, b: { t: 'tr', v: [0, 1.1, 0], c: { t: 'tor', R: .6, r: .08 } } }));
  start(C.parseIntent(q.placeholder));
})();
