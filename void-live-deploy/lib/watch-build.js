// What Verse builds from what it watched (Atom, 2026-11-04: "i would rather it takes what it learns from the tv and radio and build useful
// monetizable things right onto the site"). Idea lists are no longer the output: each cycle takes the one idea worth most (useful to a
// visitor and able to earn), checks whether a page on a-to-mind.com already does that job (then it improves that page instead of adding a
// second one), names how it earns (a Gumroad product of Verse's), and becomes one build job whose spec says exactly that. The build lands
// as an automerge pull request with a real-pages test, and the lineage (broadcast -> feature -> pull request) is kept one file per build in
// domains/tv-built/ and served at /tv-built.json, which /local/ shows under "Built from what Verse watched". Pure: no fs, no network.

const WORD = /[a-z][a-z0-9]+/g;
const STOP = new Set(('a an and app apps are as at be by can could for from help helps in into is it its of on or that the their them this to tool tools ' +
  'use used users using verse what when where which who will with you your free online page site web digital people make makes based').split(' '));

/** the content words of a text, lower case, without stop words, roughly singular. Pure. */
export function wordsOf(text) {
  return [...new Set((String(text || '').toLowerCase().match(WORD) || []).filter((w) => !STOP.has(w) && w.length > 2).map((w) => w.replace(/(?<=[a-z]{3})(ies)$/, 'y').replace(/(?<=[a-z]{3})s$/, '')))];
}

// what makes an idea useful on a website: a thing a visitor can do in one sitting
const USEFUL = [/\b(track|tracker|calculat|checker|check|verif|planner|plan|compar|convert|locat|finder|find|timer|countdown|monitor|estimat|database|detect|map|list|guide|log)/,
  /\b(price|cost|budget|fuel|diesel|tax|health|safety|evidence|deadline|schedule|recipe|snack|weather|route|scam|fraud|fake|alter)/];
// what someone pays for, or what brings the search traffic a paid tier is sold to
const REVENUE = [/\b(business|law|legal|police|enforcement|evidence|court|insurance|contractor)/, /\b(farm|agricultur|livestock|market|inflation|price|money|invest|trade)/,
  /\b(ai|artificial|synthetic|deepfake|fake|fraud|scam|altered|authentic)/, /\b(tourist|travel|booking|shop|buy)/];
// what one page cannot honestly be: hardware, a headset, a crowd, a staff
const HARD = /\b(augmented reality|virtual reality|\bar\b|\bvr\b|headset|hardware|drone|wearable|hologram|robot)/;

/** how much an idea is worth building now: { score, useful, revenue, hard, why }. Usefulness and revenue 0..4 each; a thing a web page
 *  cannot be costs 5; a dated idea (a holiday) whose day has passed costs 3. Pure. */
export function scoreIdea(n, today = new Date().toISOString().slice(0, 10)) {
  const text = (String(n && n.topic || '') + ' ' + String(n && n.note || '')).toLowerCase();
  let useful = 0, revenue = 0;
  for (const re of USEFUL) if (re.test(text)) useful += 2;
  for (const re of REVENUE) if (re.test(text)) revenue += 1;
  if (/\b(ai|deepfake|synthetic)\b/.test(text)) revenue += 1; // the most searched kind of check this year
  const hard = HARD.test(text) ? 5 : 0;
  const md = today.slice(5), stale = (/\bhalloween\b/.test(text) && md > '10-31') || (/\bchristmas\b/.test(text) && md > '12-25') ? 3 : 0;
  const score = Math.min(4, useful) + Math.min(4, revenue) - hard - stale;
  const why = [useful && 'useful ' + Math.min(4, useful), revenue && 'earns ' + Math.min(4, revenue), hard && 'not a web page (-5)', stale && 'its day has passed (-3)'].filter(Boolean).join(', ');
  return { score, useful: Math.min(4, useful), revenue: Math.min(4, revenue), hard, stale, why };
}

/** a short url-safe name for an idea. Pure. */
export function slugOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || 'idea';
}

/** the page that already does this idea's job, or null: pages are [{ route, title, desc }]. A page matches when it shares at least two
 *  content words with the idea and they are at least a fifth of the idea's words (so "video" alone does not make a video player the
 *  place for a fake-video check). Pure. */
