// The search pages' screen (/search/ and its lane pages): one box; a bang jumps straight to a site (on the device); any other search gets Verse's answer
// with its sources (/api/answer), Wikipedia's results with when each was last edited, Wikidata's entities, and the same search on Google, Bing,
// DuckDuckGo, Brave, Wikipedia and more. Verse does not crawl the web and the page says so. The history stays on the device (pause, remove, clear);
// your own bangs too. With the network cut the page opens (sw.js LATER), and the bangs, engine links and history still work.
// mountSearch(root, { panels: [...] }) mounts the panels a page asks for.
import * as C from '/lib/search-core.js';
import { DE } from '/lib/search-de.js';

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'de' || (params.get('lang') !== 'en' && /^de\b/i.test(navigator.language || '')) ? 'de' : 'en';
const de = lang === 'de';
export const t = (s) => (de && DE[s]) || s;
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const ext = (url, text) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
const WM = { 'Api-User-Agent': 'Verse/1.0 (https://a-to-mind.com)' };
async function getJson(url, opts = {}) {
  if (!navigator.onLine) throw new Error('offline');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try { const r = await fetch(url, { ...opts, signal: ctl.signal, referrerPolicy: 'origin' }); if (!r.ok && r.status !== 429) throw new Error('http ' + r.status); const j = await r.json(); if (r.status === 429) j.__slow = true; return j; } finally { clearTimeout(timer); }
}
async function copyText(text, el) { try { await navigator.clipboard.writeText(text); el.textContent = t('Link copied'); } catch (_) { el.textContent = text; } }

let cfg = {}, path = '/search/';
const P = {}; // the mounted panels by name, each { el, run(q) }

