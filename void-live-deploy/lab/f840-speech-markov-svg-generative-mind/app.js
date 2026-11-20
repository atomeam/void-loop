const svg = document.getElementById('canvas');
const status = document.getElementById('status');
const typeInput = document.getElementById('type');
let recognition = null;
let model = {}; // char -> {next: weight}
let streams = [];
let bias = {x: 0, y: 0};
let lastPointer = {x: 0, y: 0};

function loadModel() {
  try {
    const saved = localStorage.getItem('f840-markov');
    if (saved) model = JSON.parse(saved);
  } catch (e) { console.debug("lab f840-speech-markov-svg-generative-mind:", e); }
  if (Object.keys(model).length === 0) {
    // seed with simple defaults
    const seed = "mind flow verse spatial thought generative";
    for (let i = 0; i < seed.length - 1; i++) {
      addTransition(seed[i], seed[i+1], 1);
    }
  }
}
function saveModel() {
  try { localStorage.setItem('f840-markov', JSON.stringify(model)); status.textContent = "Model sealed."; } catch(e) { status.textContent = "Seal failed (storage blocked)."; }
}
function addTransition(from, to, w=1) {
  if (!model[from]) model[from] = {};
  model[from][to] = (model[from][to] || 0) + w;
}
function sampleNext(from) {
  const nexts = model[from] || model[' '] || {'a':1,'e':1,'i':1,'o':1,' ':1};
  const keys = Object.keys(nexts);
  let total = 0;
  keys.forEach(k => total += nexts[k]);
  let r = Math.random() * total;
  for (const k of keys) {
    r -= nexts[k];
    if (r <= 0) return k;
  }
  return keys[0] || ' ';
}
function createStream(seedChar = 'm') {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', `hsl(${Math.random()*360},70%,60%)`);
  path.setAttribute('stroke-width', '2');
  path.classList.add('stream');
  path.style.pointerEvents = 'stroke';
  svg.appendChild(path);
  const stream = {path, points: [{x: 200 + Math.random()*400, y: 200 + Math.random()*300}], current: seedChar, age: 0};
  path.addEventListener('click', () => reward(stream));
  streams.push(stream);
  return stream;
}
function reward(stream) {
  // strengthen recent transitions
  if (stream.history && stream.history.length > 1) {
    for (let i = 0; i < stream.history.length - 1; i++) {
      addTransition(stream.history[i], stream.history[i+1], 2);
    }
  }
  stream.path.setAttribute('stroke-width', '4');
  setTimeout(() => stream.path.setAttribute('stroke-width', '2'), 400);
  status.textContent = "Rewarded! Transitions strengthened.";
}
function updateStreams() {
  streams.forEach(s => {
    s.age++;
    if (s.age > 800) { // recycle long streams
      s.points = [s.points[s.points.length-1]];
      s.age = 0;
      s.history = [];
    }
    const next = sampleNext(s.current);
    s.current = next;
    if (!s.history) s.history = [];
    s.history.push(next);
    if (s.history.length > 20) s.history.shift();
    const last = s.points[s.points.length-1];
    const dir = (next.charCodeAt(0) % 8) * Math.PI / 4;
    const speed = 4 + (next === ' ' ? 2 : 0);
    const nx = last.x + Math.cos(dir + bias.x) * speed + bias.x * 2;
    const ny = last.y + Math.sin(dir + bias.y) * speed + bias.y * 2;
    // clamp
    const x = Math.max(20, Math.min(window.innerWidth-20, nx));
    const y = Math.max(20, Math.min(window.innerHeight-20, ny));
    s.points.push({x, y});
    if (s.points.length > 60) s.points.shift();
    // build path d
    let d = `M ${s.points[0].x} ${s.points[0].y}`;
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i];
      d += ` L ${p.x} ${p.y}`;
    }
    s.path.setAttribute('d', d);
  });
  // spawn new occasionally
  if (streams.length < 5 && Math.random() < 0.02) createStream();
}
function seedFromText(text) {
  const clean = text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  for (let i = 0; i < clean.length - 1; i++) addTransition(clean[i], clean[i+1], 1.5);
  createStream(clean[0] || 'm');
  status.textContent = `Seeded with "${text.slice(0,20)}"`;
}
// Speech
function startListen() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) { status.textContent = "Speech not supported; use text input."; return; }
  recognition = new SpeechRec();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (e) => {
    let transcript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) transcript += e.results[i][0].transcript + ' ';
    }
    if (transcript.trim()) seedFromText(transcript.trim());
  };
  recognition.onerror = () => status.textContent = "Speech error; use text.";
  recognition.start();
  status.textContent = "Listening…";
}
document.getElementById('listen').onclick = startListen;
typeInput.onkeydown = (e) => {
  if (e.key === 'Enter' && typeInput.value.trim()) {
    seedFromText(typeInput.value.trim());
    typeInput.value = '';
  }
};
document.getElementById('seal').onclick = saveModel;
document.getElementById('download').onclick = () => {
  const data = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([data], {type: 'image/svg+xml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'verse-thought-sketch.svg';
  a.click();
};
// Pointer / orientation bias
window.addEventListener('pointermove', (e) => {
  bias.x = (e.clientX - lastPointer.x) * 0.05;
  bias.y = (e.clientY - lastPointer.y) * 0.05;
  lastPointer = {x: e.clientX, y: e.clientY};
  bias.x = Math.max(-1, Math.min(1, bias.x));
  bias.y = Math.max(-1, Math.min(1, bias.y));
});
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta != null) bias.y = (e.beta - 45) / 90;
    if (e.gamma != null) bias.x = e.gamma / 90;
  });
}
// Init
loadModel();
createStream();
createStream();
setInterval(updateStreams, 50);
window.addEventListener('resize', () => {
  svg.setAttribute('width', window.innerWidth);
  svg.setAttribute('height', window.innerHeight);
});
svg.setAttribute('width', window.innerWidth);
svg.setAttribute('height', window.innerHeight);
