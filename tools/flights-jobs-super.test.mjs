// Flights and jobs each have one page (owner, 2026-11-20: the flight tools should be 1 page; the job tools too).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_SITES, flightAskOf, flightModeOf } from '../void-live-deploy/lib/flight-sites.js';
import { JOB_SITES, jobAskOf, jobModeOf } from '../void-live-deploy/lib/job-sites.js';

test('Flights and Jobs each hold every tool on one page, and asks open a section', () => {
  const fl = FLIGHT_SITES.find((s) => s.path === '/flights/');
  const jb = JOB_SITES.find((s) => s.path === '/jobs/');
  for (const p of ['providers', 'facts', 'time', 'co2', 'route', 'routes', 'airports', 'trip']) assert.ok(fl.panels.includes(p), p);
  for (const p of ['search', 'regions', 'categories', 'tags', 'companies', 'alerts']) assert.ok(jb.panels.includes(p), p);
  assert.equal(flightAskOf('flight co2 calculator'), '/flights/?mode=co2');
  assert.equal(flightModeOf('', '#distance'), 'facts');
  assert.equal(jobAskOf('job alerts'), '/jobs/?mode=alerts');
  assert.equal(jobAskOf('jobs in germany'), '/jobs/?region=europe');
  assert.equal(jobAskOf('remote jobs with salaries'), '/jobs/?salaryOnly=1&sort=salary');
  assert.equal(jobAskOf('remote companies hiring'), '/jobs/?mode=companies');
  assert.equal(jobModeOf('?mode=alerts', ''), 'jb-alerts');
});
