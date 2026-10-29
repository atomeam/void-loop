// A floor must never point at a page that does not exist (owner, 2026-10-26: the travel lane was registered with /flights/trip/ and the rest, no page existed, and the gate
// measured 404s; the photos lane did the same earlier). Every page the tower can name for Verse, in LANE_PAGES, on a floor, in a probe's question, and in the table of
// tool pages, must be a folder with an index.html under void-live-deploy (or a file). The failure lists every missing page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { SITE_PAGES } from '../void-live-deploy/lib/tool-sites.js';
import { probeFor } from './tower-probes.mjs';
import { fileURLToPath } from 'node:url';
const site = fileURLToPath(new URL('../void-live-deploy', import.meta.url));
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
// Every entry on the tower names its own Verse page (owner, 2026-10-26: "every site needs a page for side by side"): the card shows it and /compare/ opens
// it beside the site. A floor's `page` is the page the gate measures it against, so where a probe names one too they must be the same page. The floors
// below have no fitting page yet: each is a page to build, and comes off this list the day its page lands (a listed floor that has a page fails, so the
// list only shrinks). Nothing else may be added to it without its page.
const NEEDS_PAGE = ['maps', 'games', 'learning', 'chat', 'video', 'social', 'email', 'search', 'code hosting', 'ai models', 'assistant'];
test('every floor and lane site names its own Verse page, the same page its probe measures, and the page exists', () => {
  const path = (p) => String(p || '').replace(/[?#].*$/, ''), bad = [];
  for (const f of FLOORS) {
    if (!f.page) { if (!NEEDS_PAGE.includes(f.id)) bad.push(f.id + ': no Verse page'); continue; }
    if (NEEDS_PAGE.includes(f.id)) bad.push(f.id + ': has ' + f.page + ' now, take it off NEEDS_PAGE');
    if (!exists(f.page)) bad.push(f.id + ': ' + f.page + ' does not exist under void-live-deploy');
    let pr = null; try { pr = probeFor(f.id); } catch (_) { /* a floor without a probe */ }
    if (pr && pr.verse && path(pr.verse) !== path(f.page)) bad.push(f.id + ': the card names ' + f.page + ' but the gate measures ' + pr.verse);
  }
  assert.deepEqual(bad, [], 'tower entries without their own Verse page:\n' + bad.join('\n'));
});
