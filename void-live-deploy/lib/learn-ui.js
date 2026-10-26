/**
 * learn-ui: the screen of the learning pages (/learn/ and one page per site of the learning lane, lib/learn-sites.js). One module; each page asks for the panels it
 * needs: mountLearn(root, { panels: ['course', 'practice', ...], skills: [...] }). All on the device: problems are made here (lib/learn-core.js), progress, decks
 * and statistics are kept in this browser, and the only things that leave are the links the visitor opens. English and German (lib/learn-de.js). Every value a
 * visitor typed goes in by textContent. Tests: tools/learn.test.mjs, tools/learn-page.mjs.
 */
import * as C from '/lib/learn-core.js';
import { ELEMENTS, WORDS, TYPE_WORDS } from '/lib/learn-data.js';
import { DE, TPL_DE, SKILL_DE, UNIT_DE } from '/lib/learn-de.js';

const KEY = 'a2m.void.learn.v1';
const q0 = new URLSearchParams(location.search);
export const isDe = () => /^de\b/i.test(navigator.language || '') || q0.get('lang') === 'de';
export const t = (s) => (isDe() && DE[s]) || s;
const fmt = (step) => C.fill(step, isDe() ? TPL_DE : C.TPL, t);
const skillName = (s) => (isDe() && SKILL_DE[s.id]) || s.name;
const unitName = (u) => (isDe() && UNIT_DE[u.id]) || u.name;
const lvName = (l) => t(C.LEVELS[l || 0]);
function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked: the page still works */ } return m; }
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
/** an element with text only: h('button', { class: 'x', onclick }, 'text', child) */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
const panel = (id, title, ...kids) => h('section', { class: 'panel', id: 'p-' + id, 'aria-labelledby': 'h-' + id }, h('h2', { id: 'h-' + id, text: t(title) }), ...kids);
const btn = (label, onclick, attrs = {}) => h('button', { type: 'button', onclick, ...attrs }, t(label));
const out = (link, label) => h('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, t(label));
/** prints one panel: the others are hidden while the print dialog is open */
function printPanel(p) { document.body.dataset.print = '1'; p.classList.add('pr'); const done = () => { delete document.body.dataset.print; p.classList.remove('pr'); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); try { window.print(); } catch (_) { done(); } setTimeout(done, 60000); }
function download(name, text, type = 'text/plain') { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
/** the day's practice: questions answered today and the days practised (for the streak) */
function practised() { const m = mem(), d = today(), days = (m.days || []).includes(d) ? m.days : (m.days || []).concat(d).slice(-400); const td = m.today && m.today.day === d ? m.today : { day: d, n: 0, right: 0 }; return { days, td }; }
function tally(ok) { const { days, td } = practised(); td.n++; if (ok) td.right++; const m = mem(); keep({ days, today: td, total: { n: ((m.total || {}).n || 0) + 1, right: ((m.total || {}).right || 0) + (ok ? 1 : 0) } }); for (const f of subs) f(); }
const subs = new Set();

// ---------- practice: one problem at a time, checked at once, a hint ladder and the worked solution ----------
function practicePanel(cfg, ctx) {
  const ids = cfg.skills || C.SKILLS.map((s) => s.id);
  const sel = h('select', { id: 'pr-skill', 'aria-label': t('Skill') }); for (const u of C.UNITS) { const list = C.SKILLS.filter((s) => s.unit === u.id && ids.includes(s.id)); if (!list.length) continue; const g = h('optgroup', { label: unitName(u) }); for (const s of list) g.append(h('option', { value: s.id }, skillName(s))); sel.append(g); }
  const level = h('span', { class: 'badge', id: 'pr-level' }), runEl = h('span', { class: 'soft', id: 'pr-run' });
  const qEl = h('p', { class: 'big q', id: 'pr-q', 'aria-live': 'polite' }), input = h('input', { type: 'text', id: 'pr-a', inputmode: 'text', autocomplete: 'off', 'aria-label': t('Your answer') });
  const fb = h('p', { class: 'fb', id: 'pr-fb', role: 'status' }), hints = h('ol', { class: 'steps', id: 'pr-steps' }), fmtHint = h('p', { class: 'soft', id: 'pr-form' });
  const video = h('p', { class: 'soft' });
  let p = null, tried = false, hinted = false, shown = 0, queue = [];
  const st = () => (mem().skills || {});
  function showLevel() { const r = st()[sel.value]; level.textContent = lvName(r && r.level); level.dataset.l = (r && r.level) || 0; runEl.textContent = r && r.run ? t('Right in a row') + ': ' + r.run : ''; }
  function next(id, nums) {
    if (id) sel.value = id; else if (queue.length) sel.value = queue.shift();
    p = C.problem(sel.value, Math.random, nums); tried = false; hinted = false; shown = 0; hints.textContent = ''; fb.textContent = ''; fb.className = 'fb'; input.value = ''; input.disabled = false;
    qEl.textContent = fmt(p.q); fmtHint.textContent = p.kind === 'frac' ? t('Answer as a fraction like 3/4 or a mixed number like 1 1/2.') : p.kind === 'rem' ? t('Answer like 12 R 3 (12 remainder 3).') : t('Answer with a number.');
    const u = C.UNITS.find((x) => x.id === C.skillOf(sel.value).unit); video.textContent = ''; video.append(t('Want a video for this?') + ' ', out(u.video, 'Khan Academy explains this unit'), ' ' + t('(free, opens in a new tab)'));
    showLevel(); ctx.skill = sel.value; try { const q = new URLSearchParams(location.search); q.set('skill', sel.value); q.delete('p'); q.delete('show'); history.replaceState(null, '', location.pathname + '?' + q + location.hash); } catch (_) { /* no history */ }
  }
  function hint() { if (!p || shown >= p.steps.length) return; hinted = true; hints.append(h('li', {}, fmt(p.steps[shown]))); shown++; }
  function solve() { while (p && shown < p.steps.length) hint(); }
  function checkIt() {
    if (!p || !input.value.trim()) return; const ok = C.check(p, input.value);
    if (!tried) { const recs = st(); recs[p.skill] = C.recordAnswer(recs[p.skill], ok, hinted, today()); keep({ skills: recs }); tally(ok); }
    tried = true; fb.className = 'fb ' + (ok ? 'ok' : 'bad');
    fb.textContent = ok ? t('Correct!') + ' ' + p.answer + (hinted ? ' ' + t('(with a hint: it counts as practice, not toward mastery)') : '') : t('Not yet. Try again, or get a hint.');
    if (ok) input.disabled = true; showLevel(); for (const f of subs) f();
  }
  sel.addEventListener('change', () => next());
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (input.disabled) next(); else checkIt(); } });
  ctx.practice = (id, list) => { queue = list ? list.slice() : []; next(id || queue.shift()); document.getElementById('p-practice').scrollIntoView({ behavior: 'smooth', block: 'start' }); input.focus({ preventScroll: true }); };
  const el = panel('practice', 'Practice', h('div', { class: 'row' }, sel, level, runEl), qEl, fmtHint, h('div', { class: 'row' }, input, btn('Check', checkIt, { class: 'primary', id: 'pr-check' })), fb,
    h('div', { class: 'row' }, btn('Get a hint', hint, { id: 'pr-hint' }), btn('Show the worked solution', solve, { id: 'pr-solve' }), btn('Next problem', () => next(), { id: 'pr-next' })), hints, video);
  const start = q0.get('skill'), nums = (q0.get('p') || '').split(',').filter(Boolean).map(Number);
  next(ids.includes(start) ? start : ids[0], nums.length ? nums : null); if (q0.get('show') === '1') solve();
  return el;
}

