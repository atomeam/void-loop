// textdiff: what changed between two texts, line by line, for the diff checker card (skills/util.js, kind 'diffmaker').
// Unlike lib/linediff.js (which compares two answers and so folds spaces and drops blank lines), every character counts here:
// a space, a blank line and a changed case are differences. Pure: no DOM. tools/diff-md-tools.test.mjs tests it.

/** the most lines a side may have: the table is lines(a) x lines(b) numbers, so 3000 x 3000 stays under 40 MB. */
export const MAX_LINES = 3000;

/** the lines of a text: split on \n, \r\n or \r; one trailing newline is not an extra empty line. Pure. */
export function textLines(text) {
  const s = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  if (!s) return [];
  return (s.endsWith('\n') ? s.slice(0, -1) : s).split('\n');
}

/**
 * rows [{ t: 'same'|'del'|'add', s, a?, b? }] for two texts, with a and b the 1-based line numbers on each side, or
 * { tooLong: true } when a side has more than MAX_LINES lines. A longest-common-subsequence diff; removed lines come before
 * the added lines that replace them. Pure.
 */
export function diffTexts(A, B) {
  const a = textLines(A), b = textLines(B), n = a.length, m = b.length;
  if (n > MAX_LINES || m > MAX_LINES) return { tooLong: true };
  // the same lines at the start and the end need no table
  let lo = 0; while (lo < n && lo < m && a[lo] === b[lo]) lo++;
  let hiA = n, hiB = m; while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) { hiA--; hiB--; }
  const N = hiA - lo, M = hiB - lo, L = Array.from({ length: N + 1 }, () => new Uint32Array(M + 1));
  for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) L[i][j] = a[lo + i] === b[lo + j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const rows = [];
  for (let k = 0; k < lo; k++) rows.push({ t: 'same', s: a[k], a: k + 1, b: k + 1 });
  let i = 0, j = 0;
  while (i < N || j < M) {
    if (i < N && j < M && a[lo + i] === b[lo + j]) { rows.push({ t: 'same', s: a[lo + i], a: lo + i + 1, b: lo + j + 1 }); i++; j++; }
    else if (i < N && (j >= M || L[i + 1][j] >= L[i][j + 1])) { rows.push({ t: 'del', s: a[lo + i], a: lo + i + 1 }); i++; }
    else { rows.push({ t: 'add', s: b[lo + j], b: lo + j + 1 }); j++; }
  }
  for (let k = 0; k < n - hiA; k++) rows.push({ t: 'same', s: a[hiA + k], a: hiA + k + 1, b: hiB + k + 1 });
  return rows;
}

/** how many lines were removed, added and kept. Pure. */
export function diffCounts(rows) {
  const c = { del: 0, add: 0, same: 0 };
  for (const r of rows || []) c[r.t]++;
  return c;
}

/** the rows to show: a run of more than 2 * keep unchanged lines becomes { t: 'skip', n } between `keep` lines of context. Pure. */
export function withContext(rows, keep = 3) {
  const out = [];
  for (let k = 0; k < rows.length;) {
    if (rows[k].t !== 'same') { out.push(rows[k++]); continue; }
    let e = k; while (e < rows.length && rows[e].t === 'same') e++;
    const head = k === 0 ? 0 : keep, tail = e === rows.length ? 0 : keep;
    if (e - k > head + tail + 1) { out.push(...rows.slice(k, k + head), { t: 'skip', n: e - k - head - tail }, ...rows.slice(e - tail, e)); }
    else out.push(...rows.slice(k, e));
    k = e;
  }
  return out;
}
