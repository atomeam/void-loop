let players = [];
let rounds = []; // array of {label, scores: {playerId: number}}
let nextId = 1;

function load() {
  try {
    const raw = localStorage.getItem('scoreboard-f796');
    if (raw) {
      const data = JSON.parse(raw);
      players = data.players || [];
      rounds = data.rounds || [];
      nextId = data.nextId || 1;
    }
  } catch (e) { console.debug("lab f796-scoreboard-any-game:", e); }
  // also check URL hash
  if (location.hash.startsWith('#b=')) {
    try {
      const json = decodeURIComponent(location.hash.slice(3));
      const data = JSON.parse(json);
      players = data.players || players;
      rounds = data.rounds || rounds;
      nextId = data.nextId || nextId;
    } catch (e) { console.debug("lab f796-scoreboard-any-game:", e); }
  }
  render();
}

function save() {
  const data = { players, rounds, nextId };
  localStorage.setItem('scoreboard-f796', JSON.stringify(data));
}

function addPlayer() {
  const input = document.getElementById('newPlayer');
  const name = input.value.trim();
  if (!name) return;
  if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    setStatus('Player already exists');
    return;
  }
  players.push({ id: nextId++, name });
  input.value = '';
  save();
  render();
}

function addFromPaste() {
  const text = document.getElementById('pasteNames').value;
  text.split(/\n/).map(s => s.trim()).filter(Boolean).forEach(name => {
    if (!players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      players.push({ id: nextId++, name });
    }
  });
  document.getElementById('pasteNames').value = '';
  save();
  render();
}

function removePlayer(id) {
  players = players.filter(p => p.id !== id);
  rounds.forEach(r => delete r.scores[id]);
  save();
  render();
}

function addRound() {
  const scores = {};
  players.forEach(p => scores[p.id] = 0);
  rounds.push({ label: 'Round ' + (rounds.length + 1), scores });
  save();
  render();
}

function clearScores() {
  rounds.forEach(r => {
    Object.keys(r.scores).forEach(k => r.scores[k] = 0);
  });
  save();
  render();
}

function resetAll() {
  if (!confirm('Clear everything?')) return;
  players = [];
  rounds = [];
  nextId = 1;
  localStorage.removeItem('scoreboard-f796');
  history.replaceState(null, '', location.pathname);
  render();
  setStatus('Reset');
}

function updateScore(roundIdx, playerId, value) {
  const n = parseFloat(value);
  rounds[roundIdx].scores[playerId] = isNaN(n) ? 0 : n;
  save();
  renderChart();
  // update total cells without full re-render for speed
  updateTotals();
}

function updateLabel(roundIdx, value) {
  rounds[roundIdx].label = value;
  save();
}

function totals() {
  const t = {};
  players.forEach(p => t[p.id] = 0);
  rounds.forEach(r => {
    players.forEach(p => {
      t[p.id] += r.scores[p.id] || 0;
    });
  });
  return t;
}

function render() {
  // players chips
  const pel = document.getElementById('players');
  pel.innerHTML = players.map(p => 
    `<span class="player-chip">${escape(p.name)} <button onclick="removePlayer(${p.id})">×</button></span>`
  ).join('') || '<em style="color:var(--muted)">No players yet</em>';

  // board table
  const bel = document.getElementById('board');
  if (!players.length) {
    bel.innerHTML = '<p>Add players to start scoring.</p>';
    return;
  }
  let html = '<table><thead><tr><th>Round</th>';
  players.forEach(p => html += `<th>${escape(p.name)}</th>`);
  html += '</tr></thead><tbody>';
  rounds.forEach((r, ri) => {
    html += `<tr><td><input type="text" value="${escape(r.label)}" onchange="updateLabel(${ri}, this.value)" style="width:100px"></td>`;
    players.forEach(p => {
      const v = r.scores[p.id] ?? 0;
      html += `<td><input class="score" type="number" step="any" value="${v}" onchange="updateScore(${ri}, ${p.id}, this.value)"></td>`;
    });
    html += '</tr>';
  });
  // totals
  const t = totals();
  html += '<tr class="totals"><td>Total</td>';
  players.forEach(p => html += `<td id="total-${p.id}">${t[p.id]}</td>`);
  html += '</tr></tbody></table>';
  bel.innerHTML = html;
  renderChart();
}

function updateTotals() {
  const t = totals();
  players.forEach(p => {
    const el = document.getElementById('total-' + p.id);
    if (el) el.textContent = t[p.id];
  });
}

function renderChart() {
  const canvas = document.getElementById('chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  if (!players.length || !rounds.length) return;
  const t = totals();
  const values = players.map(p => t[p.id]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const barW = Math.min(40, (w - 40) / players.length - 10);
  players.forEach((p, i) => {
    const v = t[p.id];
    const barH = ((v - min) / range) * (h - 40);
    const x = 20 + i * (barW + 10);
    const y = h - 20 - barH;
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(p.name.slice(0, 8), x + barW/2, h - 5);
    ctx.fillText(String(v), x + barW/2, y - 4);
  });
}

function copyTotals() {
  const t = totals();
  const lines = players.map(p => `${p.name}: ${t[p.id]}`).join('\n');
  navigator.clipboard.writeText(lines).then(() => setStatus('Totals copied')).catch(() => setStatus('Copy failed'));
}

function downloadCSV() {
  let csv = 'Round,' + players.map(p => '"' + p.name.replace(/"/g,'""') + '"').join(',') + '\n';
  rounds.forEach(r => {
    csv += '"' + r.label.replace(/"/g,'""') + '",' + players.map(p => r.scores[p.id] || 0).join(',') + '\n';
  });
  const t = totals();
  csv += '"Total",' + players.map(p => t[p.id]).join(',') + '\n';
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scoreboard.csv';
  a.click();
  setStatus('CSV downloaded');
}

function shareLink() {
  const data = { players, rounds, nextId };
  const hash = '#b=' + encodeURIComponent(JSON.stringify(data));
  const url = location.origin + location.pathname + hash;
  navigator.clipboard.writeText(url).then(() => setStatus('Share link copied')).catch(() => {
    prompt('Copy this link:', url);
  });
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
  setTimeout(() => { document.getElementById('status').textContent = ''; }, 3000);
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

window.addEventListener('resize', renderChart);
load();
