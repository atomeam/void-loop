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
const arr1 = (v) => (Array.isArray(v) ? v : []);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (rej) => { const o = {}; for (const r of rej) o[r.why.replace(/[:(].*$/, '').slice(0, 60)] = (o[r.why.replace(/[:(].*$/, '').slice(0, 60)] || 0) + 1; return o; };
const shapes = (cands) => cands.slice(0, 3).map((c) => ({ licRaw: c.licRaw, licVersion: c.licVersion, licUrl: c.licUrl, own: !!c.own, hasAuthor: !!c.author, hasSourcePage: !!c.sourcePage, thumbHost: (() => { try { return new URL(c.thumb).hostname; } catch (_) { return ''; } })(), taken: c.taken }));

const env = process.env;
// the first array of objects (two levels down at most) and the keys of its first object, with the short text fields that carry rights: what a parser has to read
function resultShape(j) {
  const look = (o, path, d) => { if (!o || typeof o !== 'object') return null; if (Array.isArray(o)) return o.length && typeof o[0] === 'object' ? { path, n: o.length, keys: Object.keys(o[0]).slice(0, 40), rights: Object.fromEntries(Object.entries(o[0]).filter(([k, v]) => /right|licen|restrict|image|date|contrib/i.test(k)).map(([k, v]) => [k, JSON.stringify(v).slice(0, 160)])) } : null;
    if (d >= 2) return null; for (const [k, v] of Object.entries(o)) { const r = look(v, path + '.' + k, d + 1); if (r) return r; } return null; };
  return look(j, '$', 0);
}
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
    Object.assign(row, { state: 'works', query: q, status: r.meta.status, ms: r.meta.ms, via: r.meta.via, rate: r.meta.rate, topKeys: Object.keys(r.json || {}).slice(0, 40), resultShape: resultShape(r.json), found: r.cands.length, accepted: j.ok.length, refused: count(j.rejected), licenceShapes: shapes(r.cands) });
    const f0 = r.json && (arr1(r.json.results)[0] || arr1(r.json.content && r.json.content.results)[0]);
    if (id === 'loc' && f0) { const it = f0.item || {}; row.rightsFields = Object.fromEntries([...Object.entries(f0), ...Object.entries(it).map(([k, v]) => ['item.' + k, v])].filter(([k]) => /right|restrict|licen|access/i.test(k)).map(([k, v]) => [k, JSON.stringify(v).slice(0, 240)])); row.itemKeys = Object.keys(it).slice(0, 60); }
    if (!r.cands.length) row.state = 'answered, no candidates (parser or query?)';
  } catch (e) {
    Object.assign(row, { state: e && e.status === 429 ? 'rate limited (429)' : 'blocked or failed', status: e && e.meta ? e.meta.status : 0, rate: e && e.meta ? e.meta.rate : {}, error: redact(e && e.name === 'AbortError' ? 'timed out' : e && e.message) });
  }
  await wait(1200);
}
// loc.gov: the shape of its answers is not documented well, so a few variants are asked once each (3 s apart, far under its 20 a minute) and the shapes recorded; the parser follows what answers
if (process.argv.includes('--explore')) { // by hand only: loc.gov blocks a caller for an hour above 20 requests a minute, and this asks it four more times
  res.explore = {}; const ctxl = await F.probeContext(mk());
  for (const [name, url] of Object.entries({ photos: 'https://www.loc.gov/photos/?q=baseball&fo=json&c=5', search: 'https://www.loc.gov/search/?q=baseball&fo=json&fa=online-format:image&c=5', pictures: 'https://www.loc.gov/pictures/search/?q=baseball&fo=json', freeToUse: 'https://www.loc.gov/free-to-use/?fo=json' })) {
    await wait(3000);
    try { const r = await ctxl.http(url); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
      res.explore[name] = { status: r.status, json: !!j, topKeys: j ? Object.keys(j).slice(0, 40) : [], shape: j ? resultShape(j) : null, head: j ? undefined : t.slice(0, 120).replace(/\s+/g, ' '), contentKeys: j && j.content && typeof j.content === 'object' ? Object.keys(j.content).slice(0, 40) : undefined };
      if (j && j.results && j.results[0]) { const f0 = j.results[0], it = f0.item || {}; res.explore[name].firstResult = JSON.stringify(f0).slice(0, 600); res.explore[name].rightsFields = Object.fromEntries([...Object.entries(f0), ...Object.entries(it).map(([k, v]) => ['item.' + k, v])].filter(([k]) => /right|restrict|licen|access/i.test(k)).map(([k, v]) => [k, JSON.stringify(v).slice(0, 240)])); res.explore[name].itemKeys = Object.keys(it).slice(0, 60); }
    } catch (e) { res.explore[name] = { error: redact(e && e.message) }; }
  }
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
