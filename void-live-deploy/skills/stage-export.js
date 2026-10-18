/**
 * stage-export skill — take the stage out and bring it back (tools pack 5, owner 2026-10-18; numbers 98, 103, 104, 105, 106, 109).
 * "export my stage as json" downloads one JSON file of every thing on the stage (103); "import a stage" opens a card that reads such a
 * file back in beside what is there, one "undo" takes it away again (104); "email-ready text of my stage" is a plain-text dump you can
 * copy into an email (109); "print view of the stage" / "print the stage on A4" lays the stage out for paper, A4 or Letter (105, 106; the
 * paper you used last is remembered); "export history" lists the last 20 exports on this device (98). Nothing is uploaded: the file
 * is made and read in this browser. A file you did not make is read with care (lib/stage-port.js parseStageImport: known kinds only,
 * a kept card comes back as its words, unsafe links dropped). "export a print file" (3MF for a slicer) stays with print-file.
 */
import { exportIntent, exportStage, parseStageImport, stageTextDump, historyAdd, historyLine, printCss, printCards, PAPERS } from '../lib/stage-port.js';
import { readJson, writeJson } from '../lib/stage-watch.js';
import { listPage } from '../lib/pack5-ui.js';
import { localDay } from '../lib/stage-pack.js';

const HISTORY_KEY = 'a2m.void.exports.v1', PAPER_KEY = 'a2m.void.paper.v1';
const BTN = 'font:inherit;cursor:pointer;margin:0 .5em .4em 0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:2px 11px';

const record = (kind, count, bytes) => writeJson(HISTORY_KEY, historyAdd(readJson(HISTORY_KEY, []), { at: Date.now(), kind, count, bytes }));
const paperPref = () => { const p = readJson(PAPER_KEY, null); if (PAPERS[p]) return p; try { return /-(?:US|CA)\b|^en$/i.test(navigator.language || '') ? 'Letter' : 'A4'; } catch (_) { return 'A4'; } };

/** hand the browser a file to save. */
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** the print sheet on the page (hidden on screen, the only thing that prints). */
export function buildSheet(things, paper) {
  document.getElementById('p5-print-sheet')?.remove();
  document.getElementById('p5-print-style')?.remove();
  const st = document.createElement('style'); st.id = 'p5-print-style'; st.textContent = printCss(paper);
  const sheet = document.createElement('div'); sheet.id = 'p5-print-sheet'; sheet.dataset.paper = paper;
  sheet.dataset.size = PAPERS[paper].w + 'x' + PAPERS[paper].h;
  const h = document.createElement('h1'); h.textContent = 'My Verse stage · ' + localDay(); h.style.cssText = 'font-size:16pt;margin:0 0 8px'; sheet.appendChild(h);
  const cards = printCards(things);
  for (const c of cards) {
    const d = document.createElement('div'); d.className = 'p5-card';
    const t = document.createElement('strong'); t.textContent = c.kind + (c.title && c.title.toLowerCase() !== c.kind ? ': ' + c.title : ''); d.appendChild(t);
    for (const l of c.lines) { const p = document.createElement('div'); p.textContent = l; p.style.whiteSpace = 'pre-wrap'; d.appendChild(p); }
    sheet.appendChild(d);
  }
  if (!cards.length) { const p = document.createElement('p'); p.textContent = 'Nothing on the stage.'; sheet.appendChild(p); }
  document.head.appendChild(st); document.body.appendChild(sheet);
  const clean = () => { sheet.remove(); st.remove(); removeEventListener('afterprint', clean); };
  addEventListener('afterprint', clean);
  return { sheet, count: cards.length };
}

function printCard(api, paper, now) {
  const things = api.stage.things();
  writeJson(PAPER_KEY, paper);
  const { count } = buildSheet(things, paper);
  record('print ' + paper, count, 0);
  const el = api.showPage((p) => { p.innerHTML = '<h2>Print view</h2>'; });
  const { esc } = api;
  el.innerHTML = '<h2>Print view</h2><p>' + count + ' thing' + (count === 1 ? '' : 's') + ' laid out for ' + esc(paper) + ' paper (' + PAPERS[paper].w + ' x ' + PAPERS[paper].h + ' mm).</p>' // void-review: ok: paper is one of two fixed names, count a number
    + '<div><button type="button" class="p5-print" data-paper="A4" style="' + BTN + '">Print on A4</button><button type="button" class="p5-print" data-paper="Letter" style="' + BTN + '">Print on Letter</button></div>'
    + '<div class="src">Only the stage prints, black on white. Nothing is sent anywhere.</div>';
  el.querySelectorAll('button.p5-print').forEach((b) => b.addEventListener('click', () => { const pp = b.dataset.paper; buildSheet(api.stage.things(), pp); writeJson(PAPER_KEY, pp); record('print ' + pp, count, 0); window.print(); }));
  if (now) setTimeout(() => { try { window.print(); } catch (_) { /* no print here */ } }, 60);
}

