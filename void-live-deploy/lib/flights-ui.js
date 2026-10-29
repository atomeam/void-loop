/**
 * flights-ui: the screen of the flights pages (/flights/ and one page per site of the travel lane, lib/flight-sites.js; owner, 2026-10-26: "need a flights page"). One module,
 * each page asks for the panels it needs: mountFlights(root, { panels: ['controls', 'providers', 'facts', ...], controls: ['airports', 'dates', ...] }). All on the device:
 * the airport index (/flights/airports.json) is read once, the visitor's fares and trips are kept in this browser, and the only things that leave are the links the
 * visitor opens (a fixed list of providers). English and German. Pure logic: lib/flights-core.js. Tests: tools/flights.test.mjs, tools/flights-page.mjs.
 */
import * as C from '/lib/flights-core.js';
import { DE } from '/lib/flights-de.js';
import { COAST, COAST_Q } from '/lib/flights-coast.js';
let coast = null; const coastLines = () => coast || (coast = C.decodeCoast(COAST, COAST_Q));

const KEY = 'a2m.void.flights.v1';
const isDe = () => /^de\b/i.test(navigator.language || '') || new URLSearchParams(location.search).get('lang') === 'de';
export const t = (s) => (isDe() && DE[s]) || s;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (root, sel) => root.querySelector(sel);
const num = (n, d = 0) => Number(n).toLocaleString(isDe() ? 'de-DE' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked: the page still works */ } return m; }
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// ---------- shared state: what the visitor picked, kept in the link and on the device ----------
const state = { from: '', to: '', via: '', depart: '', ret: '', time: '12:00', oneWay: false, ad: 1, ch: 0, inf: 0, cab: 'economy', stay: 90 };
const subs = new Set(); let idx = null;
const emit = (src) => { const q = new URLSearchParams(); if (state.from) q.set('from', state.from); if (state.to) q.set('to', state.to); if (state.via) q.set('via', state.via); if (state.depart) q.set('d', state.depart); if (state.ret && !state.oneWay) q.set('r', state.ret); if (state.oneWay) q.set('ow', '1'); if (state.ad !== 1) q.set('ad', state.ad); if (state.ch) q.set('ch', state.ch); if (state.cab !== 'economy') q.set('cab', state.cab); if (state.time !== '12:00') q.set('t', state.time); if (isDe()) q.set('lang', 'de');
  try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (_) { /* a sandbox without history */ } keep({ state: { from: state.from, to: state.to, depart: state.depart, ret: state.ret, oneWay: state.oneWay, ad: state.ad, ch: state.ch, inf: state.inf, cab: state.cab } }); for (const f of subs) if (f !== src) f(); };
function readState() {
  const m = mem().state || {}, q = new URLSearchParams(location.search), code = (v) => (/^[A-Za-z]{3}$/.test(v || '') ? v.toUpperCase() : '');
  Object.assign(state, { from: code(m.from), to: code(m.to), depart: C.isoDate(m.depart), ret: C.isoDate(m.ret), oneWay: !!m.oneWay, ad: m.ad || 1, ch: m.ch || 0, inf: m.inf || 0, cab: C.CABINS[m.cab] ? m.cab : 'economy' });
  if (q.has('from')) state.from = code(q.get('from')); if (q.has('to')) state.to = code(q.get('to')); if (q.has('via')) state.via = code(q.get('via')); if (q.has('d')) state.depart = C.isoDate(q.get('d')); if (q.has('r')) state.ret = C.isoDate(q.get('r'));
  if (q.has('ow')) state.oneWay = q.get('ow') === '1'; if (q.has('ad')) state.ad = Math.min(9, Math.max(1, +q.get('ad') || 1)); if (q.has('ch')) state.ch = Math.min(8, Math.max(0, +q.get('ch') || 0)); if (q.has('cab') && C.CABINS[q.get('cab')]) state.cab = q.get('cab'); if (/^\d{2}:\d{2}$/.test(q.get('t') || '')) state.time = q.get('t');
  if (state.depart && state.depart < today()) { state.depart = ''; state.ret = ''; }
  state.fromq = (q.get('fromq') || '').slice(0, 60); state.toq = (q.get('toq') || '').slice(0, 60);
}
const ap = (code) => (idx && code ? idx.byIata.get(code) : null);
const apName = (a) => (a ? a.city + ' (' + a.iata + ')' : '');
const depLocal = () => (state.depart || C.defaultDep().slice(0, 10)) + 'T' + (state.time || '12:00');
const nowLabel = (a) => { try { return new Intl.DateTimeFormat(isDe() ? 'de-DE' : 'en-GB', { timeZone: a.tz, hour: '2-digit', minute: '2-digit', weekday: 'short' }).format(new Date()); } catch (_) { return ''; } };

// ---------- an airport picker: type a city, a name or a code; pick from the list ----------
function picker(label, key, id) {
  const wrap = document.createElement('div'); wrap.className = 'field apk';
  wrap.innerHTML = '<label for="' + id + '">' + esc(t(label)) + '</label><input type="text" id="' + id + '" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="' + id + '-list" placeholder="' + esc(t('City, airport or code')) + '"><ul class="sug" id="' + id + '-list" role="listbox" hidden></ul>';
  const input = $(wrap, 'input'), list = $(wrap, 'ul');
  const show = () => { input.value = state[key] && ap(state[key]) ? apName(ap(state[key])) : state[key] || ''; };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const choose = (a) => { state[key] = a.iata; show(); close(); emit(); update(); };
  function suggest() {
    if (!idx) return; const res = C.searchAirports(idx, input.value, 7); list.textContent = '';
    for (const a of res) { const li = document.createElement('li'); li.setAttribute('role', 'option'); const b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<b>' + esc(a.iata) + '</b> ' + esc(a.city) + ' <span class="soft">' + esc(a.name) + ' · ' + esc(a.country) + '</span>'; b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => choose(a)); li.append(b); list.append(li); }
    list.hidden = !res.length; input.setAttribute('aria-expanded', String(!!res.length));
  }
  input.addEventListener('input', () => { suggest(); const v = input.value.trim().toUpperCase(); if (/^[A-Z]{3}$/.test(v) && ap(v)) { state[key] = v; emit(); update(); } });
  input.addEventListener('focus', () => { input.select(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const r = idx && C.searchAirports(idx, input.value, 1)[0]; if (r) choose(r); } else if (e.key === 'Escape') close(); });
  input.addEventListener('blur', () => setTimeout(() => { close(); const r = idx && input.value.trim() && C.searchAirports(idx, input.value, 1)[0]; if (r && (!state[key] || !ap(state[key]) || input.value.trim() !== apName(ap(state[key])))) { if (/^[A-Za-z]{3}$/.test(input.value.trim()) || r.city.toLowerCase().startsWith(input.value.trim().toLowerCase())) { state[key] = r.iata; emit(); } } show(); update(); }, 120));
  function update() { show(); }
  subs.add(update); return { el: wrap, update };
}

// ---------- panels ----------
const PANELS = {};
const pane = (title, id) => { const s = document.createElement('section'); s.className = 'panel'; s.id = id; s.setAttribute('aria-labelledby', id + '-h'); s.innerHTML = '<h2 id="' + id + '-h">' + esc(t(title)) + '</h2>'; return s; };
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };

