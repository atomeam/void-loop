#!/usr/bin/env node
// Found money: Verse looks for legitimate money left on the ground, on a schedule (.github/workflows/treasury.yml), and lists each find
// on /treasury/ with its value (only a number its source publishes, else null), its source and the next step.
//   node tools/found-money.mjs          scan and write void-live-deploy/treasury/found.json
//   node tools/found-money.mjs --dry    print what it found; nothing written
// Places and rules: domains/found-money.sources.json. Every place's page is fetched first; one that does not answer is listed as
// 'source not reached' and never as a find. Live probes read public data only, within each site's terms and robots rules:
// Devpost's hackathon listing, GitHub's issue search (Algora's bounty label), Top Class Actions' public RSS feed, Verse's own public
// visit counts and its own pages. Verse signs up for nothing and claims nothing in anyone's name: what needs Atom's identity, a login
// or a card is 'ready to claim'; what Verse can do with no credentials is 'Verse does it' and stays on the list until it is done.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'VerseFoundMoney/1.0 (+https://a-to-mind.com/treasury/)';
const OUT = resolve(root, 'void-live-deploy/treasury/found.json');

/** "$<span ...>1,000,000</span>" or "€8,000" -> { cents, currency } or null. Pure. */
export function money(text) {
  const t = String(text || '').replace(/<[^>]+>/g, '');
  const m = /([$€£])\s?([\d,]+(?:\.\d+)?)\s*([kKmM])?/.exec(t);
  if (!m) return null;
  let n = Number(m[2].replace(/,/g, ''));
  if (m[3]) n *= /k/i.test(m[3]) ? 1e3 : 1e6;
  return n > 0 ? { cents: Math.round(n * 100), currency: { $: 'USD', '€': 'EUR', '£': 'GBP' }[m[1]] } : null;
}

/** Devpost's open hackathons -> finds that fit Verse: online, not invite-only, a theme Verse builds. Pure. */
export function hackathonFinds(list, skills, { max = 8 } = {}) {
  const want = new Set((skills || []).map((s) => s.toLowerCase()));
  return (list || []).filter((h) => h && h.open_state === 'open' && !h.invite_only && /online/i.test((h.displayed_location || {}).location || '')
    && (h.themes || []).some((t) => want.has(String(t.name).toLowerCase())))
    .map((h) => { const v = money(h.prize_amount); return { id: 'devpost:' + h.id, category: 'hackathon prizes', title: h.title + ' (' + (h.submission_period_dates || '') + ', ' + (h.time_left_to_submission || '') + ')',
      source: h.url, value_cents: null, prize_pool_cents: v && v.currency === 'USD' ? v.cents : null, value_note: v ? 'prize pool ' + String(h.prize_amount).replace(/<[^>]+>/g, '') + ' shared by the winners; not an estimate of what Verse would win' : 'no prize amount listed',
      fit: 'themes: ' + h.themes.map((t) => t.name).join(', '), status: 'ready to claim', needs: 'Atom registers and submits as the entrant (Devpost account)', next_step: 'Pick it if a Verse feature already matches the theme; build the entry; Atom submits.' }; })
      .sort((a, b) => (b.prize_pool_cents || 0) - (a.prize_pool_cents || 0)).slice(0, max);
}

/** GitHub issue-search items labeled as Algora bounties -> finds with the dollar amount the issue states. Pure. */
export function bountyFinds(items, { max = 8 } = {}) {
  return (items || []).filter((i) => i && !i.pull_request && !(i.labels || []).some((l) => /rewarded|assigned/i.test(l.name || '')))
    .map((i) => { const v = money([i.title, ...(i.labels || []).map((l) => l.name)].join(' ')) || money(String(i.body || '').slice(0, 2000));
      return { id: 'bounty:' + i.html_url, category: 'bug bounties and code bounties', title: i.title, source: i.html_url, value_cents: v && v.currency === 'USD' ? v.cents : null,
        value_note: v ? 'the bounty the issue states' : 'amount not stated on the issue', fit: (i.repository_url || '').replace('https://api.github.com/repos/', ''),
        status: 'ready to claim', needs: 'an Algora account to submit the fix and be paid', next_step: 'Verse writes the fix; Atom submits it through Algora and is paid there.' }; })
    .filter((f) => f.value_cents).sort((a, b) => b.value_cents - a.value_cents).slice(0, max);
}

