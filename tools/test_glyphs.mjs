// Checks the cross-sense board draft (drafts/fringe/sensory-substitution.html) in a real browser:
// the arithmetic agreement is strict (exact digits, right or wrong), and the tone is opt-in (no audio context until
// the box is ticked; then bar = 440 Hz sine, gap = silence, stack = 220 Hz square, 200 ms each).
//   node tools/test_glyphs.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(resolve(root, 'drafts/fringe/sensory-substitution.html')).href;
let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) pass++; else fail++; console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + got)); };

const exe = [process.env.VOID_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
// count audio contexts and oscillators the page makes
await page.addInitScript(() => {
  window.__audio = { ctx: 0, osc: [] };
  window.AudioContext = class { constructor() { window.__audio.ctx++; this.currentTime = 0; this.destination = {}; }
    createOscillator() { const o = { type: '', frequency: { value: 0 }, connect() {}, start(t) { o.at = t; }, stop(t) { o.end = t; } }; window.__audio.osc.push(o); return o; }
    createGain() { return { gain: { value: 0 }, connect() {} }; } };
});
await page.goto(url);
const G = (fn, ...a) => page.evaluate(([f, a]) => window.__glyphs[f](...a), [fn, a]);

check('sum: [stack, gap, bar, bar] is 12', (await G('sum', ['stack', 'gap', 'bar', 'bar'])) === 12, await G('sum', ['stack', 'gap', 'bar', 'bar']));
const seq = ['stack', 'gap', 'bar', 'bar'];
const yes = await Promise.all(['12', ' 12 ', '12\n'].map((x) => G('agree', seq, x)));
const no = await Promise.all(['11', '13', '12.0', '012', '+12', '-12', 'twelve', '1 2', '', '12a', '0x0c', '1e1'].map((x) => G('agree', seq, x)));
check('agreement is strict: only the exact digits agree (spaces around are ignored)', yes.every(Boolean), JSON.stringify(yes));
check('agreement is strict: near answers, decimals, leading zeros, signs, words and blanks never agree', no.every((x) => x === false), JSON.stringify(no));
check('agreement: a row of gaps sums to 0 and "0" agrees', (await G('agree', ['gap', 'gap', 'gap'], '0')) === true, '');
const unknown = await page.evaluate(() => { try { window.__glyphs.sum(['bar', 'dot']); return 'no error'; } catch (e) { return e.message; } });
check('an unknown glyph is an error, not a silent 0', /unknown glyph dot/.test(unknown), unknown);
const rows = await page.evaluate(() => { let s = 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; return Array.from({ length: 200 }, () => window.__glyphs.row(r)); });
check('rows are 3 to 5 glyphs, only bar / gap / stack', rows.every((r) => r.length >= 3 && r.length <= 5 && r.every((g) => ['bar', 'gap', 'stack'].includes(g))), JSON.stringify(rows.slice(0, 3)));

const steps = await G('toneSteps', ['bar', 'gap', 'stack']);
check('tone pattern: bar = 440 Hz sine, gap = silence, stack = 220 Hz square, 200 ms each, back to back',
  JSON.stringify(steps) === JSON.stringify([{ at: 0, dur: 0.2, type: 'sine', hz: 440 }, { at: 0.2, dur: 0.2, type: 'silence', hz: 0 }, { at: 0.4, dur: 0.2, type: 'square', hz: 220 }]), JSON.stringify(steps));

await page.evaluate(() => window.__glyphs.set(['bar', 'gap', 'stack']));
const off = await page.evaluate(() => { const played = window.__glyphs.sound(); return [played, window.__audio.ctx, document.getElementById('play').disabled]; });
check('tone is opt-in: off by default, "play" disabled, no audio context made', off[0] === 0 && off[1] === 0 && off[2] === true, JSON.stringify(off));
await page.check('#tone'); await page.click('#play');
const on = await page.evaluate(() => [window.__audio.ctx, window.__audio.osc.map((o) => o.type + ':' + o.frequency.value + ':' + (o.end - o.at).toFixed(2))]);
check('tone on: one audio context, two oscillators (the gap is silent): sine 440 and square 220, 0.2 s each',
  on[0] === 1 && JSON.stringify(on[1]) === JSON.stringify(['sine:440:0.20', 'square:220:0.20']), JSON.stringify(on));

await page.fill('#sum', '11'); await page.click('#check'); const say1 = await page.textContent('#out');
await page.fill('#sum', '11 '); await page.click('#check'); const say2 = await page.textContent('#out');
check('the page says "agrees" or "does not agree", nothing in between', say1 === 'agrees: 11' && say2 === 'agrees: 11', say1 + ' | ' + say2);
const reqs = []; page.on('request', (r) => { if (!r.url().startsWith('file:')) reqs.push(r.url()); });
await page.click('#next'); await page.waitForTimeout(100);
check('nothing leaves the device (no network request), no script errors', !reqs.length && !errors.length, reqs.join(',') + ' ' + errors.join(','));

await browser.close();
console.log(pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
