const KEY = 'verse-f617-recipe';
const inputEl = document.getElementById('input');
const origEl = document.getElementById('orig');
const newsEl = document.getElementById('news');
const outputEl = document.getElementById('output');

function load() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const data = JSON.parse(saved);
      inputEl.value = data.recipe || '';
      origEl.value = data.orig || 4;
      newsEl.value = data.news || 6;
    }
  } catch (e) { console.debug("lab f617-recipe-scaler:", e); }
  scale();
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      recipe: inputEl.value,
      orig: origEl.value,
      news: newsEl.value
    }));
  } catch (e) { console.debug("lab f617-recipe-scaler:", e); }
}

// Parse leading quantity: 2, 2.5, 1/2, 1 1/2, 1½ etc.
function parseQty(line) {
  const m = line.match(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*|\d*\.?\d+)\s*(.*)$/);
  if (!m) return null;
  let numStr = m[1].trim();
  let rest = m[2] || '';
  let value = 0;
  if (numStr.includes('/')) {
    if (numStr.includes(' ')) {
      const [whole, frac] = numStr.split(/\s+/);
      const [n, d] = frac.split('/').map(Number);
      value = Number(whole) + n / d;
    } else {
      const [n, d] = numStr.split('/').map(Number);
      value = n / d;
    }
  } else {
    value = parseFloat(numStr);
  }
  if (isNaN(value)) return null;
  return { value, rest: rest.trim(), original: line };
}

function toFraction(n) {
  if (n <= 0) return '0';
  const frac = Math.round(n * 48) / 48; // practical
  const whole = Math.floor(frac);
  const rem = frac - whole;
  const fracs = [
    [0, ''],
    [1/4, '¼'],
    [1/3, '⅓'],
    [1/2, '½'],
    [2/3, '⅔'],
    [3/4, '¾'],
    [1, '']
  ];
  let closest = fracs.reduce((a, b) => Math.abs(b[0] - rem) < Math.abs(a[0] - rem) ? b : a);
  if (Math.abs(closest[0] - rem) > 0.05) {
    return n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, '');
  }
  if (whole === 0) return closest[1] || n.toFixed(2);
  if (closest[1] === '') return String(whole);
  return whole + ' ' + closest[1];
}

function scale() {
  const orig = parseFloat(origEl.value) || 1;
  const news = parseFloat(newsEl.value) || 1;
  const factor = orig > 0 ? news / orig : 1;
  const lines = inputEl.value.split('\n');
  const out = lines.map(line => {
    const p = parseQty(line);
    if (!p || p.value === 0) return line;
    const scaled = p.value * factor;
    const pretty = toFraction(scaled);
    // Try to keep unit if present
    const unitMatch = p.rest.match(/^([a-zA-Zµ°]+(?:s)?)\b(.*)$/);
    let unit = '', rest = p.rest;
    if (unitMatch) {
      unit = unitMatch[1] + ' ';
      rest = unitMatch[2].trim();
    }
    return (pretty + ' ' + unit + rest).trim();
  }).join('\n');
  outputEl.value = out;
  save();
}

inputEl.addEventListener('input', scale);
origEl.addEventListener('input', scale);
newsEl.addEventListener('input', scale);

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputEl.value);
    const btn = document.getElementById('copy');
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = old, 1500);
  } catch (e) {
    outputEl.select();
    document.execCommand('copy');
  }
});

document.getElementById('download').addEventListener('click', () => {
  const blob = new Blob([outputEl.value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scaled-recipe.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('clear').addEventListener('click', () => {
  inputEl.value = '';
  scale();
});

load();
