// The jobs pages (lib/jobs-core.js, lib/job-sites.js, functions/api/jobs.js, tools/jobs-snapshot.mjs): each source read to one shape with its link back kept and
// nothing personal left in it, search and filters, alerts, the feed (Jobicy only), the tracker's CSV and calendar file, the German strings, and the endpoint's cache.
// The listings below are made up for the test (secret-scan: ok; the addresses and numbers are fictional).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../void-live-deploy/lib/jobs-core.js';
import { JOB_SITES, jobAskOf } from '../void-live-deploy/lib/job-sites.js';
import { DE } from '../void-live-deploy/lib/jobs-de.js';
import { sourceJobs, allJobs, onRequestGet, UPSTREAM } from '../void-live-deploy/functions/api/jobs.js';
import { buildSnapshot } from './jobs-snapshot.mjs';
import { scrubPersonal } from './site-re.mjs';

const REMOTIVE = { jobs: [{ id: 1911, url: 'https://remotive.com/remote-jobs/software-dev/senior-react-developer-1911', title: 'Senior React Developer', company_name: 'Acme', category: 'Software Development', tags: ['react', 'typescript'], job_type: 'full_time', publication_date: '2026-10-25T09:00:00', candidate_required_location: 'Europe', salary: '$90k - $120k', description: '<p>Build things. We offer visa sponsorship.</p><p>Questions? Mail jo.doe@acme.io or call +44 20 7946 0958, 12 Baker Street. https://acme.io/apply</p>' },
  { id: 1912, url: 'https://evil.example/phish', title: 'Bad link', company_name: 'X', description: '' }] };
const JOBICY = { jobs: [{ id: 77, url: 'https://jobicy.com/jobs/77-support-lead', jobTitle: 'Support Lead &amp; Trainer', companyName: 'Beta', jobIndustry: ['Customer Success'], jobType: ['full-time'], jobGeo: 'USA', jobLevel: 'Senior', jobExcerpt: 'Lead support.', pubDate: '2026-10-26T08:00:00Z', salaryMin: 60000, salaryMax: 80000, salaryCurrency: 'USD', salaryPeriod: 'yearly' }] };
const HIMALAYAS = { jobs: [{ title: 'Data Engineer', companyName: 'Gamma', employmentType: 'Contractor', minSalary: 50, maxSalary: 70, currency: 'EUR', salaryPeriod: 'hour', seniority: ['Mid-level'], locationRestrictions: ['Germany'], timezoneRestrictions: [0, 1, 2], categories: ['Data'], parentCategories: ['Engineering'], description: 'Pipelines. We cannot sponsor visas.', pubDate: 1761400000, applicationLink: 'https://himalayas.app/companies/gamma/jobs/data-engineer/apply', guid: 'https://himalayas.app/companies/gamma/jobs/data-engineer' }] };
const all = () => C.merge(C.normalise('remotive', REMOTIVE), C.normalise('jobicy', JOBICY), C.normalise('himalayas', HIMALAYAS));

