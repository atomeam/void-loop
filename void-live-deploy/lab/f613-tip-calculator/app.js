const $ = id => document.getElementById(id);
const billEl = $('bill'), customEl = $('custom'), peopleEl = $('people'), roundEl = $('round');
const tipEl = $('tip'), totalEl = $('total'), eachEl = $('each'), copyBtn = $('copy');
const presetBtns = document.querySelectorAll('.presets button');
const KEY = 'verse-tip-calculator-v1';

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s.bill != null) billEl.value = s.bill;
    if (s.tip != null) { customEl.value = s.tip; updatePreset(s.tip); }
    if (s.people != null) peopleEl.value = s.people;
    if (s.round) roundEl.value = s.round;
  } catch (e) { console.debug("lab f613-tip-calculator:", e); }
  calc();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify({
    bill: billEl.value,
    tip: customEl.value,
    people: peopleEl.value,
    round: roundEl.value
  }));
}

function updatePreset(val) {
  presetBtns.forEach(b => {
    b.classList.toggle('active', Number(b.dataset.tip) === Number(val));
  });
}

function money(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function calc() {
  const billCents = Math.round(parseFloat(billEl.value || 0) * 100);
  const tipPct = parseFloat(customEl.value || 0);
  const people = Math.max(1, parseInt(peopleEl.value || 1, 10));
  const mode = roundEl.value;

  if (billCents <= 0 || isNaN(tipPct)) {
    tipEl.textContent = totalEl.textContent = eachEl.textContent = '—';
    return;
  }

  const tipCents = Math.round(billCents * tipPct / 100);
  const totalCents = billCents + tipCents;

  let eachCents = Math.round(totalCents / people);
  if (mode === 'dollar') {
    eachCents = Math.round(totalCents / people / 100) * 100;
  } else if (mode === 'cent') {
    eachCents = Math.round(totalCents / people);
  }

  // residual adjustment for exact total when rounding
  const sumEach = eachCents * people;
  const residual = totalCents - sumEach;

  tipEl.textContent = money(tipCents);
  totalEl.textContent = money(totalCents);
  eachEl.textContent = money(eachCents) + (residual !== 0 ? ' *' : '');

  // store for copy
  copyBtn.dataset.summary = `${money(billCents)} bill + ${tipPct}% tip (${money(tipCents)}) = ${money(totalCents)} total · ${people} people × ${money(eachCents)}${residual ? ' (rounded)' : ''}`;
  save();
}

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    customEl.value = btn.dataset.tip;
    updatePreset(btn.dataset.tip);
    calc();
  });
});

[billEl, customEl, peopleEl, roundEl].forEach(el => {
  el.addEventListener('input', calc);
  el.addEventListener('change', calc);
});

copyBtn.addEventListener('click', async () => {
  const text = copyBtn.dataset.summary || '';
  try {
    await navigator.clipboard.writeText(text);
    const orig = copyBtn.textContent;
    copyBtn.textContent = 'Copied';
    setTimeout(() => copyBtn.textContent = orig, 1400);
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copyBtn.textContent = 'Copied';
    setTimeout(() => copyBtn.textContent = 'Copy summary', 1400);
  }
});

load();
