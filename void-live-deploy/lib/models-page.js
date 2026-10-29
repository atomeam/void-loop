// The AI model pages (/models/ and its lane pages; lib/ai-sites.js): one module, one start() per page. Everything live is read by the visitor's browser from
// public, keyless sources (lib/hub-core.js names them and turns their answers into rows); every model links to its own page there. "Try it" and the arena
// ask Verse's free models (lib/ai-ui.js askModel). Kept on this device: the comparison, the arena's votes, recent answers of the Hub for ten minutes.
import { TASKS, SNAPSHOT, LICENCES, BENCHES, QUANTS, hubListUrl, hubPage, cardUrl, filesUrl, normModel, filterRows, sizeLabel, taskName, fmtCount, licenceOf, splitCard, mdToHtml, runGB, weightsGB, quantOfFile, runCommands, normBoardRow, boardUrl, BOARD_API, BOARD_SET, sortBoard, boardCsv, normRouted, costOf, money, ratings, pickPair, ROUTER_API } from '/lib/hub-core.js';
import { TRY, tryOf } from '/lib/ai-sites.js';
import { $, t, boot, load, save, getJSON, askModel, shareLink, download, el, btn, copy } from '/lib/ai-ui.js';

const qs = new URLSearchParams(location.search);
const say = (s, bad) => { const n = $('status'); if (n) { n.textContent = s; n.classList.toggle('bad', !!bad); } };
const debounce = (fn, ms = 350) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const ago = (at) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m + ' min ago'; };
const labelOf = (key) => (TRY.find((x) => x.key === key) || { label: key }).label;