test('each source becomes one shape, keeps its link back, and drops a listing that links elsewhere', () => {
  const r = C.normalise('remotive', REMOTIVE); assert.equal(r.length, 1, 'the listing with a link off remotive.com is dropped');
  assert.equal(r[0].url, REMOTIVE.jobs[0].url); assert.equal(r[0].apply, r[0].url); assert.equal(r[0].type, 'full-time'); assert.deepEqual(r[0].salary, { min: 90000, max: 120000, cur: 'USD', per: 'year' }); assert.deepEqual(r[0].regions, ['europe']); assert.equal(r[0].visa, true);
  const j = C.normalise('jobicy', JOBICY)[0]; assert.equal(j.title, 'Support Lead & Trainer'); assert.equal(j.level, 'Senior'); assert.equal(j.salary.cur, 'USD'); assert.deepEqual(j.regions, ['usa']);
  const h = C.normalise('himalayas', HIMALAYAS)[0]; assert.equal(h.apply, HIMALAYAS.jobs[0].applicationLink, 'Apply goes to the applicationLink (Himalayas terms)'); assert.equal(h.url, HIMALAYAS.jobs[0].guid); assert.equal(h.tz, 'UTC+0 to UTC+2'); assert.equal(h.visa, false, '"cannot sponsor" is not a sponsorship'); assert.equal(h.salary.per, 'hour');
});
test('nothing personal is left in a listing: no email, phone, street address or link', () => {
  const ex = C.normalise('remotive', REMOTIVE)[0].excerpt;
  assert.ok(!/@|7946|Baker|https?:/.test(ex), ex); assert.equal(scrubPersonal(ex), ex, 'site-re scrubPersonal finds nothing more to take out');
  assert.equal(C.scrub('Call (555) 010-9999 or write to ann@x.org'), 'Call or write to');
});
test('search: keyword, place, region, tag, type, salary, visa, days and sort', () => {
  const jobs = all(), now = Date.parse('2026-10-26T08:30:00Z');
  assert.deepEqual(C.search(jobs, { q: 'react' }, now).map((j) => j.company), ['Acme']);
  assert.deepEqual(C.search(jobs, { region: 'germany' }, now).map((j) => j.company).sort(), ['Acme', 'Gamma'], 'a job open in Europe is open in Germany');
  assert.deepEqual(C.search(jobs, { tag: 'Customer Success' }, now).map((j) => j.company), ['Beta']);
  assert.deepEqual(C.search(jobs, { type: 'contract' }, now).map((j) => j.company), ['Gamma']);
  assert.deepEqual(C.search(jobs, { min: 100000 }, now).map((j) => j.company).sort(), ['Acme', 'Gamma'], 'hourly pay is turned into a year (70 x 2080)');
  assert.deepEqual(C.search(jobs, { visa: true }, now).map((j) => j.company), ['Acme']);
  assert.deepEqual(C.search(jobs, { days: 1 }, now).map((j) => j.company).sort(), ['Acme', 'Beta']);
  assert.deepEqual(C.search(jobs, { sort: 'salary' }, now).map((j) => j.company), ['Gamma', 'Acme', 'Beta']);
  const q = C.toQuery({ q: 'react', region: 'europe', visa: true, sort: 'salary' }); assert.equal(q, 'q=react&region=europe&visa=1&sort=salary'); assert.deepEqual(C.fromQuery('?' + q), { ...C.EMPTY, q: 'react', region: 'europe', visa: true, sort: 'salary' });
  assert.equal(C.fromQuery('?region=mars&src=evil&min=-5').region, ''); assert.equal(C.fromQuery('?src=evil').src, '');
});
test('alerts: a saved search counts what is new since it was last seen', () => {
  const r = C.newSince(all(), { s: { q: '' }, seen: '2026-10-25T12:00:00.000Z' }); assert.equal(r.all.length, 3); assert.deepEqual(r.fresh.map((j) => j.company), ['Beta']);
});
test('the feed carries Jobicy only, each item linking to its original posting', () => {
  const rss = C.toRss(all(), {}); assert.match(rss, /<rss version="2.0">/); assert.match(rss, /jobicy\.com\/jobs\/77/); assert.ok(!/remotive\.com\/remote-jobs|himalayas\.app\/companies/.test(rss), 'Remotive and Himalayas are not passed on through a feed'); assert.match(rss, /Support Lead &amp; Trainer/);
});
test('the tracker: CSV out and back, formula-safe; a calendar file of next steps', () => {
  const apps = [C.cleanApp({ title: '=HYPERLINK("x")', company: 'Acme, Inc', stage: 'interview', applied: '2026-10-20', next: '2026-11-02', url: 'https://remotive.com/x', src: 'remotive', notes: 'Line one\nline two' })];
  const csv = C.appsToCsv(apps); assert.match(csv, /^title,company,stage/); assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  const back = C.appsFromCsv(csv); assert.equal(back[0].title, apps[0].title); assert.equal(back[0].stage, 'interview'); assert.equal(back[0].company, 'Acme, Inc'); assert.equal(back[0].notes, 'Line one\nline two'); assert.equal(back[0].src, 'remotive');
  const ics = C.appsToIcs(apps); assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /DTSTART;VALUE=DATE:20261102/); assert.match(ics, /SUMMARY:Interview: /);
  assert.equal(C.cleanApp({ title: 'x', url: 'javascript:alert(1)' }).url, '');
});
test('open the same search on the job sites: a closed list of hosts, every value encoded, each labelled', () => {
  const l = C.searchLinks({ q: 'c++ & "go"', loc: 'São Paulo' }); assert.ok(l.length >= 8);
  for (const x of l) { const u = new URL(x.url); assert.equal(u.protocol, 'https:'); assert.ok(['confirmed', 'partly', 'unconfirmed'].includes(x.check)); assert.ok(!/[" ]/.test(x.url)); }
  assert.deepEqual(l.map((x) => new URL(x.url).hostname), ['www.linkedin.com', 'www.indeed.com', 'himalayas.app', 'remotive.com', 'weworkremotely.com', 'remoteok.com', 'jobicy.com', 'www.workingnomads.com', 'www.arbeitnow.com']);
});
test('a stored or fetched listing is checked field by field', () => {
  assert.equal(C.checkJob({ src: 'remotive', id: 'x', title: 't', url: 'javascript:alert(1)' }), null); assert.equal(C.checkJob({ src: 'other', id: 'x', title: 't', url: 'https://remotive.com/a' }), null);
  assert.equal(C.checkJob({ src: 'jobicy', id: 'x', title: 't', url: 'https://jobicy.com/a', apply: 'https://evil.example/' }).apply, 'https://jobicy.com/a');
});
test('the endpoint asks three fixed addresses, keeps each answer in the edge cache, and answers RSS', async () => {
  const calls = []; const fetchFn = async (u) => { calls.push(u); const body = u.startsWith('https://remotive.com') ? REMOTIVE : u.startsWith('https://jobicy.com') ? JOBICY : HIMALAYAS; return new Response(JSON.stringify(body)); };
  const store = new Map(); const cache = { match: async (k) => (store.has(k.url) ? new Response(store.get(k.url)) : undefined), put: async (k, r) => { store.set(k.url, await r.text()); } };
  const a = await allJobs({ fetchFn, cache }); assert.equal(a.jobs.length, 3); assert.deepEqual(Object.keys(a.sources), ['remotive', 'jobicy', 'himalayas']); assert.ok(Object.values(a.sources).every((s) => s.ok));
  await allJobs({ fetchFn, cache }); assert.equal(calls.length, 3, 'a second call is answered from the cache'); assert.deepEqual(calls.sort(), Object.values(UPSTREAM).sort());
  const bad = await sourceJobs('jobicy', { fetchFn: async () => new Response('no', { status: 500 }) }); assert.equal(bad.ok, false); assert.deepEqual(bad.jobs, []);
  const f0 = globalThis.fetch; globalThis.caches = { default: cache }; globalThis.fetch = fetchFn;
  try { const res = await onRequestGet({ request: new Request('https://a-to-mind.com/api/jobs?format=rss&q=support') }); assert.match(res.headers.get('content-type'), /rss/); assert.match(res.headers.get('x-robots-tag'), /noindex/); assert.match(await res.text(), /Support Lead/); } finally { delete globalThis.caches; globalThis.fetch = f0; }
});
test('the snapshot keeps a source\'s old jobs when it does not answer, and is scrubbed', () => {
  const old = { sources: { jobicy: { at: '2026-10-25T00:00:00Z' } }, jobs: C.normalise('jobicy', JOBICY) };
  const s = buildSnapshot({ remotive: C.normalise('remotive', REMOTIVE) }, old, '2026-10-26T06:00:00Z'); assert.equal(s.jobs.length, 2); assert.equal(s.sources.jobicy.ok, false); assert.equal(s.sources.jobicy.at, '2026-10-25T00:00:00Z'); assert.equal(s.sources.remotive.at, '2026-10-26T06:00:00Z');
  const committed = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/jobs/snapshot.json', import.meta.url), 'utf8')); assert.ok(Array.isArray(committed.jobs));
  for (const j of committed.jobs) { assert.ok(C.checkJob(j), 'a committed listing passes the checks'); assert.equal(scrubPersonal(j.excerpt), j.excerpt); }
});
test('the pages: a row for the hub and each lane site, and the asks that reach them', () => {
  assert.equal(JOB_SITES[0].path, '/jobs/'); for (const r of JOB_SITES) { assert.ok(r.de && r.de.h1 && r.de.intro, r.path + ' has German'); assert.ok(fs.existsSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url)), r.path); }
  assert.equal(jobAskOf('job search'), '/jobs/'); assert.equal(jobAskOf('job alerts'), '/jobs/alerts/'); assert.equal(jobAskOf('jobs in germany'), '/jobs/europe/'); assert.equal(jobAskOf('remote companies hiring'), '/jobs/companies/'); assert.equal(jobAskOf('good job'), ''); assert.equal(jobAskOf('steve jobs'), '');
});
test('every English string of the screen has its German', () => {
  const src = fs.readFileSync(new URL('../void-live-deploy/lib/jobs-ui.js', import.meta.url), 'utf8'), missing = [];
  for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) if (!DE[m[1].replace(/\\'/g, "'")]) missing.push(m[1]);
  for (const v of [...Object.values(C.SORTS), ...Object.values(C.TYPES), ...Object.values(C.STAGES), ...Object.values(C.REGIONS)]) if (!DE[v]) missing.push(v);
  assert.deepEqual(missing, []);
});
