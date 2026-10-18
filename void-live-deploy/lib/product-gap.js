// Product gaps (Adam, 2026-10-15): when someone asks for something to buy or hire and no store product truly matches (or the
// relevance gate in lib/gumroad.js productFor rejects a weak match), Verse shows no sponsor line and notes a gap for the ask's
// topic instead. Only the topic is kept: a few word stems, never the visitor's words (the repo and the log are public).
// Each ask adds one to its topic's count. When a topic reaches GAP_MIN asks, one
// `store-gap:<topic>` job joins the build queue (void_queue). Adam (2026-10-15, domains/void.decisions.json): Verse's self-made
// products go on sale automatically when the price is within the set range, with no trademarks, tested files and a public
// log entry each; anything outside the range stays a hidden draft.
// Writes are one D1 batch per gap (the topic count), plus the queue row once at the threshold.
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

const T2 = 'CREATE TABLE IF NOT EXISTS void_gaps (topic TEXT PRIMARY KEY, asks INTEGER NOT NULL, first TEXT NOT NULL, last TEXT NOT NULL, queued TEXT)';

// -> { topic, asks, queued } or null. A plain count of how often the topic is asked: nothing about who asked (no person,
// device, IP or ask hash) is kept (Claude's review, 2026-10-15; /privacy says so).
export async function recordGap(env, ask, products, now = new Date().toISOString()) {
  const topic = gapTopic(ask, products);
  if (!topic || !env || !env.DB) return null;
  const db = env.DB;
  const res = await db.batch([
    db.prepare(T2),
    db.prepare(`INSERT INTO void_gaps (topic, asks, first, last) VALUES (?, 1, ?, ?)
      ON CONFLICT(topic) DO UPDATE SET asks = asks + 1, last = excluded.last`).bind(topic, now, now),
    db.prepare('SELECT asks, queued FROM void_gaps WHERE topic = ?').bind(topic),
  ]);
  const row = (res[2] && res[2].results && res[2].results[0]) || { asks: 0, queued: null };
  let queued = row.queued || null;
  if (!queued && row.asks >= GAP_MIN) {
    const id = Date.now().toString(36);
    await db.batch([
      db.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, 'Store product for: ' + topic.replace(/-/g, ' '), 'store-gap:' + topic, 'queued', GAP_MIN + '+ asks, no matching product (topic only). Build the product; price it with lib/appraise.js (public why-this-price note), auto-publish, no trademarks, files tested, public log entry; otherwise keep it a hidden draft', now, now),
      db.prepare('UPDATE void_gaps SET queued = ? WHERE topic = ?').bind(id, topic),
    ]);
    queued = id;
  }
  return { topic, asks: row.asks, queued };
}
