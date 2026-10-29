/**
 * pdf-ui: the screen of the PDF pages (/pdf/ and the pages built for each site of its lane). `mountPdf(root, cfg)` draws the tools a page
 * lists (cfg.tools), one at a time, and every tool works on the device through lib/pdf-tools.js: a file is read here, the result is made here
 * and offered as a download here, and nothing is sent anywhere. Each tool: files in (choose, drop or paste), a few choices, one button, the result
 * with its size. The pages tool is the visual one: thumbnails of every page of every file, each turned, deleted or moved by pointer, drag or keyboard.
 */
import { tools, loadJs, renderPage, parsePages, sizeText, zip, compressByPictures, pagesToImages, toPdfImage, imageKind } from './pdf-tools.js';

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k in e && k !== 'list') { try { e[k] = v; } catch (_) { e.setAttribute(k, v); } } else e.setAttribute(k, v); }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
};
const baseOf = (name) => String(name || 'file').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'file';
const read = async (f) => new Uint8Array(await f.arrayBuffer());
const isPdf = (f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);

/** the label and one-line promise of each tool (also what the probe and the asks read on the page) */
export const TOOL_INFO = Object.freeze({
  merge: ['Merge', 'Join PDFs into one, in the order you set, and pick which pages of each to keep.'],
  split: ['Split', 'Cut a PDF by page ranges, every N pages, or one page per file.'],
  pages: ['Pages', 'See every page: reorder, rotate, delete and combine pages from several files, then save.'],
  extract: ['Extract or delete pages', 'Keep only some pages, or remove the ones you name.'],
  rotate: ['Rotate', 'Turn every page, or only the pages you name, by 90, 180 or 270 degrees.'],
  compress: ['Compress', 'Make a PDF smaller: tidy it losslessly, or redraw the pages as smaller pictures.'],
  img2pdf: ['Images to PDF', 'Turn JPG, PNG, WebP and other pictures into one PDF, one picture to a page.'],
  pdf2img: ['PDF to images', 'Save pages as PNG or JPG pictures, in a ZIP.'],
  numbers: ['Page numbers', 'Number the pages: where, from which number, in which style.'],
  watermark: ['Watermark', 'Stamp a word across the pages, with the opacity and angle you choose.'],
  crop: ['Crop', 'Trim the margins off every page or the pages you name.'],
  order: ['Reorder by number', 'Type the new order of the pages, like 3,1,2, or reverse them all; pages you leave out stay after, in their old order.'],
  info: ['Document info', 'Read and change a PDF\'s title, author, subject and keywords.'],
});