// ---------- the course: units, skills, levels ----------
function coursePanel(cfg, ctx) {
  const bar = h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': t('Course mastery') }, h('i')), pct = h('p', { class: 'soft' }), list = h('div');
  function draw() {
    const recs = mem().skills || {}, cp = C.courseProgress(recs); bar.setAttribute('aria-valuenow', cp.pct); bar.firstChild.style.width = cp.pct + '%';
    pct.textContent = t('Course mastery') + ': ' + cp.pct + '% · ' + C.LEVELS.slice(1).map((l, i) => lvName(i + 1) + ' ' + cp.counts[i + 1]).join(' · ');
    list.textContent = '';
    for (const u of C.UNITS) {
      const skills = C.SKILLS.filter((s) => s.unit === u.id);
      list.append(h('h3', {}, unitName(u)), h('ul', { class: 'skills' }, skills.map((s) => { const lv = (recs[s.id] && recs[s.id].level) || 0; return h('li', {}, h('button', { type: 'button', class: 'skill', 'data-skill': s.id, onclick: () => ctx.practice(s.id) }, h('span', {}, skillName(s)), h('span', { class: 'badge', 'data-l': lv }, lvName(lv)))); })),
        h('p', { class: 'soft' }, out(u.video, 'Videos for this unit on Khan Academy')));
    }
  }
  subs.add(draw); draw();
  return panel('course', 'Course: maths from number facts to equations', h('p', { class: 'soft' }, t('Each skill levels up as you practise: 3 right in a row without a hint is Familiar, 6 is Proficient, 10 on two different days is Mastered. A wrong answer drops a Proficient or Mastered skill one level.')), bar, pct, list);
}
// ---------- spaced review and the mastery challenge ----------
function reviewPanel(cfg, ctx) {
  const msg = h('p', { id: 'rv-msg' }), b1 = btn('Start the review', () => { const due = C.dueSkills(mem().skills, today()); if (due.length) ctx.practice(null, due); }, { id: 'rv-start' });
  const b2 = btn('Mastery challenge', () => { const recs = mem().skills || {}, seen = Object.keys(recs).filter((k) => recs[k].level >= 1); const pool = seen.length ? seen : C.SKILLS.slice(0, 6).map((s) => s.id); ctx.practice(null, C.shuffle(Math.random, pool.concat(pool)).slice(0, 6)); }, { id: 'rv-challenge' });
  function draw() { const due = C.dueSkills(mem().skills, today()); msg.textContent = due.length ? t('Due for review today') + ': ' + due.map((id) => skillName(C.skillOf(id))).join(', ') : t('Nothing is due for review today. Skills you practise come back after 1, 2, 5 or 14 days, longer the better you know them.'); b1.disabled = !due.length; }
  subs.add(draw); draw();
  return panel('review', 'Spaced review', msg, h('div', { class: 'row' }, b1, b2), h('p', { class: 'soft' }, t('The mastery challenge mixes six questions from the skills you have practised.')));
}
// ---------- progress: the streak, today's numbers, export and import ----------
function progressPanel() {
  const stats = h('dl', { class: 'dl', id: 'pg-stats' }), cal = h('div', { class: 'cal', 'aria-label': t('The last 28 days') }), msg = h('p', { class: 'soft', role: 'status' });
  function draw() {
    const m = mem(), d = today(), td = m.today && m.today.day === d ? m.today : { n: 0, right: 0 }, tot = m.total || { n: 0, right: 0 }, cp = C.courseProgress(m.skills || {});
    stats.textContent = '';
    for (const [k, v] of [['Streak', C.streak(m.days || [], d) + ' ' + t('days in a row')], ['Today', td.n + ' ' + t('questions') + ', ' + td.right + ' ' + t('right')], ['All time', tot.n + ' ' + t('questions') + ', ' + (tot.n ? Math.round((100 * tot.right) / tot.n) : 0) + '% ' + t('right')], ['Course mastery', cp.pct + '%']]) stats.append(h('div', {}, h('dt', {}, t(k)), h('dd', {}, v)));
    cal.textContent = ''; const set = new Set(m.days || []); for (let i = 27; i >= 0; i--) { const day = C.addDays(d, -i); cal.append(h('span', { class: set.has(day) ? 'on' : '', title: day })); }
  }
  const imp = h('input', { type: 'file', accept: '.json,application/json', id: 'pg-imp', class: 'pick' });
  imp.addEventListener('change', async () => { const f = imp.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (d && d.app === 'verse-learn' && d.data && typeof d.data === 'object') { keep(d.data); msg.textContent = t('Progress imported.'); for (const f2 of subs) f2(); } else msg.textContent = t('That file is not a Verse progress file.'); } catch (_) { msg.textContent = t('That file is not a Verse progress file.'); } imp.value = ''; });
  subs.add(draw); draw();
  return panel('progress', 'Your progress', stats, cal, h('div', { class: 'row' }, btn('Export progress', () => download('verse-learning-progress.json', JSON.stringify({ app: 'verse-learn', v: 1, data: mem() }, null, 1), 'application/json'), { id: 'pg-exp' }), h('label', { class: 'btn', for: 'pg-imp' }, t('Import progress')), imp,
    btn('Start over', () => { if (confirm(t('Clear all progress on this device?'))) { try { localStorage.removeItem(KEY); } catch (_) { /* blocked */ } for (const f of subs) f(); msg.textContent = t('Progress cleared.'); } })), msg,
    h('p', { class: 'soft' }, t('Kept on this device only. There are no teacher dashboards or class accounts here: export the file to move or share your progress.')));
}
// ---------- printable worksheets with an answer key ----------
function worksheetPanel(cfg) {
  const ids = cfg.skills || C.SKILLS.map((s) => s.id), sel = h('select', { id: 'ws-skill', 'aria-label': t('Skill') }, ids.map((id) => h('option', { value: id }, skillName(C.skillOf(id))))), n = h('select', { id: 'ws-n', 'aria-label': t('Problems') }, [10, 20, 30].map((x) => h('option', { value: x, selected: x === 20 }, x + ' ' + t('problems'))));
  const sheet = h('ol', { class: 'sheet', id: 'ws-list' }), key = h('ol', { class: 'key', id: 'ws-key' }); let seed = +q0.get('seed') || 1 + Math.floor(Math.random() * 99999);
  function make() { sheet.textContent = ''; key.textContent = ''; for (const p of C.worksheet(sel.value, +n.value, seed)) { sheet.append(h('li', {}, fmt(p.q))); key.append(h('li', {}, p.answer)); } }
  if (ids.includes(q0.get('ws'))) sel.value = q0.get('ws'); sel.addEventListener('change', make); n.addEventListener('change', make); make();
  const el = panel('worksheet', 'Printable worksheet', h('div', { class: 'row' }, sel, n, btn('New problems', () => { seed = 1 + Math.floor(Math.random() * 99999); make(); }), btn('Print', () => printPanel(el), { id: 'ws-print' })), sheet, h('h3', {}, t('Answer key')), key);
  return el;
}

