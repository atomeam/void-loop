// The weekly probe of every free picture source (lib/free-pics.js): one polite request each with a closed test query, from a GitHub runner (the build sandbox cannot reach them).
// Writes domains/free-pics.probe.json: per source the state, status, latency, rate-limit headers, the shape of the licence fields, and how many pictures the filter accepted or refused with the
// reasons. No picture bytes, no key (keys come from the environment and are redacted). Usage: node tools/free-pics-probe.mjs [--out file] [--only id,id]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as F from '../void-live-deploy/lib/free-pics.js';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const out = arg('--out') || 'domains/free-pics.probe.json', only = (arg('--only') || '').split(',').filter(Boolean);
const QUERY = { nasa: 'moon', met: 'horse', aic: 'horse', cleveland: 'horse', smithsonian: 'baseball', archive: 'football', loc: 'baseball' };
const KIND = { nasa: 'space', met: 'art', aic: 'art', cleveland: 'art', smithsonian: 'history', loc: 'history' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (rej) => { const o = {}; for (const r of rej) o[r.why.replace(/[:(].*$/, '').slice(0, 60)] = (o[r.why.replace(/[:(].*$/, '').slice(0, 60)] || 0) + 1; return o; };
const shapes = (cands) => cands.slice(0, 3).map((c) => ({ licRaw: c.licRaw, licVersion: c.licVersion, licUrl: c.licUrl, own: !!c.own, hasAuthor: !!c.author, hasSourcePage: !!c.sourcePage, thumbHost: (() => { try { return new URL(c.thumb).hostname; } catch (_) { return ''; } })(), taken: c.taken }));

const env = process.env;
const res = { at: new Date().toISOString(), note: 'one polite request per source; no keys, no picture bytes', sources: {}, rejectionLogic: {} };
const mk = () => { const o = { env, fetch: globalThis.fetch, timeoutMs: 8000, polite: 1000 }; return o; };
const redact = (s) => String(s || '').replace(/(api_key|wskey|key)=[^&\s]+/gi, '$1=***').slice(0, 160);

for (const id of Object.keys(F.SOURCES)) {
  if (only.length && !only.includes(id)) continue;
  const st = F.sourceState(id, env), row = { name: F.SOURCES[id].name, state: st.on ? 'asked' : 'needs key', why: st.why };
  res.sources[id] = row; if (!st.on) continue;
  const q = QUERY[id] || 'football', kind = KIND[id] || 'sport';
  try {
    const r = await F.fetchSource(id, q, await F.probeContext(mk()));
    const j = F.judge(r.cands, { sourceId: id, q, kind, date: '' });
    Object.assign(row, { state: 'works', query: q, status: r.meta.status, ms: r.meta.ms, via: r.meta.via, rate: r.meta.rate, topKeys: Object.keys(r.json || {}).slice(0, 8), found: r.cands.length, accepted: j.ok.length, refused: count(j.rejected), licenceShapes: shapes(r.cands) });
    if (!r.cands.length) row.state = 'answered, no candidates (parser or query?)';
  } catch (e) {
    Object.assign(row, { state: e && e.status === 429 ? 'rate limited (429)' : 'blocked or failed', status: e && e.meta ? e.meta.status : 0, rate: e && e.meta ? e.meta.rate : {}, error: redact(e && e.name === 'AbortError' ? 'timed out' : e && e.message) });
  }
  await wait(1200);
}
// rejection logic with names: a named player is searched on Commons only (never stock), and what the filter does with it is recorded
try {
  const o = { ...mk(), kind: 'player', fromAnswer: true, sources: ['commons', 'pexels', 'pixabay', 'unsplash'], cache: null, max: 5 };
  const r = await F.findPicturesDetailed('Michael Jordan', o);
  res.rejectionLogic.namedPlayer = { accepted: r.pics.map((p) => ({ source: p.source, licence: p.licence, archive: p.archive })), report: r.report.map((x) => ({ source: x.source, skipped: x.skipped, found: x.found, kept: x.kept, refused: x.rejected ? count(x.rejected) : undefined, error: x.error })) };
} catch (e) { res.rejectionLogic.namedPlayer = { error: redact(e && e.message) }; }
for (const q of ['stadium', 'Wembley']) {
  try { const r = await F.findPicturesDetailed(q, { ...mk(), sources: ['commons'], cache: null, fromAnswer: true, max: 3 }); res.rejectionLogic[q] = { accepted: r.pics.length, report: r.report.map((x) => ({ source: x.source, found: x.found, kept: x.kept, refused: x.rejected ? count(x.rejected) : undefined, error: x.error })) }; } catch (e) { res.rejectionLogic[q] = { error: redact(e && e.message) }; }
  await wait(1200);
}
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log(Object.entries(res.sources).map(([k, v]) => k + ': ' + v.state + (v.status ? ' ' + v.status : '') + (v.found != null ? ' found ' + v.found + ' accepted ' + v.accepted : '')).join('\n'));
