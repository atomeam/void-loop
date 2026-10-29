// Pay a percentage, get that percentage (Adam, 2026-10-15; docs/store.md "Pay a share"). A pay-what-you-want product that
// has an appraised price (pwyw: true, cents > 0) sells in shares: paying p% of the price unlocks the first ceil(p% x N) of its
// N paid items, in a stable order (free items such as the README first and always included, then by value, starter items
// first). At least one paid item for any payment above $0; 100% or more unlocks everything. A truly free product (cents 0)
// stays fully free and never goes through this file.
// The share is decided ONLY from the amount a provider verified (Stripe's signed amount_total, Gumroad's keyed ping / API
// sale.price), summed per order with any later top-ups credited by order id. Nothing a browser or chat sends can move it:
// download tokens carry no item count, the server recomputes it from the order row every time.
const FREE_RE = /^readme(\.[a-z0-9]+)?$/i;

export const isShareProduct = (p) => !!(p && p.pwyw && p.cents > 0 && Array.isArray(p.contents) && p.contents.length);

/** the stable order: p.order (Verse's value ranking, starter items first) if given, else contents order; free items lead. */
export function shareItems(p) {
  const names = (Array.isArray(p.order) && p.order.length ? p.order : p.contents || []).filter((n, i, a) => typeof n === 'string' && a.indexOf(n) === i);
  const freeSet = new Set([...(p.freeItems || []), ...names.filter((n) => FREE_RE.test(n))]);
  return { free: names.filter((n) => freeSet.has(n)), paid: names.filter((n) => !freeSet.has(n)) };
}

/** integer-exact ceil(paid / price * n), clamped: >0 paid -> at least 1, >= price -> all. */
export function unlockCount(paidCents, priceCents, n) {
  const paid = Math.max(0, Math.floor(Number(paidCents) || 0)), price = Math.floor(Number(priceCents) || 0);
  if (!(n > 0)) return 0;
  if (price <= 0 || paid >= price) return n;
  if (paid <= 0) return 0;
  return Math.min(n, Math.max(1, Math.ceil((paid * n) / price - 1e-9)));
}

/** what a verified total buys: { pct, k, n, unlocked (names, free first), locked, upgradeCents } */
export function shareFor(p, paidCents) {
  const { free, paid } = shareItems(p), n = paid.length;
  if (!isShareProduct(p)) return { pct: 100, k: n, n, unlocked: [...free, ...paid], locked: [], upgradeCents: 0 };
  const k = unlockCount(paidCents, p.cents, n), pct = Math.min(100, Math.floor((Math.max(0, paidCents) * 100) / p.cents));
  return { pct, k, n, unlocked: [...free, ...paid.slice(0, k)], locked: paid.slice(k), upgradeCents: k >= n ? 0 : Math.max(0, p.cents - Math.max(0, paidCents)) };
}

/** the explainer the store card shows: 'Pay $4 of $10 and get 4 of 10 models' */
const usd = (c) => '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
export function shareLine(p, payCents, noun = 'items') {
  const s = shareFor(p, payCents);
  return `Pay ${usd(Math.max(0, payCents))} of ${usd(p.cents)} and get ${s.k} of ${s.n} ${noun}`;
}
/** public card data (no R2 keys): price, item names in order, which are free */
export function publicShare(p) {
  if (!isShareProduct(p)) return null;
  const { free, paid } = shareItems(p);
  return { price: p.cents, free, items: paid, noun: p.pack === 'print-set' ? 'models' : p.pack === 'clips' ? 'clips' : 'items', min: 100 };
}
export const itemKey = (p, name) => 'store/' + p.id + '/items/' + name; // pre-split files in R2 (tools/store-publish.mjs --share)

/** the amount a provider verified for one order: the order row plus every credited top-up. */
export async function paidTotal(D, order) {
  const r = await D.prepare('SELECT COALESCE(SUM(cents),0) AS c FROM store_credits WHERE order_id=?').bind(order.id).first().catch(() => null);
  return (Number(order.cents) || 0) + (Number(r && r.c) || 0);
}
export const CREDITS_TABLE = 'CREATE TABLE IF NOT EXISTS store_credits (ref TEXT PRIMARY KEY, order_id TEXT NOT NULL, cents INTEGER NOT NULL, provider TEXT, at TEXT)';

// ---- a stored-method zip of the unlocked items (no compression: STLs and MP4s are already dense; no dependency) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zipStore(files) { // files: [{ name, data: Uint8Array }]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data); central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + f.data.length;
  }
  const csize = central.reduce((s, b) => s + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((s, b) => s + b.length, 0)); let o = 0;
  for (const b of all) { out.set(b, o); o += b.length; }
  return out;
}
