// linediff — what changed between two answers, line by line (asked by the owner, 2026-10-18, stage pack G: ask-diff). Pure: no DOM, no clock.
// diffLines(a, b) is a longest-common-subsequence diff of two arrays of lines, with a removed line directly followed by an added one
// folded into one "chg" row; collapse(rows) turns every run of unchanged rows into one "skip" row. tools/stage-pack-g.test.mjs tests it.

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
/** the lines of a text: split on newlines, trimmed, blanks dropped. Pure. */
export const linesOf = (text) => String(text == null ? '' : text).split(/\n+/).map(norm).filter(Boolean);

/** rows [{ t: 'same'|'add'|'del'|'chg', a?, b? }] for two line arrays. Pure. */
export function diffLines(A, B) {
  const a = (A || []).map(norm), b = (B || []).map(norm), n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: 'same', a: a[i], b: b[j] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push({ t: 'del', a: a[i++] });
    else ops.push({ t: 'add', b: b[j++] });
  }
  while (i < n) ops.push({ t: 'del', a: a[i++] });
  while (j < m) ops.push({ t: 'add', b: b[j++] });
  const rows = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].t === 'same') { rows.push(ops[k++]); continue; }
    const dels = [], adds = [];
    while (k < ops.length && ops[k].t === 'del') dels.push(ops[k++]);
    while (k < ops.length && ops[k].t === 'add') adds.push(ops[k++]);
    const pair = Math.min(dels.length, adds.length);
    for (let p = 0; p < pair; p++) rows.push({ t: 'chg', a: dels[p].a, b: adds[p].b });
    for (let p = pair; p < dels.length; p++) rows.push(dels[p]);
    for (let p = pair; p < adds.length; p++) rows.push(adds[p]);
  }
  return rows;
}
/** runs of unchanged rows become one { t: 'skip', n }. Pure. */
export function collapse(rows) {
  const out = [];
  for (const r of rows) {
    if (r.t !== 'same') { out.push(r); continue; }
    const last = out[out.length - 1];
    if (last && last.t === 'skip') last.n++; else out.push({ t: 'skip', n: 1 });
  }
  return out;
}
/** true when nothing differs. Pure. */
export const identical = (rows) => rows.every((r) => r.t === 'same');

/** the two asks of `diff "x" and "y"` (both quoted, so a bare "diff command" question is not one), or null. Pure. */
export function diffAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = /^(?:diff|compare)\s+(["“'])(.{1,160}?)["”']\s+(?:and|vs\.?|versus|with|against|to)\s+["“'](.{1,160}?)["”']$/i.exec(t);
  if (!m) return null;
  const a = m[2].trim(), b = m[3].trim();
  return a && b && a.toLowerCase() !== b.toLowerCase() ? { a, b } : null;
}
