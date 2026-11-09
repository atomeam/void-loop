const STORAGE_KEY = 'verse-f634-scoreboard';
let state = { players: [], rounds: [], order: [] };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { console.debug("lab f634-scoreboard:", e); }
  if (location.hash.length > 1) {
    try {
      const data = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (data.players && data.rounds) state = data;
    } catch (e) { console.debug("lab f634-scoreboard:", e); }
  }
  if (!state.order) state.order = state.players.map((_,i)=>i);
  render();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const hash = '#' + encodeURIComponent(JSON.stringify(state));
  history.replaceState(null, '', hash);
}

function addPlayer() {
  const input = document.getElementById('newPlayer');
  const name = input.value.trim();
  if (!name) return;
  state.players.push(name);
  state.order.push(state.players.length - 1);
  state.rounds.forEach(r => r.scores.push(0));
  input.value = '';
  save(); render();
}

function removePlayer(idx) {
  state.players.splice(idx, 1);
  state.rounds.forEach(r => r.scores.splice(idx, 1));
  state.order = state.order.filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  save(); render();
}

function addRound() {
  const scores = state.players.map(() => 0);
  state.rounds.push({ name: 'Round ' + (state.rounds.length + 1), scores });
  save(); render();
}

function updateScore(rIdx, pIdx, val) {
  const n = parseFloat(val) || 0;
  state.rounds[rIdx].scores[pIdx] = n;
  save(); render();
}

function updateRoundName(rIdx, name) {
  state.rounds[rIdx].name = name;
  save();
}

function totals() {
  const t = state.players.map(() => 0);
  state.rounds.forEach(r => r.scores.forEach((s, i) => t[i] += s));
  return t;
}

function render() {
  const pl = document.getElementById('playerList');
  pl.innerHTML = state.players.map((p, i) => `
    <span class="player-chip">${escape(p)} <button onclick="removePlayer(${i})">×</button></span>
  `).join('');

  const tot = totals();
  let html = '<table><thead><tr><th>Player</th>';
  state.rounds.forEach((r, ri) => {
    html += `<th><input value="${escape(r.name)}" onchange="updateRoundName(${ri}, this.value)" style="width:5rem;background:#111;color:#eee;border:1px solid #333;border-radius:4px;padding:0.2rem"></th>`;
  });
  html += '<th>Total</th></tr></thead><tbody>';
  state.players.forEach((p, pi) => {
    html += `<tr><td>${escape(p)}</td>`;
    state.rounds.forEach((r, ri) => {
      html += `<td><input class="score" type="number" step="any" value="${r.scores[pi]}" onchange="updateScore(${ri}, ${pi}, this.value)"></td>`;
    });
    html += `<td class="totals">${tot[pi]}</td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('tableWrap').innerHTML = html;

  const bars = document.getElementById('bars');
  const max = Math.max(...tot, 1);
  const sorted = state.order.map(i => ({ i, name: state.players[i], total: tot[i] }))
    .sort((a,b) => b.total - a.total);
  bars.innerHTML = sorted.map(item => `
    <div class="bar-row" data-idx="${item.i}">
      <div class="bar-label">${escape(item.name)}</div>
      <div class="bar" style="width:${(item.total / max * 100)}%"></div>
      <div class="bar-value">${item.total}</div>
    </div>
  `).join('');

  makeDraggable();
}

function makeDraggable() {
  const rows = document.querySelectorAll('.bar-row');
  let dragEl = null;
  rows.forEach(row => {
    row.draggable = true;
    row.ondragstart = e => { dragEl = row; e.dataTransfer.effectAllowed = 'move'; };
    row.ondragover = e => { e.preventDefault(); };
    row.ondrop = e => {
      e.preventDefault();
      if (!dragEl || dragEl === row) return;
      const parent = row.parentNode;
      const children = [...parent.children];
      const from = children.indexOf(dragEl);
      const to = children.indexOf(row);
      if (from < to) parent.insertBefore(dragEl, row.nextSibling);
      else parent.insertBefore(dragEl, row);
      state.order = [...parent.children].map(el => parseInt(el.dataset.idx));
      save();
    };
  });
}

function escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c])); }

document.getElementById('addPlayer').onclick = addPlayer;
document.getElementById('newPlayer').onkeydown = e => { if (e.key === 'Enter') addPlayer(); };
document.getElementById('addRound').onclick = addRound;
document.getElementById('copyBtn').onclick = () => {
  const tot = totals();
  const lines = state.players.map((p,i) => `${p}: ${tot[i]}`).sort((a,b) => parseFloat(b.split(': ')[1]) - parseFloat(a.split(': ')[1]));
  const text = 'Standings\n' + lines.join('\n');
  navigator.clipboard.writeText(text).then(() => alert('Copied'));
};
document.getElementById('csvBtn').onclick = () => {
  const tot = totals();
  let csv = 'Player,' + state.rounds.map(r => r.name).join(',') + ',Total\n';
  state.players.forEach((p,i) => {
    csv += [p, ...state.rounds.map(r => r.scores[i]), tot[i]].join(',') + '\n';
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'scoreboard.csv';
  a.click();
};
document.getElementById('shareBtn').onclick = () => {
  const url = location.origin + location.pathname + '#' + encodeURIComponent(JSON.stringify(state));
  navigator.clipboard.writeText(url).then(() => alert('Share link copied'));
};
document.getElementById('clearBtn').onclick = () => {
  if (confirm('Clear the whole board?')) {
    state = { players: [], rounds: [], order: [] };
    save(); render();
  }
};

window.removePlayer = removePlayer;
window.updateScore = updateScore;
window.updateRoundName = updateRoundName;

load();
