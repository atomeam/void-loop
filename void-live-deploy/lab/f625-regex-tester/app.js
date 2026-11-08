const patternEl = document.getElementById('pattern');
const textEl = document.getElementById('text');
const explainEl = document.getElementById('explain');
const textview = document.getElementById('textview');
const cardsEl = document.getElementById('cards');
const status = document.getElementById('status');
const KEY = 'verse-regex-tester-v1';

let matches = [];
let cardOrder = [];

function flags() {
  let f = '';
  if (document.getElementById('flagG').checked) f += 'g';
  if (document.getElementById('flagI').checked) f += 'i';
  if (document.getElementById('flagM').checked) f += 'm';
  if (document.getElementById('flagS').checked) f += 's';
  return f;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Simple rule-based explainer for common regex pieces
function explainPattern(pat) {
  if (!pat) return 'Enter a pattern.';
  const parts = [];
  // Very lightweight tokenizer for common tokens
  const tokens = pat.match(/\\.|\\[.*?\\]|\\(.*?\\)|[.*+?^$|()]|\\w|\\d|\\s|\\b|./g) || [pat];
  tokens.forEach(t => {
    if (t === '.') parts.push('any character');
    else if (t === '*') parts.push('zero or more of the previous');
    else if (t === '+') parts.push('one or more of the previous');
    else if (t === '?') parts.push('optional previous');
    else if (t === '^') parts.push('start of line/string');
    else if (t === '$') parts.push('end of line/string');
    else if (t === '|') parts.push('or');
    else if (t.startsWith('[') && t.endsWith(']')) parts.push('any character in ' + t);
    else if (t.startsWith('(') && t.endsWith(')')) parts.push('capturing group: ' + t.slice(1,-1));
    else if (t === '\\d') parts.push('a digit');
    else if (t === '\\w') parts.push('a word character');
    else if (t === '\\s') parts.push('whitespace');
    else if (t === '\\b') parts.push('word boundary');
    else if (t.startsWith('\\')) parts.push('escaped ' + t[1]);
    else parts.push('the literal "' + t + '"');
  });
  return 'This pattern looks for: ' + parts.join(', ') + '.';
}

function run() {
  const pat = patternEl.value;
  const txt = textEl.value;
  explainEl.textContent = explainPattern(pat);
  matches = [];
  cardsEl.innerHTML = '';
  if (!pat) {
    textview.textContent = txt;
    status.textContent = 'Enter a pattern.';
    return;
  }
  let re;
  try {
    re = new RegExp(pat, flags());
  } catch (e) {
    explainEl.innerHTML = '<span class="error">Invalid pattern: ' + escapeHtml(e.message) + '</span>';
    textview.textContent = txt;
    status.textContent = 'Fix the pattern.';
    return;
  }
  // Collect matches
  const global = flags().includes('g');
  if (global) {
    let m;
    const re2 = new RegExp(pat, flags());
    while ((m = re2.exec(txt)) !== null) {
      matches.push({ index: m.index, full: m[0], groups: m.slice(1), named: m.groups || {} });
      if (m.index === re2.lastIndex) re2.lastIndex++; // avoid infinite
      if (matches.length > 500) break;
    }
  } else {
    const m = re.exec(txt);
    if (m) matches.push({ index: m.index, full: m[0], groups: m.slice(1), named: m.groups || {} });
  }
  // Highlight in textview
  let html = '';
  let last = 0;
  matches.forEach((m, i) => {
    html += escapeHtml(txt.slice(last, m.index));
    html += `<span class="match" title="match ${i+1}">${escapeHtml(m.full)}</span>`;
    last = m.index + m.full.length;
  });
  html += escapeHtml(txt.slice(last));
  textview.innerHTML = html || escapeHtml(txt);

  // Cards
  cardOrder = matches.map((_, i) => i);
  renderCards();
  status.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es') + ' found.';
  save();
}

function renderCards() {
  cardsEl.innerHTML = '';
  cardOrder.forEach(idx => {
    const m = matches[idx];
    if (!m) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.dataset.idx = idx;
    let groupsHtml = '';
    m.groups.forEach((g, gi) => {
      if (g != null) groupsHtml += `<div>Group ${gi+1}: <strong>${escapeHtml(g)}</strong></div>`;
    });
    Object.keys(m.named).forEach(k => {
      groupsHtml += `<div>${escapeHtml(k)}: <strong>${escapeHtml(m.named[k])}</strong></div>`;
    });
    card.innerHTML = `<h3>Match ${idx+1} @ ${m.index}</h3><div class="full">${escapeHtml(m.full)}</div><div class="groups">${groupsHtml || '<em>no groups</em>'}</div>`;
    cardsEl.appendChild(card);
  });
  // Drag reorder
  let dragged = null;
  cardsEl.querySelectorAll('.card').forEach(card => {
    card.ondragstart = e => { dragged = card; e.dataTransfer.effectAllowed = 'move'; };
    card.ondragover = e => { e.preventDefault(); };
    card.ondrop = e => {
      e.preventDefault();
      if (!dragged || dragged === card) return;
      const from = +dragged.dataset.idx;
      const to = +card.dataset.idx;
      const order = [...cardOrder];
      const fi = order.indexOf(from);
      const ti = order.indexOf(to);
      order.splice(fi, 1);
      order.splice(ti, 0, from);
      cardOrder = order;
      renderCards();
      save();
    };
  });
}

function getExportData() {
  return cardOrder.map(idx => {
    const m = matches[idx];
    return { index: m.index, match: m.full, groups: m.groups, named: m.named };
  });
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      pattern: patternEl.value,
      flags: { g: document.getElementById('flagG').checked, i: document.getElementById('flagI').checked, m: document.getElementById('flagM').checked, s: document.getElementById('flagS').checked },
      text: textEl.value,
      order: cardOrder
    }));
  } catch (e) { console.debug("lab f625-regex-tester:", e); }
}