// ---------- times tables ----------
function timesPanel() {
  const m = mem(), facts = m.times || {}, tbl = new Set((m.tables && m.tables.length ? m.tables : [2, 3, 4, 5, 10]));
  const tq = +q0.get('t'); if (tq >= 1 && tq <= 12) { tbl.clear(); tbl.add(tq); }
  const qq = /^(\d{1,2})\s*[x×*]\s*(\d{1,2})$/i.exec(q0.get('q') || ''); if (qq && +qq[1] >= 1 && +qq[1] <= 12) { tbl.clear(); tbl.add(+qq[1]); }
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('Tables') });
  const draw = () => { chips.textContent = ''; for (let i = 1; i <= 12; i++) chips.append(h('button', { type: 'button', class: 'chip' + (tbl.has(i) ? ' on' : ''), 'aria-pressed': String(tbl.has(i)), onclick: () => { if (tbl.has(i) && tbl.size > 1) tbl.delete(i); else tbl.add(i); keep({ tables: [...tbl] }); draw(); } }, String(i))); };
  draw();
  const qEl = h('p', { class: 'big q', id: 'tt-q' }), input = h('input', { type: 'text', inputmode: 'numeric', id: 'tt-a', autocomplete: 'off', 'aria-label': t('Your answer') }), fb = h('p', { class: 'fb', role: 'status', id: 'tt-fb' }), hintEl = h('ol', { class: 'steps', id: 'tt-hint' });
  const timer = h('div', { class: 'meter timer', 'aria-hidden': 'true' }, h('i')), score = h('p', { class: 'soft', id: 'tt-score' }), grid = h('div', { class: 'tgrid', id: 'tt-grid', role: 'grid', 'aria-label': t('Facts you know') });
  let mode = 'order', list = [], i = 0, cur = null, t0 = 0, pts = 0, right = 0, tick = null, missed = false;
  const save = () => keep({ times: facts });
  function drawGrid() {
    grid.textContent = ''; grid.append(h('span', { class: 'hd' }, '×')); for (let b = 1; b <= 12; b++) grid.append(h('span', { class: 'hd' }, String(b)));
    let n = 0; for (let a = 1; a <= 12; a++) { grid.append(h('span', { class: 'hd' }, String(a))); for (let b = 1; b <= 12; b++) { const s = facts[a + 'x' + b], k = C.known(s); if (k) n++; grid.append(h('button', { type: 'button', class: 'cell' + (k ? ' known' : s ? ' seen' : ''), title: a + ' × ' + b + ' = ' + a * b, 'aria-label': a + ' × ' + b, onclick: () => { mode = 'order'; list = [[a, b]]; i = 0; ask(); } }, k ? String(a * b) : '')); } }
    known.textContent = t('Facts you know') + ': ' + n + ' / 144' + (n === 144 ? ' · ' + t('Your certificate is ready.') : ' · ' + t('the certificate opens at 144')); cert.disabled = n < 144;
  }
  const known = h('p', { class: 'soft', id: 'tt-known' }), cert = btn('Print the certificate', () => { certBox.hidden = false; certBox.textContent = ''; certBox.append(h('p', { class: 'big' }, t('Certificate')), h('p', {}, t('knows all the times tables from 1 × 1 to 12 × 12.')), h('p', { class: 'soft' }, today())); printPanel(certBox); });
  const certBox = h('div', { class: 'panel cert', hidden: true });
  function ask() {
    clearInterval(tick); if (i >= list.length) return finish(); cur = list[i]; missed = false; qEl.textContent = cur[0] + ' × ' + cur[1] + ' = ?'; input.value = ''; input.disabled = false; fb.textContent = ''; fb.className = 'fb'; hintEl.textContent = ''; t0 = performance.now();
    score.textContent = (mode === 'speed' ? t('Points') + ': ' + pts + ' · ' : '') + (i + 1) + ' / ' + list.length;
    if (mode === 'speed') { timer.hidden = false; timer.firstChild.style.width = '100%'; tick = setInterval(() => { const left = 10 - (performance.now() - t0) / 1000; timer.firstChild.style.width = Math.max(0, left * 10) + '%'; if (left <= 0) { clearInterval(tick); answer(null); } }, 100); } else timer.hidden = true;
  }
  function answer(v) {
    if (!cur || input.disabled) return; const ok = v !== null && C.parseNum(v) === cur[0] * cur[1], ms = performance.now() - t0, k = cur[0] + 'x' + cur[1];
    if (!missed) { facts[k] = C.factAnswer(facts[k], ok, ms); save(); tally(ok); }
    if (ok) { if (!missed) right++; if (mode === 'speed') pts += C.speedPoints(true, 10 - ms / 1000); fb.className = 'fb ok'; fb.textContent = t('Correct!') + ' ' + cur[0] + ' × ' + cur[1] + ' = ' + cur[0] * cur[1]; input.disabled = true; drawGrid(); clearInterval(tick); setTimeout(() => { i++; ask(); }, mode === 'speed' ? 500 : 700); }
    else if (mode === 'speed') { fb.className = 'fb bad'; fb.textContent = (v === null ? t('Time is up.') : t('Not quite.')) + ' ' + cur[0] + ' × ' + cur[1] + ' = ' + cur[0] * cur[1]; input.disabled = true; drawGrid(); clearInterval(tick); setTimeout(() => { i++; ask(); }, 1200); }
    else { missed = true; fb.className = 'fb bad'; fb.textContent = t('Not yet. Try again, or get a hint.'); }
  }
  function finish() {
    clearInterval(tick); timer.hidden = true; input.disabled = true; qEl.textContent = t('Done!');
    if (mode === 'speed') { const best = Math.max(pts, mem().ttBest || 0); keep({ ttBest: best }); fb.className = 'fb ok'; fb.textContent = t('Points') + ': ' + pts + ' · ' + right + ' / ' + list.length + ' ' + t('right') + ' · ' + t('Best') + ': ' + best; }
    else { fb.className = 'fb ok'; fb.textContent = right + ' / ' + list.length + ' ' + t('right the first time'); }
  }
  function start(md) { mode = md; const tabs = [...tbl].sort((a, b) => a - b); list = C.timesFacts(tabs); if (md !== 'order') list = C.shuffle(Math.random, list); if (md === 'speed') list = list.slice(0, 36); i = 0; pts = 0; right = 0; ask(); input.focus({ preventScroll: true }); }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); answer(input.value); } });
  const hint = () => { if (!cur) return; missed = true; hintEl.textContent = ''; for (const s of C.timesSteps(cur[0], cur[1])) hintEl.append(h('li', {}, fmt(s))); };
  const sheet = h('ol', { class: 'sheet', id: 'tt-sheet' }), skey = h('p', { class: 'soft', id: 'tt-key' });
  const sheetBox = h('div', { id: 'tt-sheetbox' }, h('h3', {}, t('Worksheet')), sheet, h('h3', {}, t('Answer key')), skey);
  function makeSheet() { const fs = C.shuffle(Math.random, C.timesFacts([...tbl])).slice(0, 30); sheet.textContent = ''; for (const [a, b] of fs) sheet.append(h('li', {}, a + ' × ' + b + ' = ____')); skey.textContent = fs.map(([a, b], j) => (j + 1) + ') ' + a * b).join('  '); }
  makeSheet();
  const el = panel('times', 'Times tables 1 to 12', h('p', { class: 'soft' }, t('Pick the tables to practise:')), chips,
    h('div', { class: 'row' }, btn('Practise in order', () => start('order'), { id: 'tt-order' }), btn('Mixed', () => start('mixed'), { id: 'tt-mixed' }), btn('Speed test', () => start('speed'), { id: 'tt-speed', class: 'primary' })),
    timer, qEl, h('div', { class: 'row' }, input, btn('Check', () => answer(input.value), { id: 'tt-check' }), btn('Get a hint', hint, { id: 'tt-hintb' })), fb, hintEl, score,
    h('p', { class: 'soft' }, t('The speed test gives ten seconds a question: 10 points for a right answer and one more for every second left.')),
    h('h3', {}, t('Facts you know')), h('div', { class: 'tablewrap' }, grid), known, h('div', { class: 'row' }, btn('New worksheet', makeSheet), btn('Print the worksheet', () => printPanel(sheetBox), { id: 'tt-print' }), cert), sheetBox, certBox);
  drawGrid(); timer.hidden = true;
  if (qq) { mode = 'order'; list = [[+qq[1], +qq[2]]]; i = 0; ask(); if (q0.get('show') === '1') hint(); } else if (q0.get('mode') === 'speed') { qEl.textContent = t('Press Speed test to start: ten seconds a question.'); } else start('order');
  if (q0.get('mode') === 'sheet') setTimeout(() => sheetBox.scrollIntoView(), 50);
  return el;
}

