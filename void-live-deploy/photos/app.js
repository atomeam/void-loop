  import { mountRelated } from '/lib/toolkit.js';
  const boot = async () => {
  const E = await import('/lib/photo-edit.js'), { stripMeta } = await import('/lib/safety.js');
  const $ = (id) => document.getElementById(id), qa = (s, r = document) => [...r.querySelectorAll(s)];
  // ---- EN and DE ----
  const DE = {
    share: 'Dieses Werkzeug teilen', ba: 'Original → Ergebnis', linkcopied: 'Link kopiert',
    title_squoosh: 'Bilder komprimieren und umwandeln', sub_squoosh: 'Wähle Qualität, Format und Größe und ziehe den Regler, um Original und Ergebnis zu vergleichen. JPEG, PNG, WebP und AVIF; die Datei verlässt dieses Gerät nie.',
    title_tinypng: 'Bild-Kompressor: PNG, JPEG und WebP verkleinern', sub_tinypng: 'Viele Fotos hineinziehen, kleiner machen (PNGs bekommen eine Palette mit bis zu 256 Farben) und alle als ein Zip laden. Keine Grenze für Größe oder Anzahl, nichts wird hochgeladen.',
    title_exif: 'Foto-Details prüfen: EXIF-Metadaten ansehen und entfernen', sub_exif: 'Sieh, was ein Foto still mitspeichert (wann, wo, welche Kamera, ihre Seriennummer), und entferne es vor dem Teilen. Oder speichere es als JSON. Nichts wird hochgeladen.',
    uses_h: 'Vor dem Teilen', uses_sell: 'Etwas online verkaufen: Ort und Seriennummer der Kamera entfernen, damit niemand deine Wohnung findet.', uses_trip: 'Ein Urlaubsfoto: Zeit und Ort prüfen, bevor du es postest, während du noch weg bist.', uses_scan: 'Ein gescanntes Dokument: Name des Handys oder Scanners und die Zeit entfernen, bevor du es mailst.',
    title_exifeditor: 'Foto-Metadaten ansehen & entfernen', sub_exifeditor: 'Sehen, was ein Foto speichert (Kamera, Zeit, Ort), und es vor dem Teilen entfernen. Alles auf diesem Gerät.',
    title_photopea: 'Foto-Editor: zuschneiden, anpassen, Text und Zeichnen', sub_photopea: 'Zuschneiden, anpassen, Filter, Text und Zeichnen mit vollständigem Verlauf zum Rückgängigmachen, dann als JPEG, PNG, WebP oder AVIF speichern. Ein Bild auf einmal, ohne Ebenen.',
    title_iloveimg: 'Stapel-Fotowerkzeuge: Größe, Zuschnitt, Drehen, Umwandeln', sub_iloveimg: 'Größe ändern, zuschneiden mit Formen, drehen, umwandeln, Text daraufsetzen und mehrere Bilder auf einmal als Zip. Alles auf diesem Gerät.',
    caps: 'Komprimieren und umwandeln: JPEG, PNG, WebP und AVIF mit Qualitätsregler, Vorher-Nachher-Regler und der gesparten Größe. Größe ändern, zuschneiden mit Formen, drehen und spiegeln. Helligkeit, Kontrast, Sättigung, Weichzeichnen und Schärfen, Filter, Text und Zeichnen mit Rückgängig und Wiederholen. EXIF, GPS und andere Metadaten ansehen und entfernen. Viele Fotos als ein Zip. Fotos einfügen oder hineinziehen. Nichts wird hochgeladen, und es läuft offline.', title: 'Foto-Werkzeuge', sub: 'Fotos komprimieren, umwandeln, bearbeiten und säubern. Alles geschieht auf diesem Gerät: nichts wird hochgeladen, und es läuft offline.', choose: 'Fotos wählen, hierher ziehen oder eins einfügen', drophint: 'JPEG, PNG, WebP, AVIF, GIF, BMP. Mehrere auf einmal ergeben einen Stapel.',
    t_out: 'Komprimieren und umwandeln', t_crop: 'Zuschneiden und drehen', t_adj: 'Anpassen', t_fil: 'Filter', t_draw: 'Zeichnen', t_text: 'Text', t_info: 'EXIF und Datenschutz', undo: 'Rückgängig', redo: 'Wiederholen', reset: 'Alles zurücksetzen', orig: 'Original', res: 'Ergebnis',
    format: 'Format', colours: 'PNG-Farben', quality: 'Qualität', width: 'Breite (px)', height: 'Höhe (px)', save: 'Speichern', zip: 'Alle als Zip laden', stripOnly: 'Nur Metadaten entfernen (gleiche Pixel)', rotl: 'Nach links drehen', rotr: 'Nach rechts drehen', flh: 'Links-rechts spiegeln', flv: 'Oben-unten spiegeln', docrop: 'Zuschnitt anwenden',
    bri: 'Helligkeit', con: 'Kontrast', sat: 'Sättigung', blur: 'Weichzeichnen', sharpen: 'Schärfen', filhint: 'Ein Filter liegt über den Reglern unter Anpassen; Ohne nimmt ihn weg.', colour: 'Farbe', brush: 'Pinselgröße', drawhint: 'Mit Finger oder Maus aufs Foto zeichnen. Rückgängig nimmt den letzten Strich zurück.', txt: 'Text', size: 'Größe', texthint: 'Tippe aufs Foto, wo der Text hin soll.',
    metajson: 'Metadaten als JSON speichern', reenc: 'Eine Kopie aus „Komprimieren und umwandeln“ wird aus den Pixeln neu gezeichnet und trägt nichts davon.', foot: 'Auf diesem Gerät erledigt: Bilder werden nie hochgeladen, gespeicherte Kopien werden aus den Pixeln neu gezeichnet und tragen keine Kamera- oder Ortsdaten, und die Seite öffnet nach einem Besuch offline. Qualität 1 bis 100 ist der Encoder des Browsers; AVIF gibt es, wo dieser Browser es schreiben kann.',
    full: 'Voll (verlustfrei)', saved: 'gespart', bigger: 'größer', same: 'wie das Original', of: 'von', files: 'Fotos', noexif: 'Keine Kamera-, Orts- oder Bearbeitungsdaten in dieser Datei.', carries: 'Diese Datei enthält', none: 'Ohne', loading: 'Wird geladen …', bad: 'Dieses Bild konnte nicht gelesen werden.', cropHint: 'Ziehe den Rahmen; die Ecke unten rechts ändert die Größe.', big: 'Das Foto war sehr groß und wurde verkleinert, um es bearbeiten zu können.', copied: 'Kopie gespeichert', histn: 'Schritte', lossless: 'verlustfrei', stripped: 'Metadaten entfernt', stripnone: 'Für diesen Dateityp geht das nur über „Komprimieren“.', place: 'den Aufnahmeort', time: 'die Aufnahmezeit', cam: 'die Kamera', sn: 'eine Seriennummer', xmp: 'Bearbeitungshinweise (XMP)', iptc: 'Bildunterschrift und Urheber (IPTC)', cmt: 'Textkommentare' };
  const lang = (new URLSearchParams(location.search).get('lang') || (navigator.language || 'en')).toLowerCase().startsWith('de') ? 'de' : 'en'; let L = lang;
  const EN = {}; qa('[data-i]').forEach((e) => { EN[e.dataset.i] = e.textContent; });
  Object.assign(EN, { ba: 'Original → result', linkcopied: 'Link copied', none: 'None', full: 'Full (lossless)', saved: 'saved', bigger: 'bigger', same: 'the same size as the original', of: 'of', files: 'photos', noexif: 'No camera, place or editing data found in this file.', carries: 'This file carries', loading: 'Loading…', bad: 'This picture could not be read.', cropHint: 'Drag the box; the corner at the bottom right resizes it.', big: 'The photo was very large and was scaled down to edit it.', copied: 'Saved', histn: 'steps', stripped: 'Metadata removed', stripnone: 'This file type can only be cleaned through Compress and convert.', place: 'the place it was taken', time: 'when it was taken', cam: 'the camera', sn: 'a serial number', xmp: 'editing notes (XMP)', iptc: 'caption and credit (IPTC)', cmt: 'text comments' });
  const say = (k) => (L === 'de' && DE[k]) || EN[k] || k;
  const T0 = document.title, tr = () => { document.documentElement.lang = L; qa('[data-i]').forEach((e) => { e.textContent = say(e.dataset.i); }); $('lang').textContent = L === 'de' ? 'EN' : 'DE'; $('cols').options[0].textContent = say('full'); $('file').title = say('choose'); document.title = L === 'de' ? $('h1').textContent + ' · Verse' : T0; };
  // ---- state: one entry per photo ----
  const FIL = Object.keys(E.FILTERS); const fbox = $('filters'); FIL.forEach((k) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.f = k; b.setAttribute('aria-pressed', 'false'); b.textContent = k === 'none' ? say('none') : k[0].toUpperCase() + k.slice(1); fbox.append(b); });
  const abox = $('aspects'); E.ASPECTS.forEach(([n, v], i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = String(v); b.setAttribute('aria-pressed', String(i === 0)); b.textContent = n; abox.append(b); });
  const can = (m) => { try { return document.createElement('canvas').toDataURL(m).startsWith('data:' + m); } catch (_) { return false; } };
  const FORMATS = [['keep', 'Original format'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP'], ['image/png', 'PNG']]; if (can('image/avif')) FORMATS.push(['image/avif', 'AVIF']); if (!can('image/webp')) FORMATS.splice(2, 1);
  for (const [v, n] of FORMATS) { const o = document.createElement('option'); o.value = v; o.textContent = n; $('fmt').append(o); }
  let items = [], cur = null, tab = 'out', token = 0, urls = [], aspect = 0, rect = null, sc = { pct: 100, w: 0, h: 0, last: '' }, wantTab = ((t) => (['out', 'crop', 'adj', 'fil', 'draw', 'text', 'info'].includes(t) ? t : ''))(new URLSearchParams(location.search).get('tab') || document.body.dataset.start || '');
  const pv = $('pv'), ov = $('ov'), PV_MAX = 1200;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const clone = (c) => { const n = mk(c.width, c.height); n.getContext('2d').drawImage(c, 0, 0); return n; };
  function snap(it) { return { base: it.base, adj: { ...it.adj } }; }
  function commit(it) { it.hist.push(snap(it)); sync(); }
  function sync() { if (!cur) return; $('undo').disabled = !cur.hist.canUndo; $('redo').disabled = !cur.hist.canRedo; $('histn').textContent = cur.hist.past.length ? cur.hist.past.length + ' ' + say('histn') : ''; }
  async function load(file) {
    const bytes = new Uint8Array(await file.arrayBuffer()); let bmp; try { bmp = await createImageBitmap(file); } catch (_) { bmp = null; }
    if (!bmp) { $('stagehint').textContent = say('bad'); return null; }
    const fit = E.fitWithin(bmp.width, bmp.height), base = mk(fit.w, fit.h); base.getContext('2d').drawImage(bmp, 0, 0, fit.w, fit.h); if (bmp.close) bmp.close();
    const it = { name: file.name || 'photo', size: file.size, type: file.type || '', bytes, meta: E.readMeta(bytes), base, adj: { ...E.DEFAULT_ADJ }, url: URL.createObjectURL(file), scaled: fit.scaled, w: 0, h: 0, pct: 100, out: null };
    it.hist = new E.History(E.historyCap(fit.w, fit.h)).reset({ base, adj: { ...it.adj } }); it.w = fit.w; it.h = fit.h; return it;
  }
  async function add(files) {
    const list = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name)); if (!list.length) return;
    $('stagehint').textContent = say('loading'); $('work').hidden = false;
    for (const f of list) { const it = await load(f); if (it) { items.push(it); thumb(it); if (!cur) select(it); } }
    $('stagehint').textContent = ''; renderFiles(); if (wantTab && cur) { const w = wantTab; wantTab = ''; if (w !== 'out') show(w); else dirty(); } else dirty();
  }
  function thumb(it) { const c = mk(72, 72), s = Math.max(72 / it.base.width, 72 / it.base.height); c.getContext('2d').drawImage(it.base, (72 - it.base.width * s) / 2, (72 - it.base.height * s) / 2, it.base.width * s, it.base.height * s); it.thumb = c.toDataURL('image/jpeg', 0.6); }
  function renderFiles() { const box = $('files'); box.replaceChildren(); if (items.length < 2) return; items.forEach((it, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(it === cur)); b.setAttribute('aria-label', it.name); const im = new Image(); im.alt = ''; im.src = it.thumb; const t = document.createElement('b'); t.textContent = i + 1; b.append(im, t); b.addEventListener('click', () => { select(it); renderFiles(); }); box.append(b); }); $('zip').hidden = false; }
  function select(it) { cur = it; rect = null; layout(); setAdjUi(); draw(); dirty(); sync(); infoPanel(); }
  function setAdjUi() { for (const r of qa('#p-adj input[data-a]')) { r.value = cur.adj[r.dataset.a] || 0; r.parentNode.querySelector('output').textContent = r.value; } qa('#filters button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === (cur.adj.filter || 'none')))); }
  // ---- the live picture: the base, scaled to the screen, with the adjustments on ----
  function paint(target, src, w, h, adj) { target.width = w; target.height = h; const x = target.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h); if (!E.isPlain(adj)) { const id = x.getImageData(0, 0, w, h); E.adjustPixels(id.data, w, h, adj); x.putImageData(id, 0, 0); } }
  function draw() {
    if (!cur) return; const k = Math.min(1, PV_MAX / Math.max(cur.base.width, cur.base.height)), w = Math.max(1, Math.round(cur.base.width * k)), h = Math.max(1, Math.round(cur.base.height * k));
    paint(pv, cur.base, w, h, cur.adj); ov.width = w; ov.height = h; placeOverlay(); showCrop();
  }
  function placeOverlay() { const r = pv.getBoundingClientRect(), s = $('stage').getBoundingClientRect(); ov.style.left = (r.left - s.left) + 'px'; ov.style.top = (r.top - s.top) + 'px'; ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px'; }
  const scaleOf = () => cur.base.width / pv.getBoundingClientRect().width; // picture pixels per screen pixel
  // ---- compress and convert ----
  const mimeOut = () => { const v = $('fmt').value; if (v !== 'keep') return v; const t = cur.meta.kind; return t === 'png' ? 'image/png' : t === 'webp' && can('image/webp') ? 'image/webp' : t === 'avif' && can('image/avif') ? 'image/avif' : 'image/jpeg'; };
  async function encode(it, final) {
    const mime = mimeOut(), size = E.outSize(it.base.width, it.base.height, outReq(it)), c = mk(size.w, size.h), x = c.getContext('2d', { willReadFrequently: true });
    if (mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, size.w, size.h); } x.imageSmoothingQuality = 'high'; x.drawImage(it.base, 0, 0, size.w, size.h);
    let id = null; if (!E.isPlain(it.adj) || (mime === 'image/png' && +$('cols').value)) { id = x.getImageData(0, 0, size.w, size.h); E.adjustPixels(id.data, size.w, size.h, it.adj); x.putImageData(id, 0, 0); }
    const cols = mime === 'image/png' ? +$('cols').value : 0;
    if (cols) { id = id || x.getImageData(0, 0, size.w, size.h); const q = E.quantize(id.data, size.w, size.h, cols); return { mime, w: size.w, h: size.h, bytes: await E.encodeIndexedPng(q.indices, q.palette, size.w, size.h) }; }
    const blob = await new Promise((res) => c.toBlob(res, mime, +$('q').value / 100)); if (!blob) throw new Error('encode'); return { mime: blob.type || mime, w: size.w, h: size.h, bytes: new Uint8Array(await blob.arrayBuffer()) };
  }
  function outReq(it) { if (sc.pct === 1080 || sc.pct === 2048) { const long = Math.max(it.base.width, it.base.height); return it.base.width >= it.base.height ? { w: Math.min(sc.pct, long) } : { h: Math.min(sc.pct, long) }; } if (sc.last === 'w' && sc.w > 0) return { w: sc.w }; if (sc.last === 'h' && sc.h > 0) return { h: sc.h }; return { pct: sc.pct || 100 }; }
  let later = 0; function dirty() { clearTimeout(later); later = setTimeout(refresh, 220); }
  async function refresh() {
    if (!cur) return; const mine = ++token, it = cur;
    $('q').disabled = !(mimeOut() === 'image/jpeg' || mimeOut() === 'image/webp' || mimeOut() === 'image/avif'); $('qrow').style.opacity = $('q').disabled ? '.55' : ''; $('cols').disabled = mimeOut() !== 'image/png'; $('cols').closest('label').hidden = mimeOut() !== 'image/png';
    let r; try { r = await encode(it, false); } catch (_) { $('line').textContent = say('bad'); return; } if (mine !== token) return;
    it.out = r; for (const u of urls) URL.revokeObjectURL(u); urls = []; const url = URL.createObjectURL(new Blob([r.bytes], { type: r.mime })); urls.push(url);
    const a = $('dl'); a.href = url; a.download = E.outName(it.name, r.mime); a.hidden = false; a.textContent = say('save') + ' ' + E.EXT[r.mime].toUpperCase();
    $('w').placeholder = String(r.w); $('h').placeholder = String(r.h);
    const pct = E.savedPct(it.size, r.bytes.length);
    $('line').textContent = say('ba') + ': ' + E.sizeLabel(it.size) + ' → ' + E.sizeLabel(r.bytes.length) + ' · ' + (pct > 0 ? pct + '% ' + say('saved') : pct < 0 ? -pct + '% ' + say('bigger') : say('same')); $('line').className = pct > 0 ? 'ok' : '';
    $('note').textContent = r.w + ' × ' + r.h + ' px · ' + r.mime.replace('image/', '').toUpperCase() + (it.scaled ? ' · ' + say('big') : ''); $('batchnote').textContent = items.length > 1 ? items.length + ' ' + say('files') + ' · ' + say('zip') : '';
    // before and after: the original file against the result, side by side with a slider
    const geo = Math.abs(it.base.width / it.base.height - (it.meta.width || it.base.width) / (it.meta.height || it.base.height)) > 0.01; $('cb').src = geo ? it.base.toDataURL('image/jpeg', 0.9) : it.url; $('ca').src = url; it.out.ready = true; setCmp($('cmpr').value); layout();
  }
  function setCmp(v) { $('ca').style.clipPath = 'inset(0 0 0 ' + v + '%)'; }
  $('cmpr').addEventListener('input', (e) => setCmp(e.target.value)); $('cmp').addEventListener('pointermove', (e) => { if (e.buttons) { const r = $('cmp').getBoundingClientRect(), v = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); $('cmpr').value = v; setCmp(v); } });
  $('q').addEventListener('input', () => { $('qo').textContent = $('q').value; dirty(); });
  for (const id of ['fmt', 'cols']) $(id).addEventListener('change', dirty);
  for (const id of ['w', 'h']) $(id).addEventListener('input', () => { if (!cur) return; sc[id] = +$(id).value || 0; sc.last = id; sc.pct = 0; qa('#pcts button').forEach((b) => b.setAttribute('aria-pressed', 'false')); if (id === 'w') $('h').value = ''; else $('w').value = ''; dirty(); });
  $('pcts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || !cur) return; sc = { pct: +b.dataset.p, w: 0, h: 0, last: '' }; $('w').value = ''; $('h').value = ''; qa('#pcts button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); dirty(); });
  // the batch: every photo with these settings, one zip made here
  $('zip').addEventListener('click', async () => {
    const taken = new Set(), files = [], was = cur; $('zip').disabled = true;
    try { for (const it of items) { cur = it; const r = await encode(it, true); files.push({ name: E.outName(it.name, r.mime, taken), data: r.bytes }); $('batchnote').textContent = files.length + ' ' + say('of') + ' ' + items.length; } } finally { cur = was; $('zip').disabled = false; }
    const blob = new Blob([E.zipStore(files)], { type: 'application/zip' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'verse-photos.zip'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); $('batchnote').textContent = say('copied') + ': verse-photos.zip (' + E.sizeLabel(blob.size) + ')';
  });
  // metadata only: the same pixels, the hidden data cut out of the bytes
  function stripNow() { if (!cur) return; const r = stripMeta(cur.bytes); if (!r.type) { $('priv').textContent = say('stripnone'); return; } const blob = new Blob([r.bytes], { type: r.type === 'png' ? 'image/png' : 'image/jpeg' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = cur.name.replace(/(\.[a-z0-9]+)?$/i, '-clean$1'); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); $('priv').className = 'warn clean'; $('priv').textContent = say('stripped') + ': ' + (r.removed.join(', ') || '–') + ' · ' + E.sizeLabel(r.bytesRemoved); }
  $('stripOnly').addEventListener('click', stripNow); $('stripOnly2').addEventListener('click', stripNow);
  function infoPanel() {
    if (!cur) return; const m = cur.meta, f = []; if (m.has.gps) f.push(say('place')); if (m.items.some((x) => /serial/i.test(x.label))) f.push(say('sn')); if (m.items.some((x) => x.label === 'Taken')) f.push(say('time')); if (m.items.some((x) => /^Camera (make|model)$/.test(x.label))) f.push(say('cam')); if (m.has.xmp) f.push(say('xmp')); if (m.has.iptc) f.push(say('iptc')); if (m.has.comment || m.has.text) f.push(say('cmt'));
    $('priv').className = 'warn' + (f.length ? '' : ' clean'); $('priv').textContent = f.length ? say('carries') + ' ' + f.join(', ') + '.' : say('noexif');
    const t = $('meta'); t.replaceChildren(); const rows = [['File', cur.name], ['Type', (m.kind || cur.type || '?').toUpperCase()], ['Size', E.sizeLabel(cur.size)], ['Dimensions', (m.width || cur.base.width) + ' × ' + (m.height || cur.base.height) + ' px'], ...m.items.map((x) => [x.label, x.value]), ...(m.has.icc ? [['Colour profile', 'embedded (ICC)']] : [])];
    for (const [k, v] of rows) { const tr2 = t.insertRow(), th = document.createElement('th'); th.scope = 'row'; th.textContent = k; tr2.append(th); tr2.insertCell().textContent = v; }
  }
  $('metajson').addEventListener('click', () => { if (!cur) return; const j = { file: cur.name, type: cur.meta.kind, size: cur.size, width: cur.meta.width, height: cur.meta.height, gps: cur.meta.gps, has: cur.meta.has, items: cur.meta.items }, a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' })); a.download = cur.name.replace(/\.[^.]+$/, '') + '-metadata.json'; document.body.append(a); a.click(); a.remove(); });
  // ---- crop and rotate ----
  const crop = $('crop');
  function showCrop() {
    const on = tab === 'crop' && cur; crop.hidden = !on; if (!on) return; if (!rect) rect = E.cropRect(cur.base.width, cur.base.height, aspect);
    const s = $('stage').getBoundingClientRect(), p = pv.getBoundingClientRect(), k = p.width / cur.base.width; crop.style.left = (p.left - s.left + rect.x * k) + 'px'; crop.style.top = (p.top - s.top + rect.y * k) + 'px'; crop.style.width = rect.w * k + 'px'; crop.style.height = rect.h * k + 'px';
    $('stagehint').textContent = say('cropHint') + ' ' + Math.round(rect.w) + ' × ' + Math.round(rect.h);
  }
  let drag = null; crop.addEventListener('pointerdown', (e) => { if (!rect) return; drag = { x: e.clientX, y: e.clientY, r: { ...rect }, size: e.target.tagName === 'I' }; crop.setPointerCapture(e.pointerId); e.preventDefault(); });
  crop.addEventListener('pointermove', (e) => { if (!drag) return; const k = scaleOf(), dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k; rect = drag.size ? E.resizeRect(drag.r, dx, dy, aspect, cur.base.width, cur.base.height) : E.clampRect({ ...drag.r, x: drag.r.x + dx, y: drag.r.y + dy }, cur.base.width, cur.base.height); showCrop(); });
  const up = () => { drag = null; }; crop.addEventListener('pointerup', up); crop.addEventListener('pointercancel', up);
  abox.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || !cur) return; aspect = +b.dataset.v; qa('button', abox).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); rect = E.cropRect(cur.base.width, cur.base.height, aspect); showCrop(); });
  function setBase(c) { cur.base = c; cur.w = c.width; cur.h = c.height; rect = null; commit(cur); thumb(cur); renderFiles(); draw(); dirty(); }
  $('docrop').addEventListener('click', () => { if (!cur || !rect) return; const r = E.clampRect(rect, cur.base.width, cur.base.height), c = mk(r.w, r.h); c.getContext('2d').drawImage(cur.base, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); setBase(c); });
  const turn = (q) => { const s = cur.base, c = q % 2 ? mk(s.height, s.width) : mk(s.width, s.height), x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(q * Math.PI / 2); x.drawImage(s, -s.width / 2, -s.height / 2); setBase(c); };
  $('rotl').addEventListener('click', () => cur && turn(3)); $('rotr').addEventListener('click', () => cur && turn(1));
  const flip = (h) => { const s = cur.base, c = mk(s.width, s.height), x = c.getContext('2d'); x.translate(h ? s.width : 0, h ? 0 : s.height); x.scale(h ? -1 : 1, h ? 1 : -1); x.drawImage(s, 0, 0); setBase(c); };
  $('flh').addEventListener('click', () => cur && flip(true)); $('flv').addEventListener('click', () => cur && flip(false));
  // ---- adjust and filters (the base is untouched; the look is a setting, so Undo and Reset are exact) ----
  for (const r of qa('#p-adj input[data-a]')) r.addEventListener('input', () => { if (!cur) return; cur.adj[r.dataset.a] = +r.value; r.parentNode.querySelector('output').textContent = r.value; clearTimeout(r._t); draw(); r._t = setTimeout(() => { commit(cur); dirty(); }, 400); });
  fbox.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || !cur) return; cur.adj.filter = b.dataset.f; setAdjUi(); draw(); commit(cur); dirty(); });
  // ---- draw: strokes on the overlay, put into the picture when the finger lifts ----
  let pen = null; ov.addEventListener('pointerdown', (e) => { if (tab !== 'draw' && tab !== 'text') return; if (tab === 'text') { placeText(e); return; } ov.setPointerCapture(e.pointerId); const p = pt(e); pen = [p]; e.preventDefault(); });
  const pt = (e) => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) * ov.width / r.width, (e.clientY - r.top) * ov.height / r.height]; };
  ov.addEventListener('pointermove', (e) => { if (!pen) return; pen.push(pt(e)); const x = ov.getContext('2d'); x.clearRect(0, 0, ov.width, ov.height); stroke(x, pen, 1); });
  function stroke(x, pts, k) { x.strokeStyle = $('dcol').value; x.fillStyle = $('dcol').value; x.lineWidth = +$('bsz').value * k; x.lineCap = x.lineJoin = 'round'; x.beginPath(); x.moveTo(pts[0][0] * k, pts[0][1] * k); for (const p of pts.slice(1)) x.lineTo(p[0] * k, p[1] * k); if (pts.length === 1) x.lineTo(pts[0][0] * k + 0.1, pts[0][1] * k); x.stroke(); }
  const endPen = () => { if (!pen || !cur) { pen = null; return; } const k = cur.base.width / ov.width, c = clone(cur.base), x = c.getContext('2d'); const sz = +$('bsz').value; x.strokeStyle = x.fillStyle = $('dcol').value; x.lineWidth = sz * k; x.lineCap = x.lineJoin = 'round'; x.beginPath(); x.moveTo(pen[0][0] * k, pen[0][1] * k); for (const p of pen.slice(1)) x.lineTo(p[0] * k, p[1] * k); if (pen.length === 1) x.lineTo(pen[0][0] * k + 0.1, pen[0][1] * k); x.stroke(); pen = null; ov.getContext('2d').clearRect(0, 0, ov.width, ov.height); setBase(c); };
  ov.addEventListener('pointerup', endPen); ov.addEventListener('pointercancel', endPen);
  $('bsz').addEventListener('input', () => { $('bo').textContent = $('bsz').value; }); $('tsz').addEventListener('input', () => { $('to').textContent = $('tsz').value; });
  function placeText(e) { if (!cur) return; const txt = $('ttxt').value.trim(); if (!txt) return; const [px, py] = pt(e), k = cur.base.width / ov.width, c = clone(cur.base), x = c.getContext('2d'), size = Math.round(c.height * +$('tsz').value / 100);
    x.font = '700 ' + size + 'px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = Math.max(2, size / 8); x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeText(txt, px * k, py * k); x.fillStyle = $('tcol').value; x.fillText(txt, px * k, py * k); setBase(c); }
  // ---- undo, redo, reset ----
  const restore = (s) => { if (!s || !cur) return; cur.base = s.base; cur.adj = { ...s.adj }; cur.w = s.base.width; cur.h = s.base.height; rect = null; setAdjUi(); thumb(cur); renderFiles(); draw(); dirty(); sync(); };
  $('undo').addEventListener('click', () => restore(cur && cur.hist.undo())); $('redo').addEventListener('click', () => restore(cur && cur.hist.redo()));
  $('reset').addEventListener('click', () => { if (!cur) return; const first = cur.hist.past.length ? cur.hist.past[0] : cur.hist.now; cur.hist.push({ base: first.base, adj: { ...E.DEFAULT_ADJ } }); restore(cur.hist.now); });
  addEventListener('keydown', (e) => { if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName)) return; if (e.key === 'z') { e.preventDefault(); (e.shiftKey ? $('redo') : $('undo')).click(); } else if (e.key === 'y') { e.preventDefault(); $('redo').click(); } });
  // ---- tabs ----
  const STAGE_HINT = { draw: 'drawhint', text: 'texthint' };
  // on the Compress tab the before and after slider stands in for the editing canvas once a result exists
  function layout() { const cmp = tab === 'out' && !!cur && !!cur.out; $('cmp').hidden = !cmp; $('cmpr').hidden = !cmp; pv.hidden = cmp; ov.hidden = cmp; }
  function show(t) {
    tab = t; for (const b of qa('#tabs button')) b.setAttribute('aria-pressed', String(b.dataset.t === t)); for (const p of qa('.panel')) p.hidden = p.id !== 'p-' + t && p.id !== 'p-out'; // the compress and convert result stays under every tab
    $('stage').hidden = t === 'info'; layout(); ov.style.pointerEvents = t === 'draw' || t === 'text' ? 'auto' : 'none'; ov.style.cursor = t === 'draw' ? 'crosshair' : t === 'text' ? 'text' : '';
    $('stage').style.touchAction = t === 'draw' || t === 'text' || t === 'crop' ? 'none' : 'pan-y'; $('stagehint').textContent = STAGE_HINT[t] ? say(STAGE_HINT[t]) : '';
    if (t !== 'out') draw(); dirty(); if (t === 'info') infoPanel();
  }
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.t); });
  // ---- getting photos in: choose, drop, paste ----
  $('file').addEventListener('change', (e) => { add(e.target.files); e.target.value = ''; });
  const dz = $('drop'); for (const t of ['dragenter', 'dragover']) addEventListener(t, (e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); dz.classList.add('over'); } });
  for (const t of ['dragleave', 'drop']) addEventListener(t, (e) => { if (t === 'drop') { e.preventDefault(); add(e.dataTransfer.files); } dz.classList.remove('over'); });
  addEventListener('paste', (e) => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); add(fs); } });
  addEventListener('resize', () => { if (cur) { placeOverlay(); showCrop(); } });
  $('share').addEventListener('click', async () => { const u = location.origin + location.pathname + (cur ? '?tab=' + tab : ''); try { if (navigator.share) await navigator.share({ title: document.title, text: $('sub').textContent, url: u }); else { await navigator.clipboard.writeText(u); $('share').textContent = say('linkcopied'); setTimeout(() => { $('share').textContent = say('share'); }, 1600); } } catch (_) {} });
  $('lang').addEventListener('click', () => { L = L === 'de' ? 'en' : 'de'; tr(); fbox.firstChild.textContent = say('none'); if (cur) { refresh(); infoPanel(); } });
  tr(); fbox.firstChild.textContent = say('none');
  window.__photos = { items: () => items, show };
  document.documentElement.dataset.photos = 'ready';
  };
  mountRelated(document.getElementById('related'), '/photos/');
  // the editor loads after the first paint, so the page itself is instant
  if (document.readyState === 'complete') boot(); else addEventListener('load', () => setTimeout(boot, 0));
