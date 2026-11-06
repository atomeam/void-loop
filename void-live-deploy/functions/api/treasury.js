// Verse's treasury, public (lib/treasury.js; owner, 2026-11-03: Verse reallocates its own profits, Atom's cut first, Verse decides it).
// GET  -> the real balance from realized Gumroad revenue (aggregate only: no buyer, no email, no sale id), what each pot holds, every
//         allocation and spend entry, the latest weekly review and whether Gumroad's API is reconciling. Splits any new realized
//         money first (append-only rows in D1 void_treasury, ids keyed on the realized total so a repeat or a race writes nothing twice).
// POST (owner only, Bearer READ_TOKEN) { action }:
//   'reconcile'                         read Gumroad's sales API into void_sales (only with GUMROAD_ACCESS_TOKEN; never a write to Gumroad)
//   'review'                            the weekly review: learn from measured returns, move unspent bucket money toward what worked
//   'executed' { id, actual, return_score }   a ready spend was paid, and later what it actually returned (return_score = actual / expected)
//   'cancel'   { id, why }              drop a ready spend; its money goes back to its bucket
//   'paid'     { cents, note }          Atom's owner cut handed over (out of the owner pot)
//   'given'    { cents, to, note }      a gift Atom sent from the giving pot to a charity's own donation page (to: the charity's name)
// Verse holds no card, no login and no payment credential: spends are logged as 'ready to execute' with what they need.
import { ownerOk } from '../../lib/guard.js';
import { ensureStoreTables } from '../../lib/store-db.js';
import { realized, balances, bucketWeights, split, queueSpends, review } from '../../lib/treasury.js';
import { walletOf, usdcBalance, confirmPayments, incomeRows, usdcIncome } from '../../lib/verse-wallet.js';
import { SERVICES, usdcText } from '../../lib/x402.js';

const TABLE = 'CREATE TABLE IF NOT EXISTS void_treasury (id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, bucket TEXT, cents INTEGER NOT NULL, purpose TEXT, expected TEXT, actual TEXT, status TEXT, needs TEXT, ref TEXT, data TEXT)';
const RECONCILE_MS = 6 * 3600e3;
const json = (body, status = 200, cache = 'no-store') => Response.json(body, { status, headers: { 'cache-control': cache } });

async function ensure(env) {
  await ensureStoreTables(env);
  await env.DB.prepare(TABLE).run();
}

async function policyOf(request, env) {
  const u = new URL('/treasury/policy.json', request.url);
  const r = env.ASSETS ? await env.ASSETS.fetch(u) : await fetch(u);
  if (!r.ok) throw new Error('policy unavailable');
  return r.json();
}

const ledger = async (env) => (await env.DB.prepare('SELECT id, at, kind, bucket, cents, purpose, expected, actual, status, needs, ref, data FROM void_treasury ORDER BY at, id').all()).results || [];
const salesRows = async (env) => (await env.DB.prepare('SELECT resource, sale_id, raw FROM void_sales').all()).results || [];
const lastReview = (rows) => { const r = rows.filter((x) => x.kind === 'review').pop(); try { return r ? JSON.parse(r.data) : null; } catch (_) { return null; } };