// ---------- the periodic table ----------
const ELS = C.unpackElements(ELEMENTS);
const CAT_NAMES = { alkali: 'Alkali metal', alkaline: 'Alkaline earth metal', transition: 'Transition metal', post: 'Post-transition metal', metalloid: 'Metalloid', nonmetal: 'Reactive nonmetal', halogen: 'Halogen', noble: 'Noble gas', lanthanide: 'Lanthanide', actinide: 'Actinide' };
const STATE_NAMES = { solid: 'Solid', liquid: 'Liquid', gas: 'Gas', unknown: 'Unknown' };
function periodicPanel() {
  const search = h('input', { type: 'search', id: 'pt-q', placeholder: t('Name, symbol or number'), 'aria-label': t('Find an element'), autocomplete: 'off' });
  const by = h('select', { id: 'pt-by', 'aria-label': t('Colour by') }, [['cat', 'Family'], ['block', 'Block'], ['state', 'State at 20 °C']].map(([v, l]) => h('option', { value: v }, t('Colour by') + ': ' + t(l))));
  const card = h('div', { class: 'el-card', id: 'pt-card', 'aria-live': 'polite' }), grid = h('div', { class: 'ptable', id: 'pt-grid' }), legend = h('p', { class: 'legend', id: 'pt-legend' });
  function show(e) {
    if (!e) return; card.textContent = ''; const wiki = isDe() ? 'https://de.wikipedia.org/wiki/' + encodeURIComponent(e.de) : 'https://en.wikipedia.org/wiki/' + encodeURIComponent(e.name);
    const rows = [['Atomic number', e.z], ['Atomic weight', e.mass + (e.stable ? '' : ' (' + t('mass number of the longest-lived isotope') + ')')], ['Family', t(CAT_NAMES[e.cat])], ['Group', e.group || t('f-block (no group number)')], ['Period', e.period], ['Block', e.block + '-block'], ['Electron configuration', e.config], ['State at 20 °C', t(STATE_NAMES[e.state])], [isDe() ? 'English' : 'German', isDe() ? e.name : e.de]];
    card.append(h('div', { class: 'el-big', 'data-c': e.cat }, h('small', {}, String(e.z)), h('b', {}, e.sym)), h('div', {}, h('h3', {}, (isDe() ? e.de : e.name)), h('dl', { class: 'dl' }, rows.map(([k, v]) => h('div', {}, h('dt', {}, t(k)), h('dd', {}, String(v))))), h('p', { class: 'soft' }, out(wiki, 'Read more on Wikipedia'))));
    for (const b of grid.querySelectorAll('.on')) b.classList.remove('on'); const b = grid.querySelector('[data-z="' + e.z + '"]'); if (b) b.classList.add('on');
    try { const q = new URLSearchParams(location.search); q.set('el', e.sym); history.replaceState(null, '', location.pathname + '?' + q); } catch (_) { /* no history */ }
  }
  function draw() {
    grid.textContent = ''; const key = by.value;
    for (const e of ELS) grid.append(h('button', { type: 'button', class: 'pt', 'data-z': e.z, 'data-c': key === 'cat' ? e.cat : key === 'block' ? 'b' + e.block : 's' + e.state, style: 'grid-row:' + e.row + ';grid-column:' + e.col, 'aria-label': e.z + ' ' + (isDe() ? e.de : e.name), onclick: () => show(e) }, h('small', {}, String(e.z)), h('b', {}, e.sym)));
    grid.append(h('span', { class: 'ph', style: 'grid-row:6;grid-column:3' }, '57–71'), h('span', { class: 'ph', style: 'grid-row:7;grid-column:3' }, '89–103'));
    legend.textContent = ''; const names = key === 'cat' ? Object.entries(CAT_NAMES) : key === 'block' ? ['s', 'p', 'd', 'f'].map((b) => ['b' + b, b + '-block']) : Object.entries(STATE_NAMES).map(([k, v]) => ['s' + k, v]);
    for (const [k, v] of names) legend.append(h('span', { class: 'lg', 'data-c': k }, t(v)));
  }
  search.addEventListener('input', () => { const e = C.findElement(ELS, search.value); if (e) show(e); });
  by.addEventListener('change', () => { const cur = grid.querySelector('.on'); draw(); if (cur) grid.querySelector('[data-z="' + cur.dataset.z + '"]').classList.add('on'); });
  // the symbol quiz: four choices; a miss comes back three questions later until it is right
  const qz = h('div', { id: 'pt-quiz' }), qmsg = h('p', { class: 'fb', role: 'status' }); let again = [], n = 0, ok = 0;
  function quiz() {
    qz.textContent = ''; n++; const due = again.find((x) => x.at <= n), e = due ? ELS[due.z - 1] : ELS[Math.floor(Math.random() * 54)]; if (due) again = again.filter((x) => x !== due);
    const symQ = Math.random() < 0.5, nm = (x) => (isDe() ? x.de : x.name), right = symQ ? nm(e) : e.sym, pool = C.shuffle(Math.random, ELS.slice(0, 54).filter((x) => x.z !== e.z)).slice(0, 3).map((x) => (symQ ? nm(x) : x.sym));
    qz.append(h('p', { class: 'big' }, symQ ? t('Which element has the symbol') + ' ' + e.sym + '?' : t('What is the symbol for') + ' ' + nm(e) + '?'), h('div', { class: 'choices' }, C.shuffle(Math.random, [right, ...pool]).map((c) => h('button', { type: 'button', onclick: (ev) => {
      const good = c === right; if (good) ok++; else again.push({ z: e.z, at: n + 3 }); ev.target.classList.add(good ? 'right' : 'wrong'); qmsg.className = 'fb ' + (good ? 'ok' : 'bad'); qmsg.textContent = (good ? t('Correct!') : t('Not quite.')) + ' ' + e.sym + ' = ' + nm(e) + ' · ' + ok + ' / ' + n + (again.length ? ' · ' + again.length + ' ' + t('to review') : ''); tally(good); setTimeout(quiz, 900);
    } }, c))));
  }
  const el = panel('periodic', 'The elements', h('label', { class: 'soft', for: 'pt-q' }, t('Find an element') + ': ' + t('Name, symbol or number')), h('div', { class: 'row' }, search, by, btn('Print', () => printPanel(el), { id: 'pt-print' })), card, h('div', { class: 'tablewrap' }, grid), legend,
    h('h3', {}, t('Symbol quiz')), h('p', { class: 'soft' }, t('The first 54 elements; a symbol you miss comes back until you get it.')), btn('Start the quiz', quiz, { id: 'pt-quizb' }), qz, qmsg,
    h('p', { class: 'note' }, t('Standard atomic weights as IUPAC publishes them (abridged); configurations past element 103 are predictions.')));
  draw(); show(C.findElement(ELS, q0.get('el') || 'H') || ELS[0]);
  return el;
}

