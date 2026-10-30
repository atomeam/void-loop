// The server half of the subject evaluation: /api/answer run against stubbed Wikipedia (MediaWiki's own reply shapes) and a canned model answer.
// The sandbox has no network, so a fixture says what Wikipedia would return; the code under test is the real answer route. Used by
// tools/subject-eval.mjs and tools/subject-eval.test.mjs. fixture: { ask, wiki: { search: [{ title, description, extract }], redirect: { to, tofragment }, fts: [hits], pages: { Title: wikitext } }, model }
import { onRequestPost } from '../void-live-deploy/functions/api/answer.js';
const J = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
/** live: Wikipedia, Wikidata and the picture sources are really asked (a runner with a network); only the model is stood in for by a faithful one
 *  that repeats source [1], or says it has no information when there is none, so what is measured is the retrieval, the kinds and the card. */
export async function answerFor(fx, { live = false } = {}) {
  const w = fx.wiki || {}, real = globalThis.fetch;
  if (!live) globalThis.fetch = async (u) => {
    const url = String(u);
    if (/\/api\/rest_v1\/page\/summary\//.test(url)) { const t = decodeURIComponent(url.split('/summary/')[1]).replace(/_/g, ' '); const p = (w.search || []).find((x) => x.title === t); return p ? J({ title: p.title, extract: p.extract, description: p.description || '', timestamp: p.timestamp || '2026-09-01T00:00:00Z', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')) } } }) : new Response('{}', { status: 404 }); }
    if (/redirects=1/.test(url)) return J(w.redirect ? { query: { redirects: [{ from: 'x', to: w.redirect.to, tofragment: w.redirect.tofragment }] } } : { query: {} });
    if (/prop=extracts/.test(url)) { const t = decodeURIComponent(/titles=([^&]+)/.exec(url)[1]); return J({ query: { pages: { 1: { title: t, extract: (w.pages || {})[t] || '', touched: '2026-09-01T00:00:00Z' } } } }); }
    if (/commons\.wikimedia\.org/.test(url)) return J(w.commons ? { query: { pages: Object.fromEntries(w.commons.map((c, i) => [i + 1, { title: 'File:' + c.file, imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + c.file, thumbwidth: 1024, thumbheight: 683, descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + c.file, extmetadata: { LicenseShortName: { value: c.lic || 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' }, Artist: { value: c.artist || 'A. Photographer' }, ObjectName: { value: c.file }, ImageDescription: { value: c.about || '' }, Categories: { value: c.about || '' } } }] }])) } } : { query: {} });
    if (/list=search/.test(url)) { const quoted = /srsearch=%22/.test(url); return J({ query: { search: quoted ? (w.fts || []) : (w.search || []).map((x) => ({ title: x.title })) } }); }
    return new Response('', { status: 204 });
  };
  const calls = { ai: 0 };
  const env = { SALT: 'x', DB: { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({ results: [{ n: 1 }] }), all: async () => ({ results: [{ n: 1 }] }) }), first: async () => null, run: async () => ({ results: [{ n: 1 }] }), all: async () => ({ results: [] }) }) },
    AI: { run: async (model, inp) => { calls.ai++; if (inp && inp.text) throw new Error('no embeddings in the stub'); calls.prompt = JSON.stringify(inp.messages || '');
      if (!live) return { response: fx.model };
      const user = String(((inp.messages || [])[1] || {}).content || ''), srcs = (user.split('Sources:\n')[1] || '').trim();
      if (!srcs || /^\(no sources found\)/.test(srcs)) return { response: 'I do not have information regarding that. It is not contained within the provided sources.' };
      const m = /^\[1\] [^\n]*?: ([\s\S]*?)(?:\n\n\[2\]|$)/.exec(srcs); return { response: m ? m[1].slice(0, 600) + ' [1]' : 'I do not have information about that.' }; } } };
  const cache = new Map(); globalThis.caches = { default: { match: async (r) => cache.get(r.url), put: async (r, v) => { cache.set(r.url, v); } } };
  try {
    const res = await onRequestPost({ request: new Request('https://a-to-mind.com/api/answer', { method: 'POST', body: JSON.stringify({ ask: fx.ask }), headers: { 'cf-connecting-ip': '1.1.1.' + Math.floor(Math.random() * 250) } }), env, waitUntil: () => {} });
    return { json: await res.json(), prompt: calls.prompt || '' };
  } finally { if (!live) globalThis.fetch = real; }
}
