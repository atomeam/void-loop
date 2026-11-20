// Flights and jobs each have one page (owner, 2026-11-20: the flight tools should be 1 page; the job tools too).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { allTools } from '../void-live-deploy/lib/toolkit.js';
import { FLIGHT_SITES, flightAskOf, flightModeOf } from '../void-live-deploy/lib/flight-sites.js';
import { JOB_SITES, jobAskOf, jobModeOf } from '../void-live-deploy/lib/job-sites.js';

test('the catalog lists one Flights card and one Jobs card, and asks open a section', () => {
  const tools = allTools();
  const flights = tools.filter(([p]) => p === '/flights/' || p.startsWith('/flights/'));
  const jobs = tools.filter(([p]) => p === '/jobs/' || p.startsWith('/jobs/'));
  assert.deepEqual(flights.map(([p]) => p), ['/flights/']);
  assert.deepEqual(jobs.map(([p]) => p), ['/jobs/']);
  const fl = FLIGHT_SITES.find((s) => s.path === '/flights/');
  const jb = JOB_SITES.find((s) => s.path === '/jobs/');
  for (const p of ['providers', 'facts', 'time', 'co2', 'route', 'routes', 'airports', 'trip']) assert.ok(fl.panels.includes(p), p);
  for (const p of ['search', 'regions', 'categories', 'tags', 'companies', 'alerts']) assert.ok(jb.panels.includes(p), p);
  assert.equal(flightAskOf('flight co2 calculator'), '/flights/?mode=co2');
  assert.equal(flightModeOf('', '#distance'), 'facts');
  assert.equal(jobAskOf('job alerts'), '/jobs/?mode=alerts');
  assert.equal(jobAskOf('jobs in germany'), '/jobs/?region=europe');
  assert.equal(jobAskOf('remote companies hiring'), '/jobs/?mode=companies');
});

test('old addresses redirect to the one page', () => {
  const redirs = readFileSync(new URL('../void-live-deploy/_redirects', import.meta.url), 'utf8');
  for (const [from, to] of [['/flights/co2/', '/flights/?mode=co2'], ['/flights/trip/', '/flights/?mode=trip'], ['/jobs/alerts/', '/jobs/?mode=alerts'], ['/jobs/europe/', '/jobs/?region=europe'], ['/jobs/salary/', '/jobs/?salaryOnly=1&sort=salary']]) {
    assert.match(redirs, new RegExp(from.replace(/\//g, '\\/') + ' ' + to.replace(/[?]/g, '\\?') + ' 301'));
  }
  assert.ok(existsSync(new URL('../void-live-deploy/flights/index.html', import.meta.url)));
  assert.ok(existsSync(new URL('../void-live-deploy/jobs/index.html', import.meta.url)));
});
