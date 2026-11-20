#!/usr/bin/env node
// The creation lane's choice of what to make next, from what people want (void-live-deploy/lib/demand.js): the ask bar's misses
// (needs VOID_MISSES_TOKEN, the same read tools/misses.mjs does) and the open rows of docs/GAPS.md. It records the pick on the quality board
// (`next`), and a page that already does the job is extended instead of duplicated.
//   node tools/quality-create.mjs next        print and record the most-wanted thing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromMisses, fromGaps, mostWanted, publicForm } from '../void-live-deploy/lib/demand.js';
import { redact } from './misses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOARD = path.join(root, 'void-live-deploy/quality/board.json');
const read = (f, d) => { try { return fs.readFileSync(f, 'utf8'); } catch { return d; } };

async function missRows(env, fetchFn) {
  if (!env.VOID_MISSES_TOKEN) return { rows: [], note: 'no VOID_MISSES_TOKEN here, so the ask bar misses were not read' };
  const r = await fetchFn('https://a-to-mind.com/api/misses', { headers: { authorization: 'Bearer ' + env.VOID_MISSES_TOKEN, 'user-agent': 'a2m-quality/1.0' } }).catch(() => null);
  if (!r || !r.ok) return { rows: [], note: 'the ask bar misses could not be read (' + (r ? 'HTTP ' + r.status : 'no answer') + ')' };
  return { rows: await r.json().catch(() => []), note: '' };
}

export async function next({ env = process.env, fetchFn = fetch, pages = null, gapsMd = read(path.join(root, 'docs/GAPS.md'), ''), boardFile = BOARD, save = true } = {}) {
  const m = await missRows(env, fetchFn);
  if (!pages) { const { sitePages } = await import('./design-loop.mjs'); pages = sitePages().map((p) => ({ path: p.url, title: p.title || '', about: p.description || p.title || '' })); }
  const items = [...fromMisses(m.rows, redact), ...fromGaps(gapsMd)];
  const pick = mostWanted(items, pages), form = publicForm(pick);
  const rec = (() => { try { return JSON.parse(read(boardFile, 'null')) || null; } catch { return null; } })();
  const out = { at: new Date().toISOString(), pick: form, signals: { misses: m.rows.length, gaps: items.filter((i) => i.source === 'gaps list').length }, note: m.note };
  if (save && rec) { rec.next = out; fs.writeFileSync(boardFile, JSON.stringify(rec) + '\n'); }
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) next().then((o) => { console.log(JSON.stringify(o)); process.exit(0); }).catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
