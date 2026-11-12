const $ = id => document.getElementById(id);
const KEY = 'verse-f699-meeting';

let startTime = null;
let elapsed = 0;
let timer = null;
let running = false;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      $('attendees').value = d.attendees || 6;
      $('rate').value = d.rate || 80;
      $('minutes').value = d.minutes || 30;
    }
  } catch (e) { console.debug("lab f699-meeting-cost-calculator:", e); }
  update();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      attendees: +$('attendees').value,
      rate: +$('rate').value,
      minutes: +$('minutes').value
    }));
  } catch (e) {
    $('note').textContent = 'Saving may not persist in this browser mode.';
  }
}

function formatMoney(n) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function update() {
  const a = Math.max(1, Math.min(50, +$('attendees').value || 1));
  const r = Math.max(0, +$('rate').value || 0);
  const m = Math.max(1, +$('minutes').value || 1);
  const hours = m / 60;
  const total = a * r * hours;
  const per = total / m;

  $('total').textContent = formatMoney(total);
  $('per').textContent = formatMoney(per) + ' per minute';

  const people = $('people');
  people.innerHTML = '';
  for (let i = 0; i < a; i++) {
    const p = document.createElement('div');
    p.className = 'person';
    people.appendChild(p);
  }

  if (running) {
    const secs = elapsed;
    const runCost = a * r * (secs / 3600);
    $('total').textContent = formatMoney(runCost) + ' so far';
    const pct = Math.min(100, (secs / 60) / m * 100);
    $('progress').style.width = pct + '%';
    $('status').textContent = `Running · ${Math.floor(secs/60)}m ${Math.floor(secs%60)}s`;
  } else {
    $('progress').style.width = '0%';
    $('status').textContent = 'Ready';
  }
  save();
}

function tick() {
  if (!running || !startTime) return;
  elapsed = (Date.now() - startTime) / 1000;
  update();
}

$('attendees').oninput = update;
$('rate').oninput = update;
$('minutes').oninput = update;

$('start').onclick = () => {
  if (running) return;
  running = true;
  startTime = Date.now() - elapsed * 1000;
  $('start').disabled = true;
  $('stop').disabled = false;
  timer = setInterval(tick, 250);
  update();
};

$('stop').onclick = () => {
  running = false;
  clearInterval(timer);
  $('start').disabled = false;
  $('stop').disabled = true;
  update();
};

$('reset').onclick = () => {
  running = false;
  clearInterval(timer);
  elapsed = 0;
  startTime = null;
  $('start').disabled = false;
  $('stop').disabled = true;
  update();
};

function summary() {
  const a = +$('attendees').value;
  const r = +$('rate').value;
  const m = +$('minutes').value;
  const total = a * r * (m / 60);
  const per = total / m;
  let text = `Meeting cost calculator\n`;
  text += `${a} people × ${formatMoney(r)}/hr × ${m} min\n`;
  text += `Planned total: ${formatMoney(total)} (${formatMoney(per)} per minute)\n`;
  if (elapsed > 0) {
    const run = a * r * (elapsed / 3600);
    text += `Elapsed so far: ${Math.floor(elapsed/60)}m ${Math.floor(elapsed%60)}s → ${formatMoney(run)}\n`;
  }
  text += `\nGenerated on this device.`;
  return text;
}

$('copy').onclick = async () => {
  const t = summary();
  try {
    await navigator.clipboard.writeText(t);
    $('copy').textContent = 'Copied!';
    setTimeout(() => $('copy').textContent = 'Copy summary', 1500);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    $('copy').textContent = 'Copied!';
    setTimeout(() => $('copy').textContent = 'Copy summary', 1500);
  }
};

$('download').onclick = () => {
  const blob = new Blob([summary()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'meeting-cost.txt';
  a.click();
  URL.revokeObjectURL(a.href);
};

load();
window.addEventListener('beforeunload', save);