// ---------- the vocabulary quiz ----------
function vocabPanel() {
  const m = mem(), st = { level: 1, ...(m.vocab || {}) }, mode = h('select', { id: 'vc-mode', 'aria-label': t('Mode') }, [['def', 'Meaning in English'], ['de', 'Word in German']].map(([v, l]) => h('option', { value: v }, t(l))));
  if (q0.get('mode') === 'de') mode.value = 'de'; const lq = +q0.get('level'); if (lq >= 1 && lq <= 5) st.level = lq;
  const lvl = h('p', { class: 'soft', id: 'vc-level' }), qEl = h('p', { class: 'big q', id: 'vc-q' }), ch = h('div', { class: 'choices', id: 'vc-choices' }), fb = h('p', { class: 'fb', role: 'status', id: 'vc-fb' }), learned = h('p', { class: 'soft', id: 'vc-learned' });
  let missed = (m.vocabMissed || []).slice(), recent = [], cur = null;
  const save = () => keep({ vocab: st, vocabMissed: missed });
  function drawLearned() { const L = mem().vocabLearned || []; learned.textContent = t('Words you learned') + ' (' + L.length + '): ' + (L.slice(-30).join(', ') || '—') + (missed.length ? ' · ' + t('to review') + ': ' + missed.join(', ') : ''); }
  function ask(word) {
    fb.textContent = ''; fb.className = 'fb'; const field = mode.value; let w = word && WORDS.find((x) => x.word === word);
    if (!w && missed.length && Math.random() < 0.35) w = WORDS.find((x) => x.word === missed[0]);
    cur = w ? (() => { const wrong = C.shuffle(Math.random, WORDS.filter((x) => x.word !== w.word && x[field] !== w[field] && Math.abs(x.level - w.level) <= 1)).slice(0, 3).map((x) => x[field]); return { word: w.word, answer: w[field], choices: C.shuffle(Math.random, [w[field], ...wrong]) }; })() : C.vocabQuestion(WORDS, st.level, Math.random, recent, field);
    recent = recent.concat(cur.word).slice(-15); lvl.textContent = t('Level') + ' ' + st.level + ' / 5 · ' + t('right') + ' ' + (st.right || 0) + ' / ' + (st.seen || 0);
    qEl.textContent = cur.word; ch.textContent = '';
    for (const c of cur.choices) ch.append(h('button', { type: 'button', onclick: (ev) => {
      if (!cur || ch.dataset.done) return; ch.dataset.done = '1'; const ok = c === cur.answer; Object.assign(st, C.vocabStep(st, ok)); ev.target.classList.add(ok ? 'right' : 'wrong'); for (const b of ch.children) if (b.textContent === cur.answer) b.classList.add('right');
      if (ok) { missed = missed.filter((x) => x !== cur.word); const L = mem().vocabLearned || []; if (!L.includes(cur.word)) keep({ vocabLearned: L.concat(cur.word) }); } else if (!missed.includes(cur.word)) missed.push(cur.word);
      fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.textContent = (ok ? t('Correct!') : t('Not quite.')) + ' ' + cur.word + ': ' + cur.answer; save(); tally(ok); drawLearned(); setTimeout(() => { delete ch.dataset.done; ask(); }, 1100);
    } }, c));
  }
  mode.addEventListener('change', () => ask());
  const el = panel('vocab', 'Choose the meaning', h('div', { class: 'row' }, mode), lvl, qEl, ch, fb, learned, h('p', { class: 'note' }, t('100 words over five levels, with meanings written for Verse. Three right in a row move you up a level; a miss moves you down.')));
  ask(q0.get('word')); drawLearned();
  return el;
}