// Brings the ledger up to date with realized revenue, then queues what the buckets can afford. Idempotent.
async function settle(env, policy) {
  const money = realized(await salesRows(env));
  // USDC into Verse's wallet (lib/verse-wallet.js): x402 calls read back on chain, and store orders paid in USDC on Base. No fee is
  // taken off: the facilitator pays the gas and its free settlements are not billed to the payee.
  let usdc = usdcIncome();
  try { const r = await incomeRows(env); usdc = usdcIncome(r.x, r.s); } catch (_) {}
  money.gumroad_cents = money.realized_cents;
  money.usdc = usdc;
  money.realized_cents += usdc.cents;
  let rows = await ledger(env);
  const rv = lastReview(rows), learned = (rv && rv.learned) || {};
  const weights = bucketWeights(policy, { candidates: policy.candidates, learned });
  const b = balances(rows);
  const fresh = money.realized_cents - b.split_cents;
  const now = new Date().toISOString(), stmts = [];
  if (fresh) {
    for (const a of split(fresh, policy, { pots: b.pots, weights })) {
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO void_treasury (id, at, kind, bucket, cents, purpose, status, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('al:' + money.realized_cents + ':' + b.split_cents + ':' + a.bucket, now, 'alloc', a.bucket, a.cents, a.purpose, 'allocated', String(money.realized_cents)));
    }
  }
  if (stmts.length) { await env.DB.batch(stmts); rows = await ledger(env); }
  const open = rows.filter((r) => r.kind === 'spend' && r.status === 'ready to execute').map((r) => r.ref);
  const q = queueSpends(balances(rows).pots, policy.candidates, { queued: open, credentials: (policy.spending || {}).credentials || {}, learned });
  if (q.length) {
    await env.DB.batch(q.map((s) => env.DB.prepare('INSERT OR IGNORE INTO void_treasury (id, at, kind, bucket, cents, purpose, expected, status, needs, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('sp:' + s.id + ':' + (rows.filter((r) => r.kind === 'spend' && r.ref === s.id).length + 1), now, 'spend', s.bucket, s.cents, s.purpose, s.expected, s.status, s.needs, s.id)));
    rows = await ledger(env);
  }
  return { money, rows, weights, learned, review: rv };
}

// Gumroad's own record of sales into void_sales, deduplicated by sale id (lib/treasury.js realized counts each sale once).
export async function reconcile(env, fetchImpl = fetch) {
  if (!env.GUMROAD_ACCESS_TOKEN) return { ok: false, why: 'GUMROAD_ACCESS_TOKEN is not set: only pings count' };
  let key = '', pages = 0, added = 0;
  const have = new Set(((await env.DB.prepare("SELECT sale_id, resource FROM void_sales WHERE sale_id IS NOT NULL").all()).results || []).map((r) => r.resource + ':' + r.sale_id));
  const now = new Date().toISOString(), stmts = [];
  do {
    const r = await fetchImpl('https://api.gumroad.com/v2/sales' + (key ? '?page_key=' + encodeURIComponent(key) : ''), { headers: { authorization: 'Bearer ' + env.GUMROAD_ACCESS_TOKEN } });
    const j = r.ok ? await r.json() : null;
    if (!j || !j.success) return { ok: false, why: 'Gumroad API answered ' + r.status };
    for (const s of j.sales || []) {
      if (!s.id) continue;
      const raw = new URLSearchParams({ sale_id: s.id, price: String(s.price ?? 0), refunded: String(!!s.refunded), disputed: String(!!(s.disputed || s.chargedback)),
        dispute_won: String(!!s.dispute_won), discover_fee_charged: String(!!s.discover_fee_charged), test: String(!!s.test) }).toString();
      if (!have.has('sale:' + s.id)) { stmts.push(env.DB.prepare('INSERT OR IGNORE INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?, ?)').bind('api:sale:' + s.id, 'sale', s.id, s.subscription_id || null, String(s.product_permalink || s.product_name || '').slice(0, 200), 'from the Gumroad sales API (treasury)', raw, s.created_at || now)); added++; have.add('sale:' + s.id); }
      if (s.refunded && !have.has('refund:' + s.id)) { stmts.push(env.DB.prepare('INSERT OR IGNORE INTO void_sales (id, resource, sale_id, subscription_id, product, void_id, verified, effect, raw, at) VALUES (?, ?, ?, NULL, NULL, NULL, 1, ?, ?, ?)').bind('api:refund:' + s.id, 'refund', s.id, 'refund from the Gumroad sales API (treasury)', raw, now)); added++; have.add('refund:' + s.id); }
    }
    key = j.next_page_key || '';
  } while (key && ++pages < 20);
  stmts.push(env.DB.prepare('INSERT INTO void_treasury (id, at, kind, cents, status, data) VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO UPDATE SET at = excluded.at, data = excluded.data').bind('meta:reconciled', now, 'meta', 'ok', JSON.stringify({ added })));
  await env.DB.batch(stmts);
  return { ok: true, added };
}

// Verse's wallet as the chain shows it: its address, where it came from, and the USDC it holds (read live; null when the chain is not reachable).
async function walletView(env) {
  let w = null; try { w = await walletOf(env); } catch (_) {}
  if (!w) return { address: null, note: 'Verse has no wallet yet: x402 calls stay closed until one exists' };
  const units = await usdcBalance(env, w.address);
  return { address: w.address, source: w.source, note: w.note, network: 'Base', asset: 'USDC', balance_units: units, balance_cents: units == null ? null : Number(BigInt(units) / 10000n),
    explorer: 'https://basescan.org/address/' + w.address, sells: '/api/x402',
    services: Object.entries(SERVICES).map(([id, s]) => ({ id, path: s.path, price_usdc: usdcText(s.units), description: s.description })) };
}

function publicView(policy, s, env) {
  const b = balances(s.rows);
  const entries = s.rows.filter((r) => r.kind !== 'meta' && r.kind !== 'review').map((r) => ({ id: r.id, at: r.at, kind: r.kind, bucket: r.bucket, cents: r.cents,
    purpose: r.purpose, expected: r.expected || null, actual: r.actual || null, status: r.status, needs: r.needs || null }));
  const meta = s.rows.find((r) => r.id === 'meta:reconciled');
  const reviews = s.rows.filter((r) => r.kind === 'review').map((r) => { try { return { at: r.at, ...JSON.parse(r.data) }; } catch (_) { return null; } }).filter(Boolean);
  return {
    as_of: new Date().toISOString(),
    source: { only: 'realized revenue: Gumroad sales after fees and refunds, and USDC received on Base (x402 calls read back on chain, store orders paid in USDC)', pings: true, gumroad_api: env.GUMROAD_ACCESS_TOKEN ? (meta ? 'on, last read ' + meta.at : 'on, not read yet') : 'off (no API token on the site: pings only)', fee_source: policy.source_of_funds && policy.source_of_funds.fee_source },
    revenue: s.money, // sales, gross, Gumroad fees, refunded, realized: totals only
    balance_cents: s.money.realized_cents - s.rows.filter((r) => r.kind === 'paid').reduce((n, r) => n + r.cents, 0) - s.rows.filter((r) => r.kind === 'spend' && r.status === 'executed').reduce((n, r) => n + r.cents, 0),
    pots: b.pots, split_cents: b.split_cents, committed_cents: b.committed_cents,
    weights: s.weights, learned: s.learned,
    policy: { owner_cut: policy.owner_cut, reserve: policy.reserve, buckets: policy.buckets, spending: { rule: policy.spending.rule }, review: policy.review, history: policy.history, version: policy.version, decided_by: policy.decided_by },
    entries, reviews,
  };
}

/** Monday (UTC) of the week `at` falls in, as YYYY-MM-DD: one review per week, whoever asks first. */
export const weekOf = (at) => { const d = new Date(at); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

/** the weekly review: learn from measured returns, move unspent bucket money toward what worked. Once a week (ids by week, INSERT OR IGNORE). */
export async function weeklyReview(env, policy, now = new Date().toISOString()) {
  const s = await settle(env, policy), wk = weekOf(now);
  const spends = s.rows.filter((r) => r.kind === 'spend' && r.status === 'executed' && r.data).map((r) => { try { return { bucket: r.bucket, cents: r.cents, ...JSON.parse(r.data) }; } catch (_) { return null; } }).filter(Boolean);
  const rv = review(policy, { pots: balances(s.rows).pots, learned: s.learned, spends, candidates: policy.candidates });
  if (s.rows.some((r) => r.id === 'rv:' + wk)) return { ...rv, moves: [], reason: 'The review for the week of ' + wk + ' already ran.' };
  const stmts = rv.moves.map((m) => env.DB.prepare('INSERT OR IGNORE INTO void_treasury (id, at, kind, bucket, cents, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('mv:' + wk + ':' + m.bucket, now, 'move', m.bucket, m.cents, 'weekly review: unspent money moved ' + (m.cents > 0 ? 'into' : 'out of') + ' ' + m.bucket, 'moved'));
  stmts.push(env.DB.prepare('INSERT OR IGNORE INTO void_treasury (id, at, kind, cents, status, data) VALUES (?, ?, ?, 0, ?, ?)').bind('rv:' + wk, now, 'review', 'done', JSON.stringify({ learned: rv.learned, weights: rv.weights, moves: rv.moves, reason: rv.reason })));
  await env.DB.batch(stmts);
  return rv;
}

export async function onRequestGet({ request, env, waitUntil }) {
  try {
    await ensure(env);
    const policy = await policyOf(request, env);
    try { await confirmPayments(env); } catch (_) {} // x402 payments settled since the last read: counted once the chain shows them
    const s = await settle(env, policy);
    const meta = s.rows.find((r) => r.id === 'meta:reconciled');
    if (env.GUMROAD_ACCESS_TOKEN && (!meta || Date.now() - Date.parse(meta.at) > RECONCILE_MS) && typeof waitUntil === 'function') {
      try { waitUntil(reconcile(env).catch(() => null)); } catch (_) {}
    }
    // the weekly review runs itself: the first read of a new week does it (no workflow or token needed)
    if (!s.rows.some((r) => r.id === 'rv:' + weekOf(new Date().toISOString())) && typeof waitUntil === 'function') {
      try { waitUntil(weeklyReview(env, policy).catch(() => null)); } catch (_) {}
    }
    return json({ ...publicView(policy, s, env), wallet: await walletView(env) }, 200, 'public, max-age=60');
  } catch (e) { return json({ error: 'treasury unavailable' }, 503); }
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ error: 'owner only' }, 401);
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ error: 'json body' }, 400); }
  try {
    await ensure(env);
    const policy = await policyOf(request, env), now = new Date().toISOString();
    if (body.action === 'reconcile') return json(await reconcile(env));
    if (body.action === 'review') return json({ ok: true, ...(await weeklyReview(env, policy)) });
    const id = String(body.id || '');
    const row = id ? await env.DB.prepare('SELECT id, kind, status, cents, bucket FROM void_treasury WHERE id = ?').bind(id).first() : null;
    if (body.action === 'executed') {
      if (!row || row.kind !== 'spend') return json({ error: 'no such spend' }, 404);
      const score = Number(body.return_score);
      await env.DB.prepare('UPDATE void_treasury SET status = ?, actual = ?, data = ? WHERE id = ?').bind('executed', String(body.actual || '').slice(0, 500) || null, Number.isFinite(score) ? JSON.stringify({ return_score: score }) : null, id).run();
      return json({ ok: true });
    }
    if (body.action === 'cancel') {
      if (!row || row.kind !== 'spend' || row.status !== 'ready to execute') return json({ error: 'no open spend' }, 404);
      await env.DB.batch([
        env.DB.prepare('UPDATE void_treasury SET status = ? WHERE id = ?').bind('cancelled', id),
        env.DB.prepare('INSERT INTO void_treasury (id, at, kind, bucket, cents, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('cx:' + id, now, 'cancel', row.bucket, row.cents, 'cancelled: ' + String(body.why || 'no reason given').slice(0, 300), 'returned'),
      ]);
      return json({ ok: true });
    }
    if (body.action === 'paid') {
      const cents = Math.round(Number(body.cents) || 0);
      if (!(cents > 0)) return json({ error: 'cents > 0' }, 400);
      await env.DB.prepare('INSERT INTO void_treasury (id, at, kind, bucket, cents, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('pd:' + now, now, 'paid', 'owner', cents, 'owner cut handed to Atom' + (body.note ? ': ' + String(body.note).slice(0, 200) : ''), 'paid').run();
      return json({ ok: true });
    }
    if (body.action === 'given') {
      const cents = Math.round(Number(body.cents) || 0), to = String(body.to || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120);
      if (!(cents > 0) || !to) return json({ error: 'cents > 0 and to' }, 400);
      const have = balances(await ledger(env)).pots.giving || 0;
      if (cents > have) return json({ error: 'the giving pot holds ' + have + ' cents' }, 409);
      await env.DB.prepare('INSERT INTO void_treasury (id, at, kind, bucket, cents, purpose, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('gv:' + now, now, 'given', 'giving', cents, 'given to ' + to + (body.note ? ': ' + String(body.note).slice(0, 200) : ''), 'given').run();
      return json({ ok: true });
    }
    return json({ error: 'unknown action', actions: ['reconcile', 'review', 'executed', 'cancel', 'paid', 'given'] }, 400);
  } catch (_) { return json({ error: 'treasury unavailable' }, 503); }
}
