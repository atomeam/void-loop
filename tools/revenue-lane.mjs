// The revenue lane: Verse's top house loop (docs/money-playbook.md). It rides every house-loops run, first, so it needs no
// workflow of its own. Each run it reads real income and checkout health, finishes the offer experiments whose window is over
// (the winner stays and its pattern's score rises; the losers are cut), starts a new experiment on every free slot built from
// the sourced playbook (the best-scoring patterns first, the slot's champion as the control), undoes any offer whose checkout
// broke, and writes one row per run to void-live-deploy/progress/loops/revenue-runs/ (a new file each run, so the house branches
// never fight over it) plus the lane card progress/loops/revenue.json. Nothing here invents a number: income is the treasury's
// realized revenue, clicks and showings are /api/buy's counts, checkout health is a live fetch of each checkout.
//   node tools/revenue-lane.mjs [--dry]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, '');
export const FILES = { offers: 'void-live-deploy/offers/offers.json', playbook: 'void-live-deploy/offers/playbook.json', runs: 'void-live-deploy/progress/loops/revenue-runs', loop: 'void-live-deploy/progress/loops/revenue.json' };
export const RULES = Object.freeze({ days: 7, maxDays: 28, minSeen: 40, minClicks: 3, challengers: 2 });
const DAY = 864e5;

// ---- honesty (pure) ----
const DARK = /\b(only \d+ left|limited[- ]time|hurry|last chance|act now|expir(es|ing)|ends (soon|today|tonight)|selling fast|best[- ]?sell(er|ing)|#1|number one|guaranteed?|risk[- ]free|100%|everyone is|\d[\d,]* (people|buyers|customers|users|members|reviews|ratings)|rated \d|\d(\.\d)? stars?)\b/i;
/** null when the copy is honest, else why not: no urgency, scarcity, social proof or rating, and every $ amount is the product's own. */
export function honestCopy(text, product) {
  const t = String(text || '');
  if (!t || t.length > 220) return 'empty or too long';
  const m = t.match(DARK); if (m) return 'dark pattern: ' + m[0];
  const amounts = t.match(/\$\d[\d,.]*/g) || [], own = String((product && product.price) || '').match(/\$\d[\d,.]*/g) || [];
  for (const a of amounts) if (!own.includes(a)) return 'a price that is not the product\'s: ' + a;
  if (/\{\w+\}/.test(t)) return 'an unfilled blank';
  return null;
}

// ---- copy from the playbook (pure) ----
const tail = (b) => { const s = String(b || '').trim().replace(/\.$/, ''); const c = s.includes(': ') ? s.split(': ').slice(1).join(': ') : s; return /^[A-Z][a-z]+\b/.test(c) && !/^[A-Z][a-z]*[A-Z]/.test(c) ? c[0].toLowerCase() + c.slice(1) : c; };
export function fill(pattern, p) {
  if ((pattern.needs && !p[pattern.needs]) || (pattern.kinds && !pattern.kinds.includes(p.kind))) return null;
  const map = { name: p.name, blurb: String(p.blurb || '').replace(/\.$/, ''), blurb_lc: tail(p.blurb), price: 'for ' + p.price, price_bare: p.price, trial: p.trial || '' };
  const sub = (s) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : '{' + k + '}')).replace(/\s+/g, ' ').replace(/\.\./g, '.');
  const v = { pattern: pattern.id, product: p.id, text: sub(pattern.template), cta: sub(pattern.cta), ...(pattern.direct ? { direct: true } : {}) };
  return honestCopy(v.text, p) || honestCopy(v.cta, p) ? null : v;
}
/** a pattern's score: its smoothed click rate across every finished try, so an untried pattern still gets its turn. Pure. */
export const scoreOf = (pat) => { const r = pat.results || {}; return ((r.clicks || 0) + 1) / ((r.seen || 0) + 20) + (r.tries ? 0 : 0.02); };
const rate = (c, s) => (c + 1) / (s + 2);

