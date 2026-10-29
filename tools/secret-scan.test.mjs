// tools/secret-scan.mjs: every added line, in every file type, checked for the shapes of real keys; made-up keys and names pass.
// Run: node --test tools/secret-scan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secretsIn, scanDiff, madeUp } from './secret-scan.mjs';

// realistic-looking keys, built at run time so this file itself holds none (random letters, no made-up runs)
const R = 'Q7vK2mXp9LwR4tYz8NcB3hJf6GdS1aEu';
const real = {
  'GitHub token': 'gh' + 'p_' + R + 'Ab12',
  'Google API key': 'AI' + 'za' + R + 'kLm',
  'AWS access key': 'AK' + 'IA' + 'Q7VK2MXP9LWR4TYZ',
  'secret key (sk_/rk_)': 'sk' + '_live_' + R,
  'API key (sk-)': 'sk' + '-ant-' + R + R,
  'Slack token': 'xo' + 'xb-' + '2841-' + R,
  'password in a URL': 'postgres://' + 'admin:Q7vK2mXp9L' + '@db.internal-acme.io/app',
};

test('secret scan: the shapes of real keys are found, wherever they sit', () => {
  for (const [kind, key] of Object.entries(real)) {
    assert.deepEqual(secretsIn('my key is ' + key), [kind], kind);
    assert.deepEqual(secretsIn('| 2026-10-15 | builder | pasted ' + key + ' by mistake |'), [kind], kind + ' in a log line');
  }
  const pem = '-----BEGIN RSA ' + 'PRIVATE KEY-----';
  assert.deepEqual(secretsIn(pem), ['private key'], 'a key file starts with the marker alone');
  assert.deepEqual(secretsIn('"' + pem + '\\n' + R.repeat(3) + '"'), ['private key'], 'a body of real length after it');
});

test('secret scan: names, references and made-up keys are not secrets', () => {
  for (const ok of ['READ_TOKEN=${{ secrets.VOID_OWNER_TOKEN }}', 'const key = process.env.CLOUDFLARE_API_TOKEN;', 'the Pages READ_TOKEN',
    'gh' + 'p_abcdefghijklmnopqrstuvwxyz0123456789', 'AK' + 'IAIOSFODNN7EXAMPLE', 'sk' + '_live_1234567890abcdef1234',
    '"-----BEGIN ' + 'PRIVATE KEY-----\\nMIIEv\\n-----END PRIVATE KEY-----"', 'https://user:${PASSWORD}@host.example.org',
    'my key is ' + real['GitHub token'] + ' // secret-scan: ok', 'https://a-to-mind.com/films/?v=1', 'sk-learn is a library'])
    assert.deepEqual(secretsIn(ok), [], ok);
  assert.ok(madeUp('abcdefgh') && madeUp('AKIAIOSFODNN7EXAMPLE') && !madeUp(R));
});

test('secret scan: a diff gives the file and line of each added key, never the value, and skips removed lines', () => {
  const diff = ['diff --git a/domains/notes.md b/domains/notes.md', '--- a/domains/notes.md', '+++ b/domains/notes.md',
    '@@ -3,0 +4,2 @@', '+a plain line', '+token: ' + real['GitHub token'],
    'diff --git a/tools/x.mjs b/tools/x.mjs', '--- a/tools/x.mjs', '+++ b/tools/x.mjs', '@@ -10,1 +10,1 @@',
    '-const k = "' + real['API key (sk-)'] + '";', '+const k = process.env.KEY;'].join('\n');
  const hits = scanDiff(diff);
  assert.deepEqual(hits, [{ file: 'domains/notes.md', line: 5, kinds: ['GitHub token'] }]);
  assert.ok(!JSON.stringify(hits).includes(R), 'the value is never in the report');
});
