/**
 * jobs-ui: the screen of the jobs pages (/jobs/ and one page per site of the jobs lane, lib/job-sites.js). One module; each page asks for the panels it needs and may
 * start from a preset search: mountJobs(root, { panels: ['search', 'saved', 'alerts', 'tracker', 'feed', 'sources', 'regions'|'categories'|'tags'|'companies'], preset }).
 * The listings come first from the committed snapshot (/jobs/snapshot.json, labelled a snapshot of its date, never live), then from /api/jobs (the live feeds, cached on
 * the edge); the last live list is kept in this browser so the page answers offline. Saved jobs, saved searches (alerts) and the application tracker are kept in this
 * browser only: nothing about the visitor goes to a server. Every listing names its source and links to its original posting; Apply opens it there. English and
 * German. Pure logic: lib/jobs-core.js. Tests: tools/jobs.test.mjs, tools/jobs-page.mjs.
 */
import * as C from '/lib/jobs-core.js';
import { DE } from '/lib/jobs-de.js';

const KEY = 'a2m.void.jobs.v1', LIVE = 'a2m.void.jobs.live.v1';
const isDe = () => /^de\b/i.test(navigator.language || '') || new URLSearchParams(location.search).get('lang') === 'de';
export const t = (s) => (isDe() && DE[s]) || s;
const lang = () => (isDe() ? 'de' : 'en');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (root, sel) => root.querySelector(sel);
const num = (n) => Number(n).toLocaleString(isDe() ? 'de-DE' : 'en-US');
function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked: the page still works */ } return m; }
const day = (iso) => { try { return new Intl.DateTimeFormat(isDe() ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(iso)) + ' UTC'; } catch (_) { return iso; } };
const today = () => new Date().toISOString().slice(0, 10);
const download = (name, type, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };

// ---------- shared state ----------
let jobs = [], snapAt = '', live = null, cfgNow = {};
const s = { ...C.EMPTY };
const subs = new Set(); const emit = () => { for (const f of subs) f(); };
function writeLink() { const q = C.toQuery(s), pre = C.toQuery(cfgNow.preset || {}); try { history.replaceState(null, '', location.pathname + (q && q !== pre ? '?' + q : '') + location.hash); } catch (_) { /* a sandbox without history */ } }
const setSearch = (patch) => { Object.assign(s, patch); writeLink(); emit(); };
const results = () => C.search(jobs, s);

function panel(title, id, inner) { const el = document.createElement('section'); el.className = 'panel'; el.id = id; el.innerHTML = '<h2>' + esc(t(title)) + '</h2>' + inner; return el; }
function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(label) + '</option>'; }