/** what one running experiment's variants did, from /api/buy rows. Pure. */
export function tally(slot, run, rows) {
  return run.variants.map((v) => {
    const src = slot + '.' + run.exp + '.' + v.v, n = (kind) => rows.filter((r) => r.kind === kind && r.src === src).reduce((a, r) => a + r.n, 0);
    return { ...v, seen: n('seen'), clicks: n('click') };
  });
}
/** done, still running, or out of time; and the winner. The control keeps its place unless a challenger is clearly ahead. Pure. */
export function judge(run, counted, now) {
  const age = (now - Date.parse(run.started)) / DAY;
  const enough = counted.every((v) => v.seen >= RULES.minSeen);
  if (age < run.days || (!enough && age < RULES.maxDays)) return { done: false };
  const control = counted[0], best = counted.slice().sort((a, b) => rate(b.clicks, b.seen) - rate(a.clicks, a.seen))[0];
  const wins = best !== control && best.clicks >= RULES.minClicks && rate(best.clicks, best.seen) > rate(control.clicks, control.seen);
  return { done: true, winner: wins ? best : control, signal: enough, why: wins ? 'a challenger beat the control' : enough ? 'the control held' : 'too few showings in ' + RULES.maxDays + ' days: the control stays' };
}

/** one lap over the state. Pure: returns the new offers, playbook and the list of changes. */
export function lap({ offers, playbook, catalog, rows, broken, now }) {
  const o = JSON.parse(JSON.stringify(offers)), pb = JSON.parse(JSON.stringify(playbook)), changes = [];
  const byId = Object.fromEntries((catalog || []).map((p) => [p.id, p])), at = new Date(now).toISOString().slice(0, 10); // a day, so two runs on one day write the same file
  const pat = (id) => pb.patterns.find((p) => p.id === id);
  for (const [slot, s] of Object.entries(o.slots)) {
    if (s.running && s.running.variants.some((v) => broken.includes(v.product))) { // a checkout broke: undo the offer now
      o.history.push({ slot, exp: s.running.exp, ended: at, result: 'undone: a checkout stopped answering' }); changes.push(slot + ': undid ' + s.running.exp + ' (checkout down)'); s.running = null;
    }
    if (s.running) {
      const counted = tally(slot, s.running, rows), j = judge(s.running, counted, now);
      if (!j.done) continue;
      for (const v of counted) { const p = pat(v.pattern); if (!p) continue; const r = p.results; r.tries++; r.seen += v.seen; r.clicks += v.clicks; if (v === j.winner && counted.length > 1 && j.signal) r.wins++; }
      const { seen, clicks, ...keep } = j.winner; s.champion = keep;
      o.history.push({ slot, exp: s.running.exp, ended: at, result: j.why, kept: keep.pattern, variants: counted.map((v) => ({ v: v.v, pattern: v.pattern, seen: v.seen, clicks: v.clicks })) });
      changes.push(slot + ': kept ' + keep.pattern + ' (' + j.why + ')'); s.running = null;
      for (const [other, t] of Object.entries(o.slots)) if (other !== slot && !t.running && t.products.includes(keep.product) && !t.champion) { t.champion = { ...keep }; changes.push(other + ': copied the winner ' + keep.pattern); }
    }
  }
  const n = pb.patterns.length, slots = Object.keys(o.slots);
  for (const [slot, s] of Object.entries(o.slots)) {
    if (s.running) continue;
    // best score first; patterns tied on score are spread across slots, so the parallel experiments cover the whole playbook
    const turn = (p) => (pb.patterns.indexOf(p) - slots.indexOf(slot) + n * 8) % n;
    const ranked = pb.patterns.slice().sort((a, b) => scoreOf(b) - scoreOf(a) || turn(a) - turn(b));
    const live = s.products.map((id) => byId[id]).filter((p) => p && !p.soon && p.buy && !broken.includes(p.id));
    if (!live.length) continue;
    const variants = [];
    if (s.champion && live.some((p) => p.id === s.champion.product)) variants.push({ ...s.champion });
    for (const p of ranked) { // one variant per pattern, so each experiment compares proven patterns, not two copies of one
      if (variants.length > RULES.challengers) break;
      if (variants.some((x) => x.pattern === p.id)) continue;
      const v = live.map((prod) => fill(p, prod)).find(Boolean); if (v) variants.push(v);
    }
    if (variants.length < 2) continue;
    const exp = 'e' + at.slice(2, 10).replace(/-/g, '') + slot.slice(0, 3);
    s.running = { exp, started: at, days: RULES.days, variants: variants.slice(0, RULES.challengers + 1).map((v, i) => ({ ...v, v: String.fromCharCode(97 + i) })) };
    changes.push(slot + ': started ' + exp + ' (' + s.running.variants.map((v) => v.pattern + '/' + v.product).join(' vs ') + ')');
  }
  return { offers: o, playbook: pb, changes };
}

