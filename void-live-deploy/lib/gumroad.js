// Atom's Gumroad store, as Void knows it (plan item 12). Shared by the page, /api/catalog and /api/gumroad.
// Void uses every product in the store, keeps them current and never drops one: the catalog is merged from the live
// storefront, a product that disappears or is unpublished stays (marked unavailable, with its history), new ones join.
// Products surface only when someone asks for what they cover: one plain line with the live price and the link, after the answer.
// Nothing here is ever shown on the empty surface, in the menu, the hints, /tools.json or WebMCP tool lists.

export const STORE = 'https://moonbeam846.gumroad.com';
export const STALE_MS = 6 * 3600e3; // refresh the catalog from the store when it's older than this

// Nothing about products is hard-coded here: names, prices, descriptions and what each covers all come from the live store
// (/api/catalog). When Atom renames, reprices or rewrites a product, Void follows on the next refresh.

// What a purchase unlocks in Void, by Gumroad's product id and permalink (both survive a rename). The first row is the paid Void membership.
// Add a row here when another membership should unlock something.
export const UNLOCKS = [{ ids: ['ITp6zMMOC7A2h-bsSejYSA=='], slugs: ['yinmj'], tier: 'paid' }];
// A Ping's product_permalink is the product's long URL (https://moonbeam846.gumroad.com/l/yinmj); permalink and short_product_id are bare.
const permalinkOf = (x) => { const s = String(x || '').trim().toLowerCase(); const m = /\/l\/([^/?#]+)/.exec(s); return m ? m[1] : s; };
export function unlockFor(p) {
  if (!p) return null;
  const ids = [p.product_id, p.id].filter(Boolean).map(String);
  const slugs = [p.slug, p.product_permalink, p.permalink, p.short, p.short_product_id].filter(Boolean).map(permalinkOf);
  return UNLOCKS.find((u) => ids.some((x) => u.ids.includes(x)) || slugs.some((x) => u.slugs.includes(x))) || null;
}
export const isUnlock = (p) => !!unlockFor(p);

// Atom's seller account, as Gumroad's Ping names it: seller_id is Gumroad's obfuscated id (ObfuscateIds.encrypt(seller.id), the
// same style as product_id), read from Atom's Gumroad settings. It is not the storefront's numeric external id. GUMROAD_SELLER_ID,
// if set, replaces it (comma-separated for more than one).
export const SELLER_IDS = ['I1O8RSqkcoRWcew39cQx7A=='];
export function sellerMatches(p, pinned) {
  const sid = String((p && p.seller_id) || '').trim();
  const ids = pinned ? String(pinned).split(',').map((x) => x.trim()).filter(Boolean) : SELLER_IDS;
  return !!sid && ids.includes(sid);
}

// Which product an ask is about, scored from each product's own name and description (as the store has them today).
const STOP = new Set(('the a an and or but if then than so to of in on at by for with from into onto about as is are was were be been being am do does did done have has had having ' +
  'i me my mine we us our you your yours he she it its they them their this that these those there here what which who whom whose when where why how can could should would will shall may might must ' +
  'not no yes just only also very really more most much many some any all every each both few other such own same too again once ever still even like get got gets getting make makes made making ' +
  'add show open set put clear draw create give tell take want need please help thing things something anything everything one two way new now day days time week weekly month monthly year yearly ' +
  'back out up down off over under per via available gumroad void a-to-mind atom know say says said see look use used using work works working run runs running go going come let lets well good ' +
  'right sure okay hey hi hello thank thanks without within while because after before until since don doesn didn isn aren won wasn weren www http https com').split(/\s+/));
const IRR = { break: 'brok', brok: 'brok' };
function stem(w) {
  let x = w;
  if (x.length > 4) x = x.replace(/(ations|ation|ating|ated|ates|ings|ing|ure|ies|ied|ed|es|en|s)$/, '');
  if (x.length > 3) x = x.replace(/e$/, '');
  return IRR[x] || x;
}
export function terms(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/)) {
    if (w.length < 3 || STOP.has(w)) continue;
    const t = stem(w);
    if (t.length >= 3 && !STOP.has(t)) out.add(t);
  }
  return out;
}
const FIX_HINT = ['fix', 'brok', 'fail', 'diagnos', 'repair'];
// -> the best product, or null. fix = the ask was a broken automation (Void already answered with the fix; this line is optional).
export function productFor(ask, products, { fix = false } = {}) {
  const live = (products || []).filter((p) => p && p.available !== false && !isUnlock(p) && p.name);
  if (!live.length) return null;
  const docs = live.map((p) => ({ p, n: terms(shortName(p.name)), d: terms(p.description) }));
  const df = (t) => docs.filter((x) => x.n.has(t) || x.d.has(t)).length || 1;
  const A = terms(ask);
  if (fix) for (const t of FIX_HINT) A.add(t);
  if (!A.size) return null;
  const scored = docs.map(({ p, n, d }) => {
    let s = 0;
    for (const t of A) { const k = n.has(t) ? 3 : d.has(t) ? 1 : 0; if (k) s += k * Math.log(1 + docs.length / df(t)); }
    return { p, s };
  }).sort((x, y) => y.s - x.s);
  const [best, next] = scored;
  if (best.s < 2.5 || (next && best.s - next.s < 0.1)) return null;
  return best.p;
}
export function shortName(n) { return String(n || '').split(/\s+[—–]\s+|\s+-\s+/)[0].trim().slice(0, 80); }
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
    out.push({ slug, id: p.id || null, short: p.permalink || slug, name: String(p.name || slug), price_cents: Number(p.price_cents) || 0, currency: p.currency_code || 'usd', recurrence: p.recurrence || null, native_type: p.native_type || null, url: STORE + '/l/' + slug });
  }
  return out;
}
// product page HTML -> { name (og:title), price_cents, is_published, recurrence } or null
export function parseProductPage(html) {
  const og = /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/.exec(String(html || ''));
  const ogd = /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/.exec(String(html || ''));
  const j = dataPage(html), pr = j && j.props && j.props.product;
  if (!pr && !og) return null;
  let cents = pr ? Number(pr.price_cents) || 0 : null;
  const rec = pr && pr.recurrences && pr.recurrences.default ? pr.recurrences.default : null;
  if (pr && !cents && Array.isArray(pr.options)) { // tiered memberships keep the price on the tier
    const vals = pr.options.map((o) => o && o.recurrence_price_values && o.recurrence_price_values[rec || 'monthly'] && Number(o.recurrence_price_values[rec || 'monthly'].price_cents)).filter((x) => x > 0);
    if (vals.length) cents = Math.min(...vals);
  }
  const desc = ogd ? unesc(ogd[1]) : pr && pr.summary ? String(pr.summary) : '';
  return { name: og ? unesc(og[1]) : pr && pr.name, price_cents: cents, is_published: pr ? pr.is_published !== false : true, recurrence: rec, currency: pr && pr.currency_code, description: /^available on gumroad$/i.test(desc.trim()) ? '' : desc.slice(0, 1500) };
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
    if (d.description) p.description = d.description;
    if (d.name && !p.name) p.name = d.name;
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
    const fields = { id: f.id || (cur && cur.id) || null, description: f.description || (cur && cur.description) || '', short: f.short, name: f.name, price_cents: f.price_cents, currency: f.currency || 'usd', recurrence: f.recurrence || null, native_type: f.native_type || null, url: f.url || STORE + '/l/' + f.slug };
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
export const publicProduct = (p) => ({ slug: p.slug, id: p.id || null, name: shortName(p.name), description: String(p.description || '').slice(0, 800), price_cents: p.price_cents, currency: p.currency || 'usd', recurrence: p.recurrence || null, url: p.url || STORE + '/l/' + p.slug, available: p.available !== false });
