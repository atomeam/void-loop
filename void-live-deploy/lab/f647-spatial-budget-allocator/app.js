const KEY = 'verse-f647-budget';
let cats = [];
let income = 4000;

function load() {
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.income) income = +data.income;
      if (Array.isArray(data.cats)) cats = data.cats;
    } catch (e) { console.debug("lab f647-spatial-budget-allocator:", e); }
  } else {
    const s = localStorage.getItem(KEY);
    if (s) {
      try { const d = JSON.parse(s); income = d.income || 4000; cats = d.cats || []; } catch (e) { console.debug("lab f647-spatial-budget-allocator:", e); }
    }
  }
  if (!cats.length) {
    cats = [
      {name:'Rent / mortgage', amt:1400},
      {name:'Food', amt:400},
      {name:'Transport', amt:200},
      {name:'Utilities', amt:150}
    ];
  }
  document.getElementById('income').value = income;
}

function save() {
  const data = {income, cats};
  localStorage.setItem(KEY, JSON.stringify(data));
  history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify(data)));
}

function spent() { return cats.reduce((s,c) => s + (+c.amt||0), 0); }

function render() {
  const box = document.getElementById('cats');
  box.innerHTML = '';
  cats.forEach((c,i) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<input type="text" value="${c.name.replace(/"/g,'&quot;')}" data-i="${i}" class="name">
      <input type="number" value="${c.amt}" step="0.01" min="0" data-i="${i}" class="amt">
      <button data-i="${i}" class="del">×</button>`;
    box.appendChild(row);
  });
  const bars = document.getElementById('bars');
  bars.innerHTML = '';
  const max = Math.max(income, spent(), 1);
  cats.forEach((c,i) => {
    const pct = (c.amt / max) * 100;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<div class="bar-label">${c.name}</div>
      <div class="bar-track"><div class="bar-fill ${c.amt > income ? 'over' : ''}" style="width:${pct}%"><div class="handle" data-i="${i}"></div></div></div>
      <div class="bar-amt">${(+c.amt).toFixed(2)}</div>`;
    bars.appendChild(row);
  });
  const sp = spent();
  const rem = income - sp;
  document.getElementById('spent').textContent = sp.toFixed(2);
  const remEl = document.getElementById('remain');
  remEl.textContent = 'Remaining: ' + rem.toFixed(2);
  remEl.className = 'remain' + (rem < 0 ? ' neg' : '');
  document.getElementById('pct').textContent = income ? `Used ${(sp/income*100).toFixed(1)}% of income` : '';
  save();
}

function addCat(name='New', amt=0) {
  cats.push({name, amt:+amt||0});
  render();
}

document.getElementById('add').onclick = () => addCat();
document.getElementById('income').oninput = e => { income = +e.target.value || 0; render(); };
document.getElementById('cats').onclick = e => {
  if (e.target.classList.contains('del')) {
    cats.splice(+e.target.dataset.i, 1);
    render();
  }
};
document.getElementById('cats').oninput = e => {
  const i = +e.target.dataset.i;
  if (e.target.classList.contains('name')) cats[i].name = e.target.value;
  if (e.target.classList.contains('amt')) cats[i].amt = +e.target.value || 0;
  render();
};

let drag = null;
function startDrag(e, i) {
  e.preventDefault();
  drag = {i, startX: e.clientX || e.touches[0].clientX, startAmt: cats[i].amt};
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('touchmove', onDrag, {passive:false});
  window.addEventListener('touchend', endDrag);
}
function onDrag(e) {
  if (!drag) return;
  e.preventDefault();
  const x = e.clientX || e.touches[0].clientX;
  const dx = x - drag.startX;
  const scale = income / 400;
  let newAmt = drag.startAmt + dx / Math.max(scale, 2);
  newAmt = Math.max(0, Math.round(newAmt * 100) / 100);
  cats[drag.i].amt = newAmt;
  render();
}
function endDrag() {
  drag = null;
  window.removeEventListener('pointermove', onDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('touchend', endDrag);
}
document.getElementById('bars').addEventListener('pointerdown', e => {
  if (e.target.classList.contains('handle')) startDrag(e, +e.target.dataset.i);
});
document.getElementById('bars').addEventListener('touchstart', e => {
  if (e.target.classList.contains('handle')) startDrag(e, +e.target.dataset.i);
}, {passive:false});

document.getElementById('copy').onclick = () => {
  const lines = cats.map(c => `${c.name}: ${(+c.amt).toFixed(2)}`).join('\n');
  const text = `Income: ${income.toFixed(2)}\n${lines}\nSpent: ${spent().toFixed(2)}\nRemaining: ${(income-spent()).toFixed(2)}`;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('status').textContent = 'Summary copied.';
  }).catch(() => {
    document.getElementById('status').textContent = 'Copy failed (permission).';
  });
};
document.getElementById('csv').onclick = () => {
  let csv = 'Category,Amount,PercentOfIncome\n';
  cats.forEach(c => {
    const p = income ? (c.amt/income*100).toFixed(1) : 0;
    csv += `"${c.name.replace(/"/g,'""')}",${(+c.amt).toFixed(2)},${p}\n`;
  });
  csv += `Total spent,${spent().toFixed(2)},\nRemaining,${(income-spent()).toFixed(2)},\n`;
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'budget.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById('clear').onclick = () => {
  if (confirm('Clear all categories and reset?')) {
    cats = [];
    income = 0;
    document.getElementById('income').value = '';
    render();
  }
};

load();
render();
