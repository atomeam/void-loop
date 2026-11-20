// Card art health: a few common asks (recipes, weather for several cities, others) are asked on the live site in a real browser. Each card must have real art
// (not the ink plate), on its subject, that the site's own vision check still passes (the card-art route looks at a kept picture and drops a weak or watermarked
// one), and "copy card" must carry the card's whole text, not a cut piece. A card with bad art is painted again through the same route (past the free share the
// treasury pays, and the log line says how much). Causes are counted; one that keeps coming back goes to the coder.
export const POOL = [
  { ask: 'pancake recipe', words: ['pancake'] }, { ask: 'banana bread recipe', words: ['banana'] }, { ask: 'guacamole recipe', words: ['guacamole'] },
  { ask: 'chocolate chip cookies recipe', words: ['cookie'] }, { ask: 'lasagna recipe', words: ['lasagna'] },
  { ask: 'weather in Lakeland', words: ['lakeland'] }, { ask: 'weather in Paris', words: ['paris'] }, { ask: 'weather in Tokyo', words: ['tokyo'] },
  { ask: 'weather in Boston', words: ['boston'] }, { ask: 'weather in Denver', words: ['denver'] },
  { ask: 'tell me about tokyo', words: ['tokyo'] }, { ask: 'recipe for pad thai', words: ['pad thai', 'thai'] },
];
export const PER_RUN = 6, WAIT_ART_MS = 50000, RECUR = 3, BUDGET_MS = 9 * 60e3;

/** the asks for this run: a rotating window over the pool, so the whole pool is covered in a day or two. Pure. */
export function pickAsks(pool, now, n = PER_RUN, everyMs = 6 * 3600e3) {
  const start = (Math.floor(now / everyMs) * n) % pool.length;
  return pool.concat(pool).slice(start, start + n);
}
const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** does the picture's subject name what the card is about. Pure. */
export const subjectOk = (words, ...subjects) => { const t = flat(subjects.join(' ')); return !!t && words.some((w) => t.includes(flat(w))); };
const LABELS = /^(examine|copy card|save card|custom art|reset art|share|☆ save|copy text|save text|send|pause|resume)$/i;
const FOOT = /^(open the full|full card)/i;
/** the words of the card a reader sees: its text down to the row of buttons, nothing below (the badges, stats, memory note and reply box are not copied). Pure. */
export const bodyWords = (visible) => {
  const lines = String(visible || '').split('\n').map((l) => l.trim()), cut = lines.findIndex((l, i) => i > 0 && LABELS.test(l));
  return [...new Set((cut < 0 ? lines : lines.slice(0, cut)).filter((l) => !LABELS.test(l) && !FOOT.test(l)).join(' ').toLowerCase().match(/[a-z]{5,}/g) || [])];
};
/** does the copied text carry the card: nearly every long word, and no cut-off ellipsis. Pure. */
export function copyOk(visible, clip) {
  const words = bodyWords(visible), c = String(clip || '').toLowerCase();
  if (!words.length) return { ok: true, share: 1 };
  const have = words.filter((w) => c.includes(w)).length, share = have / words.length;
  const cut = /(?:…|\.\.\.)\s*(?:\n|$)/.test(String(clip || '').trim());
  return { ok: share >= 0.85 && !cut, share: Math.round(share * 100) / 100, cut };
}
/** the causes found on one card, plain words. Pure. */
export function judge(r) {
  const out = [];
  if (!r.card) return ['no card came back'];
  if (r.expectArt) {
    if (!r.img) out.push(r.paintWhy ? 'no art (' + r.paintWhy + ')' : 'placeholder, no art');
    else {
      if (r.img.w < 256 || !r.img.complete) out.push('art did not load');
      if (r.weak) out.push('the site\'s vision check dropped the picture (weak or watermarked)');
      if (!r.onSubject) out.push('art is not on the subject');
    }
  }
  if (r.copy && !r.copy.ok) out.push(r.copy.cut ? 'copied card cut off' : 'copied card missing text (' + Math.round(r.copy.share * 100) + '% of it)');
  return out;
}
/** causes counted across runs; a cause at RECUR goes to the coder once. Pure. */
export function tally(memory, causes) {
  const m = { counts: { ...(memory && memory.counts) }, healed: { ...(memory && memory.healed) } }, heal = [];
  for (const k of Object.keys(m.counts)) if (!causes.includes(k)) delete m.counts[k]; // a cause that did not recur is not recurring
  for (const c of causes) { m.counts[c] = (m.counts[c] || 0) + 1; if (m.counts[c] >= RECUR && !m.healed[c]) { m.healed[c] = true; heal.push(c); } }
  for (const k of Object.keys(m.healed)) if (!causes.includes(k) && !m.counts[k]) delete m.healed[k];
  return { memory: m, heal };
}
const causeKey = (c) => c.replace(/\(.*\)/, '').replace(/\d+%/g, '').replace(/\s+/g, ' ').trim();
async function infra(ctx) { const r = await ctx.hit('/api/treasury'); try { return Number(JSON.parse(r.text).pots.infrastructure) || 0; } catch { return null; } }

// the system clipboard is one for the whole browser: two cards copying at once read each other's text, so the copy step goes one at a time
const note = (what, e) => console.log('guards: cards: ' + what + ' (' + String(e.message).slice(0, 60) + ')');
let clipLock = Promise.resolve();
const alone = (fn) => { const run = clipLock.then(fn, fn); clipLock = run.catch(() => {}); return run; };

