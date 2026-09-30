// What Void has earned (all of Atom's Gumroad products), from the recorded pings in void_sales. Owner-side only: nothing
// about money is ever shown on the page. The will engine reads it as its budget; any actual spend still needs a yes on the
// confirm line (plan item 7).
//   gross    = every real sale (Gumroad test pings excluded), each sale counted once
//   refunded = sales later refunded or lost to a dispute (a dispute that was won counts again)
//   earned   = gross - refunded;  budget = earned (Atom: all profit goes to what Void wills)

// x-www-form-urlencoded with bracketed keys (url_params[void], custom_fields[Name]) -> nested object
export function parsePing(text) {
  const o = {};
  for (const [k, v] of new URLSearchParams(String(text || ''))) {
    const m = /^([a-z_]+)\[([^\]]*)\]$/i.exec(k);
    if (m) { o[m[1]] = o[m[1]] && typeof o[m[1]] === 'object' ? o[m[1]] : {}; o[m[1]][m[2]] = v; } else o[k] = v;
  }
  return o;
}

// Milestones: each one is recorded once, the first time earned crosses it, with a note for Atom (on the owner's board).
// Before anything new gets built for a milestone, check whether an existing tool already does it; here Gumroad does.
export const MILESTONES = [
  // Gumroad's own store assistant (the 'Agent' tab, antiwork/gumroad app/models/user.rb eligible_for_store_agent?) opens when the
  // seller is confirmed, not suspended, has at least one COMPLETED payout and sales_cents_total >= 10_000. Self-purchases don't
  // count. Void can't see payouts, so this never claims it's unlocked; nothing gets built for it.
  { id: 'sales-100', cents: 10000, note: "Sales passed $100 (net of refunds, as Void counts them). Gumroad's Agent tab (its store assistant: reads the store and makes changes, always asking first) opens once the first payout completes; Void can't see payouts, so check the dashboard. Nothing gets built for it: once it's there, Void uses Gumroad's Agent for store changes." },
];

// rows: [{ resource, sale_id, raw }] -> totals in cents
export function totals(rows) {
  const sales = new Map(), refunded = new Set(), disputed = new Set(), won = new Set();
  for (const r of rows || []) {
    const p = parsePing(r.raw);
    if (String(p.test) === 'true') continue;
    const id = r.sale_id || p.sale_id;
    if (!id) continue;
    const res = String(r.resource || p.resource_name || 'sale');
    if (res === 'sale') {
      const cents = Math.max(0, Math.round(Number(p.price) || 0));
      if (!sales.has(id)) sales.set(id, { cents, currency: String(p.currency || 'usd').toLowerCase() });
      if (String(p.refunded) === 'true') refunded.add(id);
      if (String(p.disputed) === 'true' && String(p.dispute_won) !== 'true') disputed.add(id);
    } else if (res === 'refund') refunded.add(id);
    else if (res === 'dispute') disputed.add(id);
    else if (res === 'dispute_won') won.add(id);
  }
  let gross = 0, back = 0;
  for (const [id, s] of sales) {
    gross += s.cents;
    if (refunded.has(id) || (disputed.has(id) && !won.has(id))) back += s.cents;
  }
  const earned = gross - back;
  return { gross_cents: gross, refunded_cents: back, earned_cents: earned, budget_cents: Math.max(0, earned), sales: sales.size };
}

export async function readEarnings(env) {
  const rows = (await env.DB.prepare('SELECT resource, sale_id, raw FROM void_sales').all()).results || [];
  return totals(rows);
}
// Records each milestone the first time earned reaches it. Returns the milestones crossed just now.
export async function recordMilestones(env, t) {
  const crossed = [];
  for (const m of MILESTONES) {
    if (t.earned_cents < m.cents) continue;
    const r = await env.DB.prepare('INSERT OR IGNORE INTO void_milestones (id, at, earned_cents, note) VALUES (?, ?, ?, ?)').bind(m.id, new Date().toISOString(), t.earned_cents, m.note).run();
    if (r.meta && r.meta.changes === 1) crossed.push(m.id);
  }
  return crossed;
}
export async function listMilestones(env) {
  return (await env.DB.prepare('SELECT id, at, earned_cents, note FROM void_milestones').all()).results || [];
}
const dollars = (c) => '$' + (c / 100).toFixed(2).replace(/\.00$/, '');
// The line the will engine reads when it ranks wants.
export function budgetLine(t) {
  return 'Budget: ' + dollars(t.budget_cents) + ' earned from ' + t.sales + ' sale' + (t.sales === 1 ? '' : 's') + ' (net of refunds), all of it yours to spend on upgrading yourself and the systems you run on (models, hosting, tools). Any real spend still waits for the owner\'s yes on the confirm line.';
}