export function matchPage(n, pages = []) {
  const idea = wordsOf((n && n.topic || '') + ' ' + (n && n.note || ''));
  if (!idea.length) return null;
  let best = null;
  for (const p of pages) {
    const have = new Set(wordsOf(p.title + ' ' + (p.desc || '')));
    const shared = idea.filter((w) => have.has(w));
    const share = shared.length / idea.length;
    if (shared.length >= 2 && share >= 0.2 && (!best || share > best.share)) best = { route: p.route, title: p.title, shared, share: +share.toFixed(2) };
  }
  return best;
}

// the one page per category (owner, 2026-11-03: "never make a separate matching tool per idea or rival. Fold new features into the one
// existing page for that category as a mode; create a new page only when nothing fits"). First match wins; a route counts only when the
// site has it. A fake-photo check is a mode of the photo details page, a livestock price tracker a mode of /markets/.
export const CATEGORIES = Object.freeze([
  { re: /\b(deepfake|synthetic|authentic|ai[- ]generated|altered|exif|metadata|photo|image|picture)/, route: '/photos/exif/' },
  { re: /\b(price|market|stock|inflation|invest|livestock|commodit|crypto|currency|exchange rate)/, route: '/markets/' },
  { re: /\b(recipe|snack|meal|cook|food|diet|nutrition)/, route: '/recipes/' },
  { re: /\b(weather|storm|hurricane|forecast|rain|snow|heat)/, route: '/weather/' },
  { re: /\b(score|league|game day|playoff|team stat)/, route: '/scores/' },
  { re: /\b(flight|airport|airline|travel)/, route: '/flights/' },
  { re: /\b(job|hiring|career|resume)/, route: '/jobs/' },
  { re: /\b(news|headline|election|ballot)/, route: '/news/' },
  { re: /\b(convert|conversion|unit)/, route: '/convert/' },
  { re: /\b(calculat|tax|budget|loan|mortgage|tip)/, route: '/calculators/' },
  { re: /\b(countdown|time zone|clock|timer)/, route: '/time/' },
  { re: /\b(radio|tv station|broadcast|podcast)/, route: '/local/' },
]);
/** the category page an idea folds into, or null: { route, title, shared: [], share: 0, category: true }. Pure. */
export function categoryOf(n, pages = []) {
  const text = (String(n && n.topic || '') + ' ' + String(n && n.note || '')).toLowerCase(), have = new Map(pages.map((p) => [p.route, p]));
  for (const c of CATEGORIES) if (c.re.test(text) && have.has(c.route)) return { route: c.route, title: have.get(c.route).title, shared: [], share: 0, category: true };
  return null;
}