// ---------- flashcards ----------
const STARTERS = () => [
  { name: t('Element symbols'), cards: ELS.slice(0, 20).map((e) => ({ f: e.sym, b: isDe() ? e.de : e.name })) },
  { name: t('English and German words'), cards: WORDS.filter((w) => w.level <= 2).slice(0, 25).map((w) => ({ f: w.word, b: w.de })) },
  { name: t('The 7 times table'), cards: Array.from({ length: 12 }, (_, i) => ({ f: '7 × ' + (i + 1), b: String(7 * (i + 1)) })) },
];
function cardsPanel() {
  let decks = mem().decks; if (!Array.isArray(decks) || !decks.length) decks = STARTERS();
  let cur = Math.min(+(mem().deck || 0), decks.length - 1);
  const shared = /#deck=([A-Za-z0-9_-]+)/.exec(location.hash); let sharedNote = '';
  if (shared) { const d = C.deckOfToken(shared[1]); if (d && d.cards.length) { decks = decks.concat({ name: d.name || t('Shared deck'), cards: d.cards }); cur = decks.length - 1; sharedNote = t('This deck came from a link and is now kept on this device.'); } }
  const save = () => keep({ decks, deck: cur });
  const pickD = h('select', { id: 'fc-deck', 'aria-label': t('Deck') }), name = h('input', { type: 'text', id: 'fc-name', 'aria-label': t('Deck name'), maxlength: '80' }), info = h('p', { class: 'soft', id: 'fc-info' }), note = h('p', { class: 'note', role: 'status', id: 'fc-msg' }, sharedNote);
  const paste = h('textarea', { id: 'fc-paste', rows: '4', placeholder: t('One card a line: front, then a tab, comma, = or - , then back'), 'aria-label': t('Paste cards') }), list = h('ul', { class: 'plain', id: 'fc-list' }), stage = h('div', { class: 'study', id: 'fc-study' });
  const deck = () => decks[cur];
  function draw() {
    pickD.textContent = ''; decks.forEach((d, i) => pickD.append(h('option', { value: i, selected: i === cur }, d.name + ' (' + d.cards.length + ')'))); name.value = deck().name;
    const due = C.dueCards(deck().cards, today()).length; info.textContent = deck().cards.length + ' ' + t('cards') + ' · ' + t('Due today') + ': ' + due;
    list.textContent = ''; deck().cards.forEach((c, i) => list.append(h('li', {}, h('span', { class: 'ff' }, c.f), h('span', { class: 'soft' }, ' → ' + c.b + (c.due ? ' · ' + t('next') + ' ' + c.due : '')), h('button', { type: 'button', class: 'mini', 'aria-label': t('Delete card') + ' ' + c.f, onclick: () => { deck().cards.splice(i, 1); save(); draw(); } }, '×'))));
  }
  pickD.addEventListener('change', () => { cur = +pickD.value; save(); draw(); stage.textContent = ''; });
  name.addEventListener('change', () => { deck().name = name.value.trim().slice(0, 80) || deck().name; save(); draw(); });
  const add = () => { const cs = C.parseDeck(paste.value); if (!cs.length) { note.textContent = t('No cards found: put the front and the back on one line, with a tab, comma, = or - between them.'); return; } deck().cards.push(...cs); paste.value = ''; note.textContent = cs.length + ' ' + t('cards added.'); save(); draw(); };
  const imp = h('input', { type: 'file', accept: '.txt,.csv,.tsv,text/plain,text/csv', id: 'fc-imp', class: 'pick' }); imp.addEventListener('change', async () => { const f = imp.files[0]; if (!f) return; const cs = C.parseDeck(await f.text()); if (cs.length) { decks.push({ name: f.name.replace(/\.[a-z]+$/i, '').slice(0, 80), cards: cs }); cur = decks.length - 1; note.textContent = cs.length + ' ' + t('cards imported.'); save(); draw(); } else note.textContent = t('No cards found in that file.'); imp.value = ''; });
  // study: spaced repetition
  function study() {
    stage.textContent = ''; const due = C.dueCards(deck().cards, today()); if (!due.length) { stage.append(h('p', { class: 'fb ok' }, t('Nothing is due. Come back tomorrow, or practise with a game.'))); return; }
    const c = due[0], back = h('p', { class: 'back', hidden: true }, c.b), grades = h('div', { class: 'row', hidden: true });
    const label = (g) => { const x = C.reviewCard(c, g, today()); return t({ again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }[g]) + ' · ' + (x.ivl ? x.ivl + ' ' + t('d') : t('now')); };
    for (const g of ['again', 'hard', 'good', 'easy']) grades.append(btn(label(g), () => { Object.assign(c, C.reviewCard(c, g, today())); save(); tally(g !== 'again'); draw(); study(); }, { class: 'g-' + g }));
    stage.append(h('p', { class: 'soft' }, t('Due') + ': ' + due.length), h('p', { class: 'front big' }, c.f), back, btn('Show the answer', (e) => { back.hidden = false; grades.hidden = false; e.target.hidden = true; }, { class: 'primary', id: 'fc-show' }), grades);
  }
  function choice() {
    stage.textContent = ''; const cs = deck().cards; if (cs.length < 4) { stage.append(h('p', {}, t('A deck needs four cards for multiple choice.'))); return; }
    const i = Math.floor(Math.random() * cs.length), fb = h('p', { class: 'fb', role: 'status' });
    stage.append(h('p', { class: 'front big' }, cs[i].f), h('div', { class: 'choices' }, C.choicesFor(cs, i).map((c) => h('button', { type: 'button', onclick: (e) => { const ok = c === cs[i].b; e.target.classList.add(ok ? 'right' : 'wrong'); fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.textContent = ok ? t('Correct!') : t('Not quite.') + ' ' + cs[i].b; tally(ok); setTimeout(choice, 900); } }, c))), fb);
  }
  function typed() {
    stage.textContent = ''; const cs = deck().cards; if (!cs.length) return; const c = cs[Math.floor(Math.random() * cs.length)], inp = h('input', { type: 'text', 'aria-label': t('Your answer'), autocomplete: 'off' }), fb = h('p', { class: 'fb', role: 'status' });
    const go = () => { const ok = inp.value.trim().toLowerCase() === c.b.trim().toLowerCase(); fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.textContent = ok ? t('Correct!') : t('The answer is') + ' ' + c.b; tally(ok); setTimeout(typed, ok ? 700 : 1600); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    stage.append(h('p', { class: 'front big' }, c.f), h('div', { class: 'row' }, inp, btn('Check', go)), fb); inp.focus({ preventScroll: true });
  }
  function match() {
    stage.textContent = ''; const cs = C.shuffle(Math.random, deck().cards).slice(0, 6); if (cs.length < 2) return; const t0 = performance.now(); let first = null, left = cs.length;
    const tiles = C.shuffle(Math.random, cs.flatMap((c, i) => [{ s: c.f, i }, { s: c.b, i }])), fb = h('p', { class: 'fb', role: 'status' });
    stage.append(h('p', { class: 'soft' }, t('Tap a front, then its back.')), h('div', { class: 'match' }, tiles.map((x) => h('button', { type: 'button', onclick: (e) => {
      const b = e.currentTarget; if (b.disabled) return; if (!first) { first = { b, x }; b.classList.add('sel'); return; }
      if (first.b === b) { b.classList.remove('sel'); first = null; return; }
      if (first.x.i === x.i) { b.disabled = true; first.b.disabled = true; b.classList.add('right'); first.b.classList.add('right'); first.b.classList.remove('sel'); left--; if (!left) { const s = Math.round((performance.now() - t0) / 100) / 10; fb.className = 'fb ok'; fb.textContent = t('All matched in') + ' ' + s + ' s'; } }
      else { first.b.classList.remove('sel'); b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 500); }
      first = null;
    } }, x.s))), fb);
  }
  const share = btn('Share this deck', async () => { const url = location.origin + location.pathname + '#deck=' + C.deckToken(deck()); try { await navigator.clipboard.writeText(url); note.textContent = t('Copied the link to this deck.'); } catch (_) { note.textContent = url; } }, { id: 'fc-share' });
  const printBox = h('div', { class: 'cardsprint' }); const printCards = () => { printBox.textContent = ''; for (const c of deck().cards) printBox.append(h('div', { class: 'pc' }, h('b', {}, c.f), h('span', {}, c.b))); printPanel(printBox); };
  const el = panel('cards', 'Your decks', h('div', { class: 'row' }, pickD, btn('New deck', () => { decks.push({ name: t('New deck') + ' ' + (decks.length + 1), cards: [] }); cur = decks.length - 1; save(); draw(); name.focus(); }, { id: 'fc-new' }),
    btn('Delete deck', () => { if (decks.length > 1 && confirm(t('Delete this deck?'))) { decks.splice(cur, 1); cur = 0; save(); draw(); } })), h('div', { class: 'field' }, h('label', { for: 'fc-name' }, t('Deck name')), name), info,
    h('h3', {}, t('Study')), h('div', { class: 'row' }, btn('Study (spaced repetition)', study, { class: 'primary', id: 'fc-study-b' }), btn('Multiple choice', choice, { id: 'fc-mc' }), btn('Type the answer', typed, { id: 'fc-type' }), btn('Matching game', match, { id: 'fc-match' })), stage,
    h('h3', {}, t('Add cards')), paste, h('div', { class: 'row' }, btn('Add the cards', add, { id: 'fc-add' }), h('label', { class: 'btn', for: 'fc-imp' }, t('Import a file (.txt, .csv, .tsv)')), imp,
      btn('Export', () => download((deck().name || 'deck').replace(/[^\w -]+/g, '') + '.txt', C.deckText(deck().cards)), { id: 'fc-exp' }), share, btn('Print the cards', printCards, { id: 'fc-print' })), note,
    h('h3', {}, t('Cards in this deck')), list, printBox);
  draw(); if (shared) save(); study();
  return el;
}

