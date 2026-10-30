// /boards/'s module (owner, 2026-10-25: "Let's go after the chans next"): everything after the first paint. The page itself is static words and
// forms only; this file is imported once the load event has fired (boards/index.html), so nothing it fetches (the toolkit, lib/boards.js, the board
// list, Turnstile or the proof of work) holds the load event back. The server half is functions/api/boards/[[path]].js; tests tools/boards.test.mjs.
(async () => {
    const [{ mountRelated }, B] = await Promise.all([import('/lib/toolkit.js'), import('/lib/boards.js')]);
    const $ = (id) => document.getElementById(id), KEY = 'a2m.void.boards.v1', API = '/api/boards';
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const q = new URLSearchParams(location.search);
    let me = { adult: false, watch: {}, mine: {}, name: '', pw: '', filter: [], hide: {} };
    try { me = { ...me, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) {}
    const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(me)); } catch (_) {} };
    if (!me.pw) { const r = new Uint8Array(12); crypto.getRandomValues(r); me.pw = [...r].map((x) => x.toString(16).padStart(2, '0')).join(''); keep(); } // this device's delete password: sent with each post, kept by Verse only as a keyed hash
    let owner = (() => { try { return localStorage.getItem('a2m.void.owner.v1') || ''; } catch (_) { return ''; } })();
    const auth = owner ? { authorization: 'Bearer ' + owner } : {};
    // the owner's signed-in account brings an owner session (lib/owner-link.js); later calls carry it
    import('/lib/owner-link.js').then((m) => m.ownerLink()).then((t) => { if (t && t !== owner) { owner = t; auth.authorization = 'Bearer ' + t; } }).catch(() => {});
    const api = async (qs, init = {}) => { let r; try { r = await fetch(API + qs, { ...init, headers: { ...auth, ...(init.headers || {}) } }); } catch (_) { return { status: 0, ok: false, say: 'The boards could not be reached. Check the connection and try again.' }; } let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, ...j }; };
    const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };
    const when = (t) => new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
    const link = (b, t, no) => '/boards/?b=' + b + (t ? '&t=' + t : '') + (no ? '#p' + no : '');
    const code = (q.get('b') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10), tno = +(q.get('t') || 0) || 0;

    // ---- the bot check: Turnstile when the site has it, else a proof of work done in the background ----
    let cfg = null; const cfgP = api('?config').then((c) => (cfg = c)).catch(() => (cfg = {}));
    let tsLoad = null; const turnstile = () => tsLoad || (tsLoad = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = () => res(window.turnstile); s.onerror = rej; document.head.append(s); }));
    function botFor(box) { // returns { proof(): Promise<proof>, reset() }
      let token = '', wid = null, work = null;
      const startWork = () => work || (work = (async () => { const c = await api('?challenge'); if (!c.ok) throw new Error(c.say || 'no challenge'); box.textContent = 'Checking you are a person on this device…'; const n = await B.doWork(c.c, c.bits); box.textContent = 'Checked: you can post.'; return { c: c.c, sig: c.sig, n }; })());
      const ready = cfgP.then(async () => {
        if (cfg && cfg.turnstile) { const ts = await turnstile(); wid = ts.render(box, { sitekey: cfg.turnstile, callback: (t) => { token = t; }, 'expired-callback': () => { token = ''; } }); }
        else { box.textContent = 'A short check that you are a person runs on this device while you write.'; startWork().catch(() => {}); }
      });
      return {
        async proof() { await ready; if (cfg && cfg.turnstile) { if (!token) throw new Error('finish the check above first'); return { turnstile: token }; } return startWork(); },
        reset() { if (cfg && cfg.turnstile) { token = ''; try { window.turnstile.reset(wid); } catch (_) {} } else { work = null; startWork().catch(() => {}); } },
      };
    }

    // ---- a picture made safe on this device: drawn again (which drops every hidden field: camera, time, GPS) and a thumbnail made ----
    const blobOf = (cv, type, qy) => new Promise((r) => cv.toBlob(r, type, qy));
    async function prepare(file) {
      if (!B.TYPES[file.type]) throw new Error('only JPEG, PNG, GIF and WebP pictures');
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const draw = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h); return cv; };
      let out = file;
      if (file.type !== 'image/gif') { // a GIF keeps its frames; the server strips its comments
        let k = Math.min(1, 4096 / Math.max(bmp.width, bmp.height)), cv = draw(Math.round(bmp.width * k), Math.round(bmp.height * k));
        out = await blobOf(cv, file.type, 0.92);
        while (out && out.size > B.LIMITS.file && k > 0.1) { k *= 0.8; cv = draw(Math.round(bmp.width * k), Math.round(bmp.height * k)); out = await blobOf(cv, 'image/jpeg', 0.85); }
      }
      if (!out || out.size > B.LIMITS.file) throw new Error('the picture is over 4 MB even made smaller');
      const t = Math.min(1, B.LIMITS.thumbPx / Math.max(bmp.width, bmp.height)), thumb = await blobOf(draw(Math.max(1, Math.round(bmp.width * t)), Math.max(1, Math.round(bmp.height * t))), 'image/jpeg', 0.8);
      return { file: out, thumb, name: String(file.name || 'picture').replace(/\.[a-z0-9]+$/i, '') + '.' + B.TYPES[out.type || file.type] };
    }

    // ---- one post ----
    const mine = (b) => new Set(me.mine[b] || []);
    function postEl(p, b, board, opts = {}) {
      const a = el('article', 'post' + (p.op ? ' op' : '')); if (!opts.preview) a.id = 'p' + p.no; a.dataset.no = p.no;
      if (mine(b).has(p.no)) a.classList.add('mine');
      if (p.hidden && !owner) { a.append(el('p', 'hiddenpost', 'No. ' + p.no + ': hidden while it is looked at (reported).')); return a; }
      const fw = !opts.preview && !opts.shown && ((me.hide[b + '/' + p.no] && 'you hid it') || (me.filter || []).find((w) => w && (String(p.body || '') + ' ' + String(p.sub || '')).toLowerCase().includes(w.toLowerCase())));
      if (fw) { const line = el('p', 'filtered', 'No. ' + p.no + ' folded away (' + (fw === 'you hid it' ? fw : 'your filter: ' + fw) + '). '), sh = el('button', '', 'Show'); sh.type = 'button'; sh.onclick = () => { delete me.hide[b + '/' + p.no]; keep(); a.replaceWith(postEl(p, b, board, { ...opts, shown: true })); }; line.append(sh); a.append(line); return a; }
      if (p.hidden) a.append(el('p', 'hiddenpost', 'Hidden from everyone but you: ' + (p.reports || 0) + ' reports. Restore it or delete it.'));
      const h = el('div', 'ph');
      if (p.sub) h.append(el('span', 'subj', p.sub));
      h.append(el('span', 'nm', p.name || 'Anonymous')); if (p.trip) { const t = el('span', 'trip', p.trip); t.title = 'A tripcode: the same password always signs the same way'; h.append(t); }
      if (p.id) { const u = el('span', 'uid', 'ID ' + p.id); u.title = 'This poster\u2019s ID in this thread today'; h.append(u); }
      if (mine(b).has(p.no)) h.append(el('span', 'badge', 'You'));
      const tm = el('time', '', when(p.at)); tm.dateTime = new Date(p.at).toISOString(); h.append(tm);
      const num = el('a', 'num', 'No. ' + p.no); num.href = link(b, p.thread, p.no); num.title = 'Quote this post in a reply'; num.dataset.n = p.no; h.append(num);
      if (p.op && p.locked) h.append(el('span', 'badge', 'locked')); if (p.op && p.archived) h.append(el('span', 'badge', 'archived'));
      a.append(h);
      if (p.file) a.append(fileEl(p, board));
      const bq = el('blockquote', 'body'); bq.innerHTML = B.render(p.body, { here: b }); // void-review: ok: B.render escapes every character it is given
      for (const x of bq.querySelectorAll('a.ql[data-q]')) { if (p.thread && +x.dataset.q === p.thread) x.textContent += ' (OP)'; if (mine(b).has(+x.dataset.q)) x.textContent += ' (You)'; }
      a.append(bq, el('div', 'backs'));
      if (!opts.preview) {
        const acts = el('div', 'acts');
        const btn = (t, f, title) => { const x = el('button', '', t); x.type = 'button'; if (title) x.title = title; x.addEventListener('click', f); acts.append(x); };
        if (opts.reply) btn('Reply', () => opts.reply(p.no), 'Quote this post in a reply');
        btn('Report', () => reportPost(b, p.no, a), 'Tell the owner this post breaks a rule'); btn('Share', () => share(b, p), 'A link to this post');
        btn('Hide', () => { me.hide[b + '/' + p.no] = 1; keep(); a.replaceWith(postEl(p, b, board, opts)); }, 'Fold this post away on this device');
        if (mine(b).has(p.no)) btn('Delete mine', async () => { if (!confirm('Take back No. ' + p.no + (p.op ? ' and its whole thread' : '') + '?')) return; const r = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'delete-own', b, no: p.no, password: me.pw }) }); if (r.ok) (p.op ? (location.href = link(b)) : reload()); else alert(r.say || 'Not deleted'); }, 'Take back your own post (this device keeps its delete password)');
        a.append(acts); if (owner) a.append(modActs(p, b));
      }
      return a;
    }
    function fileEl(p, board) {
      const f = el('figure', 'file'), cap = el('figcaption', '', p.file.name + ' (' + size(p.file.size || 0) + ', ' + p.file.w + '×' + p.file.h + ')');
      const img = el('img'); img.alt = 'Picture posted with No. ' + p.no; img.loading = 'lazy'; img.decoding = 'async'; img.src = p.file.thumb; if (p.file.tw) { img.width = p.file.tw; img.height = p.file.th; }
      const open = () => { const on = f.classList.toggle('open'); img.src = on ? p.file.src : p.file.thumb; if (on) { img.removeAttribute('width'); img.removeAttribute('height'); } };
      img.addEventListener('click', open);
      if (p.spoiler) { const s = el('button', 'spoil', 'Spoiler picture: tap to show'); s.type = 'button'; s.addEventListener('click', () => { s.replaceWith(img); }); f.append(cap, s); }
      else if (board && board.nsfw && (board.blur || opts18())) { img.classList.add('blur'); img.title = 'An 18+ picture: tap to show'; img.addEventListener('click', (e) => { if (img.classList.contains('blur')) { e.stopImmediatePropagation(); img.classList.remove('blur'); } }, { capture: true }); f.append(cap, img); }
      else f.append(cap, img);
      return f;
    }
    const opts18 = () => !me.adult; // an 18+ picture is blurred where the 18+ question was not answered yes, and always on the pages for every board (search)
    function modActs(p, b) {
      const acts = el('div', 'acts'); acts.append(el('span', 'badge', 'owner'));
      const go = (t, body, sure) => { const x = el('button', '', t); x.type = 'button'; x.addEventListener('click', async () => { if (sure && !confirm(sure)) return; const r = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'mod', b, no: p.no, ...body }) }); x.textContent = r.ok ? 'Done' : (r.say || 'Refused'); if (r.ok) setTimeout(reload, 500); }); acts.append(x); };
      go('Delete', { act: 'delete' }, 'Delete No. ' + p.no + (p.op ? ' and its whole thread' : '') + '? Its picture is held out of public reach.');
      if (p.file) go('Delete picture', { act: 'delete-file' }); if (p.hidden || p.reports) go('Restore', { act: 'restore' });
      go('Ban 3 days', { act: 'ban', days: 3, why: 'broke the rules' }, 'Ban whoever posted No. ' + p.no + ' for 3 days?');
      if (p.op) go(p.locked ? 'Unlock' : 'Lock', { act: p.locked ? 'unlock' : 'lock' });
      return acts;
    }
    async function share(b, p) {
      const url = location.origin + '/boards/t/' + b + '/' + p.no, title = '/' + b + '/ · ' + (p.sub || 'No. ' + p.no);
      if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (_) {} }
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (_) { prompt('The link to this post', url); }
    }
    let toastT = null; const toast = (t) => { const n = $('updNote'); n.textContent = t; clearTimeout(toastT); toastT = setTimeout(() => { if (n.textContent === t) n.textContent = ''; }, 2500); };
    function reportPost(b, no, art) {
      if (art.querySelector('.rep')) return;
      const f = el('form', 'panel rep'); f.append(el('p', 'note', 'Why does No. ' + no + ' break the rules? Three reports hide it until it is looked at.'));
      for (const w of (cfg && cfg.why) || []) { const l = el('label', 'ck'), r = el('input'); r.type = 'radio'; r.name = 'why'; r.value = w; l.append(r, document.createTextNode(' ' + w)); f.append(l); }
      const box = el('div', 'bot'), bot = botFor(box), row = el('div', 'row'), send = el('button', 'go', 'Report'), x = el('button', '', 'Cancel'), note = el('p', 'note'); send.type = 'submit'; x.type = 'button';
      row.append(send, x); f.append(box, row, note); art.append(f); x.addEventListener('click', () => f.remove());
      f.addEventListener('submit', async (e) => { e.preventDefault(); const why = (f.querySelector('input[name=why]:checked') || {}).value; if (!why) { note.textContent = 'Pick a reason.'; return; }
        send.disabled = true; try { const proof = await bot.proof(); const r = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'report', b, no, why, proof }) }); note.textContent = r.say || (r.ok ? 'Reported.' : 'Not sent.'); if (r.ok) setTimeout(() => { f.remove(); if (r.hidden) reload(); }, 1500); else { bot.reset(); send.disabled = false; } } catch (err) { note.textContent = err.message; send.disabled = false; } });
    }
    // backlinks: under each post, the posts that quote it
    function backlinks(root, b) {
      const by = new Map();
      for (const a of root.querySelectorAll('article.post[data-no]')) for (const x of a.querySelectorAll('blockquote a.ql[data-q]')) { const k = +x.dataset.q; if (!by.has(k)) by.set(k, new Set()); by.get(k).add(+a.dataset.no); }
      for (const [k, set] of by) { const t = root.querySelector('#p' + k + ' .backs'); if (!t) continue; t.replaceChildren(document.createTextNode('Replies: ')); for (const n of set) { const x = el('a', 'ql', '>>' + n); x.href = link(b, tno, n); x.dataset.q = n; t.append(x); } }
    }

    // ---- quote previews: hover with a mouse, tap on a phone (shown under the quote, tap again to go) ----
    let lastPointer = 'mouse'; addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);
    const pop = $('pop');
    const target = (x) => document.getElementById('p' + x.dataset.q);
    document.addEventListener('pointerover', (e) => { const x = e.target.closest && e.target.closest('a.ql[data-q]'); if (!x || e.pointerType !== 'mouse') return; const t = target(x); if (!t) return;
      const c = t.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('.acts,.rep').forEach((n) => n.remove()); pop.replaceChildren(c); pop.hidden = false; t.classList.add('hl');
      const r = x.getBoundingClientRect(), ph = pop.offsetHeight; pop.style.left = Math.min(r.left, innerWidth - pop.offsetWidth - 12) + 'px'; pop.style.top = (r.bottom + ph + 8 > innerHeight ? Math.max(8, r.top - ph - 8) : r.bottom + 6) + 'px'; });
    document.addEventListener('pointerout', (e) => { const x = e.target.closest && e.target.closest('a.ql[data-q]'); if (!x) return; pop.hidden = true; const t = target(x); if (t) t.classList.remove('hl'); });
    document.addEventListener('click', (e) => {
      const sp = e.target.closest && e.target.closest('.sp'); if (sp) { sp.classList.toggle('on'); return; }
      const num = e.target.closest && e.target.closest('a.num[data-n]'); if (num && replyTo) { e.preventDefault(); replyTo(+num.dataset.n); return; }
      const x = e.target.closest && e.target.closest('a.ql[data-q]'); if (!x) return; const t = target(x); if (!t) return; // another thread: the link finds it
      e.preventDefault();
      if (lastPointer !== 'mouse') { const next = x.nextElementSibling; if (next && next.classList.contains('inl')) { next.remove(); return; } const c = t.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('.acts,.rep').forEach((n) => n.remove()); const w = el('div', 'inl'); const go = el('a', '', 'Go to No. ' + x.dataset.q); go.href = '#p' + x.dataset.q; w.append(c, go); x.after(w); return; }
      t.scrollIntoView({ block: 'center' }); t.classList.add('hl'); setTimeout(() => t.classList.remove('hl'), 1500); history.replaceState(null, '', '#p' + x.dataset.q);
    });

    // ---- the post form (a new thread or a reply) ----
    let replyTo = null;
    function postForm(host, b, board, t) {
      const f = $('formT').content.firstElementChild.cloneNode(true); host.replaceChildren(f);
      const box = f.querySelector('.bot'), bot = botFor(box), note = f.querySelector('.note'), send = f.querySelector('button[type=submit]');
      if (t) f.querySelector('.sub-f').hidden = true; if (board.textOnly) f.querySelectorAll('.file-f').forEach((n) => (n.hidden = true));
      f.elements.name.value = me.name || '';
      const sg = f.elements.sage, op = f.elements.options, hasSage = () => /(^|\s)sage(\s|$)/i.test(op.value); // the plain box and the typed options stay in step
      sg.addEventListener('change', () => { const rest = op.value.replace(/(^|\s)sage(?=\s|$)/ig, ' ').trim(); op.value = sg.checked ? (rest ? rest + ' sage' : 'sage') : rest; });
      op.addEventListener('input', () => { sg.checked = hasSage(); });
      f.querySelector('.x').addEventListener('click', () => { host.replaceChildren(); if (t) $('replyBar').hidden = false; });
      f.querySelector('.pv').addEventListener('click', () => { const pv = f.querySelector('.preview'); pv.replaceChildren(postEl({ no: 0, thread: t, at: Date.now(), name: B.parseName(f.elements.name.value).name, sub: t ? '' : f.elements.sub.value, body: B.cleanText(f.elements.body.value, B.LIMITS.body) }, b, board, { preview: true })); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); note.classList.remove('bad'); send.disabled = true;
        try {
          const data = { do: 'post', b, t, password: me.pw, name: f.elements.name.value, options: f.elements.options.value, sub: t ? '' : f.elements.sub.value, body: f.elements.body.value, spoiler: f.elements.spoiler.checked };
          const file = !board.textOnly && f.elements.file.files[0];
          if (!t && !board.textOnly && !file) throw new Error('a new thread here starts with a picture');
          note.textContent = file ? 'Making the picture safe…' : 'Checking…';
          const prep = file ? await prepare(file) : null; data.proof = await bot.proof(); note.textContent = 'Posting…';
          let init;
          if (prep) { const fd = new FormData(); fd.append('data', JSON.stringify(data)); fd.append('file', prep.file, prep.name); fd.append('thumb', prep.thumb, 'thumb.jpg'); init = { method: 'POST', body: fd }; }
          else init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) };
          const r = await api('', init);
          if (!r.ok) { bot.reset(); throw new Error(r.say || 'not posted'); }
          me.name = f.elements.name.value.split('#')[0]; (me.mine[b] = me.mine[b] || []).push(r.no); me.mine[b] = me.mine[b].slice(-300);
          if (!t || /\bwatch\b/i.test(data.options)) watchSet(b, r.thread, data.sub || B.excerpt(data.body, 60), true);
          keep(); f.reset(); f.elements.name.value = me.name; bot.reset(); note.textContent = 'Posted: No. ' + r.no;
          if (!t) location.href = link(b, r.thread); else { await update(true); const n = $('p' + r.no); if (n) n.scrollIntoView({ block: 'center' }); }
        } catch (err) { note.textContent = err.message; note.classList.add('bad'); }
        finally { send.disabled = false; }
      });
      return f;
    }

    // ---- the watcher: threads kept on this device, their new replies counted ----
    function watchSet(b, t, sub, on, last = 0) { const k = b + '/' + t; if (on) me.watch[k] = { b, t, sub: String(sub || '').slice(0, 80), last: last || (me.watch[k] && me.watch[k].last) || 0 }; else delete me.watch[k]; const ks = Object.keys(me.watch); if (ks.length > 30) delete me.watch[ks[0]]; keep(); }
    async function drawWatching() {
      const ks = Object.keys(me.watch); $('watchH').hidden = $('watching').hidden = !ks.length; const ul = $('watching'); ul.replaceChildren();
      for (const k of ks) { const w = me.watch[k], li = el('li'), m = el('div', 'main'), a = el('a', 'title', '/' + w.b + '/ ' + (w.sub || 'No. ' + w.t)); a.href = link(w.b, w.t); const s = el('small', '', '…');
        const x = el('button', '', 'Unwatch'); x.type = 'button'; x.addEventListener('click', () => { watchSet(w.b, w.t, '', false); drawWatching(); }); m.append(a, s); li.append(m, x); ul.append(li);
        api('?b=' + w.b + '&t=' + w.t + '&since=' + (w.last || 0)).then((r) => { s.textContent = r.ok ? (w.last ? (r.posts.length ? r.posts.length + ' new' : 'nothing new') : r.count + ' posts') : (r.say || 'gone'); }); }
    }

    // ---- views ----
    const show = (id) => { for (const s of ['home', 'board', 'thread', 'review', 'over']) $(s).hidden = s !== id; };
    const crumbs = (items) => { const c = $('crumbs'); c.replaceChildren(); for (const [t, h] of items) { const a = el('a', '', t); a.href = h; c.append(a); } };
    function adultGate(board) { return new Promise((res) => { if (!board.nsfw || me.adult) return res(true); $('gate').hidden = false; $('gateH').textContent = '/' + board.code + '/ is 18+'; $('gateYes').onclick = () => { me.adult = true; keep(); $('gate').hidden = true; res(true); }; $('gateYes').focus(); }); }
    let reload = () => location.reload();

    async function home() {
      show('home'); crumbs([['All boards', '/boards/'], ['Rules', '/boards/rules/']].concat(owner ? [['Reports', '/boards/?review=1']] : []));
      const sort = q.get('sort') || 'active'; $('sort').value = sort; $('sfw').checked = q.get('sfw') === '1';
      const go = (k, v) => { const u = new URLSearchParams(location.search); if (v) u.set(k, v); else u.delete(k); location.search = u.toString(); };
      $('sort').onchange = () => go('sort', $('sort').value); $('sfw').onchange = () => go('sfw', $('sfw').checked ? '1' : '');
      $('first').onclick = () => { $('new').open = true; $('nCode').focus(); };
      if (q.get('new') === '1' || location.hash === '#new') { $('new').open = true; }
      const pre = q.get('code') && document.querySelector('#starters a[data-code="' + CSS.escape(q.get('code')) + '"]'); // a starter link fills the form, so the link restores it
      if (pre && $('new').open) { $('nCode').value = pre.dataset.code; $('nTitle').value = q.get('title') || pre.dataset.title; $('nAbout').value = pre.dataset.about; }
      const r = await api(''); const list = (r.boards || []).filter((x) => !$('sfw').checked || !x.nsfw);
      const by = { active: (a, b) => b.last - a.last, new: (a, b) => b.created - a.created, posts: (a, b) => b.posts - a.posts, code: (a, b) => a.code.localeCompare(b.code) }[sort] || ((a, b) => b.last - a.last);
      list.sort(by); const ul = $('boards'); ul.replaceChildren();
      $('none').hidden = !!list.length; $('boardsH').textContent = list.length ? 'The boards (' + list.length + ')' : 'The boards';
      if (!r.ok && (r.status || r.say)) { $('none').hidden = false; $('none').querySelector('p').textContent = r.say || 'The boards could not be read just now.'; }
      const have = new Map((r.boards || []).map((x) => [x.code, x])); // a general board that exists opens; one that does not yet opens the form, filled in
      for (const a of document.querySelectorAll('#starters a')) if (have.has(a.dataset.code)) a.href = link(a.dataset.code);
      for (const x of list) { const li = el('li'), m = el('div', 'main'), a = el('a', 'title', '/' + x.code + '/ · ' + x.title); a.href = link(x.code);
        if (x.nsfw) a.append(el('span', 'badge adult', '18+')); if (x.textOnly) a.append(el('span', 'badge', 'text')); if (x.locked) a.append(el('span', 'badge', 'locked'));
        m.append(a); if (x.about) m.append(el('small', '', x.about)); m.append(el('small', '', x.posts + ' posts · last ' + ago(x.last))); li.append(m); ul.append(li); }
      // make a board
      const nb = botFor($('nBot'));
      $('nCode').addEventListener('input', () => { const v = $('nCode').value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10); if (v !== $('nCode').value) $('nCode').value = v; const why = B.codeProblem(v, new Set((r.boards || []).map((x) => x.code))); $('nNote').textContent = v ? (why || 'The board will be /' + v + '/') : ''; $('nNote').classList.toggle('bad', !!why); });
      $('nf').addEventListener('submit', async (e) => { e.preventDefault(); const n = $('nNote'); n.classList.remove('bad'); $('nGo').disabled = true;
        try { const why = B.codeProblem($('nCode').value); if (why) throw new Error(why); if (!$('nTitle').value.trim()) throw new Error('a board needs a title');
          const body = { do: 'board', code: $('nCode').value, title: $('nTitle').value, about: $('nAbout').value, nsfw: document.querySelector('input[name=nRate]:checked').value === 'adult', textOnly: document.querySelector('input[name=nMode]:checked').value === 'text', ids: $('nIds').checked, proof: await nb.proof() };
          n.textContent = 'Making it…'; const res = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) { nb.reset(); throw new Error(res.say || 'not made'); } if (body.nsfw) { me.adult = true; keep(); } location.href = link(res.board.code);
        } catch (err) { n.textContent = err.message; n.classList.add('bad'); } finally { $('nGo').disabled = false; } });
      // search every board
      const sq = q.get('q'); if (sq) $('sq').value = sq;
      $('sf').addEventListener('submit', (e) => { e.preventDefault(); go('q', $('sq').value.trim()); });
      if (sq) results($('results'), await api('?q=' + encodeURIComponent(sq)), true);
      const pv = () => $('pvOut').replaceChildren(postEl({ no: 1, thread: 1, at: Date.now(), name: 'Anonymous', body: B.cleanText($('pvText').value, B.LIMITS.body) }, 'b', {}, { preview: true }));
      $('pvText').addEventListener('input', pv); pv(); if (q.get('preview')) { $('pvText').value = q.get('preview'); $('previewP').open = true; pv(); }
      $('filt').value = (me.filter || []).join('\n'); $('filtSave').onclick = () => { me.filter = $('filt').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 100); keep(); $('filtNote').textContent = me.filter.length ? 'Kept: ' + me.filter.length + ' words hidden' : 'Nothing hidden'; };
      drawWatching();
    }
    async function over() {
      show('over'); crumbs([['All boards', '/boards/'], ['Rules', '/boards/rules/']]); $('title').textContent = 'Every board\u2019s new threads'; document.title = 'Every board\u2019s new threads · Verse boards';
      $('oSfw').checked = q.get('sfw') === '1'; $('oSfw').onchange = () => { location.search = $('oSfw').checked ? 'all=1&sfw=1' : 'all=1'; };
      const r = await api('?overboard' + ($('oSfw').checked ? '&sfw=1' : '')), g = $('oCat'); g.replaceChildren();
      if (!r.ok || !r.threads.length) { g.append(el('p', 'note', r.ok ? 'No threads on any board yet.' : (r.say || 'Could not be read.'))); return; }
      for (const t of r.threads) { const a = el('a', 'th'); a.href = link(t.board, t.no);
        if (t.file && !t.spoiler) { const i = el('img', 'pic' + (t.nsfw ? ' blur' : '')); i.alt = ''; i.loading = 'lazy'; i.src = t.file.thumb; if (t.nsfw) i.addEventListener('click', (e) => { if (i.classList.contains('blur')) { e.preventDefault(); i.classList.remove('blur'); } }); a.append(i); }
        a.append(el('span', 'meta', '/' + t.board + '/' + (t.nsfw ? ' 18+' : '') + ' · R: ' + t.replies + ' / I: ' + t.images)); if (t.sub) a.append(el('b', '', t.sub)); a.append(el('span', '', B.excerpt(t.body, 140))); g.append(a); }
    }
    function results(host, r, across) {
      host.hidden = false; host.replaceChildren(el('h2', '', r.ok ? r.results.length + ' found for "' + r.q + '"' : (r.say || 'Search did not answer')));
      for (const p of (r.results || [])) { const w = el('div'), h = el('a', '', '/' + p.board + '/ No. ' + p.no + (p.nsfw ? ' (18+)' : '')); h.href = link(p.board, p.thread, p.no); w.append(h);
        w.append(postEl({ ...p, op: false }, p.board, { nsfw: p.nsfw, blur: across }, { preview: true })); host.append(w); }
    }

    async function board() {
      const view = q.has('archive') ? 'arc' : q.has('page') ? 'idx' : 'cat';
      const r = await api('?b=' + code + (view === 'arc' ? '&archive=1' : view === 'idx' ? '&page=' + (+q.get('page') || 1) : ''));
      show('board');
      if (!r.ok) { $('title').textContent = '/' + code + '/'; $('sub').textContent = r.say || 'This board could not be read.'; crumbs([['All boards', '/boards/'], ['Make it', '/boards/?new=1']]); $('board').hidden = true; return; }
      const bd = r.board; await adultGate(bd);
      document.title = '/' + bd.code + '/ · ' + bd.title + ' · Verse boards'; $('title').textContent = '/' + bd.code + '/ · ' + bd.title; $('sub').textContent = (bd.about ? bd.about + ' · ' : '') + (bd.nsfw ? '18+ · ' : 'Safe for work · ') + (bd.textOnly ? 'text only' : 'pictures and text') + (bd.locked ? ' · locked' : '');
      crumbs([['All boards', '/boards/'], ['/' + bd.code + '/', link(bd.code)], ['Rules', '/boards/rules/']]);
      for (const [id, v, h] of [['tCat', 'cat', link(bd.code)], ['tIdx', 'idx', link(bd.code) + '&page=1'], ['tArc', 'arc', link(bd.code) + '&archive=1']]) { $(id).href = h; if (v === view) $(id).setAttribute('aria-current', 'page'); }
      $('newT').hidden = bd.locked; $('newT').onclick = () => { postForm($('threadForm'), bd.code, bd, 0); $('threadForm').querySelector('textarea').focus(); };
      $('catTools').hidden = view !== 'cat'; $('cat').hidden = view !== 'cat'; $('idx').hidden = view !== 'idx'; $('arc').hidden = view !== 'arc';
      if (view === 'cat') {
        const draw = () => { const qq = $('cq').value.trim(), list = B.order(r.threads, $('csort').value).filter((t) => !qq || B.matches(qq, t)); const g = $('cat'); g.replaceChildren();
          $('bNote').textContent = r.threads.length ? list.length + ' of ' + r.threads.length + ' threads' + (qq ? ' match' : '') + ' · ' + B.LIMITS.pages + ' pages of ' + B.LIMITS.perPage + ' stay live, then the archive' : 'No threads yet. Start the first one with New thread.';
          for (const t of list) { const a = el('a', 'th'); a.href = link(bd.code, t.no);
            if (t.file) { const i = el('img', 'pic'); i.alt = ''; i.loading = 'lazy'; i.src = t.file.thumb; if (t.spoiler) { i.removeAttribute('src'); i.alt = 'Spoiler'; } a.append(i); }
            a.append(el('span', 'meta', 'R: ' + t.replies + ' / I: ' + t.images + ' · page ' + t.page + (t.locked ? ' · locked' : '')));
            if (t.sub) a.append(el('b', '', t.sub)); a.append(el('span', '', B.excerpt(t.body, 140))); g.append(a); } };
        $('cq').oninput = draw; $('csort').onchange = draw; draw();
        if (q.get('q')) { $('cq').value = q.get('q'); results($('bResults'), await api('?b=' + bd.code + '&q=' + encodeURIComponent(q.get('q'))), false); draw(); }
        $('cq').onkeydown = async (e) => { if (e.key === 'Enter' && $('cq').value.trim()) results($('bResults'), await api('?b=' + bd.code + '&q=' + encodeURIComponent($('cq').value.trim())), false); };
      } else if (view === 'idx') {
        const host = $('idx'); host.replaceChildren();
        for (const t of r.threads) { const w = el('div', 'panel'); w.append(postEl(t, bd.code, bd)); const omitted = t.replies - t.last.length; if (omitted > 0) { const o = el('a', 'note', omitted + ' replies left out: open the thread'); o.href = link(bd.code, t.no); w.append(o); } for (const p of t.last) w.append(postEl(p, bd.code, bd)); const op = el('a', 'btn', 'Open thread'); op.href = link(bd.code, t.no); w.append(op); host.append(w); }
        if (!r.threads.length) host.append(el('p', 'note', 'No threads yet.'));
        const pg = el('nav', 'pages'); pg.setAttribute('aria-label', 'Pages'); for (let i = 1; i <= r.pages; i++) { const a = el('a', 'btn', String(i)); a.href = link(bd.code) + '&page=' + i; if (i === r.page) a.setAttribute('aria-current', 'page'); pg.append(a); } host.append(pg);
        $('bNote').textContent = 'Page ' + r.page + ' of ' + r.pages;
      } else {
        const ul = $('arc'); ul.replaceChildren(); $('bNote').textContent = r.threads.length + ' threads in the archive: read only, kept after they fell off the last page.';
        for (const t of r.threads) { const li = el('li'), m = el('div', 'main'), a = el('a', 'title', 'No. ' + t.no + (t.sub ? ' · ' + t.sub : '')); a.href = link(bd.code, t.no); m.append(a, el('small', '', t.excerpt + ' · ' + t.replies + ' replies · ' + when(t.at))); li.append(m); ul.append(li); }
      }
      if (owner) { const m = $('modBoard'); m.hidden = false; m.replaceChildren(el('b', '', 'Owner: this board '));
        const go = (t, body, sure) => { const x = el('button', '', t); x.type = 'button'; x.onclick = async () => { if (sure && !confirm(sure)) return; const extra = body.act === 'board-rename' ? { title: prompt('New title', bd.title), about: prompt('New line', bd.about) } : {}; const res = await api('', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'mod', b: bd.code, ...body, ...extra }) }); x.textContent = res.ok ? 'Done' : res.say; if (res.ok) setTimeout(() => (body.act === 'board-delete' ? (location.href = '/boards/') : location.reload()), 500); }; m.append(x); };
        go('Rename', { act: 'board-rename' }); go(bd.locked ? 'Unlock' : 'Lock', { act: bd.locked ? 'board-unlock' : 'board-lock' }); go('Delete board', { act: 'board-delete' }, 'Delete /' + bd.code + '/ and every post on it?'); }
    }

    // a thread: drawn once, then only what is new (every 10 s, slower while nothing comes, paused in a background tab)
    let tState = null;
    async function thread() {
      const r = await api('?b=' + code + '&t=' + tno); show('thread');
      if (!r.ok) { $('title').textContent = '/' + code + '/ No. ' + tno; $('sub').textContent = r.say || 'This thread could not be read.'; $('upd').hidden = true; crumbs([['All boards', '/boards/'], ['/' + code + '/', link(code)]]); return; }
      const bd = r.board; await adultGate(bd);
      const op = r.thread; tState = { bd, last: 0, count: 0, delay: 10, left: 10, newWhileAway: 0 };
      document.title = '/' + bd.code + '/ · ' + (op.sub || B.excerpt(op.body, 50) || 'No. ' + op.no) + ' · Verse boards';
      $('title').textContent = op.sub || '/' + bd.code + '/ No. ' + op.no; $('sub').textContent = '/' + bd.code + '/ · ' + bd.title + (bd.nsfw ? ' · 18+' : '');
      crumbs([['All boards', '/boards/'], ['/' + bd.code + '/ catalog', link(bd.code)], ['Archive', link(bd.code) + '&archive=1'], ['Rules', '/boards/rules/']]);
      const closed = op.archived || op.locked || bd.locked;
      if (closed) $('tNotice').replaceChildren(el('p', 'notice', op.archived ? 'This thread is in the archive: read only.' : 'This thread is locked: no new replies.'));
      replyTo = closed ? null : (n) => { if (!$('replyForm').firstChild) postForm($('replyForm'), bd.code, bd, tno); $('replyBar').hidden = true; const ta = $('replyForm').querySelector('textarea'); const at = ta.selectionStart || ta.value.length; const ins = '>>' + n + '\n'; ta.value = ta.value.slice(0, at) + ins + ta.value.slice(at); ta.focus(); ta.selectionStart = ta.selectionEnd = at + ins.length; ta.scrollIntoView({ block: 'center' }); };
      $('replyBar').hidden = !!closed; $('replyOpen').onclick = () => { postForm($('replyForm'), bd.code, bd, tno); $('replyBar').hidden = true; $('replyForm').querySelector('textarea').focus(); };
      const k = bd.code + '/' + tno, wb = $('watchBtn'), drawW = () => { wb.textContent = me.watch[k] ? 'Unwatch' : 'Watch'; wb.setAttribute('aria-pressed', me.watch[k] ? 'true' : 'false'); };
      wb.onclick = () => { watchSet(bd.code, tno, op.sub || B.excerpt(op.body, 60), !me.watch[k], tState.last); drawW(); }; drawW();
      $('posts').replaceChildren(); add(r.posts); reload = () => update(true);
      if (location.hash) { const t = document.querySelector(location.hash.replace(/[^#\w]/g, '')); if (t) t.scrollIntoView({ block: 'center' }); }
      $('updNow').onclick = () => update(false);
      setInterval(() => { if (!$('auto').checked || document.hidden && tState.delay < 60) return; if (--tState.left <= 0) update(false); else $('updNote').textContent = 'Updating in ' + tState.left + ' s'; }, 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { tState.newWhileAway = 0; document.title = document.title.replace(/^\(\d+\) /, ''); } });
    }
    function add(posts) {
      const bd = tState.bd, host = $('posts');
      for (const p of posts) { const old = $('p' + p.no); const n = postEl(p, bd.code, bd, { reply: replyTo || null }); if (old) old.replaceWith(n); else host.append(n); tState.last = Math.max(tState.last, p.no); }
      tState.count = host.querySelectorAll('article.post').length; backlinks(host, bd.code);
      const k = bd.code + '/' + tno; if (me.watch[k]) { me.watch[k].last = tState.last; keep(); }
    }
    async function update(full) {
      if (!tState) return; $('updNote').textContent = 'Updating…';
      const r = await api('?b=' + code + '&t=' + tno + (full ? '' : '&since=' + tState.last));
      if (!r.ok) { $('updNote').textContent = r.say || 'Could not update'; tState.left = tState.delay = Math.min(120, tState.delay * 2); return; }
      if (full || r.count !== tState.count + r.posts.length) { if (!full) return update(true); $('posts').replaceChildren(); tState.last = 0; add([r.thread, ...r.posts.filter((p) => p.no !== r.thread.no)]); }
      else if (r.posts.length) { add(r.posts); if (document.hidden) { tState.newWhileAway += r.posts.length; document.title = '(' + tState.newWhileAway + ') ' + document.title.replace(/^\(\d+\) /, ''); } }
      tState.delay = r.posts.length ? 10 : Math.min(120, tState.delay + 10); tState.left = tState.delay;
      $('updNote').textContent = r.posts.length && !full ? r.posts.length + ' new' : 'Up to date';
    }

    async function review() {
      show('review'); crumbs([['All boards', '/boards/'], ['Reports', '/boards/?review=1']]); $('title').textContent = 'Reports';
      const r = await api('?review=1'), host = $('revList'); if (!r.ok) { host.textContent = r.say || 'The owner only'; return; }
      if (!r.posts.length) host.textContent = 'Nothing reported.';
      for (const p of r.posts) { const w = el('div', 'panel'), h = el('a', '', '/' + p.board + '/ No. ' + p.no + ' · ' + p.reports + ' reports' + (p.hidden ? ' · hidden' : '') + ' · ' + p.why.join(', ')); h.href = link(p.board, p.thread, p.no); w.append(h, postEl({ ...p, hidden: false }, p.board, {}, { preview: true }), modActs(p, p.board)); host.append(w); }
    }

    setTimeout(() => document.documentElement.classList.remove('pre'), 2500); // still drawing after 2.5 s: show the page as it stands
    $('shareTop').onclick = async () => { const url = location.href.replace(/#.*$/, ''), b = $('shareTop'); if (navigator.share) { try { await navigator.share({ title: document.title, url }); return; } catch (_) {} } try { await navigator.clipboard.writeText(url); b.textContent = 'Link copied'; } catch (_) { prompt('The link to this page', url); } setTimeout(() => { b.textContent = 'Share this page'; }, 2000); };
    // the address decides the view: ?b=x&p=123 finds the thread of a post (>>123 from elsewhere, >>>/x/123)
    if (code && q.get('p') && !tno) { const r = await api('?b=' + code + '&p=' + (+q.get('p') || 0)); location.replace(r.ok ? link(code, r.thread, r.no) : link(code)); return; }
    if (q.has('review') && owner) await review(); else if (q.get('all') === '1') await over(); else if (code && tno) await thread(); else if (code) await board(); else await home();
    mountRelated($('related'), '/boards/', [{ label: 'Shrink a picture first', href: () => '/resize-image/' }]);
    document.documentElement.classList.remove('pre');
  })();
