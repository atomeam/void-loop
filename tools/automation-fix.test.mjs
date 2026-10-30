// lib/automation-fix.js ruleFix: the free diagnosis behind every "Ask Verse about this error" on the /fix/ pages.
import assert from 'node:assert/strict';
import { ruleFix, platformOf, isFixAsk, hasDetails, errorEvidence, intentOf, basisOf } from '../void-live-deploy/lib/automation-fix.js';

// GitHub's "Resource not accessible by integration" is a token permission, not an expired credential
const gh = ruleFix('my github actions workflow is failing with 403 Resource not accessible by integration');
assert.match(gh, /GITHUB_TOKEN does not have the permission/);
assert.match(gh, /permissions/);
assert.doesNotMatch(gh, /expired or lost access/);
// an ordinary 401 still reads as a credential to reconnect, on its own platform
assert.match(ruleFix('my zap is failing with 401 Unauthorized'), /expired or lost access[\s\S]*Zapier/);
// n8n's webhook 404 points at the test URL
assert.match(ruleFix('my n8n workflow is failing with 404 webhook is not registered'), /test webhook URL/);
// a rate limit on Power Automate gets its retry policy
assert.match(ruleFix('my power automate flow is failing with 429 Rate limit is exceeded'), /rate limit[\s\S]*Power Automate/);
assert.equal(platformOf('my github actions workflow is failing'), 'GitHub Actions');

