// A small bundled record of year-end closes (the last trading day of 2023 and 2024), so "the close on a day" still answers when the free price sources do not
// (Stooq can ask for a key, Yahoo's chart feed can refuse a data centre). Used only as the last fallback of /api/markets?on=, only for these exact days, and said
// to be from this record. Closes as the exchanges published them (not dividend-adjusted; shares in US dollars, indices in points). Written from the published
// record by hand: if a figure is ever found wrong, correct it here and in tools/markets.test.mjs.
export const RECORD_NAME = 'Verse year-end record';
export const RECORD = Object.freeze({
  AAPL: { '2023-12-29': 192.53, '2024-12-31': 250.42 }, MSFT: { '2023-12-29': 376.04, '2024-12-31': 421.5 }, NVDA: { '2024-12-31': 134.29 }, AMZN: { '2024-12-31': 219.39 },
  GOOGL: { '2024-12-31': 189.3 }, META: { '2024-12-31': 585.51 }, TSLA: { '2024-12-31': 403.84 },
  SPX: { '2023-12-29': 4769.83, '2024-12-31': 5881.63 }, DJI: { '2024-12-31': 42544.22 },
});
/** { date, close } for a symbol on exactly a recorded day, or null. Pure. */
export function recordClose(sym, day) { const v = RECORD[sym] && RECORD[sym][day]; return v == null ? null : { date: day, close: v }; }
