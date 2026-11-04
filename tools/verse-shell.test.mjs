// The app shell: nav, the live line, the command palette list, and the pages that carry it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV, currentNav, latestFeed, proofLine, commands, filterCommands, speculationRules, dressHtml, dressPath } from '../void-live-deploy/lib/verse-shell.js';
import { contrast } from '../void-live-deploy/lib/empty-state.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('the nav names the shell pages, and the current page is the longest match', () => {
  assert.deepEqual(NAV.map((n) => n.href), ['/', '/team/', '/bots/', '/agent/', '/conquered/', '/films/', '/treasury/', '/scoreboard/', '/security/', '/limits/', '/contribute/']);
  assert.equal(currentNav('/scoreboard/').label, 'Scoreboard');
  assert.equal(currentNav('/limits/').label, 'Limits');
  assert.equal(currentNav('/').label, 'Ask');
  assert.equal(currentNav('/team/').label, 'Team');
  assert.equal(currentNav('/team/join/abc').label, 'Team');
  assert.equal(currentNav('/bots/').label, 'Bots');
  assert.equal(currentNav('/agent').label, 'Agents');
  assert.equal(currentNav('/tower/').label, 'Tower');
  assert.equal(currentNav('/conquered/').label, 'Tower');
  assert.equal(currentNav('/films/').label, 'Films');
  assert.equal(currentNav('/nope'), null);
});

test('the live line uses only the numbers it was given', () => {
  const crew = [
    { name: 'SiteOperator', here: true, did: 'checked the links', didAt: 20 },
    { name: 'TowerScout', here: false, did: 'mapped a site', didAt: 10 },
  ];
  assert.equal(latestFeed(crew).name, 'SiteOperator');
  assert.equal(proofLine({ crew, beaten: 2 }), '1 of 2 bots here · 2 tower wins · SiteOperator: checked the links');
  assert.equal(proofLine({ crew: [], beaten: 1 }), '1 tower win');
  assert.equal(proofLine({}), '');
  assert.equal(proofLine({ beaten: NaN }), '');
});

test('the palette leads with Ask Verse on the home page and filters by the typed words', () => {
  const home = commands('/');
  assert.equal(home[0].href, '#ask');
  assert.equal(commands('/films/')[0].href, '/');
  assert.deepEqual(filterCommands(home, 'tow').map((c) => c.label), ['Tower']);
  assert.equal(filterCommands(home, '').length, home.length);
  const rules = speculationRules();
  assert.equal(rules.prefetch[0].eagerness, 'moderate');
  assert.ok(rules.prefetch[0].where.href_matches.includes('/treasury/'));
});

test('ink on the void clears WCAG AA', () => {
  const ink = [195, 200, 216], bg = [5, 5, 5];
  assert.ok(contrast(ink, bg) >= 4.5, contrast(ink, bg));
});

test('dressHtml adds the shell on the named pages and nowhere else', () => {
  const bare = '<html><head></head><body><p>Hi</p></body></html>';
  const home = dressHtml(bare, '/');
  assert.match(home, /href="\/verse\.css"/);
  assert.match(home, /src="\/verse-shell\.js"/);
  assert.match(home, /src="\/verse-field\.js"/);
  assert.equal(dressHtml(home, '/'), home);
  assert.doesNotMatch(dressHtml(bare, '/team/'), /verse-field\.js/);
  assert.equal(dressHtml(bare, '/calculator/'), bare);
  assert.match(dressHtml(bare, '/scoreboard/'), /verse-shell\.js/);
  assert.match(dressHtml(bare, '/contribute/'), /verse-shell\.js/);
  assert.equal(dressPath('/tower/'), false);
  const css = read('void-live-deploy/verse.css');
  assert.match(css, /--d-ink:\s*#f2f4fb/);
  assert.match(css, /--d-key:\s*158 178 255/);
  assert.match(css, /min-height:\s*var\(--vs-touch\)/);
  assert.match(css, /@view-transition/);
  assert.match(css, /animation-timeline:\s*scroll\(root\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  const sw = read('void-live-deploy/sw.js');
  assert.match(sw, /function dress/);
  assert.match(sw, /\/scoreboard\//);
  assert.match(sw, /\/contribute\//);
  assert.match(sw, /\/verse-shell\.js/);
  assert.match(read('void-live-deploy/verse-field.js'), /prefers-reduced-motion/);
  assert.match(read('void-live-deploy/verse-shell.js'), /ensureChrome/);
  assert.match(read('void-live-deploy/_redirects'), /\/tower\/\s+\/conquered\/\s+301/);
});
