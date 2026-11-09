const $ = id => document.getElementById(id);
const KEY = 'verse-f635-teleprompter';
let playing = false, offset = 0, last = 0, raf;
const wordsPerLine = 10; // rough for WPM	o px

function save() {
  const data = { script: $('script').value, wpm: +$('wpm').value, font: +$('font').value, mirror: $('mirror').checked };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.debug("lab f635-teleprompter:", e); }
  setStatus('Saved on this device');
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      $('script').value = d.script || '';
      $('wpm').value = d.wpm || 140;
      $('font').value = d.font || 48;
      $('mirror').checked = !!d.mirror;
    }
  } catch (e) { console.debug("lab f635-teleprompter:", e); }
  if (location.hash.length > 1) {
    try {
      const d = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (d.script) $('script').value = d.script;
      if (d.wpm) $('wpm').value = d.wpm;
      if (d.font) $('font').value = d.font;
      if (d.mirror !== undefined) $('mirror').checked = d.mirror;
    } catch (e) { console.debug("lab f635-teleprompter:", e); }
  }
  updatePreview();
}
function updatePreview() {
  const text = $('script').value || 'Your script will appear here when you press Play.';
  $('scroll').textContent = text;
  $('scroll').style.fontSize = $('font').value + 'px';
  $('scroll').classList.toggle('mirror', $('mirror').checked);
  $('fontVal').textContent = $('font').value + 'px';
}
function speedPxPerMs() {
  const wpm = +$('wpm').value || 140;
  const font = +$('font').value || 48;
  // approximate: average 5 chars/word, line height ~1.4*font, words per line ~ (viewport width / (0.5*font))
  const charsPerWord = 5;
  const lineHeight = font * 1.4;
  const approxWordsPerLine = Math.max(4, Math.floor(window.innerWidth / (font * 0.55)));
  const linesPerMin = wpm / approxWordsPerLine;
  return (linesPerMin * lineHeight) / 60000; // px per ms
}
function tick(ts) {
  if (!playing) return;
  if (!last) last = ts;
  const dt = ts - last;
  last = ts;
  offset += speedPxPerMs() * dt;
  const h = $('scroll').scrollHeight;
  if (offset > h + 100) { stop(); return; }
  $('scroll').style.transform = `translateY(${-offset}px)` + ($('mirror').checked ? ' scaleX(-1)' : '');
  raf = requestAnimationFrame(tick);
}
function play() {
  if (playing) return;
  playing = true;
  last = 0;
  $('play').disabled = true;
  $('pause').disabled = false;
  updatePreview();
  raf = requestAnimationFrame(tick);
  setStatus('Playing');
}
function stop() {
  playing = false;
  cancelAnimationFrame(raf);
  $('play').disabled = false;
  $('pause').disabled = true;
  setStatus('Paused');
}
function resetOffset() { offset = 0; $('scroll').style.transform = ''; }

$('play').onclick = () => { if (!playing) { resetOffset(); play(); } else play(); };
$('pause').onclick = stop;
$('fs').onclick = () => {
  const v = $('viewport');
  if (!document.fullscreenElement) v.requestFullscreen?.() || v.classList.add('full');
  else document.exitFullscreen?.() || v.classList.remove('full');
};
$('script').oninput = () => { updatePreview(); save(); };
$('wpm').onchange = () => { updatePreview(); save(); };
$('font').oninput = () => { updatePreview(); save(); };
$('mirror').onchange = () => { updatePreview(); save(); };

$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('script').value); setStatus('Copied'); } catch { setStatus('Copy failed'); }
};
$('download').onclick = () => {
  const blob = new Blob([$('script').value], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'script.txt';
  a.click();
  setStatus('Downloaded');
};
$('share').onclick = () => {
  const data = { script: $('script').value, wpm: +$('wpm').value, font: +$('font').value, mirror: $('mirror').checked };
  const url = location.origin + location.pathname + '#' + encodeURIComponent(JSON.stringify(data));
  navigator.clipboard.writeText(url).then(() => setStatus('Share link copied')).catch(() => setStatus('Link ready: ' + url.slice(0,60) + '…'));
};
function setStatus(s) { $('status').textContent = s; setTimeout(() => { if ($('status').textContent === s) $('status').textContent = ''; }, 2500); }

load();
window.addEventListener('beforeunload', save);
