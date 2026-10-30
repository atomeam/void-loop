// tools/baggage-live.mjs: the record of one day's reading of the airline pages, on made-up pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordOf, ledgerWhat, artifactName, textOf, CHECKS, readPages } from './baggage-live.mjs';
import { ROWS, SOURCES } from '../void-live-deploy/skills/baggage.js';
import { entryProblem } from './grow.mjs';

const AT = '2026-10-30T14:23:05.000Z';
// each page as it writes the figures (wording as read on 2026-10-30), wrapped in markup the way the live pages are
const PAGES = {
  'American: checked bags': '<main><p>Weight: 50 lbs / 23 kgs</p><p>Business: 70&nbsp;lbs / 32 kgs</p><p>Size: 62 in / 158 cm</p></main>',
  'American: carry-on bags': '<ul><li>22 x 14 x 9 inches (56 x 36 x 23 cm)</li><li>18 x 14 x 8 inches (45 x 35 x 20 cm)</li></ul>',
  'British Airways: baggage': '<div>23kg (50lb)</div><div>32kg (70lb)</div><div>56 x 45 x 25cm</div><script>var x = "100 lbs / 45 kgs";</script>',
  'American: heavy bags': '<p>We don\'t accept checked bags over 100 lbs / 45 kgs</p><p>Over 53 lbs / 24 kgs &ndash; 70 lbs / 32 kgs</p>',
};
const ok = (body) => ({ status: 200, body, ms: 120 });
const all = () => Object.fromEntries(SOURCES.map(([n]) => [n, ok(PAGES[n] || '')]));

test('baggage-live: every row of the card is checked, and every check reads a page the card cites', () => {
  const names = new Set(SOURCES.map(([n]) => n));
  for (const [label] of ROWS) assert.ok(CHECKS.some((c) => c.row === label), 'no live check for the row ' + label);
  for (const c of CHECKS) {
    assert.ok(names.has(c.source), c.source + ' is not a source the card cites');
    assert.ok(ROWS.some(([label]) => label === c.row), c.row + ' is not a row of the card');
    assert.ok(c.re.test(c.figure), 'the check for ' + c.figure + ' does not match its own figure');
  }
  for (const [n] of SOURCES) assert.ok(PAGES[n], 'the test has no page for ' + n);
});

test('baggage-live: textOf drops scripts and markup and makes entities plain', () => {
  const t = textOf('<p>a&nbsp;b</p><script>secret()</script><style>x{}</style>c &ndash; d &times; e');
  assert.equal(t.trim(), 'a b c – d x e');
});

test('baggage-live: all pages answering with every figure is a live, ok record, and its ledger line is a valid finding', () => {
  const rec = recordOf({ pages: all(), at: AT, occasion: 1 });
  assert.equal(rec.attempt, 'live'); assert.equal(rec.skill, 'baggage'); assert.equal(rec.ok, true);
  assert.equal(rec.found, CHECKS.length); assert.equal(rec.of, CHECKS.length); assert.equal(rec.error, '');
  assert.equal(artifactName(rec), '2026-10-30T1423.json');
  const what = ledgerWhat(rec);
  assert.match(what, /for the first time/); assert.match(what, /findings\/baggage\/2026-10-30T1423\.json/);
  assert.equal(entryProblem({ at: '2026-10-30T14:23:05Z', by: 'baggage-live', kind: 'finding', what, ref: 'https://github.com/atomeam/void-loop/blob/main/findings/baggage/2026-10-30T1423.json' }), null);
  assert.match(ledgerWhat({ ...rec, occasion: 4 }), /occasion 4/);
});

test('baggage-live: a figure gone from its page or a page that did not answer is never ok, and says which', () => {
  const pages = all();
  pages['American: heavy bags'] = ok('<p>We do not accept checked bags over 120 lbs / 54 kgs</p><p>Over 53 lbs / 24 kgs - 70 lbs / 32 kgs</p>');
  const gone = recordOf({ pages, at: AT });
  assert.equal(gone.ok, false); assert.equal(gone.found, CHECKS.length - 1);
  assert.match(gone.error, /not found: 100 lbs \/ 45 kgs \(American: heavy bags\)/);
  assert.match(ledgerWhat(gone), /found 9 of 10 figures/);
  const down = all(); down['British Airways: baggage'] = { status: 403, body: '', ms: 300 };
  const rec = recordOf({ pages: down, at: AT });
  assert.equal(rec.ok, false); assert.match(rec.error, /^British Airways: baggage: HTTP 403; not found: /);
  assert.equal(rec.checks.filter((c) => c.source === 'British Airways: baggage').every((c) => !c.found), true, 'a page that did not answer finds nothing');
  // a figure written only inside a script is not on the page
  const scripted = all(); scripted['American: heavy bags'] = ok('<script>"100 lbs / 45 kgs"</script><p>Over 53 lbs / 24 kgs to 70 lbs / 32 kgs</p>');
  assert.equal(recordOf({ pages: scripted, at: AT }).checks.find((c) => c.figure === '100 lbs / 45 kgs').found, false);
});

test('baggage-live: readPages reads each cited page once, and an unreachable page comes back as status 0 with the reason', async () => {
  const seen = [];
  const out = await readPages(async (u, o) => {
    seen.push(u); assert.ok(o.signal);
    if (u.includes('britishairways')) { const e = new Error('fetch failed'); e.cause = { code: 'ECONNRESET' }; throw e; }
    return { status: 200, text: async () => 'page' };
  });
  assert.deepEqual(seen, SOURCES.map(([, u]) => u));
  assert.equal(out['British Airways: baggage'].status, 0); assert.equal(out['British Airways: baggage'].error, 'ECONNRESET');
  assert.equal(out['American: checked bags'].body, 'page');
});
