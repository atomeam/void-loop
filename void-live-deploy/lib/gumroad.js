// Atom's Gumroad store, as Void knows it (plan item 12). Shared by the page, /api/catalog and /api/gumroad.
// Void uses every product in the store, keeps them current and never drops one: the catalog is merged from the live
// storefront, a product that disappears or is unpublished stays (marked unavailable, with its history), new ones join.
// Products surface only when someone asks for what they cover: one plain line with the live price and the link.
// Nothing here is ever shown on the empty surface, in the menu, the hints, /tools.json or WebMCP tool lists.

export const STORE = 'https://moonbeam846.gumroad.com';
export const STALE_MS = 6 * 3600e3; // refresh the catalog from the store when it's older than this

// The store as of 2026-09-27 (used until the first live refresh, and whenever the store can't be reached and nothing is saved).
// slug = the /l/<slug> path; short = Gumroad's own permalink (Pings may carry either).
export const CATALOG_SEED = [
  { slug: 'yinmj', short: 'yinmj', name: 'Void Monthly', price_cents: 4900, currency: 'usd', recurrence: 'monthly', native_type: 'membership' },
  { slug: 'gqsgib', short: 'gqsgib', name: 'The Big Board', price_cents: 2500, currency: 'usd', recurrence: 'monthly', native_type: 'membership' },
  { slug: 'join-the-team', short: 'klwlxn', name: 'Join the Team', price_cents: 100, currency: 'usd', recurrence: null, native_type: 'digital' },
  { slug: 'first-automation-setup', short: 'rpmuz', name: 'First Automation Setup', price_cents: 10000, currency: 'usd', recurrence: null, native_type: 'digital' },
  { slug: 'full-stack-audit', short: 'chafpm', name: 'Full Stack Audit', price_cents: 30000, currency: 'usd', recurrence: null, native_type: 'digital' },
  { slug: 'keep-it-running-membership', short: 'agstkz', name: 'Keep-It-Running Plan', price_cents: 4900, currency: 'usd', recurrence: null, native_type: 'digital' },
  { slug: 'eozcma', short: 'eozcma', name: 'Automation Cleanup', price_cents: 2500, currency: 'usd', recurrence: null, native_type: 'digital' },
].map((p) => ({ ...p, url: STORE + '/l/' + p.slug, available: true }));

// What a purchase unlocks in Void. Void Monthly = paid Void. Add a row here when another membership should unlock something.
export const UNLOCKS = [{ slugs: ['yinmj'], names: ['void monthly'], tier: 'paid' }];
export function unlockFor(p) {
  const slug = String((p && (p.slug || p.product_permalink || p.permalink)) || '').toLowerCase();
  const name = String((p && (p.name || p.product_name)) || '').toLowerCase().trim();
  return UNLOCKS.find((u) => (slug && u.slugs.includes(slug)) || (name && u.names.includes(name))) || null;
}
export const isUnlockSlug = (slug) => UNLOCKS.some((u) => u.slugs.includes(slug));

