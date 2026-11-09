const a = document.getElementById('a');
const b = document.getElementById('b');
const view = document.getElementById('view');
const status = document.getElementById('status');
const KEY = 'verse-text-diff-v1';

function load() {
  try {
    const hash = location.hash.slice(1);
    if (hash) {
      const data = JSON.parse(decodeURIComponent(hash));
      if (data.a != null) a.value = data.a;
      if (data.b != null) b.value = data.b;
      status.textContent = 'Loaded from share link.';
      return;
    }
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const data = JSON.parse(saved);
      a.value = data.a || '';
      b.value = data.b || '';
      status.textContent = 'Restored last texts from this device.';
    }
  } catch (e) { console.debug("lab f624-text-diff:", e); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ a: a.value, b: b.value })); } catch (e) { console.debug("lab f624-text-diff:", e); }
}

// Simple LCS DP for arrays (lines or words). Returns list of {type, value}
function lcsDiff(arr1, arr2) {
  const n = arr1.length, m = arr2.length;
  if (n * m > 800000) return null; // safety
  const dp = Array.from({length: n+1}, () => new Uint16Array(m+1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = arr1[i-1] === arr2[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && arr1[i-1] === arr2[j-1]) {
      ops.push({ type: 'eq', value: arr1[i-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.push({ type: 'ins', value: arr2[j-1] });
      j--;
    } else {
      ops.push({ type: 'del', value: arr1[i-1] });
      i--;
    }
  }
  return ops.reverse();
}

function wordDiff(s1, s2) {
  const w1 = s1.split(/(\s+)/);
  const w2 = s2.split(/(\s+)/);
  const d = lcsDiff(w1, w2);
  if (!d) return escapeHtml(s1) + ' → ' + escapeHtml(s2);
  return d.map(op => {
    const v = escapeHtml(op.value);
    if (op.type === 'eq') return v;
    if (op.type === 'del') return `<span class="del">${v}</span>`;
    return `<span class="ins">${v}</span>`;
  }).join('');
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function compute() {
  const ta = a.value, tb = b.value;
  if (!ta && !tb) { view.textContent = 'Paste texts above.'; return; }
  const la = ta.split('\n');
  const lb = tb.split('\n');
  const lineOps = lcsDiff(la, lb);
  if (!lineOps) {
    view.innerHTML = '<p>Texts too large for detailed alignment. Showing raw.</p><pre>' + escapeHtml(ta) + '\n\n---\n\n' + escapeHtml(tb) + '</pre>';
    return;
  }
  let html = '';
  let i = 0;
  while (i < lineOps.length) {
    const op = lineOps[i];
    if (op.type === 'eq') {
      html += `<div class="eq">${escapeHtml(op.value)}\n</div>`;
      i++;
    } else {
      // gather a hunk of dels then ins
      const dels = [], inss = [];
      while (i < lineOps.length && lineOps[i].type === 'del') { dels.push(lineOps[i].value); i++; }
      while (i < lineOps.length && lineOps[i].type === 'ins') { inss.push(lineOps[i].value); i++; }
      if (dels.length && inss.length) {
        // paired changed lines
        const max = Math.max(dels.length, inss.length);
        for (let k = 0; k < max; k++) {
          const d = dels[k] || '';
          const ins = inss[k] || '';
          html += `<div class="line-chg">${wordDiff(d, ins)}\n</div>`;
        }
      } else {
        dels.forEach(l => { html += `<div class="line-del"><span class="del">- ${escapeHtml(l)}</span>\n</div>`; });
        inss.forEach(l => { html += `<div class="line-ins"><span class="ins">+ ${escapeHtml(l)}</span>\n</div>`; });
      }
    }
  }
  view.innerHTML = html || '<em>No differences.</em>';

  // Build simple unified-style patch
  let patchLines = ['--- original', '+++ revised', '@@'];
  lineOps.forEach(op => {
    if (op.type === 'eq') patchLines.push(' ' + op.value);
    else if (op.type === 'del') patchLines.push('-' + op.value);
    else patchLines.push('+' + op.value);
  });
  window._lastPatch = patchLines.join('\n');
  status.textContent = `Compared ${la.length} vs ${lb.length} lines.`;
  save();
}

function makePatch() {
  compute();
  return window._lastPatch || '';
}

document.getElementById('diffBtn').onclick = compute;
a.oninput = b.oninput = () => { clearTimeout(window._t); window._t = setTimeout(compute, 400); };
document.getElementById('copyPatch').onclick = async () => {
  const p = makePatch();
  try { await navigator.clipboard.writeText(p); status.textContent = 'Patch copied.'; }
  catch (e) { status.textContent = 'Copy failed — select and copy manually.'; }
};
document.getElementById('download').onclick = () => {
  const p = makePatch();
  const blob = new Blob([p], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const ael = document.createElement('a');
  ael.href = url; ael.download = 'diff.diff'; ael.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Downloaded diff.diff';
};
document.getElementById('share').onclick = async () => {
  const data = { a: a.value, b: b.value };
  const hash = '#' + encodeURIComponent(JSON.stringify(data));
  const url = location.origin + location.pathname + hash;
  try { await navigator.clipboard.writeText(url); status.textContent = 'Share link copied.'; }
  catch (e) { location.hash = hash.slice(1); status.textContent = 'Link updated in address bar — copy it.'; }
};
document.getElementById('clear').onclick = () => {
  a.value = b.value = '';
  view.textContent = 'Differences appear here.';
  localStorage.removeItem(KEY);
  history.replaceState(null, '', location.pathname);
  status.textContent = 'Cleared.';
};

load();
if (a.value || b.value) setTimeout(compute, 50);
