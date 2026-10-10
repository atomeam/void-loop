// tools/mirror.mjs: the allowlist, the fail-closed secret filter, and the real clone/commit/push flow against a local bare repo standing in for the second host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { plan, allowed, main } from './mirror.mjs';

const sh = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('mirror: only the allowlist goes; env files, keys, tools and the page itself never do', () => {
  for (const ok of ['STANDING.md', 'AGENTS.md', 'docs/MAP.md', 'domains/void.growth.md', 'void-live-deploy/skills/sky.js', 'void-live-deploy/void.growth.json']) assert.equal(allowed(ok), true, ok);
  for (const no of ['void.html', 'tools/mirror.mjs', 'void-live-deploy/functions/api/answer.js', 'docs/.env', 'docs/.env.local', 'domains/deploy.pem', 'void-live-deploy/skills/id_rsa', 'void-live-deploy/lib/guard.js', 'STANDING.md.bak']) assert.equal(allowed(no), false, no);
});

test('mirror: a file that looks like it holds a secret, a binary and a big file are left out with the reason, and the rest goes', () => {
  const files = { 'docs/a.md': 'plain notes', 'docs/key.md': 'the key is sk_live_abcdef1234567890abcd', 'docs/b.png': Buffer.from([1, 2, 0, 3]), 'docs/big.md': 'x'.repeat(1024 * 1024 + 1), 'docs/tok.md': 'Authorization: Bearer abcdefghijklmnop12345', 'tools/x.mjs': 'ignored' };
  const { include, skipped } = plan(Object.keys(files), (p) => Buffer.from(files[p]));
  assert.deepEqual(include, ['docs/a.md']);
  assert.deepEqual(skipped.map((s) => s.path + ':' + s.why).sort(), ['docs/b.png:binary', 'docs/big.md:larger than 1 MB', 'docs/key.md:looks like it holds a secret or key', 'docs/tok.md:looks like it holds a secret or key']);
});

test('mirror: not configured and a bad URL do nothing; the real flow copies, says "nothing changed", and never overwrites a remote that moved', async () => {
  const quiet = console.log; console.log = () => {};
  try {
    assert.deepEqual(await main([], {}, process.cwd()), { skipped: 'not configured' });
    assert.deepEqual(await main([], { MIRROR_URL: 'http://x/y.git' }, process.cwd()), { skipped: 'bad url' });
    assert.deepEqual(await main([], { MIRROR_URL: 'https://user:pw@x/y.git' }, process.cwd()), { skipped: 'bad url' });

    const base = mkdtempSync(join(tmpdir(), 'mirror-test-')), src = join(base, 'src'), bare = join(base, 'remote.git');
    mkdirSync(join(src, 'docs'), { recursive: true }); mkdirSync(join(src, 'tools'), { recursive: true });
    sh(['init', '-q', '-b', 'main', src]); sh(['init', '-q', '--bare', '-b', 'main', bare]);
    sh(['config', 'user.email', 't@t'], src); sh(['config', 'user.name', 't'], src);
    writeFileSync(join(src, 'docs', 'a.md'), 'first'); writeFileSync(join(src, 'tools', 'code.mjs'), 'not mirrored'); writeFileSync(join(src, 'docs', 'bad.md'), 'ghp_abcdefghijklmnopqrstuvwxyz123456');
    sh(['add', '-A'], src); sh(['commit', '-q', '-m', 'one'], src);
    // an https URL that really resolves to the local bare repo, so the clone, commit and push all run for real
    process.env.GIT_CONFIG_COUNT = '1'; process.env.GIT_CONFIG_KEY_0 = 'url.' + bare + '.insteadOf'; process.env.GIT_CONFIG_VALUE_0 = 'https://mirror.test/knowledge.git';
    const env = { MIRROR_URL: 'https://mirror.test/knowledge.git' };

    const r1 = await main([], env, src); assert.equal(r1.pushed, true);
    const check = mkdtempSync(join(tmpdir(), 'mirror-check-')); sh(['clone', '-q', bare, check], tmpdir());
    assert.equal(readFileSync(join(check, 'docs', 'a.md'), 'utf8'), 'first');
    assert.equal(existsSync(join(check, 'tools')), false, 'tools are not mirrored'); assert.equal(existsSync(join(check, 'docs', 'bad.md')), false, 'the secret-shaped file is not mirrored');
    const manifest = JSON.parse(readFileSync(join(check, 'MIRROR.json'), 'utf8'));
    assert.equal(manifest.files, 1); assert.equal(manifest.leftOut[0].path, 'docs/bad.md');

    assert.equal((await main([], env, src)).pushed, false, 'nothing changed: no new commit');

    writeFileSync(join(src, 'docs', 'a.md'), 'second'); sh(['commit', '-qam', 'two'], src);
    sh(['config', 'user.email', 't@t'], check); sh(['config', 'user.name', 't'], check);
    sh(['commit', '--allow-empty', '-qm', 'someone else wrote here'], check); sh(['push', '-q', 'origin', 'HEAD:main'], check);
    const r2 = await main([], env, src); assert.equal(r2.pushed, true, 'a remote that only moved ahead is built on, not overwritten');
    const log = sh(['log', '--format=%s', 'main'], bare); assert.match(log, /someone else wrote here/); assert.match(log, /Mirror of non-secret knowledge/);
  } finally { console.log = quiet; delete process.env.GIT_CONFIG_COUNT; delete process.env.GIT_CONFIG_KEY_0; delete process.env.GIT_CONFIG_VALUE_0; }
});
