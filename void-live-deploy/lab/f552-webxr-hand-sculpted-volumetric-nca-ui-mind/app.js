const status = document.getElementById('status');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const panelsContainer = document.getElementById('panels');

let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// 2D NCA proxy for volumetric concept (32x32 grid, upscaled)
const GS = 64;
let grid = new Float32Array(GS * GS);
let next = new Float32Array(GS * GS);

// Simple NCA: local activation diffusion + growth
function stepNCA() {
  for (let y = 1; y < GS-1; y++) {
    for (let x = 1; x < GS-1; x++) {
      let i = y * GS + x;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          sum += grid[(y+dy)*GS + (x+dx)];
      let avg = sum / 9;
      // Growth rule: boost mid-range, decay extremes
      let v = grid[i];
      next[i] = Math.max(0, Math.min(1, v * 0.7 + avg * 0.35 + (v > 0.3 && v < 0.7 ? 0.05 : -0.02)));
    }
  }
  [grid, next] = [next, grid];
}

// Inject activation
function inject(nx, ny, strength = 0.8) {
  const x = Math.floor(nx * GS);
  const y = Math.floor(ny * GS);
  if (x < 0 || x >= GS || y < 0 || y >= GS) return;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < GS && yy >= 0 && yy < GS)
        grid[yy * GS + xx] = Math.min(1, grid[yy * GS + xx] + strength * Math.exp(-(dx*dx+dy*dy)/4));
    }
}

// Find energy clusters (simple centroid of high cells)
function findClusters() {
  const clusters = [];
  const visited = new Uint8Array(GS * GS);
  for (let y = 0; y < GS; y++) {
    for (let x = 0; x < GS; x++) {
      const i = y * GS + x;
      if (grid[i] > 0.45 && !visited[i]) {
        let sx = 0, sy = 0, c = 0, e = 0;
        const stack = [[x, y]];
        visited[i] = 1;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          const ii = cy * GS + cx;
          sx += cx; sy += cy; c++; e += grid[ii];
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < GS && ny >= 0 && ny < GS) {
                const ni = ny * GS + nx;
                if (grid[ni] > 0.45 && !visited[ni]) {
                  visited[ni] = 1;
                  stack.push([nx, ny]);
                }
              }
            }
        }
        if (c > 8) clusters.push({ x: sx / c / GS, y: sy / c / GS, energy: e / c, size: c });
      }
    }
  }
  return clusters.slice(0, 6);
}

// UI panels driven by mind
const panelTemplates = [
  { title: 'Observe', body: 'Cluster density rising' },
  { title: 'Expand', body: 'Volume growth detected' },
  { title: 'Align', body: 'Structure coherence high' },
  { title: 'Seed', body: 'New injection locus' },
  { title: 'Orbit', body: 'Panel following energy' },
  { title: 'Hold', body: 'Stable pattern locked' }
];
const panels = [];
function ensurePanels(n) {
  while (panels.length < n) {
    const p = document.createElement('div');
    p.className = 'panel';
    const t = panelTemplates[panels.length % panelTemplates.length];
    p.innerHTML = `<h3>${t.title}</h3><p>${t.body}</p>`; // void-review: ok (constant labels, numbers or a hash only; no visitor text)
    panelsContainer.appendChild(p);
    panels.push(p);
  }
  while (panels.length > n) {
    panels.pop().remove();
  }
}

function updatePanels(clusters) {
  ensurePanels(Math.max(2, clusters.length));
  clusters.forEach((cl, i) => {
    if (!panels[i]) return;
    const px = cl.x * W;
    const py = cl.y * H;
    const scale = 0.8 + cl.energy * 0.6;
    panels[i].style.left = (px - 90) + 'px';
    panels[i].style.top = (py - 40) + 'px';
    panels[i].style.transform = `scale(${scale}) rotate(${(cl.x - 0.5) * 20}deg)`;
    panels[i].querySelector('p').textContent = `Energy ${cl.energy.toFixed(2)} · Size ${cl.size}`;
  });
}

// Pointer injection
let pointer = { x: 0.5, y: 0.5, down: false };
canvas.addEventListener('pointerdown', e => { pointer.down = true; pointer.x = e.clientX / W; pointer.y = e.clientY / H; });
canvas.addEventListener('pointermove', e => { if (pointer.down || e.buttons) { pointer.x = e.clientX / W; pointer.y = e.clientY / H; } });
canvas.addEventListener('pointerup', () => pointer.down = false);
canvas.addEventListener('pointerleave', () => pointer.down = false);

// WebXR optional
let xrSession = null;
const xrbtn = document.getElementById('xrbtn');
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (supported) xrbtn.style.display = 'block';
  });
  xrbtn.onclick = async () => {
    try {
      xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
      status.textContent = 'XR active · sculpt with hands';
      // In a full impl, bind to hand joints for inject positions
    } catch (e) { status.textContent = 'XR failed, using pointer'; }
  };
}

// Main loop
function frame() {
  if (pointer.down) inject(pointer.x, pointer.y, 0.6);
  // Soft decay
  for (let i = 0; i < grid.length; i++) grid[i] *= 0.995;
  stepNCA();

  // Render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / GS, cellH = H / GS;
  for (let y = 0; y < GS; y++) {
    for (let x = 0; x < GS; x++) {
      const v = grid[y * GS + x];
      if (v > 0.05) {
        const hue = 200 + v * 80;
        ctx.fillStyle = `hsla(${hue}, 70%, ${30 + v * 50}%, ${v})`;
        ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
      }
    }
  }

  const clusters = findClusters();
  updatePanels(clusters);
  status.textContent = `Clusters: ${clusters.length} · Sculpt with pointer or hands`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
status.textContent = 'Ready · click and drag to sculpt the mind';
