(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const N = 81; // 9x9
  const particles = [];
  const springs = [];
  let width, height, dpr = 1;
  let pointer = { x: 0.5, y: 0.5, down: false, vx: 0, vy: 0 };
  let tilt = { x: 0, y: 0 };
  let spectral = new Float32Array(8);
  let residual = 0, energy = 0, strainVar = 0;
  let params = { k: 0.18, d: 0.82, restScale: 1.0 };
  let xrSession = null;
  let audioCtx = null, oscs = [];
  let worker = null;
  let sealed = false;

  // Tiny MLP 8→10→3 for k,d,rest
  const H = 10;
  let w1 = new Float32Array(8 * H), b1 = new Float32Array(H);
  let w2 = new Float32Array(H * 3), b2 = new Float32Array(3);
  function randn() { return (Math.random() - 0.5) * 0.3; }
  function initMLP() {
    for (let i = 0; i < w1.length; i++) w1[i] = randn();
    for (let i = 0; i < b1.length; i++) b1[i] = randn() * 0.05;
    for (let i = 0; i < w2.length; i++) w2[i] = randn();
    for (let i = 0; i < b2.length; i++) b2[i] = randn() * 0.05;
  }
  function mlp(inp) {
    const h = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let s = b1[j];
      for (let i = 0; i < 8; i++) s += inp[i] * w1[i * H + j];
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

  function initSoftbody() {
    particles.length = 0; springs.length = 0;
    const cols = 9, rows = 9, sp = 32;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = width * 0.35 + c * sp, y = height * 0.35 + r * sp;
      particles.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, strain: 0 });
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) springs.push({ a: i, b: i + 1, rest: sp });
      if (r + 1 < rows) springs.push({ a: i, b: i + cols, rest: sp });
      if (c + 1 < cols && r + 1 < rows) springs.push({ a: i, b: i + cols + 1, rest: sp * 1.414 });
    }
  }
  initSoftbody(); initMLP();

  // DOM anchors bound to selected particles
  const anchors = [];
  function makeAnchors() {
    const box = document.getElementById('anchors');
    box.innerHTML = '';
    anchors.length = 0;
    [10, 20, 40, 50, 70].forEach((pid, i) => {
      const el = document.createElement('div');
      el.className = 'anchor';
      el.textContent = 'orb ' + (i+1);
      el.dataset.pid = pid;
      box.appendChild(el);
      anchors.push({ el, pid, strain: 0 });
    });
  }
  makeAnchors();

  function stepSoftbody() {
    const k = params.k, d = params.d, rs = params.restScale;
    // springs
    for (const s of springs) {
      const a = particles[s.a], b = particles[s.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const rest = s.rest * rs;
      const force = (dist - rest) * k;
      const nx = dx / dist, ny = dy / dist;
      a.vx += nx * force; a.vy += ny * force;
      b.vx -= nx * force; b.vy -= ny * force;
      a.strain += Math.abs(dist - rest);
      b.strain += Math.abs(dist - rest);
    }
    // integrate + gravity/tilt + pointer attract
    let sumStrain = 0;
    for (const p of particles) {
      p.vx *= d; p.vy *= d;
      p.vx += tilt.x * 0.4; p.vy += tilt.y * 0.4;
      if (pointer.down) {
        const dx = pointer.x * width - p.x, dy = pointer.y * height - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 120) {
          p.vx += (dx / dist) * 1.8;
          p.vy += (dy / dist) * 1.8;
        }
      }
      p.x += p.vx; p.y += p.vy;
      // soft bounds
      if (p.x < 20) p.vx += 0.5; if (p.x > width - 20) p.vx -= 0.5;
      if (p.y < 20) p.vy += 0.5; if (p.y > height - 20) p.vy -= 0.5;
      sumStrain += p.strain;
      p.strain *= 0.85;
    }
    strainVar = sumStrain / particles.length;
  }

  function draw() {
    ctx.fillStyle = 'rgba(5,5,16,0.25)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = `hsla(${getComputedStyle(document.documentElement).getPropertyValue('--hue') || 220}, 60%, 55%, 0.35)`;
    ctx.lineWidth = 1;
    for (const s of springs) {
      const a = particles[s.a], b = particles[s.b];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const p of particles) {
      ctx.fillStyle = `hsla(${220 + p.strain * 40}, 70%, 60%, 0.8)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 6.28); ctx.fill();
    }
  }

  function updateAnchors() {
    for (const a of anchors) {
      const p = particles[a.pid];
      if (!p) continue;
      a.el.style.left = (p.x / dpr) + 'px';
      a.el.style.top = (p.y / dpr) + 'px';
      const s = Math.min(2, 0.8 + p.strain * 0.15);
      a.el.style.transform = `translate(-50%,-50%) scale(${s})`;
      a.el.classList.toggle('hot', p.strain > 8);
    }
  }

  function updateChrome() {
    const hue = 200 + residual * 80 + energy * 40;
    const blur = Math.min(4, residual * 2);
    const contrast = 1 + residual * 0.3;
    document.documentElement.style.setProperty('--hue', hue.toFixed(0));
    document.documentElement.style.setProperty('--blur', blur.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--contrast', contrast.toFixed(2));
  }

  function updateAudio() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    oscs.forEach((o, i) => {
      const f = 80 + residual * 120 + energy * 40 + i * 30;
      o.frequency.setTargetAtTime(f, t, 0.1);
      o.gain.setTargetAtTime(0.04 * (0.3 + residual), t, 0.15);
    });
  }

  // Worker mind
  function spawnWorker() {
    const code = `
      let w1, b1, w2, b2, H=10;
      function randn(){return (Math.random()-0.5)*0.2;}
      function init(){
        w1=new Float32Array(8*H); b1=new Float32Array(H);
        w2=new Float32Array(H*3); b2=new Float32Array(3);
        for(let i=0;i<w1.length;i++)w1[i]=randn();
        for(let i=0;i<b1.length;i++)b1[i]=randn()*0.05;
        for(let i=0;i<w2.length;i++)w2[i]=randn();
        for(let i=0;i<b2.length;i++)b2[i]=randn()*0.05;
      }
      function mlp(inp){
        const h=new Float32Array(H);
        for(let j=0;j<H;j++){let s=b1[j];for(let i=0;i<8;i++)s+=inp[i]*w1[i*H+j];h[j]=Math.tanh(s);}
        const o=[0,0,0];
        for(let k=0;k<3;k++){let s=b2[k];for(let j=0;j<H;j++)s+=h[j]*w2[j*3+k];o[k]=0.5+0.5*Math.tanh(s);}
        return o;
      }
      function mutate(){
        const i=Math.floor(Math.random()*w1.length); w1[i]+=randn()*0.05;
        const j=Math.floor(Math.random()*w2.length); w2[j]+=randn()*0.05;
      }
      init();
      let bestFitness=-1e9, best={k:0.18,d:0.82,rest:1};
      onmessage=e=>{
        const {spectral,tilt,residual,strain}=e.data;
        const inp=new Float32Array(8);
        for(let i=0;i<6;i++)inp[i]=spectral[i]||0;
        inp[6]=tilt.x; inp[7]=tilt.y;
        const pred=mlp(inp);
        const fit= -(Math.abs(pred[0]- (0.1+strain*0.01)) + Math.abs(pred[1]-0.8)) + (spectral[0]||0)*0.5;
        if(fit>bestFitness){bestFitness=fit; best={k:0.08+pred[0]*0.3, d:0.7+pred[1]*0.2, rest:0.85+pred[2]*0.3};}
        else mutate();
        postMessage({params:best, residual: Math.abs(fit), fitness:bestFitness});
      };
    `;
    const blob = new Blob([code], {type:'application/javascript'});
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = e => {
      params = { k: e.data.params.k, d: e.data.params.d, restScale: e.data.params.rest };
      residual = e.data.residual * 0.1;
    };
  }
  spawnWorker();

  function loop() {
    stepSoftbody();
    draw();
    updateAnchors();
    updateChrome();
    updateAudio();
    // send to worker occasionally
    if (Math.random() < 0.03 && worker) {
      worker.postMessage({ spectral, tilt, residual, strain: strainVar });
    }
    statusEl.textContent = `k:${params.k.toFixed(2)} d:${params.d.toFixed(2)} rs:${params.restScale.toFixed(2)} · res:${residual.toFixed(2)} · strain:${strainVar.toFixed(1)}`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Input
  canvas.addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight;
    pointer.vx = e.movementX * 0.01; pointer.vy = e.movementY * 0.01;
  });
  canvas.addEventListener('pointerdown', () => pointer.down = true);
  canvas.addEventListener('pointerup', () => pointer.down = false);

  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 90;
    tilt.y = (e.beta || 0) / 90;
  });

  // Mic
  document.getElementById('micBtn').onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      if (!audioCtx) audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function poll() {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < 8; i++) {
          spectral[i] = data[i*2] / 255;
          sum += spectral[i];
        }
        energy = sum / 8;
        requestAnimationFrame(poll);
      }
      poll();
      // generative oscs
      for (let i = 0; i < 3; i++) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = 100 + i*40;
        g.gain.value = 0.03;
        o.connect(g); g.connect(audioCtx.destination);
        o.start();
        oscs.push({ frequency: o.frequency, gain: g.gain });
      }
      statusEl.textContent = 'mic active';
    } catch (err) { statusEl.textContent = 'mic denied'; }
  };

  document.getElementById('evolveBtn').onclick = () => {
    if (worker) worker.postMessage({ spectral, tilt, residual: residual+0.5, strain: strainVar });
  };

  document.getElementById('sealBtn').onclick = async () => {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('f245', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('policy');
        r.onsuccess = () => res(r.result); r.onerror = rej;
      });
      const tx = db.transaction('policy', 'readwrite');
      tx.objectStore('policy').put({ w1: Array.from(w1), w2: Array.from(w2), params }, 'latest');
      sealed = true;
      statusEl.textContent = 'policy sealed';
    } catch(e) { statusEl.textContent = 'seal failed'; }
  };

  document.getElementById('resetBtn').onclick = () => {
    initSoftbody(); initMLP(); residual = 0; energy = 0;
  };

  // Progressive XR
  document.getElementById('xrBtn').onclick = async () => {
    if (!navigator.xr) { statusEl.textContent = 'no WebXR'; return; }
    try {
      xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
      statusEl.textContent = 'XR session (hand optional)';
      // minimal: session exists; full binding would query inputSources
    } catch (e) { statusEl.textContent = 'XR denied or unsupported'; }
  };
})();
