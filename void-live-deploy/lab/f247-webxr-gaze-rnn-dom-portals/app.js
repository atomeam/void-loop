(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const portalsEl = document.getElementById('portals');
  let width, height;
  let gaze = { x: 0.5, y: 0.5, vx: 0, vy: 0, dwell: 0 };
  let tilt = { x: 0, y: 0 };
  let portals = [];
  let worker = null;
  let bc = null;
  let xrSession = null;
  let frame = 0;
  let bestFitness = 0;
  let champWeights = null;

  function randn() { return (Math.random() - 0.5) * 0.3; }

  function resize() {
    width = canvas.width = innerWidth;
    height = canvas.height = innerHeight;
  }
  addEventListener('resize', resize); resize();

  function createPortals(n = 7) {
    portalsEl.innerHTML = '';
    portals = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'portal';
      el.textContent = 'P' + i;
      portalsEl.appendChild(el);
      portals.push({
        el, x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.6,
        vx: 0, vy: 0, score: 0, active: 0
      });
    }
  }
  createPortals();

  function spawnWorker() {
    const code = `
      let h = 0;
      let wIn = new Float32Array(5 * 6), wH = new Float32Array(6), wOut = new Float32Array(6 * 3);
      function init() {
        for (let i = 0; i < wIn.length; i++) wIn[i] = (Math.random()-0.5)*0.4;
        for (let i = 0; i < wH.length; i++) wH[i] = (Math.random()-0.5)*0.2;
        for (let i = 0; i < wOut.length; i++) wOut[i] = (Math.random()-0.5)*0.3;
        h = 0;
      }
      function rnn(inp) {
        let newH = 0;
        for (let j = 0; j < 6; j++) {
          let s = wH[j] * h;
          for (let i = 0; i < 5; i++) s += inp[i] * wIn[i*6 + j];
          newH += Math.tanh(s);
        }
        h = newH / 6;
        const o = [0,0,0];
        for (let k = 0; k < 3; k++) {
          let s = 0;
          for (let j = 0; j < 6; j++) s += h * wOut[j*3 + k];
          o[k] = Math.tanh(s);
        }
        return o;
      }
      function mutate() {
        const i = Math.floor(Math.random()*wIn.length); wIn[i] += (Math.random()-0.5)*0.05;
        const j = Math.floor(Math.random()*wOut.length); wOut[j] += (Math.random()-0.5)*0.05;
      }
      init();
      let best = -1e9, bestW = null;
      onmessage = e => {
        if (e.data.inject) {
          wIn.set(e.data.wIn); wOut.set(e.data.wOut); h = e.data.h || 0;
          best = -1e9;
          return;
        }
        const inp = e.data.inp;
        const o = rnn(inp);
        const fit = e.data.score || 0;
        if (fit > best) { best = fit; bestW = { wIn: Array.from(wIn), wOut: Array.from(wOut), h }; }
        else mutate();
        postMessage({ out: o, fitness: best, weights: bestW });
      };
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = e => {
      const { out, fitness, weights } = e.data;
      if (fitness > bestFitness) {
        bestFitness = fitness;
        champWeights = weights;
      }
      portals.forEach((p, i) => {
        const attr = out[0] * 0.02;
        const dx = gaze.x - p.x, dy = gaze.y - p.y;
        p.vx += dx * attr;
        p.vy += dy * attr;
        p.vx *= 0.92; p.vy *= 0.92;
        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(0.05, Math.min(0.95, p.x));
        p.y = Math.max(0.05, Math.min(0.95, p.y));
        p.active = Math.max(0, out[2]);
        p.el.style.left = (p.x * innerWidth) + 'px';
        p.el.style.top = (p.y * innerHeight) + 'px';
        const s = 0.7 + Math.abs(out[1]) * 0.6;
        p.el.style.transform = `translate(-50%,-50%) scale(${s})`;
        p.el.style.opacity = 0.6 + p.active * 0.4;
        p.el.classList.toggle('active', p.active > 0.4);
      });
    };
  }
  spawnWorker();

  function updateGaze() {
    gaze.vx = (gaze.x - (gaze._px || gaze.x));
    gaze.vy = (gaze.y - (gaze._py || gaze.y));
    gaze._px = gaze.x; gaze._py = gaze.y;
  }

  function step() {
    updateGaze();
    let totalScore = 0;
    portals.forEach(p => {
      const dx = gaze.x - p.x, dy = gaze.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 0.12) {
        p.score += 1;
        gaze.dwell += 0.05;
      } else {
        p.score *= 0.995;
      }
      totalScore += p.score;
    });
    gaze.dwell *= 0.98;
    if (worker && frame % 5 === 0) {
      const inp = [gaze.x - 0.5, gaze.y - 0.5, gaze.vx * 10, gaze.vy * 10, gaze.dwell];
      worker.postMessage({ inp, score: totalScore });
    }
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(167,127,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(gaze.x * width, gaze.y * height);
    ctx.lineTo(gaze.x * width + gaze.vx * 200, gaze.y * height + gaze.vy * 200);
    ctx.stroke();
    statusEl.textContent = `dwell:${gaze.dwell.toFixed(1)} score:${totalScore.toFixed(0)} fit:${bestFitness.toFixed(0)} · ${xrSession ? 'XR' : 'flat'}`;
    frame++;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  addEventListener('pointermove', e => {
    gaze.x = e.clientX / innerWidth;
    gaze.y = e.clientY / innerHeight;
  });
  addEventListener('deviceorientation', e => {
    if (!xrSession) {
      gaze.x = 0.5 + (e.gamma || 0) / 180;
      gaze.y = 0.5 + (e.beta || 0) / 180;
    }
  });

  document.getElementById('xrBtn').onclick = async () => {
    if (!navigator.xr) { statusEl.textContent = 'no WebXR'; return; }
    try {
      xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      statusEl.textContent = 'XR gaze active';
    } catch (e) { statusEl.textContent = 'XR denied or unsupported'; }
  };

  document.getElementById('sealBtn').onclick = async () => {
    if (!champWeights) return;
    try {
      const data = JSON.stringify(champWeights);
      const buf = new TextEncoder().encode(data);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('f247', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('champ');
        r.onsuccess = () => res(r.result); r.onerror = rej;
      });
      const tx = db.transaction('champ', 'readwrite');
      tx.objectStore('champ').put({ weights: champWeights, hash: hex }, 'latest');
      statusEl.textContent = 'sealed ' + hex.slice(0, 8);
    } catch (e) { statusEl.textContent = 'seal failed'; }
  };

  document.getElementById('transferBtn').onclick = () => {
    if (!bc) bc = new BroadcastChannel('F247-genomes');
    if (champWeights) {
      bc.postMessage({ type: 'genome', weights: champWeights });
      statusEl.textContent = 'genome offered';
    }
  };

  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('F247-genomes');
    bc.onmessage = e => {
      if (e.data.type === 'genome' && e.data.weights && worker) {
        worker.postMessage({ inject: true, ...e.data.weights });
        statusEl.textContent = 'genome injected';
      }
    };
  }

  document.getElementById('resetBtn').onclick = () => {
    createPortals();
    gaze.dwell = 0;
    bestFitness = 0;
  };
})();
