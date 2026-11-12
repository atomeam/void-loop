const $ = id => document.getElementById(id);
const KEY = 'verse-f654-tip';
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

let history = []; // {bill, tipPct, date}
let shares = []; // relative tip weights, sum to 1
let dragging = -1;
let dragStartY = 0;
let dragStartWeight = 0;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      history = d.history || [];
      if (d.bill) $('bill').value = d.bill;
      if (d.people) $('people').value = d.people;
      if (d.tip) $('tip').value = d.tip;
    }
  } catch (e) { console.debug("lab f654-tip-calculator-suggest-spatial:", e); }
  // hash override
  const h = location.hash.slice(1);
  if (h) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(h))));
      if (d.bill) $('bill').value = d.bill;
      if (d.people) $('people').value = d.people;
      if (d.tip) $('tip').value = d.tip;
    } catch (e) { console.debug("lab f654-tip-calculator-suggest-spatial:", e); }
  }
  resetShares();
  updateSuggest();
  render();
}

function save() {
  const data = {
    history,
    bill: +$('bill').value || 0,
    people: +$('people').value || 2,
    tip: +$('tip').value || 18
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.debug("lab f654-tip-calculator-suggest-spatial:", e); }
  try {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({bill:data.bill, people:data.people, tip:data.tip}))));
    history.replaceState(null, '', '#' + b64);
  } catch (e) { console.debug("lab f654-tip-calculator-suggest-spatial:", e); }
}

function updateSuggest() {
  const bill = +$('bill').value || 0;
  const note = $('suggestNote');
  if (history.length < 3) {
    note.innerHTML = 'Suggestion needs at least 3 past tips. Default 18%.';
    return;
  }
  // weighted average, higher weight for similar bills
  let wsum = 0, psum = 0;
  history.forEach(h => {
    const rel = Math.abs(h.bill - bill) / Math.max(bill, 1);
    const w = rel < 0.3 ? 3 : rel < 0.6 ? 1.5 : 0.5;
    wsum += w;
    psum += w * h.tipPct;
  });
  const sug = wsum ? (psum / wsum) : 18;
  note.innerHTML = `Suggested tip: <span class="suggest">${sug.toFixed(1)}%</span> from ${history.length} past tips (higher weight on similar bills).`;
  window._suggested = sug;
}

function resetShares() {
  const n = Math.max(1, Math.min(12, +$('people').value || 2));
  shares = Array(n).fill(1 / n);
}

function getNumbers() {
  const bill = Math.max(0, +$('bill').value || 0);
  const tipPct = Math.max(0, +$('tip').value || 0) / 100;
  const tipAmount = bill * tipPct;
  const n = shares.length;
  const round = $('round').value;
  const eachBase = bill / n;
  const totals = shares.map(w => {
    const personTip = tipAmount * w;
    let total = eachBase + personTip;
    if (round === 'cent') total = Math.round(total * 100) / 100;
    else if (round === 'dollar') total = Math.round(total);
    return total;
  });
  return { bill, tipAmount, tipPct: tipPct*100, totals, n };
}

function render() {
  const { totals, tipAmount, n } = getNumbers();
  // canvas
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#121a24';
  ctx.fillRect(0, 0, W, H);
  if (n === 0) return;
  const barW = Math.min(60, (W - 40) / n - 8);
  const maxH = H - 40;
  const maxShare = Math.max(...shares, 0.01);
  shares.forEach((w, i) => {
    const x = 20 + i * (barW + 12);
    const h = (w / maxShare) * maxH;
    const y = H - 20 - h;
    ctx.fillStyle = dragging === i ? '#5eead4' : '#3dd6c6';
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = '#e7ecf1';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText((i+1), x + barW/2, H - 6);
    ctx.fillText(totals[i].toFixed(2), x + barW/2, y - 6);
  });
  // totals text
  const tEl = $('totals');
  const lines = totals.map((t, i) => `<div class="person-total"><span>Person ${i+1}</span><strong>$${t.toFixed(2)}</strong></div>`).join('');
  const grand = totals.reduce((a,b)=>a+b,0);
  tEl.innerHTML = lines + `<div class="person-total" style="font-weight:700"><span>Total</span><strong>$${grand.toFixed(2)}</strong></div>`;
  window._summary = buildSummary();
  save();
}

function buildSummary() {
  const { totals, tipPct } = getNumbers();
  let s = `Tip calculator\nBill $${(+$('bill').value).toFixed(2)} · ${shares.length} people · ${tipPct.toFixed(1)}% tip\n`;
  totals.forEach((t,i) => s += `Person ${i+1}: $${t.toFixed(2)}\n`);
  return s;
}

function onPointer(e, isDown) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const n = shares.length;
  const barW = Math.min(60, (canvas.width - 40) / n - 8);
  let hit = -1;
  for (let i = 0; i < n; i++) {
    const bx = 20 + i * (barW + 12);
    if (x >= bx && x <= bx + barW) { hit = i; break; }
  }
  if (isDown && hit >= 0) {
    dragging = hit;
    dragStartY = y;
    dragStartWeight = shares[hit];
    canvas.style.cursor = 'ns-resize';
  }
  return hit;
}

canvas.addEventListener('pointerdown', e => { onPointer(e, true); });
canvas.addEventListener('pointermove', e => {
  if (dragging < 0) return;
  const rect = canvas.getBoundingClientRect();
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const dy = dragStartY - y; // up increases
  const delta = (dy / 180) * 0.4; // sensitivity
  let newW = Math.max(0.05, Math.min(0.8, dragStartWeight + delta));
  const others = 1 - newW;
  const oldOthers = 1 - dragStartWeight;
  if (oldOthers > 0.01) {
    shares = shares.map((w, i) => i === dragging ? newW : w * (others / oldOthers));
  }
  // renormalize
  const sum = shares.reduce((a,b)=>a+b,0);
  shares = shares.map(w => w / sum);
  render();
});
canvas.addEventListener('pointerup', () => { dragging = -1; canvas.style.cursor = 'ns-resize'; });
canvas.addEventListener('pointerleave', () => { dragging = -1; });

$('bill').oninput = () => { updateSuggest(); render(); };
$('people').oninput = () => { resetShares(); render(); };
$('tip').oninput = render;
$('round').onchange = render;
$('useSuggest').onclick = () => {
  if (window._suggested) $('tip').value = window._suggested.toFixed(1);
  render();
};
$('copy').onclick = () => {
  navigator.clipboard.writeText(window._summary || '').then(() => alert('Copied')).catch(() => alert('Copy failed'));
};
$('download').onclick = () => {
  const { totals, tipPct } = getNumbers();
  let csv = 'type,person,amount,tip_pct,date\n';
  totals.forEach((t,i) => csv += `current,Person ${i+1},${t.toFixed(2)},${tipPct.toFixed(1)},\n`);
  history.forEach(h => csv += `history,,${h.bill.toFixed(2)},${h.tipPct.toFixed(1)},${h.date}\n`);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'tip-history.csv';
  a.click();
};
$('saveHistory').onclick = () => {
  const bill = +$('bill').value || 0;
  const tipPct = +$('tip').value || 0;
  if (bill <= 0) return alert('Enter a bill first');
  history.push({ bill, tipPct, date: new Date().toISOString().slice(0,10) });
  if (history.length > 50) history.shift();
  updateSuggest();
  save();
  alert('Saved to history for future suggestions');
};

load();
window.addEventListener('resize', () => { canvas.width = canvas.clientWidth; render(); });
canvas.width = canvas.clientWidth || 680;