// ------------------------------------------------------------ /models/ : the catalogue
const CMP = 'a2m.void.ai.compare';
function hub() {
  let kind = qs.get('kind') === 'datasets' ? 'datasets' : 'models', limit = 50, rows = [], seq = 0;
  const f = { q: $('q'), task: $('task'), lic: $('lic'), size: $('size'), minDl: $('minDl'), sort: $('sort') };
  if (qs.get('q')) f.q.value = qs.get('q').slice(0, 80); if (qs.get('task')) f.task.value = qs.get('task'); if (qs.get('licence')) f.lic.value = qs.get('licence'); if (qs.get('size')) f.size.value = qs.get('size'); if (qs.get('sort')) f.sort.value = qs.get('sort');
  let cmp = (qs.get('compare') ? qs.get('compare').split(',').filter(Boolean).slice(0, 3) : load(CMP, [])).filter((x) => typeof x === 'string');
  const cmpRows = new Map();
  const setKind = (k) => { kind = k; $('kindM').setAttribute('aria-selected', String(k === 'models')); $('kindD').setAttribute('aria-selected', String(k === 'datasets')); f.size.disabled = k === 'datasets'; };
  setKind(kind);
  function card(r) {
    const lic = licenceOf(r.licence), tr = r.kind === 'models' && tryOf(r.id);
    const meta = [taskName(r.task), r.licence ? (lic ? lic[1] : r.licence) : null, r.kind === 'models' ? sizeLabel(r.params) + (r.sizeFromName ? ' (' + t('from the name') + ')' : '') : null, r.downloads != null ? fmtCount(r.downloads) + ' ' + t('downloads') : null, r.likes != null ? fmtCount(r.likes) + ' ' + t('likes') : null, r.updated ? t('updated') + ' ' + r.updated : null].filter(Boolean).join(' · ');
    return el('li', {}, el('div', { class: 't' }, el('a', { href: hubPage(r.id, r.kind), rel: 'noopener', target: '_blank' }, r.id)), el('div', { class: 'm' }, meta), r.gated ? el('div', { class: 'm' }, t('gated: accept its terms on the Hub')) : null, r.description ? el('div', { class: 'm' }, r.description) : null,
      el('div', { class: 'a' }, btn('Card', () => showCard(r)), r.kind === 'models' ? btn('Compare', () => addCmp(r)) : null, tr ? btn('Try', () => { $('tryModel').value = tr.key; $('tryPane').scrollIntoView({ behavior: 'smooth' }); $('tryIn').focus(); }) : null));
  }
  function draw(list, note) {
    const shown = kind === 'models' ? filterRows(list, { size: f.size.value, minDownloads: +f.minDl.value }) : filterRows(list, { minDownloads: +f.minDl.value });
    $('list').replaceChildren(...shown.map(card)); for (const r of list) cmpRows.set(r.id, r);
    say(shown.length ? note + ' · ' + shown.length + ' ' + t('shown') : t('Nothing matches. Try fewer filters.'), !shown.length);
    $('more').disabled = list.length < limit; drawCmp();
  }
  const offline = () => { const q = f.q.value.toLowerCase(); return SNAPSHOT.filter((r) => (!q || r.id.toLowerCase().includes(q)) && (!f.task.value || r.task === f.task.value) && (!f.lic.value || r.licence === f.lic.value)); };
  async function run() {
    const my = ++seq; say(t('Loading…'));
    const url = hubListUrl({ kind, q: f.q.value.trim(), task: f.task.value, licence: f.lic.value, sort: f.sort.value, limit });
    try {
      const got = await getJSON(url); if (my !== seq) return;
      rows = (Array.isArray(got.data) ? got.data : []).map((x) => normModel(x, kind));
      draw(rows, t('Live from the Hugging Face Hub') + (got.kept ? ' (' + ago(got.at) + ')' : ''));
    } catch (_) { if (my !== seq) return; rows = kind === 'models' ? offline() : []; draw(rows, navigator.onLine ? t('The Hub did not answer just now; showing the models this page carries.') : t('You are offline: showing what this device kept.')); }
    const u = new URL(location.href); for (const [k, el_] of [['q', f.q], ['task', f.task], ['licence', f.lic], ['size', f.size]]) { if (el_.value) u.searchParams.set(k, el_.value); else u.searchParams.delete(k); } if (kind === 'datasets') u.searchParams.set('kind', 'datasets'); else u.searchParams.delete('kind'); history.replaceState(null, '', u);
  }
  async function showCard(r) {
    $('cardNote').textContent = t('Loading…'); $('cardMd').replaceChildren(); $('cardPane').scrollIntoView({ behavior: 'smooth' });
    try {
      const res = await fetch(cardUrl(r.id, r.kind)); if (!res.ok) throw new Error(String(res.status));
      const c = splitCard(await res.text()), lic = licenceOf(c.licence || r.licence);
      $('cardNote').replaceChildren(el('strong', {}, r.id), ' · ', t('Licence') + ': ' + (lic ? lic[1] + ' (' + lic[2] + ')' : c.licence || r.licence || '–'), ' · ', el('a', { href: hubPage(r.id, r.kind), rel: 'noopener', target: '_blank' }, t('Open it on the Hub')));
      $('cardMd').innerHTML = c.body.trim() ? mdToHtml(c.body) : '<p>' + t('No card text in this repository.') + '</p>'; // mdToHtml escapes every text and keeps only http(s) links
    } catch (_) { $('cardNote').replaceChildren(t('No card text in this repository.') + ' ', el('a', { href: hubPage(r.id, r.kind), rel: 'noopener', target: '_blank' }, t('Open it on the Hub'))); }
  }
  function addCmp(r) { if (cmp.includes(r.id)) return; if (cmp.length >= 3) { $('cmpNote').textContent = t('At most three models.'); return; } cmp.push(r.id); cmpRows.set(r.id, r); save(CMP, cmp); drawCmp(); $('cmp').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  async function drawCmp() {
    const tb = $('cmp').tBodies[0]; tb.replaceChildren(); if (!cmp.length) return;
    for (const id of cmp) if (!cmpRows.has(id)) { try { const g = await getJSON(filesUrl(id).replace('?blobs=true', '')); cmpRows.set(id, normModel(g.data)); } catch (_) { cmpRows.set(id, normModel({ id })); } }
    const rs = cmp.map((id) => cmpRows.get(id));
    const line = (name, fn) => { const tr = tb.insertRow(); tr.append(el('th', {}, t(name))); for (const r of rs) tr.append(el('td', {}, fn(r))); };
    line('Model', (r) => el('span', {}, el('a', { href: hubPage(r.id), rel: 'noopener', target: '_blank' }, r.id), ' ', btn('Remove', () => { cmp = cmp.filter((x) => x !== r.id); save(CMP, cmp); drawCmp(); })));
    line('Task', (r) => taskName(r.task)); line('Licence', (r) => { const l = licenceOf(r.licence); return l ? l[1] + ': ' + l[2] : r.licence || '–'; }); line('Size', (r) => sizeLabel(r.params));
    line('Memory to run (Q4)', (r) => (r.params ? runGB(r.params, 4.85) + ' GB' : '–')); line('Memory to run (16-bit)', (r) => (r.params ? runGB(r.params, 16) + ' GB' : '–'));
    line('Downloads', (r) => fmtCount(r.downloads)); line('Likes', (r) => fmtCount(r.likes)); line('Updated', (r) => r.updated || '–'); line('Library', (r) => r.library || '–'); line('Verse can run it', (r) => (tryOf(r.id) ? t('yes') : t('no')));
  }
  $('cmpClear').onclick = () => { cmp = []; save(CMP, cmp); drawCmp(); };
  $('cmpLink').onclick = () => { const u = new URL('/models/', location.origin); if (cmp.length) u.searchParams.set('compare', cmp.join(',')); shareLink(u.href, document.title, (s) => { $('cmpNote').textContent = s; }); };
  $('kindM').onclick = () => { setKind('models'); limit = 50; run(); }; $('kindD').onclick = () => { setKind('datasets'); limit = 50; run(); };
  f.q.addEventListener('input', debounce(() => { limit = 50; run(); })); for (const k of ['task', 'lic', 'sort']) f[k].addEventListener('change', () => { limit = 50; run(); });
  for (const k of ['size', 'minDl']) f[k].addEventListener('change', () => draw(rows, t('Live from the Hugging Face Hub')));
  $('more').onclick = () => { limit = Math.min(200, limit + 50); run(); };
  tryPanel($('tryModel'), $('tryIn'), $('tryGo'), $('tryOut'));
  if (cmp.length) drawCmp();
  run();
}
function tryPanel(sel, box, go, out) {
  let busy = false;
  go.onclick = async () => {
    const text = box.value.trim(); if (!text) { out.textContent = t('Write a prompt first.'); return; } if (busy) return;
    busy = true; go.disabled = true; out.textContent = t('Thinking…');
    const r = await askModel({ messages: [{ role: 'user', text }], model: sel.value });
    out.replaceChildren(el('h3', {}, labelOf(sel.value)), r.reply ? el('div', { html: mdToHtml(r.reply) }) : el('p', { class: 'bad' }, r.say));
    busy = false; go.disabled = false;
  };
}

// ------------------------------------------------------------ /models/leaderboard/
function leaderboard() {
  let all = [], key = qs.get('sort') || 'average', asc = false, show = 50, pick = new Set((qs.get('cmp') || '').split('|').filter(Boolean).slice(0, 4)), sortedServer = false;
  const f = { q: $('q'), size: $('size'), type: $('type'), merges: $('merges') };
  if (qs.get('q')) f.q.value = qs.get('q'); if (qs.get('size')) f.size.value = qs.get('size'); if (qs.get('type')) f.type.value = qs.get('type');
  const typeOk = (r) => { const v = f.type.value, ty = String(r.type || '').toLowerCase(); return !v || (v === 'pretrained' ? /pretrain/.test(ty) : v === 'chat' ? /chat|instruct/.test(ty) : /fine/.test(ty)); };
  const sizeOk = (r) => { const v = f.size.value; if (!v) return true; const b = { xs: [0, 1e9], s: [1e9, 4e9], m: [4e9, 10e9], l: [10e9, 40e9], xl: [40e9, Infinity] }[v]; return r.params != null && r.params >= b[0] && r.params < b[1]; };
  const visible = () => { const q = f.q.value.toLowerCase().trim(); return sortBoard(all.filter((r) => (f.merges.checked || !r.merged) && typeOk(r) && sizeOk(r) && (!q || r.name.toLowerCase().includes(q))), key, asc); };
  function draw() {
    const v = visible(), tb = $('rows'); tb.replaceChildren();
    v.slice(0, show).forEach((r, i) => {
      const box = el('input', { type: 'checkbox', 'aria-label': t('Compare') + ' ' + r.name }); box.checked = pick.has(r.name);
      box.onchange = () => { if (box.checked && pick.size >= 4) { box.checked = false; return; } if (box.checked) pick.add(r.name); else pick.delete(r.name); chart(); };
      const tr = tb.insertRow(); tr.append(el('td', {}, String(i + 1)), el('td', {}, box), el('td', {}, el('a', { href: hubPage(r.name), rel: 'noopener', target: '_blank' }, r.name)), el('td', { class: 'n' }, r.params ? sizeLabel(r.params) : '–'), ...BENCHES.map(([k]) => el('td', { class: 'n' }, r.scores[k] == null ? '–' : r.scores[k].toFixed(2))));
    });
    say(v.length + ' ' + t('models') + ' · ' + t('Sorted by') + ' ' + (BENCHES.find(([k]) => k === key) || [0, key])[1] + (sortedServer ? '' : ' (' + all.length + ' ' + t('rows') + ')'));
    $('more').disabled = v.length <= show; for (const b of document.querySelectorAll('th button[data-k]')) b.setAttribute('aria-pressed', String(b.dataset.k === key)); chart();
  }
  function chart() {
    const rs = all.filter((r) => pick.has(r.name)), box = $('chart'); box.replaceChildren(); if (rs.length < 2) { $('chartNote').hidden = false; return; } $('chartNote').hidden = true;
    const colours = ['var(--accent)', 'var(--good)', 'var(--bad)', 'var(--soft)'];
    for (const [k, n] of BENCHES) { box.append(el('h3', {}, n)); rs.forEach((r, i) => { const v = r.scores[k] || 0; box.append(el('div', { class: 'row', style: 'margin:2px 0;flex-wrap:nowrap' }, el('span', { class: 'note', style: 'flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, r.name), el('div', { style: 'flex:1' }, el('div', { class: 'bar', style: 'width:' + Math.max(1, Math.min(100, v)) + '%;background:' + colours[i] })), el('span', { class: 'note', style: 'flex:0 0 3.5em;text-align:right' }, r.scores[k] == null ? '–' : v.toFixed(1)))); }); }
  }
  async function loadAll() {
    say(t('Loading…'));
    try {
      // the table's own column names come from its first row; then the best 500 by average, ordered by the viewer (or the first 500 rows sorted here when it cannot order)
      const first = await getJSON(boardUrl(0, 1), 3600000); const feats = ((first.data && first.data.features) || []).map((x) => x.name), avg = feats.find((n) => /^average/i.test(n));
      let pages = [];
      if (avg) { try { pages = await Promise.all([0, 100, 200, 300, 400].map((o) => getJSON(BOARD_API + '/filter?dataset=' + encodeURIComponent(BOARD_SET) + '&config=default&split=train&orderby=' + encodeURIComponent('"' + avg + '" DESC') + '&where=' + encodeURIComponent('"' + avg + '" IS NOT NULL') + '&offset=' + o + '&length=100', 3600000))); sortedServer = true; } catch (_) { pages = []; } }
      if (!pages.length) { pages = await Promise.all([0, 100, 200, 300, 400].map((o) => getJSON(boardUrl(o, 100), 3600000))); sortedServer = false; }
      all = pages.flatMap((p) => (p.data && p.data.rows) || []).map(normBoardRow).filter(Boolean);
      const seen = new Set(); all = all.filter((r) => (seen.has(r.name) ? false : seen.add(r.name)));
      if (!all.length) throw new Error('no rows'); draw();
    } catch (_) { say(t('The leaderboard did not load. Try again later.'), true); $('rows').replaceChildren(); }
  }
  async function search() {
    const q = f.q.value.trim(); if (q.length < 3) { draw(); return; }
    try { const g = await getJSON(BOARD_API + '/search?dataset=' + encodeURIComponent(BOARD_SET) + '&config=default&split=train&query=' + encodeURIComponent(q) + '&offset=0&length=100', 3600000); const more = ((g.data && g.data.rows) || []).map(normBoardRow).filter(Boolean); const names = new Set(all.map((r) => r.name)); for (const r of more) if (!names.has(r.name)) all.push(r); } catch (_) { /* the rows already here are searched */ }
    draw();
  }
  for (const b of document.querySelectorAll('th button[data-k]')) b.onclick = () => { if (key === b.dataset.k) asc = !asc; else { key = b.dataset.k; asc = key === 'name'; } draw(); };
  f.q.addEventListener('input', debounce(search, 400)); for (const k of ['size', 'type', 'merges']) f[k].addEventListener('change', draw);
  $('more').onclick = () => { show += 50; draw(); };
  $('csv').onclick = () => download('open-llm-leaderboard.csv', boardCsv(visible()), 'text/csv');
  $('link').onclick = () => { const u = new URL(location.pathname, location.origin); if (key !== 'average') u.searchParams.set('sort', key); for (const [k, e] of [['q', f.q], ['size', f.size], ['type', f.type]]) if (e.value) u.searchParams.set(k, e.value); if (pick.size) u.searchParams.set('cmp', [...pick].join('|')); shareLink(u.href, document.title, say); };
  loadAll();
}

// ------------------------------------------------------------ /models/local/
function local() {
  let limit = 30, seq = 0;
  const f = { q: $('q'), task: $('task'), sort: $('sort') }; if (qs.get('q')) f.q.value = qs.get('q');
  const mem = $('mem'), psize = $('psize');
  const dm = navigator.deviceMemory; if (dm && !load('a2m.void.ai.mem', null)) mem.value = String(dm >= 8 ? 16 : dm); const savedMem = load('a2m.void.ai.mem', null); if (savedMem) mem.value = savedMem;
  const memGB = () => Math.max(1, Number(mem.value) || 16);
  function fit() {
    const p = (Number(psize.value) || 8) * 1e9, tb = $('fit').tBodies[0]; tb.replaceChildren();
    for (const [q, b, n] of QUANTS) { const need = runGB(p, b), ok = need <= memGB(); tb.append(el('tr', {}, el('td', {}, q), el('td', { class: 'n' }, String(b)), el('td', { class: 'n' }, need + ' GB'), el('td', { class: ok ? 'good' : 'bad' }, ok ? t('yes') : t('no')), el('td', {}, n))); }
    $('fitNote').textContent = sizeLabel(p) + ' · Q4_K_M: ' + weightsGB(p, 4.85) + ' GB → ' + runGB(p, 4.85) + ' GB';
  }
  const card = (r) => el('li', {}, el('div', { class: 't' }, el('a', { href: hubPage(r.id), rel: 'noopener', target: '_blank' }, r.id)), el('div', { class: 'm' }, [taskName(r.task), r.licence, sizeLabel(r.params), r.downloads != null ? fmtCount(r.downloads) + ' ' + t('downloads') : null, r.updated ? t('updated') + ' ' + r.updated : null].filter(Boolean).join(' · ')),
    el('div', { class: 'a' }, btn('Files', () => files(r)), el('code', { style: 'font-size:12px;align-self:center;word-break:break-all' }, runCommands(r.id).ollama)));
  async function run() {
    const my = ++seq; say(t('Loading…'));
    try { const g = await getJSON(hubListUrl({ q: f.q.value.trim(), task: f.task.value, sort: f.sort.value, limit, gguf: true })); if (my !== seq) return; const rows = (g.data || []).map((x) => normModel(x)); $('list').replaceChildren(...rows.map(card)); say(rows.length ? t('Live from the Hugging Face Hub') + ' · ' + rows.length + ' ' + t('shown') : t('Nothing matches. Try fewer filters.'), !rows.length); $('more').disabled = rows.length < limit; }
    catch (_) { if (my !== seq) return; say(navigator.onLine ? t('The Hub did not answer just now; showing the models this page carries.') : t('You are offline: showing what this device kept.'), true); }
  }
  async function files(r) {
    $('filesNote').textContent = t('Loading…'); $('files').replaceChildren(); $('filesPane').scrollIntoView({ behavior: 'smooth' });
    try {
      const g = await getJSON(filesUrl(r.id)); const sib = ((g.data && g.data.siblings) || []).filter((s) => /\.gguf$/i.test(s.rfilename) && !/mmproj/i.test(s.rfilename));
      $('filesNote').replaceChildren(el('a', { href: hubPage(r.id), rel: 'noopener', target: '_blank' }, r.id), ' · ' + memGB() + ' GB');
      if (!sib.length) { $('files').append(el('p', { class: 'note' }, t('No GGUF files listed.'))); return; }
      const tb = el('tbody'); for (const s of sib.slice(0, 40)) { const gb = s.size ? Math.round(s.size / 1e8) / 10 : null, need = gb == null ? null : Math.round(gb * 12) / 10, q = quantOfFile(s.rfilename); tb.append(el('tr', {}, el('td', { style: 'word-break:break-all' }, s.rfilename), el('td', {}, q || '–'), el('td', { class: 'n' }, gb == null ? '–' : gb + ' GB'), el('td', { class: need != null && need <= memGB() ? 'good' : 'bad' }, need == null ? '–' : need <= memGB() ? t('fits') : t('too big')))); }
      const best = sib.map((s) => ({ q: quantOfFile(s.rfilename), gb: s.size ? s.size / 1e9 : null })).filter((x) => x.q && x.gb != null && x.gb * 1.2 <= memGB()).sort((a, b) => b.gb - a.gb)[0], cmd = runCommands(r.id, best && best.q);
      $('files').append(el('div', { class: 'tw' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'File'), el('th', {}, 'Build'), el('th', { class: 'n' }, t('Size')), el('th', {}, ''))), tb)),
        el('h3', {}, t('Run it with Ollama')), el('pre', { class: 'cmd' }, cmd.ollama), btn('Copy', () => copy(cmd.ollama, say)), el('h3', {}, t('Run it with llama.cpp')), el('pre', { class: 'cmd' }, cmd.llamacpp), btn('Copy', () => copy(cmd.llamacpp, say)));
    } catch (_) { $('filesNote').textContent = t('No GGUF files listed.'); }
  }
  f.q.addEventListener('input', debounce(() => { limit = 30; run(); })); for (const k of ['task', 'sort']) f[k].addEventListener('change', () => { limit = 30; run(); });
  $('more').onclick = () => { limit = Math.min(200, limit + 30); run(); };
  mem.addEventListener('input', () => { save('a2m.void.ai.mem', mem.value); fit(); }); psize.addEventListener('input', fit);
  fit(); run();
}

// ------------------------------------------------------------ /models/prices/
function prices() {
  let all = [], show = 60; const pick = new Set();
  const f = { q: $('q'), inMod: $('inMod'), outMod: $('outMod'), ctx: $('ctx'), maxIn: $('maxIn'), sort: $('sort'), free: $('free'), tools: $('tools') };
  if (qs.get('q')) f.q.value = qs.get('q'); if (qs.get('free') === '1') f.free.checked = true;
  const ctxLabel = (n) => (n == null ? '–' : n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : Math.round(n / 1000) + 'K');
  const perM = (v) => (v == null ? '–' : v === 0 ? t('free') : '$' + (v < 0.01 ? v.toPrecision(2) : v.toFixed(2)));
  const visible = () => {
    const q = f.q.value.toLowerCase().trim(), mx = f.maxIn.value === '' ? Infinity : Number(f.maxIn.value);
    const v = all.filter((r) => (!q || (r.name + ' ' + r.id).toLowerCase().includes(q)) && (!f.inMod.value || r.inputs.includes(f.inMod.value)) && (!f.outMod.value || r.outputs.includes(f.outMod.value)) && (r.context || 0) >= +f.ctx.value && (r.inPrice == null || r.inPrice <= mx) && (!f.free.checked || r.free) && (!f.tools.checked || r.tools));
    const by = { new: (a, b) => (b.created || 0) - (a.created || 0), in: (a, b) => (a.inPrice ?? 1e9) - (b.inPrice ?? 1e9), out: (a, b) => (a.outPrice ?? 1e9) - (b.outPrice ?? 1e9), ctx: (a, b) => (b.context || 0) - (a.context || 0), name: (a, b) => a.name.localeCompare(b.name) }[f.sort.value];
    return v.sort(by);
  };
  function draw() {
    const v = visible(), tb = $('rows'); tb.replaceChildren();
    for (const r of v.slice(0, show)) { const box = el('input', { type: 'checkbox', 'aria-label': t('Compare') + ' ' + r.name }); box.checked = pick.has(r.id); box.onchange = () => { if (box.checked && pick.size >= 3) { box.checked = false; return; } if (box.checked) pick.add(r.id); else pick.delete(r.id); drawCmp(); };
      tb.insertRow().append(el('td', {}, box), el('td', {}, el('a', { href: 'https://openrouter.ai/' + r.id.split('/').map(encodeURIComponent).join('/'), rel: 'noopener', target: '_blank' }, r.name), el('div', { class: 'note' }, r.id)), el('td', { class: 'n' }, perM(r.inPrice)), el('td', { class: 'n' }, perM(r.outPrice)), el('td', { class: 'n' }, ctxLabel(r.context)), el('td', {}, r.inputs.join('+') + ' → ' + r.outputs.join('+'))); }
    say(v.length + ' ' + t('models') + ' · ' + all.filter((r) => r.free).length + ' ' + t('free')); $('more').disabled = v.length <= show;
  }
  function drawCmp() {
    const tb = $('cmp').tBodies[0]; tb.replaceChildren(); const rs = all.filter((r) => pick.has(r.id)); if (!rs.length) return;
    const line = (n, fn) => { const tr = tb.insertRow(); tr.append(el('th', {}, t(n))); for (const r of rs) tr.append(el('td', {}, fn(r))); };
    line('Model', (r) => r.name); line('In $/M', (r) => perM(r.inPrice)); line('Out $/M', (r) => perM(r.outPrice)); line('Context', (r) => ctxLabel(r.context)); line('Max output', (r) => ctxLabel(r.maxOut)); line('Takes in', (r) => r.inputs.join(', ')); line('Gives out', (r) => r.outputs.join(', ')); line('Uses tools', (r) => (r.tools ? t('yes') : t('no')));
    line('a month (30 days)', (r) => money(costOf(r.inPrice, r.outPrice, +$('tIn').value, +$('tOut').value, +$('reqs').value).month));
  }
  function calc() {
    const m = all.find((r) => r.id === $('calcModel').value); if (m) { $('pIn').value = m.inPrice ?? 0; $('pOut').value = m.outPrice ?? 0; }
    const c = costOf(+$('pIn').value, +$('pOut').value, +$('tIn').value, +$('tOut').value, +$('reqs').value); $('costOut').textContent = money(c.day) + ' ' + t('a day') + ', ' + money(c.month) + ' ' + t('a month (30 days)'); drawCmp();
  }
  for (const k of Object.keys(f)) f[k].addEventListener(k === 'q' || k === 'maxIn' ? 'input' : 'change', debounce(draw, k === 'q' ? 250 : 0));
  $('more').onclick = () => { show += 60; draw(); };
  for (const id of ['pIn', 'pOut', 'tIn', 'tOut', 'reqs']) $(id).addEventListener('input', () => { if (id === 'pIn' || id === 'pOut') $('calcModel').value = ''; calc(); });
  $('calcModel').onchange = calc;
  (async () => {
    say(t('Loading…'));
    try { const g = await getJSON(ROUTER_API, 1800000); all = ((g.data && g.data.data) || []).map(normRouted).filter((r) => r.id); if (!all.length) throw new Error('none');
      $('calcModel').append(...[...all].sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('option', { value: r.id }, r.name))); draw(); }
    catch (_) { say(t('The price list did not load. Try again later.'), true); $('rows').replaceChildren(); }
  })();
}

// ------------------------------------------------------------ /models/arena/
const VOTES = 'a2m.void.ai.votes';
function arena() {
  let votes = load(VOTES, []); if (!Array.isArray(votes)) votes = [];
  const fromLink = location.hash.match(/^#v=([A-Za-z0-9_-]+)$/); if (fromLink) { try { const v = JSON.parse(atob(fromLink[1].replace(/-/g, '+').replace(/_/g, '/'))); if (Array.isArray(v)) { votes = v.filter((x) => x && x.a && x.b).slice(0, 2000); } } catch (_) { /* not a ratings link */ } }
  let pair = null, cat = 'general';
  const voteBtns = [...document.querySelectorAll('[data-vote]')];
  const out = (id, title, r) => $(id).replaceChildren(el('h3', {}, title), r == null ? el('p', { class: 'note' }, t('Thinking…')) : r.reply ? el('div', { html: mdToHtml(r.reply) }) : el('p', { class: 'bad' }, r.say));
  function table() {
    const rs = ratings(votes, $('rcat').value), tb = $('ratings').tBodies[0]; tb.replaceChildren();
    rs.forEach((r, i) => tb.insertRow().append(el('td', {}, String(i + 1)), el('td', {}, labelOf(r.key)), el('td', { class: 'n' }, String(r.rating)), el('td', { class: 'n' }, String(r.wins)), el('td', { class: 'n' }, String(r.losses)), el('td', { class: 'n' }, String(r.ties)), el('td', { class: 'n' }, String(r.n))));
    $('votesNote').textContent = votes.length ? votes.length + ' ' + t('votes') : t('No votes yet.');
  }
  $('battle').onclick = async () => {
    const text = $('prompt').value.trim(); if (!text) { $('reveal').textContent = t('Write a prompt first.'); return; }
    pair = pickPair(TRY.map((x) => x.key)); cat = $('cat').value; voteBtns.forEach((b) => { b.disabled = true; }); $('battle').disabled = true; $('reveal').textContent = t('The names show after you vote.');
    out('ansA', t('Model A'), null); out('ansB', t('Model B'), null);
    const [a, b] = await Promise.all(pair.map((m) => askModel({ messages: [{ role: 'user', text }], model: m })));
    out('ansA', t('Model A'), a); out('ansB', t('Model B'), b); $('battle').disabled = false;
    if (a.reply && b.reply) voteBtns.forEach((x) => { x.disabled = false; }); else pair = null;
  };
  for (const b of voteBtns) b.onclick = () => {
    if (!pair) return; votes.push({ a: pair[0], b: pair[1], win: b.dataset.vote, cat, at: Date.now() }); save(VOTES, votes.slice(-2000));
    $('reveal').textContent = t('A was') + ' ' + labelOf(pair[0]) + ', ' + t('B was') + ' ' + labelOf(pair[1]) + '. ' + t('Vote kept.'); pair = null; voteBtns.forEach((x) => { x.disabled = true; }); table();
  };
  $('sbGo').onclick = async () => {
    const text = $('prompt').value.trim(); if (!text) { $('sbOutA').textContent = t('Write a prompt first.'); return; }
    $('sbGo').disabled = true; out('sbOutA', labelOf($('sbA').value), null); out('sbOutB', labelOf($('sbB').value), null);
    const [a, b] = await Promise.all([$('sbA').value, $('sbB').value].map((m) => askModel({ messages: [{ role: 'user', text }], model: m })));
    out('sbOutA', labelOf($('sbA').value), a); out('sbOutB', labelOf($('sbB').value), b); $('sbGo').disabled = false;
  };
  $('rcat').onchange = table;
  $('csv').onclick = () => download('arena-votes.csv', 'model_a,model_b,winner,category,time\n' + votes.map((v) => [labelOf(v.a), labelOf(v.b), v.win, v.cat, new Date(v.at || 0).toISOString()].map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
  $('link').onclick = () => shareLink(location.origin + '/models/arena/#v=' + btoa(JSON.stringify(votes.slice(-300).map(({ a, b, win, cat: c }) => ({ a, b, win, cat: c })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), document.title, (s) => { $('votesNote').textContent = s; });
  $('clear').onclick = () => { if (confirm(t('Clear every vote on this device?'))) { votes = []; save(VOTES, votes); table(); } };
  table();
}

const PAGES = { hub, leaderboard, local, prices, arena };
/** wires one page: its German words, theme and share button first, then its own controls. */
export function start(page) { boot(say); (PAGES[page] || hub)(); }
void TASKS; void LICENCES;
