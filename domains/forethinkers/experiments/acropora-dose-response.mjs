// Refits the 2023 Florida Acropora heat-dose mortality curves from the open data of
// Manzello, Cunning et al., Science 390:361-366 (23 Oct 2025), doi:10.1126/science.adx7825
// (data: github.com/jrcunning/FLAcro23, zenodo 10.5281/zenodo.15701619), using the paper's
// model: two-parameter log-logistic (min 0, max 1), binomial weights = colonies counted,
// dose = cumulative max DHW. Then reads the 2026 peak DHW for each station in
// florida-heat-dose-2023-2026.csv and prints the mortality a 2023-type Florida colony
// would be expected to show at that dose (the Florida-only baseline for the 2026 trials).
// Usage: node acropora-dose-response.mjs [bootstrapReps]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const csv = (f) => { const [h, ...r] = readFileSync(join(here, f), 'utf8').trim().split('\n'); const k = h.split(','); return r.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v]))); };
const rows = csv('flacro23-mortality-2023.csv').map((r) => ({ sp: r.species, type: r.coral_type, x: +r.cummaxdhw, n: +r.n_total, p: +r.pct_mort })).filter((r) => r.x > 0 && r.n > 0);
const f = (x, b, e) => 1 / (1 + Math.exp(b * (Math.log(x) - Math.log(e))));
function nll(d, b, e) { let s = 0; for (const r of d) { const q = Math.min(1 - 1e-9, Math.max(1e-9, f(r.x, b, e))); s -= r.n * (r.p * Math.log(q) + (1 - r.p) * Math.log(1 - q)); } return s; }
function fit(d) { // Nelder-Mead on (b, log e)
  let pts = [[-3, Math.log(9)], [-5, Math.log(9)], [-3, Math.log(13)]];
  const F = (v) => nll(d, v[0], Math.exp(v[1]));
  for (let it = 0; it < 600; it++) {
    pts.sort((a, c) => F(a) - F(c));
    const c = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    const w = pts[2], r = [2 * c[0] - w[0], 2 * c[1] - w[1]];
    if (F(r) < F(pts[0])) { const ex = [3 * c[0] - 2 * w[0], 3 * c[1] - 2 * w[1]]; pts[2] = F(ex) < F(r) ? ex : r; }
    else if (F(r) < F(pts[1])) pts[2] = r;
    else { const k = [(c[0] + w[0]) / 2, (c[1] + w[1]) / 2]; if (F(k) < F(w)) pts[2] = k; else pts = [pts[0], ...pts.slice(1).map((p) => [(p[0] + pts[0][0]) / 2, (p[1] + pts[0][1]) / 2])]; }
  }
  pts.sort((a, c) => F(a) - F(c)); return { b: pts[0][0], e: Math.exp(pts[0][1]) };
}
const ed = (m, q) => m.e * Math.pow(q / (1 - q), -1 / m.b); // dose giving mortality q
const reps = +(process.argv[2] ?? 1000);
let seed = 20261112; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); // privacy:ok, the constants of a seeded random number generator
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const heat = csv('florida-heat-dose-2023-2026.csv').filter((r) => r.year === '2026');
const groups = [['APAL', null], ['ACER', null], ['APAL', 'Outplant'], ['ACER', 'Outplant'], ['APAL', 'Wild']];
console.log('group,n_rows,colonies,ED50,ED50_lo,ED50_hi,ED95,' + heat.map((h) => `mort@${h.station.replace(/ /g, '_')}_${(+h.peak_dhw).toFixed(2)}`).join(','));
for (const [sp, type] of groups) {
  const d = rows.filter((r) => r.sp === sp && (!type || r.type === type));
  const m = fit(d);
  const boots = []; for (let i = 0; i < reps; i++) { const s = d.map(() => d[Math.floor(rnd() * d.length)]); boots.push(fit(s)); }
  const e50 = boots.map((x) => ed(x, 0.5));
  const preds = heat.map((h) => { const x = +h.peak_dhw; const bp = boots.map((bm) => f(x, bm.b, bm.e)); return `${(100 * f(x, m.b, m.e)).toFixed(0)}% [${(100 * q(bp, 0.025)).toFixed(0)}-${(100 * q(bp, 0.975)).toFixed(0)}]`; });
  console.log([`${sp}${type ? ' ' + type : ''}`, d.length, d.reduce((s, r) => s + r.n, 0), ed(m, 0.5).toFixed(1), q(e50, 0.025).toFixed(1), q(e50, 0.975).toFixed(1), ed(m, 0.95).toFixed(1), ...preds].join(','));
}