export function mountPdf(root, cfg) {
  const ids = cfg.tools.filter((t) => TOOL_INFO[t]);
  const q = new URLSearchParams(location.search);
  let current = ids.includes(q.get('tool')) ? q.get('tool') : ids[0];
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'PDF tools' }), body = h('div', { class: 'panel' });
  const say = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const share = h('button', { type: 'button', class: 'share', onclick: async () => { const u = location.origin + location.pathname + (current ? '?tool=' + current : ''); try { await navigator.clipboard.writeText(u); status('Link copied: it opens this tool.'); } catch (_) { prompt('Share link', u); } } }, 'Share link');
  root.append(h('div', { class: 'row' }, share), tabs, body);
  const status = (t, bad) => { say.textContent = t; say.classList.toggle('bad', !!bad); };
  const results = h('div', { class: 'results' });
  const downloads = new Set();
  const offer = (name, bytes, type, note) => {
    const url = URL.createObjectURL(new Blob([bytes], { type })); downloads.add(url);
    results.append(h('p', { class: 'result' }, h('a', { class: 'dl', href: url, download: name }, 'Download ' + name), ' ', h('span', { class: 'note' }, sizeText(bytes.length) + (note ? ' · ' + note : ''))));
  };
  const reset = () => { for (const u of downloads) URL.revokeObjectURL(u); downloads.clear(); results.replaceChildren(); status(''); };

  // a file list: choose, drop or paste; each file can move up or down, and be taken out
  function picker({ accept, multi, label, onChange, pagesBox }) {
    const files = [], list = h('ol', { class: 'files' }), input = h('input', { type: 'file', accept, multiple: !!multi, 'aria-label': label, class: 'pick' });
    const drop = h('div', { class: 'drop', tabindex: 0, role: 'button', 'aria-label': label }, h('b', {}, label), h('span', { class: 'note' }, ' or drop ' + (multi ? 'files' : 'a file') + ' here, or paste'));
    const draw = () => {
      list.replaceChildren(...files.map((f, i) => h('li', {},
        h('span', { class: 'fname' }, f.name), h('span', { class: 'note' }, ' ' + sizeText(f.bytes.length) + (f.n ? ' · ' + f.n + (f.n === 1 ? ' page' : ' pages') : '')),
        pagesBox ? h('input', { type: 'text', class: 'pg', placeholder: 'all pages', 'aria-label': 'Pages of ' + f.name + ', for example 1-3', value: f.pages || '', oninput: (e) => { f.pages = e.target.value; } }) : null,
        multi ? h('button', { type: 'button', 'aria-label': 'Move ' + f.name + ' up', disabled: i === 0, onclick: () => { files.splice(i - 1, 0, files.splice(i, 1)[0]); draw(); onChange(); } }, '↑') : null,
        multi ? h('button', { type: 'button', 'aria-label': 'Move ' + f.name + ' down', disabled: i === files.length - 1, onclick: () => { files.splice(i + 1, 0, files.splice(i, 1)[0]); draw(); onChange(); } }, '↓') : null,
        h('button', { type: 'button', 'aria-label': 'Remove ' + f.name, onclick: () => { files.splice(i, 1); draw(); onChange(); } }, '✕'))));
    };
    const add = async (fs) => {
      reset(); const t = await tools().catch((e) => { status(e.message, true); return null; }); if (!t) return;
      for (const f of [...fs]) {
        if (!multi) files.length = 0;
        if (accept === 'image/*' ? !/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name) : !isPdf(f)) { status(f.name + ' is not ' + (accept === 'image/*' ? 'a picture' : 'a PDF'), true); continue; }
        try { const bytes = await read(f), n = accept === 'image/*' ? 0 : await t.pageCount(bytes); files.push({ name: f.name, bytes, n, file: f, pages: '' }); }
        catch (e) { status(f.name + ' could not be read: ' + (/encrypt/i.test(e.message) ? 'it is password protected, which this page cannot open' : 'it is not a PDF this page can read'), true); }
      }
      draw(); onChange();
    };
    input.addEventListener('change', () => { const chosen = [...input.files]; input.value = ''; add(chosen); });
    drop.addEventListener('click', () => input.click()); drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    for (const ev of ['dragover', 'dragenter']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
    for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) add(e.dataTransfer.files); });
    const paste = (e) => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])]; if (fs.length) add(fs); };
    if (!alsoMode) document.addEventListener('paste', paste); // only the tool on top takes a pasted file
    return { files, el: h('div', { class: 'picker' }, drop, input, list), add, destroy: () => document.removeEventListener('paste', paste) };
  }
  const field = (label, ctl, hint) => h('label', { class: 'field' }, h('span', {}, label), ctl, hint ? h('span', { class: 'note' }, hint) : null);
  const num = (v, min, max, step = 1) => h('input', { type: 'number', value: v, min, max, step, inputmode: 'decimal' });
  const sel = (opts, v) => { const s = h('select', {}, opts.map(([val, text]) => h('option', { value: val }, text))); s.value = v; return s; };
  const busy = async (btn, fn) => { btn.disabled = true; reset(); try { await fn(); } catch (e) { status(String(e && e.message || e), true); } finally { btn.disabled = false; } };
  let cleanup = () => {}, alsoMode = false, cleanups = [];
  const build = (id) => { cleanup = () => {}; const nodes = PANELS[id](); cleanups.push(cleanup); return nodes; };

  const PANELS = {
    merge() {
      const p = picker({ accept: 'application/pdf,.pdf', multi: true, label: 'Choose PDFs to merge', pagesBox: true, onChange: () => { go.disabled = p.files.length < 2; } });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(); status('Merging…'); const out = await t.merge(p.files.map((f) => ({ bytes: f.bytes, pages: f.pages }))); offer('merged.pdf', out, 'application/pdf', (await t.pageCount(out)) + ' pages'); status('Done. Your files stayed on this device.'); }) }, 'Merge PDFs');
      cleanup = p.destroy; return [p.el, h('p', { class: 'note' }, 'Order the files with ↑ ↓. Type pages like 1-3, 5 to keep only some of a file.'), go];
    },
    split() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to split', onChange: () => { go.disabled = !p.files.length; } });
      const mode = sel([['ranges', 'By page ranges'], ['every', 'Every N pages'], ['each', 'One file per page']], 'ranges'), r = h('input', { type: 'text', value: '1-3;4-', placeholder: '1-3;4-6', 'aria-label': 'Ranges, separated by semicolons' }), n = num(2, 1, 1000);
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => {
        const t = await tools(), f = p.files[0], base = baseOf(f.name); status('Splitting…');
        const parts = await t.split(f.bytes, mode.value === 'ranges' ? { ranges: r.value } : mode.value === 'every' ? { every: +n.value } : { each: true }, base);
        if (!parts.length) throw new Error('Those ranges hold no pages of this ' + f.n + '-page file');
        for (const x of parts) offer(x.name, x.bytes, 'application/pdf');
        if (parts.length > 1) offer(base + '-split.zip', zip(parts), 'application/zip', parts.length + ' files'); status('Done: ' + parts.length + (parts.length === 1 ? ' file.' : ' files.'));
      }) }, 'Split PDF');
      cleanup = p.destroy; return [p.el, field('How', mode), field('Ranges (a semicolon between files)', r), field('Pages per file', n), go];
    },
    extract() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF', onChange: () => { go.disabled = !p.files.length; } });
      const mode = sel([['keep', 'Keep these pages'], ['delete', 'Delete these pages']], 'keep'), spec = h('input', { type: 'text', value: '1', 'aria-label': 'Pages, for example 1-3, 7, last' });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(), f = p.files[0]; const out = mode.value === 'keep' ? await t.extract(f.bytes, spec.value) : await t.remove(f.bytes, spec.value); offer(baseOf(f.name) + (mode.value === 'keep' ? '-extract.pdf' : '-removed.pdf'), out, 'application/pdf', (await t.pageCount(out)) + ' pages'); status('Done.'); }) }, 'Make the PDF');
      cleanup = p.destroy; return [p.el, field('What', mode), field('Pages', spec, 'like 1-3, 7, last, even, odd'), go];
    },
    rotate() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to rotate', onChange: () => { go.disabled = !p.files.length; } });
      const deg = sel([['90', '90° clockwise'], ['180', '180°'], ['-90', '90° counter-clockwise']], '90'), spec = h('input', { type: 'text', placeholder: 'all pages', 'aria-label': 'Pages to rotate, empty for all' });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(), f = p.files[0]; offer(baseOf(f.name) + '-rotated.pdf', await t.rotate(f.bytes, spec.value, +deg.value), 'application/pdf'); status('Done.'); }) }, 'Rotate');
      cleanup = p.destroy; return [p.el, field('Turn', deg), field('Pages', spec, 'empty means every page'), go];
    },
    compress() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to compress', onChange: () => { go.disabled = !p.files.length; } });
      const mode = sel([['tidy', 'Tidy (keeps text and quality)'], ['pictures', 'Smaller pictures (pages become pictures; text is no longer selectable)']], 'tidy'), lvl = sel([['0.75|130', 'Light'], ['0.6|110', 'Medium'], ['0.4|80', 'Strong']], '0.6|110');
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => {
        const t = await tools(), f = p.files[0]; status('Compressing…'); let out;
        if (mode.value === 'tidy') out = await t.optimize(f.bytes); else { const [quality, dpi] = lvl.value.split('|').map(Number); out = await compressByPictures(f.bytes, { quality, dpi }, (i, n) => status('Page ' + i + ' of ' + n)); }
        if (!out || out.length >= f.bytes.length) { status('This file is already as small as this method can make it (' + sizeText(f.bytes.length) + '). Try Smaller pictures.', false); return; }
        offer(baseOf(f.name) + '-compressed.pdf', out, 'application/pdf', 'from ' + sizeText(f.bytes.length) + ', ' + Math.round((1 - out.length / f.bytes.length) * 100) + '% smaller'); status('Done.');
      }) }, 'Compress PDF');
      cleanup = p.destroy; return [p.el, field('Method', mode), field('Strength (smaller pictures)', lvl), go];
    },
    img2pdf() {
      const p = picker({ accept: 'image/*', multi: true, label: 'Choose images (JPG, PNG, WebP…)', onChange: () => { go.disabled = !p.files.length; } });
      const size = sel([['a4', 'A4'], ['letter', 'US Letter'], ['a5', 'A5'], ['legal', 'Legal'], ['fit', 'Same size as the picture']], 'a4'), land = sel([['0', 'Portrait'], ['1', 'Landscape']], '0'), mar = num(0, 0, 100);
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => {
        const t = await tools(), items = []; for (const f of p.files) items.push(await toPdfImage(f.file));
        const out = await t.imagesToPdf(items, { size: size.value, landscape: land.value === '1', margin: +mar.value || 0 }); offer('images.pdf', out, 'application/pdf', items.length + (items.length === 1 ? ' page' : ' pages')); status('Done. Your pictures stayed on this device.');
      }) }, 'Images to PDF');
      cleanup = p.destroy; return [p.el, field('Page size', size), field('Direction', land), field('Margin (points)', mar), go];
    },
    pdf2img() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF', onChange: () => { go.disabled = !p.files.length; } });
      const type = sel([['image/png', 'PNG'], ['image/jpeg', 'JPG']], 'image/png'), dpi = sel([['72', '72 dpi (screen)'], ['150', '150 dpi'], ['300', '300 dpi (print)']], '150'), spec = h('input', { type: 'text', placeholder: 'all pages', 'aria-label': 'Pages, empty for all' });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => {
        const f = p.files[0], imgs = await pagesToImages(f.bytes, { type: type.value, dpi: +dpi.value, spec: spec.value }, (i, n) => status('Page ' + i + ' of ' + n));
        if (!imgs.length) throw new Error('No such pages'); for (const x of imgs.slice(0, 12)) offer(x.name, x.bytes, type.value); if (imgs.length > 12) results.append(h('p', { class: 'note' }, '…and ' + (imgs.length - 12) + ' more, in the ZIP.'));
        if (imgs.length > 1) offer(baseOf(f.name) + '-pages.zip', zip(imgs), 'application/zip', imgs.length + ' pictures'); status('Done.');
      }) }, 'PDF to images');
      cleanup = p.destroy; return [p.el, field('Picture type', type), field('Quality', dpi), field('Pages', spec), go];
    },
    numbers() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to number', onChange: () => { go.disabled = !p.files.length; } });
      const pos = sel([['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['top-center', 'Top centre'], ['top-right', 'Top right'], ['top-left', 'Top left']], 'bottom-center'), fmt = sel([['n', '1, 2, 3'], ['n of N', '1 of 10'], ['Page n', 'Page 1']], 'n'), start = num(1, 0, 9999), skip = h('input', { type: 'checkbox' });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(), f = p.files[0]; offer(baseOf(f.name) + '-numbered.pdf', await t.numberPages(f.bytes, { pos: pos.value, format: fmt.value, start: +start.value || 1, skipFirst: skip.checked }), 'application/pdf'); status('Done.'); }) }, 'Add page numbers');
      cleanup = p.destroy; return [p.el, field('Where', pos), field('Style', fmt), field('First number', start), h('label', { class: 'field row' }, skip, h('span', {}, 'Leave the first page without a number')), go];
    },
    watermark() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to stamp', onChange: () => { go.disabled = !p.files.length; } });
      const text = h('input', { type: 'text', value: 'DRAFT', maxlength: 40, 'aria-label': 'Watermark text' }), op = num(25, 5, 100), size = num(64, 12, 200), ang = num(45, -90, 90), spec = h('input', { type: 'text', placeholder: 'all pages' });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(), f = p.files[0]; offer(baseOf(f.name) + '-watermarked.pdf', await t.watermark(f.bytes, text.value || 'DRAFT', { opacity: Math.min(1, Math.max(0.05, +op.value / 100)), size: +size.value, angle: +ang.value, spec: spec.value }), 'application/pdf'); status('Done.'); }) }, 'Add watermark');
      cleanup = p.destroy; return [p.el, field('Text', text), field('Opacity (%)', op), field('Size', size), field('Angle (degrees)', ang), field('Pages', spec, 'empty means every page'), go];
    },
    crop() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to crop', onChange: () => { go.disabled = !p.files.length; } });
      const m = { top: num(10, 0, 500), right: num(10, 0, 500), bottom: num(10, 0, 500), left: num(10, 0, 500) }, spec = h('input', { type: 'text', placeholder: 'all pages' }), pt = 72 / 25.4;
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(), f = p.files[0]; offer(baseOf(f.name) + '-cropped.pdf', await t.crop(f.bytes, { top: m.top.value * pt, right: m.right.value * pt, bottom: m.bottom.value * pt, left: m.left.value * pt }, spec.value), 'application/pdf'); status('Done.'); }) }, 'Crop pages');
      cleanup = p.destroy; return [p.el, h('div', { class: 'grid4' }, field('Top (mm)', m.top), field('Right (mm)', m.right), field('Bottom (mm)', m.bottom), field('Left (mm)', m.left)), field('Pages', spec, 'empty means every page'), go];
    },
    info() {
      const f = { title: h('input', { type: 'text' }), author: h('input', { type: 'text' }), subject: h('input', { type: 'text' }), keywords: h('input', { type: 'text' }) }, facts = h('p', { class: 'note' });
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF', onChange: async () => { go.disabled = !p.files.length; if (!p.files.length) return; const i = await (await tools()).info(p.files[0].bytes); facts.textContent = i.pages + (i.pages === 1 ? ' page' : ' pages'); for (const k of Object.keys(f)) f[k].value = Array.isArray(i[k]) ? i[k].join(', ') : i[k]; } });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => { const t = await tools(), x = p.files[0]; offer(baseOf(x.name) + '-info.pdf', await t.info(x.bytes, { title: f.title.value, author: f.author.value, subject: f.subject.value, keywords: f.keywords.value }), 'application/pdf'); status('Done.'); }) }, 'Save the changes');
      cleanup = p.destroy; return [p.el, facts, field('Title', f.title), field('Author', f.author), field('Subject', f.subject), field('Keywords', f.keywords, 'separated by commas'), go];
    },
    order() {
      const p = picker({ accept: 'application/pdf,.pdf', label: 'Choose a PDF to reorder', onChange: () => { go.disabled = !p.files.length; } });
      const spec = h('input', { type: 'text', placeholder: '3,1,2', 'aria-label': 'The new order of the pages, for example 3,1,2' }), rev = h('input', { type: 'checkbox' });
      const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => {
        const t = await tools(), f = p.files[0], n = f.n; let order = rev.checked ? Array.from({ length: n }, (_, i) => n - 1 - i) : [...new Set(parsePages(spec.value, n))];
        if (!order.length) throw new Error('Type the pages in their new order, like 3,1,2'); const seen = new Set(order); for (let i = 0; i < n; i++) if (!seen.has(i)) order.push(i);
        offer(baseOf(f.name) + '-reordered.pdf', await t.assemble([f.bytes], order.map((page) => ({ doc: 0, page }))), 'application/pdf', n + ' pages'); status('Done.');
      }) }, 'Reorder pages');
      cleanup = p.destroy; return [p.el, field('New order', spec, 'like 3,1,2 (pages left out follow in their old order)'), h('label', { class: 'field row' }, rev, h('span', {}, 'Or reverse every page')), go];
    },
    pages() { return pagesPanel(); },
  };

  // the pages tool: thumbnails of every page of every file; reorder, rotate, delete, then save
  function pagesPanel() {
    let items = [], docs = [], seq = 0;
    const grid = h('ol', { class: 'thumbs', 'aria-label': 'Pages' }), count = h('p', { class: 'note' }, 'No pages yet.');
    const p = picker({ accept: 'application/pdf,.pdf', multi: true, label: 'Choose PDFs to open as pages', onChange: () => load() });
    p.el.querySelector('ol.files').hidden = true;
    let loadedFrom = 0;
    async function load() {
      const js = await loadJs().catch((e) => { status(e.message, true); return null; }); if (!js) return;
      // new files only: the picker's list is the source of truth, so reload what is new and keep the edits made to the pages already here
      const fresh = p.files.slice(loadedFrom); loadedFrom = p.files.length;
      for (const f of fresh) {
        const di = docs.length; let pdf; try { pdf = await js.getDocument({ data: f.bytes.slice() }).promise; } catch (_) { status(f.name + ' could not be drawn', true); docs.push(null); continue; }
        docs.push({ pdf, name: f.name, bytes: f.bytes });
        for (let n = 1; n <= Math.min(pdf.numPages, 400); n++) items.push({ id: ++seq, doc: di, page: n - 1, rotate: 0, canvas: null });
      }
      draw(); for (const it of items) if (!it.canvas && docs[it.doc]) { it.canvas = await renderPage(docs[it.doc].pdf, it.page + 1, 0.28).catch(() => null); drawOne(it); }
    }
    const label = (it, i) => 'Page ' + (it.page + 1) + ' of ' + docs[it.doc].name + ', now position ' + (i + 1);
    function move(i, to) { if (to < 0 || to >= items.length || i === to) return; items.splice(to, 0, items.splice(i, 1)[0]); draw(true); const li = grid.children[to]; if (li) li.focus(); }
    function drawOne(it) { const li = grid.querySelector('[data-id="' + it.id + '"]'); if (!li) return; const box = li.querySelector('.cv'); if (it.canvas) { it.canvas.style.transform = 'rotate(' + it.rotate + 'deg)'; box.replaceChildren(it.canvas); } }
    function draw(keep) {
      count.textContent = items.length ? items.length + (items.length === 1 ? ' page' : ' pages') + ' from ' + docs.filter(Boolean).length + (docs.filter(Boolean).length === 1 ? ' file' : ' files') + '. Drag to move, or focus a page and press Alt+← or Alt+→; R turns it, Delete removes it.' : 'No pages yet.';
      go.disabled = !items.length;
      grid.replaceChildren(...items.map((it, i) => {
        const li = h('li', { class: 'thumb', tabindex: 0, draggable: true, 'data-id': it.id, 'aria-label': label(it, i) },
          h('div', { class: 'cv' }, it.canvas || h('span', { class: 'note' }, '…')), h('div', { class: 'cap' }, h('span', { class: 'note' }, (i + 1) + ' · p' + (it.page + 1)),
            h('button', { type: 'button', 'aria-label': 'Rotate ' + label(it, i), onclick: () => { it.rotate = (it.rotate + 90) % 360; drawOne(it); } }, '⟳'),
            h('button', { type: 'button', 'aria-label': 'Move ' + label(it, i) + ' earlier', onclick: () => move(i, i - 1) }, '←'),
            h('button', { type: 'button', 'aria-label': 'Move ' + label(it, i) + ' later', onclick: () => move(i, i + 1) }, '→'),
            h('button', { type: 'button', 'aria-label': 'Delete ' + label(it, i), onclick: () => { items.splice(i, 1); draw(); } }, '✕')));
        if (it.canvas) { it.canvas.style.transform = 'rotate(' + it.rotate + 'deg)'; }
        li.addEventListener('keydown', (e) => {
          if (e.target !== li) return;
          if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); move(i, i - 1); } else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); move(i, i + 1); }
          else if (e.key === 'ArrowLeft' && grid.children[i - 1]) grid.children[i - 1].focus(); else if (e.key === 'ArrowRight' && grid.children[i + 1]) grid.children[i + 1].focus();
          else if (e.key === 'r' || e.key === 'R') { it.rotate = (it.rotate + 90) % 360; drawOne(it); } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); items.splice(i, 1); draw(); const nx = grid.children[Math.min(i, items.length - 1)]; if (nx) nx.focus(); }
        });
        li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
        li.addEventListener('dragend', () => li.classList.remove('dragging'));
        li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('over'); }); li.addEventListener('dragleave', () => li.classList.remove('over'));
        li.addEventListener('drop', (e) => { e.preventDefault(); li.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (Number.isInteger(from)) move(from, i); });
        return li;
      }));
    }
    const rev = h('button', { type: 'button', onclick: () => { items.reverse(); draw(); } }, 'Reverse order'), rot = h('button', { type: 'button', onclick: () => { for (const it of items) it.rotate = (it.rotate + 90) % 360; draw(); } }, 'Rotate all');
    const go = h('button', { type: 'button', class: 'go', disabled: true, onclick: () => busy(go, async () => {
      const t = await tools(); status('Saving…'); const out = await t.assemble(docs.map((d) => d && d.bytes), items.map((it) => ({ doc: it.doc, page: it.page, rotate: it.rotate })));
      offer('pages.pdf', out, 'application/pdf', items.length + ' pages'); status('Done. Your files stayed on this device.');
    }) }, 'Save as PDF');
    cleanup = () => { p.destroy(); for (const d of docs) if (d && d.pdf && d.pdf.destroy) d.pdf.destroy(); };
    return [p.el, count, h('div', { class: 'row' }, rev, rot), grid, go];
  }

  function show(id) {
    for (const c of cleanups) c(); cleanups = []; cleanup = () => {}; reset(); current = id;
    for (const b of tabs.children) { const on = b.dataset.tool === id; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }
    alsoMode = false; const main = build(id); alsoMode = true;
    // more tools under the one that is open, each with its own real controls (a page that is built for one job still turns, deletes and reorders pages)
    const more = (cfg.also || []).filter((x) => TOOL_INFO[x] && x !== id).map((x) => h('section', { class: 'also' }, h('h2', {}, TOOL_INFO[x][0]), h('p', { class: 'note' }, TOOL_INFO[x][1]), ...build(x)));
    alsoMode = false;
    body.replaceChildren(h('h2', { id: 'tool-h' }, TOOL_INFO[id][0]), h('p', { class: 'note' }, TOOL_INFO[id][1]), ...main, say, results, ...more);
    try { const u = new URL(location.href); u.searchParams.set('tool', id); history.replaceState(null, '', u); } catch (_) {}
  }
  for (const id of ids) tabs.append(h('button', { type: 'button', role: 'tab', 'data-tool': id, 'aria-selected': 'false', onclick: () => show(id), onkeydown: (e) => {
    const k = ids.indexOf(id), nx = e.key === 'ArrowRight' ? ids[(k + 1) % ids.length] : e.key === 'ArrowLeft' ? ids[(k + ids.length - 1) % ids.length] : null;
    if (nx) { e.preventDefault(); show(nx); tabs.querySelector('[data-tool="' + nx + '"]').focus(); }
  } }, TOOL_INFO[id][0]));
  show(current);
  // keep the libraries for offline use: fetched once while the page is idle, so the service worker has them before the first tool is pressed
  setTimeout(() => { for (const u of ['/vendor/pdf-lib-1.17.1/pdf-lib.min.js', '/vendor/pdfjs-6.4.299/build/pdf.min.js', '/vendor/pdfjs-6.4.299/build/pdf.worker.min.js']) fetch(u).catch(() => {}); }, 4000);
  return { show };
}
export { imageKind };