// ---------- panels ----------
function boxPanel() {
  const input = h('input', { type: 'search', id: 's-q', name: 'q', placeholder: t('Words, a question, or !bang words'), 'aria-label': t('Search the web'), autocomplete: 'off', enterkeyhint: 'search', maxlength: '400' });
  const sug = h('ul', { class: 'sug', id: 's-sug', hidden: true }), st = h('p', { class: 'live', 'aria-live': 'polite', id: 's-st' });
  input.addEventListener('input', () => { sug.textContent = ''; const l = C.suggest(input.value, C.history()); sug.hidden = !l.length || !input.value.trim(); for (const x of l) sug.append(h('li', {}, h('button', { type: 'button', onclick: () => { input.value = x.q; sug.hidden = true; submit(); } }, x.q))); });
  input.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 200));
  function submit() {
    const q = input.value.trim(); if (!q) return; sug.hidden = true;
    const b = C.bangOf(q, lang, C.customBangs());
    if (b) { C.remember(q); st.textContent = t('Going to') + ' ' + b.name + '…'; location.assign(b.url); return; }
    C.remember(q); history.replaceState(null, '', path + '?q=' + encodeURIComponent(q).replace(/%20/g, '+') + (params.get('lang') ? '&lang=' + params.get('lang') : ''));
    document.title = q + ' · Verse search'; st.textContent = '';
    for (const k of Object.keys(P)) if (P[k].run) P[k].run(q);
  }
  P.box = { input, submit };
  const form = h('form', { role: 'search', class: 'sbox', onsubmit: (e) => { e.preventDefault(); submit(); } }, h('div', { class: 'field' }, input, sug), h('button', { type: 'submit', class: 'go' }, t('Search')));
  return h('section', { 'aria-label': t('Search the web') }, form, st, h('p', { class: 'note' }, t('Verse does not crawl the web. A search here is Verse\'s answer with its sources, Wikipedia and Wikidata, and the same search one tap away on the engines that crawl.')));
}
function answerPanel() {
  const out = h('div', { id: 's-answer', 'aria-live': 'polite' }), sec = h('section', { class: 'panel', 'aria-label': t('Verse\'s answer'), hidden: true }, h('h2', {}, t('Verse\'s answer')), out);
  let n = 0;
  P.answer = { run: async (q) => {
    const my = ++n; sec.hidden = false; out.textContent = t('Searching…');
    try {
      const j = await getJson('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: q }) }); if (my !== n) return;
      out.textContent = '';
      if (j.__slow) return out.append(h('p', { class: 'soft' }, t('Too many questions at once: wait a minute and ask again.')));
      if (!j.answer) return out.append(h('p', { class: 'soft' }, t('No answer this time.')));
      const srcs = (j.sources || []).filter((s) => s && /^https:\/\//.test(s.url));
      const body = h('div', { class: 'answer' }); for (const para of String(j.answer).split(/\n{2,}/)) { const p = h('p'); for (const part of C.answerParts(para, srcs)) p.append(part.cite ? h('sup', {}, ext(part.url, '[' + part.cite + ']')) : part.text); body.append(p); }
      out.append(body);
      if (srcs.length) out.append(h('h3', {}, t('Sources')), h('ol', { class: 'srcs' }, ...srcs.map((s) => h('li', {}, ext(s.url, s.title || s.url), s.edited ? h('span', { class: 'soft' }, ' · ' + t('edited') + ' ' + String(s.edited).slice(0, 10)) : null))));
      out.append(h('p', { class: 'note' }, t('From a language model with Wikipedia as its sources: check the sources before you rely on it.')));
    } catch (e) { if (my === n) { out.textContent = String(e.message) === 'offline' ? t('You are offline: answers and Wikipedia need the network; bangs, the engine links and your history still work.') : t('The answer engine did not answer.'); } }
  } };
  return sec;
}
function wikiPanel() {
  const out = h('div', { id: 's-wiki', 'aria-live': 'polite' }), sec = h('section', { class: 'panel', 'aria-label': t('Wikipedia'), hidden: true }, h('h2', {}, t('Wikipedia')), out);
  let n = 0;
  P.wiki = { run: async (q) => {
    const my = ++n; sec.hidden = false; out.textContent = t('Searching…');
    try {
      const r = C.wikiResults(await getJson(C.wikiSearchUrl(q, lang), { headers: WM }), lang); if (my !== n) return; out.textContent = '';
      if (r.suggestion) out.append(h('p', {}, t('Did you mean') + ' ', h('a', { href: path + '?q=' + encodeURIComponent(r.suggestion) }, r.suggestion), '?'));
      if (!r.results.length) return out.append(h('p', { class: 'soft' }, t('Nothing on Wikipedia for that.')));
      out.append(h('p', { class: 'soft' }, r.total.toLocaleString(de ? 'de-DE' : 'en-US') + ' ' + t('results')));
      out.append(h('ol', { class: 'results' }, ...r.results.map((x) => h('li', {}, h('h3', {}, ext(x.url, x.title)), h('p', { class: 'cite' }, x.url.replace(/^https:\/\//, '').slice(0, 70)), h('p', {}, x.snippet ? x.snippet + '…' : ''),
        h('p', { class: 'soft' }, t('edited') + ' ' + x.edited + ' · ', h('a', { href: (cfg.panels.includes('reader') ? path : '/search/wiki/') + '?title=' + encodeURIComponent(x.title) + (params.get('lang') ? '&lang=' + params.get('lang') : '') }, t('Read it here')))))));
      out.append(h('p', { class: 'note' }, t('Text from Wikipedia, CC BY-SA 4.0.')));
    } catch (e) { if (my === n) out.textContent = String(e.message) === 'offline' ? t('You are offline: answers and Wikipedia need the network; bangs, the engine links and your history still work.') : t('Nothing on Wikipedia for that.'); }
  } };
  return sec;
}
function wikidataPanel() {
  const out = h('div', { id: 's-wd' }), sec = h('section', { class: 'panel', 'aria-label': t('Wikidata'), hidden: true }, h('h2', {}, t('Wikidata')), out);
  let n = 0;
  P.wikidata = { run: async (q) => { const my = ++n; out.textContent = ''; try { const l = C.wikidataResults(await getJson(C.wikidataUrl(q, lang), { headers: WM })); if (my !== n) return; sec.hidden = !l.length; out.append(h('ul', { class: 'plain' }, ...l.map((e) => h('li', {}, ext(e.url, e.label), h('span', { class: 'soft' }, ' · ' + e.id + (e.description ? ' · ' + e.description : '')))))); } catch (_) { sec.hidden = true; } } };
  return sec;
}
function enginesPanel() {
  const out = h('div', { id: 's-eng' }), sec = h('section', { class: 'panel', 'aria-label': t('Search this on') }, h('h2', {}, t('Search this on')), out);
  const draw = (q) => { out.textContent = ''; const main = C.engineLinks(q, lang, C.MAIN_ENGINES), more = C.engineLinks(q, lang).filter((e) => !C.MAIN_ENGINES.includes(e.id));
    out.append(h('p', { class: 'chips' }, ...main.map((e) => h('a', { class: 'btn', href: e.url, target: '_blank', rel: 'noopener noreferrer', 'data-engine': e.id }, e.name + ' ↗'))), h('p', { class: 'chips' }, h('span', { class: 'soft' }, t('More engines') + ':'), ...more.map((e) => h('a', { class: 'btn small', href: e.url, target: '_blank', rel: 'noopener noreferrer', 'data-engine': e.id }, e.name + ' ↗')))); };
  P.engines = { run: draw }; draw(''); return sec;
}
function multiPanel() {
  const KEY = 'a2m.search.multi.v1'; let on; try { on = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { on = null; } if (!Array.isArray(on)) on = C.MAIN_ENGINES.slice();
  const boxes = C.ENGINES.map((e) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', value: e.id, checked: on.includes(e.id), onchange: () => { on = [...sec.querySelectorAll('input[type=checkbox]:checked')].map((x) => x.value); try { localStorage.setItem(KEY, JSON.stringify(on)); } catch (_) {} } }), e.name));
  const st = h('p', { class: 'live', 'aria-live': 'polite' });
  const open = h('button', { type: 'button', class: 'go', id: 's-openall', onclick: () => { const q = P.box ? P.box.input.value.trim() : ''; if (!q) return; let opened = 0; for (const l of C.engineLinks(q, lang, on)) { if (window.open(l.url, '_blank', 'noopener,noreferrer') || true) opened++; } st.textContent = opened + ' · ' + t('Your browser may ask you to allow pop-ups to open several at once.'); } }, t('Open all checked'));
  const sec = h('section', { class: 'panel', 'aria-label': t('Engines to search') }, h('h2', {}, t('Engines to search')), h('div', { class: 'grid3' }, ...boxes), h('div', { class: 'row' }, open), st);
  return sec;
}
function fromPanel() {
  const cc = h('select', { id: 's-cc', 'aria-label': t('Country') }, ...C.COUNTRIES.map(([c, name]) => h('option', { value: c, selected: c === (de ? 'DE' : 'US') }, name + ' (' + c + ')')));
  const hl = h('select', { id: 's-hl', 'aria-label': t('Language') }, h('option', { value: '' }, '—'), ...[...new Set(C.COUNTRIES.map((c) => c[2]))].sort().map((l) => h('option', { value: l }, l)));
  const out = h('div', { id: 's-from' });
  const draw = () => { out.textContent = ''; const q = P.box ? P.box.input.value.trim() : ''; if (!q) return; out.append(h('p', { class: 'chips' }, ...C.fromLinks(q, cc.value, hl.value || null).map((l) => h('a', { class: 'btn', href: l.url, target: '_blank', rel: 'noopener noreferrer', 'data-engine': l.id }, l.name + ' ↗')))); };
  cc.addEventListener('change', draw); hl.addEventListener('change', draw); P.from = { run: draw };
  const cc0 = params.get('cc'); if (cc0 && C.COUNTRIES.some((c) => c[0] === cc0.toUpperCase())) cc.value = cc0.toUpperCase();
  return h('section', { class: 'panel', 'aria-label': t('Search as if from') }, h('h2', {}, t('Search as if from')), h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { for: 's-cc' }, t('Country')), cc), h('div', { class: 'field' }, h('label', { for: 's-hl' }, t('Language')), hl)), out,
    h('p', { class: 'note' }, t('The engines still answer from their own servers where you are: these links set the country and language they show, with personal results off on Google. A captcha can appear.')));
}
function historyPanel() {
  const list = h('ul', { class: 'alist', id: 's-hist' }), pause = h('input', { type: 'checkbox', id: 's-pause', checked: C.historyPaused(), onchange: () => { C.setPaused(pause.checked); draw(); } });
  const draw = () => { list.textContent = ''; const l = C.history().slice(0, 30); if (C.historyPaused()) list.append(h('li', { class: 'soft' }, t('History is paused.'))); else if (!l.length) list.append(h('li', { class: 'soft' }, t('No searches yet.')));
    for (const x of l) list.append(h('li', { class: 'hist' }, h('a', { href: path + '?q=' + encodeURIComponent(x.q) }, x.q), h('span', { class: 'soft' }, ' · ' + x.at.slice(0, 10)), h('button', { type: 'button', 'aria-label': t('Remove') + ' ' + x.q, onclick: () => { C.forget(x.q); draw(); } }, '✕'))); };
  P.history = { run: () => setTimeout(draw, 0) }; draw();
  return h('section', { class: 'panel', 'aria-label': t('History') }, h('h2', {}, t('History')), h('p', { class: 'note' }, t('Kept on this device only.')), list, h('div', { class: 'row' }, h('label', { class: 'chk' }, pause, t('Pause history')), h('button', { type: 'button', onclick: () => { C.clearHistory(); draw(); } }, t('Clear history'))));
}
function bangsPanel(full = false) {
  const out = h('div', {}), find = h('input', { type: 'search', id: 's-bfind', placeholder: t('Find a bang'), 'aria-label': t('Find a bang') });
  const table = h('table', { class: 'tbl', id: 's-bangs' }), mine = h('ul', { class: 'alist', id: 's-mine' }), st = h('p', { class: 'live', 'aria-live': 'polite' });
  const rows = () => { const w = find.value.trim().toLowerCase().replace(/^!/, ''), all = { ...C.BANGS, ...C.customBangs() }; table.textContent = ''; const body = table.createTBody();
    for (const [k, [name, url]] of Object.entries(all).filter(([k, [n]]) => !w || k.includes(w) || n.toLowerCase().includes(w)).slice(0, full ? 400 : 12)) { const r = body.insertRow(); r.insertCell().append(h('code', {}, '!' + k)); r.insertCell().textContent = name; r.insertCell().append(h('span', { class: 'soft' }, url.replace(/^https:\/\//, '').slice(0, 48))); } };
  const drawMine = () => { mine.textContent = ''; for (const [k, [, url]] of Object.entries(C.customBangs())) mine.append(h('li', {}, h('code', {}, '!' + k), ' ', h('span', { class: 'soft' }, url), ' ', h('button', { type: 'button', 'aria-label': t('Remove') + ' !' + k, onclick: () => { C.removeCustomBang(k); drawMine(); rows(); } }, '✕'))); };
  find.addEventListener('input', rows); rows();
  out.append(h('p', { class: 'note' }, t('Type !g, !w, !yt and the words to go straight to that site\'s search. Bangs run on this device.')), h('label', { for: 's-bfind', class: 'soft' }, t('Find a bang')), find, h('div', { class: 'tablewrap' }, table));
  if (full) {
    const w = h('input', { type: 'text', id: 's-bw', placeholder: 'mysite', 'aria-label': t('Bang word') }), u = h('input', { type: 'text', id: 's-bu', placeholder: 'https://example.com/search?q=%s', 'aria-label': t('Address with %s for the words') });
    drawMine();
    out.append(h('h3', {}, t('Your own bangs')), mine, h('div', { class: 'grid2' }, w, u), h('div', { class: 'row' }, h('button', { type: 'button', class: 'go', id: 's-badd', onclick: () => { if (C.addCustomBang(w.value, u.value)) { w.value = ''; u.value = ''; st.textContent = ''; drawMine(); rows(); } else st.textContent = t('A bang needs a word of 1 to 12 letters and an https address with %s in it.'); } }, t('Add'))), st);
  }
  return h('section', { class: 'panel', 'aria-label': t('Bangs') }, h('h2', {}, full ? t('All bangs') : t('Bangs')), out);
}
function readerPanel() {
  const out = h('article', { id: 's-read', 'aria-live': 'polite' }), size = h('input', { type: 'range', min: '14', max: '24', value: '17', 'aria-label': t('Text size'), oninput: () => { out.style.fontSize = size.value + 'px'; } });
  let speaking = false; const say = h('button', { type: 'button', onclick: () => { if (!('speechSynthesis' in window)) return; if (speaking) { speechSynthesis.cancel(); speaking = false; say.textContent = t('Read aloud'); return; } const u = new SpeechSynthesisUtterance(out.innerText.slice(0, 30000)); u.lang = de ? 'de-DE' : 'en-US'; u.onend = () => { speaking = false; say.textContent = t('Read aloud'); }; speechSynthesis.speak(u); speaking = true; say.textContent = t('Stop'); } }, t('Read aloud'));
  const sec = h('section', { class: 'panel', 'aria-label': 'Reader', hidden: true }, h('div', { class: 'row' }, h('label', { class: 'chk' }, t('Text size'), size), say), out);
  async function open(title) {
    sec.hidden = false; out.textContent = t('Loading…');
    try {
      const [sum, page] = await Promise.all([getJson(C.wikiSummaryUrl(title, lang), { headers: WM }).then(C.wikiSummary).catch(() => null), getJson(C.wikiTextUrl(title, lang), { headers: WM }).then(C.wikiPage)]);
      out.textContent = ''; if (!page) { out.append(h('p', { class: 'soft' }, t('Nothing on Wikipedia for that.'))); return; }
      document.title = page.title + ' · Verse';
      out.append(h('h2', { class: 'atitle' }, page.title));
      if (sum && sum.description) out.append(h('p', { class: 'soft' }, sum.description));
      if (sum && sum.image) out.append(h('img', { src: sum.image, alt: '', class: 'lead', loading: 'lazy', referrerpolicy: 'no-referrer' }));
      const toc = h('ol', { class: 'toc' }); const heads = page.sections.filter((s) => s.heading);
      if (heads.length > 2) out.append(h('details', { open: innerWidth > 700 }, h('summary', {}, t('Contents')), toc));
      page.sections.forEach((s, i) => { const id = 'sec-' + i; if (s.heading) { toc.append(h('li', { class: 'l' + s.level }, h('a', { href: '#' + id }, s.heading))); out.append(h(s.level <= 2 ? 'h3' : 'h4', { id }, s.heading)); } for (const para of s.text.split('\n\n')) if (para) out.append(h('p', {}, para)); });
      out.append(h('p', { class: 'note' }, ext(page.url || '', t('Open on Wikipedia') + ' ↗'), ' · ', t('Text from Wikipedia, CC BY-SA 4.0.')));
      if (page.langs.length) { const sel = h('select', { 'aria-label': t('Other languages'), onchange: () => { if (sel.value) window.open('https://' + sel.value + '.wikipedia.org/wiki/' + encodeURIComponent(sel.selectedOptions[0].dataset.t), '_blank', 'noopener'); } }, h('option', { value: '' }, t('Other languages') + ' (' + page.langs.length + ')'), ...page.langs.map((l) => h('option', { value: l.lang, 'data-t': l.title }, l.lang + ' · ' + l.title))); out.append(h('p', {}, sel)); }
    } catch (e) { out.textContent = String(e.message) === 'offline' ? t('You are offline: answers and Wikipedia need the network; bangs, the engine links and your history still work.') : t('Nothing on Wikipedia for that.'); }
  }
  P.reader = { open }; return sec;
}
function sharePanel() {
  const st = h('span', { class: 'soft', 'aria-live': 'polite' });
  return h('p', { class: 'row share' }, h('button', { type: 'button', onclick: () => copyText(location.href, st) }, t('Copy link')), navigator.share ? h('button', { type: 'button', onclick: () => navigator.share({ title: document.title, url: location.href }).catch(() => {}) }, t('Share')) : null,
    h('a', { href: '/search/opensearch.xml', class: 'btn small', onclick: (e) => { e.preventDefault(); st.textContent = de ? 'Im Browser: Einstellungen › Suchmaschine › Verse search hinzufügen (diese Seite bietet sie an).' : 'In your browser: Settings › Search engine › add "Verse search" (this page offers it).'; } }, t('Make this your browser\'s search engine')), st);
}
function keepForOffline() {
  try { if (!('caches' in window)) return; caches.open('void-shell-v2').then((c) => Promise.all([location.pathname, location.pathname + 'app.js', '/lib/search-ui.js', '/lib/search-core.js', '/lib/search-de.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/flight-sites.js'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {}); } catch (_) { /* online only */ }
}
/** mounts the panels a page asks for: { panels: ['box', 'answer', 'wiki', 'wikidata', 'engines', 'multi', 'from', 'history', 'bangs', 'allbangs', 'reader', 'share'], de: { h1, intro } } */
export function mountSearch(root, config = {}) {
  cfg = { panels: ['box', 'engines', 'answer', 'wiki', 'wikidata', 'history', 'bangs', 'share'], ...config }; path = location.pathname;
  if (de) { document.documentElement.lang = 'de'; const d = cfg.de || {}; if (d.h1 && document.querySelector('h1')) document.querySelector('h1').textContent = d.h1; if (d.intro && document.querySelector('.intro')) document.querySelector('.intro').textContent = d.intro; }
  const off = h('p', { class: 'notice', id: 's-offline', hidden: navigator.onLine }, t('You are offline: answers and Wikipedia need the network; bangs, the engine links and your history still work.'));
  addEventListener('online', () => { off.hidden = true; }); addEventListener('offline', () => { off.hidden = false; }); root.append(off);
  const make = { box: boxPanel, answer: answerPanel, wiki: wikiPanel, wikidata: wikidataPanel, engines: enginesPanel, multi: multiPanel, from: fromPanel, history: historyPanel, bangs: () => bangsPanel(false), allbangs: () => bangsPanel(true), reader: readerPanel, share: sharePanel };
  for (const p of cfg.panels) if (make[p]) root.append(make[p]());
  const q = (params.get('q') || '').trim().slice(0, 400), title = (params.get('title') || '').trim().slice(0, 300);
  if (q && P.box) { P.box.input.value = q; const b = C.bangOf(q, lang, C.customBangs()); if (b && params.get('go') !== '0') { location.replace(b.url); return; } P.box.submit(); }
  if (title && P.reader) P.reader.open(title);
  document.documentElement.dataset.searchReady = '1';
  keepForOffline();
}
