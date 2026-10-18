// tools/review-offer.mjs: what A-to-Mind offers at the end of a review on someone else's repository
import assert from 'node:assert/strict';
import { offerLines } from './review-offer.mjs';
// never on Verse's own repository, or when the repository is unknown
assert.deepEqual(offerLines({ repo: 'atomeam/void-loop', files: ['.github/workflows/a.yml'], blocking: 2 }), []);
assert.deepEqual(offerLines({ files: ['.github/workflows/a.yml'], blocking: 2 }), []);
// one workflow changed: the One-Time Fix; findings on the free tier: Code Review Pro
const one = offerLines({ repo: 'someone/app', files: ['.github/workflows/ci.yml', 'src/a.js'], blocking: 1 });
assert.equal(one.length, 2);
assert.match(one[0], /One-Time Fix\]\(https:\/\/moonbeam846\.gumroad\.com\/l\/eozcma\)/);
assert.match(one[1], /Verse Code Review Pro\]\(https:\/\/a-to-mind\.com\/code-review\/\)/);
// three or more automations: the Full Stack Audit
assert.match(offerLines({ repo: 'x/y', files: ['.github/workflows/a.yml', '.github/workflows/b.yml', 'n8n-flow.json'] })[0], /Full Stack Audit/);
// a clean PR with no automations and nothing to upgrade: nothing; with the closer read already on: no Pro line
assert.deepEqual(offerLines({ repo: 'x/y', files: ['src/a.js'] }), []);
assert.deepEqual(offerLines({ repo: 'x/y', files: ['src/a.js'], blocking: 3, deep: true }), []);
// no prices in the text (the live store sets them)
assert.ok(!one.join(' ').match(/\$\d/));
console.log('review-offer: all passed');
