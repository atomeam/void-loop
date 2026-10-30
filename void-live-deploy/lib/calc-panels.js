/**
 * calc-panels: the loan, mortgage, compound interest, percentage, BMI and calorie calculators on /calculator/ (the tower's calculator.net floor),
 * wired to the panels in the page's HTML after its load event. Each panel answers as you type, keeps its numbers on this device, and opens from
 * a link (/calculator/#loan). The arithmetic is lib/fincalc.js; the charts are plain SVG drawn here.
 */
import { amortize, yearsMonths, mortgage, compound, percentOf, whatPercent, change, bmi, bmiBand, healthyRange, bmr, calories, goals, ACTIVITY } from './fincalc.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.void.calculator.panels.v1';
const money = (v) => (v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const plain = (v, d = 2) => (v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('en', { maximumFractionDigits: d }));
const val = (id) => { const t = String($(id).value).replace(/[,\s]/g, ''); return t === '' ? null : Number(t); };
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };

/** yearly stacked bars (two parts) with an optional line, as an SVG string-free element: bars[i] = [a, b], line[i] a value. */
function chart(box, bars, line, labels, colors) {
  const NS = 'http://www.w3.org/2000/svg', W = 600, H = 220, padL = 52, padB = 22, n = bars.length, top = Math.max(1, ...bars.map(([a, b]) => a + b), ...(line || []));
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', labels.title);
  const add = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); svg.append(e); return e; };
  const x = (i) => padL + ((W - padL - 8) * i) / n, y = (v) => H - padB - ((H - padB - 10) * v) / top, bw = Math.max(1, (W - padL - 8) / n - 2);
  for (const f of [0, 0.5, 1]) { add('line', { x1: padL, x2: W - 8, y1: y(top * f), y2: y(top * f), stroke: 'currentColor', 'stroke-opacity': 0.15 }); const t = add('text', { x: padL - 6, y: y(top * f) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'currentColor' }); t.textContent = top * f >= 1000 ? Math.round(top * f / 1000).toLocaleString('en') + 'k' : Math.round(top * f).toLocaleString('en'); }
  bars.forEach(([a, b], i) => { add('rect', { x: x(i) + 1, y: y(a), width: bw, height: Math.max(0, y(0) - y(a)), fill: colors[0] }); add('rect', { x: x(i) + 1, y: y(a + b), width: bw, height: Math.max(0, y(a) - y(a + b)), fill: colors[1] }); });
  if (line) add('polyline', { points: line.map((v, i) => (x(i) + 1 + bw / 2) + ',' + y(v)).join(' '), fill: 'none', stroke: colors[2], 'stroke-width': 2.5 });
  for (const i of [0, Math.floor((n - 1) / 2), n - 1]) if (n && i >= 0) { const t = add('text', { x: x(i) + 1 + bw / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }); t.textContent = 'Year ' + (i + 1); }
  const key = el('p', null, 'key'); labels.keys.forEach((k, i) => { const s = el('span', k); s.style.setProperty('--c', colors[i]); key.append(s); });
  box.replaceChildren(svg, key);
}
function table(box, head, rows) {
  const t = el('table'), th = el('tr'); for (const h of head) th.append(el('th', h)); const thead = el('thead'); thead.append(th); const tb = el('tbody');
  for (const r of rows) { const tr = el('tr'); for (const c of r) tr.append(el('td', c)); tb.append(tr); } t.append(thead, tb); box.replaceChildren(t);
}
const lines = (box, rows) => box.replaceChildren(...rows.map(([k, v, big]) => { const p = el('p', null, big ? 'big' : ''); p.append(el('span', k + ' '), el('b', v)); return p; }));

