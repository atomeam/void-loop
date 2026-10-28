// The tower's journeys (owner's standards, 2026-10-28): each floor's required end-to-end journeys (lib/tower-journeys.js) run on Verse's own
// page in a real browser, as a person would, with positive controls (what must show after each step) and negative controls after every step
// (lib/tower-controls.js negativesOf: no stub, placeholder, "coming soon" or error text, not an empty page). The result is one evidence row
// per journey in tower.evidence.json ("journey: <name>"): pass (every step and control held: steps and negatives recorded), worse (a control
// failed: the page is not doing the job) or incomplete (no script yet, the page did not load, a step timed out: never a pass).
//   node tools/tower-journeys.mjs <floor id> [...]   run and write the rows (VERSE_BASE: the site, default https://a-to-mind.com/)
//   node tools/tower-journeys.mjs --dry <floor id>   run and print, write nothing
// Tests: tools/tower-falsepass.test.mjs (the controls and the gate's use of them).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
import { journeysOf } from '../void-live-deploy/lib/tower-journeys.js';
import { negativesOf, JOURNEY_PREFIX } from '../void-live-deploy/lib/tower-controls.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), FILE = path.join(root, 'void-live-deploy', 'tower.evidence.json');
const BASE = process.env.VERSE_BASE || 'https://a-to-mind.com/';

class Blocked extends Error {} // the step could not be taken (did not load, timed out): INCOMPLETE
class Failed extends Error {} // a control failed: the page does not do the job

/** a journey's helpers on one page: every step is recorded, every step runs the negative controls */
function kit(page, steps, negatives) {
  const text = () => page.evaluate(() => (document.body ? document.body.innerText + '\n' + [...document.querySelectorAll('input:not([type=hidden]), textarea, output')].map((e) => e.value || e.textContent || '').join('\n') : '')).catch(() => '');
  const neg = async (label) => { const bad = negativesOf(await text()); if (bad.length) throw new Failed(label + ': ' + bad.join('; ')); negatives.push('after ' + label + ': no stub, placeholder, error or empty page'); };
  const J = {
    page,
    async open(p) { const u = new URL(p, BASE).href; let r; try { r = await page.goto(u, { waitUntil: 'load', timeout: 30000 }); } catch (e) { throw new Blocked('open ' + p + ': ' + String(e.message || e).split('\n')[0]); } if (!r || r.status() >= 400) throw new Failed('open ' + p + ': HTTP ' + (r ? r.status() : 'none')); await page.waitForTimeout(400); steps.push('open ' + p); await neg('open ' + p); },
    async click(sel, label = 'press ' + sel) { try { await page.click(sel, { timeout: 8000 }); } catch (e) { throw new Failed(label + ': the control is not there or not usable'); } await page.waitForTimeout(300); steps.push(label); await neg(label); },
    async fill(sel, v, label = 'type into ' + sel) { try { await page.fill(sel, v, { timeout: 8000 }); } catch (e) { throw new Failed(label + ': the box is not there'); } await page.waitForTimeout(300); steps.push(label); await neg(label); },
    async expect(test, label) { let t = ''; for (let i = 0; i < 20; i++) { t = await text(); if (typeof test === 'function' ? test(t) : test.test(t)) { steps.push('sees ' + label); return t; } await page.waitForTimeout(250); } throw new Failed('expected ' + label + '; the page showed: "' + t.replace(/\s+/g, ' ').trim().slice(0, 160) + '"'); },
    /** the link a share or copy-link control makes (clipboard, else the address bar) */
    async shareLink(sel) { await J.click(sel, 'press the share link control'); const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => ''); const u = /^https?:\/\//.test(clip.trim()) ? clip.trim() : page.url(); steps.push('takes the link ' + u.replace(/^https?:\/\/[^/]+/, '')); return u.replace(/^https?:\/\/[^/]+\/?/, '/'); },
  };
  return J;
}