/** controls: the form. Fields: airports, via, dates, time, pax, cabin, trip. */
PANELS.controls = (cfg) => {
  const s = pane(cfg.title || 'Your trip', 'controls'), f = cfg.controls || ['airports', 'trip', 'dates', 'pax', 'cabin'];
  const form = document.createElement('div'); form.className = 'form'; s.append(form);
  if (f.includes('airports')) {
    const row = document.createElement('div'); row.className = 'grid2'; const a = picker('From', 'from', 'f-from'), b = picker('To', 'to', 'f-to');
    const sw = document.createElement('button'); sw.type = 'button'; sw.className = 'swap'; sw.textContent = '⇄'; sw.setAttribute('aria-label', t('Swap from and to')); sw.addEventListener('click', () => { [state.from, state.to] = [state.to, state.from]; emit(); for (const u of subs) u(); });
    row.append(a.el, b.el); form.append(row, sw);
    if (f.includes('via')) { const v = picker('Stop on the way (optional)', 'via', 'f-via'); form.append(v.el); }
  } else if (f.includes('origin')) { form.append(picker('From', 'from', 'f-from').el); }
  if (f.includes('trip')) { const r = el('<div class="row" role="radiogroup" aria-label="' + esc(t('Trip type')) + '"><label class="chk"><input type="radio" name="trip" value="return"> ' + esc(t('Return')) + '</label><label class="chk"><input type="radio" name="trip" value="one"> ' + esc(t('One way')) + '</label></div>');
    const sync = () => { for (const i of r.querySelectorAll('input')) i.checked = (i.value === 'one') === state.oneWay; }; subs.add(sync); sync(); r.addEventListener('change', (e) => { state.oneWay = e.target.value === 'one'; emit(); for (const u of subs) u(); }); form.append(r); }
  if (f.includes('dates')) { const r = el('<div class="grid2"><div class="field"><label for="f-d">' + esc(t('Depart')) + '</label><input type="date" id="f-d" min="' + today() + '"></div><div class="field" id="f-rw"><label for="f-r">' + esc(t('Return')) + '</label><input type="date" id="f-r" min="' + today() + '"></div></div>');
    const d = $(r, '#f-d'), rr = $(r, '#f-r'), sync = () => { d.value = state.depart; rr.value = state.ret; $(r, '#f-rw').hidden = state.oneWay; }; subs.add(sync); sync();
    d.addEventListener('change', () => { state.depart = C.isoDate(d.value); if (state.ret && state.ret < state.depart) state.ret = ''; emit(); for (const u of subs) u(); }); rr.addEventListener('change', () => { state.ret = C.isoDate(rr.value); emit(); for (const u of subs) u(); }); form.append(r); }
  if (f.includes('time')) { const r = el('<div class="field"><label for="f-t">' + esc(t('Departure time (local)')) + '</label><input type="time" id="f-t"></div>'); const i = $(r, 'input'); i.value = state.time; i.addEventListener('change', () => { state.time = /^\d{2}:\d{2}$/.test(i.value) ? i.value : '12:00'; emit(); for (const u of subs) u(); }); form.append(r); }
  if (f.includes('stay')) { const r = el('<div class="field"><label for="f-s">' + esc(t('Wait at the stop')) + '</label><select id="f-s"><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option><option value="180">3 h</option><option value="300">5 h</option><option value="480">8 h</option><option value="720">12 h</option><option value="1440">24 h</option></select></div>'); const i = $(r, 'select'); i.value = String(state.stay); i.addEventListener('change', () => { state.stay = +i.value; for (const u of subs) u(); }); form.append(r); }
  if (f.includes('pax')) { const r = el('<div class="grid3"><div class="field"><label for="f-ad">' + esc(t('Adults')) + '</label><input type="number" id="f-ad" min="1" max="9" inputmode="numeric"></div><div class="field"><label for="f-ch">' + esc(t('Children')) + '</label><input type="number" id="f-ch" min="0" max="8" inputmode="numeric"></div><div class="field"><label for="f-in">' + esc(t('Infants')) + '</label><input type="number" id="f-in" min="0" max="9" inputmode="numeric"></div></div>');
    const A = $(r, '#f-ad'), Ch = $(r, '#f-ch'), In = $(r, '#f-in'), sync = () => { A.value = state.ad; Ch.value = state.ch; In.value = state.inf; }; subs.add(sync); sync();
    const read = () => { state.ad = Math.min(9, Math.max(1, Math.round(+A.value) || 1)); state.ch = Math.min(8, Math.max(0, Math.round(+Ch.value) || 0)); state.inf = Math.min(state.ad, Math.max(0, Math.round(+In.value) || 0)); emit(); for (const u of subs) u(); };
    for (const i of [A, Ch, In]) i.addEventListener('change', read); form.append(r); }
  if (f.includes('cabin')) { const r = el('<div class="field"><label for="f-c">' + esc(t('Cabin')) + '</label><select id="f-c">' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '</option>').join('') + '</select></div>'); const i = $(r, 'select'); const sync = () => { i.value = state.cab; }; subs.add(sync); sync(); i.addEventListener('change', () => { state.cab = i.value; emit(); for (const u of subs) u(); }); form.append(r); }
  return s;
};

/** providers: one search, opened on each provider's site; the airline's own site. */
PANELS.providers = () => {
  const s = pane('Search across providers', 'providers');
  s.insertAdjacentHTML('beforeend', '<p class="note" id="pv-note"></p><ul class="plist" id="pv-list"></ul><div class="row"><div class="field"><label for="pv-al">' + esc(t('An airline’s own site')) + '</label><select id="pv-al"><option value="">' + esc(t('Choose an airline')) + '</option>' + Object.entries(C.AIRLINES).sort((a, b) => a[1][0].localeCompare(b[1][0])).map(([k, v]) => '<option value="' + k + '">' + esc(v[0]) + ' (' + k + ')</option>').join('') + '</select></div><a class="btn" id="pv-aw" rel="noopener noreferrer" target="_blank" hidden></a></div><p class="note" id="pv-why"></p>');
  const note = $(s, '#pv-note'), list = $(s, '#pv-list'), sel = $(s, '#pv-al'), aw = $(s, '#pv-aw');
  const upd = () => {
    const ok = state.from && state.to && state.depart && ap(state.from) && ap(state.to);
    note.textContent = t('Verse has no live fares. It opens your search on each provider, which shows the prices. Nothing is sent from this page; you open the link.');
    list.textContent = '';
    if (!ok) { const li = document.createElement('li'); li.className = 'soft'; li.textContent = t('Pick where from, where to and a departure date to get the links.'); list.append(li); return; }
    for (const l of C.providerLinks({ from: state.from, to: state.to, depart: state.depart, ret: state.ret, oneWay: state.oneWay || !state.ret, pax: { adults: state.ad, children: state.ch, infants: state.inf }, cabin: state.cab })) {
      const li = document.createElement('li'), a = document.createElement('a'); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'btn'; a.textContent = t('Search on') + ' ' + l.name + ' ↗';
      const w = document.createElement('span'); w.className = 'soft'; w.textContent = ' ' + (l.check === 'confirmed' ? t('address pattern confirmed') : l.check === 'partly' ? t('address pattern partly confirmed') : t('address pattern not confirmed: it may open the front page')); li.append(a, w); list.append(li);
    }
  };
  sel.addEventListener('change', () => { const a = C.airlineSite(sel.value); if (a) { aw.href = a.url; aw.textContent = t('Open') + ' ' + a.name + ' ↗'; aw.hidden = false; } else aw.hidden = true; });
  $(s, '#pv-why').textContent = t('The list of providers is fixed: the page builds these addresses itself, from your choices, and opens nothing else. An airline’s link opens its home page (airlines do not share one search address).');
  subs.add(upd); upd(); return s;
};

