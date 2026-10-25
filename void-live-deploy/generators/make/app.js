// /generators/make/'s code, kept out of the page so the page needs no inline-script CSP rule (tools/csp-hashes.mjs budget)
  import { mountRelated } from '/lib/toolkit.js';
  import * as L from '/lib/listgen.js';
  import { mountComments } from '/lib/comments-ui.js';
  import { slices, plan, ease } from '/lib/wheel.js';
  import { aiGeneratorOf } from '/lib/ai-generators.js';
  addEventListener('load', async () => {
    const $ = (id) => document.getElementById(id), q = new URLSearchParams(location.search), embed = q.get('embed') === '1';
    if (embed) document.documentElement.classList.add('embed');
    const KEY = 'a2m.void.listgen.v1';
    let store = { mine: [] };
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s && Array.isArray(s.mine)) store = { mine: s.mine.filter((g) => g && typeof g.text === 'string').slice(0, 100) }; } catch (_) {}
    const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) { say('This browser would not keep it (storage is full or off).'); } };
    const state = { seed: /^\d{1,10}$/.test(q.get('seed') || '') ? +q.get('seed') : L.rng(Date.now())() * 1e9 >>> 0, n: Math.max(1, Math.min(20, +q.get('n') || 5)), localId: null, pubId: null };
    const say = (t) => { $('note').textContent = t || ''; };
    const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch (_) { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (__) {} t.remove(); return true; } };
    let current = [], compiled = null;
    function lineOf(n) { const ta = $('src'), lines = ta.value.split('\n'); let at = 0; for (let i = 0; i < n - 1 && i < lines.length; i++) at += lines[i].length + 1; ta.focus(); ta.setSelectionRange(at, at + (lines[n - 1] || '').length); }
    // imports: published generators by id, fetched once and kept for this visit (three levels deep at most)
    const imported = {}, importedText = {}, loading = new Set();
    async function loadImports(g, depth = 0) {
      if (depth > 2) return;
      await Promise.all((g.imports || []).filter((id) => !imported[id] && !loading.has(id)).map(async (id) => {
        loading.add(id);
        try { const j = await (await fetch('/api/generators?id=' + id)).json(); if (j && j.ok) { importedText[id] = j.text; imported[id] = L.compile(j.text); await loadImports(imported[id], depth + 1); } } catch (_) {}
      }));
    }
    // inputs: what the generator asks before generating ($inputs), drawn as controls; a change makes new results at the same seed
    const chosen = {};
    function drawInputs(g) {
      const box = $('inputs'); box.hidden = !(g.inputs && g.inputs.length); if (box.hidden) { box.replaceChildren(); return; }
      const sig = JSON.stringify(g.inputs); if (box.dataset.sig === sig) return; box.dataset.sig = sig;
      box.replaceChildren(...g.inputs.map((inp) => {
        const lab = document.createElement('label'); lab.className = 'inp'; lab.append(document.createTextNode(inp.name + ' '));
        let el;
        if (inp.kind === 'select') { el = document.createElement('select'); for (const o of inp.options) el.append(new Option(o, o)); }
        else { el = document.createElement('input'); el.type = inp.kind === 'number' ? 'number' : 'text'; if (inp.kind === 'number') { el.min = inp.min; el.max = inp.max; el.inputMode = 'numeric'; } else el.maxLength = 60; }
        el.value = chosen[inp.name] != null ? chosen[inp.name] : inp.def;
        el.addEventListener(inp.kind === 'select' ? 'change' : 'input', () => { chosen[inp.name] = el.value; draw(); });
        lab.append(el); return lab;
      }));
    }
    function draw() {
      compiled = L.compile($('src').value);
      if ((compiled.imports || []).some((id) => !imported[id] && !loading.has(id))) loadImports(compiled).then(() => draw());
      drawInputs(compiled);
      const r = results(compiled); current = r.results;
      $('errs').replaceChildren(...r.errors.slice(0, 8).map((e) => { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = 'line ' + e.line; b.addEventListener('click', () => lineOf(e.line)); li.append(b, document.createTextNode(' ' + e.message)); return li; }));
      $('seed').textContent = 'seed ' + state.seed;
      if (compiled.title && !$('name').value) $('name').placeholder = compiled.title;
      if (r.errors.length && !current.length) { $('res').replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Fix the line marked on the left and the results come back.' })); return; }
      $('res').className = 'res lay-' + ((compiled.meta && compiled.meta.layout) || 'lines');
      $('res').replaceChildren(...current.map((x, i) => row(x, i)));
      $('outH').textContent = (($('name').value || compiled.title || '').trim() || 'Results');
    }
    // each result with its parts (tap a part to roll just that part) and its {ai: ...} texts, filled by the answer model a few at a time
    function results(g) {
      if (g.errors.length) return { results: [], errors: g.errors };
      const out = [];
      for (let i = 0; i < state.n; i++) { const seed = L.seedFor(state.seed, i), r = L.run(g, seed, { imports: imported, inputs: chosen, spans: true, shared: shared.data }); if (r.errors.length) return { results: out, errors: r.errors }; out.push({ ...r, seed }); }
      sendWrites(out);
      return { results: out, errors: [] };
    }
    // a published generator's shared data (functions/api/gen-data.js): read when it opens; its {add:} and {set:} writes are sent once for each
    // new set of results, only while the text is the published one (an edit is your own copy until you publish it)
    const shared = { data: null, text: '', sentFor: '' };
    function sendWrites(out) {
      if (!state.pubId || $('src').value !== shared.text) return;
      const key = state.seed + '|' + state.n; if (shared.sentFor === key) return; shared.sentFor = key;
      const writes = out.flatMap((r) => r.writes || []).slice(0, 5); if (!writes.length) return;
      fetch('/api/gen-data', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: state.pubId, writes }) }).then((r) => r.json()).then((j) => { if (j && j.ok) shared.data = j.data; }).catch(() => {});
    }
    // {wheel: list}: the winner is already in the result; the wheel spins to it when pressed (lib/wheel.js plans the landing)
    const COLORS = ['#6d4aff', '#ff7a59', '#2bb673', '#f5b700', '#3aa0ff', '#e2557b', '#8a6cff', '#00a3a3'];
    function wheelBox(w) {
      const box = document.createElement('div'); box.className = 'wheel'; const c = document.createElement('canvas'); c.width = 320; c.height = 320; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'A wheel of ' + w.entries.length + ': ' + w.entries.map((e) => e.label).join(', ') + '. It lands on ' + w.entries[w.winner].label);
      const sl = slices(w.entries); let rot = 0;
      const paint = () => { const x = c.getContext('2d'); if (!x) return; x.clearRect(0, 0, 320, 320); x.save(); x.translate(160, 160); x.rotate((rot * Math.PI) / 180);
        sl.forEach((s, i) => { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 150, ((s.start - 90) * Math.PI) / 180, ((s.end - 90) * Math.PI) / 180); x.closePath(); x.fillStyle = COLORS[i % COLORS.length]; x.fill();
          x.save(); x.rotate((((s.start + s.end) / 2 - 90) * Math.PI) / 180); x.fillStyle = '#fff'; x.font = '600 13px system-ui'; x.textAlign = 'right'; x.fillText(s.label.slice(0, 18), 140, 4); x.restore(); });
        x.restore(); x.fillStyle = getComputedStyle(document.body).color; x.beginPath(); x.moveTo(150, 2); x.lineTo(170, 2); x.lineTo(160, 22); x.closePath(); x.fill(); };
      const spin = document.createElement('button'); spin.type = 'button'; spin.textContent = 'Spin the wheel';
      spin.addEventListener('click', () => { const to = plan(w.entries, w.winner, rot, 5, 0.5), from = rot, t0 = performance.now(), ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 3200; spin.disabled = true;
        const tick = (now) => { const k = Math.min(1, (now - t0) / ms); rot = from + (to - from) * ease(k); paint(); if (k < 1) requestAnimationFrame(tick); else { spin.disabled = false; spin.textContent = 'Landed on: ' + w.entries[w.winner].label; } }; requestAnimationFrame(tick); });
      paint(); box.append(c, spin); return box;
    }
    const aiDone = new Map(), aiQueue = []; let aiBusy = false;
    const aiKey = (prompt, seed) => seed + '|' + prompt;
    const aiFill = (x) => x.ai.map((p) => { const v = aiDone.get(aiKey(p, x.seed)); if (v === undefined && !aiQueue.some((q) => q.k === aiKey(p, x.seed))) { aiQueue.push({ k: aiKey(p, x.seed), prompt: p, seed: x.seed }); pumpAi(); } return v; });
    async function pumpAi() {
      if (aiBusy || !aiQueue.length) return; aiBusy = true; const job = aiQueue.shift();
      try { const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'aitext', prompt: job.prompt, seed: job.seed }) }); const j = await r.json(); aiDone.set(job.k, j.text || ('(' + (j.say || 'the AI text is resting') + ')')); }
      catch (_) { aiDone.set(job.k, navigator.onLine ? '(the AI text is resting)' : '(AI text needs the internet)'); }
      aiBusy = false; current.forEach((x, i) => { if (x.ai.length && $('res').children[i]) $('res').children[i].replaceWith(row(x, i)); }); pumpAi();
    }
    const plain = (x) => L.aiMarks(L.tidySpans(x.spans).map((p) => p.t).join(''), aiFill(x), '…');
    function row(x, i) {
      const li = document.createElement('li'), t = document.createElement('div'); t.className = 'txt';
      const texts = aiFill(x);
      for (const [k, part] of L.tidySpans(x.spans).entries()) {
        const shown = L.aiMarks(part.t, texts, '…');
        if (part.src !== undefined && shown.trim() && !/\u0005/.test(part.t) && !(part.kind === '{' && /^\s*[aAs]\s*$/.test(part.src))) { // {a}, {A} and {s} follow their words: nothing to roll
          const b = document.createElement('button'); b.type = 'button'; b.className = 'tap'; b.textContent = shown; b.title = 'Tap to roll just this part'; b.setAttribute('aria-label', 'Roll again: ' + shown);
          b.addEventListener('click', () => { const r = L.reroll(compiled, x.spans[k], (L.rng(Date.now() + k)() * 4294967296) >>> 0, { imports: imported, inputs: chosen, vars: x.vars }); if (!r.errors.length) { x.spans[k] = { ...x.spans[k], t: r.t }; const n = row(x, i); li.replaceWith(n); const nb = n.querySelectorAll('.tap')[[...li.querySelectorAll('.tap')].indexOf(b)]; if (nb) nb.focus(); } });
          t.append(b);
        } else t.append(document.createTextNode(shown));
      }
      const acts = document.createElement('div'); acts.className = 'acts';
      const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => fn(b)); acts.append(b); return b; };
      mk('Copy', async (b) => { await copy(plain(x)); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1200); });
      mk('Re-roll this one', () => { const sd = (L.rng(Date.now() + i)() * 4294967296) >>> 0, r = L.run(compiled, sd, { imports: imported, inputs: chosen, spans: true }); r.seed = sd; if (!r.errors.length) { current[i] = r; li.replaceWith(row(current[i], i)); } });
      const pic = document.createElement('a'); pic.className = 'btn'; pic.textContent = 'Picture it →'; pic.href = '/image/?' + new URLSearchParams({ prompt: (x.image ? L.aiMarks(x.image, [], '') : plain(x)).slice(0, 400), go: '1' }); acts.append(pic);
      if ('speechSynthesis' in window) mk('Read aloud', () => { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(plain(x))); } catch (_) {} });
      if (compiled.meta && compiled.meta.layout === 'table') { const cells = plain(x).split(' | '); t.replaceChildren(...cells.map((c) => Object.assign(document.createElement('span'), { textContent: c }))); t.style.cssText = 'display:grid;gap:4px 12px;grid-template-columns:repeat(' + Math.min(6, cells.length) + ',minmax(0,1fr))'; }
      li.append(t); for (const w of x.wheels || []) li.append(wheelBox(w)); if (x.image) { const ip = document.createElement('div'); ip.className = 'imgp'; ip.textContent = 'Picture prompt: ' + x.image; li.append(ip); }
      li.append(acts); return li;
    }
    let timer = 0; $('src').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 200); });
    $('src').addEventListener('keydown', (e) => { if (e.key === 'Tab' && !e.shiftKey && !e.altKey) { e.preventDefault(); const ta = e.target, s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); draw(); } if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } });
    $('name').addEventListener('input', () => { $('outH').textContent = $('name').value.trim() || 'Results'; });
    $('regen').addEventListener('click', () => { state.seed = (L.rng(Date.now())() * 4294967296) >>> 0; draw(); });
    $('n').addEventListener('change', () => { state.n = Math.max(1, Math.min(20, +$('n').value || 5)); $('n').value = state.n; draw(); });
    $('copyAll').addEventListener('click', async () => { await copy(current.map(plain).join('\n')); say('Copied'); });
    // on this device: a list of generators, each keeping its last 10 versions
    function save(silent) {
      const text = $('src').value, title = ($('name').value || (compiled && compiled.title) || 'My generator').trim().slice(0, 60);
      let g = store.mine.find((x) => x.id === state.localId);
      if (!g) { g = { id: 'g' + Date.now().toString(36), title, text, at: Date.now(), versions: [] }; store.mine.unshift(g); state.localId = g.id; }
      else if (g.text !== text) { g.versions = [{ text: g.text, at: g.at }].concat(g.versions || []).slice(0, 10); }
      g.title = title; g.text = text; g.at = Date.now(); keep(); drawMine(); if (!silent) say('Saved in this browser.');
    }
    function drawMine() {
      $('mine').replaceChildren(...(store.mine.length ? store.mine.map((g) => {
        const li = document.createElement('li'), open = document.createElement('button'); open.type = 'button'; open.textContent = g.title || 'Untitled'; open.addEventListener('click', () => load(g.text, g.title, g.id));
        li.append(open);
        if ((g.versions || []).length) { const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Earlier versions of ' + (g.title || 'this generator')); sel.append(new Option('Earlier versions (' + g.versions.length + ')', '')); g.versions.forEach((v, i) => sel.append(new Option(new Date(v.at).toLocaleString(), String(i)))); sel.addEventListener('change', () => { if (sel.value !== '') { load(g.versions[+sel.value].text, g.title, g.id); say('An earlier version is open; save to keep it.'); } }); li.append(sel); }
        const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete'; del.setAttribute('aria-label', 'Delete ' + (g.title || 'this generator')); del.addEventListener('click', () => { if (confirm('Delete "' + g.title + '" from this browser?')) { store.mine = store.mine.filter((x) => x !== g); keep(); drawMine(); } });
        li.append(del); return li;
      }) : [Object.assign(document.createElement('li'), { textContent: 'None yet: "Save on this device" keeps the one you are writing.' })]));
    }
    function load(text, title, localId = null) { $('src').value = text; $('name').value = title || ''; state.localId = localId; draw(); }
    $('save').addEventListener('click', () => save());
    $('new').addEventListener('click', () => { load(L.STARTER, ''); state.pubId = null; $('from').hidden = true; $('remix').hidden = true; $('report').hidden = true; try { history.replaceState(null, '', '/generators/make/'); } catch (_) {} say('A new generator from the starter.'); });
    // share: the whole generator in the link (#g=), nothing stored anywhere
    async function shareLink() { const code = await L.packShare(($('name').value ? '$title = ' + $('name').value.replace(/\n/g, ' ') + '\n' : '') + $('src').value.replace(/^\$title = .*\n?/m, '')); return location.origin + '/generators/make/#g=' + code; }
    $('share').addEventListener('click', async () => { const url = await shareLink(); if (navigator.share) { try { await navigator.share({ title: 'A random generator', url }); return; } catch (_) {} } await copy(url); say('Link copied. It carries the whole generator: ' + url.length + ' characters.'); });
    $('embed').addEventListener('click', async () => { const src = state.pubId ? location.origin + '/gen/' + state.pubId + '?embed=1' : (await shareLink()).replace('/#g=', '/?embed=1#g='); const code = '<iframe src="' + src + '" title="Random generator" width="100%" height="480" style="border:0"></iframe>'; await copy(code); say('Embed code copied: ' + code); });
    $('publish').addEventListener('click', async () => {
      if (compiled && compiled.errors.length) { say('Fix the marked lines first.'); return; }
      if (!confirm('Publish "' + (($('name').value || (compiled && compiled.title) || 'Untitled').trim()) + '" to the hub? Anyone can then see it, play it and remix it.')) return;
      say('Publishing…');
      try { const r = await fetch('/api/generators', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: $('name').value || (compiled && compiled.title) || '', text: $('src').value }) }); const j = await r.json();
        if (j.ok) { state.pubId = j.id; const url = location.origin + '/gen/' + j.id; save(true); await copy(url); say('Published. Its link (copied): ' + url); try { history.replaceState(null, '', '/gen/' + j.id); } catch (_) {} }
        else say(j.error || 'It could not be published just now.'); } catch (_) { say(navigator.onLine ? 'It could not be published just now.' : 'Publishing needs the internet.'); }
    });
    $('remix').addEventListener('click', () => { const t = $('name').value; state.pubId = null; state.localId = null; $('name').value = ('Remix of ' + (t || 'a generator')).slice(0, 60); document.documentElement.classList.remove('embed'); save(true); $('remix').hidden = true; $('report').hidden = true; $('from').textContent = 'A copy of your own: change anything, it is saved in this browser.'; try { history.replaceState(null, '', '/generators/make/'); } catch (_) {} draw(); $('src').focus(); });
    $('report').addEventListener('click', async () => { if (!state.pubId || !confirm('Report this generator as harmful or rude? Three reports take it down until it is looked at.')) return; try { await fetch('/api/generators', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: state.pubId, act: 'report' }) }); } catch (_) {} $('report').textContent = 'Reported'; $('report').disabled = true; });
    // download: one .html file that runs the generator offline, with the engine inside it
    $('download').addEventListener('click', async () => {
      try {
        const engine = await (await fetch('/lib/listgen.js')).text(), title = ($('name').value || (compiled && compiled.title) || 'Random generator').trim();
        const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title><style>body{font:17px/1.5 system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px}li{margin:8px 0;white-space:pre-line}button{font:inherit;padding:8px 16px;border-radius:999px}</style></head><body><h1>' + esc(title) + '</h1><button id="go">Regenerate</button><ol id="res"></ol><p style="font-size:13px;color:#666">Made with Verse, a-to-mind.com/generators/make/</p>'
          + '<script type="application/json" id="gen">' + JSON.stringify({ main: $('src').value, imports: importedText, inputs: chosen }).replace(/</g, '\\u003c') + '<\/script><script type="module">' + engine.replace(/<\/script/gi, '<\\/script') + '\nconst T = JSON.parse(document.getElementById("gen").textContent), I = {}; for (const [k, v] of Object.entries(T.imports || {})) I[k] = compile(v); const go = () => { const r = generate(T.main, (Math.random() * 4294967296) >>> 0, 5, { imports: I, inputs: T.inputs || {} }); document.getElementById("res").replaceChildren(...(r.errors.length ? r.errors.map((e) => "line " + e.line + ": " + e.message) : r.results.map((x) => aiMarks(x.output, [], ""))).map((t) => Object.assign(document.createElement("li"), { textContent: t }))); }; document.getElementById("go").onclick = go; go();<\/script></body></html>';
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) + '.html'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); say('Downloaded: it runs offline in any browser' + (Object.keys(importedText).length ? ', with the ' + Object.keys(importedText).length + ' generator(s) it imports inside it' : '') + ((compiled && /\{\s*ai\s*:/i.test($('src').value)) ? '; its {ai: ...} text needs this site, so the file leaves it out.' : '.'));
      } catch (_) { say('The download needs the page loaded once online.'); }
    });
    // what opens: a published one (?id=), a shared one (#g=), the last one kept here, or the starter
    let opened = false;
    const pathId = (location.pathname.match(/^\/gen\/([a-z2-7]{8})\/?$/) || [])[1]; // a published generator's own link (/gen/<id>, functions/gen/[id].js sets its share card)
    if (pathId && !q.get('id')) q.set('id', pathId);
    if (/^[a-z2-7]{8}$/.test(q.get('id') || '')) {
      try { const j = await (await fetch('/api/generators?id=' + q.get('id'))).json();
        if (j.ok) { shared.text = j.text; try { const d = await (await fetch('/api/gen-data?id=' + j.id)).json(); if (d && d.ok) shared.data = d.data; } catch (_) {} load(j.text, j.title); state.pubId = j.id; opened = true; $('comments').hidden = false; mountComments($('comments'), 'gen:' + j.id); $('remix').hidden = false; $('report').hidden = false; $('from').hidden = false; $('from').textContent = 'From the hub: "' + j.title + '", played ' + j.plays + ' times. Remix to change it.'; fetch('/api/generators', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: j.id, act: 'play' }) }).catch(() => {}); }
        else { $('from').hidden = false; $('from').textContent = 'That generator is not in the hub (it may have been taken down).'; } } catch (_) { $('from').hidden = false; $('from').textContent = 'The hub needs the internet.'; }
    }
    const hash = new URLSearchParams(location.hash.slice(1)).get('g');
    if (!opened && hash) { const text = await L.unpackShare(hash); if (text != null) { const t = text.match(/^\$title = (.*)$/m); load(text, t ? t[1] : ''); opened = true; $('remix').hidden = false; $('from').hidden = false; $('from').textContent = 'A shared generator. Remix to keep your own copy.'; } }
    const tpl = aiGeneratorOf(q.get('t') || ''); // a built-in AI generator (lib/ai-generators.js): opened as a copy to use or change
    if (!opened && tpl) { load(tpl.text, tpl.title); opened = true; $('from').hidden = false; $('from').textContent = 'A built-in AI generator: its names are written by Verse\'s language model, a few a minute. Change anything; save to keep your own.'; }
    if (!opened && store.mine[0]) { load(store.mine[0].text, store.mine[0].title, store.mine[0].id); opened = true; }
    if (!opened) load(L.STARTER, '');
    drawMine();
    if (!embed) mountRelated($('related'), '/generators/');
  });
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)
