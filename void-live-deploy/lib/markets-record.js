// A small bundled record of year-end closes (the last trading day of 2023 and of 2024), so "the close on a day" still answers when the free price sources do not
// (Stooq can ask for a key, Yahoo's chart feed can refuse a data centre). Used only as the last fallback of /api/markets?on=, only for these exact days, and said
// to be from this record. Every figure here was checked against the Associated Press's market reports of those days ("How major US stock indexes fared",
// 12/29/2023 and 12/31/2024), more than one outlet each (2026-10-26); a figure that could not be confirmed from a source is not kept. Indices in points. To add one:
// confirm it from a published report first, then put the test beside it (tools/markets.test.mjs).
export const RECORD_NAME = 'Verse year-end record (AP market reports)';
export const RECORD = Object.freeze({
  SPX: { '2023-12-29': 4769.83, '2024-12-31': 5881.63 },
  DJI: { '2023-12-29': 37689.54, '2024-12-31': 42544.22 },
});
/** { date, close } for a symbol on exactly a recorded day, or null. Pure. */
export function recordClose(sym, day) { const v = RECORD[sym] && RECORD[sym][day]; return v == null ? null : { date: day, close: v }; }
