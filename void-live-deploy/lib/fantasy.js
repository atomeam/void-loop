// The fantasy page's pure half (void-live-deploy/fantasy/, tools/fantasy.test.mjs): a sheet the visitor pastes or opens (CSV, TSV or JSON, their players and their own numbers), read on the
// device, and the work done from the numbers they gave: player against player, start or sit, a trade, a draft board, and stats Verse derives from the box scores /api/scores reads.
// Nothing here fetches, and nothing is bundled: no projections, no paid feed. Every figure shown is one of the visitor's own columns or an average of box-score numbers.
import { fantasyPoints } from './scores.js';

const MAX_ROWS = 2000, MAX_COLS = 40;
const clean = (v, n = 60) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
/** a number from a cell ("12.5", "$14", "63%", "1,234", "-3"), or null */
export const numOf = (v) => { if (typeof v === 'number') return Number.isFinite(v) ? v : null; const s = String(v == null ? '' : v).trim().replace(/^[$€£]/, '').replace(/%$/, '').replace(/,(?=\d{3}\b)/g, ''); return /^[-+]?\d+(?:\.\d+)?$/.test(s) ? parseFloat(s) : /^[-+]?\.\d+$/.test(s) ? parseFloat(s) : null; };
/** CSV / TSV / semicolon text into rows of cells (quotes, doubled quotes, newlines in quotes). Pure. */
export function cells(text) {
  const t = String(text || '').replace(/^﻿/, ''), first = t.split(/\r?\n/, 1)[0], d = [['\t', first.split('\t').length], [';', first.split(';').length], [',', first.split(',').length]].sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === '') q = true; else if (c === d) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) break; } else cur += c; }
  row.push(cur); if (row.some((x) => x.trim() !== '')) rows.push(row); return rows;
}
/** a pasted or opened sheet as { ok, cols, rows, nameCol, numeric } or { ok: false, why }. Pure. */
export function parseSheet(text) {
  const t = String(text || '').trim(); if (!t) return { ok: false, why: 'Nothing pasted yet.' };
  let table;
  if (/^[\[{]/.test(t)) {
    let j; try { j = JSON.parse(t); } catch (_) { return { ok: false, why: 'That looks like JSON but does not parse.' }; }
    const list = Array.isArray(j) ? j : Array.isArray(j && j.players) ? j.players : Array.isArray(j && j.data) ? j.data : j && typeof j === 'object' ? Object.entries(j).map(([k, v]) => (v && typeof v === 'object' ? { name: k, ...v } : { name: k, value: v })) : [];
    if (!list.length || !list.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return { ok: false, why: 'The JSON needs a list of players, each an object with a name and numbers.' };
    const cols = [...new Set(list.slice(0, MAX_ROWS).flatMap((x) => Object.keys(x)))].slice(0, MAX_COLS); table = [cols, ...list.slice(0, MAX_ROWS).map((x) => cols.map((c) => (x[c] != null && typeof x[c] === 'object' ? '' : x[c])))];
  } else table = cells(t);
  if (table.length < 2) return { ok: false, why: 'A sheet needs a header row and at least one player.' };
  const cols = table[0].map((c, i) => clean(c, 40) || 'col' + (i + 1)).slice(0, MAX_COLS), rows = table.slice(1, MAX_ROWS + 1).map((r) => Object.fromEntries(cols.map((c, i) => [c, clean(r[i], 60)]))).filter((r) => Object.values(r).some(Boolean));
  const numeric = cols.filter((c) => { const v = rows.map((r) => r[c]).filter((x) => x !== ''); return v.length && v.filter((x) => numOf(x) != null).length / v.length >= 0.8; });
  const nameCol = cols.find((c) => /^(?:name|player|player name|full name)$/i.test(c)) || cols.find((c) => !numeric.includes(c)) || cols[0];
  const seen = new Set(); const uniq = rows.filter((r) => { const k = String(r[nameCol]).toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  return uniq.length ? { ok: true, cols, rows: uniq, nameCol, numeric: numeric.filter((c) => c !== nameCol) } : { ok: false, why: 'No player names found in the first column.' };
}
/** is a smaller number the better one for this column (rank, ADP, pick, tier, age)? Pure. */
export const lowerIsBetter = (col) => /\b(?:rank|rk|adp|pick|tier|age|bye|ovr)\b/i.test(String(col));
const by = (rows, nameCol, name) => rows.find((r) => String(r[nameCol]).toLowerCase() === String(name).toLowerCase());
/** players side by side: for each numeric column the values and which is best (ties share it). Pure. */
export function compare(sheet, names, cols = sheet.numeric) {
  const ps = names.map((n) => by(sheet.rows, sheet.nameCol, n)).filter(Boolean);
  return { players: ps.map((p) => p[sheet.nameCol]), lines: cols.map((c) => { const vals = ps.map((p) => numOf(p[c])), ok = vals.filter((v) => v != null), best = ok.length > 1 ? (lowerIsBetter(c) ? Math.min(...ok) : Math.max(...ok)) : null;
    return { col: c, lower: lowerIsBetter(c), raw: ps.map((p) => p[c]), vals, best: vals.map((v) => best != null && v === best && new Set(ok).size > 1) }; }) };
}
/** start or sit on the visitor's own column: the order, the margin to the next and the verdict, with the floor and ceiling columns if they gave them. Pure. */
export function startSit(sheet, names, col, floorCol = '', ceilCol = '') {
  const low = lowerIsBetter(col), ps = names.map((n) => by(sheet.rows, sheet.nameCol, n)).filter(Boolean).map((p) => ({ name: p[sheet.nameCol], v: numOf(p[col]), floor: floorCol ? numOf(p[floorCol]) : null, ceil: ceilCol ? numOf(p[ceilCol]) : null })).filter((p) => p.v != null);
  if (ps.length < 2) return { ok: false, why: 'Pick two or more players that have a number in ' + col + '.' };
  ps.sort((a, b) => (low ? a.v - b.v : b.v - a.v)); const gap = Math.abs(ps[0].v - ps[1].v), r = (x) => Math.round(x * 100) / 100;
  return { ok: true, order: ps, start: ps[0].name, sit: ps.slice(1).map((p) => p.name), margin: r(gap), verdict: (gap === 0 ? 'A tie on ' + col + ': ' + ps[0].name + ' and ' + ps[1].name + ' have the same number.' : 'Start ' + ps[0].name + ': ' + r(ps[0].v) + ' against ' + r(ps[1].v) + ' for ' + ps[1].name + ' in ' + col + ' (a margin of ' + r(gap) + ').')
    + (ps[0].floor != null && ps[1].floor != null && ps[1].floor > ps[0].floor ? ' ' + ps[1].name + ' has the higher floor (' + r(ps[1].floor) + ' against ' + r(ps[0].floor) + ').' : '') + (ps[0].ceil != null && ps[1].ceil != null && ps[1].ceil > ps[0].ceil ? ' ' + ps[1].name + ' has the higher ceiling (' + r(ps[1].ceil) + ' against ' + r(ps[0].ceil) + ').' : '') };
}
/** a trade in the visitor's own value column: what each side adds up to, the net and how fair it is. Pure. */
export function tradeValue(sheet, give, get, col) {
  const sum = (names) => names.map((n) => by(sheet.rows, sheet.nameCol, n)).filter(Boolean).reduce((s, p) => s + (numOf(p[col]) || 0), 0), g = sum(give), t = sum(get), r = (x) => Math.round(x * 100) / 100, lower = lowerIsBetter(col);
  if (!give.length || !get.length) return { ok: false, why: 'Pick at least one player on each side.' };
  const net = lower ? g - t : t - g, base = Math.max(Math.abs(g), Math.abs(t), 1e-9), pct = Math.round(Math.abs(net) / base * 1000) / 10;
  return { ok: true, give: r(g), get: r(t), net: r(net), pct, verdict: pct <= 5 ? 'Close to even on ' + col + ' (' + r(g) + ' for ' + r(t) + ').' : net > 0 ? 'You come out ahead by ' + r(Math.abs(net)) + ' ' + col + ' (' + pct + '%): ' + r(g) + ' for ' + r(t) + '.' : 'You give up ' + r(Math.abs(net)) + ' ' + col + ' (' + pct + '%): ' + r(g) + ' for ' + r(t) + '.' };
}
/** the draft board: the players ranked by a column (best first), with their numbers for the rest. Pure. */
export function board(sheet, col) {
  const low = lowerIsBetter(col); return sheet.rows.map((r) => ({ name: r[sheet.nameCol], v: numOf(r[col]), row: r })).filter((x) => x.v != null).sort((a, b) => (low ? a.v - b.v : b.v - a.v));
}
/** the players another page gets (the wheel, the random pick, prize odds, a tournament roster): the ones picked on this tab when there are two
 *  or more, each once and in the order picked; otherwise the top `max` of the draft board on `col`. Pure. */
export function namesToSend(sheet, picked, col, max = 20) {
  if (!sheet || !sheet.rows) return [];
  const seen = new Set(), mine = (picked || []).map((n) => String(n == null ? '' : n).trim()).filter((n) => n && !seen.has(n) && seen.add(n));
  return mine.length >= 2 ? mine : board(sheet, col).slice(0, max).map((x) => x.name);
}
/** one player-game per row from a game's box score (lib/scores.js readSummary players): { name, team, date, home, group, stats: { label: number }, fpts } for each player. Pure. */
export function entriesFrom(sum, grp, date, mode = 'ppr') {
  const g = sum && sum.game; if (!g) return [];
  const isHome = (t) => [g.home.abbr, g.home.name, g.home.short].filter(Boolean).some((x) => String(x).toLowerCase() === String(t).toLowerCase());
  return (sum.players || []).flatMap((t) => (t.groups || []).flatMap((gr) => (gr.rows || []).map((p) => {
    const stats = Object.fromEntries((gr.labels || []).map((l, i) => [l, numOf(String(p.stats[i] || '').split('/')[0])]).filter(([, v]) => v != null));
    const fp = grp === 'nfl' ? fantasyPoints(gr.name, gr.labels, p.stats, mode) : null;
    return { name: clean(p.name, 40), team: clean(t.team, 12), date: clean(date, 10), home: isHome(t.team), group: clean(gr.name, 20), stats, fpts: fp };
  })));
}
/** per player over the games collected: games, the average of a stat, the average of the last n games, and the home and away averages; ordered by the average. Pure. */
export function deriveStats(entries, stat, n = 3) {
  const per = new Map();
  for (const e of entries) { const v = stat === 'FPTS' ? e.fpts : e.stats[stat]; if (v == null) continue; const k = e.name + '|' + e.team; (per.get(k) || per.set(k, { name: e.name, team: e.team, g: [] }).get(k)).g.push({ date: e.date, home: e.home, v }); }
  const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x.v, 0) / a.length * 100) / 100 : null);
  return [...per.values()].map((p) => { const gs = p.g.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))); return { name: p.name, team: p.team, games: gs.length, avg: avg(gs), last: avg(gs.slice(-n)), home: avg(gs.filter((x) => x.home)), away: avg(gs.filter((x) => !x.home)), trend: gs.length >= 2 ? Math.round((avg(gs.slice(-n)) - avg(gs)) * 100) / 100 : null }; }).sort((a, b) => (b.avg || 0) - (a.avg || 0));
}
