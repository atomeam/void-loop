/**
 * csv-table skill — tools pack 1 (owner, 2026-10-18): a pasted csv becomes a small table on the stage, and a file dragged onto the stage becomes a card.
 *   "csv table: name,age ⏎ ann,30 ⏎ bo,25" / "paste csv: ..." / "table from csv: ..." (commas, semicolons or tabs; quotes honoured): a table whose cells
 *   you can edit and whose headings sort it (a tap sorts up, again down, again as typed; numbers sort as numbers). Up to 200 rows and 20 columns.
 *   Drag a file from your computer onto the stage: a .csv/.tsv becomes the table, other text files a card with the first lines, an image a card with a
 *   small thumbnail, anything else a card with its name, size and type. The file is read in the page and goes nowhere; only the card is kept.
 * Nothing appears until asked or until something is dropped.
 */
import { parseCsv, rowsFromAsk, sortedRows } from '../lib/note-tools.js';
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';

// "csv to table: a,b // 1,2" is list-tools' form (its data table card, tools pack 10) and is left to it: this skill takes "csv table:",
// "paste csv:", "table from csv:" and a bare "csv:" (the two skills shipped the same day and the shorter rank took both until 2026-10-18)
const MAKE = /^(?:please\s+)?(?:(?:make|build|create|show|give)\s+(?:me\s+)?(?:a\s+|an\s+)?)?(?:paste\s+csv|csv\s+(?:table|paste)|table\s+(?:from|of)\s+(?:a\s+)?csv|csv)\s*:\s*([\s\S]+)$/i;
const SHOW_DROP = /^show\s+the\s+dropped\s+files?$/i;
const HOW_DROP = /^(?:drop|drag)\s+(?:a\s+)?file\s+(?:on|onto)\s+(?:the\s+)?stage$|^(?:how\s+do\s+i\s+)?(?:drop|drag)\s+(?:a\s+)?file\s+(?:onto?\s+)?(?:the\s+stage|here)$/i;

/** the rows an ask pastes, or null when it is not a csv-table ask. Pure. */
export function csvIntent(raw) {
  const m = MAKE.exec(String(raw || '').trim());
  if (!m) return null;
  const rows = rowsFromAsk(m[1]);
  return rows.length ? { rows } : null;
}

/** a file's size in words: "2.1 KB". Pure. */
export function sizeLabel(n) { n = +n || 0; return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }

/** what a dropped file becomes: 'table' (csv/tsv), 'text', 'image' or 'other', by its name and type. Pure. */
export function dropKind(name, mime) {
  const n = String(name || '').toLowerCase(), m = String(mime || '').toLowerCase();
  if (/\.(csv|tsv)$/.test(n) || m === 'text/csv' || m === 'text/tab-separated-values') return 'table';
  if (/\.(txt|md|markdown|json|log|html?|xml|ya?ml|js|css)$/.test(n) || m.startsWith('text/') || m === 'application/json') return 'text';
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(n)) return 'image';
  return 'other';
}

