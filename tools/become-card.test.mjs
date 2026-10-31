// The "What I want to become" card (void.html showWill), as the owner copies it (2026-10-30): no "Got it" line between the asks,
// each want numbered with "Why:" and "Evidence:" on their own lines, and a built ask marked done under "Already built".
// Run: node --test tools/become-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
const start = page.indexOf('async function showWill() {'), end = page.indexOf('\n    // Verse\'s voice', start);
const body = page.slice(page.indexOf('{', start) + 1, page.lastIndexOf('}', end));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

async function draw(will) {
  // the page's own showPage, cut down: it draws into a fresh element and makes it the open page
  const run = new AsyncFunction('fetch', 'esc', 'let vpageEl = null; const showPage = (f) => { const p = { innerHTML: \'\' }; f(p); vpageEl = p; return p; };\n' + body + '\nreturn vpageEl;');
  return (await run(async () => ({ json: async () => will }), esc)).innerHTML;
}
// the text a copy of the card gives: one line per block
const text = (html) => html.replace(/<(?:\/(?:li|div|b|h2|ol|ul)|br)\s*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').split('\n').map((l) => l.trim()).filter(Boolean);

const WILL = { at: '2026-10-30T17:00:00Z',
  wants: [{ i_want: 'Offer my proven skills as MCP tools too', because: 'other AIs could call my world clock and country facts', evidence: 'void.plan.md Next 11' },
    { i_want: 'Explain my answers better', because: 'asked 3 times', evidence: 'asked 3 times' }],
  got: [{ i_want: 'Absorb and connect every repo', builtAt: '2026-10-22', what: 'every repo is one Verse' }] };

test('each want is numbered, with Why and Evidence on their own lines', async () => {
  const t = text(await draw(WILL));
  const i = t.indexOf('1. Offer my proven skills as MCP tools too');
  assert.ok(i > 0, t.join(' | '));
  assert.equal(t[i + 1], 'Why: other AIs could call my world clock and country facts');
  assert.equal(t[i + 2], 'Evidence: void.plan.md Next 11');
  assert.equal(t[i + 3], '2. Explain my answers better');
  assert.equal(t[i + 4], 'Why: asked 3 times', 'evidence that says the same as the reason is not shown twice');
});

test('a built ask is marked done under Already built, after every want, and no "Got it" line is left', async () => {
  const t = text(await draw(WILL));
  assert.ok(!t.some((l) => /^got it$/i.test(l)), t.join(' | '));
  const h = t.indexOf('Already built');
  assert.ok(h > t.indexOf('2. Explain my answers better'), 'the built list comes after the wants');
  assert.equal(t[h + 1], 'Done: Absorb and connect every repo');
  assert.equal(t[h + 2], 'Built 2026-10-22: every repo is one Verse');
  assert.ok(!t.some((l) => /^\d+\. Absorb/.test(l)), 'the built ask is never numbered as a want');
});

test('all three page copies draw the same card', () => {
  for (const p of ['../void-live-deploy/void.html', '../void-live-deploy/index.html']) assert.equal(readFileSync(new URL(p, import.meta.url), 'utf8'), page, p);
});
