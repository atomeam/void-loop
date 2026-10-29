// node tools/subject-eval.mjs [--only words] [--shots dir]: the subject evaluation (owner, 2026-10-26: "it should do that with all things like that").
// Each fixture in tools/fixtures/subject-eval.json is one ask with the Wikipedia replies it would meet (the sandbox has no network) and the model's canned words.
// The REAL /api/answer route runs against them (tools/subject-stub.mjs), then the REAL page draws the card (headless Chrome, outside services blocked,
// /api/answer answered with what the route returned), a screenshot is saved, and each card is scored: is the card about what was asked (finish.mjs offTopic,
// the same check as --try), does the title, kind, sources, "Adds to Verse" line and picture match what the fixture expects.
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { answerFor } from './subject-stub.mjs'; import { offTopic } from './finish.mjs';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '..', 'void-live-deploy');
const args = process.argv.slice(2), live = args.includes('--live'), outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : '', only = args.includes('--only') ? args[args.indexOf('--only') + 1].toLowerCase() : '', shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : path.join(os.tmpdir(), 'subject-eval');
const fixtures = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'subject-eval.json'), 'utf8')).filter((f) => (live || !f.liveOnly)).filter((f) => !only || only.split('|').some((o) => f.ask.toLowerCase().includes(o)));
fs.mkdirSync(shots, { recursive: true });
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
await new Promise((r) => server.once('listening', r));
const exe = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, headless: true });
const flat = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const results = [];
for (const fx of fixtures) {
  const { json } = await answerFor(fx, { live });
  let redirect = ''; if (live) { try { const t = fx.ask.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('_'), r = await fetch('https://en.wikipedia.org/w/api.php?format=json&action=query&redirects=1&titles=' + encodeURIComponent(t), { headers: { 'user-agent': 'Verse/1.0 (https://a-to-mind.com; atom@a-to-mind.com)' } }).then((x) => x.json()), d = ((r.query || {}).redirects || []).slice(-1)[0]; redirect = d ? d.to + (d.tofragment ? '#' + d.tofragment : '') : 'none'; } catch (e) { redirect = 'error'; } } // what Wikipedia itself says this name is
  const page = await browser.newPage({ viewport: { width: 520, height: 1100 } }), errs = [], seen = { called: 0, failed: [], bad: [] }; page.on('pageerror', (e) => errs.push(e.message)); page.on('requestfailed', (r) => seen.failed.push(r.url().replace(/^https:\/\//, '').slice(0, 90) + ' ' + ((r.failure() || {}).errorText || ''))); page.on('response', (r) => { if (r.status() >= 400 && !/127\.0\.0\.1/.test(r.url())) seen.bad.push(r.status() + ' ' + r.url().replace(/^https:\/\//, '').slice(0, 90)); });
  if (!live) await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' }));
  // the page's own Wikipedia reads (a one- or two-word name is looked up in the browser, not by /api/answer): the same fixture answers them
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'); // a 1x1 picture stands in for a hotlinked photo
  if (!live) await page.route(/^https:\/\/upload\.wikimedia\.org\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const w = fx.wiki || {}, jj = (o) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (!live) await page.route(/^https:\/\/en\.wikipedia\.org\//, (r) => {
    const u = r.request().url();
    if (/\/page\/summary\//.test(u)) { const t = decodeURIComponent(u.split('/summary/')[1]).replace(/_/g, ' '), p = (w.search || []).find((x) => x.title === t); return p ? r.fulfill(jj({ type: 'standard', title: p.title, description: p.description || '', extract: p.extract, timestamp: '2026-09-01T00:00:00Z', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')) } } })) : r.fulfill({ status: 404, body: '{}' }); }
    if (/generator=search/.test(u)) return r.fulfill(jj({ query: { pages: Object.fromEntries((w.search || []).map((x, i) => [i + 1, { title: x.title, index: i + 1, description: x.description }])) } }));
    if (/list=search/.test(u) && /srlimit=1&/.test(u)) { const typed = /srsearch=([^&]+)/.exec(u); const sug = w.suggestion && typed && decodeURIComponent(typed[1]).toLowerCase() !== w.suggestion.toLowerCase(); const hit = (w.search || [])[0]; return r.fulfill(jj({ query: { search: sug ? [] : hit ? [{ title: hit.title }] : [], ...(sug ? { searchinfo: { suggestion: w.suggestion } } : {}) } })); }
    if (/list=search/.test(u)) return r.fulfill(jj({ query: { search: [] } }));
    return r.fulfill({ status: 204, body: '' });
  });
  await page.route(/127\.0\.0\.1:\d+\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route(/127\.0\.0\.1:\d+\/api\/answer/, (r) => { seen.called++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) }); });
  await page.goto('http://127.0.0.1:' + server.address().port + '/'); await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(400);
  await page.fill('#input', fx.ask); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); await page.waitForFunction(() => { const v = document.querySelector('.vpage.on') || document.querySelector('.vpage'); return v && !/^(?:…|thinking…|\.\.\.)$/.test(((v.querySelector('.sub') || {}).textContent || '').trim()); }, null, { timeout: live ? 25000 : 4000 }).catch(() => {}); await page.waitForTimeout(700); // live: the card is done when it stops saying it is thinking
  const card = await page.evaluate(() => { const v = document.querySelector('.vpage.on') || document.querySelector('.vpage'); if (!v) return null;
    const q = (s) => (v.querySelector(s) || {}).textContent || '';
    return { title: q('h2'), type: q(':scope > .vc-type'), adds: q('.vc-adds'), addsLine: /Adds to Verse/.test(q('.vc-adds')), badges: [...v.querySelectorAll('.vc-badge')].map((b) => b.textContent.trim()), notice: q('.vc-notice'), theme: v.dataset.theme || '',
      links: [...v.querySelectorAll('.src a')].map((a) => ({ t: a.textContent, h: a.getAttribute('href') })), body: [...v.querySelectorAll(':scope > p')].map((p) => p.textContent).join(' ').slice(0, 400),
      photo: !!v.querySelector(':scope > .vc-art > img.vc-art-photo'), credit: (v.querySelector('.vc-credit') || {}).textContent || '', pic: (v.querySelector(':scope > .vc-art') || {}).ariaLabel || '', subject: ((v.querySelector(':scope > .vc-art') || {}).dataset || {}).subject || '', text: v.innerText.slice(0, 3000) }; });
  await page.addStyleTag({ content: '.vpage{max-height:none!important;overflow:visible!important;height:auto!important}' }); await page.waitForTimeout(200); // the whole card, not the part that fits the window
  const shot = path.join(shots, 'eval-' + flat(fx.ask).slice(0, 40) + '.png'); await page.locator('.vpage.on, .vpage').first().screenshot({ path: shot }).catch(() => page.screenshot({ path: shot }));
  if (process.env.EVAL_DOM) console.log(await page.evaluate(() => [...(document.querySelector('.vpage.on')||document.querySelector('.vpage')).children].map((c) => c.tagName + '.' + c.className + ' h=' + Math.round(c.getBoundingClientRect().height) + ' d=' + getComputedStyle(c).display + ' o=' + getComputedStyle(c).opacity + ' c=' + getComputedStyle(c).color + ' ih=' + c.innerHTML.length + ' style=' + c.getAttribute('style') + ' attrs=' + c.getAttributeNames().join(',') + ' pos=' + getComputedStyle(c).position + ' ov=' + getComputedStyle(c).overflow + ' mh=' + getComputedStyle(c).maxHeight).join('\n')));
  if (process.env.EVAL_RULES) console.log(await page.evaluate(() => { const el = document.querySelector('.vpage .vc-adds'); const out = []; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (_) { continue; } for (const r of rs) { try { if (r.selectorText && el.matches(r.selectorText) && /overflow|height|contain/.test(r.cssText)) out.push(r.cssText.slice(0, 300)); } catch (_) {} } } return out.join('\n'); }));
  if (process.env.EVAL_CDP) { const c = await page.context().newCDPSession(page); await c.send('DOM.enable'); await c.send('CSS.enable'); const { root } = await c.send('DOM.getDocument'); const { nodeId } = await c.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.vpage .vc-adds' }); const m = await c.send('CSS.getMatchedStylesForNode', { nodeId }); for (const r of m.matchedCSSRules) if (r.rule.style.cssProperties.some((p) => /overflow|^height|flex/.test(p.name))) console.log(r.rule.selectorList.text.slice(0, 120), '=>', r.rule.style.cssProperties.filter((p) => /overflow|height|flex/.test(p.name)).map((p) => p.name + ':' + p.value).join(';')); }
  await page.close();
  const e = { ...(fx.expect || {}) }, problems = [];
  if (live && e.liveExpect) { for (const k of Object.keys(e)) delete e[k]; Object.assign(e, fx.expect.liveExpect); } // Wikipedia's own redirect decides what this name is
  if (live && e.liveTitle) e.title = e.liveTitle; // the real Wikipedia redirects this name elsewhere
  if (live) for (const k of ['badges', 'body', 'notBody', 'motif', 'photo', 'sources', 'noBadges']) delete e[k]; // a real page's words differ from a fixture's: live checks the kind, the title, the frame and the honesty rules
  if (!card) problems.push('no card drawn');
  else {
    const report = '> ' + fx.ask + '\n  by: answer-route\n  shows: ' + card.text.replace(/\s*\n\s*/g, ' / ') + '\n  pictures: ' + card.pic + ' ' + card.subject + '\n';
    if (errs.length) problems.push('page error: ' + errs[0]);
    if (live && e.type === 'Not found' && /A guess|Showing \u201c|Closest match/.test(card.text)) { delete e.type; delete e.adds; delete e.didYouMean; delete e.sources; } // a faithful stand-in repeats a fuzzy neighbour instead of refusing: marked as a guess is the honest alternative
    if (e.title && flat(card.title) !== flat(e.title)) problems.push('title is "' + card.title + '", wanted "' + e.title + '"');
    if (e.type && !new RegExp(e.type, 'i').test(card.type)) problems.push('type line "' + card.type.trim() + '" does not match /' + e.type + '/');
    if (e.adds === false && card.addsLine) problems.push('has an "Adds to Verse" line on a card that should not');
    if (e.adds === true && !card.addsLine) problems.push('is missing its "Adds to Verse" line');
    if (e.sources != null && card.links.length !== e.sources) problems.push(card.links.length + ' sources listed, wanted ' + e.sources);
    if (card.links.some((l) => !/^https:\/\//.test(l.h || ''))) problems.push('a listed source has no https link');
    if (e.notMotif && new RegExp(e.notMotif, 'i').test(card.pic + ' ' + card.subject)) problems.push('picture is of "' + (card.subject || card.pic) + '"');
    if (e.motif && !new RegExp(e.motif, 'i').test(card.pic + ' ' + card.subject)) problems.push('picture "' + (card.subject || card.pic) + '" is not of /' + e.motif + '/');
    if (e.theme && card.theme !== e.theme) problems.push('theme "' + card.theme + '", wanted ' + e.theme);
    if (e.badges && !e.badges.every((b) => card.badges.some((x) => x.toLowerCase().includes(b.toLowerCase())))) problems.push('badges ' + JSON.stringify(card.badges) + ' lack ' + JSON.stringify(e.badges));
    if (e.noBadges && card.badges.some((x) => new RegExp(e.noBadges, 'i').test(x))) problems.push('a badge states what the text does not: ' + card.badges.join(' | '));
    if (e.guess === true && !/A guess|Showing \u201c|Closest match/.test(card.text)) problems.push('a fuzzy match is not marked as a guess');
    if (e.guess === false && /A guess|Closest match/.test(card.text)) problems.push('marked as a guess when the sources name it');
    if (e.didYouMean && !new RegExp('Did you mean ' + e.didYouMean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?').test(card.text)) problems.push('no "Did you mean ' + e.didYouMean + '?"');
    if (e.noGuessLine && /Did you mean/.test(card.text)) problems.push('offers a guess it does not have');
    if (e.notFound === false && /^Not found/i.test(card.type.trim())) problems.push('a real answer drawn as Not found');
    if (e.photo === true && !(card.photo && /Photo:/.test(card.credit) && /Archive photo/i.test(card.credit))) problems.push('no licensed photo with its credit and the "Archive photo" label');
    if (e.photo === false && card.photo) problems.push('a photo on a card that keeps Verse\'s own picture');
    if (e.notice && !/not affiliated/.test(card.notice)) problems.push('missing the "not affiliated" line');
    if (e.body && !new RegExp(e.body, 'i').test(card.body)) problems.push('body lacks /' + e.body + '/: ' + card.body.slice(0, 120));
    if (e.notBody && new RegExp(e.notBody, 'i').test(card.body)) problems.push('body holds /' + e.notBody + '/: ' + card.body.slice(0, 120));
    if (!e.noOffTopic) { const off = offTopic(report, e.about || ''); if (off) problems.push(off.slice(0, 160)); }
  }
  results.push({ ask: fx.ask, ok: !problems.length, problems, card, shot, redirect, seen: { called: seen.called, failed: seen.failed.slice(0, 3), bad: seen.bad.slice(0, 3), text: card ? card.text.replace(/\s+/g, ' ').slice(0, 140) + ' … ' + card.text.replace(/\s+/g, ' ').slice(-120) : '' }, api: { name: json.name || '', desc: json.desc || '', fuzzy: !!json.fuzzy, noAnswer: !!json.noAnswer, guess: json.guess || '', pic: !!json.pic, sources: (json.sources || []).map((x) => x.title).slice(0, 3), answer: String(json.answer || '').slice(0, 90) } });
  console.log((problems.length ? 'FAIL ' : 'ok   ') + fx.ask + (card ? '  [' + card.type.trim() + ' | ' + (card.theme || 'no theme') + ' | ' + (card.subject || card.pic) + ' | ' + card.badges.join(', ') + ']' : '') + problems.map((p) => '\n       - ' + p).join('') + '\n       ' + shot);
}
console.log('\n' + results.filter((r) => r.ok).length + '/' + results.length + ' pass');
if (outFile) { // a small record, never the screenshots: what each live ask became
  const rec = { at: new Date().toISOString(), mode: live ? 'live' : 'stub', pass: results.filter((r) => r.ok).length, total: results.length, results: results.map((r) => ({ ask: r.ask, ok: r.ok, kind: r.card ? r.card.type.trim().slice(0, 60) : '', title: r.card ? r.card.title.trim().slice(0, 80) : '', theme: r.card ? r.card.theme : '', photo: !!(r.card && r.card.photo), api: r.api, redirect: r.redirect || undefined, ...(r.ok ? {} : { seen: r.seen }), ...(r.ok ? {} : { problems: r.problems.map((p) => p.slice(0, 140)).slice(0, 3) }) })) };
  fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(rec, null, 1) + '\n');
}
await browser.close(); server.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
