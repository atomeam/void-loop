/**
 * chart skill — a real bar, line or pie chart from the numbers in the ask, drawn as SVG on the card (nothing sent)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "make a bar chart from apples 12, oranges 7, bananas 15", "pie chart of Q1 40, Q2 35, Q3 25",
 * "line chart jan 10, feb 14, mar 9". With no numbers, the card asks for them. Download SVG or CSV.
 */
const SKIP = /(?:\b(?:org(?:ani[sz]ation(?:al)?)?|seating|eye|star|flow|ancestry|family|org)\s*charts?\b|\bflowchart\b|\bchart\s+a\s+course\b|\bnatal\s+chart\b|\bgrowth\s+chart\b|\bstock\s+charts?\b|\bprice\s+chart\b|\b(?:share|stock|ticker|nasdaq|nyse|s&p)\b.*\bchart\b|\b(?:verse|void)(?:'s)?\s+growth\s+chart\b|\b(?:what\s+is|what'?s|how\s+(?:do\s+i|to)\s+(?:make|create|draw)|who\s+invented)\s+(?:a\s+)?(?:bar\s+|line\s+|pie\s+)?charts?\b|\b(?:matplotlib|excel|tableau|powerpoint)\b.*\b(?:how|tutorial|code)\b)/i;
const WANT = /(?:\b(?:bar|line|pie|column|donut|doughnut|area)\s+(?:chart|graph|plot)\b|\b(?:make|draw|create|show|plot|render|build)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:bar|line|pie|column)?\s*(?:chart|graph)\b|\b(?:chart|graph)\s+(?:from|of|for|with)\b)/i;
const STOP = /^(?:a|an|the|chart|graph|plot|bar|line|pie|column|donut|doughnut|area|make|draw|create|show|render|build|please|from|of|for|with|to|and)$/i;
const PALETTE = ['#7eb8ff', '#ffb060', '#7ed99a', '#ff8a85', '#c9a0e8', '#7ad4d0', '#f0d465', '#e0b090'];

export function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmt(n) {
  if (!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a >= 1e6 || (a > 0 && a < 0.005)) return Number(n.toPrecision(3)).toString();
  return String(Math.round(n * 100) / 100);
}

function clean(text) {
  return String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
}

export function isChartAsk(text) {
  const t = clean(text);
  if (!t || t.length > 2000) return false;
  if (SKIP.test(t)) return false;
  if (/\b(?:picture|photo|image|logo|cartoon|sketch)\b/i.test(t) && !/\b(?:bar|line|pie|column)\s+(?:chart|graph)\b/i.test(t)) return false;
  return WANT.test(t);
}

export function stripLead(text) {
  return clean(text)
    .replace(/^(?:please\s+)?(?:make|draw|create|show|plot|render|give\s+me|build)\s+(?:me\s+)?(?:a\s+|an\s+)?/i, '')
    .replace(/^(?:bar|line|pie|column|donut|doughnut|area)\s+(?:chart|graph|plot)\s*(?:from|of|for|with|:)?\s*/i, '')
    .replace(/^(?:chart|graph|plot)\s*(?:from|of|for|with|:)\s*/i, '')
    .trim();
}

