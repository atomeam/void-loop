#!/usr/bin/env node
// The public API's description (void-live-deploy/openapi.json, found from /.well-known/api-catalog) against the real routes.
//   node tools/openapi-check.mjs    one line per problem, exit 1 if any
// Checks: every operation in the spec has a function file that answers its method (or, for GET, a static file); every /api route file is either in the spec
// or named below as Void's own, with why; the catalog points at the spec. A new route fails here until someone decides which it
// is, so the description never drifts from the code and nothing internal is published by accident.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../void-live-deploy/', import.meta.url).pathname;
const FN = join(ROOT, 'functions');

// Void's own routes: the page, the owner, signed-in accounts or other services call them. Left out of openapi.json on purpose.
export const INTERNAL = {
  '/api/react': "the showcase's reaction bar: a closed list of six reactions and a showcase slug in, integer counts out, rate limited per hashed client (functions/api/react.js, lib/reactions.js, docs/playbooks/open-endpoint-closed-list.md); the page is the only caller",
  '/api/store/{[path}]': "the /store page's own API: catalog, checkout, receipts and signed downloads (functions/api/store/[[path]].js, docs/store.md)",
  '/api/merge': "the merge card's own API: two idea names in, a cached model-written name and line out; the page is the only caller (functions/api/merge.js, skills/merge.js)",
  '/api/repo': "the repo card's own API: a public GitHub owner/name in, its cleaned live facts out, no token (functions/api/repo.js, lib/repo-look.js, skills/repo.js); the page is the only caller",
  '/api/media': "the song and show cards' own API: a mood or title in, real tracks or shows from free public catalogs out, GET only (functions/api/media.js, lib/media.js, skills/media-pick.js); the page is the only caller",
  '/api/movies': "the movie card's own API: a title or a pick in, real films with legal places to watch out, GET only (functions/api/movies.js, lib/movies.js, skills/movie.js); the page is the only caller",
  '/api/card-art': "the Art Forge: a card's subject in, one cached painted picture out (functions/api/card-art.js, lib/art-rules.js, lib/card-forge.js); the page is the only caller",
  '/api/digest': "the page's digest card: a pasted transcript or an open-captions video, summarized for that ask only (functions/api/digest.js, lib/digest.js)",
  '/api/film-review': 'the films page review form: members and the owner give a film a verdict and a note (functions/api/film-review.js)',
  '/api/film-views': 'Verse Tube view counts on /films/: one D1 upsert per view, read for the grid (functions/api/film-views.js)',
  '/api/actions': 'the actions record, for the page and the owner',
  '/api/propose-fix': "Verse proposes the narrowest matcher fix for an ask its own probe missed (owner only, frontier #28 step 3; tools/propose-fix.mjs and its daily workflow are the only callers)",
  '/api/probe-asks': "Verse writes its own probe asks for one skill family (owner only, frontier #28; tools/probe-asks.mjs and its daily workflow are the only callers)",
  '/api/voice-reply': "the owner talks back to Verse on its self card and under any card; Verse answers and keeps the lesson (owner only; functions/api/voice-reply.js, lib/voice.js)",
  '/api/probe-log': "Verse's probe ledger: counts and outcomes the growth card shows, written by its probe and fix tools (POST owner only; lib/probe-log.js)",
  '/api/v01d-fixes': "approve one of Verse's own fix pull requests that waits for the owner (owner only; skills/v01d-fixes.js, lib/v01d-fixes.js)",
  '/api/answer': "the page's answer model",
  '/api/appraise': "the page's appraise card: one photo in, Verse's valuation out (functions/api/appraise.js, lib/appraise-photo.js)",
  '/api/video': "the page's video card: search and link lookup for the official embeds (functions/api/video.js)",
  '/api/approval': 'the approve card, signed-in',
  '/api/aurora': "the page's aurora card",
  '/api/automations': 'automations, signed-in',
  '/api/automations/tick': 'the scheduler, owner key',
  '/api/bench': 'the benchmarks, owner key',
  '/api/earnings': "the page's earnings card",
  '/api/figurescript': "the page's 3D figures",
  '/api/gumroad': "Gumroad's ping, server to server",
  '/api/handoff': 'agent handoff, owner key',
  '/api/hook/{id}': 'automation webhooks, one secret URL each',
  '/api/memory': 'what Void remembers, owner only',
  '/api/mine': "a person's own Void, passkey session",
  '/api/miss': 'the page reports a miss',
  '/api/misses': 'the miss board, owner token',
  '/api/passkey': 'sign in with a passkey, for the page',
  '/api/publish': 'publishing a skill, owner',
  '/api/queue': 'the build queue, owner token',
  '/api/reflect': "Void's reflections, owner",
  '/api/rehearsal': 'the sales rehearsal, owner',
  '/api/routes': "the page's router",
  '/api/routines': 'routines, signed-in',
  '/api/share': 'shared Voids, for the page',
  '/api/share/{room}': 'a shared Void room (WebSocket)',
  '/api/watch': 'watches, signed-in',
  '/api/where': "the page's place lookup",
  '/api/markets': "the crypto card's edge-cached price list",
  '/api/will': "Void's will card",
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// functions/api/hook/[id].js -> /api/hook/{id}; functions/api/share/index.js -> /api/share; functions/tools.json.js -> /tools.json
export function routeOf(file) {
  let r = '/' + relative(FN, file).replace(/\\/g, '/').replace(/\.js$/, '').replace(/\/index$/, '');
  return r.replace(/\[([^\]]+)\]/g, '{$1}');
}
export function methodsOf(src) {
  if (/export\s+(async\s+)?(function|const)\s+onRequest\b/.test(src)) return new Set(METHODS);
  return new Set([...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+onRequest(Get|Post|Put|Patch|Delete)\b/g)].map((m) => m[1].toLowerCase()));
}

