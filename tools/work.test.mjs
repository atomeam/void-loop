// work (skills/work.js): the role a jobs ask reads as (and the bookings and "good job" it leaves), and the card run() draws from a canned /api/jobs
// answer (fetch stubbed) through lib/jobs-core.js: only listings that match the role, a listing off its source's host dropped, the company, place,
// type, salary and source on each row, the jobs page link with the search, and the empty and dead-service cards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import work, { workOf, workAsk } from '../void-live-deploy/skills/work.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const JOBS = [
  { id: 'r1', src: 'remotive', title: 'Senior Python Developer', company: 'Acme', url: 'https://remotive.com/remote-jobs/software-dev/python-1', loc: 'Worldwide', type: 'full-time', tags: ['python', 'django'], salary: { min: 80000, max: 100000, cur: 'USD', per: 'year' }, date: '2026-10-20T00:00:00Z' },
  { id: 'j1', src: 'jobicy', title: 'Data Engineer (Python)', company: 'Beta', url: 'https://jobicy.com/jobs/1', loc: 'Europe', type: 'contract', tags: ['python'], date: '2026-10-25T00:00:00Z' },
  { id: 'h1', src: 'himalayas', title: 'Product Designer', company: 'Gamma', url: 'https://himalayas.app/companies/gamma/jobs/1', loc: '', type: 'full-time', tags: ['figma'], date: '2026-10-26T00:00:00Z' },
  { id: 'x1', src: 'remotive', title: 'Python Wizard', company: 'Shady', url: 'https://evil.example/python', type: 'full-time', tags: ['python'], date: '2026-10-27T00:00:00Z' },
];
const withJobs = async (body, fn) => { const real = globalThis.fetch, urls = []; globalThis.fetch = async (u) => { urls.push(String(u)); if (body instanceof Error) throw body; return { json: async () => body }; }; try { return await fn(urls); } finally { globalThis.fetch = real; } };
const apiOf = () => { const pages = []; return { pages, esc, showPage: (fn) => { const el = { innerHTML: '' }; fn(el); pages.push(el); return el; }, _pageStill: () => true }; };

test('the asks: the role, without "as a", and the ones it leaves', () => {
  assert.equal(workOf('find me work as a designer'), 'designer'); assert.equal(workOf('remote jobs for python'), 'python');
  assert.equal(workOf('jobs as a writer'), 'writer'); assert.equal(workOf('find jobs as an editor'), 'editor');
  assert.equal(workOf('find a job as a nurse?'), 'nurse'); assert.equal(workOf('jobs for the data team'), 'data team');
  assert.equal(workOf('find me work as me'), null); assert.equal(workOf('jobs for verse'), null); assert.equal(workOf('find me a job as a table'), null);
  for (const e of work.examples) assert.ok(work.match(e.toLowerCase(), e), e);
  for (const n of work.nearMisses) assert.ok(!work.match(n.toLowerCase(), n), n);
  for (const a of ['remote jobs rust', 'job for a translator']) assert.ok(work.match(a.toLowerCase(), a), a);
  for (const a of ['steve jobs', 'jobs', 'find me a flight to Paris', 'jobs for it']) assert.ok(!work.match(a.toLowerCase(), a), a);
});

test('the asks with the role first, a place, or the place alone; the news and Steve Jobs left alone', () => {
  assert.deepEqual(workAsk('software jobs in boston'), { q: 'software', loc: 'boston' });
  assert.deepEqual(workAsk('python developer jobs'), { q: 'python developer', loc: '' });
  assert.deepEqual(workAsk('remote designer jobs'), { q: 'designer', loc: '' });
  assert.deepEqual(workAsk('teacher job openings in texas'), { q: 'teacher', loc: 'texas' });
  assert.deepEqual(workAsk('find me work as a designer in berlin'), { q: 'designer', loc: 'berlin' });
  assert.deepEqual(workAsk('nursing jobs near me'), { q: 'nursing', loc: '' });
  assert.deepEqual(workAsk('jobs in berlin'), { q: '', loc: 'berlin' });
  assert.deepEqual(workAsk('find jobs in london'), { q: '', loc: 'london' });
  assert.deepEqual(workAsk('jobs for the data team'), { q: 'data team', loc: '' });
  for (const a of ['jobs report', 'new jobs report', 'jobs act', 'jobs data', 'jobs to be done', 'the jobs numbers', 'odd jobs', 'great job', 'my jobs', 'what is a job', 'what are jobs', 'work in progress', 'work in berlin', 'weather in boston', 'how many jobs in boston', 'turn the misses into jobs', 'queue these as jobs']) assert.equal(workAsk(a), null, a);
});