function textCard(api) {
  const text = stageTextDump(api.stage.things());
  record('text', Object.keys(api.stage.things()).length, text.length);
  const { esc } = api;
  const el = api.showPage((p) => { p.innerHTML = '<h2>Plain text of the stage</h2>'; });
  el.innerHTML = '<h2>Plain text of the stage</h2><textarea class="p5-text" readonly rows="10" style="width:100%;box-sizing:border-box;font:13px/1.4 ui-monospace,monospace;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px">' + esc(text) + '</textarea>' // void-review: ok: the text goes through esc
    + '<div style="margin-top:6px"><button type="button" class="p5-copy" style="' + BTN + '">Copy for an email</button></div><div class="src">Plain text, wrapped at 72 characters. Nothing is sent anywhere.</div>';
  const ta = el.querySelector('textarea');
  el.querySelector('button.p5-copy').addEventListener('click', async (e) => {
    let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (_) { ta.select(); try { ok = document.execCommand('copy'); } catch (_2) { /* select-all is left for the person */ } }
    e.target.textContent = ok ? 'Copied' : 'Select the text above to copy it';
  });
}

function importCard(api) {
  const el = api.showPage((p) => { p.innerHTML = '<h2>Import a stage</h2>'; });
  el.innerHTML = '<h2>Import a stage</h2><p>Choose a JSON file made by "export my stage as json". Its things come onto the stage beside what is there; "undo" takes them away again.</p>'
    + '<input type="file" class="p5-file" accept=".json,application/json" aria-label="stage JSON file" style="margin:.3em 0"><div class="p5-result" role="status" aria-live="polite" style="margin-top:.5em"></div>'
    + '<div class="src">The file is read in this browser and goes nowhere. Only kinds this stage knows come in, and a kept card comes back as its words.</div>';
  const out = el.querySelector('.p5-result');
  el.querySelector('input.p5-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 2000000) { out.textContent = 'That file is over 2 MB.'; return; }
    const text = await f.text();
    const r = parseStageImport(text, Object.keys(api.stage.kinds()), new Set(Object.keys(api.stage.things())));
    if (!r.ok) { out.textContent = 'Could not import: ' + r.why + '.'; return; }
    if (typeof api.stage.snapshot === 'function') api.stage.snapshot();
    const things = api.stage.things();
    for (const th of r.things) things[th.id] = th;
    api.stage.save(); api.stage.render();
    record('import', r.things.length, text.length);
    out.textContent = 'Imported ' + r.things.length + ' thing' + (r.things.length === 1 ? '' : 's') + (r.skipped ? ' (' + r.skipped + ' left out)' : '') + '.';
    api.say('imported ' + r.things.length);
  });
}

async function run(text, api) {
  const it = exportIntent(text);
  if (!it) return 'none';
  if (it.op === 'json') {
    const things = api.stage.things(), body = exportStage(things), n = Object.values(things).filter((t) => t && t.kind).length;
    download('void-stage-' + localDay() + '.json', body);
    record('json', n, body.length);
    listPage(api, 'Stage exported', [{ text: 'void-stage-' + localDay() + '.json', sub: n + ' thing' + (n === 1 ? '' : 's') + ' · ' + Math.max(1, Math.round(body.length / 1024)) + ' kB' }], { action: 'again', foot: 'Made in this browser, saved by your browser. Say "import a stage" to bring a file back.', onPick: () => download('void-stage-' + localDay() + '.json', exportStage(api.stage.things())) });
    return 'stage-export';
  }
  if (it.op === 'import') { importCard(api); return 'stage-export'; }
  if (it.op === 'text') { textCard(api); return 'stage-export'; }
  if (it.op === 'print' || it.op === 'paper') {
    const paper = it.paper || paperPref();
    printCard(api, paper, /^(?:please\s+)?print\s+(?:the|my)\s+(?:stage|(?:verse|void))\b/i.test(String(text).trim()) && it.op === 'print'); // "print view of ..." only shows the sheet; "print the stage" opens the dialog too
    return 'stage-export';
  }
  const hist = readJson(HISTORY_KEY, []);
  listPage(api, 'Export history', hist.map((e) => ({ text: historyLine(e), sub: new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })), { action: '·', empty: 'Nothing exported yet. Say "export my stage as json".', foot: 'The last 20 exports, prints and imports, kept only in this browser' });
  return 'stage-export';
}

export default {
  name: 'stage-export',
  examples: ['export my stage as json', 'import a stage from json', 'email-ready text of my stage', 'print view of the stage', 'print the stage on A4', 'use letter paper for printing', 'export history'],
  nearMisses: ['export a print file', 'export the stage as 3mf', 'download motelet', 'what is json', 'print my boarding pass', 'import export tax rules'],
  exportIntent,
  match(lower, text) { return !!exportIntent(text || lower); },
  run,
};
