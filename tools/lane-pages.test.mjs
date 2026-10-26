// A floor must never point at a page that does not exist (owner, 2026-10-26: the travel lane was registered with /flights/trip/ and the rest, no page existed, and the gate
// measured 404s; the photos lane did the same earlier). Every page the tower can name for Verse, in LANE_PAGES, on a floor, in a probe's question, and in the table of
// tool pages, must be a folder with an index.html under void-live-deploy (or a file). The failure lists every missing page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { SITE_PAGES } from '../void-live-deploy/lib/tool-sites.js';
import { probeFor } from './tower-probes.mjs';
const site = new URL('../void-live-deploy', import.meta.url).pathname;
// pages served by something other than a folder: a dynamic route of the site (the /is-it/ days) or the stage itself
const SERVED = [/^\/$/, /^\/is-it\/[a-z0-9-]+$/, /^\/g\/?$/];
const exists = (p) => { const clean = String(p).replace(/[?#].*$/, ''); if (SERVED.some((r) => r.test(clean))) return true; const f = site + clean; return clean.endsWith('/') ? fs.existsSync(f + 'index.html') : fs.existsSync(f + '/index.html') || (fs.existsSync(f) && fs.statSync(f).isFile()); };
test('every page a floor, a lane, a probe or the tool table names exists as a file', () => {
  const named = new Map(); const add = (p, why) => { if (p && typeof p === 'string' && p.startsWith('/')) named.set(p.replace(/[?#].*$/, ''), (named.get(p.replace(/[?#].*$/, '')) || []).concat(why)); };
  for (const [id, p] of Object.entries(LANE_PAGES)) add(p, 'LANE_PAGES ' + id);
  for (const r of SITE_PAGES) add(r.path, 'the tool table ' + r.path);
  for (const f of FLOORS) { add(f.page, 'floor ' + f.id); let pr = null; try { pr = probeFor(f.id); } catch (_) { /* a floor without a probe */ } if (pr) { add(pr.verse, 'the page of the probe of ' + f.id); if (pr.ask) add(pr.ask.verse, 'the question of ' + f.id); } }
  const missing = [...named].filter(([p]) => !exists(p)).map(([p, why]) => p + '  (' + why.slice(0, 2).join('; ') + ')');
  assert.deepEqual(missing, [], 'pages the tower names that do not exist under void-live-deploy:\n' + missing.join('\n'));
});
