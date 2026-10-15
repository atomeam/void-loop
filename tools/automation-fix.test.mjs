// lib/automation-fix.js ruleFix: the free diagnosis behind every "Ask Void about this error" on the /fix/ pages.
import assert from 'node:assert/strict';
import { ruleFix, platformOf } from '../void-live-deploy/lib/automation-fix.js';

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
console.log('automation-fix: all passed');