/** per floor id, per journey name: the script. A journey with no script here is INCOMPLETE. */
export const SCRIPTS = {
  'random number': {
    'pick a number in a range': async (J) => { await J.open('/random/?min=1&max=6'); await J.click('#go', 'press Pick'); await J.expect(/(^|\D)[1-6](\D|$)/, 'a number from 1 to 6'); },
    'change the range and pick again': async (J) => { await J.open('/random/'); await J.fill('#min', '500', 'set the lowest to 500'); await J.fill('#max', '500', 'set the highest to 500'); await J.click('#go', 'press Pick'); await J.expect(/(^|\D)500(\D|$)/, '500 (the only number in 500 to 500)'); },
    'share the result and reopen it from the link': async (J) => { await J.open('/random/?min=7&max=7'); await J.click('#go', 'press Pick'); const u = await J.shareLink('#link'); await J.open(u); await J.expect(/(^|\D)7(\D|$)/, 'the shared range brought back (7 to 7)'); },
  },
  'word count': {
    'type text and see words and characters counted': async (J) => { await J.open('/word-count/'); await J.fill('#text', 'One two three. Four five.', 'type five words'); await J.expect(/\b5\s+words?\b/i, '5 words'); await J.expect(/\b2[0-9]\s+characters?\b/i, 'the character count'); },
    'paste a long text and see reading time': async (J) => { await J.open('/word-count/'); await J.fill('#text', Array.from({ length: 600 }, (_, i) => 'word' + (i % 50)).join(' '), 'paste 600 words'); await J.expect(/\b600\s+words?\b/i, '600 words'); await J.expect(/read(ing)?\b[^\n]{0,40}\b(min|sec|minute|second)/i, 'a reading time'); },
    'share the result and reopen it from the link': async (J) => { await J.open('/word-count/'); await J.fill('#text', 'alpha beta gamma', 'type three words'); const u = await J.shareLink('#link'); await J.open(u); await J.expect(/\b3\s+words?\b/i, 'the shared text counted again (3 words)'); },
  },
  stopwatch: {
    'start, lap and stop the stopwatch': async (J) => { await J.open('/stopwatch/'); await J.click('#swgo', 'press Start'); await J.page.waitForTimeout(1200); await J.click('#swlap', 'press Lap'); await J.click('#swgo', 'press Stop'); await J.expect(/lap\s*1/i, 'lap 1 listed'); },
    'reset and start again': async (J) => { await J.open('/stopwatch/'); await J.click('#swgo', 'press Start'); await J.page.waitForTimeout(600); await J.click('#swlap', 'press Lap'); await J.click('#swgo', 'press Stop'); await J.click('#swreset', 'press Reset'); await J.expect((t) => !/lap\s*1\b/i.test(t), 'the laps cleared'); await J.click('#swgo', 'press Start again'); await J.click('#swlap', 'press Lap again'); await J.expect(/lap\s*1\b/i, 'a new lap 1 from the fresh run'); },
  },
  // paint (/paint/, rebuilt 2026-10-28 against the colour-by-number sites): every step is a tap, a key or a file a person would use
  paint: {
    'choose a picture from the library': async (J) => { await J.open('/paint/'); await J.click('#cats button >> text="Animals"', 'choose the Animals category'); await J.expect((t) => /Sleepy cat/.test(t) && !/The Starry Night/.test(t.slice(0, t.indexOf('Upload your own image'))), 'only the animal pictures listed'); await J.click('#templates .card[data-id="cat"]', 'tap the Sleepy cat picture'); await J.expect(/Sleepy cat[\s\S]*0 of [\d,]+ pixels painted · 0 of \d+ areas/, 'the cat open with nothing painted yet'); },
    'zoom in and fill a numbered area': async (J) => { await J.open('/paint/'); await J.click('#zin', 'press zoom in'); await J.expect((t) => /\b(1[6-9]\d|[2-9]\d\d)%/.test(t), 'the picture zoomed past 100%'); await J.click('#hint', 'press Hint'); await J.page.focus('#stage'); await J.page.keyboard.press('Enter'); await J.page.waitForTimeout(300); await J.expect(/[1-9][\d,]* of [\d,]+ pixels painted · 1 of \d+ areas/, 'one area filled and counted'); },
    'use a hint for the selected colour': async (J) => { await J.open('/paint/'); await J.click('#palette button:nth-child(3)', 'choose colour 3'); await J.click('#hint', 'press Hint'); await J.expect(/Hint: One area of colour 3 is ringed and zoomed to/, 'an area of colour 3 ringed and zoomed to'); },
    'leave and come back to the saved picture': async (J) => { await J.open('/paint/'); await J.click('#hint', 'press Hint'); await J.page.focus('#stage'); await J.page.keyboard.press('Enter'); const before = (await J.expect(/[1-9][\d,]* of [\d,]+ pixels painted · 1 of \d+ areas/, 'one area filled')).match(/[\d,]+ of [\d,]+ pixels painted · 1 of \d+ areas/)[0]; await J.open('/word-count/'); await J.open('/paint/'); await J.expect((t) => t.includes(before), 'the same picture back with the area still filled (' + before + ')'); },
    'finish and watch the reveal': async (J) => {
      await J.open('/paint/'); await J.click('#templates .card[data-id="sunset"]', 'open Sunset over the hills'); await J.page.focus('#stage');
      for (let i = 0; i < 400; i++) { if (await J.page.evaluate(() => !document.getElementById('reveal').hidden)) break; await J.page.keyboard.press('h'); await J.page.waitForTimeout(40); await J.page.focus('#stage'); await J.page.keyboard.press('Enter'); await J.page.waitForTimeout(20); }
      await J.expect(/Sunset over the hills is finished[\s\S]*areas in \d+ colours/, 'the reveal: the finished picture, its areas and colours'); await J.click('#rreplay', 'press Replay'); await J.expect(/is finished/, 'the reveal still showing after the replay');
    },
    'colour your own photo': async (J) => { await J.open('/paint/'); try { await J.page.setInputFiles('#up', path.join(root, 'void-live-deploy', 'podcast', 'cover-256.jpg')); } catch (e) { throw new Failed('choose a photo: the upload control is not there'); } await J.page.waitForTimeout(300); await J.expect(/Your photo is now a colouring sheet: \d+ areas in \d+ colours[\s\S]*0 of [\d,]+ pixels painted · 0 of \d+ areas/, 'the photo cut into numbered areas, none painted'); await J.click('#hint', 'press Hint'); await J.page.focus('#stage'); await J.page.keyboard.press('Enter'); await J.expect(/[1-9][\d,]* of [\d,]+ pixels painted · 1 of \d+ areas/, 'an area of the photo filled'); },
  },
};