/** RSS items -> open settlements naming a service Verse uses. Pure. */
export function settlementFinds(xml, terms, { max = 6 } = {}) {
  const items = String(xml || '').split('<item>').slice(1).map((s) => ({ title: (/<title>([^<]*)/.exec(s) || [])[1] || '', link: (/<link>([^<]*)/.exec(s) || [])[1] || '' }));
  const re = new RegExp('\\b(' + (terms || []).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
  return items.filter((i) => i.title && re.test(i.title)).slice(0, max).map((i) => { const v = money(i.title);
    return { id: 'settlement:' + i.link, category: 'class-action settlements', title: i.title.replace(/&#\d+;|&amp;/g, (x) => (x === '&amp;' ? '&' : "'")), source: i.link,
      value_cents: null, value_note: v ? 'the settlement fund is ' + i.title.match(/[$€£][\d.,]+[MKB]?/)[0] + '; a single claim is a small share' : 'not stated',
      fit: 'names ' + (i.title.match(re) || [])[0] + ', a service Verse or Atom uses', status: 'ready to claim', needs: 'Atom checks he is in the class and files his own claim', next_step: 'Read the eligibility on the settlement page; file only if Atom qualifies.' }; });
}

/** Outbound links to sites with an affiliate program, counted in Verse's own pages and skills. Pure over the file texts. */
export function affiliateFinds(texts, programs) {
  const out = [];
  for (const p of programs || []) {
    const re = new RegExp('https?://(?:[a-z0-9-]+\\.)*(' + p.domains.map((d) => d.replace(/\./g, '\\.')).join('|') + ')\\b', 'gi');
    let n = 0; const where = new Set();
    for (const [file, text] of texts) { const m = String(text).match(re); if (m) { n += m.length; where.add(file); } }
    if (n) out.push({ id: 'affiliate:' + p.domains[0], category: 'affiliate programs', title: p.program + ': Verse already links ' + p.domains[0] + ' ' + n + ' time' + (n === 1 ? '' : 's') + ' in ' + where.size + ' file' + (where.size === 1 ? '' : 's'),
      source: p.url, value_cents: null, value_note: 'commission per sale is on the program page; it depends on clicks Verse sends', fit: [...where].slice(0, 3).join(', '),
      status: 'ready to claim', needs: 'Atom joins the program (identity and tax form); the links then carry his tag with a visible disclosure', next_step: 'Join, then Verse swaps in the tagged links and adds the disclosure line.' });
  }
  return out.sort((a, b) => Number(b.title.match(/(\d+) time/)[1]) - Number(a.title.match(/(\d+) time/)[1]));
}

/** The busiest pages people visit that offer nothing to buy -> missed upsells Verse fixes itself (no credentials needed). Pure. */
export function upsellFinds(pages, hasOffer, { max = 5 } = {}) {
  return (pages || []).filter((p) => p && p.k && p.k !== '/' && p.k !== 'other' && hasOffer(p.k) === false).slice(0, max).map((p) => ({
    id: 'upsell:' + p.k, category: 'missed upsells', title: 'People open ' + p.k + ' (' + p.n + ' views in 7 days) and it offers nothing to buy', source: 'https://a-to-mind.com' + p.k,
    value_cents: null, value_note: 'unknown until it converts: traffic is still small', fit: 'Verse\'s own public visit counts (/api/visit)', status: 'Verse does it',
    needs: null, next_step: 'Add the paid-Verse offer (/members/) to the page, where it helps the visitor.' }));
}

async function get(url, { json = false, headers = {}, peek = false } = {}) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    if (!r.ok || peek) { try { await r.body?.cancel(); } catch (_) {} return { ok: r.ok, status: r.status }; }
    return { ok: true, status: r.status, body: json ? await r.json() : await r.text() };
  } catch (e) { return { ok: false, status: 0, error: String((e && e.cause && e.cause.code) || (e && e.name) || e) }; }
}
// a few at a time, so a slow site never starves the rest
async function inTurn(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } }));
  return out;
}
const REACHED = (r) => r.ok || [401, 403, 405, 429].includes(r.status); // a login or bot wall still proves the page is there; nothing behind it is read

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === 'vendor' || f.startsWith('.')) continue;
    const p = join(dir, f), s = statSync(p);
    if (s.isDirectory()) walk(p, out); else if (/\.(html|js)$/.test(f) && s.size < 2e6) out.push(p);
  }
  return out;
}