export function check({ spec, routes, catalog, statics = new Set() }) {
  const problems = [];
  for (const [path, ops] of Object.entries(spec.paths || {})) {
    const have = routes.get(path) || (statics.has(path) ? new Set(['get']) : null); // a static file answers GET
    for (const m of Object.keys(ops).filter((k) => METHODS.includes(k))) {
      if (!have) problems.push(`openapi.json documents ${m.toUpperCase()} ${path}, but no function serves ${path}`);
      else if (!have.has(m)) problems.push(`openapi.json documents ${m.toUpperCase()} ${path}, but its function has no onRequest${m[0].toUpperCase() + m.slice(1)}`);
      if (!ops[m].operationId) problems.push(`${m.toUpperCase()} ${path} has no operationId`);
    }
    if (INTERNAL[path]) problems.push(`${path} is both in openapi.json and marked internal in tools/openapi-check.mjs: pick one`);
  }
  for (const path of routes.keys()) {
    if (!path.startsWith('/api/') && path !== '/tools.json') continue; // /[handle] is the share-card page, not an API
    if (!spec.paths[path] && !INTERNAL[path]) problems.push(`${path} is a route but neither in openapi.json nor marked internal in tools/openapi-check.mjs: document it, or say why it is Void's own`);
  }
  for (const path of Object.keys(INTERNAL)) if (!routes.has(path)) problems.push(`tools/openapi-check.mjs marks ${path} internal, but no function serves it any more`);
  const ls = (catalog && catalog.linkset && catalog.linkset[0]) || {};
  if (!(ls['service-desc'] || []).some((l) => /\/openapi\.json$/.test(l.href))) problems.push('/.well-known/api-catalog does not point its service-desc at /openapi.json');
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const spec = JSON.parse(readFileSync(join(ROOT, 'openapi.json'), 'utf8'));
  const routes = new Map();
  for (const f of walk(FN)) {
    if (!f.endsWith('.js') || /_middleware\.js$/.test(f)) continue;
    const ms = methodsOf(readFileSync(f, 'utf8'));
    if (ms.size) routes.set(routeOf(f), ms);
  }
  const catPath = join(ROOT, '.well-known', 'api-catalog');
  const catalog = existsSync(catPath) ? JSON.parse(readFileSync(catPath, 'utf8')) : null;
  // documented paths served as static files (no function): a GET to a file that is in void-live-deploy/
  const statics = new Set(Object.keys(spec.paths).filter((p) => !routes.has(p) && existsSync(join(ROOT, p.replace(/^\//, '')))));
  const problems = check({ spec, routes, catalog, statics });
  if (spec.openapi !== '3.1.0') problems.push('openapi.json is not OpenAPI 3.1.0');
  for (const p of problems) console.log('openapi: ' + p);
  if (problems.length) process.exit(1);
  console.log(`openapi: ok, ${Object.keys(spec.paths).length} public paths documented, ${Object.keys(INTERNAL).length} of Void's own left out on purpose`);
}
