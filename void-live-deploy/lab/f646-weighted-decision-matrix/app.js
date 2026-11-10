const KEY = 'verse-f646-decision';
let options = ['Option A', 'Option B'];
let criteria = [{ name: 'Cost', weight: 5 }, { name: 'Quality', weight: 8 }];
let scores = {}; // optionIndex-criterionIndex -> number

function initScores() {
  for (let o = 0; o < options.length; o++) {
    for (let c = 0; c < criteria.length; c++) {
      const k = o + '-' + c;
      if (scores[k] == null) scores[k] = 3;
    }
  }
}

function render() {
  // Options
  const oDiv = document.getElementById('options');
  oDiv.innerHTML = '';
  options.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<input type="text" value="${name}" data-o="${i}"> <button data-rm-o="${i}">Remove</button>`;
    oDiv.appendChild(row);
  });
  // Criteria
  const cDiv = document.getElementById('criteria');
  cDiv.innerHTML = '';
  criteria.forEach((cr, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<input type="text" value="${cr.name}" data-c="${i}"> <label>Weight <input type="number" min="1" max="10" value="${cr.weight}" data-w="${i}" style="width:4em"></label> <button data-rm-c="${i}">Remove</button>`;
    cDiv.appendChild(row);
  });
  // Matrix
  const mDiv = document.getElementById('matrix');
  if (!options.length || !criteria.length) {
    mDiv.innerHTML = '<p>Add at least one option and one criterion.</p>';
    document.getElementById('ranking').innerHTML = '';
    return;
  }
  let html = '<table><thead><tr><th>Option</th>';
  criteria.forEach(cr => html += `<th>${cr.name}<br><small>w=${cr.weight}</small></th>`);
  html += '<th>Weighted total</th></tr></thead><tbody>';
  const totals = [];
  options.forEach((oname, oi) => {
    let total = 0;
    html += `<tr><td>${oname}</td>`;
    criteria.forEach((cr, ci) => {
      const k = oi + '-' + ci;
      const s = scores[k] || 3;
      total += s * cr.weight;
      html += `<td><input type="number" min="1" max="10" value="${s}" data-score="${k}" style="width:3.5em"></td>`;
    });
    html += `<td class="rank">${total.toFixed(1)}</td></tr>`;
    totals.push({ name: oname, total, i: oi });
  });
  html += '</tbody></table>';
  mDiv.innerHTML = html;
  // Ranking
  totals.sort((a, b) => b.total - a.total);
  let rhtml = '<ol>';
  totals.forEach((t, rank) => rhtml += `<li>${t.name}: ${t.total.toFixed(1)}</li>`);
  rhtml += '</ol>';
  document.getElementById('ranking').innerHTML = rhtml;
}

function bind() {
  document.getElementById('add-option').onclick = () => { options.push('Option ' + (options.length + 1)); initScores(); save(); render(); };
  document.getElementById('add-criterion').onclick = () => { criteria.push({ name: 'Criterion ' + (criteria.length + 1), weight: 5 }); initScores(); save(); render(); };
  document.body.addEventListener('input', e => {
    if (e.target.dataset.o != null) {
      options[+e.target.dataset.o] = e.target.value;
    } else if (e.target.dataset.c != null) {
      criteria[+e.target.dataset.c].name = e.target.value;
    } else if (e.target.dataset.w != null) {
      criteria[+e.target.dataset.w].weight = +e.target.value || 1;
    } else if (e.target.dataset.score != null) {
      scores[e.target.dataset.score] = +e.target.value || 1;
    }
    save(); render();
  });
  document.body.addEventListener('click', e => {
    if (e.target.dataset.rmO != null) {
      const i = +e.target.dataset.rmO;
      options.splice(i, 1);
      // rebuild scores roughly
      const ns = {};
      Object.keys(scores).forEach(k => {
        const [o, c] = k.split('-').map(Number);
        if (o < i) ns[k] = scores[k];
        else if (o > i) ns[(o-1) + '-' + c] = scores[k];
      });
      scores = ns;
      save(); render();
    }
    if (e.target.dataset.rmC != null) {
      const i = +e.target.dataset.rmC;
      criteria.splice(i, 1);
      const ns = {};
      Object.keys(scores).forEach(k => {
        const [o, c] = k.split('-').map(Number);
        if (c < i) ns[k] = scores[k];
        else if (c > i) ns[o + '-' + (c-1)] = scores[k];
      });
      scores = ns;
      save(); render();
    }
  });
  document.getElementById('copy').onclick = () => {
    const text = getSummary();
    navigator.clipboard.writeText(text).then(() => setStatus('Copied summary')).catch(() => setStatus('Copy failed'));
  };
  document.getElementById('csv').onclick = () => {
    const csv = getCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'decision-matrix.csv';
    a.click();
    setStatus('CSV downloaded');
  };
  document.getElementById('share').onclick = () => {
    const hash = encodeURIComponent(JSON.stringify({ options, criteria, scores }));
    const url = location.origin + location.pathname + '#' + hash;
    navigator.clipboard.writeText(url).then(() => setStatus('Share link copied')).catch(() => setStatus('Share failed'));
  };
  document.getElementById('reset').onclick = () => {
    if (confirm('Reset all data?')) {
      options = ['Option A', 'Option B'];
      criteria = [{ name: 'Cost', weight: 5 }, { name: 'Quality', weight: 8 }];
      scores = {};
      initScores();
      save();
      render();
      setStatus('Reset');
    }
  };
}

function getSummary() {
  // recompute
  const totals = options.map((name, oi) => {
    let total = 0;
    criteria.forEach((cr, ci) => total += (scores[oi + '-' + ci] || 3) * cr.weight);
    return { name, total };
  }).sort((a, b) => b.total - a.total);
  let text = 'Weighted decision ranking:\n';
  totals.forEach((t, i) => text += `${i+1}. ${t.name}: ${t.total.toFixed(1)}\n`);
  return text;
}

function getCSV() {
  let csv = 'Option,' + criteria.map(c => c.name + ' (w=' + c.weight + ')').join(',') + ',Weighted total\n';
  options.forEach((name, oi) => {
    let total = 0;
    const row = [name];
    criteria.forEach((cr, ci) => {
      const s = scores[oi + '-' + ci] || 3;
      total += s * cr.weight;
      row.push(s);
    });
    row.push(total.toFixed(1));
    csv += row.join(',') + '\n';
  });
  return csv;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify({ options, criteria, scores }));
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      options = d.options || options;
      criteria = d.criteria || criteria;
      scores = d.scores || {};
    }
  } catch (e) { console.debug("lab f646-weighted-decision-matrix:", e); }
  // hash
  if (location.hash.length > 1) {
    try {
      const d = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (d.options) options = d.options;
      if (d.criteria) criteria = d.criteria;
      if (d.scores) scores = d.scores;
    } catch (e) { console.debug("lab f646-weighted-decision-matrix:", e); }
  }
  initScores();
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
  setTimeout(() => document.getElementById('status').textContent = '', 3000);
}

load();
render();
bind();