/** run one floor's journeys in a browser; rows by aspect. */
export async function runFloor(browser, f, at = new Date().toISOString()) {
  const rows = {};
  for (const name of journeysOf(f)) {
    const script = SCRIPTS[f.id] && SCRIPTS[f.id][name], aspect = JOURNEY_PREFIX + name;
    if (!script) { rows[aspect] = { verdict: 'incomplete', incomplete: true, evidence: 'no script for this journey yet (tools/tower-journeys.mjs): INCOMPLETE, never a pass', at }; continue; }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] }), page = await ctx.newPage(), steps = [], negatives = [];
    try { await script(kit(page, steps, negatives)); rows[aspect] = { verdict: 'pass', steps, negatives, evidence: 'Verse (' + (f.page || '/') + '): ' + steps.length + ' steps, every negative control held', at }; }
    catch (e) { const blocked = !(e instanceof Failed); rows[aspect] = { verdict: blocked ? 'incomplete' : 'worse', ...(blocked ? { incomplete: true } : {}), steps, negatives, evidence: (blocked ? 'INCOMPLETE, not a pass: ' : 'failed: ') + String(e.message || e).split('\n')[0].slice(0, 300), at }; }
    finally { await ctx.close(); }
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), dry = argv.includes('--dry'), ids = argv.filter((a) => !a.startsWith('--'));
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const id of ids) {
    const f = FLOORS.find((x) => x.id === id); if (!f) { console.error('no floor ' + id); continue; }
    const rows = await runFloor(b, f);
    for (const [k, r] of Object.entries(rows)) console.log(id + ' · ' + k.padEnd(52) + r.verdict.padEnd(11) + r.evidence);
    if (!dry) data.floors[id] = { ...(data.floors[id] || {}), ...rows };
  }
  await b.close();
  if (!dry) fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
}