test('run: a place filters to listings open there, links the jobs page with both, and offers the same search on LinkedIn Jobs and Indeed', async () => {
  await withJobs({ jobs: JOBS }, async () => {
    const api = apiOf(); assert.equal(await work.run('python jobs in europe', api), 'work');
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Remote work · python · open to europe</h2>') && h.includes('>2 remote jobs<'), h);
    assert.ok(h.includes('href="/jobs/?q=python&amp;loc=europe"'), h);
    assert.ok(h.includes('The same search for europe on the big job boards: <a href="https://www.linkedin.com/jobs/search/?keywords=python&amp;location=europe&amp;f_WT=2"') && h.includes('>Indeed</a>'), h);
  });
  await withJobs({ jobs: JOBS }, async () => {
    const api = apiOf(); assert.equal(await work.run('jobs in berlin', api), 'work');
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Remote work · every role · open to berlin</h2>') && h.includes('Senior Python Developer') && !h.includes('Data Engineer'), h);
  });
});

test('run: python finds the two python listings, newest first, with their details and sources; the off-host one is dropped', async () => {
  await withJobs({ jobs: JOBS }, async (urls) => {
    const api = apiOf(); assert.equal(await work.run('remote jobs for python', api), 'work');
    assert.deepEqual(urls, ['/api/jobs']);
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('<h2>Remote work · python</h2>') && h.includes('>2 remote jobs<'), h);
    assert.ok(h.indexOf('Data Engineer (Python)') < h.indexOf('Senior Python Developer'), 'newest first');
    assert.ok(h.includes('<a href="https://remotive.com/remote-jobs/software-dev/python-1" target="_blank" rel="noopener">Senior Python Developer</a>'), h);
    assert.ok(h.includes('Acme · Worldwide · Full-time · USD 80,000–100,000 a year · via Remotive'), h);
    assert.ok(h.includes('Beta · Europe · Contract · via Jobicy'), h);
    assert.ok(!h.includes('Product Designer') && !h.includes('Shady') && !h.includes('evil.example'), h);
    assert.ok(h.includes('<a href="/jobs/?q=python">Open the full jobs page</a>'), h);
  });
});

test('run: no match links the jobs page with the search; a dead service and an ask it does not read', async () => {
  await withJobs({ jobs: JOBS }, async () => { const api = apiOf(); assert.equal(await work.run('find me work as a beekeeper', api), 'work'); assert.ok(api.pages[0].innerHTML.includes('No remote listings matched') && api.pages[0].innerHTML.includes('href="/jobs/?q=beekeeper"'), api.pages[0].innerHTML); });
  await withJobs(new Error('offline'), async () => { const api = apiOf(); assert.equal(await work.run('jobs as a writer', api), 'work'); assert.ok(api.pages[0].innerHTML.includes('No remote listings turned up for that.')); });
  await withJobs({ jobs: JOBS }, async (urls) => { const api = apiOf(); assert.equal(await work.run('good job', api), 'none'); assert.equal(urls.length, 0); assert.equal(api.pages.length, 0); });
});

test('run: the count says job for one listing, and says how many show when there are more than 8', async () => {
  await withJobs({ jobs: JOBS }, async () => {
    const api = apiOf(); assert.equal(await work.run('remote designer jobs', api), 'work');
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('>1 remote job<') && !h.includes('1 remote jobs'), h);
  });
  const many = Array.from({ length: 11 }, (_, i) => ({ id: 'r' + i, src: 'remotive', title: 'Python Developer ' + i, company: 'Co ' + i, url: 'https://remotive.com/remote-jobs/software-dev/p-' + i, loc: 'Worldwide', type: 'full-time', tags: ['python'], date: '2026-10-2' + (i % 9) + 'T00:00:00Z' }));
  await withJobs({ jobs: many }, async () => {
    const api = apiOf(); assert.equal(await work.run('remote jobs for python', api), 'work');
    const h = api.pages[0].innerHTML;
    assert.ok(h.includes('>11 remote jobs, the first 8 here<'), h);
    assert.equal((h.match(/<li>/g) || []).length, 8);
  });
});
