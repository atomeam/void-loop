(function () {
  const STORAGE_KEY = 'verse-f749-chore-rota';
  let people = [];
  let lastSchedule = null;
  let lastMeta = null;

  const peopleChips = document.getElementById('peopleChips');
  const choresEl = document.getElementById('chores');
  const resultsEl = document.getElementById('results');
  const startDateInput = document.getElementById('startDate');

  const today = new Date();
  startDateInput.value = today.toISOString().slice(0, 10);

  function renderPeople() {
    peopleChips.innerHTML = '';
    people.forEach((name, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${escapeHtml(name)} <button type="button" aria-label="Remove">×</button>`;
      chip.querySelector('button').onclick = () => {
        people.splice(i, 1);
        renderPeople();
      };
      peopleChips.appendChild(chip);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function addChoreRow(data = { name: '', freq: 'weekly', every: 1 }) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <button type="button" class="remove" aria-label="Remove">×</button>
      <div class="row2">
        <div>
          <label>Chore</label>
          <input type="text" class="c-name" placeholder="Kitchen clean" value="${escapeHtml(data.name)}" maxlength="60">
        </div>
        <div>
          <label>Frequency</label>
          <select class="c-freq">
            <option value="daily" ${data.freq==='daily'?'selected':''}>Daily</option>
            <option value="every" ${data.freq==='every'?'selected':''}>Every N days</option>
            <option value="weekly" ${data.freq==='weekly'?'selected':''}>Weekly</option>
          </select>
        </div>
      </div>
      <div class="every-wrap" style="${data.freq==='every'?'':'display:none'}">
        <label>Every how many days?</label>
        <input type="number" class="c-every" min="1" max="30" value="${data.every || 2}">
      </div>
    `;
    div.querySelector('.remove').onclick = () => div.remove();
    const freqSel = div.querySelector('.c-freq');
    const everyWrap = div.querySelector('.every-wrap');
    freqSel.onchange = () => {
      everyWrap.style.display = freqSel.value === 'every' ? '' : 'none';
    };
    choresEl.appendChild(div);
  }

  function readChores() {
    const list = [];
    choresEl.querySelectorAll('.item').forEach(el => {
      const name = el.querySelector('.c-name').value.trim();
      const freq = el.querySelector('.c-freq').value;
      const every = parseInt(el.querySelector('.c-every').value, 10) || 2;
      if (name) list.push({ name, freq, every: Math.max(1, every) });
    });
    return list;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function formatDate(d) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function generate() {
    if (people.length === 0) {
      alert('Add at least one person.');
      return;
    }
    const chores = readChores();
    if (chores.length === 0) {
      alert('Add at least one chore.');
      return;
    }
    const start = new Date(startDateInput.value + 'T12:00:00');
    if (isNaN(start.getTime())) {
      alert('Pick a valid start date.');
      return;
    }
    const weeks = Math.min(12, Math.max(1, parseInt(document.getElementById('weeks').value, 10) || 4));
    const totalDays = weeks * 7;
    const end = addDays(start, totalDays - 1);

    const rr = {};
    chores.forEach(c => { rr[c.name] = 0; });

    const schedule = [];
    for (let day = 0; day < totalDays; day++) {
      const date = addDays(start, day);

      chores.forEach(chore => {
        let due = false;
        if (chore.freq === 'daily') due = true;
        else if (chore.freq === 'every') due = (day % chore.every) === 0;
        else if (chore.freq === 'weekly') due = (day % 7) === 0;

        if (due) {
          const person = people[rr[chore.name] % people.length];
          rr[chore.name]++;
          schedule.push({
            date,
            dateStr: isoDate(date),
            chore: chore.name,
            person
          });
        }
      });
    }

    schedule.sort((a, b) => a.date - b.date || a.chore.localeCompare(b.chore));

    lastSchedule = schedule;
    lastMeta = { people: people.slice(), chores, start: isoDate(start), weeks, end: isoDate(end) };
    renderResults(schedule, lastMeta);
    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResults(schedule, meta) {
    const counts = {};
    people.forEach(p => counts[p] = 0);
    schedule.forEach(row => { counts[row.person] = (counts[row.person] || 0) + 1; });

    const sum = document.getElementById('summary');
    sum.innerHTML = `
      <div class="stat">
        <div class="label">Period</div>
        <div class="value" style="font-size:0.95rem">${meta.start} → ${meta.end}</div>
      </div>
      <div class="stat">
        <div class="label">Assignments</div>
        <div class="value">${schedule.length}</div>
      </div>
      ${people.map(p => `
        <div class="stat">
          <div class="label">${escapeHtml(p)}</div>
          <div class="value">${counts[p] || 0}</div>
        </div>
      `).join('')}
    `;

    const body = document.getElementById('scheduleBody');
    body.innerHTML = '';
    let lastDate = '';
    schedule.forEach(row => {
      if (row.dateStr !== lastDate) {
        const trh = document.createElement('tr');
        trh.className = 'day-header';
        trh.innerHTML = `<td colspan="3">${formatDate(row.date)}</td>`;
        body.appendChild(trh);
        lastDate = row.dateStr;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.dateStr}</td>
        <td>${escapeHtml(row.chore)}</td>
        <td>${escapeHtml(row.person)}</td>
      `;
      body.appendChild(tr);
    });
  }

  function downloadCsv() {
    if (!lastSchedule) return;
    const lines = ['Date,Chore,Person'];
    lastSchedule.forEach(r => {
      lines.push([r.dateStr, `"${r.chore.replace(/"/g,'""')}"`, `"${r.person.replace(/"/g,'""')}"`].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chore-rota-${lastMeta.start}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadIcs() {
    if (!lastSchedule) return;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Verse//Chore Rota F749//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    lastSchedule.forEach((r, i) => {
      const dt = r.dateStr.replace(/-/g, '');
      const uid = `f749-${dt}-${i}@verse.local`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dt}T000000Z`);
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`SUMMARY:${r.chore} — ${r.person}`);
      lines.push(`DESCRIPTION:Chore rota (Verse F749)`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chore-rota-${lastMeta.start}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyText() {
    if (!lastSchedule || !lastMeta) return;
    const counts = {};
    people.forEach(p => counts[p] = 0);
    lastSchedule.forEach(r => counts[r.person]++);
    const lines = [
      `Chore rota ${lastMeta.start} → ${lastMeta.end}`,
      `People: ${people.join(', ')}`,
      ...people.map(p => `  ${p}: ${counts[p]} tasks`),
      '',
      ...lastSchedule.map(r => `${r.dateStr}  ${r.chore}  →  ${r.person}`)
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      const btn = document.getElementById('copyText');
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = old, 1400);
    }).catch(() => alert('Could not copy'));
  }

  function savePlan() {
    const data = {
      people,
      chores: readChores(),
      start: startDateInput.value,
      weeks: document.getElementById('weeks').value,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const btn = document.getElementById('savePlan');
      const old = btn.textContent;
      btn.textContent = 'Saved';
      setTimeout(() => btn.textContent = old, 1400);
    } catch (e) {
      alert('Could not save');
    }
  }

  function loadPlan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (Array.isArray(data.people) && data.people.length) {
        people = data.people;
        renderPeople();
      }
      if (Array.isArray(data.chores) && data.chores.length) {
        choresEl.innerHTML = '';
        data.chores.forEach(c => addChoreRow(c));
      }
      if (data.start) startDateInput.value = data.start;
      if (data.weeks) document.getElementById('weeks').value = data.weeks;
      return true;
    } catch (e) { return false; }
  }

  document.getElementById('addPerson').onclick = () => {
    const input = document.getElementById('personInput');
    const name = input.value.trim();
    if (!name) return;
    if (people.includes(name)) {
      input.value = '';
      return;
    }
    people.push(name);
    input.value = '';
    renderPeople();
    input.focus();
  };
  document.getElementById('personInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addPerson').click();
  });
  document.getElementById('addChore').onclick = () => addChoreRow();
  document.getElementById('generate').onclick = generate;
  document.getElementById('downloadCsv').onclick = downloadCsv;
  document.getElementById('downloadIcs').onclick = downloadIcs;
  document.getElementById('copyText').onclick = copyText;
  document.getElementById('savePlan').onclick = savePlan;

  if (!loadPlan()) {
    people = ['Alex', 'Sam'];
    renderPeople();
    addChoreRow({ name: 'Kitchen surfaces', freq: 'daily' });
    addChoreRow({ name: 'Bathroom clean', freq: 'every', every: 3 });
    addChoreRow({ name: 'Vacuum living room', freq: 'weekly' });
    addChoreRow({ name: 'Take out bins', freq: 'weekly' });
  }
})();
