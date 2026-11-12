const cats = {
  length: { base: 'm', units: { mm:0.001, cm:0.01, m:1, km:1000, in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344 } },
  weight: { base: 'kg', units: { mg:0.000001, g:0.001, kg:1, t:1000, oz:0.0283495, lb:0.453592, st:6.35029 } },
  volume: { base: 'L', units: { ml:0.001, L:1, m3:1000, tsp:0.00492892, tbsp:0.0147868, 'fl oz':0.0295735, cup:0.236588, pt:0.473176, qt:0.946353, gal:3.78541 } },
  temperature: { base: 'C', units: { C:1, F:1, K:1 } }, // special
  area: { base: 'm2', units: { mm2:0.000001, cm2:0.0001, m2:1, ha:10000, km2:1000000, in2:0.00064516, ft2:0.092903, yd2:0.836127, acre:4046.86, mi2:2589988.11 } },
  speed: { base: 'm/s', units: { 'm/s':1, 'km/h':0.277778, 'mph':0.44704, 'kn':0.514444, 'ft/s':0.3048 } },
  time: { base: 's', units: { ms:0.001, s:1, min:60, h:3600, d:86400, wk:604800, mo:2629800, yr:31557600 } },
  data: { base: 'B', units: { B:1, KB:1000, MB:1000000, GB:1000000000, TB:1e12, KiB:1024, MiB:1048576, GiB:1073741824, TiB:1099511627776 } }
};

const catSel = document.getElementById('cat');
const fromSel = document.getElementById('from');
const valIn = document.getElementById('val');
const results = document.getElementById('results');
const toast = document.getElementById('toast');

Object.keys(cats).forEach(c => {
  const o = document.createElement('option');
  o.value = c; o.textContent = c.charAt(0).toUpperCase() + c.slice(1);
  catSel.appendChild(o);
});

function populateFrom() {
  const cat = cats[catSel.value];
  fromSel.innerHTML = '';
  Object.keys(cat.units).forEach(u => {
    const o = document.createElement('option');
    o.value = u; o.textContent = u;
    fromSel.appendChild(o);
  });
}

function convertTemp(val, from, to) {
  let c;
  if (from === 'C') c = val;
  else if (from === 'F') c = (val - 32) * 5/9;
  else if (from === 'K') c = val - 273.15;
  if (to === 'C') return c;
  if (to === 'F') return c * 9/5 + 32;
  if (to === 'K') return c + 273.15;
  return c;
}

function update() {
  const catName = catSel.value;
  const cat = cats[catName];
  const v = parseFloat(valIn.value);
  const from = fromSel.value;
  results.innerHTML = '';
  if (isNaN(v)) {
    results.innerHTML = '<div>Enter a number</div>';
    return;
  }
  const rows = [];
  Object.keys(cat.units).forEach(u => {
    let out;
    if (catName === 'temperature') {
      out = convertTemp(v, from, u);
    } else {
      const base = v * cat.units[from];
      out = base / cat.units[u];
    }
    const fmt = Math.abs(out) >= 1e6 || (Math.abs(out) > 0 && Math.abs(out) < 0.001) ? out.toExponential(4) : out.toPrecision(6).replace(/\.?0+$/, '');
    const div = document.createElement('div');
    div.className = 'result-row';
    div.innerHTML = `<span class="unit">${u}</span><span class="value">${fmt}</span>`;
    results.appendChild(div);
    rows.push([u, fmt]);
  });
  // save
  try {
    localStorage.setItem('verse-f651-unit', JSON.stringify({ cat: catName, val: v, from }));
  } catch (e) { console.debug("lab f651-unit-converter:", e); }
  // hash
  const hash = `#${catName}/${encodeURIComponent(from)}/${v}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function load() {
  let state = { cat: 'length', val: 1, from: 'm' };
  try {
    const s = JSON.parse(localStorage.getItem('verse-f651-unit') || '{}');
    if (s.cat) state = s;
  } catch (e) { console.debug("lab f651-unit-converter:", e); }
  if (location.hash) {
    const parts = location.hash.slice(1).split('/');
    if (parts[0] && cats[parts[0]]) {
      state.cat = parts[0];
      state.from = decodeURIComponent(parts[1] || state.from);
      state.val = parseFloat(parts[2]) || state.val;
    }
  }
  catSel.value = state.cat;
  populateFrom();
  fromSel.value = state.from || Object.keys(cats[state.cat].units)[0];
  valIn.value = state.val;
  update();
}

catSel.onchange = () => { populateFrom(); update(); };
fromSel.onchange = update;
valIn.oninput = update;

document.getElementById('copy').onclick = () => {
  const lines = Array.from(results.querySelectorAll('.result-row')).map(r => r.textContent.replace(/\s+/g, ' ').trim());
  const text = `${valIn.value} ${fromSel.value} =\n` + lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 1500);
  });
};

document.getElementById('csv').onclick = () => {
  const rows = Array.from(results.querySelectorAll('.result-row')).map(r => {
    const unit = r.querySelector('.unit').textContent;
    const value = r.querySelector('.value').textContent;
    return `"${unit}","${value}"`;
  });
  const csv = `Unit,Value\n` + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `unit-conversion-${catSel.value}.csv`;
  a.click();
};

load();