// Which asks each product covers (checked in this order). A product the store adds later still matches by its name.
export const TOPICS = [
  ['full-stack-audit', /\baudits?\b/],
  ['eozcma', /\b(broken|broke|fix|fixing|fixed|repair|debug|failing|fails|stopped working|not working|clean ?up)\b.*\b(zaps?|zapier|automations?|workflows?|make\.com|n8n|scenarios?)\b|\b(zaps?|zapier|automations?|workflows?)\b.*\b(broken|broke|failing|fails|stopped working|not working|keeps? failing)\b/],
  ['keep-it-running-membership', /\b(monitor(ing)?|keep (it|them|my \w+|things|everything) running|uptime|watch (over )?my (automations?|zaps?|workflows?|site|stack))\b/],
  ['first-automation-setup', /\b(set ?up|build|make|create|start|need|want|get)\b.*\b(automations?|zaps?|zapier)\b|\bautomate (my|our|this|a|an|the)\b|\bfirst automation\b/],
  ['gqsgib', /\bbig board\b/],
  ['join-the-team', /\bjoin (the |your )?team\b|\bwork (with|for) (you|a-to-mind|void|atom)\b|\bjoin a-to-mind\b/],
];
export function shortName(n) { return String(n || '').split(/\s+[—–-]\s+/)[0].trim().slice(0, 80); }
export function productFor(ask, products) {
  const s = String(ask || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const live = (products || []).filter((p) => p && p.available !== false && !isUnlockSlug(p.slug));
  for (const [slug, re] of TOPICS) if (re.test(s)) { const p = live.find((x) => x.slug === slug); if (p) return p; }
  // any product (including ones added later) by its own name, e.g. "the big board", "keep-it-running plan"
  const words = (x) => x.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const flat = ' ' + words(s) + ' ';
  return live.find((p) => { const n = words(shortName(p.name)); return n.length >= 6 && flat.includes(' ' + n + ' '); }) || null;
}
export function money(cents, currency = 'usd') {
  const n = Number(cents) / 100;
  const sym = { usd: '$', eur: '€', gbp: '£' }[String(currency).toLowerCase()];
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return sym ? sym + v : v + ' ' + String(currency).toUpperCase();
}
const PER = { monthly: ' a month', quarterly: ' every 3 months', biannually: ' every 6 months', yearly: ' a year', every_two_years: ' every 2 years' };
export function priceText(p) { return money(p.price_cents, p.currency) + (p.recurrence ? PER[p.recurrence] || '' : ''); }

// --- Reading the live store (server side). The storefront and product pages carry an HTML-escaped data-page JSON. ---
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function dataPage(html) {
  const m = /data-page="([^"]*)"/.exec(String(html || ''));
  if (!m) return null;
  try { return JSON.parse(unesc(m[1])); } catch (_) { return null; }
}
const slugOf = (url, fallback) => { const m = /\/l\/([A-Za-z0-9_-]+)/.exec(String(url || '')); return m ? m[1] : fallback; };
// storefront HTML -> [{ slug, short, name, price_cents, currency, recurrence, native_type, url }] or null when it can't be read
export function parseStorefront(html) {
  const j = dataPage(html);
  const sections = j && j.props && Array.isArray(j.props.sections) ? j.props.sections : null;
  if (!sections) return null;
  const out = [];
  for (const sec of sections) for (const p of (sec && sec.search_results && sec.search_results.products) || []) {
    const slug = slugOf(p.url, p.permalink);
    if (!slug || out.some((x) => x.slug === slug)) continue;
    out.push({ slug, short: p.permalink || slug, name: String(p.name || slug), price_cents: Number(p.price_cents) || 0, currency: p.currency_code || 'usd', recurrence: p.recurrence || null, native_type: p.native_type || null, url: STORE + '/l/' + slug });
  }
  return out;
}
// product page HTML -> { name (og:title), price_cents, is_published, recurrence } or null
export function parseProductPage(html) {
  const og = /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/.exec(String(html || ''));
  const j = dataPage(html), pr = j && j.props && j.props.product;
  if (!pr && !og) return null;
  let cents = pr ? Number(pr.price_cents) || 0 : null;
  const rec = pr && pr.recurrences && pr.recurrences.default ? pr.recurrences.default : null;
  if (pr && !cents && Array.isArray(pr.options)) { // tiered memberships keep the price on the tier
    const vals = pr.options.map((o) => o && o.recurrence_price_values && o.recurrence_price_values[rec || 'monthly'] && Number(o.recurrence_price_values[rec || 'monthly'].price_cents)).filter((x) => x > 0);
    if (vals.length) cents = Math.min(...vals);
  }
  return { name: og ? unesc(og[1]) : pr && pr.name, price_cents: cents, is_published: pr ? pr.is_published !== false : true, recurrence: rec, currency: pr && pr.currency_code };
}
// Storefront + each product page. Returns the store's current products, or null if the store couldn't be read.
export async function fetchStore(fetchImpl = fetch) {
  const get = async (u) => { const r = await fetchImpl(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; A-to-Mind Void catalog)' } }); return r.ok ? r.text() : null; };
  let list = null;
  try { list = parseStorefront(await get(STORE + '/')); } catch (_) { list = null; }
  if (!list || !list.length) return null; // an empty or unreadable store is a failed read, never "everything is gone"
  await Promise.all(list.map(async (p) => {
    let d = null; try { d = parseProductPage(await get(p.url)); } catch (_) {}
    if (!d) return;
    if (d.price_cents) p.price_cents = d.price_cents;
    if (d.recurrence) p.recurrence = d.recurrence;
    if (d.currency) p.currency = d.currency;
    if (d.is_published === false) p.unpublished = true;
  }));
  return list;
}
// Merge the store's current products into the saved catalog. Nothing is ever deleted: a product that's gone or unpublished
// becomes available:false (and comes back if it returns); price, recurrence and name changes go into its history.
// old: [{ slug, ..., available, first_seen, last_seen, history }]  ->  { products, changed: [slugs] }
export function mergeCatalog(old, fresh, now = new Date().toISOString()) {
  const bySlug = new Map((old || []).map((p) => [p.slug, { ...p, history: (p.history || []).slice() }]));
  const changed = new Set();
  const seen = new Set();
  for (const f of fresh || []) {
    const live = !f.unpublished;
    seen.add(f.slug);
    const cur = bySlug.get(f.slug);
    const fields = { short: f.short, name: f.name, price_cents: f.price_cents, currency: f.currency || 'usd', recurrence: f.recurrence || null, native_type: f.native_type || null, url: f.url || STORE + '/l/' + f.slug };
    if (!cur) {
      bySlug.set(f.slug, { slug: f.slug, ...fields, available: live, first_seen: now, last_seen: live ? now : null, ...(live ? {} : { unavailable_since: now }), history: [{ at: now, event: 'added', price_cents: fields.price_cents, recurrence: fields.recurrence, name: fields.name, available: live }] });
      changed.add(f.slug); continue;
    }
    const diff = ['price_cents', 'recurrence', 'name', 'currency'].filter((k) => (cur[k] ?? null) !== (fields[k] ?? null));
    if (diff.length) cur.history.push({ at: now, event: 'changed', ...Object.fromEntries(diff.map((k) => [k, fields[k]])), was: Object.fromEntries(diff.map((k) => [k, cur[k] ?? null])) });
    if (cur.available === false && live) { cur.history.push({ at: now, event: 'back' }); delete cur.unavailable_since; }
    if (cur.available !== false && !live) { cur.history.push({ at: now, event: 'unpublished' }); cur.unavailable_since = now; }
    if (diff.length || cur.available !== live || (live && cur.last_seen !== now)) changed.add(f.slug);
    Object.assign(cur, fields, { available: live }, live ? { last_seen: now } : {});
  }
  for (const [slug, cur] of bySlug) {
    if (seen.has(slug) || cur.available === false) continue;
    cur.available = false; cur.unavailable_since = now; cur.history.push({ at: now, event: 'gone from the store' });
    changed.add(slug);
  }
  return { products: [...bySlug.values()], changed: [...changed] };
}
// What the page gets: live fields only (no history).
export const publicProduct = (p) => ({ slug: p.slug, name: shortName(p.name), price_cents: p.price_cents, currency: p.currency || 'usd', recurrence: p.recurrence || null, url: p.url || STORE + '/l/' + p.slug, available: p.available !== false });