// ---- the table --------------------------------------------------------------------------------------------------------
function mountTable(th, stageApi) {
  const el = cardEl(th, stageApi, 'csv-table');
  el.style.maxWidth = 'min(94vw,640px)'; el.style.overflow = 'auto'; el.style.maxHeight = '70vh';
  const cap = document.createElement('div');
  cap.className = 'csv-title'; cap.contentEditable = 'true'; cap.spellcheck = false; cap.textContent = th.title || ''; cap.dataset.placeholder = 'Table';
  cap.style.cssText = 'font-weight:600;min-height:1.3em;margin-bottom:6px;outline:none;border-bottom:1px dashed rgba(255,255,255,.2)';
  cap.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cap.blur(); } });
  cap.addEventListener('input', () => { th.title = cap.textContent || ''; stageApi.save(); });
  keepOut(cap);
  const tbl = document.createElement('table'); tbl.className = 'csv-grid'; tbl.style.cssText = 'border-collapse:collapse;font-size:13px';
  const rows = th.rows || [];
  const sort = th.sort && th.sort.dir ? th.sort : null;
  const shown = sort ? sortedRows(rows, sort.col, sort.dir) : rows;
  const w = Math.max(1, ...rows.map((r) => r.length));
  shown.forEach((r, ri) => {
    const tr = document.createElement('tr');
    for (let ci = 0; ci < w; ci++) {
      const head = ri === 0, c = document.createElement(head ? 'th' : 'td');
      c.style.cssText = 'border:1px solid rgba(255,255,255,.16);padding:4px 8px;text-align:left;min-width:3em' + (head ? ';background:rgba(255,255,255,.08);cursor:pointer;user-select:none' : '');
      c.textContent = r[ci] == null ? '' : r[ci];
      if (head) {
        c.dataset.col = String(ci); c.setAttribute('role', 'button'); c.tabIndex = 0;
        const mark = sort && sort.col === ci ? (sort.dir > 0 ? ' ▲' : ' ▼') : '';
        if (mark) c.textContent += mark;
        c.setAttribute('aria-label', 'sort by ' + (r[ci] || 'column ' + (ci + 1)));
        const go = (e) => { e.stopPropagation(); const cur = th.sort && th.sort.col === ci ? th.sort.dir : 0; th.sort = { col: ci, dir: cur === 0 ? 1 : cur === 1 ? -1 : 0 }; stageApi.save(); stageApi.render(); };
        c.addEventListener('click', go); c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
      } else {
        c.contentEditable = 'true'; c.spellcheck = false; c.dataset.row = String(ri);
        c.addEventListener('input', () => { // write back to the row in typed order (the shown row object is the stored one)
          const row = shown[ri]; row[ci] = (c.textContent || '').slice(0, 200); stageApi.save();
        });
      }
      keepOut(c); tr.appendChild(c);
    }
    tbl.appendChild(tr);
  });
  const foot = document.createElement('div'); foot.className = 'csv-foot'; foot.style.cssText = 'font-size:11px;opacity:.65;margin-top:6px';
  foot.textContent = Math.max(0, rows.length - 1) + ' rows × ' + w + ' columns · tap a heading to sort';
  el.append(cap, tbl, foot);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function mountFile(th, stageApi) {
  const el = cardEl(th, stageApi, 'file-card');
  el.style.width = 'min(92vw,320px)';
  const name = document.createElement('div'); name.className = 'file-name'; name.style.cssText = 'font-weight:600;word-break:break-all'; name.textContent = th.name || 'file';
  const meta = document.createElement('div'); meta.className = 'file-meta'; meta.style.cssText = 'font-size:12px;opacity:.7;margin:2px 0 6px'; meta.textContent = (th.mime || 'unknown type') + ' · ' + sizeLabel(th.size);
  el.append(name, meta);
  if (typeof th.thumb === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(th.thumb)) {
    const img = document.createElement('img'); img.className = 'file-thumb'; img.alt = 'thumbnail of ' + (th.name || 'the image'); img.src = th.thumb; img.style.cssText = 'max-width:100%;border-radius:8px;display:block';
    el.appendChild(img);
  }
  if (th.preview) {
    const pre = document.createElement('pre'); pre.className = 'file-preview'; pre.style.cssText = 'margin:6px 0 0;max-height:180px;overflow:auto;white-space:pre-wrap;font:12px/1.4 ui-monospace,Menlo,monospace;background:rgba(255,255,255,.06);padding:8px;border-radius:8px';
    pre.textContent = th.preview; el.appendChild(pre);
  } else if (!th.thumb) {
    const n = document.createElement('div'); n.style.cssText = 'font-size:12px;opacity:.6'; n.textContent = 'no preview for this kind of file'; el.appendChild(n);
  }
  keepOut(el); stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

// ---- reading what was dropped (in the page, nothing sent) --------------------------------------------------------------
async function thumbOf(file) {
  try {
    if (file.size > 12 * 1048576 || typeof createImageBitmap !== 'function') return '';
    const bmp = await createImageBitmap(file), k = Math.min(1, 220 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch (_) { return ''; }
}

/** make the stage thing for one dropped file; its id */
export async function cardFor(file, stageApi) {
  const kind = dropKind(file.name, file.type);
  if (kind === 'table') {
    const text = await file.slice(0, 400000).text();
    const rows = parseCsv(text);
    if (rows.length) { const th = addThing(stageApi, 'csvtable', { title: file.name, rows }); return th; }
  }
  const props = { name: String(file.name || 'file').slice(0, 120), mime: String(file.type || '').slice(0, 60), size: +file.size || 0 };
  if (kind === 'text' || kind === 'table') props.preview = (await file.slice(0, 20000).text()).split('\n').slice(0, 12).join('\n').slice(0, 600);
  else if (kind === 'image') props.thumb = await thumbOf(file);
  return addThing(stageApi, 'filecard', props);
}

let pending = []; // files dropped, waiting for the stage's own hand (the summon below)
if (typeof document !== 'undefined' && !window.__voidDropCard) {
  window.__voidDropCard = true;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  const free = (e) => { const t = e.target; return !(t && t.closest && t.closest('input,textarea,[contenteditable="true"]')); };
  document.addEventListener('dragover', (e) => { if (hasFiles(e) && free(e)) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (e.defaultPrevented || !hasFiles(e) || !free(e)) return; // a card that takes drops itself (the document reader) keeps them
    const files = Array.from(e.dataTransfer.files || []).slice(0, 5);
    if (!files.length) return;
    e.preventDefault();
    pending = pending.concat(files).slice(0, 10);
    document.dispatchEvent(new CustomEvent('void:summon', { detail: 'show the dropped files' }));
  });
}

export default {
  name: 'csv-table',
  examples: ['csv table: name,age ⏎ ann,30 ⏎ bo,25', 'paste csv: item;price ⏎ tea;3 ⏎ cake;5', 'table from csv: a,b ⏎ 1,2', 'show the dropped files', 'drag a file onto the stage'],
  nearMisses: ['what is a csv file', 'convert this csv to json', 'csv', 'make a table of the planets', 'merge two csv files', 'drop me a line', 'drag the note to the left'],
  csvIntent,
  match(lower, text) { const t = text || lower; return !!csvIntent(t) || SHOW_DROP.test(t.trim()) || HOW_DROP.test(t.trim()); },
  async run(text, api) {
    const t = String(text || '').trim(), stageApi = api.stage;
    if (HOW_DROP.test(t)) { api.say('drag a file from your computer onto the stage: a csv becomes a table, other files a card'); return 'csv-table'; }
    if (SHOW_DROP.test(t)) {
      const files = pending; pending = [];
      if (!files.length) { api.say('drag a file onto the stage first'); return 'csv-table'; }
      let made = 0;
      for (const f of files) { try { await cardFor(f, stageApi); made++; } catch (_) {} }
      stageApi.save(); stageApi.render();
      api.say(made ? made + (made === 1 ? ' card' : ' cards') + ' from the dropped ' + (made === 1 ? 'file' : 'files') + ' · read here, sent nowhere' : 'I could not read that file');
      return 'csv-table';
    }
    const q = csvIntent(t); if (!q) return 'none';
    const th = addThing(stageApi, 'csvtable', { title: '', rows: q.rows });
    stageApi.select(th.id); stageApi.save(); stageApi.render();
    api.say('table with ' + Math.max(0, q.rows.length - 1) + ' rows · tap a heading to sort');
    return 'csv-table';
  },
  stageKinds: {
    csvtable: { mount: mountTable },
    filecard: { mount: mountFile },
  },
};