const C = ['#6d4aff', '#f29e4c', '#1f8a4c'];
function loan() {
  const a = amortize(val('la'), val('lr'), Math.round((val('ly') || 0) * 12), val('lx') || 0);
  if (!a) { lines($('lout'), [['Fill in the amount, the rate and the years.', '']]); $('lchart').replaceChildren(); $('ltable').replaceChildren(); return; }
  lines($('lout'), [['Monthly payment', money(a.pay), true], ['Total interest', money(a.totalInterest)], ['Total paid', money(a.totalPaid)], ['Paid off in', yearsMonths(a.payoffMonths)]]);
  chart($('lchart'), a.years.map((y) => [y.principal, y.interest]), a.years.map((y) => y.balance), { title: 'Each year of the loan: principal and interest paid, and the balance left', keys: ['Principal', 'Interest', 'Balance'] }, C);
  table($('ltable'), ['Year', 'Interest', 'Principal', 'Balance'], a.years.map((y) => [String(y.year), money(y.interest), money(y.principal), money(y.balance)]));
  $('lmonths').onclick = () => table($('ltable'), ['Month', 'Payment', 'Interest', 'Principal', 'Balance'], a.months.map((m) => [String(m.n), money(m.pay), money(m.interest), money(m.principal), money(m.balance)]));
}
function home() {
  const m = mortgage({ price: val('mp'), downPct: val('md'), ratePct: val('mr'), years: val('my'), taxYear: val('mt'), insYear: val('mi'), hoa: val('mh') });
  if (!m || !(m.loan > 0)) { lines($('mout'), [['Fill in the price, the down payment, the rate and the years.', '']]); $('mchart').replaceChildren(); return; }
  lines($('mout'), [['Monthly, all in', money(m.monthly), true], ['Loan payment', money(m.pay)], ['Property tax', money(m.tax)], ['Insurance', money(m.ins)], ['HOA', money(m.hoa)], ['Loan', money(m.loan) + ' (down ' + money(m.down) + ')'], ['Total interest', money(m.totalInterest)]]);
  chart($('mchart'), m.years.map((y) => [y.principal, y.interest]), m.years.map((y) => y.balance), { title: 'Each year of the mortgage: principal and interest paid, and the balance left', keys: ['Principal', 'Interest', 'Balance'] }, C);
}
function grow() {
  const c = compound({ principal: val('cp') || 0, monthly: val('cm') || 0, ratePct: val('cr') || 0, years: val('cy') || 0, per: +$('ck').value });
  if (!c.years.length) { lines($('cout'), [['Fill in the years.', '']]); $('cchart').replaceChildren(); $('ctable').replaceChildren(); return; }
  lines($('cout'), [['Final balance', money(c.final), true], ['You put in', money(c.contributed)], ['Interest earned', money(c.interest)]]);
  chart($('cchart'), c.years.map((y) => [y.contributed, y.interest]), null, { title: 'Each year: what you put in and the interest it has earned', keys: ['Put in', 'Interest'] }, C);
  table($('ctable'), ['Year', 'Put in', 'Interest', 'Balance'], c.years.map((y) => [String(y.year), money(y.contributed), money(y.interest), money(y.balance)]));
}
function pct() {
  const a = val('p1'), b = val('p2'), c = val('p3'), d = val('p4'), e = val('p5'), f = val('p6');
  $('pa').textContent = a === null || b === null ? '' : '= ' + plain(percentOf(a, b), 6);
  $('pb').textContent = c === null || d === null ? '' : '= ' + plain(whatPercent(c, d), 6) + ' %';
  const ch = e === null || f === null ? null : change(e, f); $('pc').textContent = ch === null ? '' : '= ' + (ch > 0 ? '+' : '') + plain(ch, 6) + ' % (' + (ch >= 0 ? 'an increase' : 'a decrease') + ')';
}
const cmOf = () => ($('bu').value === 'metric' ? val('bh') : ((val('bft') || 0) * 12 + (val('bin') || 0)) * 2.54);
const kgOf = () => ($('bu').value === 'metric' ? val('bw') : (val('bw') || 0) * 0.45359237);
function body() {
  const metric = $('bu').value === 'metric'; for (const e of document.querySelectorAll('.imperial')) e.hidden = metric; for (const e of document.querySelectorAll('.metric')) e.hidden = !metric;
  $('bwl').firstChild.textContent = metric ? 'Weight (kg) ' : 'Weight (lb) ';
  const cm = cmOf(), kg = kgOf(), v = bmi(kg, cm), [lo, hi] = healthyRange(cm), show = (k) => (metric ? plain(k, 1) + ' kg' : plain(k / 0.45359237, 1) + ' lb');
  lines($('bout'), v === null ? [['Fill in your height and weight.', '']] : [['BMI', plain(v, 1), true], ['That is', bmiBand(v)], ['A healthy weight at this height', show(lo) + ' to ' + show(hi)]]);
  const rest = bmr({ sex: $('bs').value, kg, cm, age: val('ba') }), keep = calories(rest, $('bact').value);
  lines($('kout'), rest === null ? [['Fill in your age, height and weight.', '']] : [['Resting (BMR)', plain(rest, 0) + ' kcal a day'], ...goals(keep).map(([k, x], i) => [k, plain(Math.max(0, x), 0) + ' kcal a day', i === 0])]);
}

export function mount() {
  $('bact').replaceChildren(...ACTIVITY.map(([t, f], i) => { const o = el('option', t); o.value = String(f); if (i === 2) o.selected = true; return o; }));
  let kept = {}; try { kept = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
  const fields = [...document.querySelectorAll('#more input, #more select')];
  for (const f of fields) if (f.id && kept[f.id] != null && f.id !== 'bact') f.value = kept[f.id]; if (kept.bact) $('bact').value = kept.bact;
  const all = () => { loan(); home(); grow(); pct(); body(); try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(fields.filter((f) => f.id).map((f) => [f.id, f.value])))); } catch (_) {} };
  for (const f of fields) f.addEventListener('input', all);
  all();
  // a link to a panel opens it: /calculator/#loan, #mortgage, #compound, #percent, #bmi, #calories
  const openHash = () => { const d = document.getElementById('c-' + location.hash.slice(1)); if (d && d.tagName === 'DETAILS') { d.open = true; d.scrollIntoView({ block: 'start' }); } };
  addEventListener('hashchange', openHash); openHash();
}
