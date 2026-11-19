const stage = document.getElementById('stage');
const armsInput = document.getElementById('arms');
const colorInput = document.getElementById('color');
const status = document.getElementById('status');
let arms = [];
let orientation = {beta:0, gamma:0};
let pointer = {x:0, y:0, vx:0, vy:0};

// Tiny RBF: 4 centers, 2 outputs (angle offset, length scale)
const centers = [
  [0,0,0.5,0.5], [10,10,0.3,0.7], [-10,5,0.7,0.3], [5,-10,0.4,0.6]
];
let weights = [0.2,0.1, -0.1,0.15, 0.05,-0.2, 0.1,0.05]; // 4 centers * 2 outs

function rbf(input) {
  let out = [0,0];
  for(let i=0; i<4; i++) {
    const d = Math.hypot(...input.map((v,j)=>v-centers[i][j]));
    const k = Math.exp(-d*d/50);
    out[0] += weights[i*2] * k;
    out[1] += weights[i*2+1] * k;
  }
  return out;
}

function adapt(input, target) {
  const pred = rbf(input);
  const err = [target[0]-pred[0], target[1]-pred[1]];
  for(let i=0; i<4; i++) {
    const d = Math.hypot(...input.map((v,j)=>v-centers[i][j]));
    const k = Math.exp(-d*d/50);
    weights[i*2] += 0.05 * err[0] * k;
    weights[i*2+1] += 0.05 * err[1] * k;
  }
}

function buildArms(n) {
  stage.innerHTML = '';
  arms = [];
  for(let i=0; i<n; i++) {
    const arm = document.createElement('div');
    arm.className = 'arm';
    arm.style.background = colorInput.value;
    const node = document.createElement('div');
    node.className = 'node';
    node.style.background = colorInput.value;
    arm.appendChild(node);
    stage.appendChild(arm);
    arms.push({el:arm, node, angle: (i/n)*360, len:100 + Math.random()*40, ox:0, oy:0});
    node.addEventListener('pointerdown', e => {
      e.target.setPointerCapture(e.pointerId);
      e.target.dataset.dragging = '1';
    });
  }
}

function update() {
  const input = [orientation.beta/20, orientation.gamma/20, pointer.x, pointer.y];
  const [da, dl] = rbf(input);
  arms.forEach((a,i) => {
    const base = (i / arms.length) * 360;
    const ang = base + da*40 + a.ox;
    const len = Math.max(60, a.len + dl*30);
    a.el.style.height = len + 'px';
    a.el.style.transform = `rotate(${ang}deg) translateY(-${len/2}px)`;
    a.el.style.background = colorInput.value;
    a.node.style.background = colorInput.value;
  });
  requestAnimationFrame(update);
}

window.addEventListener('deviceorientation', e => {
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
  status.textContent = `Tilt β:${orientation.beta.toFixed(0)} γ:${orientation.gamma.toFixed(0)}`;
});

stage.addEventListener('pointermove', e => {
  const rect = stage.getBoundingClientRect();
  pointer.x = (e.clientX - rect.left)/rect.width;
  pointer.y = (e.clientY - rect.top)/rect.height;
  pointer.vx = e.movementX || 0;
  pointer.vy = e.movementY || 0;
});

document.addEventListener('pointerup', e => {
  document.querySelectorAll('[data-dragging]').forEach(n => delete n.dataset.dragging);
});

// Drag adaptation
stage.addEventListener('pointermove', e => {
  if (e.target.classList.contains('node') && e.target.dataset.dragging) {
    const input = [orientation.beta/20, orientation.gamma/20, pointer.x, pointer.y];
    const target = [e.movementX/10, e.movementY/5];
    adapt(input, target);
  }
});

armsInput.oninput = () => buildArms(+armsInput.value);
colorInput.oninput = update;

document.getElementById('seal').onclick = () => {
  const data = {weights, centers, arms: arms.length, color: colorInput.value};
  localStorage.setItem('f785-kinetic-mobile', JSON.stringify(data));
  status.textContent = 'Design sealed to device.';
};

document.getElementById('downloadCss').onclick = () => {
  let css = `/* Kinetic Mobile CSS */\n#stage { perspective:800px; }\n`;
  arms.forEach((a,i) => {
    css += `.arm-${i} { height:${a.el.style.height}; transform:${a.el.style.transform}; background:${colorInput.value}; }\n`;
  });
  const blob = new Blob([css], {type:'text/css'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kinetic-mobile.css';
  a.click();
};

document.getElementById('downloadPng').onclick = () => {
  const canvas = document.createElement('canvas');
  canvas.width = stage.clientWidth;
  canvas.height = stage.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = colorInput.value;
  ctx.font = '16px sans-serif';
  ctx.fillText('Kinetic Mobile Snapshot (use screen capture for full)', 20, 40);
  arms.forEach((a,i) => {
    ctx.beginPath();
    ctx.arc(canvas.width/2 + Math.cos(i)*100, canvas.height/2 + Math.sin(i)*80, 20, 0, Math.PI*2);
    ctx.fill();
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'kinetic-mobile.png';
  a.click();
};

document.getElementById('copyCss').onclick = () => {
  let css = `/* sealed kinetic mobile */\n`;
  arms.forEach((a,i) => css += `.arm-${i}{transform:${a.el.style.transform};}\n`);
  navigator.clipboard.writeText(css).then(() => status.textContent = 'CSS copied.');
};

// Load sealed
try {
  const saved = JSON.parse(localStorage.getItem('f785-kinetic-mobile') || 'null');
  if (saved) {
    weights = saved.weights || weights;
    armsInput.value = saved.arms || 5;
    colorInput.value = saved.color || '#4488ff';
  }
} catch (e) { console.debug("lab f785-orientation-rbf-kinetic-mobile-designer:", e); }

buildArms(+armsInput.value);
update();
status.textContent = 'Ready. Tilt device or drag nodes. Design sealed offline.';