function load() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.pattern != null) patternEl.value = data.pattern;
      if (data.text != null) textEl.value = data.text;
      if (data.flags) {
        document.getElementById('flagG').checked = !!data.flags.g;
        document.getElementById('flagI').checked = !!data.flags.i;
        document.getElementById('flagM').checked = !!data.flags.m;
        document.getElementById('flagS').checked = !!data.flags.s;
      }
      status.textContent = 'Loaded from share link.';
      setTimeout(run, 50);
      return;
    }
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const data = JSON.parse(saved);
      patternEl.value = data.pattern || '';
      textEl.value = data.text || '';
      if (data.flags) {
        document.getElementById('flagG').checked = !!data.flags.g;
        document.getElementById('flagI').checked = !!data.flags.i;
        document.getElementById('flagM').checked = !!data.flags.m;
        document.getElementById('flagS').checked = !!data.flags.s;
      }
      status.textContent = 'Restored last session from this device.';
      setTimeout(run, 50);
    } else {
      run();
    }
  } catch (e) { run(); }
}

document.getElementById('run').onclick = run;
patternEl.oninput = textEl.oninput = () => { clearTimeout(window._t); window._t = setTimeout(run, 300); };
['flagG','flagI','flagM','flagS'].forEach(id => document.getElementById(id).onchange = run);

document.getElementById('copy').onclick = async () => {
  const lines = getExportData().map(d => d.match);
  try { await navigator.clipboard.writeText(lines.join('\n')); status.textContent = 'Matches copied.'; }
  catch (e) { status.textContent = 'Copy failed.'; }
};
document.getElementById('copyJson').onclick = async () => {
  const json = JSON.stringify(getExportData(), null, 2);
  try { await navigator.clipboard.writeText(json); status.textContent = 'JSON copied.'; }
  catch (e) { status.textContent = 'Copy failed.'; }
};
document.getElementById('dlJson').onclick = () => {
  const blob = new Blob([JSON.stringify(getExportData(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'matches.json';
  a.click();
  status.textContent = 'Downloaded matches.json';
};
document.getElementById('dlCsv').onclick = () => {
  const data = getExportData();
  if (!data.length) return;
  const maxG = Math.max(...data.map(d => d.groups.length), 0);
  let csv = 'index,match' + Array.from({length:maxG}, (_,i) => ',group'+(i+1)).join('') + '\n';
  data.forEach(d => {
    const row = [d.index, '"' + String(d.match).replace(/"/g,'""') + '"'];
    for (let i = 0; i < maxG; i++) row.push(d.groups[i] != null ? '"' + String(d.groups[i]).replace(/"/g,'""') + '"' : '');
    csv += row.join(',') + '\n';
  });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'matches.csv';
  a.click();
  status.textContent = 'Downloaded matches.csv';
};
document.getElementById('share').onclick = async () => {
  const data = { pattern: patternEl.value, text: textEl.value, flags: { g: document.getElementById('flagG').checked, i: document.getElementById('flagI').checked, m: document.getElementById('flagM').checked, s: document.getElementById('flagS').checked } };
  const hash = '#' + encodeURIComponent(JSON.stringify(data));
  const url = location.origin + location.pathname + hash;
  try { await navigator.clipboard.writeText(url); status.textContent = 'Share link copied.'; }
  catch (e) { location.hash = hash.slice(1); status.textContent = 'Link updated — copy from the address bar.'; }
};
document.getElementById('clear').onclick = () => {
  patternEl.value = '';
  textEl.value = '';
  document.getElementById('flagG').checked = true;
  ['flagI','flagM','flagS'].forEach(id => document.getElementById(id).checked = false);
  localStorage.removeItem(KEY);
  history.replaceState(null, '', location.pathname);
  run();
  status.textContent = 'Cleared.';
};

load();
