const $ = id => document.getElementById(id);
const KEY = 'verse-tip-calculator';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      $('bill').value = d.bill ?? 45;
      $('tipPct').value = d.tipPct ?? 20;
      $('people').value = d.people ?? 1;
      $('round').value = d.round ?? 'exact';
    }
  } catch (e) { console.debug("lab f731-tip-calculator:", e); }
  updatePresets();
  calc();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      bill: parseFloat($('bill').value) || 0,
      tipPct: parseFloat($('tipPct').value) || 0,
      people: parseInt($('people').value) || 1,
      round: $('round').value
    }));
  } catch (e) { console.debug("lab f731-tip-calculator:", e); }
}

function updatePresets() {
  const p = parseFloat($('tipPct').value) || 0;
  document.querySelectorAll('#presets button').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.p) === p);
  });
}

function roundUpDollar(n) {
  return Math.ceil(n);
}

function calc() {
  let bill = Math.max(0, parseFloat($('bill').value) || 0);
  let tipPct = Math.max(0, parseFloat($('tipPct').value) || 0);
  let people = Math.min(99, Math.max(1, parseInt($('people').value) || 1));
  $('people').value = people;
  const mode = $('round').value;

  let tip = bill * (tipPct / 100);
  let total = bill + tip;

  if (mode === 'tip-dollar') {
    tip = roundUpDollar(tip);
    total = bill + tip;
  }

  let each = total / people;
  let eachTip = tip / people;
  let adjusted = [];

  if (mode === 'each-dollar') {
    const base = Math.round(each);
    const remainder = Math.round((total - base * people) * 100) / 100;
    for (let i = 0; i < people; i++) {
      adjusted.push(base + (i === people - 1 ? remainder : 0));
    }
    each = adjusted[0]; // for display of typical
  } else {
    each = Math.round(each * 100) / 100;
    eachTip = Math.round(eachTip * 100) / 100;
    tip = Math.round(tip * 100) / 100;
    total = Math.round(total * 100) / 100;
  }

  const fmt = n => '$' + n.toFixed(2);

  let resultHtml = `
    Tip: <strong>${fmt(tip)}</strong><br>
    Total: <strong>${fmt(total)}</strong><br>
    Each (${people}): <strong>${fmt(each)}</strong>
  `;
  if (mode === 'each-dollar' && people > 1) {
    resultHtml += `<br><small>Last person adjusted by remainder so the sum matches.</small>`;
  }
  $('results').innerHTML = resultHtml;

  const line = `Bill ${fmt(bill)} + ${tipPct}% tip (${fmt(tip)}) = ${fmt(total)}. Split ${people} way${people>1?'s':''}: ${fmt(each)} each.`;
  $('line').textContent = line;

  save();
  updatePresets();
  return line;
}

$('bill').oninput = $('tipPct').oninput = $('people').oninput = $('round').onchange = calc;

document.querySelectorAll('#presets button').forEach(b => {
  b.onclick = () => {
    $('tipPct').value = b.dataset.p;
    calc();
  };
});

$('copyBtn').onclick = () => {
  const line = $('line').textContent;
  navigator.clipboard.writeText(line).then(() => {
    const btn = $('copyBtn');
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = old, 1200);
  }).catch(() => alert('Copy failed — select the line manually'));
};

$('clearBtn').onclick = () => {
  $('bill').value = 45;
  $('tipPct').value = 20;
  $('people').value = 1;
  $('round').value = 'exact';
  localStorage.removeItem(KEY);
  calc();
};

load();