// ---------- the typing tutor ----------
const LAYOUTS = { qwerty: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'], qwertz: ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm'] };
function typingPanel() {
  const m = mem(), ts = { lang: q0.get('lang') === 'de' || (isDe() && !m.typing) ? 'de' : 'en', layout: isDe() ? 'qwertz' : 'qwerty', stats: {}, letters: null, history: [], ...(m.typing || {}) };
  if (q0.get('lang') === 'de') ts.lang = 'de';
  if (!ts.letters || !ts.letters.length) ts.letters = [...C.KEY_ORDER[ts.lang]].slice(0, 6);
  const lang = h('select', { id: 'ty-lang', 'aria-label': t('Words') }, [['en', 'English words'], ['de', 'German words']].map(([v, l]) => h('option', { value: v, selected: ts.lang === v }, t(l))));
  const layout = h('select', { id: 'ty-layout', 'aria-label': t('Keyboard') }, [['qwerty', 'QWERTY'], ['qwertz', 'QWERTZ']].map(([v, l]) => h('option', { value: v, selected: ts.layout === v }, l)));
  const own = h('input', { type: 'text', id: 'ty-own', placeholder: t('Your own text to practise'), 'aria-label': t('Your own text to practise'), maxlength: '400' });
  const textEl = h('p', { class: 'typetext', id: 'ty-text', 'aria-label': t('Text to type') }), input = h('input', { type: 'text', id: 'ty-in', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('Type the text here') });
  const live = h('p', { class: 'live', id: 'ty-live', role: 'status' }), keys = h('div', { class: 'keys', id: 'ty-keys' }), letters = h('p', { class: 'soft', id: 'ty-letters' }), chart = h('div', { class: 'chart', id: 'ty-chart' });
  let text = '', pos = 0, log = [], last = 0, start = 0, misses = 0, ownText = (q0.get('text') || '').slice(0, 400);
  const save = () => keep({ typing: ts });
  function newLesson() { text = ownText || C.lesson(ts.letters, TYPE_WORDS[ts.lang], Math.random, 12); pos = 0; log = []; misses = 0; start = 0; input.value = ''; drawText(); drawLive(); }
  function drawText() { textEl.textContent = ''; [...text].forEach((ch, i) => textEl.append(h('span', { class: i < pos ? 'done' : i === pos ? 'cur' : '' }, ch))); }
  function drawLive() { const ms = log.length && start ? performance.now() - start : 0, good = log.filter((e) => e.ok).length; live.textContent = t('Speed') + ': ' + C.wpm(pos, ms) + ' WPM · ' + t('Accuracy') + ': ' + (log.length ? Math.round((100 * good) / log.length) : 100) + '% · ' + pos + ' / ' + text.length; }
  function drawKeys() {
    keys.textContent = ''; for (const row of LAYOUTS[layout.value]) keys.append(h('div', { class: 'krow' }, [...row].map((k) => { const s = ts.stats[k], open = ts.letters.includes(k), sp = s && s.wpm; return h('span', { class: 'key' + (open ? ' open' : ''), 'data-s': !s || !s.n ? '' : sp >= 30 ? 'fast' : sp >= 18 ? 'mid' : 'slow', title: s ? k + ': ' + (s.wpm || 0) + ' WPM, ' + s.acc + '%' : k }, k); })));
    const nx = [...C.KEY_ORDER[ts.lang]].find((c) => !ts.letters.includes(c)); letters.textContent = t('Open letters') + ': ' + ts.letters.join(' ') + (nx ? ' · ' + t('next') + ': ' + nx + ' (' + t('opens when every open letter is at 30 WPM and 92% accuracy') + ')' : '');
    const hs = ts.history.slice(-30); chart.textContent = ''; if (hs.length < 2) { chart.append(h('p', { class: 'soft' }, t('Your lessons will show here as a chart of your speed.'))); return; }
    const W = 360, H = 90, max = Math.max(40, ...hs.map((x) => x.wpm)), pts = hs.map((x, i) => (i * W) / (hs.length - 1) + ',' + (H - (x.wpm / max) * (H - 10))).join(' ');
    chart.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + t('Speed of your last lessons') + '"><polyline fill="none" stroke="currentColor" stroke-width="2.5" points="' + pts + '"/></svg>'; // void-review: ok: numbers and a fixed label only
    chart.append(h('p', { class: 'soft' }, t('Last lesson') + ': ' + hs[hs.length - 1].wpm + ' WPM, ' + hs[hs.length - 1].acc + '% · ' + t('Best') + ': ' + Math.max(...ts.history.map((x) => x.wpm)) + ' WPM'));
  }
  input.addEventListener('input', () => {
    const v = input.value; if (!v) return; const now = performance.now(); if (!start) { start = now; last = now; }
    for (const ch of v) { const want = text[pos]; if (want === undefined) break; const ok = ch === want || (want === ' ' && ch === ' '); log.push({ k: want === ' ' ? '' : want.toLowerCase(), ok, ms: now - last }); last = now; if (ok) pos++; else misses++; }
    input.value = ''; drawText(); drawLive();
    if (pos >= text.length) {
      const ms = now - start, acc = log.length ? Math.round((100 * log.filter((e) => e.ok).length) / log.length) : 100; ts.stats = C.keyStats(log, ts.stats); ts.history = ts.history.concat({ wpm: C.wpm(text.length, ms), acc, at: today() }).slice(-200);
      if (!ownText) { const before = ts.letters.length; ts.letters = C.nextLetters(ts.letters, ts.stats, C.KEY_ORDER[ts.lang]); if (ts.letters.length > before) live.textContent += ' · ' + t('New letter') + ': ' + ts.letters[ts.letters.length - 1]; }
      save(); tally(acc >= 90); drawKeys(); const msg = live.textContent; newLesson(); live.textContent = msg + ' · ' + t('Lesson done. Next one ready.');
    }
  });
  lang.addEventListener('change', () => { ts.lang = lang.value; ts.letters = [...C.KEY_ORDER[ts.lang]].slice(0, 6); save(); drawKeys(); newLesson(); });
  layout.addEventListener('change', () => { ts.layout = layout.value; save(); drawKeys(); });
  const el = panel('typing', 'Typing lesson', h('div', { class: 'row' }, lang, layout), textEl, input, live, h('p', { class: 'soft' }, t('Tap the box and type the text above. A wrong key is counted and not accepted: type the right one to go on.')),
    h('h3', {}, t('Your keys')), keys, letters, h('h3', {}, t('Progress')), chart,
    h('div', { class: 'row' }, own, btn('Practise this text', () => { ownText = own.value.trim().slice(0, 400); newLesson(); input.focus({ preventScroll: true }); }, { id: 'ty-ownb' }), btn('Adaptive lessons', () => { ownText = ''; own.value = ''; newLesson(); }, { id: 'ty-adapt' })),
    btn('Reset my typing statistics', () => { if (confirm(t('Clear your typing statistics?'))) { ts.stats = {}; ts.history = []; ts.letters = [...C.KEY_ORDER[ts.lang]].slice(0, 6); save(); drawKeys(); newLesson(); } }));
  if (ownText) own.value = ownText; drawKeys(); newLesson();
  return el;
}