/** facts: the route worked out on the device. */
PANELS.facts = (cfg) => {
  const s = pane('Route facts', 'facts'); s.insertAdjacentHTML('beforeend', '<div id="fa-out" aria-live="polite"></div><div id="fa-near"></div>');
  const out = $(s, '#fa-out'), near = $(s, '#fa-near'); if (state.from && state.to) out.style.minHeight = '400px'; // room for the answer, so the page below does not jump
  const upd = () => {
    const a = ap(state.from), b = ap(state.to); near.textContent = '';
    if (!a || !b) { out.innerHTML = '<p class="soft">' + esc(t('Pick two airports to see the Distance in km, miles and nm, the typical flight time, the time difference, the Direction, the distance actually flown, the CO2 of the flight and the Nearby airports of each end.')) + '</p>'; return; }
    if (a.iata === b.iata) { out.innerHTML = '<p class="soft">' + esc(t('Pick two different airports.')) + '</p>'; return; }
    const f = C.legFacts(a, b, depLocal(), { cabin: state.cab, pax: state.ad + state.ch, ret: !state.oneWay && !!state.ret });
    const shift = f.dayShift ? ' (' + (f.dayShift > 0 ? '+' : '−') + Math.abs(f.dayShift) + ' ' + t(Math.abs(f.dayShift) === 1 ? 'day' : 'days') + ')' : '', d = f.diffMin;
    const rows = [
      [t('Distance'), num(f.km) + ' km · ' + num(f.mi) + ' ' + t('miles') + ' · ' + num(f.nm) + ' nm'],
      [t('Typical flight time'), C.hm(f.minutes)],
      [t('Leaves'), apName(a) + ' · ' + f.dep.slice(0, 10) + ' ' + f.dep.slice(11) + ' ' + t('local') + ' (' + C.offsetLabel(C.offsetMin(a.tz, f.depUtc)) + ')'],
      [t('Arrives'), apName(b) + ' · ' + f.arrDate + ' ' + f.arrTime + ' ' + t('local') + ' (' + C.offsetLabel(C.offsetMin(b.tz, f.arrUtc)) + ')' + shift],
      [t('Time difference'), (d === 0 ? t('none') : (d > 0 ? '+' : '−') + C.hm(Math.abs(d)) + ' ' + t(d > 0 ? 'ahead of the departure city' : 'behind the departure city'))],
      [t('Direction'), Math.round(f.bearing) + '° ' + compass(f.bearing)],
      [t('Distance actually flown'), num(f.flownKm) + ' km (' + t('the great circle plus a typical routing allowance') + ')'],
      [t('Date line'), f.dateLine ? t('the great circle crosses the date line') : t('not crossed')],
      [t('CO2 per ticket'), num(f.co2.kg) + ' kg (' + num(f.co2.low) + ' – ' + num(f.co2.high) + ') · ' + t('with high-altitude effects') + ' ' + num(f.co2.withNonCo2) + ' kg'],
    ];
    out.innerHTML = '<dl class="dl">' + rows.map((r) => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>' + ((a.approx || b.approx) ? '<p class="note">' + esc(t('The time zone of an airport in a country with several zones is placed by its position and can be an hour out.')) + '</p>' : '') + '<p class="note">' + esc(t('The flight time is typical (half an hour plus the distance at 805 km/h), not a timetable. The CO2 figure is an estimate; the method is on the CO2 page.')) + '</p>';
    const na = C.nearby(idx, a, 150, 4), nb = C.nearby(idx, b, 150, 4);
    if (na.length || nb.length) { near.innerHTML = '<h3>' + esc(t('Nearby airports')) + '</h3>' + [[a, na], [b, nb]].filter((x) => x[1].length).map(([x, l]) => '<p class="chips">' + esc(x.city) + ': ' + l.map((n) => '<button type="button" class="chip" data-code="' + n.a.iata + '" data-of="' + (x === a ? 'from' : 'to') + '">' + esc(n.a.iata + ' · ' + num(n.km) + ' km') + '</button>').join('') + '</p>').join(''); }
  };
  near.addEventListener('click', (e) => { const b = e.target.closest('button[data-code]'); if (!b) return; state[b.dataset.of] = b.dataset.code; emit(); for (const u of subs) u(); });
  subs.add(upd); upd(); return s;
};
const compass = (b) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(b / 22.5) % 16];

/** co2: the estimate with its method. */
PANELS.co2 = () => {
  const s = pane('CO2 of the flight', 'co2'); s.insertAdjacentHTML('beforeend', '<div id="c-out" aria-live="polite"></div><details open><summary>' + esc(t('How this is worked out')) + '</summary><div id="c-how"></div></details>');
  const out = $(s, '#c-out'), how = $(s, '#c-how'); if (state.from && state.to) out.style.minHeight = '250px';
  how.innerHTML = '<p>' + esc(t('The estimate for one seat is a fixed 20 kg for taxi, take-off and landing plus 0.09 kg for each kilometre flown (the great-circle distance plus an allowance for the route: 50 km under 550 km, 100 km up to 5,500 km, 125 km beyond). That is the economy figure of a typical jet about 80 percent full. A bigger seat takes more of the floor: premium economy 1.6, business 2.9 and first 4 times on flights over 3,700 km; business and first 1.5 times on shorter ones. A return trip doubles it and each passenger counts once.')) + '</p><p>' + esc(t('The range is 25 percent either way, because aircraft, load and route differ. The second figure multiplies by 1.9 for contrails and nitrogen oxides at altitude, the usual factor for CO2 equivalent. It is an average, not an airline’s own figure.')) + '</p>';
  const upd = () => {
    const a = ap(state.from), b = ap(state.to); if (!a || !b || a.iata === b.iata) { out.innerHTML = '<p class="soft">' + esc(t('Pick two different airports to see the kg CO2 of a seat on the flight, its Range, the figure per passenger-kilometre and with high-altitude effects.')) + '</p>'; return; }
    const km = C.distanceKm(a, b), c = C.co2(km, state.cab, state.ad + state.ch, !state.oneWay && !!state.ret);
    out.innerHTML = '<p class="big">' + esc(num(c.kg)) + ' <small>kg CO2</small></p><p class="note">' + esc(apName(a) + ' → ' + apName(b) + ' · ' + num(km) + ' km · ' + t(C.CABINS[state.cab]) + ' · ' + c.pax + ' ' + t(c.pax === 1 ? 'passenger' : 'passengers') + ' · ' + (c.legs === 2 ? t('return') : t('one way'))) + '</p><dl class="dl"><div><dt>' + esc(t('Range')) + '</dt><dd>' + esc(num(c.low) + ' – ' + num(c.high) + ' kg') + '</dd></div><div><dt>' + esc(t('With high-altitude effects (×1.9)')) + '</dt><dd>' + esc(num(c.withNonCo2) + ' kg CO2e') + '</dd></div><div><dt>' + esc(t('Per passenger-kilometre')) + '</dt><dd>' + esc(num(c.perKm) + ' g') + '</dd></div><div><dt>' + esc(t('Cabin factor')) + '</dt><dd>×' + esc(c.cabinFactor) + '</dd></div></dl>';
  };
  subs.add(upd); upd(); return s;
};

