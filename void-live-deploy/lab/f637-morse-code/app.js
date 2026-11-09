const MORSE = {
  'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---',
  'K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-',
  'U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-',',':'--..--','?':'..--..','\'':'.----.','!':'-.-.--','/':'-..-.','(':'-.--.',')':'-.--.-','&':'.-...',
  ':':'---...','=':'-...-','+':'.-.-.','-':'-....-','"':'.-..-.','@':'.--.-.', ' ':'/'
};
const REV = {};
for (const [k,v] of Object.entries(MORSE)) if (k !== ' ') REV[v] = k;

const $ = id => document.getElementById(id);
const textEl = $('text');
const morseOut = $('morseOut');
const light = $('light');
const speedEl = $('speed');
const speedVal = $('speedval');

let lastMorse = '';
let audioCtx;

function wpmToDit(wpm) { return 1200 / wpm; } // ms per dit at that WPM

function toMorse(str) {
  return str.toUpperCase().split('').map(ch => {
    if (ch === ' ') return '/';
    return MORSE[ch] || '?';
  }).join(' ').replace(/\s+\/\s+/g, ' / ').replace(/\s+/g, ' ').trim();
}

function toText(morse) {
  return morse.trim().split(/\s+/).map(tok => {
    if (tok === '/') return ' ';
    return REV[tok] || '?';
  }).join('');
}

function schedulePlay(morse, ditMs) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const dit = ditMs / 1000;
  const freq = 600;
  let t = audioCtx.currentTime + 0.05;
  const schedule = [];
  const tokens = morse.split(/\s+/);
  for (const tok of tokens) {
    if (tok === '/') { t += 4 * dit; continue; } // extra word gap
    for (const sym of tok) {
      const dur = sym === '.' ? dit : 3 * dit;
      schedule.push({ start: t, end: t + dur });
      t += dur + dit; // inter-symbol
    }
    t += 2 * dit; // letter gap (already has one dit)
  }
  // Audio
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.value = 0;
  osc.start(t - 10); // early
  osc.stop(schedule.length ? schedule[schedule.length-1].end + 0.2 : t + 1);
  for (const s of schedule) {
    gain.gain.setValueAtTime(0.3, s.start);
    gain.gain.setValueAtTime(0, s.end);
  }
  // Visual
  light.classList.remove('on');
  let vi = 0;
  function tick() {
    const now = audioCtx.currentTime;
    while (vi < schedule.length && now >= schedule[vi].end) vi++;
    const on = vi < schedule.length && now >= schedule[vi].start && now < schedule[vi].end;
    light.classList.toggle('on', on);
    if (now < (schedule.length ? schedule[schedule.length-1].end + 0.3 : t)) requestAnimationFrame(tick);
    else light.classList.remove('on');
  }
  requestAnimationFrame(tick);
}

function update() {
  const t = textEl.value;
  lastMorse = toMorse(t);
  morseOut.textContent = lastMorse || '—';
  localStorage.setItem('morse-last', t);
}

textEl.addEventListener('input', update);
speedEl.addEventListener('input', () => { speedVal.textContent = speedEl.value; });

$('toMorse').onclick = () => { update(); };
$('toText').onclick = () => {
  const m = morseOut.textContent.trim();
  if (m && m !== '—') {
    textEl.value = toText(m);
    update();
  }
};
$('play').onclick = () => {
  update();
  if (lastMorse) schedulePlay(lastMorse, wpmToDit(+speedEl.value));
};
$('copyText').onclick = async () => {
  try { await navigator.clipboard.writeText(textEl.value); } catch (e) { console.debug("lab f637-morse-code:", e); }
};
$('copyMorse').onclick = async () => {
  try { await navigator.clipboard.writeText(lastMorse); } catch (e) { console.debug("lab f637-morse-code:", e); }
};
$('share').onclick = async () => {
  const url = location.origin + location.pathname + '?m=' + encodeURIComponent(textEl.value);
  try { await navigator.clipboard.writeText(url); alert('Share link copied'); } catch(e) { prompt('Copy this link', url); }
};

// restore
const params = new URLSearchParams(location.search);
const fromUrl = params.get('m') || (location.hash ? decodeURIComponent(location.hash.slice(1)) : '');
const saved = localStorage.getItem('morse-last') || '';
textEl.value = fromUrl || saved;
update();
