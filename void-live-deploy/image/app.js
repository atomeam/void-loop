// /image/'s code, kept out of the page so the page needs no inline-script CSP rule (tools/csp-hashes.mjs budget)
  import { mountRelated } from '/lib/toolkit.js';
  import { STYLES, SHAPES, PER_GO, CHANGE_MAX, EDIT_BYTES, styleOf, shapeOf, editSizeOf } from '/lib/image-gen.js';
import { mountComments } from '/lib/comments-ui.js';
import { sendImage, blobOf } from '/lib/image-handoff.js';
  addEventListener('load', () => {
    const $ = (id) => document.getElementById(id), de = /^de\b/i.test(navigator.language || '');
    const T = de ? { title: 'KI-Bildgenerator', sub: 'Schreib, was du sehen willst. Wähl Stil und Format, dann bis zu vier Bilder auf einmal. Kostenlos, ohne Anmeldung.', prompt: 'Beschreib das Bild', neg: 'Weglassen (optional)', style: 'Stil', shape: 'Format', many: 'Wie viele', seed: 'Seed (gleicher Seed und gleiche Worte ergeben dasselbe Bild)', newSeed: 'Jedes Mal ein neuer Seed', make: 'Bilder machen', painting: 'Wird gemalt', download: 'Herunterladen', again: 'Gleicher Seed', copy: 'Prompt kopieren', animate: 'Animieren', paint: 'Zum Ausmalen', grad: 'Farben als Verlauf', pdf: 'Als PDF speichern', board: 'In einem Forum posten', edit: 'Bearbeiten', resize: 'Größe ändern', keep: 'Behalten', kept: 'Behalten ✓', hide: 'Ausblenden', gal: 'Auf diesem Gerät behalten', clear: 'Galerie leeren', left: 'Bilder heute übrig', copied: 'Kopiert', share: 'In die Galerie', shared: 'In der Galerie ✓', noShare: 'Teilen ging gerade nicht.', vote: 'Stimme', use: 'Diese Worte nehmen', report: 'Melden', reported: 'Gemeldet', reportQ: 'Dieses Bild melden?', pubOff: 'Die Galerie braucht Internet.', pubNone: 'Noch nichts. Teil das erste Bild!', pubH: 'Öffentliche Galerie', offline: 'Für Bilder brauche ich Internet.', change: 'Ändern', changeQ: 'Was soll sich ändern?', changing: 'Wird geändert', changed: 'geändert', noChange: 'Die Änderung ging gerade nicht. Versuch es gleich noch mal.', squares: { square: 'Quadrat', portrait: 'Hochformat', landscape: 'Querformat', wide: 'Breit' } }
      : { title: 'AI image generator', sub: 'Type what you want to see. Pick a style and a shape, then make up to four at a go. Free, no sign-up.', prompt: 'Describe the picture', neg: 'Leave out (optional)', style: 'Style', shape: 'Shape', many: 'How many', seed: 'Seed (the same seed and words make the same picture)', newSeed: 'A new seed each time', make: 'Make pictures', painting: 'Painting', download: 'Download', again: 'Same seed again', copy: 'Copy prompt', animate: 'Animate this', paint: 'Paint by number', grad: 'Its colours as a gradient', pdf: 'Save it as a PDF', board: 'Post it on a board', edit: 'Edit it', resize: 'Resize it', keep: 'Keep', kept: 'Kept ✓', hide: 'Hide', gal: 'Kept on this device', clear: 'Clear the gallery', left: 'pictures left today for everyone', copied: 'Copied', share: 'Share to the gallery', shared: 'In the gallery ✓', noShare: 'It could not be shared just now.', vote: 'Vote', use: 'Use these words', report: 'Report', reported: 'Reported', reportQ: 'Report this picture as unsafe or rude? Three reports take it down until it is looked at.', pubOff: 'The gallery needs the internet.', pubNone: 'Nothing yet. Share the first picture!', pubH: 'Public gallery', offline: 'A picture needs the internet.', change: 'Change it', changeQ: 'What should change?', changing: 'Changing', changed: 'changed', noChange: 'The change did not work just now. Try again in a minute.', squares: { square: 'Square', portrait: 'Portrait', landscape: 'Landscape', wide: 'Wide' } };
    if (de) { document.documentElement.lang = 'de'; document.title = 'KI-Bildgenerator: Text zu Bild, kostenlos · Verse'; }
    $('title').textContent = T.title; $('sub').textContent = T.sub; $('promptL').textContent = T.prompt; $('negL').textContent = T.neg; $('styleH').textContent = T.style; $('shapeH').textContent = T.shape;
    $('manyL').textContent = T.many; $('seedL').textContent = T.seed; $('newSeedL').textContent = T.newSeed; $('make').textContent = T.make; $('galH').textContent = T.gal; $('galClear').textContent = T.clear; $('pubH').textContent = T.pubH; if (de) { $('pubSub').textContent = 'Bilder, die Leute hier gemacht und geteilt haben. Nur jugendfrei; melde alles andere.'; $('pubNew').textContent = 'Neueste'; $('pubTop').textContent = 'Meiste Stimmen'; }
    const q = new URLSearchParams(location.search);
    const state = { style: styleOf(q.get('style') || 'none'), shape: shapeOf(q.get('shape') || 'square') };
    if (q.get('prompt')) $('prompt').value = q.get('prompt').slice(0, 400);
    if (q.get('neg')) $('neg').value = q.get('neg').slice(0, 200);
    if (/^\d{1,9}$/.test(q.get('seed') || '')) { $('seed').value = q.get('seed'); $('newSeed').checked = false; } else $('seed').value = String(Math.floor(Math.random() * 1e9));
    if (/^[1-4]$/.test(q.get('n') || '')) $('many').value = q.get('n');
    const pressed = (box, key) => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.k === key)); };
    for (const [k, s] of Object.entries(STYLES)) { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = de ? s.de : s.en; b.addEventListener('click', () => { state.style = k; pressed($('styles'), k); }); $('styles').append(b); }
    for (const k of Object.keys(SHAPES)) { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = T.squares[k]; b.addEventListener('click', () => { state.shape = k; pressed($('shapes'), k); }); $('shapes').append(b); }
    pressed($('styles'), state.style); pressed($('shapes'), state.shape);
    const say = (t) => { $('note').textContent = t || ''; };
    const copy = async (text) => { try { await navigator.clipboard.writeText(text); } catch (_) {} say(T.copied); setTimeout(() => say(''), 1500); };
    const nameOf = (p) => (p.prompt.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'picture') + '-' + p.seed + (/^data:image\/png/.test(p.img) ? '.png' : '.jpg');
    // the gallery: IndexedDB in this browser (pictures are too big for localStorage); any failure leaves the page working without it
    const DB = 'a2m.void.image.v1';
    const idb = () => new Promise((ok, no) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('pics', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
    const tx = async (mode, fn) => { try { const db = await idb(); return await new Promise((ok, no) => { const t = db.transaction('pics', mode), st = t.objectStore('pics'), r = fn(st); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); } catch (_) { return null; } };
    const galAll = async () => ((await tx('readonly', (st) => st.getAll())) || []).sort((a, b) => b.at - a.at);
    async function drawGal() { const all = await galAll(); $('galBox').hidden = !all.length; $('gal').replaceChildren(...all.map((p) => card(p, true))); }
    $('galClear').addEventListener('click', async () => { await tx('readwrite', (st) => st.clear()); drawGal(); });

    function card(p, kept) {
      const f = document.createElement('figure'), fr = document.createElement('div'), cap = document.createElement('figcaption');
      fr.className = 'frame'; const [w, h] = SHAPES[p.shape] || SHAPES.square; fr.style.aspectRatio = w + ' / ' + h;
      const im = document.createElement('img'); im.src = p.img; im.alt = p.prompt; im.width = w; im.height = h; fr.append(im);
      const pp = document.createElement('div'); pp.className = 'p'; pp.textContent = p.prompt;
      const meta = document.createElement('div'); meta.textContent = 'seed ' + p.seed + ' · ' + (de ? STYLES[p.style].de : STYLES[p.style].en) + ' · ' + T.squares[p.shape] + (p.painter ? ' · ' + (p.painter === 'workers-ai' ? 'Verse' : 'Pollinations') : '') + (p.change ? ' · ' + T.changed + ': ' + p.change : '');
      const acts = document.createElement('div'); acts.className = 'acts';
      const dl = document.createElement('a'); dl.href = p.img; dl.download = nameOf(p); dl.textContent = T.download; acts.append(dl);
      const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => fn(b)); acts.append(b); return b; };
      // "Change it" (functions/api/image.js changeOf): one typed line changes this picture; the server finds it by its reference
      if (p.ref) mk(T.change, () => { const open = cap.querySelector('form.chg'); if (open) { open.querySelector('input').focus(); return; }
        const row = document.createElement('form'), inp = document.createElement('input'), go = document.createElement('button'); row.className = 'chg';
        inp.type = 'text'; inp.maxLength = CHANGE_MAX; inp.placeholder = T.changeQ; inp.setAttribute('aria-label', T.changeQ); go.type = 'submit'; go.textContent = T.change;
        row.append(inp, go); row.addEventListener('submit', (e) => { e.preventDefault(); changeIt(p, inp.value, go); }); cap.append(row); inp.focus(); });
      // a changed picture has no words, style, shape and seed of its own, so the asks that find a picture by them are left off it
      if (!p.change) mk(T.again, () => { $('prompt').value = p.prompt; $('neg').value = p.negative || ''; state.style = p.style; state.shape = p.shape; pressed($('styles'), p.style); pressed($('shapes'), p.shape); $('seed').value = p.seed; $('newSeed').checked = false; $('many').value = '1'; make(); scrollTo({ top: 0, behavior: 'smooth' }); });
      mk(T.copy, () => copy(p.prompt));
      // the video page (/video/): the picture's words, style, shape and seed in the link (the server finds the picture by them); its pixels stay in this tab
      if (!p.change) mk(T.animate, () => { try { sessionStorage.setItem('a2m.void.video.from', JSON.stringify({ prompt: p.prompt, seed: p.seed, img: p.img })); } catch (_) {} location.href = '/video/?' + new URLSearchParams({ from: 'image', pic: p.prompt, ...(p.negative ? { neg: p.negative } : {}), style: p.style, pshape: p.shape, seed: String(p.seed) }); });
      // the picture itself into the paint, photo and resize pages, opened there (lib/image-handoff.js): kept on this device, never sent
      for (const [label, path] of [[T.paint, '/paint/?img=handoff'], [T.edit, '/photos/?img=handoff'], [T.resize, '/resize-image/?img=handoff'], [T.grad, '/gradient/?img=handoff'], [T.pdf, '/pdf/?img=handoff'], [T.board, '/boards/?img=handoff']]) mk(label, (b) => { b.disabled = true; sendImage(path, () => blobOf(p.img), { name: nameOf(p), fromPage: '/image/' }).then((ok) => { b.disabled = false; if (!ok) $('note').textContent = de ? 'Das Bild ließ sich in diesem Browser nicht weitergeben.' : 'This browser could not keep the picture for the next page.'; }); });
      if (kept) mk(T.hide, async () => { await tx('readwrite', (st) => st.delete(p.id)); drawGal(); });
      else { const k = mk(T.keep, async () => { await tx('readwrite', (st) => st.put({ ...p, at: Date.now() })); k.textContent = T.kept; k.setAttribute('aria-pressed', 'true'); drawGal(); }); mk(T.hide, () => f.remove()); }
      if ((p.painter || kept) && !p.change) { const sh = mk(T.share, async () => { sh.disabled = true; try { const j = await (await fetch('/api/gallery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ act: 'share', prompt: p.prompt, negative: p.negative || '', style: p.style, shape: p.shape, seed: p.seed }) })).json(); if (j.ok) { sh.textContent = T.shared; pub(state.pubSort); } else { sh.disabled = false; say(j.error || T.noShare); } } catch (_) { sh.disabled = false; say(T.noShare); } }); }
      cap.append(pp, meta, acts); f.append(fr, cap); return f;
    }
    // the public gallery (functions/api/gallery.js): pictures by their own address, the words shown as text; votes and reports
    state.pubSort = 'new';
    async function pub(sort) {
      state.pubSort = sort; $('pubNew').setAttribute('aria-pressed', String(sort === 'new')); $('pubTop').setAttribute('aria-pressed', String(sort === 'top'));
      let items = []; try { const j = await (await fetch('/api/gallery?sort=' + sort)).json(); items = (j && j.items) || []; } catch (_) { $('pub').replaceChildren(Object.assign(document.createElement('p'), { className: 'note', textContent: T.pubOff })); return; }
      if (!items.length) { $('pub').replaceChildren(Object.assign(document.createElement('p'), { className: 'note', textContent: T.pubNone })); return; }
      $('pub').replaceChildren(...items.map((g) => {
        const f = document.createElement('figure'), fr = document.createElement('div'), cap = document.createElement('figcaption'), [w, h] = SHAPES[g.shape] || SHAPES.square;
        fr.className = 'frame'; fr.style.aspectRatio = w + ' / ' + h; const im = document.createElement('img'); im.loading = 'lazy'; im.src = '/api/gallery?img=' + encodeURIComponent(g.id); im.alt = g.prompt; im.width = w; im.height = h; fr.append(im);
        const pp = document.createElement('div'); pp.className = 'p'; pp.textContent = g.prompt;
        const acts = document.createElement('div'); acts.className = 'acts';
        const vote = document.createElement('button'); vote.type = 'button'; vote.textContent = '▲ ' + g.votes; vote.setAttribute('aria-label', T.vote + ': ' + g.prompt + ' (' + g.votes + ')');
        vote.addEventListener('click', async () => { vote.disabled = true; try { const j = await (await fetch('/api/gallery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.id, act: 'vote' }) })).json(); if (j.ok) vote.textContent = '▲ ' + j.votes; } catch (_) {} });
        const use = document.createElement('button'); use.type = 'button'; use.textContent = T.use; use.addEventListener('click', () => { $('prompt').value = g.prompt; state.style = g.style; state.shape = g.shape; pressed($('styles'), g.style); pressed($('shapes'), g.shape); scrollTo({ top: 0, behavior: 'smooth' }); $('prompt').focus(); });
        const rep = document.createElement('button'); rep.type = 'button'; rep.textContent = T.report; rep.setAttribute('aria-label', T.report + ': ' + g.prompt);
        rep.addEventListener('click', async () => { if (!confirm(T.reportQ)) return; try { await fetch('/api/gallery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: g.id, act: 'report' }) }); } catch (_) {} rep.textContent = T.reported; rep.disabled = true; });
        acts.append(vote, use, rep); cap.append(pp, acts); f.append(fr, cap); return f;
      }));
    }
    $('pubNew').addEventListener('click', () => pub('new')); $('pubTop').addEventListener('click', () => pub('top'));
    // the page's own shrunk copy of a picture for a change: the model takes reference pictures smaller than 512x512 only (lib/image-gen.js)
    const smallOf = (src, size) => new Promise((ok, no) => { const im = new Image(); im.onload = () => { try { const [w, h] = editSizeOf(size), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
      let out = c.toDataURL('image/jpeg', 0.9); if (out.length > EDIT_BYTES * 4 / 3) out = c.toDataURL('image/jpeg', 0.7); ok(out); } catch (e) { no(e); } }; im.onerror = no; im.src = src; });
    async function changeIt(p, text, go) {
      const change = text.trim(); if (!change) { say(T.changeQ); return; }
      if (!navigator.onLine) { say(T.offline); return; }
      go.disabled = true; say(T.changing + '…'); let j = null;
      try { const src = await smallOf(p.img, SHAPES[p.shape] || SHAPES.square), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
        j = await (await fetch('/api/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ act: 'change', ref: p.ref, change, src, lang: de ? 'de' : 'en' }), signal: ctl.signal })).json(); clearTimeout(t); } catch (_) { j = null; }
      go.disabled = false;
      if (j && j.state === 'art' && /^data:image\/(?:jpeg|png);base64,/.test(j.img || '')) { say(''); $('pics').prepend(card({ id: Date.now() + '-c', prompt: p.prompt, negative: p.negative, style: p.style, shape: p.shape, seed: p.seed, img: j.img, painter: j.painter, ref: j.ref, change: (p.change ? p.change + '; ' : '') + change }, false)); left();
        try { $('pics').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch (_) {} }
      else say((j && j.say) || (navigator.onLine ? T.noChange : T.offline));
    }
    async function left() { try { const j = await (await fetch('/api/image')).json(); $('left').textContent = j.off ? '' : j.left + ' ' + T.left; } catch (_) { $('left').textContent = ''; } }
    let going = false;
    async function make() {
      if (going) return; const prompt = $('prompt').value.trim(); if (!prompt) { say(de ? 'Schreib zuerst, was du sehen willst.' : 'Type what you want to see first.'); $('prompt').focus(); return; }
      if (!navigator.onLine) { say(T.offline); return; }
      going = true; $('make').disabled = true; say('');
      if ($('newSeed').checked) $('seed').value = String(Math.floor(Math.random() * 1e9));
      const base = Math.max(0, Math.min(999999999, Math.floor(+$('seed').value || 0))), n = Math.max(1, Math.min(PER_GO, +$('many').value || 1)), negative = $('neg').value.trim(), style = state.style, shape = state.shape;
      try { const u = new URL(location.href); u.search = new URLSearchParams({ prompt, ...(negative ? { neg: negative } : {}), style, shape, seed: String(base), n: String(n) }).toString(); history.replaceState(null, '', u); } catch (_) {}
      const [w, h] = SHAPES[shape], slots = [];
      for (let i = 0; i < n; i++) { const f = document.createElement('figure'), fr = document.createElement('div'); fr.className = 'frame busy'; fr.style.aspectRatio = w + ' / ' + h; fr.textContent = T.painting + '…'; fr.setAttribute('aria-busy', 'true'); f.append(fr); slots.push(f); }
      $('pics').replaceChildren(...slots);
      try { $('pics').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch (_) {}
      for (let i = 0; i < n; i++) {
        const seed = (base + i) % 1e9; let j = null;
        try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000); j = await (await fetch('/api/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, negative, style, shape, seed, lang: de ? 'de' : 'en' }), signal: ctl.signal })).json(); clearTimeout(t); } catch (_) { j = null; }
        if (j && j.state === 'art' && /^data:image\/(?:jpeg|png);base64,/.test(j.img || '')) slots[i].replaceWith(card({ id: Date.now() + '-' + seed, prompt, negative, style, shape, seed, img: j.img, painter: j.painter, ref: j.ref }, false));
        else {
          const why = (j && j.say) || (navigator.onLine ? (de ? 'Der Maler ruht gerade. Versuch es gleich noch mal.' : 'The painter is resting right now. Try again in a minute.') : T.offline);
          const fr = slots[i].firstChild; fr.classList.remove('busy'); fr.removeAttribute('aria-busy'); fr.textContent = why; fr.style.padding = '12px';
          if (j && (j.state === 'refused' || j.why === 'cap' || j.why === 'mine' || j.why === 'off')) { for (let k = i + 1; k < n; k++) slots[k].remove(); say(why); break; }
        }
      }
      going = false; $('make').disabled = false; left();
    }
    $('make').addEventListener('click', make);
    $('prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) make(); });
    // the layer maker loads when it is opened (image/layers.js): stacks pictures already on this page, never uploads
    let lm = null; $('layersBox').addEventListener('toggle', async () => { if (!$('layersBox').open) return; try { if (!lm) lm = (await import('/image/layers.js')).mountLayers($('layers')); else lm.refreshPicks(); } catch (_) { $('layers').textContent = navigator.onLine ? 'The layer maker did not load.' : 'The layer maker needs this page opened once online.'; } });
    drawGal(); left(); pub('new'); mountComments($('comments'), 'image', { de });
    mountRelated($('related'), '/image/');
    if (q.get('go') === '1' && $('prompt').value.trim()) make();
  });
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)