export function parseRows(text) {
  const s = stripLead(text);
  const rows = [];
  const re = /([A-Za-z][A-Za-z0-9+%$./'& -]{0,32}?)\s*[:=]?\s*(\$?-?\d+(?:\.\d+)?)(?:\s*%)?/g;
  let m;
  while ((m = re.exec(s))) {
    let label = m[1].trim().replace(/^[,;]+|[,;]+$/g, '').replace(/^(?:and|from|of|for|with|to)\s+/i, '').trim();
    if (!label || STOP.test(label)) continue;
    const value = parseFloat(String(m[2]).replace('$', ''));
    if (!Number.isFinite(value)) continue;
    rows.push({ label: label.slice(0, 40), value });
    if (rows.length >= 24) break;
  }
  if (rows.length >= 2) return rows;
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 2) return nums.slice(0, 24).map((n, i) => ({ label: String(i + 1), value: parseFloat(n) }));
  return rows;
}

function kindOf(text) {
  const t = clean(text);
  if (/\b(?:pie|donut|doughnut)\b/i.test(t)) return 'pie';
  if (/\b(?:line|area)\s+(?:chart|graph|plot)\b|\b(?:line|area)\s+chart\b/i.test(t)) return 'line';
  return 'bar';
}

function titleOf(text, kind) {
  const leftover = stripLead(text).replace(/([A-Za-z][A-Za-z0-9+%$./'& -]{0,32}?)\s*[:=]?\s*\$?-?\d+(?:\.\d+)?(?:\s*%)?/g, ' ').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (leftover && leftover.length <= 48 && !/^\d+$/.test(leftover)) return leftover.replace(/^./, (c) => c.toUpperCase());
  return kind === 'pie' ? 'Pie chart' : kind === 'line' ? 'Line chart' : 'Bar chart';
}

export function chartOf(text) {
  if (!isChartAsk(text)) return null;
  const kind = kindOf(text);
  const rows = parseRows(text);
  return { kind, title: titleOf(text, kind), rows, needsData: rows.length < 2 };
}

export function csvOf(q) {
  const lines = ['label,value'];
  for (const r of q.rows || []) lines.push('"' + String(r.label).replace(/"/g, '""') + '",' + r.value);
  return lines.join('\n') + '\n';
}

function niceMax(n) {
  if (!(n > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const m = n / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function barOrLineSvg(q, rows, kind) {
  const W = 640, H = 360, L = 52, R = 16, T = 28, B = 56;
  const iw = W - L - R, ih = H - T - B;
  const vals = rows.map((r) => r.value);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = Math.max(hi - lo, Math.abs(hi), Math.abs(lo), 1);
  const y0 = T + ih * (hi / span);
  const yFor = (v) => T + ih * ((hi - v) / span);
  const n = rows.length, gap = Math.min(16, iw / n * 0.25), bw = Math.max(8, (iw - gap * (n + 1)) / n);
  const ticks = 4;
  const top = niceMax(Math.max(Math.abs(hi), Math.abs(lo)));
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (hi - lo) * (i / ticks);
    const y = yFor(v);
    grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.12)" />'
      + '<text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="rgba(230,232,240,.8)" font-size="11">' + xmlEsc(fmt(v)) + '</text>';
  }
  let body = '', pts = [];
  rows.forEach((r, i) => {
    const x = L + gap + i * (bw + gap);
    const cx = x + bw / 2;
    const color = PALETTE[i % PALETTE.length];
    const y = yFor(r.value);
    const h = Math.max(2, Math.abs(y - y0));
    const barY = r.value >= 0 ? y : y0;
    if (kind === 'bar') {
      body += '<rect x="' + x.toFixed(1) + '" y="' + barY.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + color + '">'
        + '<title>' + xmlEsc(r.label + ': ' + fmt(r.value)) + '</title></rect>';
    } else {
      pts.push(cx.toFixed(1) + ',' + y.toFixed(1));
      body += '<circle cx="' + cx.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="' + color + '"><title>' + xmlEsc(r.label + ': ' + fmt(r.value)) + '</title></circle>';
    }
    const valY = r.value >= 0 ? y - 8 : y + 16;
    body += '<text x="' + cx.toFixed(1) + '" y="' + valY.toFixed(1) + '" text-anchor="middle" fill="#e6e8f0" font-size="11">' + xmlEsc(fmt(r.value)) + '</text>';
    const labY = H - 20;
    const lab = r.label.length > 12 ? r.label.slice(0, 11) + '\u2026' : r.label;
    body += '<text x="' + cx.toFixed(1) + '" y="' + labY + '" text-anchor="middle" fill="rgba(230,232,240,.85)" font-size="12">' + xmlEsc(lab) + '</text>';
  });
  if (kind === 'line' && pts.length) {
    body = '<polyline fill="none" stroke="#7eb8ff" stroke-width="2.5" points="' + pts.join(' ') + '" />' + body;
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + xmlEsc(q.title || 'Chart') + '">'
    + '<title>' + xmlEsc(q.title || 'Chart') + '</title>'
    + '<rect width="' + W + '" height="' + H + '" rx="12" fill="rgba(0,0,0,.2)" />'
    + '<text x="' + (W / 2) + '" y="18" text-anchor="middle" fill="#e6e8f0" font-size="14" font-weight="600">' + xmlEsc(q.title || 'Chart') + '</text>'
    + grid + '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '" stroke="rgba(255,255,255,.35)" />'
    + body + '</svg>';
}

function pieSvg(q, rows) {
  const W = 640, H = 360, cx = 200, cy = 190, rad = 120;
  const pos = rows.filter((r) => r.value > 0);
  const sum = pos.reduce((s, r) => s + r.value, 0);
  if (!(sum > 0)) return barOrLineSvg(q, rows, 'bar');
  let a = -Math.PI / 2, slices = '', legend = '', x = 360, y = 70;
  pos.forEach((r, i) => {
    const frac = r.value / sum, sweep = frac * Math.PI * 2, a2 = a + sweep;
    const x1 = cx + rad * Math.cos(a), y1 = cy + rad * Math.sin(a);
    const x2 = cx + rad * Math.cos(a2), y2 = cy + rad * Math.sin(a2);
    const large = sweep > Math.PI ? 1 : 0;
    const color = PALETTE[i % PALETTE.length];
    const d = 'M ' + cx + ' ' + cy + ' L ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A ' + rad + ' ' + rad + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' Z';
    const pct = Math.round(frac * 1000) / 10;
    slices += '<path d="' + d + '" fill="' + color + '"><title>' + xmlEsc(r.label + ': ' + fmt(r.value) + ' (' + pct + '%)') + '</title></path>';
    legend += '<rect x="' + x + '" y="' + (y - 11) + '" width="12" height="12" rx="2" fill="' + color + '" />'
      + '<text x="' + (x + 20) + '" y="' + y + '" fill="#e6e8f0" font-size="13">' + xmlEsc(r.label + ' \u00b7 ' + fmt(r.value) + ' (' + pct + '%)') + '</text>';
    y += 22;
    a = a2;
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + xmlEsc(q.title || 'Pie chart') + '">'
    + '<title>' + xmlEsc(q.title || 'Pie chart') + '</title>'
    + '<rect width="' + W + '" height="' + H + '" rx="12" fill="rgba(0,0,0,.2)" />'
    + '<text x="' + (W / 2) + '" y="22" text-anchor="middle" fill="#e6e8f0" font-size="14" font-weight="600">' + xmlEsc(q.title || 'Pie chart') + '</text>'
    + slices + legend + '</svg>';
}

export function svgOf(q) {
  const rows = (q.rows || []).slice(0, 24);
  if (!rows.length) return '';
  if (q.kind === 'pie') return pieSvg(q, rows);
  return barOrLineSvg(q, rows, q.kind === 'line' ? 'line' : 'bar');
}

function cardHtml(q) {
  const has = (q.rows || []).length >= 2;
  const lines = has ? q.rows.map((r) => r.label + ' ' + r.value).join(', ') : '';
  let html = '<h2>' + xmlEsc(q.title || 'Chart') + '</h2>';
  if (has) html += '<div class="chart-svg" style="margin:8px 0">' + svgOf(q) + '</div>';
  else html += '<p class="sub">Type the numbers, one pair at a time \u2014 apples 12, oranges 7 \u2014 and draw the chart.</p>';
  html += '<label class="sub" for="ch-data" style="display:block;margin:8px 0 4px">Numbers</label>'
    + '<textarea id="ch-data" rows="3" style="width:100%;max-width:520px;box-sizing:border-box;font:inherit;padding:8px;border-radius:8px;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.14)">' + xmlEsc(lines) + '</textarea>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;align-items:center">'
    + '<button type="button" id="ch-draw">Draw chart</button>'
    + '<button type="button" id="ch-bar" data-kind="bar">Bar</button>'
    + '<button type="button" id="ch-line" data-kind="line">Line</button>'
    + '<button type="button" id="ch-pie" data-kind="pie">Pie</button>'
    + (has ? '<button type="button" id="ch-svg">Download SVG</button><button type="button" id="ch-csv">Download CSV</button>' : '')
    + '</div>'
    + '<div class="src">Drawn on this device from the numbers you typed \u00b7 as of Nov 2026</div>';
  return html;
}

function save(name, mime, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function bind(el, q) {
  const data = el.querySelector('#ch-data');
  const redraw = (kind) => {
    const text = 'make a ' + (kind || q.kind) + ' chart from ' + (data && data.value || '');
    const next = chartOf(text) || { ...q, kind: kind || q.kind, rows: parseRows(text), needsData: true };
    if (kind) next.kind = kind;
    next.title = q.title && !q.needsData ? q.title : titleOf(text, next.kind);
    next.needsData = (next.rows || []).length < 2;
    el.innerHTML = cardHtml(next);
    bind(el, next);
  };
  const draw = el.querySelector('#ch-draw');
  if (draw) draw.addEventListener('click', () => redraw(q.kind));
  for (const id of ['ch-bar', 'ch-line', 'ch-pie']) {
    const b = el.querySelector('#' + id);
    if (b) b.addEventListener('click', () => redraw(b.getAttribute('data-kind')));
  }
  const svgBtn = el.querySelector('#ch-svg');
  if (svgBtn) svgBtn.addEventListener('click', () => save((q.title || 'chart').replace(/\s+/g, '-').toLowerCase() + '.svg', 'image/svg+xml', svgOf(q)));
  const csvBtn = el.querySelector('#ch-csv');
  if (csvBtn) csvBtn.addEventListener('click', () => save((q.title || 'chart').replace(/\s+/g, '-').toLowerCase() + '.csv', 'text/csv', csvOf(q)));
}

function run(text, api) {
  const { showPage } = api;
  const q = chartOf(text) || { kind: 'bar', title: 'Chart', rows: [], needsData: true };
  const el = showPage((p) => { p.innerHTML = cardHtml(q); });
  if (el) bind(el, q);
  return 'chart';
}

export default {
  name: 'chart',
  examples: [
    'make a bar chart from apples 12, oranges 7, bananas 15',
    'pie chart of Q1 40, Q2 35, Q3 25',
    'line chart jan 10, feb 14, mar 9',
    'bar graph: red 3, blue 5, green 2',
    'make a chart of sales 10, costs 6, profit 4'
  ],
  nearMisses: [
    'what is a bar chart',
    'how to make a chart in excel',
    'organization chart',
    'apple stock chart',
    'chart a course to bermuda',
    "verse's growth chart",
    'make a picture of a chart'
  ],
  match(lower, text) { return isChartAsk(text); },
  run,
  suite() {
    const q = chartOf('make a bar chart from apples 12, oranges 7, bananas 15');
    const svg = q && svgOf(q);
    const ok = !!q && q.kind === 'bar' && q.rows.length === 3 && q.rows[0].value === 12 && /<svg[\s\S]*apples/i.test(svg)
      && !isChartAsk('what is a bar chart') && !isChartAsk('apple stock chart') && chartOf('pie chart of Q1 40, Q2 35, Q3 25').kind === 'pie';
    return { ok, got: ok ? 'chart draws' : 'chart match or svg failed' };
  }
};
