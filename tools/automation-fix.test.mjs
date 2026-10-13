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
console.log('automation-fix: all passed');
