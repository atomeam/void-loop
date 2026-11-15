// Modes built from what Verse watched, on the page that already covers the job.
// /notes/?mode=relationship  a dated log of what happened with someone
// /notes/?mode=devotion      one line kept for one person
// /photos/exif/?mode=provenance  who held a work, on this device
// /weather/?mode=hvac        the heat to set from the temperature on the page
// Nothing is uploaded. A paid product is linked once, in one honest line.

export const PRODUCT = { name: 'MultiVerse ($49 a month)', url: 'https://moonbeam846.gumroad.com/l/yinmj' };
const KEY = { relationship: 'a2m.void.rel-log', devotion: 'a2m.void.devotion', provenance: 'a2m.void.provenance', hvac: 'a2m.void.hvac-set' };

/** which mode this address is, or ''. Pure. */
export function modeOf(pathname, search) {
  const p = String(pathname || ''), q = String(search || '');
  const mode = (q.startsWith('?') ? new URLSearchParams(q.slice(1)) : new URLSearchParams(q)).get('mode') || '';
  if (p.startsWith('/notes') && (mode === 'relationship' || mode === 'devotion')) return mode;
  if (p.startsWith('/photos/exif') && mode === 'provenance') return mode;
  if (p.startsWith('/weather') && mode === 'hvac') return mode;
  return '';
}

/** the heat to set from a Celsius reading and a chosen setpoint. Pure. */
export function heatAdvice(tempC, setC) {
  const set = Number.isFinite(setC) ? setC : 20;
  if (!Number.isFinite(tempC)) return 'Look up a place. The heat stays at ' + set + '°C until the forecast is on the page.';
  if (tempC < set - 1) return 'It is ' + tempC + '°C. Set the heat to ' + set + '°C.';
  if (tempC > set + 1) return 'It is ' + tempC + '°C. Leave the heat off. It is already above ' + set + '°C.';
  return 'It is ' + tempC + '°C, close to ' + set + '°C. Leave the heat where it is.';
}

/** Celsius from the weather page's "N °F / M °C" line, or null. Pure. */
export function celsiusOf(text) {
  const m = /(-?\d+)\s*°C/.exec(String(text || ''));
  return m ? Number(m[1]) : null;
}

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function panel(title, body) {
  const main = document.querySelector('main'); if (!main) return null;
  const s = document.createElement('section');
  s.id = 'watched-mode';
  s.innerHTML = '<h2>' + esc(title) + '</h2>' + body
    + '<p class="note">Kept on this device. <a href="' + PRODUCT.url + '">' + esc(PRODUCT.name) + '</a> is the paid Verse for the next tool you need.</p>';
  main.insertBefore(s, main.firstChild);
  return s;
}

function rows(list) {
  return '<ul>' + list.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>';
}

function relationship() {
  const log = Array.isArray(read(KEY.relationship)) ? read(KEY.relationship) : [];
  const s = panel('Relationship history', '<form id="wm-rel"><label>Who <input name="who" required maxlength="80"></label> <label>When <input name="when" type="date" required></label> <label>What happened <input name="what" required maxlength="240"></label> <button type="submit">Add</button></form><div id="wm-list">' + rows(log.map((r) => r.when + ' · ' + r.who + ' · ' + r.what)) + '</div>');
  if (!s) return;
  s.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target), row = { who: String(f.get('who') || '').trim(), when: String(f.get('when') || ''), what: String(f.get('what') || '').trim() };
    if (!row.who || !row.when || !row.what) return;
    const next = [row, ...log].slice(0, 200);
    write(KEY.relationship, next);
    s.querySelector('#wm-list').innerHTML = rows(next.map((r) => r.when + ' · ' + r.who + ' · ' + r.what));
    e.target.reset();
  });
}

