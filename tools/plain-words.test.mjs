// A pull request titled with a banned phrase is rewritten, or it stays red (tools/plain-words.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPhrases, assess, addedLines, rewriteText, insideString, PHRASES_FILE } from './plain-words.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const phrases = loadPhrases(readFileSync(PHRASES_FILE, 'utf8'));
const offer = "  el.innerHTML = '<p>We own the heavy lifting</p>';";
const files = [{ path: 'void-live-deploy/skills/offer.js', added: [{ n: 4, text: offer }] }];

test('a title that says heavy lifting is rewritten in plain words', () => {
  assert.deepEqual(phrases.map((p) => p.phrase), ['heavy lifting', 'Verse will own', 'we own']);
  const plan = assess({ title: 'We own the heavy lifting', body: 'Verse will own the rollout', phrases, branch: 'helper/offer' });
  assert.equal(plan.title.to, 'Verse does the hard work');
  assert.equal(plan.body.to, 'Verse handles the rollout');
  assert.equal(plan.findings.length, 0);
  const dry = JSON.parse(execFileSync(process.execPath, [join(here, 'plain-words.mjs'), '--dry', '--title', 'We own the heavy lifting'], { encoding: 'utf8' }));
  assert.equal(dry.title, 'Verse does the hard work');
  assert.equal(dry.findings, 0);
});

test('page copy on a helper branch is rewritten, and any other branch or a code line is blocked', () => {
  const helper = assess({ title: 'A client card', files, branch: 'helper/offer', phrases });
  assert.equal(helper.push, true);
  assert.match(helper.patches[0].to, /Verse does the hard work/);
  for (const branch of ['cursor/offer', 'helper/../main']) {
    const blocked = assess({ title: 'A client card', files, branch, phrases });
    assert.equal(blocked.push, false);
    assert.ok(blocked.findings.some((f) => f.kind === 'risk' && f.rule === 'plain-words'));
  }
  const code = assess({ title: 'ok', files: [{ path: 'void-live-deploy/skills/offer.js', added: [{ n: 2, text: 'const label = heavy lifting;' }] }], branch: 'helper/offer', phrases });
  assert.equal(code.push, false);
  assert.equal(insideString(offer, offer.indexOf('We own'), offer.indexOf('We own') + 6), true);
  assert.equal(rewriteText('we do the heavy lifting', [{ phrase: 'heavy lifting', replacement: 'the shipped work' }]).changed, false);
});

test('an added inbox row is rewritten and a row already on main is not', () => {
  const diff = ['+++ b/domains/growth-inbox.md', '@@ -9,1 +9,2 @@', ' | shipped old | 2026-10-02 | we own the heavy lifting | already on main |', '+| open | 2026-11-12 | we own the heavy lifting | new row |'].join('\n');
  const added = addedLines(diff);
  assert.equal(added.length, 1);
  const plan = assess({ title: 'Inbox', files: [{ path: 'domains/growth-inbox.md', added: added.map((r) => ({ n: r.line, text: r.text })) }], branch: 'helper/inbox', phrases });
  assert.match(plan.patches[0].to, /verse does the hard work/);
  assert.equal(plan.findings.length, 0);
});

test('pull requests 2667 and 2668 are left alone, and the review runs this check', () => {
  for (const pr of [2667, 2668]) assert.equal(assess({ pr, title: 'We own the heavy lifting', phrases }).skip, true);
  const y = readFileSync(new URL('../.github/workflows/void-review.yml', import.meta.url), 'utf8');
  assert.match(y, /edited/);
  assert.match(y, /node tools\/plain-words\.mjs --apply/);
  assert.match(y, /PLAIN: \$\{\{ steps\.plain\.outcome \}\}/);
  assert.match(y, /for o in [^\n]*"\$PLAIN"/);
});