// ---------- a job as a card ----------
function card(j, opts = {}) {
  const src = C.SOURCES[j.src], saved = (mem().saved || []).some((x) => x.id === j.id), tracked = C.isTracked(mem().apps, j), fresh = opts.fresh && opts.fresh.has(j.id);
  const bits = [j.company, j.loc || t('Anywhere'), j.type && t(C.TYPES[j.type] || j.type), j.level].filter(Boolean).map(esc).join(' · ');
  const li = document.createElement('li'); li.className = 'job' + (fresh ? ' fresh' : ''); li.dataset.id = j.id;
  li.innerHTML = '<div class="jh"><span class="av" aria-hidden="true">' + esc((j.company || '?').slice(0, 1).toUpperCase()) + '</span><div class="jt"><a class="jl" href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.title) + '</a>'
    + (fresh ? ' <span class="new">' + esc(t('new')) + '</span>' : '') + '<div class="soft">' + bits + '</div></div></div>'
    + (j.salary ? '<div class="pay">' + esc(C.salaryText(j.salary, lang())) + '</div>' : '')
    + (j.tz ? '<div class="soft">' + esc(t('Time zones')) + ': ' + esc(j.tz) + '</div>' : '')
    + (j.visa ? '<div class="visa">' + esc(t('Mentions visa sponsorship')) + '</div>' : '')
    + (j.excerpt ? '<p class="ex">' + esc(j.excerpt) + '</p>' : '')
    + (j.tags.length ? '<div class="chips">' + j.tags.slice(0, 6).map((x) => '<button type="button" class="chip tagb" data-tag="' + esc(x) + '">' + esc(x) + '</button>').join('') + '</div>' : '')
    + '<div class="row jb"><a class="btn go" href="' + esc(j.apply || j.url) + '" target="_blank" rel="noopener">' + esc(t('Apply on')) + ' ' + esc(src.name) + '</a>'
    + '<button type="button" class="savej" aria-pressed="' + saved + '">' + esc(saved ? t('Saved') : t('Save')) + '</button><button type="button" class="trackj">' + esc(tracked ? t('In the tracker') : t('Track')) + '</button></div>'
    + '<div class="soft src">' + esc(t('Listing from')) + ' <a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(src.name) + '</a>' + (j.date ? ' · ' + esc(C.ago(j.date, lang())) : '') + '</div>';
  $(li, '.savej').addEventListener('click', (e) => { toggleSave(j); const on = (mem().saved || []).some((x) => x.id === j.id); e.target.setAttribute('aria-pressed', on); e.target.textContent = on ? t('Saved') : t('Save'); emitSaved(); });
  $(li, '.trackj').addEventListener('click', (e) => { addApp({ title: j.title, company: j.company, url: j.url, src: j.src, stage: 'saved' }); e.target.textContent = t('In the tracker'); });
  cardJob.set(li, j);
  for (const b of li.querySelectorAll('.tagb')) b.addEventListener('click', () => { setSearch({ tag: b.dataset.tag }); const r = document.getElementById('jb-search'); if (r) r.scrollIntoView({ block: 'start' }); });
  return li;
}
const savedSubs = new Set(); const emitSaved = () => { for (const f of savedSubs) f(); };
// Every card on the screen shows the Save and Track state of now, also after a change in another panel.
const cardJob = new WeakMap();
savedSubs.add(() => { const m = mem(); for (const li of document.querySelectorAll('li.job')) { const j = cardJob.get(li); if (!j) continue; const on = (m.saved || []).some((x) => x.id === j.id), sv = $(li, '.savej'), tr = $(li, '.trackj');
  if (sv) { sv.setAttribute('aria-pressed', on); sv.textContent = on ? t('Saved') : t('Save'); } if (tr) tr.textContent = C.isTracked(m.apps, j) ? t('In the tracker') : t('Track'); } });
function toggleSave(j) { const list = mem().saved || [], i = list.findIndex((x) => x.id === j.id); if (i >= 0) list.splice(i, 1); else list.unshift(j); keep({ saved: list.slice(0, 300) }); }

