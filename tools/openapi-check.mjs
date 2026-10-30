#!/usr/bin/env node
// The public API's description (void-live-deploy/openapi.json, found from /.well-known/api-catalog) against the real routes.
//   node tools/openapi-check.mjs    one line per problem, exit 1 if any
// Checks: every operation in the spec has a function file that answers its method (or, for GET, a static file); every /api route file is either in the spec
// or named below as Verse's own, with why; the catalog points at the spec. A new route fails here until someone decides which it
// is, so the description never drifts from the code and nothing internal is published by accident.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../void-live-deploy/', import.meta.url).pathname;
const FN = join(ROOT, 'functions');

// Verse's own routes: the page, the owner, signed-in accounts or other services call them. Left out of openapi.json on purpose.
export const INTERNAL = {
  '/api/selfcheck': "Verse's check of its own pages: the status card reads the newest report, and only the owner's self-check job (tools/self-check.mjs, .github/workflows/self-check.yml) hands one in (functions/api/selfcheck.js)",
  '/api/members': "the /members/ page's own API: what paid Verse gives, and a paid member's ideas (passkey session, paid tier from Gumroad, a daily and monthly limit) queued as member: jobs that may only add (functions/api/members.js, lib/members.js, tools/add-only.mjs)",
  '/api/coder': "Verse's coder thinking on Verse's own model: owner only, the Workers AI shape in and out, under an hourly and daily cap (functions/api/coder.js); tools/verse-coder.mjs is the only caller",
  '/api/studies': "the owner's study panel (/studies.html): owner only, read only, lists Verse's private studies; not a public API (functions/api/studies.js)",
  '/api/studio': "Verse's studio (functions/api/studio.js, lib/studio.js): the public GET is the image models' scoreboard read by /image/ and /video/; every POST (the bench, the judge, a clip) is owner only, inside a neuron cap and a daily dollar cap",
  '/api/image': "the /image/ page's own painter: a prompt, a style and a shape in, one picture out, inside the Art Forge's shared daily cap and per hashed connection (functions/api/image.js, lib/image-gen.js); the page is the only caller",
  '/api/generators': "the generators hub: publish, list, play, report a list-language generator; the owner deletes (functions/api/generators.js, lib/listgen.js); /generators/ and /generators/make/ are the only callers",
  '/api/daily-art': "the daily picture for /scores/, /news/ and /markets/: an illustration by Verse painted once a day per league, section or wrap inside its own budget, or an openly licensed photo (CC0, CC BY, CC BY-SA) with its credit, or an official video embed (functions/api/daily-art.js, lib/daily-art.js, lib/daily-photo.js); the pages are the only callers",
  '/api/gen-data': "a published generator's shared data: a small JSON store its results read and add to ({add:}, {set:}), size-capped and rate-limited, cleared by the owner (functions/api/gen-data.js); /generators/make/ is the only caller",
  '/api/comments': "comments under a published generator and under /image/: plain text after a signed sum, reported and hidden by three connections, deleted by the owner (functions/api/comments.js, lib/comments.js); the pages are the only callers",
  '/api/gallery': "the /image/ page's public gallery: a picture /api/image made today shared by its words and seed (never uploaded bytes), listed, voted, reported; the owner deletes (functions/api/gallery.js); the page is the only caller",
  '/api/jobs': "remote job listings for the jobs pages (/jobs/): the newest jobs from Remotive, Jobicy and Himalayas, each credited and linked to its original posting, edge-cached per source within its terms; ?format=rss gives a feed of a search (Jobicy listings only)",
  '/api/visit': "who visits Verse: the page beacon /visit.js sends a path and a referrer host, the server keeps per-day counts only (people, our own runs, bots) and reads them back for tools/traffic.mjs (functions/api/visit.js, lib/visits.js, docs/playbooks/traffic.md)",
  '/api/tally': "everyone's tally under the coin: a closed list (coin: heads, tails) and a small count in, integer counts (today and all time) out, rate limited per hashed client (functions/api/tally.js, lib/tally.js, docs/playbooks/open-endpoint-closed-list.md); the page is the only caller",
  '/api/react': "the showcase's reaction bar: a closed list of six reactions and a showcase slug in, integer counts out, rate limited per hashed client (functions/api/react.js, lib/reactions.js, docs/playbooks/open-endpoint-closed-list.md); the page is the only caller",
  '/api/store/{[path}]': "the /store page's own API: catalog, checkout, receipts and signed downloads (functions/api/store/[[path]].js, docs/store.md)",
  '/api/rapvoice': "Verse's rapping voice: one bar of a rap in, its speech as MP3 out (MeloTTS on the site's Workers AI), edge-cached a week, rate limited per connection and capped per day, fail closed (functions/api/rapvoice.js, lib/rap-voice.js); /rap/ and the stage's rap card are the only callers",
  '/api/merge': "the merge card's own API: two idea names in, a cached model-written name and line out; the page is the only caller (functions/api/merge.js, skills/merge.js)",
  '/api/autopilot': "the /autopilot/ page's own API: what Verse's own loops landed on main, its deploys and its conductor's record, read from GitHub and edge-cached ten minutes, GET only, no input but the window (functions/api/autopilot.js, lib/autopilot.js); the page is the only caller",
  '/api/repo': "the repo card's own API: a public GitHub owner/name in, its cleaned live facts out, no token (functions/api/repo.js, lib/repo-look.js, skills/repo.js); the page is the only caller",
  '/api/weather': "the weather page's own API: a place name in, the place found and Open-Meteo's forecast out in one round trip, GET only, edge-cached ten minutes (functions/api/weather.js, lib/weather.js); the page is the only caller",
  '/api/fanfic-hits': "the fan fiction page's own read counts: GET reads the counts of up to 100 stories, POST counts one read of a live story on a fan fiction board, once a visitor a story a day by a salted key that changes each day, no address or cookie kept, bots not counted (functions/api/fanfic-hits.js); the page is the only caller",
  '/api/team': "the team chat's own API (/team/): Verse's agents and its owner post in channels and threads, and Verse hands each idle agent its next build-queue job; GET of the bare route shows names and presence only, everything else needs the owner or an agent key from a join link the owner made; POST do:join uses a link (functions/api/team.js, lib/team.js, /team/agents.txt, /team/mcp, team/agent.mjs)",
  '/api/boards/{[path}]': "the boards page's own API: boards, catalogs, threads, search and posting with a bot check, pictures served by name (functions/api/boards/[[path]].js, lib/boards.js); the page is the only caller",
  '/api/report': "the scores page's own stories (Verse reports): a league, a kind and a game id or day in, a short story written from the score feeds' data out, GET only; the model's wording is used only when every number and name in it is in the facts, capped at 40 model calls an hour and 600 a day for everyone (functions/api/report.js, lib/reports.js); the page is the only caller",
  '/api/local': "the local TV and radio page's own API: no query gives the visitor's rounded place from Cloudflare geo, ?place= a town through the Open-Meteo geocoder, and ?lat&lon&cc&region the Radio Browser stations near it with the streams a secure page can play, GET only, rate limited, edge-cached (functions/api/local.js, local/app.js, skills/local-stations.js); the page and its card are the only callers",
  '/api/holidays': "the holidays card's own API: two letters for a country in, Nager.Date's next public holidays for it out (date, local name, name, at most 20), GET only, edge-cached six hours, a failure never cached (functions/api/holidays.js, skills/holidays.js); the card is the only caller",
  '/api/sportsearch': "the scores page's own search box: a name of 2 to 40 letters in, TheSportsDB's teams, events, venues and players out (free public v1 test key, text fields only), GET only, edge-cached a day, 15 misses a minute (functions/api/sportsearch.js); the page is the only caller",
  '/api/news': "the news page's own API: a section and a language from two closed lists in, grouped headlines from fixed public feeds out, GET only, edge-cached seven minutes (functions/api/news.js, lib/news.js); the page is the only caller",
  '/api/podcasts': "the podcasts page's own API: a search phrase, a chart, an iTunes id or a public https feed address in, normalised show and episode JSON out, GET only, SSRF-safe fetch with size and time caps, edge-cached 15 minutes (functions/api/podcasts.js, lib/podcasts.js); the page is the only caller",
  '/api/recipes': "the recipes page's own API: a dish, up to three ingredients, an id, or a cuisine or category from TheMealDB's closed lists in, TheMealDB's recipes out, GET only, edge-cached an hour (functions/api/recipes.js, lib/recipes.js); the page is the only caller",
  '/api/recipeimport': "the recipes page's import: a recipe page's address in (GET), only the recipe parsed from its published recipe data out (public names only, redirects checked, 1.5 MB and 8 seconds, edge-cached an hour); or one downsized photo of a recipe card in (POST), the text a vision model read out, 6 a minute, nothing kept (functions/api/recipeimport.js, lib/recipeimport.js, tools/recipeimport.test.mjs); /recipes/ is the only caller",
  '/api/calshare': "the calendar page's shared calendars: a whole calendar (one JSON document of up to 1,000 events) shared by a view link and an edit link with no account; keys only as salted hashes, a stale change refused (409), ceilings per connection and per day (functions/api/calshare.js, lib/calshare.js, tools/calshare.test.mjs); /calendar/ is the only caller",
  '/api/icsfeed': "the calendar page's subscriptions: an https or webcal calendar address in, only its parsed events out (public names only, redirects checked, 2 MB and 8 seconds, edge-cached 30 minutes), GET only (functions/api/icsfeed.js, lib/icsfeed.js, tools/icsfeed.test.mjs); /calendar/ is the only caller",
  '/api/rsvp': "the calendar page's invite replies: a name and yes, maybe or no on an invite link, the organizer reads and clears them; keys only as salted hashes, ceilings per connection and per day (functions/api/rsvp.js, lib/rsvp.js, tools/rsvp.test.mjs); /calendar/ is the only caller",
  '/api/media': "the song and show cards' own API: a mood or title in, real tracks or shows from free public catalogs out, GET only (functions/api/media.js, lib/media.js, skills/media-pick.js); the page is the only caller",
  '/api/filmfind': "the film-metadata card's own API: a film ask in, structured film metadata (JSON) out, GET only (functions/api/filmfind.js, lib/film-discovery.js, skills/film-metadata.js); the page is the only caller",
  '/api/movies':"the movie card's own API: a title or a pick in, real films with legal places to watch out, GET only (functions/api/movies.js, lib/movies.js, skills/movie.js); the page is the only caller",
  '/api/card-art': "the Art Forge: a card's subject in, one cached painted picture out (functions/api/card-art.js, lib/art-rules.js, lib/card-forge.js); the page is the only caller",
  '/api/digest': "the page's digest card: a pasted transcript or an open-captions video, summarized for that ask only (functions/api/digest.js, lib/digest.js)",
  '/api/film-review': 'the films page review form: members and the owner give a film a verdict and a note (functions/api/film-review.js)',
  '/api/film-views': 'Verse Tube view counts on /films/: one D1 upsert per view, read for the grid (functions/api/film-views.js)',
  '/api/actions': 'the actions record, for the page and the owner',
  '/api/tower-self': "Versus by itself asks Verse's own model which floor does a site's job and for its feature list (owner only; tools/tower-self.mjs and .github/workflows/tower-self.yml are the only callers)",
  '/api/propose-fix': "Verse proposes the narrowest matcher fix for an ask its own probe missed (owner only, frontier #28 step 3; tools/propose-fix.mjs and its daily workflow are the only callers)",
  '/api/probe-asks': "Verse writes its own probe asks for one skill family (owner only, frontier #28; tools/probe-asks.mjs and its daily workflow are the only callers)",
  '/api/voice-reply': "the owner talks back to Verse on its self card and under any card; Verse answers and keeps the lesson (owner only; functions/api/voice-reply.js, lib/voice.js)",
  '/api/probe-log': "Verse's probe ledger: counts and outcomes the growth card shows, written by its probe and fix tools (POST owner only; lib/probe-log.js)",
  '/api/v01d-fixes': "approve one of Verse's own fix pull requests that waits for the owner (owner only; skills/v01d-fixes.js, lib/v01d-fixes.js)",
  '/api/answer': "the page's answer model",
  '/api/translate': "the translate page's own translator: text (or a photo's text) in, the translation out (functions/api/translate.js, lib/translate-langs.js)",
  '/api/translate': "the translate page's own translator: text (or a photo's text) in, the translation out (functions/api/translate.js, lib/translate-langs.js)",
  '/api/translate': "the translate page's own translator: text (or a photo's text) in, the translation out (functions/api/translate.js, lib/translate-langs.js)",
  '/api/appraise': "the page's appraise card: one photo in, Verse's valuation out (functions/api/appraise.js, lib/appraise-photo.js)",
  '/api/video': "the page's video card: search and link lookup for the official embeds (functions/api/video.js)",
  '/api/approval': 'the approve card, signed-in',
  '/api/aurora': "the page's aurora card",
  '/api/joins': "the stage's community milestone card and the growth card's community line: the member count and the newest join's time, nothing else (functions/api/joins.js, lib/joins.js)",
  '/api/automations': 'automations, signed-in',
  '/api/automations/tick': 'the scheduler, owner key',
  '/api/bench': 'the benchmarks, owner key',
  '/api/earnings': "the page's earnings card",
  '/api/figurescript': "the page's 3D figures",
  '/api/gumroad': "Gumroad's ping, server to server",
  '/api/handoff': 'agent handoff, owner key',
  '/api/hook/{id}': 'automation webhooks, one secret URL each',
  '/api/memory': 'what Verse remembers, owner only',
  '/api/mine': "a person's own Verse, passkey session",
  '/api/miss': 'the page reports a miss',
  '/api/misses': 'the miss board, owner token',
  '/api/passkey': 'sign in with a passkey, for the page',
  '/api/publish': 'publishing a skill, owner',
  '/api/queue': 'the build queue, owner token',
  '/api/reflect': "Verse's reflections, owner",
  '/api/rehearsal': 'the sales rehearsal, owner',
  '/api/routes': "the page's router",
  '/api/routines': 'routines, signed-in',
  '/api/share': 'shared Voids, for the page',
  '/api/share/{room}': 'a shared Verse room (WebSocket)',
  '/api/watch': 'watches, signed-in',
  '/api/where': "the page's place lookup",
  '/api/markets': "the crypto card's price list and the /markets/ page's quotes: a symbol (letters, or a name from a closed list), a range from a closed list of eight and a day in, prices out from four fixed free sources, GET only, edge-cached two minutes (an hour for currencies), 40 fresh lookups a minute (functions/api/markets.js, lib/markets.js); the page and the card are the only callers",
  '/api/will': "Verse's will card",
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
    if (!spec.paths[path] && !INTERNAL[path]) problems.push(`${path} is a route but neither in openapi.json nor marked internal in tools/openapi-check.mjs: document it, or say why it is Verse's own`);
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
  console.log(`openapi: ok, ${Object.keys(spec.paths).length} public paths documented, ${Object.keys(INTERNAL).length} of Verse's own left out on purpose`);
}
