// Checks every fact a /world/ scene states against its source page (Wikipedia, read live): the exact words each fact rests on must be on the page.
// Score = facts verified / facts stated. node tools/world-facts.mjs [thing]   (default snail)   Prints one JSON line; exit 1 when a fact is not found.
import { fileURLToPath, pathToFileURL } from 'node:url'; import path from 'node:path';
export const norm = (s) => String(s || '').toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
/** one fact against the page text: found when its quote sits on the page. Pure. */
export const checkFact = (fact, pageText) => ({ id: fact.id, ok: !!fact.quote && norm(pageText).includes(norm(fact.quote)) });
export const titleOf = (url) => { const m = String(url || '').match(/^https:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/); return m ? decodeURIComponent(m[1]) : ''; };
export async function pageText(title, get = fetch) {
  const r = await get('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=' + encodeURIComponent(title), { headers: { 'user-agent': 'verse-facts/1 (a-to-mind.com)' } });
  const j = await r.json(); return Object.values((j.query && j.query.pages) || {}).map((p) => p.extract || '').join('\n');
}
export async function verify(facts, get = fetch) {
  const pages = new Map(), out = [];
  for (const f of facts) { const t = titleOf(f.url); if (!pages.has(t)) pages.set(t, t ? await pageText(t, get).catch(() => '') : ''); out.push(checkFact(f, pages.get(t))); }
  const ok = out.filter((x) => x.ok).length; return { total: out.length, verified: ok, score: out.length ? Math.round((100 * ok) / out.length) : 0, failed: out.filter((x) => !x.ok).map((x) => x.id) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const thing = process.argv[2] || 'snail', { manifest } = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../void-live-deploy/world/' + thing + '-facts.js')).href);
  const r = await verify(manifest.facts); console.log(JSON.stringify({ thing, ...r })); process.exit(r.failed.length ? 1 : 0);
}