/** time: the flight duration calculator, with a stop. */
PANELS.time = () => {
  const s = pane('Flight time and arrival', 'time'); s.insertAdjacentHTML('beforeend', '<div id="t-out" aria-live="polite"></div>');
  const out = $(s, '#t-out'); if (state.from && state.to) out.style.minHeight = '230px';
  const upd = () => {
    const a = ap(state.from), b = ap(state.to), v = ap(state.via);
    if (!a || !b || a.iata === b.iata) { out.innerHTML = '<p class="soft">' + esc(t('Pick where from and to, and when you leave, to get the typical flight time (like 7 h 20 min), the time it Arrives in local time, the time difference with daylight saving on that date (each time with its offset, like UTC+01) and the date line. Add a stop for the whole journey.')) + '</p>'; return; }
    const dep = depLocal();
    if (!v) { const f = C.legFacts(a, b, dep); out.innerHTML = leg(a, b, f) + '<p class="note">' + esc(t('Add a stop to see the whole journey with the wait between the flights.')) + ' ' + esc(t('Daylight saving is applied for the date you pick; the offsets from UTC are shown with each time.')) + '</p>'; return; }
    const f1 = C.legFacts(a, v, dep), lay = state.stay, dep2Utc = f1.arrUtc + lay * 60000, dep2 = C.utcToLocal(v.tz, dep2Utc).local, f2 = C.legFacts(v, b, dep2), total = (f2.arrUtc - f1.depUtc) / 60000;
    out.innerHTML = leg(a, v, f1) + '<p class="stay">' + esc(t('Wait at') + ' ' + apName(v) + ': ' + C.hm(lay)) + '</p>' + leg(v, b, f2) + '<p class="big">' + esc(C.hm(total)) + ' <small>' + esc(t('door to door in the air and at the stop')) + '</small></p>';
  };
  const leg = (a, b, f) => '<div class="leg"><b>' + esc(a.iata + ' → ' + b.iata) + '</b> · ' + esc(C.hm(f.minutes)) + ' · ' + esc(num(f.km) + ' km') + '<br>' + esc(t('Leaves') + ' ' + f.dep.slice(0, 10) + ' ' + f.dep.slice(11) + ' ' + t('local') + ' (' + a.city + ', ' + C.offsetLabel(C.offsetMin(a.tz, f.depUtc)) + ')') + '<br>' + esc(t('Arrives') + ' ' + f.arrDate + ' ' + f.arrTime + ' ' + t('local') + ' (' + b.city + ', ' + C.offsetLabel(C.offsetMin(b.tz, f.arrUtc)) + ')' + (f.dayShift ? ' · ' + (f.dayShift > 0 ? '+' : '−') + Math.abs(f.dayShift) + ' ' + t(Math.abs(f.dayShift) === 1 ? 'day' : 'days') : '')) + '<br>' + esc(t('Time difference') + ': ' + (f.diffMin === 0 ? t('none') : (f.diffMin > 0 ? '+' : '−') + C.hm(Math.abs(f.diffMin)) + ' ' + t(f.diffMin > 0 ? 'ahead of the departure city' : 'behind the departure city')) + (f.dateLine ? ' · ' + t('crosses the date line') : '')) + '</div>';
  subs.add(upd); upd(); return s;
};