/** offers.json with one line per slot and per history row, so a lap's diff is a few lines. Pure. */
export const compact = (o) => '{\n "about": ' + JSON.stringify(o.about) + ',\n "slots": {\n' + Object.entries(o.slots).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n },\n "history": [' + (o.history.length ? '\n' + o.history.map((h) => '  ' + JSON.stringify(h)).join(',\n') + '\n ' : '') + ']\n}\n';
// ---- the live run ----
const get = async (path) => { try { const r = await fetch(path.startsWith('http') ? path : SITE + path, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Verse-house' } }); return r.ok ? r.json() : null; } catch { return null; } };
async function checkoutUp(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 Verse-house checkout check' } }); return r.status < 400; } catch { return false; } }
const readJson = (f, d) => { try { return JSON.parse(readFileSync(join(root, f), 'utf8')); } catch { return d; } };

export async function runLane({ dry = false, now = Date.now() } = {}) {
  const [cat, tre, buy] = [await get('/api/store/catalog'), await get('/api/treasury'), await get('/api/buy?stats=1&days=60')];
  const catalog = (cat && cat.products) || [], paid = catalog.filter((p) => p.buy && !p.soon && p.cents > 0);
  const broken = []; for (const p of paid) if (!(await checkoutUp(p.buy))) broken.push(p.id);
  const rev = tre && tre.revenue, rows = (buy && buy.rows) || [];
  const offers = readJson(FILES.offers, null), playbook = readJson(FILES.playbook, null);
  if (!offers || !playbook) return { ok: false, last: 'The offer files are missing.' };
  const out = catalog.length ? lap({ offers, playbook, catalog, rows, broken, now }) : { offers, playbook, changes: [] };
  const sum = (k) => rows.filter((r) => r.kind === k).reduce((a, r) => a + r.n, 0);
  const row = { at: new Date(now).toISOString(), income_cents: rev ? rev.realized_cents : null, sales: rev ? rev.sales : null, checkouts: { live: paid.length, up: paid.length - broken.length, broken },
    offers_60d: buy ? { seen: sum('seen'), clicks: sum('click') } : null, running: Object.values(out.offers.slots).filter((s) => s.running).length, changes: out.changes };
  const money = rev ? '$' + (rev.realized_cents / 100).toFixed(2) + ' realized from ' + rev.sales + ' sales' : 'income unreadable';
  const last = money + '. Checkouts up ' + row.checkouts.up + '/' + row.checkouts.live + (broken.length ? ' (down: ' + broken.join(', ') + ')' : '') + '. ' + (out.changes.length ? out.changes.length + ' offer change(s): ' + out.changes.join('; ') + '.' : 'No offer change; experiments still running.');
  if (!dry) {
    const w = (f, o) => writeFileSync(join(root, f), JSON.stringify(o, null, 1) + '\n');
    writeFileSync(join(root, FILES.offers), compact(out.offers)); w(FILES.playbook, out.playbook);
    mkdirSync(join(root, FILES.runs), { recursive: true }); w(FILES.runs + '/' + row.at.slice(0, 16).replace(/:/g, '') + '.json', row);
    w(FILES.loop, { id: 'revenue', name: 'Revenue', what: 'Verse\'s top loop: reads real income and checkout health, runs honest offer experiments from the sourced money playbook, keeps winners and cuts losers.', schedule: 'first, in every house-loops run', status: 'Ran.', last, cost: { runner: 'actions', minutes: 1, paidCents: 0, note: 'No model call.' }, state: { fails: 0, pauseUntil: 0 } });
  }
  return { ok: true, last, row };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runLane({ dry: process.argv.includes('--dry') }).then((r) => { console.log('Revenue: ' + r.last); console.log(JSON.stringify(r.row || r)); }).catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
