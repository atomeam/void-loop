/**
 * stage-print skill - the stage as one printed page (asked by the owner, 2026-10-18): "print this stage as a one-page sheet" lays every
 * stage thing out on a clean A4 sheet, in the order it sits on the stage (top to bottom, left to right), each with its title and a few
 * words of its text, draws it on a canvas, downloads it as a PNG and offers the browser's print dialog. An empty stage says so and makes
 * nothing. Made in this browser from what is on the stage; nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export const PAGE = { w: 1240, h: 1754 }, MARGIN = 80, GAP = 28, HEAD = 150, TEXT_MAX = 400;
const CLEAN = (t) => String(t || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK = /^(?:print|export)\s+(?:this\s+|the\s+|my\s+)?stage(?:\s+(?:as|to|on)\s+(?:a\s+|an\s+)?(?:one[- ]page\s+)?(?:sheet|page|paper))?$/;
/** whether the ask is for the stage sheet. Pure. */
export const printOf = (text) => ASK.test(CLEAN(text));

const oneLine = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
/** the words a thing shows, short: its text, its list items (done ones struck with an x), its link or name. Pure. */
export function textOf(th) {
  const parts = [];
  if (th.text) parts.push(th.text);
  if (Array.isArray(th.items)) parts.push(th.items.map((i) => (i && i.done ? '[x] ' : '[ ] ') + oneLine(i && i.text)).join('; '));
  for (const k of ['label', 'url', 'name', 'caption']) if (th[k] && typeof th[k] === 'string' && th[k] !== th.title) parts.push(th[k]);
  return oneLine(parts.join(' · ')).slice(0, TEXT_MAX);
}
/** the sheet's entries, in stage order (a row band of 90 px, then left to right): [{ id, kind, title, text }]. Pure. */
export function sheetItems(things) {
  const list = Object.values(things || {}).filter((t) => t && t.id && t.kind);
  list.sort((a, b) => Math.round((+a.y || 0) / 90) - Math.round((+b.y || 0) / 90) || (+a.x || 0) - (+b.x || 0));
  return list.map((t) => ({ id: t.id, kind: String(t.kind), title: oneLine(t.title) || String(t.kind).replace(/-/g, ' '), text: textOf(t) }));
}
/** words wrapped to `maxW` px by `measure(str)`; a word wider than the line is cut. Pure given measure. */
export function wrap(text, maxW, measure) {
  const out = []; let line = '';
  for (let w of String(text || '').split(/\s+/).filter(Boolean)) {
    while (measure(w) > maxW && w.length > 1) { let n = w.length - 1; while (n > 1 && measure(w.slice(0, n)) > maxW) n--; if (line) { out.push(line); line = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
    if (!line) line = w; else if (measure(line + ' ' + w) <= maxW) line += ' ' + w; else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}
/** the boxes of the sheet: [{ x, y, w, h, title, lines }], one to three columns by how many things there are, text cut to fit the
 *  box with an ellipsis. `measure` takes (str, bold). Pure given measure. */
export function layoutSheet(items, measure, page = PAGE) {
  const n = items.length; if (!n) return [];
  const cols = n <= 4 ? 1 : n <= 16 ? 2 : 3, rows = Math.ceil(n / cols);
  const w = Math.floor((page.w - 2 * MARGIN - (cols - 1) * GAP) / cols), avail = page.h - HEAD - MARGIN - (rows - 1) * GAP;
  const h = Math.max(70, Math.min(260, Math.floor(avail / rows))), lineH = 30, room = Math.max(0, Math.floor((h - 62) / lineH));
  return items.map((it, i) => {
    const lines = wrap(it.text, w - 32, (s) => measure(s, false)); if (lines.length > room) { lines.length = room; if (room) lines[room - 1] = lines[room - 1].replace(/\s*\S{0,2}$/, '') + '…'; } // ellipsis-ok: drawn picture or short label, the full text is on the card
    const title = wrap(it.title, w - 32, (s) => measure(s, true))[0] || '';
    return { x: MARGIN + (i % cols) * (w + GAP), y: HEAD + Math.floor(i / cols) * (h + GAP), w, h, title, lines };
  });
}
/** draw the sheet on a canvas (returns it). */
export function drawSheet(boxes, doc = document, when = new Date()) {
  const c = doc.createElement('canvas'); c.width = PAGE.w; c.height = PAGE.h; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#111'; g.textBaseline = 'top';
  g.font = 'bold 44px system-ui, sans-serif'; g.fillText('My stage', MARGIN, 60);
  g.font = '22px system-ui, sans-serif'; g.fillStyle = '#666'; g.fillText(boxes.length + ' thing' + (boxes.length === 1 ? '' : 's') + ' · ' + when.toISOString().slice(0, 10) + ' · from a-to-mind.com', MARGIN, 112);
  for (const b of boxes) {
    g.strokeStyle = '#bbb'; g.lineWidth = 2; g.strokeRect(b.x, b.y, b.w, b.h);
    g.fillStyle = '#111'; g.font = 'bold 26px system-ui, sans-serif'; g.fillText(b.title, b.x + 16, b.y + 14);
    g.fillStyle = '#333'; g.font = '22px system-ui, sans-serif'; b.lines.forEach((l, i) => g.fillText(l, b.x + 16, b.y + 52 + i * 30));
  }
  return c;
}
const measureWith = (g) => (s, bold) => { g.font = (bold ? 'bold 26px' : '22px') + ' system-ui, sans-serif'; return g.measureText(s).width; };

function run(text, api) {
  if (!printOf(text)) return 'none';
  const items = sheetItems(api.stage.things());
  if (!items.length) { api.say('the stage is empty, so there is nothing to print'); return 'stage-print'; }
  const probe = document.createElement('canvas').getContext('2d'), boxes = layoutSheet(items, measureWith(probe)), canvas = drawSheet(boxes);
  const url = canvas.toDataURL('image/png');
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'void-stage-sheet.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
  const { esc } = api;
  api.showPage((el) => {
    el.innerHTML = '<h2>Stage sheet</h2><div class="sub">' + items.length + ' thing' + (items.length === 1 ? '' : 's') + ' on one page · saved as a PNG</div>'
      + '<img class="stage-sheet-preview" alt="' + esc('One-page sheet of the ' + items.length + ' things on the stage') + '" src="' + url + '" style="max-width:100%;max-height:60vh;border:1px solid #888;background:#fff;margin:8px 0">'
      + '<div><button type="button" class="stage-sheet-print" style="cursor:pointer">Print…</button></div><div class="src">Made in this browser from what is on the stage · nothing was sent anywhere</div>'; // void-review: ok: url is a data URL this page drew, the count is a number, the alt is escaped
    el.querySelector('.stage-sheet-print').addEventListener('click', () => printSheet(url));
  });
  return 'stage-print';
}
/** print only the sheet: a hidden copy beside the page that the print stylesheet shows alone. */
function printSheet(url) {
  let box = document.getElementById('stage-sheet-print');
  if (!box) {
    box = document.createElement('div'); box.id = 'stage-sheet-print'; box.style.display = 'none';
    const st = document.createElement('style'); st.textContent = '@page{size:A4;margin:0}@media print{body>*:not(#stage-sheet-print){display:none!important}#stage-sheet-print{display:block!important}#stage-sheet-print img{width:100%;height:auto}}';
    box.appendChild(st); box.appendChild(document.createElement('img')); document.body.appendChild(box);
  }
  box.querySelector('img').src = url;
  try { window.print(); } catch (_) {}
}

export default {
  name: 'stage-print',
  printOf,
  examples: ['print this stage as a one-page sheet', 'print the stage', 'export my stage as a sheet'],
  nearMisses: ['print the 3d model', 'print my boarding pass', 'stage fright', 'print stage lighting plan template'],
  match(lower, text) { return printOf(text || lower); },
  run,
};
