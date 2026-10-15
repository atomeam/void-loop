// Product gaps (Adam, 2026-10-15): when someone asks for something to buy or hire and no store product truly matches (or the
// relevance gate in lib/gumroad.js productFor rejects a weak match), Void shows no sponsor line and notes a gap for the ask's
// topic instead. Only the topic is kept: a few word stems, never the visitor's words (the repo and the log are public).
// Each distinct ask counts once per topic (its hash, never its text). When GAP_MIN distinct asks share a topic, one
// `store-gap:<topic>` job joins the build queue (void_queue) for Void's store self-publishing to draft a better product.
// Writes are one D1 batch per gap (dedupe row + topic count), plus the queue row once at the threshold.
import { productFor, intentOf, terms, isBuyAsk } from './gumroad.js';

export const GAP_MIN = 3;
const GENERIC = terms('buy buying purchase order hire hiring pay price prices much cost costs subscribe sell selling sale service services package packages plan shop store cheap best want someone anyone money dollars template kit bundle course');

// The ask's topic as up to 3 sorted stems ("logo-design"), or null when the ask isn't a buy/hire ask or a product matches.
export function gapTopic(ask, products) {
  const head = intentOf(ask);
  if (!head || !isBuyAsk(head)) return null;
  if (productFor(ask, products)) return null; // a real match gets its line, not a gap
  const t = [...terms(head)].filter((x) => !GENERIC.has(x) && /^[a-z]+$/.test(x)).sort((a, b) => b.length - a.length).slice(0, 3).sort();
  return t.length ? t.join('-').slice(0, 60) : null;
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s).toLowerCase().replace(/\s+/g, ' ').trim()));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
const T1 = 'CREATE TABLE IF NOT EXISTS void_gap_asks (topic TEXT NOT NULL, h TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (topic, h))';
const T2 = 'CREATE TABLE IF NOT EXISTS void_gaps (topic TEXT PRIMARY KEY, asks INTEGER NOT NULL, first TEXT NOT NULL, last TEXT NOT NULL, queued TEXT)';

// -> { topic, asks, queued } or null. Same ask twice never counts twice.
export async function recordGap(env, ask, products, now = new Date().toISOString()) {
  const topic = gapTopic(ask, products);
  if (!topic || !env || !env.DB) return null;
  const h = await sha(intentOf(ask));
  const db = env.DB;
  const res = await db.batch([
    db.prepare(T1), db.prepare(T2),
    db.prepare('INSERT OR IGNORE INTO void_gap_asks (topic, h, at) VALUES (?, ?, ?)').bind(topic, h, now),
    db.prepare(`INSERT INTO void_gaps (topic, asks, first, last) VALUES (?, (SELECT COUNT(*) FROM void_gap_asks WHERE topic = ?), ?, ?)
      ON CONFLICT(topic) DO UPDATE SET asks = (SELECT COUNT(*) FROM void_gap_asks WHERE topic = excluded.topic), last = excluded.last`).bind(topic, topic, now, now),
    db.prepare('SELECT asks, queued FROM void_gaps WHERE topic = ?').bind(topic),
  ]);
  const row = (res[4] && res[4].results && res[4].results[0]) || { asks: 0, queued: null };
  let queued = row.queued || null;
  if (!queued && row.asks >= GAP_MIN) {
    const id = Date.now().toString(36);
    await db.batch([
      db.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, 'Store product for: ' + topic.replace(/-/g, ' '), 'store-gap:' + topic, 'queued', GAP_MIN + '+ distinct asks, no matching product (paraphrased topic only)', now, now),
      db.prepare('UPDATE void_gaps SET queued = ? WHERE topic = ?').bind(id, topic),
    ]);
    queued = id;
  }
  return { topic, asks: row.asks, queued };
}
