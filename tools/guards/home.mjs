// Homepage guard: the starfield is the home page's default look and the corner heart stays. Both are checked in the page's three copies and on the live
// page in a real browser. If a change on main hid one, that change is reverted on its own helper branch (never the other way round: nothing here removes
// either, and a revert that would not bring them back is not pushed). If the source is right and the live page still hides one, the coder gets a heal job.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const PAGES = ['void.html', 'void-live-deploy/void.html', 'void-live-deploy/index.html'];
/** what is missing from one copy of the page: the starfield as the default look and the corner heart. Pure. */
export function missingIn(html) {
  const src = String(html || ''), out = [];
  if (!/LOOK_DEFAULT\s*=\s*\{[^}]*\bfx:\s*'field'/.test(src)) out.push('the starfield is not the default look');
  if (!/html\[data-fx="field"\][^{]*#void-cosmos[^{]*\{\s*display:\s*block/.test(src)) out.push('the starfield layer is never shown');
  if (!/import\('\/lib\/void-cosmos\.js'\)/.test(src)) out.push('the starfield engine is not loaded');
  const heart = src.match(/<a\b[^>]*\bid="void-anchor"[^>]*>/);
  if (!heart) out.push('the corner heart is gone');
  else if (/\bhidden\b|display\s*:\s*none/.test(heart[0])) out.push('the corner heart is hidden');
  if (/#void-anchor\s*\{[^}]*display\s*:\s*none/.test(src)) out.push('the corner heart is hidden by a style');
  return out;
}
/** the newest commit on main that took one of those away: the page was whole at its parent and is not at it. null when none is found. */
export function culprit(shas, pageAt) {
  for (let i = 0; i < shas.length - 1; i++) {
    const now = pageAt(shas[i]), before = pageAt(shas[i + 1]);
    if (now != null && before != null && missingIn(now).length && !missingIn(before).length) return shas[i];
  }
  return null;
}
const git = (root, a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 64 << 20 });

/** the live page in a real browser: is the heart on screen and is the starfield layer showing. */
export async function liveLook(ctx) {
  const pw = await ctx.loadPlaywright(), exe = ctx.chrome;
  if (!pw || !exe) return { skipped: 'no browser on this runner' };
  const b = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await p.goto(ctx.site + '/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await p.mouse.move(400, 400); await p.waitForTimeout(14000);
    return await p.evaluate(() => {
      const shown = (el) => { if (!el) return false; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0; };
      const layer = document.getElementById('void-cosmos') || document.getElementById('void-particles');
      return { fx: document.documentElement.dataset.fx || '', heart: shown(document.getElementById('void-anchor')), field: shown(layer) };
    });
  } finally { await b.close(); }
}

export async function run(ctx) {
  const { root } = ctx;
  const bad = PAGES.map((f) => [f, missingIn(ctx.read(join(root, f)))]).filter(([, m]) => m.length);
  let last, healed = '';
  if (bad.length) {
    const shas = String(git(root, ['log', '--first-parent', '-n', '80', '--format=%H', 'origin/main', '--', ...PAGES]).stdout || '').split('\n').filter(Boolean);
    const sha = culprit(shas, (c) => { const r = git(root, ['show', c + ':' + bad[0][0]]); return r.status === 0 ? r.stdout : null; });
    const what = [...new Set(bad.flatMap(([, m]) => m))].join('; ');
    if (!sha) { const q = await ctx.queueJob('The home page has lost something it keeps: ' + what + '. Put it back.', 'heal:home-page'); healed = 'No single commit took it away in the last 80, so the coder has a heal job (' + (q.queued ? 'queued' : q.why) + ').'; }
    else {
      const subject = String(git(root, ['log', '-1', '--format=%s', sha]).stdout || '').trim().slice(0, 80);
      const r = ctx.dry ? { pushed: false, why: 'dry run' } : ctx.revertOnBranch(sha, 'helper/home-back-' + sha.slice(0, 8), what, (wt) => PAGES.every((f) => !missingIn(ctx.read(join(wt, f))).length));
      healed = (r.pushed ? 'Put back ' + sha.slice(0, 8) + ' ("' + subject + '") on ' + r.branch + '; its pull request carries the automerge label.' : 'Found the change, ' + sha.slice(0, 8) + ' ("' + subject + '"), but did not push the revert: ' + r.why + '.');
    }
    last = 'The home page source has lost something it keeps: ' + what + '. ' + healed;
    return { last, ok: true, note: 'No model call. Plain file reads and one git revert.' };
  }
  const live = await liveLook({ ...ctx, chrome: ctx.chrome || (await import('../verse-guards.mjs')).CHROME() }).catch((e) => ({ skipped: 'the browser failed: ' + String(e.message).slice(0, 60) }));
  if (live.skipped) return { last: 'The starfield and the heart are in all three copies of the page. Live look skipped: ' + live.skipped + '.', ok: true, note: 'No model call.' };
  const live1 = [!live.heart && 'the heart is not on screen', live.fx !== 'field' && 'the look is "' + (live.fx || 'none') + '", not the starfield', !live.field && 'the starfield layer is not showing'].filter(Boolean);
  if (live1.length) { const q = await ctx.queueJob('The live home page hides what it keeps: ' + live1.join('; ') + '. The source has both. Find what hides them and fix it.', 'heal:home-live'); return { last: 'The source is right but the live page is not: ' + live1.join('; ') + '. Heal job for the coder (' + (q.queued ? 'queued' : q.why) + ').', ok: true, note: 'No model call. One browser look.' }; }
  return { last: 'The starfield and the heart are in all three copies of the page, and both show on the live home page in a real browser.', ok: true, note: 'No model call. One browser look.' };
}