export async function scan({ now = new Date().toISOString() } = {}) {
  const S = JSON.parse(readFileSync(resolve(root, 'domains/found-money.sources.json'), 'utf8'));
  const finds = [], probes = {};
  // every place, its page reached first
  const places = await inTurn(S.places, 4, async (p) => {
    let r = await get(p.url, { peek: true });
    if (!REACHED(r)) r = await get(p.url, { peek: true }); // one retry: a single slow answer is not a missing page
    const reached = REACHED(r);
    return { id: p.id, category: p.category, title: p.title, source: p.url, value_cents: p.value_cents ?? null, value_note: p.value_note || (p.value_cents ? '' : 'unknown until Atom checks'),
      fit: p.fit || p.why || '', status: !reached ? 'source not reached' : p.status || 'ready to claim', needs: p.needs || null,
      next_step: p.status ? p.why : 'Atom checks it (' + (p.needs || 'a sign-in') + '); Verse never signs in or applies in his name.', reached_status: r.status };
  });
  // live probes, public data only
  const dp = await get('https://devpost.com/api/hackathons?status[]=open&order_by=prize-amount', { json: true });
  probes.devpost = dp.ok ? 'read' : 'not reached (' + dp.status + ')';
  if (dp.ok) finds.push(...hackathonFinds(dp.body.hackathons, S.verse.skills));
  const gh = process.env.GITHUB_TOKEN ? { authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {};
  const bq = await get('https://api.github.com/search/issues?per_page=50&sort=created&q=' + encodeURIComponent('label:"💎 Bounty" state:open is:issue -label:"💰 Rewarded" language:TypeScript language:JavaScript'), { json: true, headers: { accept: 'application/vnd.github+json', ...gh } });
  probes.github_bounties = bq.ok ? 'read' : 'not reached (' + bq.status + ')';
  if (bq.ok) {
    // only projects people actually use: at least 200 stars, not archived, not a repo that exists to farm bounties
    const repos = [...new Set((bq.body.items || []).map((i) => (i.repository_url || '').replace('https://api.github.com/repos/', '')).filter(Boolean))].slice(0, 25);
    const real = new Set();
    await inTurn(repos, 4, async (name) => { const r = await get('https://api.github.com/repos/' + name, { json: true, headers: { accept: 'application/vnd.github+json', ...gh } });
      if (r.ok && r.body.stargazers_count >= 200 && !r.body.archived && !/bount/i.test(r.body.name)) real.add(name); });
    finds.push(...bountyFinds((bq.body.items || []).filter((i) => real.has((i.repository_url || '').replace('https://api.github.com/repos/', '')))));
  }
  const tca = await get('https://topclassactions.com/category/lawsuit-settlements/open-lawsuit-settlements/feed/');
  probes.class_actions = tca.ok ? 'read (public RSS)' : 'not reached (' + tca.status + ')';
  if (tca.ok) finds.push(...settlementFinds(tca.body, S.class_action_terms));
  // affiliate programs for sites Verse already links (each program's page reached first)
  const deploy = resolve(root, 'void-live-deploy');
  const texts = walk(deploy).map((f) => [f.slice(deploy.length + 1), readFileSync(f, 'utf8')]);
  const aff = affiliateFinds(texts, S.affiliates);
  for (const a of aff) { if (REACHED(await get(a.source, { peek: true }))) finds.push(a); }
  probes.affiliates = aff.length + ' linked program(s)';
  // missed upsells on the busiest pages
  const v = await get('https://a-to-mind.com/api/visit?days=7', { json: true });
  probes.visits = v.ok ? 'read' : 'not reached (' + v.status + ')';
  if (v.ok) {
    const hasOffer = (path) => { const f = join(deploy, path.replace(/^\/+|\/+$/g, ''), 'index.html'); if (!existsSync(f)) return null; return /href="\/(members|store)\//.test(readFileSync(f, 'utf8')); };
    finds.push(...upsellFinds(((v.body.pages || {}).top) || [], hasOffer));
  }
  const all = [...places, ...finds];
  const published = all.filter((f) => f.value_cents && f.status !== 'source not reached');
  return { as_of: now, rules: 'Legitimate sources only, each cited. A value is a number its source publishes (a prize pool, a bounty, a program credit) and is not a forecast; null means unknown. Anything that needs Atom\'s identity, a login or a card is ready to claim; Verse claims nothing in anyone\'s name.',
    probes, counts: { places: places.length, live_finds: finds.length, ready_to_claim: all.filter((f) => f.status === 'ready to claim').length, verse_does_it: all.filter((f) => f.status === 'Verse does it').length, not_eligible: all.filter((f) => /not eligible/.test(f.status)).length, not_reached: all.filter((f) => f.status === 'source not reached').length },
    published_value_cents: published.reduce((n, f) => n + f.value_cents, 0), finds: all };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await scan();
  console.log(`found money: ${r.finds.length} entries (${r.counts.live_finds} live finds, ${r.counts.ready_to_claim} ready to claim, ${r.counts.verse_does_it} Verse does, ${r.counts.not_reached} sources not reached); probes ${JSON.stringify(r.probes)}`);
  if (process.argv.includes('--dry')) { for (const f of r.finds) console.log('-', f.status, '|', f.category, '|', f.title, '|', f.value_cents ?? '-', '|', f.source); process.exit(0); }
  writeFileSync(OUT, JSON.stringify(r, null, 1) + '\n');
}