// fix mode on /api/answer runs the model's answer through the patch guard (lib/patch-guard.js) before showing it as a fix
const { onRequestPost } = await import('../void-live-deploy/functions/api/answer.js');
const fixWith = async (content) => (await onRequestPost({ request: new Request('https://a-to-mind.com/api/answer', { method: 'POST', body: JSON.stringify({ mode: 'fix', ask: 'my zap is failing with 401 Unauthorized', details: 'fetch(url, { headers: { authorization: token } })' }) }), env: { AI: { run: async () => ({ response: content }) } } })).json();
const clean = await fixWith('Likely cause: the token expired.\nFix:\n1. Reconnect it.\n```js\nfetch(url, { headers: { authorization: \'Bearer \' + token } });\n```');
assert.equal(clean.fix, 'model');
assert.equal(clean.held, undefined);
// a stub where the corrected code should be: not shown; the rules answer, and the reason in plain words
const stubbed = await fixWith('Likely cause: the token expired.\nFix:\n```js\nfetch(url, opts);\n// ... rest of the code unchanged\n```');
assert.equal(stubbed.fix, 'rules');
assert.match(stubbed.answer, /expired or lost access/);
assert.match(stubbed.held, /^the model's fix was not used: the code block: it says "rest of the code" instead of writing it/);
assert.match(stubbed.note, /was not used: .*; fixed from the error$/);
// corrected code that does not parse is not shown either
const broken = await fixWith('Likely cause: x.\n```javascript\nfetch(url, { headers: { authorization: token } );\n```');
assert.equal(broken.fix, 'rules');
assert.match(broken.held, /does not parse/);

// The intent gate (owner, 2026-10-16): a design discussion that talks about errors, fixes, workflows and empty fields is not a broken
// automation. It was answered "a field it expects is empty" and labelled "from the error itself" with no error in it.
const DISCUSSION = 'Here is how the reply channel should work. A reply needs a type, so the loop knows whether it is a correction, a question or design feedback. '
  + 'When a correction arrives it should route to a rule rewrite, not to a fix template; the workflow is broken in that sense only. '
  + 'I think the router needs an intent gate before anything else: an incident, a design note and a question are different jobs. '
  + 'The required field here is the type, and an empty type should never be guessed into an error report. In order of leverage: intent first, provenance second, a no-action outcome third. '
  + 'Fixing that is a rule change, not new infrastructure.';
assert.equal(intentOf(DISCUSSION).intent, 'discussion');
assert.deepEqual(errorEvidence(DISCUSSION), [], 'talking about errors quotes none');
assert.equal(isFixAsk(DISCUSSION), false, 'a discussion never opens the fix card');
assert.equal(hasDetails(DISCUSSION), false);
assert.equal(ruleFix(DISCUSSION), null, 'no template is forced onto a discussion');
assert.deepEqual(basisOf(DISCUSSION), { from: 'description', quote: '' });
// "field" or "required" in prose, without an error, is not "a field it expects is empty"
assert.equal(ruleFix('my zapier workflow failed and I am not sure which field is required now'), null);
// a real error still gets its fix, and its provenance quotes what showed it
const real = 'my zap is failing: TypeError: Cannot read properties of undefined (reading \'email\')';
assert.equal(intentOf(real).intent, 'incident'); assert.match(ruleFix(real), /a field it expects is empty/);
assert.deepEqual(basisOf(real).from, 'error'); assert.match(basisOf(real).quote, /TypeError: Cannot read properties of undefined/);
for (const [t, kind] of [['the job exited with code 2', 'code'], ['fetch failed: ECONNREFUSED 127.0.0.1:5432', 'code'], ['the API returned 503 Service Unavailable', 'status'], ['  at handler (/srv/app/index.js:42:13)', 'stack'], ['2026-10-16 03:12:44 ERROR sync failed', 'log']])
  assert.ok(errorEvidence(t).some((e) => e.kind === kind), t + ' -> ' + kind);
// numbers that are not statuses are not evidence
assert.deepEqual(errorEvidence('I pasted 500 characters about 404 ideas for the 400-page manual'), []);
// a count is not a status: "with 587 misses" is not HTTP 587 (owner, 2026-10-18: a builder's bench note was answered as a fix)
assert.deepEqual(errorEvidence('the bench finished with 587 misses out of 2388, and the run came back with 404 asks'), []);
assert.ok(errorEvidence('the API returned 503 Service Unavailable').some((e) => e.kind === 'status')); assert.ok(errorEvidence('the call came back with 502').some((e) => e.kind === 'status'));
// a short symptom is still a fix ask, from the description, honestly labelled
assert.equal(isFixAsk('my zap stopped firing'), true); assert.equal(basisOf('my zap stopped firing').from, 'description');
assert.match(ruleFix('my zap stopped firing'), /trigger isn't reaching it/);
assert.equal(intentOf('why does my cron job not run?').intent, 'question');
// a builder's progress note is a report, not a broken automation (owner, 2026-10-18: one was answered with git advice and a "fix")
const note = "The blanket rename broke routing, so I'm reverting it and doing it in smaller pieces. I've reverted the change and redone it on 14 files. Nothing is committed or pushed yet. The fast checks are running now, and I'll update any tests that still expect the old name before I commit. The bench is still running on the branch.";
assert.equal(intentOf(note).intent, 'report'); assert.equal(isFixAsk(note), false); assert.equal(hasDetails(note), false);
// ...but the same words around a real error, or about an automation tool, stay a fix ask
assert.equal(isFixAsk(note + ' My zap fails with 401 Unauthorized.'), true);
assert.equal(intentOf('I tried the zap again and I checked it and I reran the tests on the branch and I pushed it and the commit did not change the checks, the zap still stopped firing for the whole week and nothing helps at all now').intent, 'unclear');
console.log('automation-fix: all passed');

// a pasted status report with no error is a report, not a broken automation to fix (owner, 2026-10-29: the exact 724-character paste)
{
  const pasted = "Putting a thread on Verse's own asks: promote the 60 checked and tested skills, start with Words and the world, then edge caching for answers and the STL checker\n\nThat thread didn't start. A safety check blocked it because it would merge and deploy to the live site, and your message was only the screenshot.\n\nIf you want it, say so in words: promote the checked and tested skills, add edge caching for answers, build the STL checker, and deploy.\n\nVerse's own job loop merged #1470 by itself. It adds a /prizes/ row for crypto rewards and gambling, marked core. Nobody chose that, so it's worth a look.\n\nAlso, the sprite sheet cleaner is live, and the fix for the will's coder is set to ship after the 8 PM run limit resets.";
  assert.equal(pasted.length, 724);
  assert.equal(intentOf(pasted).intent, 'report');
  assert.equal(isFixAsk(pasted), false);
  assert.equal(hasDetails(pasted), false);
  // a real complaint with the same words around it stays a fix ask
  assert.equal(isFixAsk('My zap stopped firing after the update went live. It is blocked on something and the webhook is pending. I added a filter yesterday and nothing works since then.'), true);
}

// a copied chat (time stamps, "Edited", "You allowed this") is a note, not a broken automation (owner, 2026-10-30: a chat from the rap task)
{
  const chat = "On it. I'll give Verse ears: it listens to a track you drop in and scores its own take, then the job runs again.\nLet Claude upload this file?\nYou allowed this\nToday 3:27 AM\nShould I go the Modal route? You'd make a free Modal account and save its token as a secret. The workflow trigger fails until then.\nEdited\nToday 8:03 AM\nEvery genre now plays live.";
  assert.equal(intentOf(chat).intent, 'note');
  assert.equal(isFixAsk(chat), false);
  assert.equal(hasDetails(chat), false);
  assert.equal(isFixAsk(chat.replace(/\nYou allowed this|\nEdited|\nToday \d:\d\d AM/g, '')), true, 'the same words with no chat lines stay a fix ask');
}
