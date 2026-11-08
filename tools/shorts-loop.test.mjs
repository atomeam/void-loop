// tools/shorts-loop.mjs: one knob at a time, the best kept on real outcomes, quality claimed only when the gate score rose
import assert from 'node:assert/strict';
import { nextTrial, judge, outcomeScore, MIN_VIEWS } from './shorts-loop.mjs';
import { play, SCENES, BASE } from './shorts.mjs';

const t1 = nextTrial({ best: null, trials: [] }, '20261104');
assert.equal(t1.knob, 'hook'); assert.equal(t1.challenger.hook, 1); assert.equal(t1.champion.hook, 0);
assert.notEqual(t1.champion.film, t1.challenger.film);
const t2 = nextTrial({ best: null, trials: [t1] }, '20261105');
assert.equal(t2.knob, 'pace'); assert.equal(t2.challenger.pace, 24);
assert.equal(play(SCENES[0], { ...BASE, hook: 1 }).hook, SCENES[0].hooks[0]);
assert.ok(outcomeScore({ views: 100, clicks: 5 }) > outcomeScore({ views: 100, clicks: 2 }));
const o = (v, c) => ({ views: v, clicks: c });
assert.equal(judge(t1, { [t1.champion.film]: o(MIN_VIEWS - 1, 0), [t1.challenger.film]: o(50, 5) }, {}), null, 'waits for enough views');
const win = judge(t1, { [t1.champion.film]: o(50, 1), [t1.challenger.film]: o(50, 4) }, { [t1.champion.film]: { score: 83 }, [t1.challenger.film]: { score: 100 } });
assert.equal(win.verdict, 'challenger'); assert.equal(win.qualityImproved, true);
const same = judge(t1, { [t1.champion.film]: o(50, 1), [t1.challenger.film]: o(50, 4) }, { [t1.champion.film]: { score: 100 }, [t1.challenger.film]: { score: 100 } });
assert.equal(same.qualityImproved, false, 'better outcomes alone are not better quality');
assert.equal(judge(t1, { [t1.champion.film]: o(50, 4), [t1.challenger.film]: o(50, 1) }, {}).verdict, 'champion');
// the daily job calls render(scene, 'media/shorts'): the take folder must be absolute, or ffmpeg's concat list doubles the path
import { readFileSync } from 'node:fs';
assert.match(readFileSync(new URL('./shorts.mjs', import.meta.url), 'utf8'), /mkdtempSync\(path\.join\(path\.resolve\(out\), '\.take-'\)\)/, 'the take folder is absolute (2026-11-06: no film was made)');
// the loop log reaches main (2026-11-06: a helper/* branch pushed with the Actions token opened no pull request, so the log on main
// stayed empty and every day planned the same first trial), and the deploy is started so /films/ reads it
const wf = readFileSync(new URL('../.github/workflows/shorts.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const keep = wf.slice(wf.indexOf('- name: Keep the loop log'));
assert.doesNotMatch(keep, /helper\/shorts-loop/, 'the log is not left on a helper branch');
assert.match(keep, /git push -q origin HEAD:main[\s\S]{0,200}gh workflow run deploy\.yml --repo "\$\{\{ github\.repository \}\}" --ref main -f after_merge=true/, 'pushed to main, then the deploy starts');
assert.match(keep, /git pull -q --rebase --autostash origin main/, 'a push that lost the race rebases and tries again');
assert.match(wf, /permissions:\n  contents: write.*\n  actions: write/, 'the job may start the deploy');
console.log('shorts-loop: ok');
