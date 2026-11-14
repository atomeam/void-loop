const $ = id => document.getElementById(id);
const scriptInput = $('scriptInput');
const scriptEl = $('script');
const prompter = $('prompter');
const playBtn = $('playBtn');
const fullBtn = $('fullBtn');
const speed = $('speed');
const size = $('size');
const mirror = $('mirror');
const voice = $('voice');
const status = $('status');
const speedVal = $('speedVal');
const sizeVal = $('sizeVal');

let playing = false;
let scrollY = 0;
let lastTime = 0;
let rafId = null;
let recognition = null;
let voiceActive = false;

const KEY = 'verse-f736-teleprompter';

function load() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const data = JSON.parse(saved);
      scriptInput.value = data.script || '';
      speed.value = data.speed || 60;
      size.value = data.size || 32;
      mirror.checked = !!data.mirror;
      voice.checked = !!data.voice;
    }
  } catch (e) { console.debug("lab f736-teleprompter:", e); }
  // URL hash
  if (location.hash.length > 1) {
    try {
      const text = decodeURIComponent(location.hash.slice(1));
      if (text.length > 10) scriptInput.value = text;
    } catch (e) { console.debug("lab f736-teleprompter:", e); }
  }
  updateUI();
}
function save() {
  const data = {
    script: scriptInput.value,
    speed: +speed.value,
    size: +size.value,
    mirror: mirror.checked,
    voice: voice.checked
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}
function updateUI() {
  speedVal.textContent = speed.value;
  sizeVal.textContent = size.value;
  scriptEl.style.fontSize = size.value + 'px';
  scriptEl.classList.toggle('mirror', mirror.checked);
  scriptEl.textContent = scriptInput.value || 'Paste a script and press Play';
}

function loop(ts) {
  if (!playing) return;
  if (!lastTime) lastTime = ts;
  const dt = (ts - lastTime) / 1000;
  lastTime = ts;
  // Approximate: speed is roughly px per second scaled
  const pxPerSec = (+speed.value) * 0.8;
  scrollY += pxPerSec * dt;
  scriptEl.style.transform = `translateY(${-scrollY}px)` + (mirror.checked ? ' scaleX(-1)' : '');
  if (scrollY > scriptEl.scrollHeight - window.innerHeight * 0.5) {
    // end
  }
  rafId = requestAnimationFrame(loop);
}

function startScroll() {
  playing = true;
  playBtn.textContent = 'Pause';
  status.textContent = voice.checked && voiceActive ? 'Listening…' : 'Scrolling';
  lastTime = 0;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}
function stopScroll() {
  playing = false;
  playBtn.textContent = 'Play';
  status.textContent = 'Paused';
  if (rafId) cancelAnimationFrame(rafId);
}

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    voice.disabled = true;
    return;
  }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onstart = () => { voiceActive = true; if (playing) startScroll(); };
  recognition.onend = () => { voiceActive = false; if (voice.checked && playing) stopScroll(); };
  recognition.onerror = () => { voiceActive = false; };
  recognition.onresult = () => { /* keep alive */ };
}

playBtn.onclick = () => {
  if (!scriptInput.value.trim()) return alert('Paste a script first');
  prompter.classList.add('active');
  document.getElementById('editor').style.display = 'none';
  updateUI();
  scrollY = 0;
  if (playing) {
    stopScroll();
    if (recognition) recognition.stop();
  } else {
    if (voice.checked && recognition) {
      try { recognition.start(); } catch (e) { startScroll(); }
    } else {
      startScroll();
    }
  }
  save();
};

fullBtn.onclick = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    document.body.classList.add('fullscreen');
  } else {
    document.exitFullscreen();
    document.body.classList.remove('fullscreen');
  }
};

$('copyBtn').onclick = () => {
  navigator.clipboard.writeText(scriptInput.value).then(() => {
    const orig = $('copyBtn').textContent;
    $('copyBtn').textContent = 'Copied';
    setTimeout(() => $('copyBtn').textContent = orig, 1200);
  });
};

speed.oninput = size.oninput = () => { updateUI(); save(); };
mirror.onchange = voice.onchange = () => { updateUI(); save(); };
scriptInput.oninput = () => { updateUI(); save(); };

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && document.activeElement !== scriptInput) {
    e.preventDefault();
    playBtn.click();
  }
});

// Scroll wheel scrub
prompter.addEventListener('wheel', e => {
  if (!playing) {
    scrollY = Math.max(0, scrollY + e.deltaY);
    scriptEl.style.transform = `translateY(${-scrollY}px)` + (mirror.checked ? ' scaleX(-1)' : '');
  }
}, { passive: true });

load();
initSpeech();
updateUI();
