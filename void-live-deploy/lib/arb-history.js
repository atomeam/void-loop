// What the free arbitrage scan has seen over time: one row per fresh scan (functions/api/arbitrage.js, a read the 20-second edge cache did not
// answer), and a summary of those rows for /trading-bots/arbitrage/ and GET /api/arbitrage?history=1. Every number comes from a real scan of
// public order books at the time in its row; nothing is filled in, averaged across gaps in time or projected. A scan that clears its costs is
// counted as one, not as money anyone made: it says the best pair would have ended above $1,000 at the prices read, before the gap closed.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED (docs/RULES.md): a stranger can only cause a scan by asking /api/arbitrage, which
// the edge cache answers for 20 s per coin; record() also skips a scan when the last row for that coin is under 15 s old and keeps 180 days,
// so the table grows by at most one row per coin per 15 s and stays under about 2.1 million rows. The summary is 3 indexed reads.
export const TABLE = 'void_arb_scans', KEEP_DAYS = 180, GAP_S = 15;
const DDL = `CREATE TABLE IF NOT EXISTS ${TABLE} (coin TEXT NOT NULL, at TEXT NOT NULL, venues INTEGER NOT NULL, best_buy TEXT, best_sell TEXT,
  best_net REAL, best_pct REAL, cleared INTEGER NOT NULL, PRIMARY KEY (coin, at))`;
const ready = new WeakMap(); // the table is made once per database binding
const ensure = (db) => { if (!ready.has(db)) ready.set(db, db.prepare(DDL).run().catch((e) => { ready.delete(db); throw e; })); return ready.get(db); };

/** The row a scan answer becomes, or null when it has no rows. Pure. */
export function rowOf(body) {
  if (!body || !Array.isArray(body.rows) || !body.rows.length || !body.at) return null;
  const b = body.rows.find((x) => x.filled) || body.rows[0]; // the best pair whose books could fill the whole trade
  return { coin: body.coin, at: new Date(body.at).toISOString(), venues: Object.keys((body.spread && body.spread.mids) || {}).length,
    best_buy: b.buy, best_sell: b.sell, best_net: Math.round(b.net * 100) / 100, best_pct: b.netPct, cleared: body.rows.filter((x) => x.net > 0 && x.filled).length };
}

/** Records one fresh scan. Returns true when a row was written. */
export async function record(db, body, now = Date.now()) {
  const r = rowOf(body); if (!db || !r) return false;
  await ensure(db);
  const last = await db.prepare(`SELECT at FROM ${TABLE} WHERE coin = ? ORDER BY at DESC LIMIT 1`).bind(r.coin).first('at');
  if (last && Date.parse(r.at) - Date.parse(last) < GAP_S * 1000) return false;
  const cutoff = new Date(now - KEEP_DAYS * 86400000).toISOString();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO ${TABLE} (coin, at, venues, best_buy, best_sell, best_net, best_pct, cleared) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(r.coin, r.at, r.venues, r.best_buy, r.best_sell, r.best_net, r.best_pct, r.cleared),
    db.prepare(`DELETE FROM ${TABLE} WHERE coin = ? AND at < ?`).bind(r.coin, cutoff),
  ]);
  return true;
}

/** The record for one coin: how many scans, over what time, how many had a pair that cleared every cost, the best one seen, and by pair. */
export async function summary(db, coin) {
  await ensure(db);
  const t = await db.prepare(`SELECT COUNT(*) AS scans, MIN(at) AS first, MAX(at) AS last, SUM(CASE WHEN cleared > 0 THEN 1 ELSE 0 END) AS cleared,
    AVG(best_net) AS avg_best FROM ${TABLE} WHERE coin = ?`).bind(coin).first();
  const best = await db.prepare(`SELECT at, best_buy AS buy, best_sell AS sell, best_net AS net, best_pct AS pct FROM ${TABLE} WHERE coin = ? ORDER BY best_net DESC LIMIT 1`).bind(coin).first();
  const pairs = (await db.prepare(`SELECT best_buy AS buy, best_sell AS sell, COUNT(*) AS times, SUM(CASE WHEN cleared > 0 THEN 1 ELSE 0 END) AS cleared,
    MAX(best_net) AS best FROM ${TABLE} WHERE coin = ? GROUP BY best_buy, best_sell ORDER BY times DESC LIMIT 8`).bind(coin).all()).results || [];
  const scans = Number(t && t.scans) || 0;
  return { coin, size: 1000, scans, first: scans ? t.first : null, last: scans ? t.last : null, cleared: Number(t && t.cleared) || 0,
    avgBestNet: scans ? Math.round(t.avg_best * 100) / 100 : null, best: scans ? best : null, pairs,
    note: 'One row per fresh free scan (a $1,000 trade at entry-tier taker fees), taken when someone or the scheduled check asked, so the times are uneven. Cleared means the best pair would have ended above $1,000 at the prices read; faster bots usually close such gaps first. Nothing was traded.' };
}
