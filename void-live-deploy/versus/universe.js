// The owner's Versus card, beyond websites (owner, 2026-11-19: "games and everything else in the universe goes on the versus tower"). Loaded by
// versus/card.js for the owner only (lib/owner-gate.js); it reads tower.universe.json, which names what each target is measured against.
// Plain words, the category always shown. Pure except load().
import { rowOf, readChecks, gapsOf, sidesOf, closeness, climbOrder, categories, kindOf, SIDES } from '../lib/universe.js';

const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };
/** the universe file for the owner, or null. */
export const load = () => get('/tower.universe.json');

/** the model the card draws: every target as a row, the mixed climb (sites and targets, closest first), the categories. Pure. */
export function modelOf(data, floors = [], today = new Date().toISOString().slice(0, 10)) {
  const targets = (data && data.targets) || [];
  const rest = new Set(Object.entries((data && data.rest) || {}).filter(([, at]) => (Date.parse(today) - Date.parse(at)) / 864e5 < 14).map(([id]) => id));
  const rows = targets.map((t) => ({ ...rowOf(t), t, resting: rest.has(t.id) }));
  const sites = floors.filter((f) => !f.farFuture && !f.defer && (f.state === 'current' || f.state === 'ahead' || f.beaten)).map((f) => ({ id: f.id, kind: 'website', assim: Number.isFinite(+f.assim) ? +f.assim : 0, beaten: !!f.beaten, floor: f }));
  const order = climbOrder(sites.concat(rows.filter((r) => !r.resting).map((r) => ({ id: r.id, kind: r.kind, assim: r.assim, beaten: r.beaten, row: r }))));
  return { rows, order, cats: categories(targets), done: rows.filter((r) => r.beaten).length, total: rows.length };
}
const pct = (n) => Math.round(+n || 0);
const bestOf = (t) => ((t.best && t.best.names) || []).join(', ');
/** what is still missing on a target, plain, correctness first, top n: [{ text, side }]. Pure. */
export function missingOf(t, n = 5) {
  return gapsOf(t).slice(0, n).map((g) => ({ side: g.side, text: g.build.replace(/^./, (c) => c.toUpperCase()) + (g.verse == null ? ' (not measured yet)' : ' (' + g.verse + ' of ' + g.best + ')') }));
}
/** the box for a target that is the closest thing Verse is working on. Pure. */
export function nowBox(r, esc) {
  const t = r.t, c = readChecks(t), won = c.filter((x) => x.state === 'won').length;
  return '<div class="vp-box vp-now" data-id="' + esc(t.id) + '" data-category="' + esc(r.kind) + '"><div class="vp-k">Working on now \u00b7 ' + esc(r.category) + '</div><div class="vp-site">' + esc(t.name.replace(/^./, (x) => x.toUpperCase())) + '</div>'
    + '<p class="vp-what">' + esc('Measured against: ' + (bestOf(t) || 'its best reference, still being found') + '. ' + (t.entry && (t.entry.page || t.entry.scene || t.entry.game) ? 'Verse\'s version is built.' : 'Verse has not built its version yet.')) + '</p>'
    + '<div class="vp-meter"><span class="vp-num">' + pct(r.assim) + '%</span><span class="vp-bar" aria-hidden="true"><i style="width:' + pct(r.assim) + '%"></i></span><span style="font-size:13px;opacity:.8">' + esc(won + ' of ' + c.length + ' checks won') + '</span></div></div>';
}
export function cantBox(r, esc) {
  const list = missingOf(r.t), total = gapsOf(r.t).length;
  return '<div class="vp-box vp-cant"><div class="vp-k">What Verse still can\'t do</div>' + (list.length ? '<ul>' + list.map((x) => '<li>' + esc(x.text) + '</li>').join('') + '</ul>' + (total > list.length ? '<p class="vp-more">' + esc((total - list.length) + ' more on the full Tower.') + '</p>' : '') : '<p class="vp-what">Nothing left. It counts as soon as the next check runs.</p>') + '</div>';
}
/** the "beyond websites" box: how many targets, the categories, and the closest of each. Pure. */
export function beyondBox(m, esc) {
  if (!m || !m.total) return '';
  const lead = (kind) => m.rows.filter((r) => r.kind === kind && !r.beaten).sort((a, b) => b.assim - a.assim)[0];
  const lines = m.cats.slice(0, 8).map((c) => { const r = lead(c.kind); return '<li data-category="' + esc(c.kind) + '"><b>' + esc(c.label) + '</b> ' + esc(c.n + (c.n === 1 ? ' target' : ' targets')) + (r ? ' \u2014 closest: ' + esc(r.site) + ' <span>(' + pct(r.assim) + '%)</span>' : '') + '</li>'; }).join('');
  return '<div class="vp-box vp-beyond" data-targets="' + m.total + '"><div class="vp-k">Beyond websites</div><p class="vp-what">' + esc('Games, shows, music, art, apps, assistants, writing and real things, each measured against the best in the world. ' + m.done + ' of ' + m.total + ' beaten. Verse beats one only when it wins on beauty, correctness and the plus.') + '</p><ul>' + lines + '</ul>'
    + (m.cats.length > 8 ? '<p class="vp-more">' + esc((m.cats.length - 8) + ' more categories on the full Tower.') + '</p>' : '') + '</div>';
}
/** one line for the next-up list. Pure. */
export const nextLine = (o, esc, siteHtml) => o.floor ? siteHtml(o.floor) + ' <span>(' + pct(o.assim) + '%)</span>' : esc(o.row.site) + ' \u2014 ' + esc(o.row.category.toLowerCase()) + ' <span>(' + pct(o.assim) + '%)</span>';
export { closeness, sidesOf, kindOf, SIDES };
