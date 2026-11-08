const $ = id => document.getElementById(id);
const KEY = 'verse-f614-sleep';

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s.wake) $('wake').value = s.wake;
    if (s.cycles) $('cycles').value = s.cycles;
    if (s.buffer != null) $('buffer').value = s.buffer;
  } catch (e) { console.debug("lab f614-sleep-cycle-calculator:", e); }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify({
    wake: $('wake').value,
    cycles: $('cycles').value,
    buffer: $('buffer').value
  }));
}
function pad(n) { return n.toString().padStart(2, '0'); }
function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fromMin(m) {
  m = ((m % 1440) + 1440) % 1440;
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
}
function calc() {
  save();
  const wake = toMin($('wake').value);
  const n = +$('cycles').value;
  const buf = +$('buffer').value || 0;
  const cycle = 90;
  const beds = [];
  for (let c = n; c >= 4; c--) {
    const sleep = c * cycle + buf;
    const bed = wake - sleep;
    beds.push({ cycles: c, time: fromMin(bed), hours: (c * 90 / 60).toFixed(1) });
  }
  const uniq = [];
  const seen = new Set();
  for (const b of beds) {
    if (!seen.has(b.time)) { seen.add(b.time); uniq.push(b); }
  }
  uniq.sort((a,b) => toMin(b.time) - toMin(a.time));
  let html = '';
  uniq.forEach(b => {
    html += `<div class="bed">
      <div><strong>${b.time}</strong> <span class="small">(${b.cycles} cycles · ${b.hours} h sleep)</span></div>
      <div>
        <button class="copy" data-t="${b.time}">Copy</button>
        <button class="ics" data-t="${b.time}" data-w="${$('wake').value}">.ics</button>
      </div>
    </div>`;
  });
  $('out').innerHTML = html || '<p>Enter a valid time.</p>';
  $('out').querySelectorAll('.copy').forEach(btn => {
    btn.onclick = () => navigator.clipboard.writeText(btn.dataset.t).then(() => btn.textContent = 'Copied');
  });
  $('out').querySelectorAll('.ics').forEach(btn => {
    btn.onclick = () => downloadICS(btn.dataset.t, btn.dataset.w);
  });
}
function downloadICS(bed, wake) {
  const now = new Date();
  const [bh, bm] = bed.split(':').map(Number);
  const d = new Date(now);
  d.setHours(bh, bm, 0, 0);
  if (d < now) d.setDate(d.getDate() + 1);
  const stamp = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(d.getTime() + 15 * 60000);
  const estamp = end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Verse//Sleep Cycle//EN
BEGIN:VEVENT
UID:sleep-${Date.now()}@verse
DTSTAMP:${stamp}
DTSTART:${stamp}
DTEND:${estamp}
SUMMARY:Bedtime for ${wake} wake-up
DESCRIPTION:Suggested bedtime based on 90-minute cycles. Set alarm or reminder.
END:VEVENT
END:VCALENDAR`;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bedtime-${bed.replace(':','')}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}
$('calc').onclick = calc;
load();
calc();
