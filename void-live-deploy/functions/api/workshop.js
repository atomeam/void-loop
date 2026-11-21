// POST /api/workshop: the owner workshop as MCP. Anyone else gets 401 and nothing runs.
// Each tool calls a route or library Verse already has. No new secret is created or printed.
import { ownerOk } from '../../lib/guard.js';
import { safePath, safeUrl } from '../../lib/automations.js';
import { pictureFor } from '../../lib/page-picture.js';
import { rpc } from '../../lib/workshop.js';
import { onRequestPost as queuePost } from './queue.js';
import { onRequestPost as paint } from './image.js';
import { onRequestGet as selfGet } from './selfcheck.js';
import { onRequestGet as searchesGet } from './searches.js';
import { readStatus } from './status.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function search(q) {
  const query = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (query.length < 2) return 'Name something to search for.';
  const url = 'https://en.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&search=' + encodeURIComponent(query);
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return 'The search did not answer.';
  const j = await r.json();
  const titles = j[1] || [], links = j[3] || [];
  return titles.map((t, i) => t + ' ' + (links[i] || '')).join('\n') || 'Nothing matched.';
}

async function fetchPage(raw) {
  if (!safeUrl(raw)) return 'That address is not a public https URL.';
  const r = await fetch(raw, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  if (r.status >= 300 && r.status < 400) return 'The page redirected. Fetch the next address yourself.';
  if (!r.ok) return 'The page answered ' + r.status + '.';
  const type = r.headers.get('content-type') || '';
  if (!/text|json|xml/.test(type)) return 'That page is not text.';
  return (await r.text()).slice(0, 8000);
}

async function queue(request, env, target, ask) {
  const res = await queuePost({ request: new Request(new URL('/api/queue', request.url), { method: 'POST', headers: { authorization: request.headers.get('authorization') || '', 'content-type': 'application/json' }, body: JSON.stringify({ target: String(target).slice(0, 40), ask: String(ask).slice(0, 200) }) }), env });
  const body = await res.json().catch(() => null);
  return body && body.item ? 'Queued ' + body.item.id + ' ' + body.item.target : 'The queue did not take it (' + res.status + ').';
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'owner only' } }, 401);
  let msg; try { msg = JSON.parse(await request.text()); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const ctx = {
    search,
    fetchPage,
    page: async (path) => {
      const res = await selfGet();
      const body = await res.json().catch(() => ({}));
      const pages = (body.report && body.report.pages) || [];
      const hit = pages.find((p) => p && p.path === path);
      const say = hit ? path + ': ' + (hit.problems || []).map((x) => x.kind).join(', ') : 'No self-check row for that path.';
      return say + ' The stranger gate is lib/stranger.js. This call does not open a browser.';
    },
    tests: (file) => queue(request, env, 'growth:test', 'Run ' + file),
    propose: async (files) => {
      const ok = (files || []).filter((f) => f && safePath(f.path));
      if (!ok.length) return 'No allowed file path.';
      return queue(request, env, 'growth:proposal', 'Apply ' + ok.length + ' file(s) on a copy, then the stranger gate. First: ' + ok[0].path);
    },
    searches: async () => {
      const res = await searchesGet({ request, env });
      if (res.status !== 200) return 'The searches log did not answer (' + res.status + ').';
      const b = await res.json().catch(() => ({}));
      const rows = Array.isArray(b.rows) ? b.rows.slice(0, 20) : [];
      return rows.map((r) => (r.kind || 'ask') + ' ' + String(r.ask || '').slice(0, 80)).join('\n') || 'The searches log is empty.';
    },
    growth: async () => {
      if (!env || !env.ASSETS) return 'No board is published.';
      const r = await env.ASSETS.fetch(new Request(new URL('/growth/latest.json', request.url)));
      if (!r.ok) return 'No growth board yet.';
      const b = await r.json();
      return 'Pass rate ' + (b.passRate == null ? 'none yet' : b.passRate) + ', building ' + b.n + ', cost ' + ((b.cost && b.cost.paidCents) || 0) + ' cents.';
    },
    picture: async (title) => { const url = await pictureFor(title); return url || 'No public photo for that.'; },
    paint: async (prompt) => {
      const res = await paint({ request: new Request(new URL('/api/image', request.url), { method: 'POST', headers: { authorization: request.headers.get('authorization') || '', 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) }), env });
      const b = await res.json().catch(() => ({}));
      return b.state === 'art' ? 'Painted.' : (b.say || b.why || 'The painter did not run.');
    },
    deploy: async () => {
      const s = await readStatus(env);
      const self = await selfGet();
      const report = await self.json().catch(() => ({}));
      return 'Guards up: ' + (s.all ? 'yes' : 'no') + ', down ' + (s.down || 0) + '. Self-check broken: ' + ((report.report && report.report.broken) || 0) + '.';
    },
    rollback: (sha) => queue(request, env, 'heal:deploy', 'Roll back through the live-revert path' + (/^[0-9a-f]{7,40}$/.test(sha) ? ' ' + sha : '')),
    cost: async () => {
      if (!env || !env.ASSETS) return 'No cost log is published.';
      const r = await env.ASSETS.fetch(new Request(new URL('/growth/latest.json', request.url)));
      if (!r.ok) return 'No cost log yet. A growth run records cents on the board.';
      const b = await r.json();
      return ((b.cost && b.cost.note) || 'No cost note.') + ' Paid cents: ' + ((b.cost && b.cost.paidCents) || 0) + '.';
    },
  };
  const reply = await rpc(msg, ctx);
  return reply ? json(reply) : new Response(null, { status: 202 });
}

export function onRequestGet() {
  return new Response('Owner workshop MCP. POST JSON-RPC.\n', { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
}