// ---------- the fraction calculator ----------
function fractionsPanel() {
  const a = h('input', { type: 'text', id: 'fr-a', value: q0.get('a') || '3/4', 'aria-label': t('First fraction'), inputmode: 'text', autocomplete: 'off' }), b = h('input', { type: 'text', id: 'fr-b', value: q0.get('b') || '1/6', 'aria-label': t('Second fraction'), autocomplete: 'off' });
  const op = h('select', { id: 'fr-op', 'aria-label': t('Operation') }, [['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷']].map(([v, s]) => h('option', { value: v, selected: (q0.get('op') || 'add') === v }, s)));
  const res = h('div', { class: 'result', id: 'fr-res', 'aria-live': 'polite' }), steps = h('ol', { class: 'steps', id: 'fr-steps' });
  function calc() {
    res.textContent = ''; steps.textContent = ''; const r = C.fracCalc(a.value, op.value, b.value);
    if (!r) { res.append(h('p', { class: 'fb bad' }, t('Type fractions like 3/4, mixed numbers like 1 1/2, whole numbers or decimals. Dividing by zero has no answer.'))); return; }
    res.append(h('p', { class: 'big' }, a.value.trim() + ' ' + r.sym + ' ' + b.value.trim() + ' = ' + C.fstr(r.val)), h('dl', { class: 'dl' }, [['In lowest terms', C.fstr(r.val)], ['As a mixed number', r.mixed], ['As a decimal', r.decimal]].map(([k, v]) => h('div', {}, h('dt', {}, t(k)), h('dd', {}, v)))));
    for (const s of r.steps) steps.append(h('li', {}, fmt(s)));
    try { const q = new URLSearchParams(location.search); q.set('a', a.value.trim()); q.set('op', op.value); q.set('b', b.value.trim()); history.replaceState(null, '', location.pathname + '?' + q); } catch (_) { /* no history */ }
  }
  for (const x of [a, b]) x.addEventListener('keydown', (e) => { if (e.key === 'Enter') calc(); });
  op.addEventListener('change', calc);
  const simp = h('input', { type: 'text', id: 'fr-simp', value: q0.get('simp') || '18/24', 'aria-label': t('Fraction to simplify') }), simpOut = h('ol', { class: 'steps', id: 'fr-simp-out' });
  const doSimp = () => { simpOut.textContent = ''; const m = /^\s*(-?\d+)\s*\/\s*(\d+)\s*$/.exec(simp.value); if (!m || !+m[2]) { simpOut.append(h('li', {}, t('Type a fraction like 18/24.'))); return; } const p = C.problem('fsimp', null, [+m[1], +m[2]]); for (const s of p.steps) simpOut.append(h('li', {}, fmt(s))); };
  const dec = h('input', { type: 'text', id: 'fr-dec', value: q0.get('dec') || '0.375', 'aria-label': t('Decimal'), inputmode: 'decimal' }), decOut = h('ol', { class: 'steps', id: 'fr-dec-out' });
  const doDec = () => { decOut.textContent = ''; const r = C.decToFrac(dec.value); if (!r) { decOut.append(h('li', {}, t('Type a decimal like 0.375.'))); return; } for (const s of r.steps) decOut.append(h('li', {}, fmt(s))); if (Math.abs(r.val.n) > r.val.d && r.val.d > 1) decOut.append(h('li', {}, fmt({ k: 's.mixed', v: [C.mixedStr(r.val)] }))); };
  simp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSimp(); }); dec.addEventListener('keydown', (e) => { if (e.key === 'Enter') doDec(); });
  const el = panel('fractions', 'Calculate with fractions', h('div', { class: 'frow' }, a, op, b, btn('=', calc, { class: 'primary', id: 'fr-go', 'aria-label': t('Work it out') })), h('p', { class: 'soft' }, t('Fractions like 3/4, mixed numbers like 1 1/2 (a space before the fraction), whole numbers or decimals.')), res, h('h3', {}, t('Step by step')), steps,
    h('h3', {}, t('Simplify a fraction')), h('div', { class: 'row' }, simp, btn('Simplify', doSimp, { id: 'fr-simp-b' })), simpOut,
    h('h3', {}, t('Decimal to fraction')), h('div', { class: 'row' }, dec, btn('Convert', doDec, { id: 'fr-dec-b' })), decOut);
  calc(); doSimp(); doDec();
  return el;
}

// ---------- the other learning pages, from the hub ----------
const MORE = [['/learn/fractions/', 'Fraction calculator', 'every step shown, mixed numbers, decimals'], ['/learn/times/', 'Times tables', 'practice, a ten-second speed test, a grid of the facts you know'], ['/learn/cards/', 'Flashcards', 'your own decks with spaced repetition, games and a share link'],
  ['/learn/typing/', 'Typing tutor', 'lessons that open a letter when you are fast'], ['/learn/periodic/', 'Periodic table', 'interactive table of 118 elements and a symbol quiz'], ['/learn/vocab/', 'Vocabulary quiz', 'a word quiz whose level rises with you']];
function morePanel() { return panel('more', 'More ways to learn', h('ul', { class: 'skills' }, MORE.map(([href, n, d]) => h('li', {}, h('a', { href, class: 'btn more' }, h('b', {}, t(n)), h('span', { class: 'soft' }, ' · ' + t(d))))))); }
const PANELS = { course: coursePanel, more: morePanel, practice: practicePanel, review: reviewPanel, progress: progressPanel, worksheet: worksheetPanel, times: timesPanel, periodic: periodicPanel, vocab: vocabPanel, cards: cardsPanel, typing: typingPanel, fractions: fractionsPanel };
// the page keeps itself and its code in the service worker's cache (sw.js CACHE, 'void-shell-v2': keep the two names the same), so a reload with the network cut
// shows the whole page even when the worker took over a moment ago and has not fetched the page yet
const SW_CACHE = 'void-shell-v2';
function keepForOffline() {
  try { if (!('caches' in window)) return; caches.open(SW_CACHE).then((c) => Promise.all([location.pathname, location.pathname + 'app.js', '/lib/learn-ui.js', '/lib/learn-core.js', '/lib/learn-data.js', '/lib/learn-de.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/learn-sites.js', '/lib/flight-sites.js'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {}); } catch (_) { /* no cache here: the page still works online */ }
}
/** mounts the panels a page asks for into root: { panels: [...], skills: [...], de: { h1, intro } }. */
export function mountLearn(root, cfg = {}) {
  root.textContent = ''; const ctx = {};
  if (isDe()) { document.documentElement.lang = 'de'; if (cfg.de) { const hh = document.querySelector('h1'), p = document.querySelector('.intro'); if (hh && cfg.de.h1) hh.textContent = cfg.de.h1; if (p && cfg.de.intro) p.textContent = cfg.de.intro; if (cfg.de.h1) document.title = cfg.de.h1 + ' · Verse'; } }
  const want = cfg.panels || ['course', 'practice']; if (want.includes('course') && !want.includes('practice')) want.push('practice');
  // the practice panel is built first (the course and the review open it), then everything goes in the page's order
  const built = {}; if (want.includes('practice')) built.practice = practicePanel(cfg, ctx);
  for (const p of want) if (PANELS[p]) root.append(built[p] || PANELS[p](cfg, ctx));
  const foot = h('div', { class: 'row' }, btn('Share link', async () => { const url = location.href; try { if (navigator.share) { await navigator.share({ title: document.title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(url); msg.textContent = t('Copied the link.'); } catch (_) { msg.textContent = url; } }, { id: 'ln-share' }));
  const msg = h('span', { class: 'live', role: 'status', id: 'ln-msg' }); foot.append(msg); root.append(foot);
  root.append(h('p', { class: 'note' }, t('Made by Verse: every exercise is generated on this device and checked here; your progress stays in this browser and the page works offline after one visit. What Verse does not have: a video library, teacher dashboards or class accounts. Where a video explains best, the page links to Khan Academy’s free lessons.')));
  document.documentElement.dataset.learnReady = '1'; keepForOffline();
}
