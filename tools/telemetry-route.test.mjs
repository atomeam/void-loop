// The telemetry route (lib/telemetry.js, skills/telemetry-route.js): a pasted developer log is read, a question or a short line is left alone.
// node --test tools/telemetry-route.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { telemetryOf, failuresOf, summaryOf, signalsOf } from '../void-live-deploy/lib/telemetry.js';
import skill from '../void-live-deploy/skills/telemetry-route.js';

const LOG = `Fixes so far:
- **Near choir:** its tap buttons broke on example asks containing quotes, so the tap ran a stub ask.
- **Rubber band:** the suite dragged before the skill was listening.
FAIL stage pack h: "what almost answered that" lists up to 3 other skills
Not fixed yet: the undo pile failed only in my long combined local run.
Committed a7de5ca and pushed; PR 1083 is a draft. 159/162 passed. The fast checks passed on the untouched branch.`;

test('a pasted CI report is read: commits, PRs, the pass count and what is failing', () => {
  const t = telemetryOf(LOG);
  assert.ok(t, 'taken'); assert.equal(t.kind, 'ci');
  assert.ok(t.shas.includes('a7de5ca')); assert.deepEqual(t.prs, ['1083']); assert.deepEqual(t.passed, { ok: 159, of: 162 });
  assert.ok(t.failures.some((f) => /stage pack h/.test(f)));
  assert.ok(summaryOf(t).some((l) => /Pull requests: #1083/.test(l)));
});

test('questions, instructions and short lines are never taken', () => {
  for (const q of ['why is my ci red', 'fix this failing test', 'what is a browser suite', 'the browser suite failed on 57ab1f2e', 'FAIL', '',
    'why does my CI keep failing when the unit tests pass locally and the browser suite is red on main after every deploy that I push to the pull request branch?'])
    assert.equal(telemetryOf(q), null, q);
  assert.equal(telemetryOf('a '.repeat(200)), null, 'long but no evidence');
});

test('failuresOf drops lines that say nothing failed, caps at six and clips long lines', () => {
  assert.deepEqual(failuresOf('no failures here at all, everything is fine today\nNothing red and no conflicts in this one'), []);
  const many = Array.from({ length: 9 }, (_, i) => 'FAIL check number ' + i + ' ' + 'x'.repeat(130)).join('\n');
  const f = failuresOf(many); assert.equal(f.length, 6); assert.ok(f.every((l) => l.length <= 110));
});

test('the skill takes its example and leaves its near misses; the card escapes what it shows', () => {
  for (const e of skill.examples) assert.equal(skill.match(e.toLowerCase(), e), true);
  for (const n of skill.nearMisses) assert.equal(skill.match(n.toLowerCase(), n), false, n);
  let html = ''; const api = { esc: (s) => String(s).replace(/</g, '&lt;'), stage: { ask() {} }, showPage: (b) => { const p = { innerHTML: '' }; b(p); html = p.innerHTML; return { addEventListener() {} }; } };
  assert.equal(skill.run(LOG.replace('stage pack h', '<b>x</b>'), api), 'telemetry-route');
  assert.ok(html.includes('&lt;b') && !html.includes('<bx'));
  assert.equal(skill.run('why is my ci red', api), 'none');
  assert.ok(signalsOf(LOG).length >= 4);
});

test('a builder\'s own report of a run is not a list of failures: narration and "red checks" as a name are left out, a real "fails on main" stays (the card of 2026-10-18)', () => {
  const report = ["I'm making it opt-in so red checks only grow on their own after the garden's test failures have been shown. ⏎ Committing the opt-in fix and running the remaining finish steps (fast checks, push, PR body). ⏎ Confirmed the merge commit 92189bd.",
    'Pushing the changes and opening the PR now. ⏎ Took Verse\'s first open ask from the card and shipped it as PR #1090, labelled for automerge.',
    'Once a garden has been shown or asked for its test failures, every mount reads incidents.json and plants each failing check of the incidents it has not seen.',
    'The same check failing again becomes a weed, a rule written beside it compost. First contact plants only the newest incident, so an old stage is not flooded.',
    'Three garden browser checks pass in a real browser. The fast checks are clean apart from four reds that are not this branch\'s: book-face fails identically on main (page 304 runs off its sheet), claude-brain needs an npm package the container never installed.',
    'Commit e819d8d went red on main after the merge; the suite ran 464/465 passed.'].join('\n');
  const f = failuresOf(report);
  assert.ok(f.some((l) => /book-face fails identically/.test(l)), 'the real failure stays: ' + JSON.stringify(f));
  assert.ok(f.some((l) => /went red on main/.test(l)), 'a commit that went red stays: ' + JSON.stringify(f));
  for (const bad of [/^I'm making/, /^Committing/, /^Pushing/, /^Took Verse/, /^Once a garden/, /^First contact/, /^Three garden/]) assert.ok(!f.some((l) => bad.test(l)), 'narration left out: ' + bad + ' in ' + JSON.stringify(f));
  const t = telemetryOf(report);
  assert.ok(t && t.prs.includes('1090') && t.shas.includes('92189bd'), 'still read as a report');
  assert.equal(t.failures.length, 2, 'two real ones, not six: ' + JSON.stringify(t.failures));
  assert.deepEqual(failuresOf('the error garden grows a sprout for every red check of the suite; red checks grow in it by themselves'), [], '"red checks" as a name is not a state');
  assert.deepEqual(failuresOf('verify-main is red since #411: the proposal card check FAILS on every head'), ['verify-main is red since 411: the proposal card check FAILS on every head'], 'a state line stays (clean() strips the #)');
});

test('a builder\'s own sentence behind a list marker, and a failure that passed on its own, are not still failing (2026-10-18 card)', () => {
  assert.deepEqual(failuresOf("- I didn't touch films; it failed once under load and passed on its own."), []);
  assert.deepEqual(failuresOf("1. I did not look into it; it keeps failing on main."), [], 'narration behind a number');
  assert.deepEqual(failuresOf('The suite failed on the first run and passed again on a re-run.'), []);
  assert.deepEqual(failuresOf('The check is still red on main and nobody has fixed it yet.').length, 1, 'a real one stays');
  assert.equal(failuresOf('- **book-face:** fails on plain origin/main too, page 305 off the sheet').length, 1, 'a bullet name line stays');
});

test('a builder\'s report that quotes a timeout is a report, not a broken automation; a real automation error still is one', async () => {
  const { intentOf, isFixAsk } = await import('../void-live-deploy/lib/automation-fix.js');
  const { isBuildersReport } = await import('../void-live-deploy/lib/telemetry.js');
  const report = 'I fixed three red checks on main in PR 1096 and I am watching it. The 3D block stalls with a check timeout after the voice check, the CI suite stays red, and I did not fix it. All three fixed checks failed locally and pass now after the push.';
  assert.equal(isBuildersReport(report), true); assert.equal(intentOf(report).intent, 'report'); assert.equal(isFixAsk(report), false);
  const zap = 'my zap keeps failing with 429 Too Many Requests and the workflow stops on every single run, here is the log: {"status":429,"error":"rate limit"} on the webhook step, how do I fix it?';
  assert.equal(isBuildersReport(zap), false); assert.equal(isFixAsk(zap), true);
});

test('a failure caused on purpose to prove a check bites is not still failing (2026-10-18 card: a gap 2 report)', () => {
  assert.deepEqual(failuresOf('The check bites: with the mutation it fails, and the zip check also fails, as expected. page.js is restored.'), []);
  assert.deepEqual(failuresOf('- Found: Without the refusal, the gap 2 check fails.'), []);
  assert.deepEqual(failuresOf('With the refusal taken out of the code, the new check fails, so it really tests the refusal.'), []);
  assert.equal(failuresOf('The extension check fails on main since the merge.').length, 1, 'a real one stays');
  assert.equal(failuresOf('- **book-face:** fails without warning on plain origin/main').length, 1, '"without" alone is not a planned failure');
});

test('the lines of a status report that are the builder\'s own account of a fix are not still failing (2026-10-18 card: six "failures", all narration)', () => {
  for (const line of ['My report quoted a "check timeout", which the fixer read as an error.', 'Without it, the check fails, because the card never appears.',
    '- Found: It fails without the change and passes with it.', 'It then answered "I read this as a broken automation" and invented a fix.', 'Remainder: unverified, the live site failed to answer once.'])
    assert.deepEqual(failuresOf(line), [], line);
  assert.equal(failuresOf('The 3D block stalls with a check timeout after the voice check.').length, 1, 'a real one stays');
  assert.equal(failuresOf('FAIL fly stars move: the streak never showed').length, 1, 'a FAIL line stays');
});

test('a condition or a "would" is not a failure that is still happening (the 2026-10-19 card counted both)', async () => {
  const { failuresOf } = await import('../void-live-deploy/lib/telemetry.js');
  const f = failuresOf('Pull requests: #1157, #1158\nIf either PR goes red or hits a conflict, fix it first.\nA failing check would automatically revert the commit that broke it.\nFAIL fly stars move: the streak never showed.\nWhen the suite fails again the revert runs.');
  assert.deepEqual(f, ['FAIL fly stars move: the streak never showed.']);
});

test('a plan\'s designed outcome is not a failure either (the same card, later on 2026-10-19)', async () => {
  const { failuresOf } = await import('../void-live-deploy/lib/telemetry.js');
  const f = failuresOf('Commits: fdc826d3\nThe laptop task then fails loudly instead of overwriting the card.\nStep 2 makes it fail harmlessly either way.\nThe deploy will fail closed without the token.\nFAIL living arrows: lock it did nothing.\nverify-main failed on ecdfb6bb.');
  assert.deepEqual(f, ['FAIL living arrows: lock it did nothing.', 'verify-main failed on ecdfb6bb.']);
});

test('a short builder status update that links this repo\'s own pull request opens the reality card; an instruction about the link does not (owner, 2026-10-19: "i pasted yor reply got nothing but line")', async () => {
  const { telemetryOf } = await import('../void-live-deploy/lib/telemetry.js');
  for (const t of [
    "Two more bot notices on [atomeam/void-loop#1176](https://github.com/atomeam/void-loop/pull/1176), neither actionable: Codex is out of credits, and CodeRabbit skips repos with fewer than 10 stars. The PR is still waiting on Verse's own review.",
    "Nothing to act on in those PR notices: two are paid review bots out of credits, two are subscription confirmations. [atomeam/void-loop#1176](https://github.com/atomeam/void-loop/pull/1176) is waiting on Verse's own review, and I'll act on whatever that review finds.",
  ]) { const r = telemetryOf(t); assert.ok(r, t.slice(0, 40)); assert.deepEqual(r.prs, ['1176']); assert.deepEqual(r.failures, []); }
  for (const t of ['review this PR https://github.com/atomeam/void-loop/pull/1176 and tell me what is wrong with it', 'what does https://github.com/atomeam/void-loop/pull/1176 change in the self card?', 'see https://github.com/someone/else/pull/12 for the details of that change, thanks']) assert.equal(telemetryOf(t), null, t);
});

// The exact report the owner pasted on 2026-10-29 (9 lines, 724 characters). Verse answered it with the broken-automation fix card.
export const PASTED_STATUS = "Putting a thread on Verse's own asks: promote the 60 checked and tested skills, start with Words and the world, then edge caching for answers and the STL checker\n\nThat thread didn't start. A safety check blocked it because it would merge and deploy to the live site, and your message was only the screenshot.\n\nIf you want it, say so in words: promote the checked and tested skills, add edge caching for answers, build the STL checker, and deploy.\n\nVerse's own job loop merged #1470 by itself. It adds a /prizes/ row for crypto rewards and gambling, marked core. Nobody chose that, so it's worth a look.\n\nAlso, the sprite sheet cleaner is live, and the fix for the will's coder is set to ship after the 8 PM run limit resets.";

test('a pasted status report is read back as what changed, what waits and the next step (owner, 2026-10-29)', async () => {
  const { statusReadOf, isStatusReport } = await import('../void-live-deploy/lib/telemetry.js');
  assert.equal(PASTED_STATUS.length, 724); assert.equal(PASTED_STATUS.split('\n').length, 9);
  assert.equal(isStatusReport(PASTED_STATUS), true);
  assert.deepEqual(statusReadOf(PASTED_STATUS), {
    changed: ["Verse's own job loop merged #1470 by itself.", 'It adds a /prizes/ row for crypto rewards and gambling, marked core.', 'The sprite sheet cleaner is live.'],
    waits: ["That thread didn't start.", 'A safety check blocked it because it would merge and deploy to the live site, and your message was only the screenshot.', "Nobody chose that, so it's worth a look.", "The fix for the will's coder is set to ship after the 8 PM run limit resets."],
    blocked: [],
    next: 'If you want it, say so in words: promote the checked and tested skills, add edge caching for answers, build the STL checker, and deploy.',
  });
  const t = telemetryOf(PASTED_STATUS);
  assert.ok(t); assert.equal(t.kind, 'status'); assert.deepEqual(t.prs, ['1470']); assert.deepEqual(t.failures, []);
  assert.equal(skill.match(PASTED_STATUS.toLowerCase(), PASTED_STATUS), true);
  const lines = summaryOf(t);
  assert.ok(lines.includes("Changed: Verse's own job loop merged #1470 by itself."));
  assert.ok(lines.includes("Waiting: That thread didn't start."));
  assert.ok(lines.includes('Next step: If you want it, say so in words: promote the checked and tested skills, add edge caching for answers, build the STL checker, and deploy.'));
  assert.ok(!lines.some((l) => /broken|automation|troubleshoot/i.test(l)));
});

// The report the owner pasted into Verse on 2026-10-30, rebuilt from the card it made: a copied chat, with its ⏎ line marks, an old question
// and the chat's own "Today 7:34 AM" stamp. The card filed the stamp and the question under "Changed", "Video is blocked" under "Waiting",
// and still said "Nothing in it names a failure".
export const PASTED_CHAT = "The image page on a-to-mind.com is live and now picks its model from Verse's own scores.\nA 5 second draft clip costs about 3 cents. ⏎ Should I build the video page once you add AI Gateway credits? ⏎ Today 7:34 AM ⏎ The video page is live at a-to-mind.com/video/.\nIt says \"video turns on when credits are added\".\nVerse runs a test every few hours and turns the page on by itself after the first real clip. ⏎ The clip link fix and the fix to Verse's code review are merged and live. ⏎ The one step left is yours: add AI Gateway credits in your Cloudflare account.\nI checked today's test pictures by eye. klein-4b scores best, and the test runs again every day. ⏎ Video is blocked.";

test('a copied chat is read line by line: its stamps and old questions are dropped, and a thing that is blocked is shown as blocked (the 2026-10-30 card)', async () => {
  const { statusReadOf } = await import('../void-live-deploy/lib/telemetry.js');
  const r = statusReadOf(PASTED_CHAT);
  assert.ok(r);
  assert.deepEqual(r.blocked, ['Video is blocked.']);
  assert.equal(r.next, 'The one step left is yours: add AI Gateway credits in your Cloudflare account.');
  assert.ok(r.changed.includes('The video page is live at a-to-mind.com/video/.'));
  assert.ok(r.changed.includes("The clip link fix and the fix to Verse's code review are merged and live."));
  const all = [...r.changed, ...r.waits, ...r.blocked, r.next].join('\n');
  assert.doesNotMatch(all, /⏎|Today 7:34|\?/, 'no chat mark, stamp or question is read as a fact');
  const lines = summaryOf(telemetryOf(PASTED_CHAT));
  assert.ok(lines.includes('Blocked: Video is blocked.'));
  assert.ok(lines.includes('1 thing is blocked, and nothing in it names a failure'));
  assert.ok(!lines.some((l) => /^Nothing in it names a failure/.test(l)), 'the plain "nothing failing" line is not shown over a blocker');
  // "a check blocked it" is still a wait, and a line that only starts like a day is not a stamp
  assert.deepEqual(statusReadOf('The new header on the home page is live for everyone. A safety check blocked the deploy of the footer for now. Monitor: the menu fix shipped this morning. The footer is set to ship after the run limit resets tonight.'), {
    changed: ['The new header on the home page is live for everyone.', 'Monitor: the menu fix shipped this morning.'],
    waits: ['A safety check blocked the deploy of the footer for now.', 'The footer is set to ship after the run limit resets tonight.'], blocked: [], next: null });
});

test('a status read needs both a change and a wait, and never takes a complaint that something is broken', async () => {
  const { statusReadOf } = await import('../void-live-deploy/lib/telemetry.js');
  for (const t of [
    'My zap stopped firing after the update went live. It is blocked on something and the webhook is pending. I added a filter yesterday and nothing works since then, so what do I change?',
    'The new header is live. The footer is live too. The about page shipped this morning and the menu was fixed. Everything from the list is done now and merged into main.',
    'why did the deploy not start? It was merged an hour ago and it is still pending on the queue with nothing in the log at all, which is odd for this repo.',
    "That thread didn't start.",
  ]) assert.equal(statusReadOf(t), null, t.slice(0, 50));
});

// The report behind the card the owner pasted on 2026-10-30 (lines joined by ⏎, as a copied chat joins them). The card read its closing checks and a
// time stamp back as "Changed:" lines, and said four were still failing over a main that had passed every shard: the noun "the red", a sentence on what
// the suite does, and a red the report itself bounds in time.
test('the 2026-10-30 report: closing checks and time stamps are not changes, and "the red", a suite rule and a bounded red are not failing', async () => {
  const { statusReadOf } = await import('../void-live-deploy/lib/telemetry.js');
  const report = ['The walking cartoon fix (#1748) merged at 05:44Z.', 'I have no result yet. ⏎ Merging before test-and-deploy finished, as #1668 did, is by design.',
    'The browser run is not finished. ⏎ Remainder: unverified ⏎ [HYGIENE CHECK] ⏎ Request names: the walking cartoon: clear it and throw it. ⏎ Change reaches: walker.js (the skill and the lib), plus the stage-cleared event in void.html and its 2 deploy copies. ⏎ Outside: none ⏎ Decision: keep ⏎ Today 2:15 AM ⏎ The walking cartoon passes in the real browser: all 6 walker checks are green on main.',
    'The reviewer is right about the red. The copies check went red on main. The full suite runs on main and reverts a commit that fails it.',
    'Main was red from about 05:44Z to 05:48Z because of my missed copy. #1764 is merged, so Verse\'s review now compares void.html with both deploy copies.',
    'Automerge waits only for Verse\'s review. Commit 2fbc0ee8 and PR #1773 and #1337.'].join('\n');
  const f = failuresOf(report);
  assert.ok(!f.some((l) => /right about the red|reverts a commit|from about 05:44Z/.test(l)), JSON.stringify(f));
  assert.ok(f.some((l) => /copies check went red on main/.test(l)), 'a red the report does not bound stays: ' + JSON.stringify(f));
  const read = statusReadOf(report);
  const said = [...read.changed, ...read.waits].join(' | ');
  assert.ok(!/HYGIENE|Remainder|Decision|Outside|Request names|Change reaches|2:15 AM|⏎/.test(said), said);
  assert.ok(read.waits.some((w) => /not finished/.test(w)) && read.waits.some((w) => /no result yet/.test(w)), said);
  assert.ok(read.changed.some((c) => /#1748\) merged/.test(c)), said);
  assert.match(summaryOf(telemetryOf(report)).pop(), /^It names 1 thing as failing$/);
});

// The report the owner pasted on 2026-10-30 at 16:19Z, cut at "The Versus jo" (lines joined by ⏎). Before #1978 Verse answered it with "I keep my keys
// and settings locked away"; then the page read it as a broken automation ("Not found", "fix", "jobs"), because "is on automerge" and "gave back"
// were not read as open, so it was no status report.
export const REPORT_1030 = 'The "5 m c" fix is live. The card no longer labels 5 m/s as Mach and makes no notation claim. ⏎ "The 3 mile run" showed a new fault live: the card said Not found, because the model\'s refusal hid the exact conversion. The fix (#1775) is on automerge, and I will check the live card after it deploys. ⏎ Beam\'s log shows the rekey ran and the old key stopped. Beam also gave back 2 Versus jobs because it found no spec for them. ⏎ Today 2:35 AM ⏎ "the 3 mile run" is fixed and verified live. It now answers "3 miles is 4.83 km (4,828 m)." and no longer shows Not found (#1775, deployed). ⏎ The Versus jo';
test('the 2026-10-30 16:19Z report is read as a report: what is live and verified, and what is still open', async () => {
  const { statusReadOf, isStatusReport } = await import('../void-live-deploy/lib/telemetry.js');
  const { intentOf, isFixAsk, hasDetails } = await import('../void-live-deploy/lib/automation-fix.js');
  assert.equal(isStatusReport(REPORT_1030), true);
  assert.equal(intentOf(REPORT_1030).intent, 'report'); assert.equal(isFixAsk(REPORT_1030), false); assert.equal(hasDetails(REPORT_1030), false);
  assert.deepEqual(statusReadOf(REPORT_1030), {
    changed: ['The "5 m c" fix is live.', '"the 3 mile run" is fixed and verified live.', 'It now answers "3 miles is 4.83 km (4,828 m)." and no longer shows Not found (#1775, deployed).'],
    // "#1775 is on automerge, and I will check the live card after it deploys" is closed by the later "(#1775, deployed)"
    waits: ['Beam also gave back 2 Versus jobs because it found no spec for them.'],
    blocked: [],
    next: null,
  });
  // a wait no later line closes stays open
  const open = REPORT_1030.replace(/ ⏎ Today 2:35 AM[\s\S]*$/, '');
  assert.ok(statusReadOf(open).waits.includes('The fix (#1775) is on automerge.'), JSON.stringify(statusReadOf(open)));
  const t = telemetryOf(REPORT_1030);
  assert.equal(t.kind, 'status'); assert.deepEqual(t.failures, []);
  assert.equal(skill.match(REPORT_1030.toLowerCase(), REPORT_1030), true);
});