async function look(ctx, b, item) {
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const out = { ask: item.ask, card: false, expectArt: false, img: null, onSubject: true, weak: false, copy: null, paintWhy: '', req: null };
  try {
    const p = await c.newPage();
    p.on('request', (r) => { if (r.url().includes('/api/card-art?key=') && !out.req) { const u = new URL(r.url()); out.req = { key: u.searchParams.get('key'), kind: u.searchParams.get('kind') || 'answer' }; } });
    p.on('response', async (r) => { if (r.url().includes('/api/card-art') && r.request().method() === 'POST') { try { const j = JSON.parse(await r.text()); if (j.state && j.state !== 'art') out.paintWhy = j.why || j.state; } catch (e) { note('not json', e); } } });
    await p.goto(ctx.site + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(3000);
    const inp = await p.$('input[type=text], textarea, input:not([type])');
    if (!inp) return out;
    await inp.fill(item.ask); await inp.press('Enter');
    await p.waitForSelector('.vcard', { timeout: 30000 }).catch(() => {});
    const t0 = Date.now();
    while (Date.now() - t0 < WAIT_ART_MS) { await p.waitForTimeout(3000); if (await p.evaluate(() => { const e = [...document.querySelectorAll('.vcard')].pop(); return !!(e && (e.querySelector('.vc-forge-img') || !e.querySelector('.vc-art'))); })) break; }
    const info = await p.evaluate(() => { const el = [...document.querySelectorAll('.vcard')].pop(); if (!el) return null; const img = el.querySelector('.vc-forge-img'); return { subj: el.dataset.artSubject || '', art: !!el.querySelector('.vc-art'), img: img ? { w: img.naturalWidth, complete: img.complete } : null, text: el.innerText }; });
    if (!info) return out;
    out.card = true; out.expectArt = info.art; out.img = info.img; out.text = info.text;
    out.onSubject = subjectOk(item.words, info.subj, out.req && out.req.key);
    if (out.req && info.img) { const g = await ctx.hit('/api/card-art?key=' + encodeURIComponent(out.req.key) + '&kind=' + encodeURIComponent(out.req.kind)); try { out.weak = !!JSON.parse(g.text).dropped; } catch (e) { note('not json', e); } }
    const btn = await p.$('.vcard:last-of-type .vc-share button:text-is("copy card")') || (await (await p.$$('.vcard')).pop().$('button:text-is("copy card")'));
    if (btn) {
      const clip = await alone(async () => { await btn.scrollIntoViewIfNeeded().catch((e) => note('scroll', e)); await btn.click(); await p.waitForTimeout(4000); return p.evaluate(async () => { try { const items = await navigator.clipboard.read(); for (const it of items) if (it.types.includes('text/plain')) return await (await it.getType('text/plain')).text(); } catch (e) { return 'clipboard: ' + String(e.message).slice(0, 60); } return ''; }); });
      out.copy = clip ? copyOk(info.text, clip) : { ok: false, share: 0, cut: false };
    }
  } catch (e) { out.err = String(e.message).slice(0, 80); }
  finally { await c.close(); }
  return out;
}

export async function run(ctx) {
  const pw = await ctx.loadPlaywright(), exe = ctx.chrome || (await import('../verse-guards.mjs')).CHROME();
  if (!pw || !exe) return { last: 'No browser on this runner, so no card was asked this time.', ok: true, note: 'No model call.' };
  const items = pickAsks(POOL, ctx.now), before = await infra(ctx), deadline = Date.now() + BUDGET_MS;
  const b = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    const queue = items.slice();
    await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length && Date.now() < deadline) results.push(await look(ctx, b, queue.shift())); }));
  } finally { await b.close(); }
  const repainted = [], stuck = [];
  for (const r of results) {
    r.causes = judge(r);
    const art = r.causes.filter((c) => /art|placeholder|vision|subject/.test(c));
    if (art.length && r.req && !ctx.dry) {
      const p = await ctx.hit('/api/card-art', { init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: r.req.key, kind: r.req.kind, rarity: 'common', again: true }) } });
      let st = ''; try { st = JSON.parse(p.text).state; } catch (e) { note('not json', e); }
      (st === 'art' ? repainted : stuck).push(r.ask);
    } else if (art.length) stuck.push(r.ask);
  }
  const after = await infra(ctx), paid = before != null && after != null ? Math.max(0, before - after) : 0;
  const all = results.flatMap((r) => r.causes.map(causeKey));
  const prevMem = ctx.prev && ctx.prev.state && ctx.prev.state.cards;
  const { memory, heal } = tally(prevMem, [...new Set(all)]);
  for (const c of heal) await ctx.queueJob('Card art and copy keep failing the same way on the live site: ' + c + '. Find the cause in the card route or the card page and fix it.', ('heal:card-' + c.replace(/[^a-z]+/g, '-')).slice(0, 40));
  const bad = results.filter((r) => r.causes.length);
  const note = paid ? 'No model call from this guard. Repainting past the free share costs the treasury about ' + paid + ' cent' + (paid === 1 ? '' : 's') + ' (infrastructure pot before and after).' : 'No model call from this guard. A repaint inside the free share costs nothing.';
  const last = !results.length ? 'No card came back this time.' : bad.length
    ? 'Asked ' + results.length + ' cards. ' + bad.length + ' had a problem: ' + bad.slice(0, 3).map((r) => '"' + r.ask + '": ' + r.causes.join(', ')).join('; ') + '. ' + (repainted.length ? 'Painted again: ' + repainted.join(', ') + '. ' : '') + (stuck.length ? 'Still without good art: ' + stuck.join(', ') + '. ' : '') + (heal.length ? 'A repeat cause went to the coder.' : '')
    : 'Asked recipes, weather for several cities and other cards. Every card had real art on its subject, passed the site\'s vision check, and copied with its full text.';
  return { last: last.trim(), ok: true, note, paidCents: paid, state: { cards: memory } };
}