/** route: a chain of airports, leg by leg, on a map. */
PANELS.route = () => {
  const s = pane('Chain of airports', 'route'); s.insertAdjacentHTML('beforeend', '<div class="field"><label for="r-in">' + esc(t('Airports in order, with a dash or a space')) + '</label><input type="text" id="r-in" value="JFK-LHR-SIN" autocomplete="off" spellcheck="false"></div><div class="map" id="r-map"></div><div id="r-out" aria-live="polite"></div>');
  const inp = $(s, '#r-in'), out = $(s, '#r-out'), map = $(s, '#r-map'); out.style.minHeight = '230px'; map.style.minHeight = '195px'; const q = new URLSearchParams(location.search).get('route'); if (q) inp.value = q;
  const upd = () => {
    if (!idx) return; const { ports, bad } = C.parseRoute(idx, inp.value);
    if (ports.length < 2) { out.innerHTML = '<p class="soft">' + esc(t('Type two or more airport codes, like JFK-LHR-SIN.')) + '</p>'; map.innerHTML = C.mapSvg(ports, 640, 320, coastLines()); return; }
    let tot = 0, min = 0; const rows = [];
    for (let i = 0; i + 1 < ports.length; i++) { const km = C.distanceKm(ports[i], ports[i + 1]); tot += km; min += C.flightMinutes(km); rows.push('<tr><td>' + esc(ports[i].iata + ' → ' + ports[i + 1].iata) + '</td><td>' + esc(num(km) + ' km') + '</td><td>' + esc(num(C.km2mi(km)) + ' ' + t('miles')) + '</td><td>' + esc(C.hm(C.flightMinutes(km))) + '</td></tr>'); }
    out.innerHTML = '<table class="tbl"><thead><tr><th>' + esc(t('Leg')) + '</th><th>km</th><th>' + esc(t('miles')) + '</th><th>' + esc(t('Time')) + '</th></tr></thead><tbody>' + rows.join('') + '</tbody><tfoot><tr><th>' + esc(t('Total')) + '</th><th>' + esc(num(tot) + ' km') + '</th><th>' + esc(num(C.km2mi(tot)) + ' ' + t('miles')) + '</th><th>' + esc(C.hm(min)) + '</th></tr></tfoot></table>' + (bad.length ? '<p class="note bad">' + esc(t('Not found:') + ' ' + bad.join(', ')) + '</p>' : '') + '<h3>' + esc(t('Airports on the route')) + '</h3><ul class="plain">' + ports.map((x) => '<li><b>' + esc(x.iata) + '</b> ' + esc(x.name) + ' <span class="soft">' + esc(x.city + ' · ' + x.country + ' · ' + C.offsetLabel(C.offsetMin(x.tz, Date.now()))) + '</span></li>').join('') + '</ul><p class="note">' + esc(t('The map shows the great-circle paths on a plain grid of 30 degrees: no coastlines are drawn.')) + '</p>';
    map.innerHTML = C.mapSvg(ports, 640, 320, coastLines());
  };
  inp.addEventListener('input', () => { upd(); const u = new URL(location.href); u.searchParams.set('route', inp.value); try { history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (_) { /* no history */ } }); subs.add(upd); upd(); return s;
};

/** airports: look up a code, a city or a country. */
PANELS.airports = () => {
  const s = pane('Airport finder', 'airports'); s.insertAdjacentHTML('beforeend', '<div class="field"><label for="a-q">' + esc(t('City, airport name, country or code (IATA or ICAO)')) + '</label><input type="search" id="a-q" autocomplete="off" placeholder="lisbon, LHR, EGLL, japan"></div><p class="chips" id="a-tries"></p><p class="soft" id="a-help"></p><ul class="alist" id="a-list"></ul><div id="a-det"></div><details class="also" id="a-more"><summary></summary><p class="soft" id="a-more-t"></p></details><p class="row"><a class="btn" href="/flights/airports.json" download="airports.json" id="a-json"></a></p>');
  const q = $(s, '#a-q'), list = $(s, '#a-list'), det = $(s, '#a-det'); let picked = '', first = null, want = (new URLSearchParams(location.search).get('code') || '').toUpperCase();
  // wider use: examples to start from, keys, the codes to copy, the whole list to download, and the search or the airport kept in the link
  const tries = [['London', 'London'], ['Tokyo', 'Tokyo'], ['New York', 'New York'], ['JFK', 'JFK'], [t('Germany'), 'Germany']];
  $(s, '#a-tries').innerHTML = '<span class="soft">' + esc(t('Try an example:')) + '</span> ' + tries.map(([l, v]) => '<button type="button" class="chip" data-try="' + esc(v) + '">' + esc(l) + '</button>').join(' ') + ' <span class="soft">' + t('Press <kbd>/</kbd> to search, <kbd>Enter</kbd> to open the first result.') + '</span>';
  $(s, '#a-more summary').textContent = t('Advanced: codes and the data'); $(s, '#a-more-t').textContent = t('IATA codes (three letters, like LHR) are the ones on tickets and bag tags; ICAO codes (four letters, like EGLL) are the ones pilots and flight plans use. Both work in the search. The whole list is one file you can download and use offline.'); $(s, '#a-json').textContent = t('Download the airport list (JSON)');
  const link = (k, v) => { const u = new URL(location.href); for (const x of k === 'q' ? ['q', 'code'] : ['code']) u.searchParams.delete(x); if (v) u.searchParams.set(k, v); try { history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (_) { /* no history */ } };
  const q0 = new URLSearchParams(location.search).get('q'); if (q0) q.value = q0.slice(0, 80);
  $(s, '#a-tries').addEventListener('click', (e) => { const b = e.target.closest('button[data-try]'); if (!b) return; q.value = b.dataset.try; picked = ''; link('q', q.value); upd(); q.focus(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && first) { e.preventDefault(); detail(first); const h = $(det, 'h3'); if (h) { h.tabIndex = -1; h.focus(); } } });
  addEventListener('keydown', (e) => { if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return; const el = document.activeElement; if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return; e.preventDefault(); q.focus(); q.select(); });
  const codesText = (a) => a.iata + ' / ' + a.icao + ' · ' + a.name + ' · ' + a.city + ', ' + a.country + ' · ' + a.lat.toFixed(4) + ', ' + a.lon.toFixed(4) + ' · ' + a.tz + ' · ' + location.origin + '/flights/airports/?code=' + a.iata;
  det.addEventListener('click', async (e) => { const b = e.target.closest('button[data-copy]'); if (!b) return; const a = ap(b.dataset.copy); if (!a) return; const m = $(det, '#a-copymsg'); try { await navigator.clipboard.writeText(codesText(a)); m.textContent = t('Copied.'); } catch (_) { m.textContent = codesText(a); } }); $(s, '#a-help').textContent = t('Each airport shows its IATA and ICAO codes, city and country, its Position on a map, its time zone and the time there now, its size, other airports of the same city, Nearby airports, and a link to Fly from here or Fly to here.'); if (new URLSearchParams(location.search).get('code')) det.style.minHeight = '420px';
  const detail = (a) => {
    picked = a.iata; link('code', a.iata); const near = C.nearby(idx, a, 200, 6), same = C.sameCity(idx, a), now = nowLabel(a), off = C.offsetLabel(C.offsetMin(a.tz, Date.now()));
    det.innerHTML = '<div class="card"><h3>' + esc(a.name) + '</h3><dl class="dl"><div><dt>IATA</dt><dd>' + esc(a.iata) + '</dd></div><div><dt>ICAO</dt><dd>' + esc(a.icao) + '</dd></div><div><dt>' + esc(t('City')) + '</dt><dd>' + esc(a.city) + '</dd></div><div><dt>' + esc(t('Country')) + '</dt><dd>' + esc(a.country + ' (' + a.cc + ')') + '</dd></div><div><dt>' + esc(t('Position')) + '</dt><dd>' + esc(a.lat.toFixed(4) + ', ' + a.lon.toFixed(4)) + ' · <a href="https://www.openstreetmap.org/?mlat=' + a.lat + '&mlon=' + a.lon + '#map=12/' + a.lat + '/' + a.lon + '" target="_blank" rel="noopener noreferrer">' + esc(t('on a map')) + ' ↗</a></dd></div><div><dt>' + esc(t('Time zone')) + '</dt><dd>' + esc(a.tz + ' · ' + off + (now ? ' · ' + t('now') + ' ' + now : '') + (a.approx ? ' · ' + t('placed by position, may be an hour out') : '')) + '</dd></div><div><dt>' + esc(t('Size')) + '</dt><dd>' + esc(t(['small airport', 'medium airport', 'large airport'][a.size])) + '</dd></div></dl>'
      + (same.length ? '<p>' + esc(t('Other airports of the same city:')) + ' ' + same.map((x) => '<button type="button" class="chip" data-show="' + x.iata + '">' + esc(x.iata) + '</button>').join(' ') + '</p>' : '')
      + (near.length ? '<p>' + esc(t('Nearby airports:')) + ' ' + near.map((n) => '<button type="button" class="chip" data-show="' + n.a.iata + '">' + esc(n.a.iata + ' · ' + num(n.km) + ' km') + '</button>').join(' ') + '</p>' : '')
      + '<p class="row"><a class="btn" href="/flights/?from=' + a.iata + '">' + esc(t('Fly from here')) + '</a> <a class="btn" href="/flights/?to=' + a.iata + '">' + esc(t('Fly to here')) + '</a> <button type="button" data-copy="' + a.iata + '">' + esc(t('Copy the codes')) + '</button> <span class="live" id="a-copymsg" role="status"></span></p></div>';
  };
  det.addEventListener('click', (e) => { const b = e.target.closest('button[data-show]'); if (b) detail(ap(b.dataset.show)); });
  const upd = () => {
    if (!idx) return; const v = q.value.trim(); list.textContent = ''; first = null;
    let res = v ? C.searchAirports(idx, v, 12) : [];
    if (v && !res.length) { const f = (x) => C.fold_(x); const cc = idx.list.filter((a) => f(a.country) === f(v) || a.cc === v.toUpperCase()); res = cc.sort((x, y) => y.size - x.size).slice(0, 40); }
    if (!v) { const p = new URLSearchParams(location.search).get('code'); if (p && ap(p.toUpperCase())) { detail(ap(p.toUpperCase())); } return; }
    first = res[0] || null; for (const a of res) { const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.innerHTML = '<b>' + esc(a.iata) + '</b> / ' + esc(a.icao) + ' · ' + esc(a.city) + ' <span class="soft">' + esc(a.name) + ' · ' + esc(a.country) + '</span>'; b.addEventListener('click', () => detail(a)); li.append(b); list.append(li); }
    if (want && ap(want) && !picked) { const w = ap(want); want = ''; detail(w); } else if (v) want = '';
    if (!res.length) list.innerHTML = '<li class="soft">' + esc(t('No airport found.')) + '</li>'; else if (res.length === 1 || (picked && !res.some((r) => r.iata === picked))) detail(res[0]);
  };
  q.addEventListener('input', () => { picked = ''; link('q', q.value.trim()); upd(); }); subs.add(upd); upd(); return s;
};

/** routes: where a flight of a given length from here would land. */
PANELS.routes = () => {
  const s = pane('Where can I go?', 'routes'); s.insertAdjacentHTML('beforeend', '<div class="grid3"><div class="field"><label for="w-h">' + esc(t('Flight time up to')) + ': <output id="w-ho">4 h</output></label><input type="range" id="w-h" min="1" max="17" value="4"></div><div class="field"><label for="w-c">' + esc(t('Country')) + '</label><select id="w-c"><option value="">' + esc(t('Any country')) + '</option></select></div><label class="chk"><input type="checkbox" id="w-b" checked> ' + esc(t('Larger airports only')) + '</label><label class="chk"><input type="checkbox" id="w-n" checked> ' + esc(t('Only nonstop routes (as of June 2014)')) + '</label></div><p class="note" id="w-note"></p><ul class="alist" id="w-list"></ul><p class="note" id="w-credit"></p>');
  const h = $(s, '#w-h'), ho = $(s, '#w-ho'), c = $(s, '#w-c'), big = $(s, '#w-b'), non = $(s, '#w-n'), list = $(s, '#w-list'), note = $(s, '#w-note'); let filled = false, routes = null; note.style.minHeight = '5.5em'; if (state.from) list.style.minHeight = '600px';
  $(s, '#w-credit').textContent = t('Nonstop routes: OpenFlights (openflights.org/data), Open Database License (ODbL). Routes as of June 2014, may be out of date: check with the airline or a provider. The route file of this page (/flights/routes.json) is offered under the ODbL too.');
  fetch('/flights/routes.json').then((r) => r.json()).then((d) => { routes = d; upd(); }).catch(() => { routes = false; upd(); });
  const upd = () => {
    if (!idx) return; if (!filled) { filled = true; const seen = new Map(); for (const a of idx.list) seen.set(a.cc, a.country); for (const [k, v] of [...seen].sort((x, y) => x[1].localeCompare(y[1]))) c.insertAdjacentHTML('beforeend', '<option value="' + esc(k) + '">' + esc(v) + '</option>'); }
    ho.textContent = h.value + ' h'; list.textContent = ''; const a = ap(state.from);
    if (!a) { note.textContent = t('Pick the airport you leave from to see where a flight of that length would land, each with its distance in km and its flight time (like 1 h 05 min).'); return; }
    const res = C.reachable(idx, a, { maxMin: +h.value * 60, cc: c.value, big: big.checked, limit: 4000 }), rt = routes ? new Map(C.routesFrom(routes, a.iata).map((r) => [r.to, r.airlines])) : null;
    const shown = (non.checked && rt ? res.filter((r) => rt.has(r.a.iata)) : res).slice(0, 80);
    if (non.checked && rt) note.textContent = t('Airports with a nonstop route from') + ' ' + apName(a) + ' ' + t('in the June 2014 data, up to') + ' ' + h.value + ' h, ' + t('nearest first. Routes change: check with the airline or a provider before you plan on one.') + ' (' + shown.length + ' / ' + rt.size + ')';
    else note.textContent = t('Airports a flight from') + ' ' + apName(a) + ' ' + t('of up to') + ' ' + h.value + ' h ' + t('could reach, nearest first. This is range, not a timetable: whether an airline flies the route nonstop is shown by the providers, not here.') + ' (' + shown.length + ')' + (routes === null && non.checked ? ' · ' + t('The route list is still loading.') : '');
    for (const r of shown) { const li = document.createElement('li'), al = rt && rt.get(r.a.iata); li.innerHTML = '<a href="/flights/?from=' + a.iata + '&to=' + r.a.iata + '"><b>' + esc(r.a.iata) + '</b> ' + esc(r.a.city) + '</a> <span class="soft">' + esc(r.a.country + ' · ' + num(r.km) + ' km · ' + C.hm(r.minutes) + (al ? ' · ' + t('nonstop in 2014') + (al.length ? ': ' + al.slice(0, 6).join(', ') + (al.length > 6 ? ' +' + (al.length - 6) : '') : '') : '')) + '</span>'; list.append(li); }
  };
  for (const i of [h, c, big, non]) i.addEventListener('input', upd); subs.add(upd); upd(); return s;
};

// ---------- the price log ----------
PANELS.tracker = () => {
  const s = pane('Price tracker', 'tracker');
  s.insertAdjacentHTML('beforeend', '<p class="note">' + esc(t('Write down the fares you see on the providers: this page keeps them on this device, shows the lowest you saw and a chart, and tells you when a fare reaches your target while this tab is open. Nothing is sent anywhere.')) + '</p>'
    + '<div class="grid3"><div class="field"><label for="p-route">' + esc(t('Route')) + '</label><input type="text" id="p-route" placeholder="JFK-LIS" autocomplete="off"></div><div class="field"><label for="p-date">' + esc(t('Travel date')) + '</label><input type="date" id="p-date"></div><div class="field"><label for="p-price">' + esc(t('Price')) + '</label><input type="number" id="p-price" min="1" step="0.01" inputmode="decimal"></div><div class="field"><label for="p-cur">' + esc(t('Currency')) + '</label><input type="text" id="p-cur" value="EUR" maxlength="3"></div><div class="field"><label for="p-src">' + esc(t('Seen on')) + '</label><select id="p-src"><option>Google Flights</option><option>Skyscanner</option><option>Kayak</option><option>Momondo</option><option>Expedia</option><option>' + esc(t('Airline site')) + '</option></select></div><div class="field"><label for="p-note">' + esc(t('Note')) + '</label><input type="text" id="p-note" maxlength="120"></div></div>'
    + '<div class="row"><button type="button" class="go" id="p-add">' + esc(t('Add this fare')) + '</button></div><p class="live" id="p-msg" role="status"></p><p class="live ok" id="p-alert" role="status"></p><div id="p-sum"></div><div class="chart" id="p-chart"></div>'
    + '<h3>' + esc(t('Watch a route')) + '</h3><div class="grid3"><div class="field"><label for="w-route">' + esc(t('Route')) + '</label><input type="text" id="w-route" placeholder="JFK-LIS" autocomplete="off"></div><div class="field"><label for="w-target">' + esc(t('Tell me at or under')) + '</label><input type="number" id="w-target" min="1" step="0.01" inputmode="decimal"></div><div class="field"><label for="w-cur">' + esc(t('Currency')) + '</label><input type="text" id="w-cur" value="EUR" maxlength="3"></div></div><div class="row"><button type="button" id="w-add">' + esc(t('Watch it')) + '</button> <button type="button" id="w-note">' + esc(t('Allow notifications')) + '</button></div><ul id="w-list" class="plain"></ul>'
    + '<h3>' + esc(t('Your fares')) + '</h3><div class="tablewrap"><table class="tbl" id="p-tbl"><thead><tr><th>' + esc(t('Route')) + '</th><th>' + esc(t('Travel date')) + '</th><th>' + esc(t('Price')) + '</th><th>' + esc(t('Seen on')) + '</th><th>' + esc(t('Seen')) + '</th><th></th></tr></thead><tbody></tbody></table></div>'
    + '<div class="row"><button type="button" id="p-exp">' + esc(t('Export CSV')) + '</button> <label class="btn" for="p-imp">' + esc(t('Import CSV')) + '</label><input type="file" id="p-imp" accept=".csv,text/csv" class="pick"></div>');
  let fares = (mem().fares || []).map(C.cleanFare).filter(Boolean), watches = (mem().watches || []).filter((w) => w && /^[A-Z]{3}-[A-Z]{3}$/.test(w.route) && w.target > 0);
  const save = () => keep({ fares: fares.slice(-1000), watches: watches.slice(0, 50) }), msg = $(s, '#p-msg'), say = (m) => { msg.textContent = m; };
  const route = $(s, '#p-route'), wroute = $(s, '#w-route');
  const alertMet = () => { $(s, '#p-alert').textContent = ''; for (const m of C.metWatches(watches, fares)) { $(s, '#p-alert').textContent += m.watch.route + ': ' + t('your target is met') + ' (' + m.fare.price + ' ' + m.fare.cur + ' ≤ ' + m.watch.target + ')'; try { if ('Notification' in window && Notification.permission === 'granted' && !m.watch.told) { new Notification('Verse · ' + m.watch.route, { body: m.fare.price + ' ' + m.fare.cur + ' ≤ ' + m.watch.target }); m.watch.told = Date.now(); save(); } } catch (_) { /* no notifications here */ } } };
  const draw = () => {
    const sum = C.routeSummary(fares); $(s, '#p-sum').innerHTML = sum.length ? '<table class="tbl"><thead><tr><th>' + esc(t('Route')) + '</th><th>' + esc(t('Lowest seen')) + '</th><th>' + esc(t('Latest')) + '</th><th>n</th></tr></thead><tbody>' + sum.map((r) => '<tr><td><button type="button" class="chip" data-route="' + r.route + '">' + esc(r.route) + '</button></td><td><b>' + esc(r.low.price + ' ' + r.cur) + '</b>' + (r.low.date ? ' · ' + esc(r.low.date) : '') + '</td><td>' + esc(r.last.price + ' ' + r.cur) + (r.change ? ' <span class="' + (r.change < 0 ? 'ok' : 'bad') + '">' + (r.change < 0 ? '▼' : '▲') + esc(Math.abs(r.change).toFixed(0)) + '</span>' : '') + '</td><td>' + r.n + '</td></tr>').join('') + '</tbody></table>' : '<p class="soft">' + esc(t('No fares yet. Add the first one above.')) + '</p>';
    const tb = $(s, '#p-tbl tbody'); tb.textContent = '';
    for (const f of fares.slice().sort((a, b) => b.seen.localeCompare(a.seen)).slice(0, 60)) { const tr = document.createElement('tr'); tr.innerHTML = '<td>' + esc(f.route) + '</td><td>' + esc(f.date) + '</td><td>' + esc(f.price + ' ' + f.cur) + '</td><td>' + esc(f.src) + '</td><td>' + esc(f.seen.replace('T', ' ')) + '</td><td><button type="button" data-del="' + esc(f.id) + '" aria-label="' + esc(t('Delete this fare')) + '">×</button></td>'; tb.append(tr); }
    const shown = route.value.trim().toUpperCase().replace(/\s+/g, '-') || (sum[0] && sum[0].route), rows = fares.filter((f) => f.route === shown); $(s, '#p-chart').innerHTML = C.chartSvg(rows);
    const wl = $(s, '#w-list'); wl.textContent = ''; watches.forEach((w, i) => { const li = document.createElement('li'); li.innerHTML = esc(w.route + ' ≤ ' + w.target + ' ' + w.cur) + ' <button type="button" data-wdel="' + i + '" aria-label="' + esc(t('Stop watching')) + '">×</button>'; wl.append(li); });
  };
  const fill = () => { if (!route.value && state.from && state.to) route.value = state.from + '-' + state.to; if (!wroute.value && state.from && state.to) wroute.value = state.from + '-' + state.to; if (!$(s, '#p-date').value && state.depart) $(s, '#p-date').value = state.depart; };
  $(s, '#p-add').addEventListener('click', () => {
    const f = C.cleanFare({ route: route.value, date: $(s, '#p-date').value, price: $(s, '#p-price').value, cur: $(s, '#p-cur').value, src: $(s, '#p-src').value, note: $(s, '#p-note').value, seen: new Date().toISOString() });
    if (!f) { say(t('Write the route like JFK-LIS and a price above zero.')); return; } fares.push(f); save(); say(t('Added.') + ' ' + f.route + ' ' + f.price + ' ' + f.cur); $(s, '#p-price').value = ''; draw(); alertMet();
  });
  s.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]'); if (d) { fares = fares.filter((f) => f.id !== d.dataset.del); save(); draw(); return; }
    const w = e.target.closest('[data-wdel]'); if (w) { watches.splice(+w.dataset.wdel, 1); save(); draw(); return; }
    const r = e.target.closest('[data-route]'); if (r) { route.value = r.dataset.route; draw(); }
  });
  route.addEventListener('input', draw);
  $(s, '#w-add').addEventListener('click', () => { const m = /^([A-Za-z]{3})\s*[-–> ]+\s*([A-Za-z]{3})$/.exec(wroute.value.trim()), target = parseFloat($(s, '#w-target').value); if (!m || !(target > 0)) { say(t('Write the route like JFK-LIS and a target above zero.')); return; } watches.push({ route: m[1].toUpperCase() + '-' + m[2].toUpperCase(), target, cur: ($(s, '#w-cur').value || 'EUR').toUpperCase().slice(0, 3) }); save(); say(t('Watching.')); draw(); alertMet(); });
  $(s, '#w-note').addEventListener('click', async () => { try { const r = await Notification.requestPermission(); say(r === 'granted' ? t('Notifications are on while this tab is open.') : t('Notifications are off.')); } catch (_) { say(t('This browser cannot show notifications.')); } });
  $(s, '#p-exp').addEventListener('click', () => { const b = new Blob([C.faresToCsv(fares)], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'verse-fares.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  $(s, '#p-imp').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; const rows = C.faresFromCsv(await f.text()); const have = new Set(fares.map((x) => x.route + x.date + x.price + x.seen)); let n = 0; for (const r of rows) if (!have.has(r.route + r.date + r.price + r.seen)) { fares.push(r); n++; } save(); say(t('Imported') + ' ' + n + ' ' + t('fares') + '.'); draw(); alertMet(); e.target.value = ''; });
  subs.add(fill); fill(); draw(); alertMet(); return s;
};

// ---------- itineraries ----------
PANELS.trip = () => {
  const s = pane('Trip and layovers', 'trip');
  s.insertAdjacentHTML('beforeend', '<p class="note">' + esc(t('Paste a booking confirmation and the flights are read out of it, or add each flight by hand. Times are the airport’s own clock; the page works out the waits between flights across time zones. Kept on this device.')) + '</p>'
    + '<div class="field"><label for="i-paste">' + esc(t('Paste a confirmation text')) + '</label><textarea id="i-paste" rows="5" placeholder="Booking reference: ABC123&#10;12 Dec 2026&#10;BA 117 London (LHR) 18:25 → New York (JFK) 21:05"></textarea></div><div class="row"><button type="button" class="go" id="i-read">' + esc(t('Read the flights')) + '</button> <button type="button" id="i-add">' + esc(t('Add a flight by hand')) + '</button></div><p class="live" id="i-msg" role="status"></p>'
    + '<p class="soft" id="i-help"></p><div id="i-segs"></div><div id="i-lay"></div><div id="i-sum"></div><div class="row"><button type="button" id="i-ics">' + esc(t('Download for my calendar (.ics)')) + '</button> <button type="button" id="i-link">' + esc(t('Copy a link to this trip')) + '</button> <button type="button" id="i-clear">' + esc(t('Clear the trip')) + '</button></div>');
  const msg = $(s, '#i-msg'), say = (m) => { msg.textContent = m; }; let segs = (mem().trip || []).map(C.cleanSeg).filter(Boolean);
  const tok = (location.hash.match(/trip=([A-Za-z0-9_-]+)/) || [])[1]; let fromLink = 0;
  const save = () => keep({ trip: segs.slice(0, 30) }); $(s, '#i-help').textContent = t('Each flight gets its Departs (local) and Arrives (local) times on the airport’s own clock; between two flights a line like Wait: 1 h 20 min shows the layover, with a warning when it is tight, overnight or at another airport.');
  const draw = () => {
    const box = $(s, '#i-segs'); box.textContent = '';
    segs.forEach((g, i) => { const d = document.createElement('div'); d.className = 'seg'; d.dataset.i = i;
      d.innerHTML = '<div class="grid4"><div class="field"><label>' + esc(t('Airline')) + '</label><input data-k="al" value="' + esc(g.al) + '" maxlength="3"></div><div class="field"><label>' + esc(t('Number')) + '</label><input data-k="no" value="' + esc(g.no) + '" maxlength="4" inputmode="numeric"></div><div class="field"><label>' + esc(t('From')) + '</label><input data-k="from" value="' + esc(g.from) + '" maxlength="3"></div><div class="field"><label>' + esc(t('To')) + '</label><input data-k="to" value="' + esc(g.to) + '" maxlength="3"></div><div class="field"><label>' + esc(t('Departs (local)')) + '</label><input type="datetime-local" data-k="dep" value="' + esc(g.dep) + '"></div><div class="field"><label>' + esc(t('Arrives (local)')) + '</label><input type="datetime-local" data-k="arr" value="' + esc(g.arr) + '"></div><div class="field"><label>' + esc(t('Booking reference')) + '</label><input data-k="loc" value="' + esc(g.loc) + '" maxlength="8"></div><div class="field"><label>' + esc(t('Note')) + '</label><input data-k="note" value="' + esc(g.note) + '" maxlength="120"></div></div><button type="button" data-rm="' + i + '" aria-label="' + esc(t('Remove this flight')) + '">× ' + esc(t('Remove')) + '</button>';
      box.append(d); });
    const L = idx ? C.layovers(idx, segs) : { gaps: [], single: [], sorted: [] }, lay = $(s, '#i-lay'); lay.textContent = '';
    const words = { overlap: 'The next flight leaves before this one lands.', 'too-short': 'Under 45 minutes: very likely too short to connect.', tight: 'Under an hour: tight, especially with a bag check or a terminal change.', long: 'A long wait (8 hours or more).', overnight: 'An overnight wait.', 'airport-change': 'You land at a different airport of the same city and take off from another.', 'route-break': 'The next flight leaves from another place than where you land.', 'airport-change-short': 'Changing airports in under 4 hours is risky.', stay: 'A stay, not a connection.', unknown: 'Fill in both airports and times to check this wait.' };
    if (L.sorted.length) lay.innerHTML = '<h3>' + esc(t('Your flights in order')) + '</h3><ol class="plain">' + L.sorted.map((g, i) => { const tm = C.segTimes(idx, g), dur = Number.isFinite(tm.minutes) ? ' · ' + C.hm(tm.minutes) : ''; const gap = L.gaps[i]; return '<li><b>' + esc((g.al + ' ' + g.no).trim()) + '</b> ' + esc(g.from + ' ' + (g.dep ? g.dep.slice(11) : '') + ' → ' + g.to + ' ' + (g.arr ? g.arr.slice(11) : '')) + ' <span class="soft">' + esc((g.dep || '').slice(0, 10) + dur) + '</span>' + (L.single.filter((x) => x.seg.id === g.id).map((x) => '<div class="warn">' + esc(t(x.kind === 'lands-before-leaving' ? 'This flight lands before it leaves: check the times and the airports.' : 'This flight is longer than a day: check the times.')) + '</div>').join('')) + '</li>' + (gap ? '<li class="gap">' + esc(t('Wait') + ': ' + (Number.isFinite(gap.minutes) ? C.hm(gap.minutes) : '?')) + gap.notes.map((n) => '<div class="warn">' + esc(t(words[n.kind] || n.kind)) + (n.km && n.kind.startsWith('airport') ? ' ' + esc(num(n.km) + ' km') : '') + '</div>').join('') + '</li>' : ''); }).join('') + '</ol>';
    const first = L.sorted[0], last = L.sorted[L.sorted.length - 1];
    if (first && last && idx) { const a = C.segTimes(idx, first), b = C.segTimes(idx, last); $(s, '#i-sum').innerHTML = Number.isFinite(a.depUtc) && Number.isFinite(b.arrUtc) ? '<p class="note">' + esc(L.sorted.length + ' ' + t(L.sorted.length === 1 ? 'flight' : 'flights') + ' · ' + t('from the first departure to the last arrival') + ': ' + C.hm((b.arrUtc - a.depUtc) / 60000)) + '</p>' : ''; } else $(s, '#i-sum').textContent = '';
  };
  s.addEventListener('change', (e) => { const i = e.target.closest('.seg'); if (!i) return; const g = segs[+i.dataset.i]; g[e.target.dataset.k] = e.target.value; segs[+i.dataset.i] = C.cleanSeg(g) || g; save(); draw(); });
  s.addEventListener('click', (e) => { const r = e.target.closest('[data-rm]'); if (r) { segs.splice(+r.dataset.rm, 1); save(); draw(); } });
  $(s, '#i-read').addEventListener('click', () => { if (!idx) { say(t('The airport list is still loading.')); return; } const r = C.parseItinerary($(s, '#i-paste').value, idx); if (!r.segments.length) { say(t('No flight found in that text. Add it by hand below.')); return; } segs = segs.concat(r.segments.map(C.cleanSeg)); save(); draw(); const miss = r.segments.filter((g) => !g.from || !g.to || !g.dep || !g.arr).length; say(r.segments.length + ' ' + t(r.segments.length === 1 ? 'flight read' : 'flights read') + (r.locator ? ' · ' + t('booking reference') + ' ' + r.locator : '') + (miss ? ' · ' + miss + ' ' + t('need a check: fill what is empty') : '')); });
  $(s, '#i-add').addEventListener('click', () => { segs.push(C.cleanSeg({ from: state.from, to: state.to, dep: state.depart ? state.depart + 'T09:00' : '' })); save(); draw(); });
  $(s, '#i-clear').addEventListener('click', () => { segs = []; save(); say(t('Cleared.')); draw(); });
  $(s, '#i-ics').addEventListener('click', () => { const txt = idx && C.tripIcs(idx, segs); if (!txt) { say(t('Fill in the airports and both times of a flight first.')); return; } const b = new Blob([txt], { type: 'text/calendar' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'verse-trip.ics'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); say(t('Saved a calendar file.')); });
  $(s, '#i-link').addEventListener('click', async () => { if (!segs.length) { say(t('Add a flight first.')); return; } const url = location.origin + location.pathname + '#trip=' + C.tripToToken(segs); try { if (navigator.share) { await navigator.share({ title: 'Trip', url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(url); say(t('Copied the link.')); } catch (_) { say(url); } });
  if (tok) { const got = C.tripFromToken(tok); if (got.length) { segs = got; fromLink = got.length; } }
  subs.add(draw); draw(); if (fromLink) say(t('This trip came from a link. It is shown here and kept on this device once you change it.')); return s;
};

// ---------- the page ----------
function loadIndex() {
  return fetch('/flights/airports.json').then((r) => r.json()).then((d) => { idx = C.makeIndex(d); document.documentElement.dataset.flightsReady = '1'; for (const k of ['from', 'to']) { const w = state[k + 'q']; if (w) { const r = C.searchAirports(idx, w, 1)[0]; if (r) state[k] = r.iata; state[k + 'q'] = ''; } } if (state.from || state.to) emit(); for (const f of subs) f(); }).catch(() => { const n = document.getElementById('fl-err'); if (n) n.hidden = false; });
}
// the page keeps itself, its code and the airport list in the service worker's cache (sw.js CACHE, 'void-shell-v2': keep the two names the same), so a reload with the
// network cut shows the whole page even when the worker took over a moment ago and has not fetched the page yet (the worker answers a page from this cache by its path)
const SW_CACHE = 'void-shell-v2';
function keepForOffline() {
  try {
    if (!('caches' in window)) return; const app = location.pathname + 'app.js';
    caches.open(SW_CACHE).then((c) => Promise.all([location.pathname, app, '/lib/flights-ui.js', '/lib/flights-core.js', '/lib/flights-de.js', '/lib/flights-coast.js', '/lib/ics.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/flight-sites.js', '/flights/airports.json'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {});
  } catch (_) { /* no cache here: the page still works online */ }
}
/** mounts the panels a page asks for into root: { panels: [...], controls: [...], share: true }. */
export function mountFlights(root, cfg = {}) {
  readState(); root.textContent = '';
  const err = document.createElement('p'); err.id = 'fl-err'; err.className = 'bad'; err.hidden = true; err.textContent = t('The airport list could not be loaded. Reload the page.');
  root.append(err);
  if (cfg.notice !== false) { const n = document.createElement('p'); n.className = 'notice'; n.textContent = t('Verse has no live fares: the prices are on the providers, and this page opens your search there. Everything else is worked out on your device.'); root.append(n); }
  for (const p of cfg.panels || ['controls', 'providers', 'facts']) if (PANELS[p]) root.append(PANELS[p](cfg));
  const foot = document.createElement('div'); foot.className = 'row'; foot.innerHTML = '<button type="button" id="fl-share">' + esc(t('Share link')) + '</button> <span class="live" id="fl-sharemsg" role="status"></span>'; root.append(foot);
  $(foot, '#fl-share').addEventListener('click', async () => { const url = location.href.replace(/#.*$/, ''); try { if (navigator.share) { await navigator.share({ title: document.title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(url); $(foot, '#fl-sharemsg').textContent = t('Copied the link.'); } catch (_) { $(foot, '#fl-sharemsg').textContent = url; } });
  const credit = document.createElement('p'); credit.className = 'note'; credit.innerHTML = esc(t('Airport data: OurAirports (public domain), ourairports.com/data. Time zones are placed by country, region and position.')); root.append(credit);
  if (isDe()) { document.documentElement.lang = 'de'; if (cfg.de) { const h = document.querySelector('h1'), p = document.querySelector('.intro'); if (h && cfg.de.h1) h.textContent = cfg.de.h1; if (p && cfg.de.intro) p.textContent = cfg.de.intro; if (cfg.de.h1) document.title = cfg.de.h1 + ' · Verse'; } }
  const done = loadIndex();
  keepForOffline();
  return done;
}