// how a build earns: the store's own products (void-live-deploy/lib/members.js BUY is MultiVerse, the $49 a month membership)
export const PRODUCTS = Object.freeze({
  fix: { name: 'One-Time Automation Fix ($25)', url: 'https://moonbeam846.gumroad.com/l/eozcma', re: /\b(automat|zap|workflow|integration|script)/ },
  audit: { name: 'Full-Stack Audit', url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', re: /\b(website|code|security|app store|developer|software)/ },
  keep: { name: 'Keep-It-Running ($49 a month)', url: 'https://moonbeam846.gumroad.com/l/keep-it-running-membership', re: /\b(monitor|uptime|outage|silent)/ },
  multiverse: { name: 'MultiVerse ($49 a month): your own Verse, and members ask Verse to build the next tool they need', url: 'https://moonbeam846.gumroad.com/l/yinmj', re: /./ },
});
/** the product a build links to, by what the idea is about; MultiVerse when nothing narrower fits. Pure. */
export function productFor(n) {
  const text = (String(n && n.topic || '') + ' ' + String(n && n.note || '')).toLowerCase();
  for (const [key, p] of Object.entries(PRODUCTS)) if (p.re.test(text)) return { key, name: p.name, url: p.url };
  return { key: 'multiverse', name: PRODUCTS.multiverse.name, url: PRODUCTS.multiverse.url };
}

/** Verse's idea notes ranked best first, each { n, s: its score, slug }, without the ones already built. Pure. */
function rankIdeas(notes, { built = [], today } = {}) {
  const done = new Set(built.map((s) => String(s).toLowerCase()));
  return (Array.isArray(notes) ? notes : []).filter((n) => n && n.kind === 'idea' && String(n.note || '').length >= 12)
    .map((n) => ({ n, s: scoreIdea(n, today), slug: slugOf(n.topic || n.note) }))
    .filter((x) => !done.has(x.slug) && !done.has(sourceKey(x.n)))
    .sort((a, b) => b.s.score - a.s.score || String(b.n.at || '').localeCompare(String(a.n.at || '')));
}
/** one ranked idea as a build plan: matched to a page and a product. Pure. */
function planOf(top, pages = [], passed = []) {
  const page = matchPage(top.n, pages) || categoryOf(top.n, pages);
  return {
    slug: top.slug, topic: String(top.n.topic || '').slice(0, 80), note: String(top.n.note || '').slice(0, 220), score: top.s,
    source: { medium: top.n.medium || '', station: top.n.station || '', network: top.n.network || '', show: top.n.show || '', day: top.n.day || '', at: top.n.at || '' },
    action: page ? 'improve' : 'new', page: page ? page.route : '/' + top.slug + '/', matched: page,
    product: productFor(top.n), passed: passed.map((x) => ({ topic: x.n.topic, score: x.s.score, why: x.s.why })),
  };
}

/** this cycle's plan from Verse's idea notes: the best idea not built yet, scored, matched to a page and a product, or null. built: the
 *  slugs (or source keys) already in domains/tv-built/. Pure. */
export function planCycle(notes, { pages = [], built = [], today } = {}) {
  const ranked = rankIdeas(notes, { built, today }), top = ranked[0];
  if (!top || top.s.score < 3) return null;
  return planOf(top, pages, ranked.slice(1, 4));
}

// Every blueprint starts by itself (the owner asked for this on 2026-11-06, so each blueprint builds into Verse with no tap). A blueprint is the card an idea note opens on the stage (local/watch.js "blueprint on stage", skills/system-blueprint.js).
// Before this only the one best idea of an hour's watch was queued, and only with a score of 3 or more, so most blueprints never built.
// Now each idea note Verse wrote becomes a tv: build job, best first, a few a run (tools/watch-build.mjs queue, from the conductor every
// hour), and the card shows the job's real state. Only two kinds are left out, each with its reason on the card: a thing no web page can
// be (a headset, a drone) and a dated idea whose day has passed.
export const SKIPS = Object.freeze({ hard: 'it needs hardware no web page can be', stale: 'its day has passed' });
/** why an idea is not built, or '' when it is built. Pure. */
export const skipOf = (s) => (s && s.hard ? SKIPS.hard : s && s.stale ? SKIPS.stale : '');
/** every idea worth building, best first, at most limit, one plan per slug: planCycle without the score floor, so a blueprint builds
 *  unless skipOf names a reason. Pure. */
export function planAll(notes, { pages = [], built = [], today, limit = 60 } = {}) {
  const out = [], seen = new Set();
  for (const x of rankIdeas(notes, { built, today })) {
    if (seen.has(x.slug)) continue; seen.add(x.slug);
    if (skipOf(x.s)) continue;
    out.push(planOf(x, pages));
    if (out.length >= limit) break;
  }
  return out;
}

/** the idea note a blueprint card was opened from: the note whose ask (lib/watch-along.js ideaAskFromNote, the words the card's link
 *  carries) or topic has the same slug as the card's idea; null when Verse wrote no such note (someone typed their own blueprint). Pure. */
export function noteOfIdea(notes, idea, askOf = (n) => n.topic) {
  const want = slugOf(idea);
  if (!idea || want === 'idea') return null;
  for (const n of Array.isArray(notes) ? notes : []) {
    if (!n || n.kind !== 'idea') continue;
    if (slugOf(n.topic || n.note) === want || slugOf(askOf(n) || '') === want) return n;
  }
  return null;
}
/** the queue target a blueprint builds under: the same tv: lane the watch build uses, so one idea is one job whichever way it starts. Pure. */
export const targetOf = (n) => ('tv:' + slugOf(n.topic || n.note)).slice(0, 40);

/** what a blueprint card says about its build, from what is real: the served log (built entries), the queue row for its target, and
 *  whether Verse wrote the idea. -> { state, line, page?, pr? }. state: live | shipped | building | queued | set aside | failed | starting
 *  | skipped | plan. Pure. */
export function buildState({ slug, built = [], row = null, verse = false, skip = '' }) {
  const b = (Array.isArray(built) ? built : []).find((e) => e && e.slug === slug);
  if (b) return { state: 'live', page: b.mode || b.feature, pr: b.pr || null, line: 'Live: built ' + (b.action === 'improve' ? 'into ' : 'as ') + (b.mode || b.feature) + (b.pr ? ' in #' + b.pr : '') };
  const st = row && row.state, pr = row && Number((/\bPR #?(\d+)/i.exec(String(row.note || '')) || [])[1]) || null;
  if (st === 'done' || st === 'live') return { state: 'shipped', pr, line: 'Built' + (pr ? ' in #' + pr : '') + ': live once it merges and deploys' };
  if (st === 'building') return { state: 'building', line: 'Building now: Verse\'s coder has this job' };
  if (st === 'queued') return { state: 'queued', line: 'Queued to build: Verse\'s conductor hands it to the coder' };
  if (st === 'set aside') return { state: 'set aside', line: 'Set aside after the coder tried it three times' };
  if (st === 'failed') return { state: 'failed', line: 'The build failed; it goes back to the queue when Verse heals it' };
  if (verse && skip) return { state: 'skipped', line: 'Not built: ' + skip };
  if (verse) return { state: 'starting', line: 'Starting the build' };
  return { state: 'plan', line: 'A plan: builds start by themselves for the ideas Verse learns from TV and radio' };
}

/** one idea's identity across cycles: medium, station and the moment it was noted. Pure. */
export const sourceKey = (n) => [n && n.medium, n && n.station, n && n.at].map((s) => String(s || '')).join('|').toLowerCase();

/** the queue job for a plan: target (40 at most) and ask (200 at most), the source in the ask so the coder and the log both have it. Pure. */
export function jobOf(plan) {
  const src = [plan.source.station, plan.source.day].filter(Boolean).join(' ');
  return { target: ('tv:' + plan.slug).slice(0, 40), ask: ((plan.action === 'improve' ? 'Improve ' + plan.page + ': ' : 'Build ' + plan.page + ': ') + plan.topic + ' (heard on ' + src + '). ' + plan.note).slice(0, 200) };
}

/** what a tv job asks of the coder, beyond its words: the whole spec. plan: planCycle's answer for the job, or null when it cannot be
 *  rebuilt (then the ask alone is the spec). Pure. */
export function tvSpec(job, plan) {
  const slug = String(job && job.target || '').replace(/^tv:/, '') || (plan && plan.slug) || 'idea';
  const m = /^(Build|Improve) (\/[^\s:]*\/?):\s*([^(]*)/.exec(String(job && job.ask || ''));
  const p = plan || (m ? { action: m[1] === 'Improve' ? 'improve' : 'new', page: m[2], topic: m[3].trim(), product: productFor(m[3]) } : {});
  return [
    'This came from what Verse watched or heard on TV or radio. It ships as a real feature on a-to-mind.com, never as an idea list.',
    p.action === 'improve' ? 'A page already does part of this: ' + p.page + (p.matched ? (p.matched.category ? ' (the page for this category)' : ' (shared words: ' + (p.matched.shared || []).join(', ') + ')') : '') + '. Add this to that page as a mode (a section or tab on the same page, with a ?mode= link); do not add a second page or a separate matching tool.'
      : 'One page per category: check void-live-deploy/*/index.html titles first; if a page already covers this category, add this to it as a mode and add no new page. Only when nothing fits, build ' + (p.page || '/' + slug + '/') + ' (index.html and app.js, its logic in void-live-deploy/lib/ with a node:test file).',
    'Earn: the page links to ' + (p.product ? p.product.name + ' at ' + p.product.url : 'the Gumroad product that fits (lib/watch-build.js PRODUCTS)') + ', in one honest line that says what the buyer gets.',
    'Reach: never add a link or content to the home page (void-live-deploy/index.html). A mode is reached through its page; a new page goes in void-live-deploy/sitemap.xml and gets a skill made with tools/new-skill.mjs, so the book (the menu) lists it and Verse answers its name with the page.',
    'Test: a spec for the route in tools/real-pages.mjs that uses the feature the way a person would and checks the exact answer.',
    'Lineage: add domains/tv-built/' + slug + '.json with { slug, topic, source: { medium, station, network, show, day }, feature: <the page>, mode: <the page with its ?mode= link, when it is a mode>, product: <url>, job: "' + (job && job.id || '') + '" } (the pull request is read from git at deploy).',
  ].join('\n');
}

/** the served log from the lineage files, newest first; prOf(file) gives the pull request number that added a file, or null. Pure. */
export function assembleLog(entries, prOf = () => null) {
  return entries.filter((e) => e && e.slug && e.feature).map((e) => ({ ...e, pr: e.pr || prOf(e._file) || null, _file: undefined }))
    .map(({ _file, ...e }) => e).sort((a, b) => String(b.shipped || b.source && b.source.day || '').localeCompare(String(a.shipped || a.source && a.source.day || '')));
}