// ---------- panels ----------
const PANELS = {
  search() {
    const el = panel('Search jobs', 'jb-search', '<form class="grid2" id="jb-form" role="search">'
      + '<div class="field"><label for="jb-q">' + esc(t('Keyword')) + '</label><input type="search" id="jb-q" placeholder="' + esc(t('Title, skill or company')) + '"></div>'
      + '<div class="field"><label for="jb-loc">' + esc(t('Place')) + '</label><input type="search" id="jb-loc" placeholder="' + esc(t('City or country; empty for anywhere')) + '"></div>'
      + '<div class="field"><label for="jb-region">' + esc(t('Work from')) + '</label><select id="jb-region">' + opt('', t('Any region'), '') + Object.entries(C.REGIONS).map(([k, v]) => opt(k, t(v), '')).join('') + '</select></div>'
      + '<div class="field"><label for="jb-cat">' + esc(t('Category')) + '</label><select id="jb-cat"><option value="">' + esc(t('Any category')) + '</option></select></div>'
      + '<div class="field"><label for="jb-tag">' + esc(t('Tag')) + '</label><input type="search" id="jb-tag" list="jb-tags" placeholder="' + esc(t('python, design, sales…')) + '"><datalist id="jb-tags"></datalist></div>'
      + '<div class="field"><label for="jb-type">' + esc(t('Job type')) + '</label><select id="jb-type">' + opt('', t('Any type'), '') + Object.entries(C.TYPES).map(([k, v]) => opt(k, t(v), '')).join('') + '</select></div>'
      + '<div class="field"><label for="jb-level">' + esc(t('Level')) + '</label><select id="jb-level">' + opt('', t('Any level'), '') + ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Executive'].map((v) => opt(v.toLowerCase(), t(v), '')).join('') + '</select></div>'
      + '<div class="field"><label for="jb-min">' + esc(t('Minimum salary a year')) + '</label><input type="number" id="jb-min" min="0" step="5000" inputmode="numeric" placeholder="0"></div>'
      + '<div class="field"><label for="jb-days">' + esc(t('Posted')) + '</label><select id="jb-days">' + opt(0, t('Any time'), 0) + [[1, 'In the last day'], [3, 'In the last 3 days'], [7, 'In the last week'], [14, 'In the last 2 weeks'], [30, 'In the last month']].map(([k, v]) => opt(k, t(v), 0)).join('') + '</select></div>'
      + '<div class="field"><label for="jb-src">' + esc(t('Source')) + '</label><select id="jb-src">' + opt('', t('All sources'), '') + Object.entries(C.SOURCES).map(([k, v]) => opt(k, v.name, '')).join('') + '</select></div>'
      + '<div class="field"><label for="jb-sort">' + esc(t('Sort')) + '</label><select id="jb-sort">' + Object.entries(C.SORTS).map(([k, v]) => opt(k, t(v), 'new')).join('') + '</select></div>'
      + '<div class="field chks"><label class="chk"><input type="checkbox" id="jb-sal"> ' + esc(t('Only with a salary')) + '</label><label class="chk"><input type="checkbox" id="jb-visa"> ' + esc(t('Visa sponsorship mentioned')) + '</label></div>'
      + '</form><div class="row"><button type="button" id="jb-clear">' + esc(t('Clear filters')) + '</button><button type="button" id="jb-savesearch" class="go">' + esc(t('Save this search as an alert')) + '</button><span class="live" id="jb-ssmsg" role="status"></span></div>'
      + '<p class="count" id="jb-count" role="status" aria-live="polite">' + esc(t('Loading listings…')) + '</p><ol class="jobs" id="jb-results"></ol><div class="row"><button type="button" id="jb-more" hidden>' + esc(t('Show more')) + '</button></div>'
      + '<details class="also" id="jb-else"><summary>' + esc(t('Open this search on other job sites')) + '</summary><ul class="plist" id="jb-sites"></ul><p class="soft">' + esc(t('These links open the same words on each site; Verse sends nothing. Each says how sure its address pattern is.')) + '</p></details>');
    const f = (id) => $(el, '#' + id); let shown = 30;
    const fill = () => { f('jb-q').value = s.q; f('jb-loc').value = s.loc; f('jb-region').value = s.region; f('jb-tag').value = s.tag; f('jb-type').value = s.type; f('jb-level').value = s.level; f('jb-min').value = s.min || ''; f('jb-days').value = String(s.days); f('jb-src').value = s.src; f('jb-sort').value = s.sort; f('jb-sal').checked = s.salaryOnly; f('jb-visa').checked = s.visa;
      const cats = C.facet(jobs, 'cat', 60), cs = f('jb-cat'); cs.innerHTML = opt('', t('Any category'), s.cat) + cats.map(([k, n]) => opt(k, k + ' (' + n + ')', s.cat)).join(''); if (s.cat && !cats.some(([k]) => k === s.cat)) cs.insertAdjacentHTML('beforeend', opt(s.cat, s.cat, s.cat));
      f('jb-tags').innerHTML = C.facet(jobs, 'tags', 80).map(([k]) => '<option value="' + esc(k) + '">').join(''); };
    const read = () => setSearch({ q: f('jb-q').value.trim().slice(0, 60), loc: f('jb-loc').value.trim().slice(0, 60), region: f('jb-region').value, cat: f('jb-cat').value, tag: f('jb-tag').value.trim().slice(0, 40), type: f('jb-type').value, level: f('jb-level').value, min: Math.max(0, +f('jb-min').value || 0), days: +f('jb-days').value || 0, src: f('jb-src').value, sort: f('jb-sort').value, salaryOnly: f('jb-sal').checked, visa: f('jb-visa').checked });
    let tm = 0; for (const x of el.querySelectorAll('input,select')) { x.addEventListener(x.type === 'search' || x.type === 'number' ? 'input' : 'change', () => { clearTimeout(tm); tm = setTimeout(() => { shown = 30; read(); }, x.type === 'search' || x.type === 'number' ? 200 : 0); }); }
    f('jb-form').addEventListener('submit', (e) => { e.preventDefault(); read(); });
    f('jb-clear').addEventListener('click', () => { shown = 30; setSearch({ ...C.EMPTY }); });
    f('jb-more').addEventListener('click', () => { shown += 30; draw(); });
    f('jb-savesearch').addEventListener('click', () => { const al = mem().alerts || []; const q = C.toQuery(s); if (al.some((a) => C.toQuery(a.s) === q)) { f('jb-ssmsg').textContent = t('This search is already saved.'); return; } const r = results(); al.unshift({ id: Date.now().toString(36), s: { ...s }, seen: r.reduce((m, j) => (j.date > m ? j.date : m), ''), made: new Date().toISOString() }); keep({ alerts: al.slice(0, 30) }); f('jb-ssmsg').textContent = t('Saved. New matches will be marked when you come back.'); emitSaved(); });
    function draw() {
      fill(); const r = results(), ol = f('jb-results'), fresh = new Set(freshIds());
      f('jb-count').textContent = jobs.length ? num(r.length) + ' ' + t(r.length === 1 ? 'job' : 'jobs') + ' · ' + C.searchName(s) : t('Loading listings…');
      ol.textContent = ''; for (const j of r.slice(0, shown)) ol.append(card(j, { fresh })); f('jb-more').hidden = r.length <= shown;
      if (jobs.length && !r.length) { const li = document.createElement('li'); li.className = 'soft'; li.textContent = t('No job matches every filter. Clear one, or open the search on another site below.'); ol.append(li); }
      const sites = f('jb-sites'); sites.textContent = ''; for (const l of C.searchLinks(s)) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = t('Open on') + ' ' + l.name; const w = document.createElement('span'); w.className = 'soft'; w.textContent = ' ' + (l.check === 'confirmed' ? t('address pattern confirmed') : l.check === 'partly' ? t('address pattern partly confirmed') : t('address pattern not confirmed: it may open the front page')); li.append(a, w); sites.append(li); }
    }
    subs.add(draw); savedSubs.add(() => {}); return el;
  },
  regions() { return facetPanel('Where you may work from', 'jb-regions', () => C.facet(jobs, 'regions', 20).filter(([k]) => C.REGIONS[k]).map(([k, n]) => [k, t(C.REGIONS[k]), regionCount(k, n)]), 'region'); },
  categories() { return facetPanel('Categories', 'jb-cats', () => C.facet(jobs, 'cat', 40).map(([k, n]) => [k, k, n]), 'cat'); },
  tags() { return facetPanel('Tags', 'jb-tagcloud', () => C.facet(jobs, 'tags', 60).map(([k, n]) => [k, k, n]), 'tag'); },
  companies() {
    let by = 'n'; const el = facetPanel('Companies hiring', 'jb-companies', () => { const l = C.facet(jobs, 'company', 400).map(([k, n]) => [k, k, n]); return by === 'az' ? l.sort((a, b) => a[0].localeCompare(b[0])) : l; }, 'company');
    const r = document.createElement('div'); r.className = 'row'; r.innerHTML = '<label class="chk"><input type="radio" name="jb-cby" value="n" checked> ' + esc(t('Most jobs first')) + '</label><label class="chk"><input type="radio" name="jb-cby" value="az"> ' + esc(t('A to Z')) + '</label>';
    for (const x of r.querySelectorAll('input')) x.addEventListener('change', () => { by = x.value; emit(); }); el.insertBefore(r, el.children[1]); return el;
  },
  saved() {
    const el = panel('Saved jobs', 'jb-saved', '<p class="soft">' + esc(t('Jobs you save are kept in this browser only.')) + '</p><ol class="jobs" id="jb-savedlist"></ol>');
    const draw = () => { const l = mem().saved || [], ol = $(el, '#jb-savedlist'); ol.textContent = ''; if (!l.length) { const li = document.createElement('li'); li.className = 'soft'; li.textContent = t('Nothing saved yet: press Save on a job.'); ol.append(li); return; } for (const j of l.map(C.checkJob).filter(Boolean)) ol.append(card(j)); };
    savedSubs.add(draw); subs.add(draw); return el;
  },
  alerts() {
    const el = panel('Alerts', 'jb-alerts', '<p class="soft">' + esc(t('A saved search is an alert: each time you come back it shows how many jobs are new since you last opened it, and marks them. No email and no account: alerts are kept in this browser, and each has an RSS feed for a reader.')) + '</p><ul class="alist" id="jb-alist"></ul><div class="row"><button type="button" id="jb-notify">' + esc(t('Notify me on this device')) + '</button><span class="live" id="jb-nmsg" role="status"></span></div>');
    const draw = () => {
      const al = mem().alerts || [], ul = $(el, '#jb-alist'); ul.textContent = '';
      if (!al.length) { const li = document.createElement('li'); li.className = 'soft'; li.textContent = t('No saved searches yet: search, then press Save this search as an alert.'); ul.append(li); return; }
      for (const a of al) { const r = C.newSince(jobs, a), li = document.createElement('li'); li.className = 'alert';
        li.innerHTML = '<b>' + esc(C.searchName(a.s)) + '</b> <span class="soft">' + esc(num(r.all.length) + ' ' + t('jobs')) + '</span>' + (jobs.length ? ' <span class="new">' + esc(num(r.fresh.length) + ' ' + t('new since your last visit')) + '</span>' : '')
          + '<div class="row"><button type="button" class="open">' + esc(t('Open')) + '</button><a class="btn" href="/api/jobs?format=rss' + (C.toQuery(a.s) ? '&' + esc(C.toQuery(a.s)) : '') + '" target="_blank" rel="noopener">RSS</a><button type="button" class="del">' + esc(t('Remove')) + '</button></div>';
        $(li, '.open').addEventListener('click', () => { pendingFresh = new Set(r.fresh.map((j) => j.id)); a.seen = r.newest || a.seen; keep({ alerts: al }); setSearch({ ...C.EMPTY, ...a.s }); const x = document.getElementById('jb-search'); if (x) x.scrollIntoView({ block: 'start' }); });
        $(li, '.del').addEventListener('click', () => { keep({ alerts: al.filter((x) => x !== a) }); draw(); });
        ul.append(li); }
    };
    $(el, '#jb-notify').addEventListener('click', async () => { if (!('Notification' in window)) { $(el, '#jb-nmsg').textContent = t('This browser has no notifications.'); return; } const p = await Notification.requestPermission(); keep({ notify: p === 'granted' }); $(el, '#jb-nmsg').textContent = p === 'granted' ? t('On: when this page opens and a saved search has new jobs, this device is told.') : t('Notifications are off.'); });
    savedSubs.add(draw); subs.add(draw); return el;
  },
  tracker() {
    const el = panel('Applications', 'tracker', '<p class="soft">' + esc(t('Keep track of where you applied: the stage (saved, applied, interview, offer), the date, the next step and your notes. Kept in this browser only; nothing is sent. Export it as CSV or put the next steps in your calendar.')) + '</p>'
      + '<p class="counts" id="jb-stages"></p><ul class="apps" id="jb-apps"></ul>'
      + '<details class="also"><summary>' + esc(t('Add an application by hand')) + '</summary><form id="jb-addapp" class="grid2"><div class="field"><label for="ja-title">' + esc(t('Job title')) + '</label><input type="text" id="ja-title" required maxlength="140"></div><div class="field"><label for="ja-company">' + esc(t('Company')) + '</label><input type="text" id="ja-company" maxlength="80"></div><div class="field"><label for="ja-url">' + esc(t('Link to the posting')) + '</label><input type="text" id="ja-url" inputmode="url" maxlength="500"></div><div class="field"><label for="ja-stage">' + esc(t('Stage')) + '</label><select id="ja-stage">' + Object.entries(C.STAGES).map(([k, v]) => opt(k, t(v), 'applied')).join('') + '</select></div><div class="row"><button type="submit" class="go">' + esc(t('Add')) + '</button></div></form></details>'
      + '<div class="row"><button type="button" id="jb-csv">' + esc(t('Export CSV')) + '</button><label class="btn" for="jb-imp">' + esc(t('Import CSV')) + '</label><input type="file" id="jb-imp" accept=".csv,text/csv" class="pick"><button type="button" id="jb-ics">' + esc(t('Next steps to calendar (.ics)')) + '</button><span class="live" id="jb-amsg" role="status"></span></div>');
    const draw = () => {
      const apps = (mem().apps || []).map(C.cleanApp).filter(Boolean), c = C.stageCounts(apps), ul = $(el, '#jb-apps');
      $(el, '#jb-stages').textContent = Object.entries(C.STAGES).map(([k, v]) => t(v) + ' ' + c[k]).join(' · ');
      ul.textContent = ''; if (!apps.length) { const li = document.createElement('li'); li.className = 'soft'; li.textContent = t('No applications yet: press Track on a job, or add one by hand.'); ul.append(li); }
      for (const a of apps) { const li = document.createElement('li'); li.className = 'app';
        li.innerHTML = '<div><b>' + (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a>' : esc(a.title)) + '</b>' + (a.company ? ' <span class="soft">' + esc(a.company) + '</span>' : '') + '</div>'
          + '<div class="grid3"><div class="field"><label>' + esc(t('Stage')) + '<select class="st">' + Object.entries(C.STAGES).map(([k, v]) => opt(k, t(v), a.stage)).join('') + '</select></label></div><div class="field"><label>' + esc(t('Applied on')) + '<input type="date" class="ad" value="' + esc(a.applied) + '"></label></div><div class="field"><label>' + esc(t('Next step on')) + '<input type="date" class="nx" value="' + esc(a.next) + '"></label></div></div>'
          + '<div class="field"><label>' + esc(t('Notes')) + '<textarea class="nt" rows="2" maxlength="2000">' + esc(a.notes) + '</textarea></label></div><div class="row"><button type="button" class="rm">' + esc(t('Remove')) + '</button></div>';
        const save = (patch) => { const all = (mem().apps || []).map(C.cleanApp).filter(Boolean), i = all.findIndex((x) => x.id === a.id); if (i < 0) return; Object.assign(all[i], patch, { updated: new Date().toISOString().slice(0, 16) }); keep({ apps: all }); $(el, '#jb-stages').textContent = Object.entries(C.STAGES).map(([k, v]) => t(v) + ' ' + C.stageCounts(all)[k]).join(' · '); };
        $(li, '.st').addEventListener('change', (e) => save({ stage: e.target.value, ...(e.target.value === 'applied' && !a.applied ? { applied: today() } : {}) }));
        $(li, '.ad').addEventListener('change', (e) => save({ applied: e.target.value })); $(li, '.nx').addEventListener('change', (e) => save({ next: e.target.value }));
        $(li, '.nt').addEventListener('input', (e) => save({ notes: e.target.value.slice(0, 2000) }));
        $(li, '.rm').addEventListener('click', () => { keep({ apps: (mem().apps || []).filter((x) => x.id !== a.id) }); emitSaved(); });
        ul.append(li); }
    };
    $(el, '#jb-addapp').addEventListener('submit', (e) => { e.preventDefault(); const v = (id) => $(el, '#' + id).value.trim(); if (!v('ja-title')) return; addApp({ title: v('ja-title'), company: v('ja-company'), url: v('ja-url'), stage: $(el, '#ja-stage').value, applied: $(el, '#ja-stage').value === 'saved' ? '' : today() }); e.target.reset(); });
    $(el, '#jb-csv').addEventListener('click', () => download('applications.csv', 'text/csv', C.appsToCsv((mem().apps || []).map(C.cleanApp).filter(Boolean))));
    $(el, '#jb-ics').addEventListener('click', () => { const apps = (mem().apps || []).map(C.cleanApp).filter(Boolean); if (!apps.some((a) => a.next)) { $(el, '#jb-amsg').textContent = t('Give an application a next step date first.'); return; } download('next-steps.ics', 'text/calendar', C.appsToIcs(apps)); });
    $(el, '#jb-imp').addEventListener('change', async (e) => { const file = e.target.files && e.target.files[0]; if (!file) return; const rows = C.appsFromCsv(await file.text()), have = (mem().apps || []).map(C.cleanApp).filter(Boolean), key = (a) => (a.title + '|' + a.company + '|' + a.applied).toLowerCase(); const add = rows.filter((r) => !have.some((h) => key(h) === key(r))); keep({ apps: add.concat(have).slice(0, 500) }); $(el, '#jb-amsg').textContent = t('Imported') + ' ' + add.length; e.target.value = ''; emitSaved(); });
    savedSubs.add(draw); draw(); return el;
  },
  feed() {
    const el = panel('Feed', 'jb-feed', '<p class="soft">' + esc(t('An RSS feed of this search, for a feed reader: new jobs reach you with no email and no account. The feed carries Jobicy listings only: Remotive and Himalayas ask that their jobs are not passed on through feeds.')) + '</p><div class="row"><a class="btn" id="jb-rss" target="_blank" rel="noopener" href="/api/jobs?format=rss">' + esc(t('RSS feed of this search')) + '</a><button type="button" id="jb-share">' + esc(t('Share link')) + '</button><span class="live" id="jb-sharemsg" role="status"></span></div>');
    subs.add(() => { $(el, '#jb-rss').href = '/api/jobs?format=rss' + (C.toQuery(s) ? '&' + C.toQuery(s) : ''); });
    $(el, '#jb-share').addEventListener('click', async () => { const url = location.href.replace(/#.*$/, ''); try { if (navigator.share) { await navigator.share({ title: document.title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(url); $(el, '#jb-sharemsg').textContent = t('Copied the link.'); } catch (_) { $(el, '#jb-sharemsg').textContent = url; } });
    return el;
  },
  sources() {
    return panel('Where the jobs come from', 'jb-sources', '<p class="soft" id="jb-fresh">' + esc(t('Loading listings…')) + '</p><ul class="plain">'
      + Object.entries(C.SOURCES).map(([, v]) => '<li><a href="' + esc(v.home) + '" target="_blank" rel="noopener">' + esc(v.name) + '</a>: ' + esc(t(v.delayed ? 'remote jobs, shown 24 hours after they are posted (its rule)' : 'remote jobs')) + ' · <a href="' + esc(v.terms) + '" target="_blank" rel="noopener">' + esc(t('its terms')) + '</a></li>').join('') + '</ul>'
      + '<h3>' + esc(t('What Verse does not do')) + '</h3><ul class="plain"><li>' + esc(t('No profile, no CV upload and no one-click apply: you apply on the original posting, on the site it came from.')) + '</li><li>' + esc(t('No email alerts and no account: alerts, saved jobs and applications stay in this browser.')) + '</li><li>' + esc(t('Remote jobs only, from three free feeds: far fewer listings than the biggest job sites, whose search links are above.')) + '</li><li>' + esc(t('A listing is the poster’s: check the company yourself before you send anything.')) + '</li></ul>');
  },
};
let pendingFresh = null;
function freshIds() { if (pendingFresh) return [...pendingFresh]; return []; }
const regionCount = (k) => jobs.filter((j) => C.openIn(j, k)).length;
function facetPanel(title, id, items, field) {
  const el = panel(title, id, '<div class="chips facet" id="' + id + '-list"><span class="soft">' + esc(t('Loading listings…')) + '</span></div>');
  const draw = () => { const box = $(el, '#' + id + '-list'), l = items(); if (!jobs.length) return; box.textContent = '';
    for (const [k, label, n] of l) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (s[field] === k ? ' on' : ''); b.setAttribute('aria-pressed', String(s[field] === k)); b.textContent = label + ' ' + n; b.addEventListener('click', () => { setSearch({ [field]: s[field] === k ? '' : k }); const r = document.getElementById('jb-search'); if (r) r.scrollIntoView({ block: 'start' }); }); box.append(b); } };
  subs.add(draw); return el;
}
function addApp(a) { const all = (mem().apps || []).map(C.cleanApp).filter(Boolean); const row = C.cleanApp({ ...a, updated: new Date().toISOString().slice(0, 16) }); if (!row) return; if (all.some((x) => x.title === row.title && x.company === row.company && x.url === row.url)) return; keep({ apps: [row, ...all].slice(0, 500) }); emitSaved(); }

// ---------- the listings: snapshot first, then live, the last live list kept for offline ----------
function say() {
  const el = document.getElementById('jb-fresh'), top = document.getElementById('jb-state'); let line;
  if (live) { const ok = Object.entries(live.sources || {}).filter(([, v]) => v && v.ok), at = ok.map(([, v]) => v.at || '').sort().pop(); line = t('Live') + ': ' + ok.map(([k]) => C.SOURCES[k].name).join(', ') + (at ? ' · ' + t('updated') + ' ' + day(at) : '') + (snapAt ? ' · ' + t('with the snapshot of') + ' ' + day(snapAt) : ''); }
  else if (snapAt) line = t('Snapshot of') + ' ' + day(snapAt) + ', ' + t('not live') + ' · ' + t('the live feeds are being asked');
  else line = t('Loading listings…');
  if (el) el.textContent = line; if (top) top.textContent = line;
}
async function load() {
  let snap = null; try { snap = await fetch('/jobs/snapshot.json').then((r) => (r.ok ? r.json() : null)); } catch (_) { snap = null; }
  let kept = null; try { kept = JSON.parse(localStorage.getItem(LIVE) || 'null'); } catch (_) { kept = null; }
  snapAt = (snap && snap.at) || ''; jobs = C.merge((snap && snap.jobs) || [], (kept && kept.jobs) || []); say(); emit(); emitSaved();
  try {
    const r = await fetch('/api/jobs'); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(); live = j;
    jobs = C.merge((snap && snap.jobs) || [], j.jobs || []); try { localStorage.setItem(LIVE, JSON.stringify({ at: new Date().toISOString(), jobs: (j.jobs || []).slice(0, 400) })); } catch (_) { /* full: the snapshot still answers */ }
  } catch (_) { live = null; const top = document.getElementById('jb-state'); if (!jobs.length && top) top.textContent = t('The listings could not be loaded. Reload the page when you are online.'); }
  say(); emit(); emitSaved(); notifyNew();
  document.documentElement.dataset.jobsReady = '1';
}
function notifyNew() {
  const m = mem(); if (!m.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const n = (m.alerts || []).reduce((acc, a) => acc + C.newSince(jobs, a).fresh.length, 0); if (n > 0) { try { new Notification('Verse: ' + n + ' ' + t('new jobs in your saved searches')); } catch (_) { /* a browser that only notifies from a worker */ } }
}

/** mounts the panels a page asks for into root: { panels: [...], preset: { region, sort, ... }, de }. */
export function mountJobs(root, cfg = {}) {
  cfgNow = cfg; Object.assign(s, C.EMPTY, cfg.preset || {}); if (location.search) Object.assign(s, Object.fromEntries(Object.entries(C.fromQuery(location.search)).filter(([k, v]) => v !== C.EMPTY[k])));
  root.textContent = '';
  const st = document.createElement('p'); st.className = 'notice'; st.id = 'jb-state'; st.setAttribute('role', 'status'); st.textContent = t('Loading listings…'); root.append(st);
  for (const p of cfg.panels || ['search']) if (PANELS[p]) root.append(PANELS[p](cfg));
  if (isDe()) { document.documentElement.lang = 'de'; if (cfg.de) { const h = document.querySelector('h1'), p = document.querySelector('.intro'); if (h && cfg.de.h1) h.textContent = cfg.de.h1; if (p && cfg.de.intro) p.textContent = cfg.de.intro; if (cfg.de.h1) document.title = cfg.de.h1 + ' · Verse'; } }
  emit(); emitSaved();
  if (location.hash === '#tracker') { const x = document.getElementById('tracker'); if (x) x.scrollIntoView(); }
  return load();
}
