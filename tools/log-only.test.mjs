// Verse's own activity lives on one page, /log/ (house rule, 2026-11-09): what it built and when, since you last looked, its asks, its week line,
// the ledger skill by skill, the weekly charts and the sites it tried. Nowhere else on the site draws those blocks, and the self card on the stage
// keeps only Verse's words with a quiet link to the log. Run: node --test tools/log-only.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'void-live-deploy';
// the renderers of Verse's activity blocks: only the log (and the libraries that define them) may call them
export const RENDERERS = /\b(?:velocityHtml|builtDetailHtml|builtByFamily|progressHtml|testerHtml|sinceSection|sitesHtml|verseLogHtml|drawVerseLog)\s*\(/;
const DEFINE = new Set(['lib/self-blocks.js', 'lib/built-detail.js', 'lib/progress-chart.js', 'lib/verse-log.js', 'log/index.html', 'log/log.js']);
// activity surfaces still drawn elsewhere, each to be folded into /log/ (docs/TAGTEAM.md, 2026-11-09 log page). Shrink this list; never grow it.
export const PENDING = new Set(['skills/remediation-velocity.js']);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) { if (!/^(?:vendor|node_modules|lab|data|history|incidents)$/.test(n)) walk(p, out); } else if (/\.(?:html|js|mjs)$/.test(n)) out.push(p); }
  return out;
}

test('only /log/ draws Verse\'s activity blocks', () => {
  const bad = [];
  for (const p of walk(ROOT)) {
    const f = relative(ROOT, p).split('\\').join('/');
    if (DEFINE.has(f) || PENDING.has(f)) continue;
    const src = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}(),])\/\/[^\n]*/g, '$1');
    if (RENDERERS.test(src)) bad.push(f + ': ' + RENDERERS.exec(src)[0]);
  }
  assert.deepEqual(bad, []);
});

test('the stage self card keeps only Verse\'s words and links the log', () => {
  for (const f of ['void.html', 'index.html']) {
    const s = readFileSync(join(ROOT, f), 'utf8');
    for (const m of s.matchAll(/SB\.(selfCard|selfSections)\(/g)) {
      const line = s.slice(s.lastIndexOf('\n', m.index), s.indexOf('\n', m.index));
      assert.match(line, /words\(/, f + ': the self card filters to its words: ' + line.trim().slice(0, 120));
    }
    assert.match(s, /<a href=\\?"\/log\/\\?">Log<\/a>/, f + ' links the log');
    assert.doesNotMatch(s, /localStorage\.setItem\(LAST,/, f + ': "since you last looked" is kept by the log page, not the stage');
  }
});

test('the log page draws them, quietly linked from the shell footer', async () => {
  const page = readFileSync(join(ROOT, 'log/index.html'), 'utf8');
  assert.match(page, /<script type="module" src="\/log\/log\.js"><\/script>/);
  assert.match(readFileSync(join(ROOT, 'log/log.js'), 'utf8'), /import \{ drawVerseLog \} from '\/lib\/verse-log\.js'/);
  assert.match(page, /<meta name="verse-handoff"/);
  assert.match(readFileSync(join(ROOT, 'verse-shell.js'), 'utf8'), /log\.href = '\/log\/'/);
  const L = await import('../void-live-deploy/lib/verse-log.js'), esc = (x) => String(x);
  const v = { entries: [{ at: '2026-11-08T10:00:00Z', kind: 'daily', thoughts: 'Words.', asks: [] }], asks: [{ ask: 'Make maps', kind: 'daily', at: '2026-11-07T00:00:00Z' }],
    follow: { total: 3, built: 1, asked: [{ ask: 'one', at: '2026-11-08T00:00:00Z' }], recent: [{ ask: 'one', what: 'built one', at: '2026-11-08T00:00:00Z', depth: 'root' }] } };
  const h = L.verseLogHtml({ v, now: Date.parse('2026-11-09T00:00:00Z') }, esc);
  assert.match(h, /data-sec="since"/); assert.match(h, /data-sec="built"/); assert.match(h, /vs-velocity/); assert.match(h, /data-sec="asked"/);
  assert.doesNotMatch(h, /data-sec="words"/, 'the words stay on the stage card');
  const s = L.sitesHtml({ sites: [{ at: '2026-11-01T00:00:00Z', site: 'a.com', status: 'surpassed', page: '/a/' }, { at: '2026-11-02T00:00:00Z', site: 'b.com', status: 'walled' }] }, esc);
  assert.ok(s.indexOf('b.com') < s.indexOf('a.com'), 'newest first'); assert.match(s, /a\.com · every aspect matched/); assert.equal(L.sitesHtml(null, esc), '');
});
