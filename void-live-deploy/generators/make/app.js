// /generators/make/'s code, kept out of the page so the page needs no inline-script CSP rule (tools/csp-hashes.mjs budget)
  import { mountRelated } from '/lib/toolkit.js';
  import * as L from '/lib/listgen.js';
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
    function draw() {
      compiled = L.compile($('src').value);
      const r = L.generate(compiled, state.seed, state.n); current = r.results;
      $('errs').replaceChildren(...r.errors.slice(0, 8).map((e) => { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = 'line ' + e.line; b.addEventListener('click', () => lineOf(e.line)); li.append(b, document.createTextNode(' ' + e.message)); return li; }));
      $('seed').textContent = 'seed ' + state.seed;
      if (compiled.title && !$('name').value) $('name').placeholder = compiled.title;
      if (r.errors.length && !current.length) { $('res').replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Fix the line marked on the left and the results come back.' })); return; }
      $('res').replaceChildren(...current.map((x, i) => row(x, i)));
      $('outH').textContent = (($('name').value || compiled.title || '').trim() || 'Results');
    }
    function row(x, i) {
      const li = document.createElement('li'), t = document.createElement('div'); t.className = 'txt'; t.textContent = x.output;
      const acts = document.createElement('div'); acts.className = 'acts';
      const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => fn(b)); acts.append(b); return b; };
      mk('Copy', async (b) => { await copy(li.querySelector('.txt').textContent); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1200); });
      mk('Re-roll this one', () => { const r = L.run(compiled, (L.rng(Date.now() + i)() * 4294967296) >>> 0); if (!r.errors.length) { current[i] = { output: r.output, image: r.image }; li.replaceWith(row(current[i], i)); } });
      const pic = document.createElement('a'); pic.className = 'btn'; pic.textContent = 'Picture it →'; pic.href = '/image/?' + new URLSearchParams({ prompt: (x.image || x.output).slice(0, 400), go: '1' }); acts.append(pic);
      if ('speechSynthesis' in window) mk('Read aloud', () => { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(li.querySelector('.txt').textContent)); } catch (_) {} });
      li.append(t); if (x.image) { const ip = document.createElement('div'); ip.className = 'imgp'; ip.textContent = 'Picture prompt: ' + x.image; li.append(ip); }
      li.append(acts); return li;
    }
    let timer = 0; $('src').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 200); });
    $('src').addEventListener('keydown', (e) => { if (e.key === 'Tab' && !e.shiftKey && !e.altKey) { e.preventDefault(); const ta = e.target, s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); draw(); } if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } });
    $('name').addEventListener('input', () => { $('outH').textContent = $('name').value.trim() || 'Results'; });
    $('regen').addEventListener('click', () => { state.seed = (L.rng(Date.now())() * 4294967296) >>> 0; draw(); });
    $('n').addEventListener('change', () => { state.n = Math.max(1, Math.min(20, +$('n').value || 5)); $('n').value = state.n; draw(); });
    $('copyAll').addEventListener('click', async () => { await copy(current.map((x) => x.output).join('\n')); say('Copied'); });
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
    $('embed').addEventListener('click', async () => { const src = state.pubId ? location.origin + '/generators/make/?id=' + state.pubId + '&embed=1' : (await shareLink()).replace('/#g=', '/?embed=1#g='); const code = '<iframe src="' + src + '" title="Random generator" width="100%" height="480" style="border:0"></iframe>'; await copy(code); say('Embed code copied: ' + code); });
    $('publish').addEventListener('click', async () => {
      if (compiled && compiled.errors.length) { say('Fix the marked lines first.'); return; }
      if (!confirm('Publish "' + (($('name').value || (compiled && compiled.title) || 'Untitled').trim()) + '" to the hub? Anyone can then see it, play it and remix it.')) return;
      say('Publishing…');
      try { const r = await fetch('/api/generators', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: $('name').value || (compiled && compiled.title) || '', text: $('src').value }) }); const j = await r.json();
        if (j.ok) { state.pubId = j.id; const url = location.origin + '/generators/make/?id=' + j.id; save(true); await copy(url); say('Published. Its link (copied): ' + url); try { history.replaceState(null, '', '/generators/make/?id=' + j.id); } catch (_) {} }
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
          + '<script type="application/json" id="gen">' + JSON.stringify($('src').value).replace(/</g, '\\u003c') + '<\/script><script type="module">' + engine.replace(/<\/script/gi, '<\\/script') + '\nconst T = JSON.parse(document.getElementById("gen").textContent); const go = () => { const r = generate(T, (Math.random() * 4294967296) >>> 0, 5); document.getElementById("res").replaceChildren(...(r.errors.length ? r.errors.map((e) => "line " + e.line + ": " + e.message) : r.results.map((x) => x.output)).map((t) => Object.assign(document.createElement("li"), { textContent: t }))); }; document.getElementById("go").onclick = go; go();<\/script></body></html>';
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) + '.html'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); say('Downloaded: it runs offline in any browser.');
      } catch (_) { say('The download needs the page loaded once online.'); }
    });
    // what opens: a published one (?id=), a shared one (#g=), the last one kept here, or the starter
    let opened = false;
    if (/^[a-z2-7]{8}$/.test(q.get('id') || '')) {
      try { const j = await (await fetch('/api/generators?id=' + q.get('id'))).json();
        if (j.ok) { load(j.text, j.title); state.pubId = j.id; opened = true; $('remix').hidden = false; $('report').hidden = false; $('from').hidden = false; $('from').textContent = 'From the hub: "' + j.title + '", played ' + j.plays + ' times. Remix to change it.'; fetch('/api/generators', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: j.id, act: 'play' }) }).catch(() => {}); }
        else { $('from').hidden = false; $('from').textContent = 'That generator is not in the hub (it may have been taken down).'; } } catch (_) { $('from').hidden = false; $('from').textContent = 'The hub needs the internet.'; }
    }
    const hash = new URLSearchParams(location.hash.slice(1)).get('g');
    if (!opened && hash) { const text = await L.unpackShare(hash); if (text != null) { const t = text.match(/^\$title = (.*)$/m); load(text, t ? t[1] : ''); opened = true; $('remix').hidden = false; $('from').hidden = false; $('from').textContent = 'A shared generator. Remix to keep your own copy.'; } }
    if (!opened && store.mine[0]) { load(store.mine[0].text, store.mine[0].title, store.mine[0].id); opened = true; }
    if (!opened) load(L.STARTER, '');
    drawMine();
    if (!embed) mountRelated($('related'), '/generators/');
  });
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)
