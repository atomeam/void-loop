(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const GRID = 32;
  let cells = new Float32Array(GRID * GRID); // energy
  let ent = new Float32Array(GRID * GRID * 4); // entanglement to N,E,S,W
  let width, height, dpr = 1;
  let pointer = { x: 0.5, y: 0.5, down: false };
  let tilt = { x: 0, y: 0 };
  let residual = 0.4, energyPeak = 0;
  let params = { diffuse: 0.12, entBoost: 0.25, decay: 0.96 };
  let xrSession = null;
  let audioCtx = null, oscs = [];
  let worker = null;
  let cards = [];
  let frame = 0;

  function randn() { return (Math.random() - 0.5) * 0.25; }
  const H = 8;
  let w1 = new Float32Array(6 * H), b1 = new Float32Array(H);
  let w2 = new Float32Array(H * 3), b2 = new Float32Array(3);
  function initMLP() {
    for (let i = 0; i < w1.length; i++) w1[i] = randn();
    for (let i = 0; i < b1.length; i++) b1[i] = randn() * 0.04;
    for (let i = 0; i < w2.length; i++) w2[i] = randn();
    for (let i = 0; i < b2.length; i++) b2[i] = randn() * 0.04;
  }
  function mlp(inp) {
    const h = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let s = b1[j];
      for (let i = 0; i < 6; i++) s += inp[i] * w1[i * H + j];
      h[j] = Math.tanh(s);
    }
    const o = [0,0,0];
    for (let k = 0; k < 3; k++) {
      let s = b2[k];
      for (let j = 0; j < H; j++) s += h[j] * w2[j * 3 + k];
      o[k] = 0.5 + 0.5 * Math.tanh(s);
    }
    return o;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.width = Math.floor(innerWidth * dpr);
    height = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize); resize();

  function initLattice() {
    cells.fill(0);
    ent.fill(0);
    for (let i = 0; i < cells.length; i++) cells[i] = Math.random() * 0.15;
  }
  initLattice(); initMLP();

  function stepLattice() {
    const next = new Float32Array(cells);
    const d = params.diffuse, eb = params.entBoost, dec = params.decay;
    energyPeak = 0;
    for (let y = 1; y < GRID-1; y++) for (let x = 1; x < GRID-1; x++) {
      const i = y * GRID + x;
      const n = cells[i - GRID], e = cells[i + 1], s = cells[i + GRID], w = cells[i - 1];
      const avg = (n + e + s + w) * 0.25;
      // entanglement: boost if correlated
      const corr = (Math.abs(cells[i] - n) + Math.abs(cells[i] - e) + Math.abs(cells[i] - s) + Math.abs(cells[i] - w)) * 0.25;
      ent[i*4] = ent[i*4] * 0.9 + (1 - corr) * 0.1; // simple
      next[i] = cells[i] * dec + (avg - cells[i]) * d + (1 - corr) * eb * 0.1;
      // inject pointer / tilt
      const px = Math.floor(pointer.x * GRID), py = Math.floor(pointer.y * GRID);
      if (Math.abs(x - px) < 2 && Math.abs(y - py) < 2 && pointer.down) next[i] += 0.35;
      next[i] += tilt.x * 0.02 + tilt.y * 0.02;
      next[i] = Math.max(0, Math.min(1, next[i]));
      if (next[i] > energyPeak) energyPeak = next[i];
    }
    cells.set(next);
  }

  function draw() {
    ctx.fillStyle = 'rgba(4,4,12,0.22)';
    ctx.fillRect(0, 0, width, height);
    const cw = width / GRID, ch = height / GRID;
    for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
      const e = cells[y * GRID + x];
      if (e < 0.05) continue;
      const hue = 220 + e * 80;
      ctx.fillStyle = `hsla(${hue}, 70%, ${30 + e*40}%, ${0.3 + e*0.6})`;
      ctx.fillRect(x * cw, y * ch, cw - 1, ch - 1);
    }
  }

  function manageCards() {
    const box = document.getElementById('cards');
    // spawn at high peaks
    if (energyPeak > 0.55 && residual < 0.65 && cards.length < 12 && Math.random() < 0.08) {
      let bestI = 0, bestE = 0;
      for (let i = 0; i < cells.length; i++) if (cells[i] > bestE) { bestE = cells[i]; bestI = i; }
      const x = (bestI % GRID) / GRID, y = Math.floor(bestI / GRID) / GRID;
      const el = document.createElement('div');
      el.className = 'card';
      el.textContent = (bestE * 100 | 0).toString(16);
      el.style.left = (x * innerWidth) + 'px';
      el.style.top = (y * innerHeight) + 'px';
      box.appendChild(el);
      cards.push({ el, x, y, age: 0, energy: bestE });
    }
    // update and cull
    for (let i = cards.length - 1; i >= 0; i--) {
      const c = cards[i];
      c.age++;
      const s = Math.min(1.8, 0.7 + (1 - residual) * 0.8);
      c.el.style.transform = `translate(-50%,-50%) scale(${s})`;
      c.el.style.opacity = Math.max(0.2, 1 - residual * 0.8);
      c.el.classList.toggle('cluster', residual < 0.35);
      if (residual > 0.72 || c.age > 400) {
        c.el.remove();
        cards.splice(i, 1);
      }
    }
  }

  function updateChrome() {
    const hue = 210 + residual * 90;
    const blur = Math.min(3.5, residual * 1.8);
    const contrast = 1 + residual * 0.25;
    document.documentElement.style.setProperty('--hue', hue.toFixed(0));
    document.documentElement.style.setProperty('--blur', blur.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--contrast', contrast.toFixed(2));
  }

  function updateAudio() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    oscs.forEach((o, i) => {
      const f = 60 + residual * 140 + i * 35;
      o.frequency.setTargetAtTime(f, t, 0.12);
      o.gain.setTargetAtTime(0.035 * (0.2 + residual), t, 0.18);
    });
  }

  function spawnWorker() {
    const code = `
      let w1, b1, w2, b2, H=8;
      function randn(){return (Math.random()-0.5)*0.18;}
      function init(){
        w1=new Float32Array(6*H); b1=new Float32Array(H);
        w2=new Float32Array(H*3); b2=new Float32Array(3);
        for(let i=0;i<w1.length;i++)w1[i]=randn();
        for(let i=0;i<b1.length;i++)b1[i]=randn()*0.04;
        for(let i=0;i<w2.length;i++)w2[i]=randn();
        for(let i=0;i<b2.length;i++)b2[i]=randn()*0.04;
      }
      function mlp(inp){
        const h=new Float32Array(H);
        for(let j=0;j<H;j++){let s=b1[j];for(let i=0;i<6;i++)s+=inp[i]*w1[i*H+j];h[j]=Math.tanh(s);}
        const o=[0,0,0];
        for(let k=0;k<3;k++){let s=b2[k];for(let j=0;j<H;j++)s+=h[j]*w2[j*3+k];o[k]=0.5+0.5*Math.tanh(s);}
        return o;
      }
      function mutate(){
        const i=Math.floor(Math.random()*w1.length); w1[i]+=randn()*0.04;
        const j=Math.floor(Math.random()*w2.length); w2[j]+=randn()*0.04;
      }
      init();
      let bestFitness=-1e9, best={diffuse:0.12,entBoost:0.25,decay:0.96};
      onmessage=e=>{
        const {residual,peak,tilt}=e.data;
        const inp=new Float32Array(6);
        inp[0]=residual; inp[1]=peak; inp[2]=tilt.x; inp[3]=tilt.y; inp[4]=Math.random()*0.1; inp[5]=0.5;
        const pred=mlp(inp);
        const fit= -Math.abs(pred[0] - peak*0.8) + (1-residual)*0.4;
        if(fit>bestFitness){bestFitness=fit; best={diffuse:0.06+pred[0]*0.2, entBoost:0.1+pred[1]*0.4, decay:0.9+pred[2]*0.08};}
        else mutate();
        postMessage({params:best, residual:Math.abs(fit), fitness:bestFitness});
      };
    `;
    const blob = new Blob([code], {type:'application/javascript'});
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = e => {
      params = e.data.params;
      residual = Math.min(1, residual * 0.92 + e.data.residual * 0.08);
    };
  }
  spawnWorker();

  function loop() {
    frame++;
    stepLattice();
    draw();
    manageCards();
    updateChrome();
    updateAudio();
    if (frame % 40 === 0 && worker) {
      worker.postMessage({ residual, peak: energyPeak, tilt });
    }
    statusEl.textContent = `res:${residual.toFixed(2)} peak:${energyPeak.toFixed(2)} cards:${cards.length} · d:${params.diffuse.toFixed(2)}`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  canvas.addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight;
  });
  canvas.addEventListener('pointerdown', () => pointer.down = true);
  canvas.addEventListener('pointerup', () => pointer.down = false);

  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 90;
    tilt.y = (e.beta || 0) / 90;
  });

  document.getElementById('evolveBtn').onclick = () => {
    if (worker) worker.postMessage({ residual: residual + 0.3, peak: energyPeak, tilt });
  };

  document.getElementById('sealBtn').onclick = async () => {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('f246', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('policy');
        r.onsuccess = () => res(r.result); r.onerror = rej;
      });
      const tx = db.transaction('policy', 'readwrite');
      tx.objectStore('policy').put({ params, residual, cards: cards.length }, 'latest');
      statusEl.textContent = 'policy sealed';
    } catch(e) { statusEl.textContent = 'seal failed'; }
  };

  document.getElementById('resetBtn').onclick = () => {
    initLattice(); initMLP(); residual = 0.4; cards.forEach(c => c.el.remove()); cards = [];
  };

  // Audio init on first interaction
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 80 + i * 40;
      g.gain.value = 0.02;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      oscs.push({ frequency: o.frequency, gain: g.gain });
    }
  }
  canvas.addEventListener('pointerdown', initAudio, {once: true});

  document.getElementById('xrBtn').onclick = async () => {
    if (!navigator.xr) { statusEl.textContent = 'no WebXR'; return; }
    try {
      xrSession = await navigator.xr.requestSession('immersive-vr');
      statusEl.textContent = 'XR session active (pointer fallback)';
    } catch (e) { statusEl.textContent = 'XR unsupported or denied'; }
  };
})();
