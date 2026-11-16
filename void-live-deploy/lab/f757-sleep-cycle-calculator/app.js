const $ = id => document.getElementById(id);
const KEY = 'verse-f757-sleep';
const CYCLE = 90; // minutes

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      document.querySelector(`input[name=mode][value=${s.mode}]`).checked = true;
      $('time').value = s.time || '07:00';
      $('latency').value = s.latency ?? 15;
      $('cycles').value = s.cycles ?? 6;
    }
    if (location.hash.length > 1) {
      const p = new URLSearchParams(location.hash.slice(1));
      if (p.has('mode')) document.querySelector(`input[name=mode][value=${p.get('mode')}]`).checked = true;
      if (p.has('time')) $('time').value = p.get('time');
      if (p.has('lat')) $('latency').value = p.get('lat');
      if (p.has('n')) $('cycles').value = p.get('n');
    }
  } catch (e) { console.debug("lab f757-sleep-cycle-calculator:", e); }
}

function save() {
  const s = {
    mode: document.querySelector('input[name=mode]:checked').value,
    time: $('time').value,
    latency: +$('latency').value,
    cycles: +$('cycles').value
  };
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(d) {
  return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function calculate() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  const base = parseTime($('time').value);
  const lat = +$('latency').value || 0;
  const n = Math.min(10, Math.max(1, +$('cycles').value || 6));
  const results = [];
  const ul = $('results');
  ul.innerHTML = '';

  if (mode === 'wake') {
    for (let c = n; c >= 1; c--) {
      const bed = new Date(base.getTime() - (c * CYCLE + lat) * 60000);
      results.push({label: `${c} cycle${c>1?'s':''} (${Math.floor((c*CYCLE)/60)}h ${ (c*CYCLE)%60 }m sleep)`, time: formatTime(bed), date: bed, kind: 'bed'});
    }
  } else {
    for (let c = 1; c <= n; c++) {
      const wake = new Date(base.getTime() + (lat + c * CYCLE) * 60000);
      results.push({label: `${c} cycle${c>1?'s':''} (${Math.floor((c*CYCLE)/60)}h ${ (c*CYCLE)%60 }m sleep)`, time: formatTime(wake), date: wake, kind: 'wake'});
    }
  }

  results.forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${r.time} — ${r.label}</span>${r.kind==='wake'?'<span class="badge">wake</span>':'<span class="badge">bed</span>'}`;
    ul.appendChild(li);
  });
  save();
  window._lastResults = results;
  return results;
}

function copyList() {
  const results = window._lastResults || calculate();
  const text = results.map(r => `${r.time} — ${r.label}`).join('\n');
  navigator.clipboard.writeText(text).then(() => alert('Copied'));
}

function makeICS() {
  const results = window._lastResults || calculate();
  const mode = document.querySelector('input[name=mode]:checked').value;
  let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Verse//Sleep Cycle//EN\n';
  results.forEach((r, i) => {
    const dt = r.date;
    const stamp = dt.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const summary = mode === 'wake' ? `Go to bed for ${r.label}` : `Wake up after ${r.label}`;
    ics += `BEGIN:VEVENT\nDTSTART:${stamp}\nSUMMARY:${summary}\nDESCRIPTION:Suggested by Verse sleep cycle calculator\nBEGIN:VALARM\nTRIGGER:-PT0M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT\n`;
  });
  ics += 'END:VCALENDAR';
  const blob = new Blob([ics], {type:'text/calendar'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sleep-cycle.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}

function shareLink() {
  const s = save();
  const hash = new URLSearchParams({mode:s.mode, time:s.time, lat:s.latency, n:s.cycles}).toString();
  const url = location.origin + location.pathname + '#' + hash;
  navigator.clipboard.writeText(url).then(() => alert('Share link copied'));
}

$('calc').onclick = calculate;
$('copy').onclick = copyList;
$('ics').onclick = makeICS;
$('share').onclick = shareLink;
document.querySelectorAll('input').forEach(el => el.onchange = calculate);

load();
calculate();
