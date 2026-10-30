// csvjson: CSV to JSON and JSON to CSV for the converter card (skills/util.js, kind 'csvjson'). The CSV reader is lib/note-tools.js
// parseCsv (commas, semicolons or tabs; quotes kept), with limits wide enough for a real file. The first row names the fields; an
// empty or repeated name gets "column N" or a "_2" suffix so no value is lost. A cell that is exactly a number, true, false or null
// becomes that JSON value; every other cell stays text, so "007" and "1,5" keep their form. Pure: no DOM.
// tools/csv-json-css-min.test.mjs tests it.
import { parseCsv } from './note-tools.js';

export const LIMITS = { rows: 5000, cols: 200, cell: 10000 };

const NUM = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
/** a CSV cell as a JSON value: a plain number, true, false or null as that value, anything else as the text. Pure. */
export function cellValue(s) {
  if (NUM.test(s) && s.length <= 15) return Number(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  return s;
}

/** the field names for a header row: an empty name is "column N", a repeated one gets "_2", "_3". Pure. */
export function fieldNames(head) {
  const seen = new Map();
  return head.map((h, i) => {
    let name = String(h || '').trim() || 'column ' + (i + 1);
    const n = (seen.get(name) || 0) + 1; seen.set(name, n);
    if (n > 1) { name += '_' + n; seen.set(name, 1); }
    return name;
  });
}

/** CSV text to { json, rows, cols } (json is the pretty text), or { error }. typed: false keeps every cell as text. Pure. */
export function csvToJson(text, { typed = true } = {}) {
  const rows = parseCsv(text, LIMITS);
  if (!rows.length) return { error: 'Paste CSV with a header row first.' };
  const width = Math.max(...rows.map((r) => r.length));
  const names = fieldNames(Array.from({ length: width }, (_, i) => rows[0][i]));
  const out = rows.slice(1).map((r) => Object.fromEntries(names.map((k, i) => [k, typed ? cellValue(r[i] == null ? '' : r[i]) : (r[i] == null ? '' : r[i])])));
  return { json: JSON.stringify(out, null, 2), rows: out.length, cols: names.length };
}

/** one CSV cell: quoted when it holds a comma, a quote, a line break or space at an end. Pure. */
export function csvCell(v) {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * JSON text to { csv, rows, cols }, or { error }. An array of objects gives one column per key (in the order keys first appear), an
 * array of arrays gives the rows as they are, and one object gives one row. A nested value is written as its JSON. Pure.
 */
export function jsonToCsv(text) {
  let data;
  try { data = JSON.parse(String(text || '')); } catch (e) { return { error: 'That is not valid JSON: ' + String(e.message || e).replace(/^JSON\.parse:\s*/, '') }; }
  if (data && !Array.isArray(data) && typeof data === 'object') data = [data];
  if (!Array.isArray(data) || !data.length) return { error: 'Give a JSON array of objects (or of rows) to make a table.' };
  if (data.every(Array.isArray)) {
    const cols = Math.max(...data.map((r) => r.length));
    return { csv: data.map((r) => r.map(csvCell).join(',')).join('\n'), rows: data.length, cols };
  }
  if (!data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) return { error: 'Every item must be an object, or every item a row (an array).' };
  const keys = [];
  for (const r of data) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  const lines = [keys.map(csvCell).join(','), ...data.map((r) => keys.map((k) => csvCell(r[k])).join(','))];
  return { csv: lines.join('\n'), rows: data.length, cols: keys.length };
}
