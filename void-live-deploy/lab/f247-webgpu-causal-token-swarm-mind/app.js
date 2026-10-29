(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const N = 160;
  const tokens = [];
  let width, height, dpr = 1;
  let pointer = { x: 0.5, y: 0.5, down: false, vx: 0, vy: 0, hist: [] };
  let tilt = { x: 0, y: 0 };
  let spectral = new Float32Array(6);
  let residual = 0.4, energy = 0;
  let policy = { forceGain: 1.2, attnTemp: 0.35, embDecay: 0.96 };
  let xrSession = null;
  let audioCtx = null, oscs = [];
  let worker = null;
  let sealed = false;

  function randn(s = 0.4) { return (Math.random() - 0.5) * s; }
  function hashEmb(e) {
    let h = 0;
    for (let i = 0; i < 4; i++) h = (h * 31 + Math.floor(e[i] * 100)) | 0;
    return 't' + Math.abs(h).toString(36).slice(0, 4);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.width = Math.floor(innerWidth * dpr);
    height = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize); resize();

  function initTokens() {
    tokens.length = 0;
    for (let i = 0; i < N; i++) {
      tokens.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: randn(0.4), vy: randn(0.4),
        emb: [randn(), randn(), randn(), randn()],
        attn: 0
      });
    }
  }
  initTokens();

  // DOM orbs for top attention tokens
  const orbs = [];
  function makeOrbs() {
    const box = document.getElementById('orbs');
    box.innerHTML = '';
    orbs.length = 0;
    for (let i = 0; i < 5; i++) {
      const el = document.createElement('div');
      el.className = 'orb';
      el.textContent = 'orb';
      box.appendChild(el);
      orbs.push({ el, token: null, attn: 0 });
    }
  }
  makeOrbs();

  function stepTokens() {
    // recent queries: last pointer + spectral proxy
    const queries = [];
    if (pointer.hist.length) {
      const last = pointer.hist[pointer.hist.length - 1];
      queries.push({ x: last.x * width, y: last.y * height, q: [pointer.vx * 2, pointer.vy * 2, energy, tilt.x] });
    }
    queries.push({ x: pointer.x * width, y: pointer.y * height, q: [spectral[0] || 0, spectral[1] || 0, tilt.y, residual] });

    const temp = policy.attnTemp;
    const gain = policy.forceGain;
    const decay = policy.embDecay;

    let sumAttn = 0;
    for (const t of tokens) {
      let best = -1e9, bx = t.x, by = t.y;
      for (const q of queries) {
        let dot = 0;
        for (let k = 0; k < 4; k++) dot += t.emb[k] * (q.q[k] || 0);
        const dist = Math.hypot(q.x - t.x, q.y - t.y) || 1;
        const score = Math.exp(dot / temp) * Math.exp(-dist / 180);
        if (score > best) { best = score; bx = q.x; by = q.y; }
      }
      t.attn = Math.min(3, best * 0.15);
      sumAttn += t.attn;

      // force toward high-score query
      const dx = bx - t.x, dy = by - t.y;
      const d = Math.hypot(dx, dy) || 1;
      t.vx += (dx / d) * t.attn * gain * 0.12;
      t.vy += (dy / d) * t.attn * gain * 0.12;

      // mild cohesion / separation
      t.vx += tilt.x * 0.25; t.vy += tilt.y * 0.25;
      t.vx *= 0.92; t.vy *= 0.92;
      t.x += t.vx; t.y += t.vy;

      // bounds
      if (t.x < 10) t.vx += 0.4; if (t.x > width - 10) t.vx -= 0.4;
      if (t.y < 10) t.vy += 0.4; if (t.y > height - 10) t.vy -= 0.4;

      // emb drift toward query when high attn
      if (t.attn > 0.4 && queries[0]) {
        for (let k = 0; k < 4; k++) t.emb[k] = t.emb[k] * decay + (queries[0].q[k] || 0) * (1 - decay) * 0.4;
      }
    }
    residual = Math.max(0.05, residual * 0.97 + (1 - Math.min(1, sumAttn / N * 2)) * 0.08);
  }

  function draw() {
    ctx.fillStyle = 'rgba(5,5,16,0.22)';
    ctx.fillRect(0, 0, width, height);
    for (const t of tokens) {
      const a = Math.min(1, 0.25 + t.attn * 0.6);
      ctx.fillStyle = `hsla(${200 + t.attn * 40 + residual * 30}, 65%, ${50 + t.attn * 15}%, ${a})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, 1.8 + t.attn * 1.5, 0, 6.28); ctx.fill();
    }
  }

  function updateOrbs() {
    const ranked = tokens.map((t, i) => ({ t, i, a: t.attn })).sort((a, b) => b.a - a.a);
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      const top = ranked[i];
      if (!top || top.a < 0.25) {
        o.el.style.opacity = '0.3';
        continue;
      }
      o.token = top.t;
      o.attn = top.a;
      o.el.style.opacity = '1';
      o.el.style.left = (top.t.x / dpr) + 'px';
      o.el.style.top = (top.t.y / dpr) + 'px';
      const s = 0.7 + Math.min(1.4, top.a * 0.8);
      o.el.style.transform = `translate(-50%,-50%) scale(${s})`;
      o.el.classList.toggle('hot', top.a > 1.2);
      o.el.textContent = hashEmb(top.t.emb) + '\n' + top.a.toFixed(2);
    }
  }

  function updateChrome() {
    const hue = 190 + residual * 70 + energy * 30;
    const blur = Math.min(3.5, residual * 1.8);
    const contrast = 1 + residual * 0.25;
    document.documentElement.style.setProperty('--hue', hue.toFixed(0));
    document.documentElement.style.setProperty('--blur', blur.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--contrast', contrast.toFixed(2));
  }

  function updateAudio() {
    if (!audioCtx || !oscs.length) return;
    const t = audioCtx.currentTime;
    oscs.forEach((o, i) => {
      const f = 90 + residual * 140 + energy * 50 + i * 28;
      o.frequency.setTargetAtTime(f, t, 0.12);
      o.gain.setTargetAtTime(0.035 * (0.25 + residual), t, 0.15);
      if (o.panner && orbs[i] && orbs[i].token) {
        const px = (orbs[i].token.x / width - 0.5) * 2;
        o.panner.positionX.setTargetAtTime(px, t, 0.1);
      }
    });
  }

  function spawnWorker() {
    const code = `
      let w1, b1, w2, b2, H = 8;
      function randn(){ return (Math.random()-0.5)*0.25; }
      function init(){
        w1 = new Float32Array(8*H); b1 = new Float32Array(H);
        w2 = new Float32Array(H*3); b2 = new Float32Array(3);
        for (let i=0;i<w1.length;i++) w1[i]=randn();
        for (let i=0;i<b1.length;i++) b1[i]=randn()*0.05;
        for (let i=0;i<w2.length;i++) w2[i]=randn();
        for (let i=0;i<b2.length;i++) b2[i]=randn()*0.05;
      }
      function mlp(inp){
        const h = new Float32Array(H);
        for (let j=0;j<H;j++){
          let s = b1[j];
          for (let i=0;i<8;i++) s += inp[i] * w1[i*H+j];
          h[j] = Math.tanh(s);
        }
        const o = [0,0,0];
        for (let k=0;k<3;k++){
          let s = b2[k];
          for (let j=0;j<H;j++) s += h[j] * w2[j*3+k];
          o[k] = 0.5 + 0.5 * Math.tanh(s);
        }
        return o;
      }
      function mutate(){
        const i = Math.floor(Math.random()*w1.length); w1[i] += randn()*0.06;
        const j = Math.floor(Math.random()*w2.length); w2[j] += randn()*0.06;
      }
      init();
      let bestFitness = -1e9, best = {forceGain:1.2, attnTemp:0.35, embDecay:0.96};
      onmessage = e => {
        const {spectral, tilt, residual, energy} = e.data;
        const inp = new Float32Array(8);
        for (let i=0;i<6;i++) inp[i] = spectral[i] || 0;
        inp[6] = tilt.x; inp[7] = residual;
        const pred = mlp(inp);
        const fit = -(Math.abs(pred[0] - (0.3 + energy*0.4)) + Math.abs(pred[1] - residual*0.5)) + (spectral[0]||0)*0.3;
        if (fit > bestFitness) {
          bestFitness = fit;
          best = {
            forceGain: 0.6 + pred[0] * 1.4,
            attnTemp: 0.15 + pred[1] * 0.5,
            embDecay: 0.92 + pred[2] * 0.06
          };
        } else mutate();
        postMessage({ policy: best, residual: Math.abs(fit)*0.15, fitness: bestFitness });
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = e => {
      policy = e.data.policy;
      residual = Math.min(1, residual * 0.7 + e.data.residual * 0.5);
    };
  }
  spawnWorker();

  function loop() {
    stepTokens();
    draw();
    updateOrbs();
    updateChrome();
    updateAudio();
    if (Math.random() < 0.025 && worker) {
      worker.postMessage({ spectral, tilt, residual, energy });
    }
    statusEl.textContent = `fg:${policy.forceGain.toFixed(2)} temp:${policy.attnTemp.toFixed(2)} · res:${residual.toFixed(2)} · e:${energy.toFixed(2)}`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Input
  canvas.addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth;
    pointer.y = e.clientY / innerHeight;
    pointer.vx = e.movementX * 0.012;
    pointer.vy = e.movementY * 0.012;
    pointer.hist.push({ x: pointer.x, y: pointer.y });
    if (pointer.hist.length > 12) pointer.hist.shift();
  });
  canvas.addEventListener('pointerdown', () => pointer.down = true);
  canvas.addEventListener('pointerup', () => pointer.down = false);

  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 90;
    tilt.y = (e.beta || 0) / 90;
  });

  document.getElementById('micBtn').onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!audioCtx) audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function poll() {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < 6; i++) {
          spectral[i] = data[i * 3] / 255;
          sum += spectral[i];
        }
        energy = sum / 6;
        requestAnimationFrame(poll);
      }
      poll();
      for (let i = 0; i < 3; i++) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const p = audioCtx.createPanner();
        p.panningModel = 'HRTF';
        o.type = 'sine'; o.frequency.value = 110 + i * 35;
        g.gain.value = 0.025;
        o.connect(g); g.connect(p); p.connect(audioCtx.destination);
        o.start();
        oscs.push({ frequency: o.frequency, gain: g.gain, panner: p });
      }
      statusEl.textContent = 'mic + spatial audio active';
    } catch (err) { statusEl.textContent = 'mic denied'; }
  };

  document.getElementById('evolveBtn').onclick = () => {
    if (worker) worker.postMessage({ spectral, tilt, residual: residual + 0.4, energy });
  };

  document.getElementById('sealBtn').onclick = async () => {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('f247', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('policy');
        r.onsuccess = () => res(r.result); r.onerror = rej;
      });
      const tx = db.transaction('policy', 'readwrite');
      tx.objectStore('policy').put({ policy, residual, note: 'f247-token-swarm' }, 'latest');
      sealed = true;
      statusEl.textContent = 'policy sealed';
    } catch (e) { statusEl.textContent = 'seal failed'; }
  };

  document.getElementById('resetBtn').onclick = () => {
    initTokens(); residual = 0.4; energy = 0;
  };

  document.getElementById('xrBtn').onclick = async () => {
    if (!navigator.xr) { statusEl.textContent = 'no WebXR'; return; }
    try {
      xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
      statusEl.textContent = 'XR session (hand queries optional)';
    } catch (e) { statusEl.textContent = 'XR denied or unsupported'; }
  };
})();
