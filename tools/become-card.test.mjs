// The "What I want to become" card (lib/will-card.js, drawn by void.html showWill): each goal numbered once, its reason
// from that want in plain words underneath, newest built items first as short lines, no raw "Why:" items, and no domain
// names, file paths or camelCase / SCREAMING_CASE identifiers.
// Run: node --test tools/become-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { willCardHtml, workingOnHtml, plainPublic, visitorGoal, artSubjectOf, workingOnAsk, freshWants, recentBuilt } from '../void-live-deploy/lib/will-card.js';

const text = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<(?:\/(?:li|div|p|b|h2|ol|ul)|br)\s*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').split('\n').map((l) => l.trim()).filter(Boolean);

// Visible card text only (hrefs are not shown). No domain names, file paths, or camelCase / SCREAMING_CASE identifiers.
function leaks(s) {
  const hits = [];
  for (const [n, re] of [
    ['domain', /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi],
    ['path', /\b(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]+\b|\b[\w.-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|html|css|yml|yaml|md|sh)\b/gi],
    ['SCREAMING_CASE', /\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b/g],
    ['camelCase', /\b[a-z]+[A-Z][a-zA-Z0-9]*\b|\b[A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*\b/g],
  ]) {
    const m = String(s || '').match(re);
    if (m) hits.push(n + ':' + m.join(','));
  }
  return hits;
}


const WILL = { at: '2026-10-30T17:00:00Z',
  wants: [{ i_want: 'Offer my proven skills as MCP tools too', because: 'other AIs could call my world clock and country facts', evidence: 'void.plan.md Next 11' },
    { i_want: 'Explain my answers better', because: 'asked 3 times', evidence: 'asked 3 times' }],
  got: [{ i_want: 'Absorb and connect every repo', builtAt: '2026-10-22', what: 'every repo is one Verse' }] };

test('each want is numbered once, with its reason in plain words underneath', () => {
  const t = text(willCardHtml(WILL));
  const i = t.findIndex((l) => /^1\.\s/.test(l) && /proven skills/i.test(l));
  assert.ok(i > 0, t.join(' | '));
  assert.equal(t[i + 1], 'other AIs could call my world clock and country facts.');
  assert.ok(!t.some((l) => /^\d+\.\s*Why:/i.test(l) || /^\d+\.\s+\d+\./.test(l)), t.join(' | '));
  assert.match(t[i], /^1\. [A-Z]/);
  assert.match(t[i + 2], /^2\. I'm working on how to explain my answers better\./);
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

test('the card shows no domain names, file paths or camelCase / SCREAMING_CASE identifiers', () => {
  const html = willCardHtml({ at: '2026-11-20T21:43:19.208Z', wants: [
    { i_want: "I want to teach myself how to answer 'what are you working on' as a skill instead of treating it as a question.", because: 'the router came within 0.01 of my self skill and answered it as a question instead (asked 19 times) (my weakest part today: probes 20)' },
    { i_want: 'I want to add emojigraph.org to LANE_PAGES in lib/tower.js and begin target assimilation.', because: 'I asked for this 49 times in my reflections (a small one)' },
  ], got: [{ i_want: 'Absorb and connect every repo', builtAt: '2026-10-22', what: 'archive/repos: the ten public atomeam repos imported with their history' }] });
  const t = text(html);
  assert.ok(!t.some((l) => /^\d+\.\s+\d+\./.test(l) || /^\d+\.\s*Why:/i.test(l)), t.join(' | '));
  const hit = leaks(t.join('\n'));
  assert.deepEqual(hit, [], hit.join(' | ') + ' :: ' + t.join(' | '));
  assert.ok(!/emojigraph\.org|LANE_PAGES|lib\/tower\.js|archive\/repos/i.test(t.join(' ')), t.join(' | '));
  assert.match(t.join('\n'), /add emojigraph and begin target assimilation/i);
});

test('ordinary words with a slash or "on," stay; only real file paths and code names come out', () => {
  assert.match(plainPublic('I want to fix the podcast exam failures for audio and show/episode detection.'), /show\/episode detection/);
  assert.equal(plainPublic("what I'm working on, in plain words"), "what I'm working on, in plain words");
  const cleaned = plainPublic('I want to add emojigraph.org to LANE_PAGES in lib/tower.js and begin target assimilation.');
  assert.match(cleaned, /add emojigraph and begin target assimilation/i);
  assert.equal(leaks(cleaned).length, 0, leaks(cleaned).join(' | '));
  const html = willCardHtml({ at: '2026-11-20T22:41:21.142Z', wants: [
    { i_want: 'I want to fix the podcast exam failures for audio and show/episode detection.', because: 'the podcasts exam scored 91.9, the lowest; this ask failed audio' },
  ], recent: [{ at: '2026-11-20T20:20:01Z', when: 'Nov 20', what: "what I'm working on, in plain words" }] });
  const vis = text(html).join('\n');
  assert.match(vis, /play the right episode, and hear the audio/);
  assert.match(vis, /what I'm working on, in plain words/);
  assert.deepEqual(leaks(vis), [], leaks(vis).join(' | '));
});

test('each reason comes from its own want, not from a neighbour', () => {
  const html = willCardHtml({ at: '2026-11-20T21:43:19.208Z', wants: [
    { i_want: 'I want to get better at audio.', because: 'asked 2 times' },
    { i_want: 'I want to answer "tell me a joke" for a visitor.', because: 'a check on the live site failed (my weakest part today: probes 20)' },
    { i_want: 'I want to add emojigraph.org to LANE_PAGES in lib/tower.js and begin target assimilation.', because: 'I asked for this 49 times in my reflections (a small one)' },
  ] });
  const blocks = html.match(/<div class="will-want"[^>]*>[\s\S]*?<\/div>/g) || [];
  assert.equal(blocks.length, 3, html);
  const texts = blocks.map((b) => text(b).join(' '));
  assert.match(texts[0], /asked me this 2 times/);
  assert.ok(!/49 times|live site failed/i.test(texts[0]), texts[0]);
  assert.match(texts[1], /live site failed/);
  assert.ok(!/2 times|49 times/i.test(texts[1]), texts[1]);
  assert.match(texts[2], /49 times/);
  assert.ok(!/2 times|live site failed/i.test(texts[2]), texts[2]);
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
  const rows = recentBuilt({ got: [], ledger: [{ at: '2026-11-18T18:00:23Z', kind: 'build', what: 'The recipe card takes the ask in Spanish' }, { at: '2026-11-20T13:12:58Z', kind: 'finding', what: 'image-gen checked' }, { at: '2026-11-18T12:00:00Z', kind: 'build', what: 'delivery-ready and handoff-ready are one ready-checks family at 10120, aliases kept' }] }, 5);
  assert.equal(rows[0].when, 'Nov 18'); assert.match(rows[0].what, /recipe card/);
  assert.ok(!rows.some((x) => /image-gen|ready-checks|10120/.test(x.what)));
});

test('the working-on card is one capital sentence, no internal log jargon, and complete built titles', () => {
  const html = workingOnHtml({ at: '2026-11-20T22:41:21.142Z', wants: [
    { i_want: 'I want to fix the podcast exam failures for audio and show/episode detection.', because: 'the podcasts exam scored 91.9, the lowest; this ask failed audio' },
  ], recent: [
    { at: '2026-11-20T20:20:01Z', when: 'Nov 20', what: "what I'm working, in plain words" },
    { at: '2026-11-18T22:51:46Z', when: 'Nov 18', what: "Verse hardened itself: 'automation handoff for the email reminders'" },
    { at: '2026-11-18T18:00:23Z', when: 'Nov 18', what: 'A weather card no longer hangs on a slow forecast: every Open-Meteo call has a 4.5 s limit' },
    { at: '2026-11-18T18:00:23Z', when: 'Nov 18', what: 'Delivery-ready and handoff-ready are one ready-checks family' },
  ] });
  const vis = text(html).join('\n');
  assert.ok(!/from my own records, not a guess/i.test(vis), vis);
  const goal = (html.match(/class="will-goal"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  const goalText = text(goal).join(' ');
  assert.match(goalText, /^[A-Z]/, goalText);
  assert.ok(!goalText.includes('</p>') && goalText.split(/[.!?]\s+(?=[A-Z])/).length === 1, 'one sentence, not two broken lines: ' + goalText);
  assert.doesNotMatch(vis, /exam scored 91\.9|failed audio|ready-checks family|automation handoff|hardened itself|4\.5 s limit/i);
  assert.match(vis, /what I'm working on, in plain words/);
  assert.doesNotMatch(vis, /what I'm working,/);
  assert.match(vis, /weather card no longer hangs on a slow forecast/i);
  assert.ok(!/ready-checks/i.test(vis), vis);
  for (const line of text(html).filter((l) => /—/.test(l) || /^[A-Z]/.test(l))) {
    const body = line.replace(/^[A-Z][a-z]{2} \d+ — /, '');
    if (body) assert.match(body, /^[A-Z]/, line);
  }
  assert.match(html, /data-will-quiet/);
  assert.match(html, /vc-pt/);
  assert.equal(artSubjectOf('I want to fix the podcast exam failures for audio and show/episode detection.'), 'podcast microphone on a wooden workbench');
  assert.match(visitorGoal({ i_want: 'I want to fix the podcast exam failures for audio and show/episode detection.' }), /^[A-Z]/);
});
