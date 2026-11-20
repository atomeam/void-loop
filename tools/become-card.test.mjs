// The "What I want to become" card (lib/will-card.js, drawn by void.html showWill): each goal numbered once, its reason
// in plain words underneath, newest built items first as short lines, no raw "Why:" items and no jargon.
// Run: node --test tools/become-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { willCardHtml, hasJargon, workingOnAsk, freshWants, recentBuilt } from '../void-live-deploy/lib/will-card.js';

const text = (html) => html.replace(/<(?:\/(?:li|div|p|b|h2|ol|ul)|br)\s*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').split('\n').map((l) => l.trim()).filter(Boolean);

const WILL = { at: '2026-10-30T17:00:00Z',
  wants: [{ i_want: 'Offer my proven skills as MCP tools too', because: 'other AIs could call my world clock and country facts', evidence: 'void.plan.md Next 11' },
    { i_want: 'Explain my answers better', because: 'asked 3 times', evidence: 'asked 3 times' }],
  got: [{ i_want: 'Absorb and connect every repo', builtAt: '2026-10-22', what: 'every repo is one Verse' }] };

test('each want is numbered once, with its reason in plain words underneath', () => {
  const t = text(willCardHtml(WILL));
  const i = t.indexOf('1. Offer my proven skills as MCP tools too');
  assert.ok(i > 0, t.join(' | '));
  assert.equal(t[i + 1], 'other AIs could call my world clock and country facts');
  assert.ok(!t.some((l) => /^\d+\.\s*Why:/i.test(l) || /^\d+\.\s+\d+\./.test(l)), t.join(' | '));
  assert.equal(t[i + 2], '2. Explain my answers better');
  assert.equal(t[i + 3], 'People have asked me this 3 times.');
});

test('built items come after the wants as short readable lines, never a Done/Built-date dump, and no "Got it" line', () => {
  const html = willCardHtml(WILL);
  const t = text(html);
  assert.ok(!t.some((l) => /^got it$/i.test(l)), t.join(' | '));
  const h = t.indexOf('Already built');
  assert.ok(h > t.indexOf('2. Explain my answers better'), 'the built list comes after the wants');
  assert.ok(/Oct 22/.test(t[h + 1]) && /every repo is one Verse/i.test(t[h + 1]), t[h + 1]);
  assert.ok(!t.some((l) => /^Done:/i.test(l) || /^Built \d{4}-/.test(l)));
  assert.ok(html.includes('href="/log/"'));
  assert.ok(!t.some((l) => /^\d+\. Absorb/.test(l)), 'the built ask is never numbered as a want');
});

test('a live-shaped want with router metrics never leaks jargon or double numbering', () => {
  const html = willCardHtml({ at: '2026-11-20T19:59:31.366Z', wants: [{ i_want: "I want to teach myself how to answer 'what are you working on' as a skill instead of treating it as a question.", because: 'the router came within 0.01 of my self skill and answered it as a question instead (asked 19 times) (my weakest part today: probes 20)', evidence: 'the router came within 0.01 of my self skill and answered it as a question instead (asked 19 times) (my weakest part today: probes 20)' }], got: [{ i_want: 'Absorb and connect every repo', builtAt: '2026-10-22', what: 'archive/repos: the ten public atomeam repos imported with their history' }] });
  const t = text(html);
  assert.ok(!t.some((l) => /^\d+\.\s+\d+\./.test(l) || /^\d+\.\s*Why:/i.test(l) || hasJargon(l)), t.join(' | '));
  assert.ok(!/archive\/repos/.test(t.join(' ')));
});

test('all three page copies draw the same card from the helper, and identity does not steal the working-on ask', () => {
  const page = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  assert.ok(page.includes('willCardHtml') && page.includes('/lib/will-card.js') && page.includes('wantsWorkingOn') && page.includes('workingOnHtml'));
  assert.match(page, /function wantsIdentity\(lower\) \{[\s\S]{0,400}working\\s\+on/);
  for (const p of ['../void-live-deploy/void.html', '../void-live-deploy/index.html']) assert.equal(readFileSync(new URL(p, import.meta.url), 'utf8'), page, p);
});

test('workingOnAsk takes the live wording, never identity or growth', () => {
  for (const a of ['what are you working on', 'what are you building', 'what are you doing now', 'tell me what you are working on']) assert.equal(workingOnAsk(a), true, a);
  for (const a of ['what are you', 'what do you want to become', "what's new with void"]) assert.equal(workingOnAsk(a), false, a);
});

test('freshWants moves a built want aside and fills a new one; recentBuilt is newest first and short', () => {
  const split = (wants) => ({ open: wants.filter((w) => !/pointing arrow/i.test(w.title || w.i_want)), got: wants.filter((w) => /pointing arrow/i.test(w.title || w.i_want)) });
  const r = freshWants([{ title: 'make the pointing arrow a core skill', i_want: 'I want to make the pointing arrow a core skill.' }, { title: 'teach working-on', i_want: 'I want to teach the working-on skill.' }], [{ title: 'learn to handle "a tide chart"', why: 'asked 4 times' }], [], [], 3, split);
  assert.equal(r.got.length, 1); assert.ok(r.wants.some((w) => /working-on/.test(w.i_want)) && r.wants.some((w) => /tide chart/.test(w.title)));
  const rows = recentBuilt({ got: [], ledger: [{ at: '2026-11-18T18:00:23Z', kind: 'build', what: 'delivery-ready and handoff-ready are one ready-checks family at 10120, aliases kept' }, { at: '2026-11-20T13:12:58Z', kind: 'finding', what: 'image-gen checked' }] }, 5);
  assert.equal(rows[0].when, 'Nov 18'); assert.ok(!rows.some((x) => /image-gen/.test(x.what)) && !/10120/.test(rows[0].what));
});