function devotion() {
  const saved = read(KEY.devotion) || { who: '', line: '' };
  const s = panel('Devotion', '<form id="wm-dev"><label>Who <input name="who" required maxlength="80" value="' + esc(saved.who) + '"></label> <label>Today\'s line <input name="line" required maxlength="240" value="' + esc(saved.line) + '"></label> <button type="submit">Keep</button></form><p id="wm-kept">' + (saved.line ? esc(saved.who) + ': ' + esc(saved.line) : '') + '</p>');
  if (!s) return;
  s.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target), row = { who: String(f.get('who') || '').trim(), line: String(f.get('line') || '').trim() };
    if (!row.who || !row.line) return;
    write(KEY.devotion, row);
    s.querySelector('#wm-kept').textContent = row.who + ': ' + row.line;
  });
}

function provenance() {
  const log = Array.isArray(read(KEY.provenance)) ? read(KEY.provenance) : [];
  const s = panel('Art provenance', '<p>Who held the work, kept here. The photo checker above still reads the camera, the software and the time in the file.</p><form id="wm-prov"><label>Work <input name="work" required maxlength="120"></label> <label>Held by <input name="who" required maxlength="80"></label> <label>From <input name="from" required maxlength="12"></label> <label>Until <input name="until" maxlength="12"></label> <button type="submit">Add</button></form><div id="wm-list">' + rows(log.map((r) => r.work + ' · ' + r.who + ' · ' + r.from + (r.until ? '–' + r.until : ''))) + '</div>');
  if (!s) return;
  s.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target), row = { work: String(f.get('work') || '').trim(), who: String(f.get('who') || '').trim(), from: String(f.get('from') || '').trim(), until: String(f.get('until') || '').trim() };
    if (!row.work || !row.who || !row.from) return;
    const next = [row, ...log].slice(0, 200);
    write(KEY.provenance, next);
    s.querySelector('#wm-list').innerHTML = rows(next.map((r) => r.work + ' · ' + r.who + ' · ' + r.from + (r.until ? '–' + r.until : '')));
    e.target.reset();
  });
}

function hvac() {
  const set = Number(read(KEY.hvac));
  const setC = Number.isFinite(set) ? set : 20;
  const s = panel('Heat', '<form id="wm-heat"><label>Set the heat to <input name="set" type="number" min="10" max="30" value="' + setC + '"> °C</label> <button type="submit">Keep</button></form><p id="wm-heat-line"></p>');
  if (!s) return;
  const say = () => { const n = Number(s.querySelector('input').value); s.querySelector('#wm-heat-line').textContent = heatAdvice(celsiusOf(document.getElementById('temp') && document.getElementById('temp').textContent), n); };
  say();
  const temp = document.getElementById('temp');
  if (temp && typeof MutationObserver === 'function') new MutationObserver(say).observe(temp, { childList: true, characterData: true, subtree: true });
  s.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const n = Number(new FormData(e.target).get('set')); if (!Number.isFinite(n)) return; write(KEY.hvac, n); say(); });
}

const LINKS = {
  '/notes': [['?mode=relationship', 'Relationship history'], ['?mode=devotion', 'Devotion']],
  '/photos/exif': [['?mode=provenance', 'Art provenance']],
  '/weather': [['?mode=hvac', 'Set the heat']],
};

function linksFor(pathname) {
  const hit = Object.keys(LINKS).find((k) => pathname.startsWith(k));
  if (!hit || modeOf(pathname, location.search)) return;
  const main = document.querySelector('main'); if (!main) return;
  const p = document.createElement('p');
  p.id = 'watched-links';
  p.innerHTML = LINKS[hit].map(([href, name]) => '<a href="' + href + '">' + esc(name) + '</a>').join(' · ');
  main.insertBefore(p, main.firstChild);
}

const RUN = { relationship, devotion, provenance, hvac };
if (typeof document !== 'undefined') {
  const mode = modeOf(location.pathname, location.search);
  if (mode && RUN[mode]) RUN[mode]();
  else linksFor(location.pathname);
}
