// Life arbitrage, private (owner, 2026-11-06: "make another arb scanner only we can use for life itself, theres arbitrage we are not
// considering all around us"). Finds real gaps between what something costs Atom (money and his minutes) and what it is worth, and ranks
// them by net value per hour of his time, deadlines first. Owner only: functions/api/life-arb.js, page /life-arb/ (noindex, not in the
// sitemap, llms.txt or x402 discovery). The public, paid market scanner is a different build.
//
// Real data only ("dont fake it"):
//   - every opportunity carries its source address and the evidence the source itself gave (a stated worth, a stated bounty, a deadline);
//   - value_cents is only ever a number the source publishes; value_kind says what that number is (cash, retail price of a free item,
//     a prize pool shared by winners = an upper bound, never an expected win); null when the source states none;
//   - Atom's minutes are an ESTIMATE per kind of step, stated with its basis (MINUTES below), so per-hour is shown as an estimate;
//   - a source that does not answer is reported as not reached and never invents a row.
// Finds and ranks only: it places no trade, makes no bet, buys nothing, sends no money, opens no account and accepts no terms. A step
// like that is listed under `asks` and waits for Atom's own yes.
//
// Sources: Verse's own daily found-money scan (/treasury/found.json, tools/found-money.mjs: hackathons, code bounties, settlements,
// credits, grants, upsells), GamerPower's public giveaway API (free games and DLC with their stated worth and end date), Devpost's open
// hackathon API (deadlines), and Top Class Actions' public settlements feed (claim deadlines).

export const UA = 'VerseLifeArb/1.0 (+https://a-to-mind.com/)';
export const SCAN_EVERY_MS = 6 * 3600e3; // the scheduled workflow (.github/workflows/life-arb.yml) and a stale owner read both scan
export const OPEN_SCAN_MIN_MS = 3 * 3600e3; // a scan asked for without the owner key runs at most this often
export const URGENT_DAYS = 7;

// Atom's minutes, an estimate per kind of step, with its basis. Changing one changes the ranking; nothing else invents a number.
export const MINUTES = {
  giveaway: { m: 3, basis: 'open the store page and press claim in an account he already has' },
  settlement: { m: 10, basis: 'read the eligibility and fill the online claim form (only if he is in the class)' },
  hackathon: { m: 45, basis: 'Verse builds the entry; Atom registers, reviews and submits' },
  bounty: { m: 30, basis: 'Verse drafts the fix; Atom reviews, opens the pull request and claims it' },
  credits: { m: 20, basis: 'one application form for a credits or perks program' },
  grant: { m: 90, basis: 'a written grant application' },
  unclaimed: { m: 10, basis: 'search a state unclaimed-property site under his own name' },
  payout: { m: 5, basis: 'sign in and check a balance or request a payout' },
  affiliate: { m: 25, basis: 'join the program; Verse then swaps in the tagged links' },
  verse: { m: 0, basis: 'Verse does it alone' },
  other: { m: 20, basis: 'one form or one check' },
};

const TIERS = ['cash', 'retail value', 'credits', 'prize pool (upper bound)', 'unknown'];

/** "$<b>1,000</b>", "€8,000", "$19.99", "$2.5k" -> { cents, currency } or null. Pure. */
export function money(text) {
  const t = String(text || '').replace(/<[^>]+>/g, '');
  const m = /([$€£])\s?([\d,]+(?:\.\d+)?)\s*([kKmM])?\b/.exec(t);
  if (!m) return null;
  let n = Number(m[2].replace(/,/g, ''));
  if (m[3]) n *= /k/i.test(m[3]) ? 1e3 : 1e6;
  return n > 0 ? { cents: Math.round(n * 100), currency: { $: 'USD', '€': 'EUR', '£': 'GBP' }[m[1]] } : null;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** Devpost's "Oct 01 - Nov 12, 2026" (or "Nov 02 - 15, 2026") -> the end day as an ISO date at 23:59 UTC, or null. Pure. */
export function devpostDeadline(period) {
  const s = String(period || '');
  const m = /-\s*(?:([A-Za-z]{3})[a-z]*\s+)?(\d{1,2}),\s*(\d{4})\s*$/.exec(s);
  if (!m) return null;
  let mon = m[1] ? MONTHS[m[1].toLowerCase()] : undefined;
  if (mon === undefined) { const a = /^\s*([A-Za-z]{3})/.exec(s); mon = a ? MONTHS[a[1].toLowerCase()] : undefined; }
  if (mon === undefined) return null;
  const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[2]), 23, 59));
  return isNaN(d) ? null : d.toISOString();
}

/** A deadline written in free text next to the word deadline: "Deadline: 12/15/2026", "deadline is Dec. 15, 2026" -> ISO or null. Pure. */
export function textDeadline(text) {
  const t = String(text || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
  const near = /deadline[^.]{0,40}?((\d{1,2})\/(\d{1,2})\/(\d{4})|([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}))/i.exec(t);
  if (!near) return null;
  let d;
  if (near[2]) d = new Date(Date.UTC(Number(near[4]), Number(near[2]) - 1, Number(near[3]), 23, 59));
  else { const mon = MONTHS[String(near[5]).toLowerCase()]; if (mon === undefined) return null; d = new Date(Date.UTC(Number(near[7]), mon, Number(near[6]), 23, 59)); }
  return isNaN(d) ? null : d.toISOString();
}

/** GamerPower's "2026-11-13 23:59:00" (or "N/A") -> ISO or null. Pure. */
export function gpDate(s) {
  if (!s || /n\/a/i.test(s)) return null;
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return isNaN(d) ? null : d.toISOString();
}

const shortId = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/** One opportunity with every field the page shows. Pure. */
export function opp(o) {
  const mk = MINUTES[o.kind] || MINUTES.other;
  const minutes = o.minutes ?? mk.m, cost = o.cost_cents ?? 0;
  const net = o.value_cents == null || !['cash', 'retail value', 'credits'].includes(o.value_kind) ? null : o.value_cents - cost;
  return {
    id: o.id || shortId(o.source_id + '|' + o.url + '|' + o.title),
    source_id: o.source_id, kind: o.kind, category: o.category, title: String(o.title || '').slice(0, 200), url: o.url,
    evidence: String(o.evidence || '').slice(0, 400),
    value_cents: o.value_cents ?? null, value_kind: o.value_cents == null ? 'unknown' : o.value_kind, value_note: o.value_note || null,
    cost_cents: cost, minutes, minutes_basis: o.minutes_basis || mk.basis, minutes_estimated: true,
    net_cents: net, per_hour_cents: net == null ? null : minutes > 0 ? Math.round(net / (minutes / 60)) : null,
    deadline: o.deadline || null, risk: o.risk || 'low', risk_why: o.risk_why || '',
    who: o.who || 'atom', next_step: o.next_step || '', asks: o.asks || [], verse_job: o.verse_job || null,
  };
}

/** GamerPower giveaways -> free games and DLC still active, with the worth the listing states. Pure. */
export function giveawayOpps(list, { now = Date.now(), max = 25 } = {}) {
  return (Array.isArray(list) ? list : []).filter((g) => g && /active/i.test(g.status || 'Active') && /game|dlc|early access/i.test(g.type || '')
    && !(gpDate(g.end_date) && Date.parse(gpDate(g.end_date)) < now))
    .map((g) => { const v = money(g.worth); const end = gpDate(g.end_date);
      return opp({ source_id: 'gamerpower', kind: 'giveaway', category: 'free games and DLC', title: g.title + ' (' + (g.platforms || 'PC') + ')',
        url: g.open_giveaway_url || g.gamerpower_url, evidence: 'GamerPower lists it as ' + (g.type || 'a giveaway') + ', worth ' + (g.worth || 'N/A') + (end ? ', ends ' + end.slice(0, 10) : ', no end date given') + '.',
        value_cents: v && v.currency === 'USD' ? v.cents : null, value_kind: 'retail value', value_note: 'the list price the giveaway states: money not spent, not cash',
        deadline: end, risk: 'low', risk_why: 'free; needs an account at that store',
        next_step: 'Open the giveaway and claim it in the store account you already use.',
        asks: ['Claiming in a store account accepts that store\'s terms: your yes, your click.'] }); })
    .sort((a, b) => (b.value_cents || 0) - (a.value_cents || 0)).slice(0, max);
}

/** Devpost's open hackathons -> online, open entries with the end of the submission period. Pure. */
export function hackathonOpps(list, { now = Date.now(), max = 15 } = {}) {
  return (list || []).filter((h) => h && h.open_state === 'open' && !h.invite_only && /online/i.test((h.displayed_location || {}).location || ''))
    .map((h) => { const v = money(h.prize_amount); const end = devpostDeadline(h.submission_period_dates);
      return opp({ source_id: 'devpost', kind: 'hackathon', category: 'hackathon prizes', title: h.title, url: h.url,
        evidence: 'Devpost: prize pool ' + String(h.prize_amount || 'not listed').replace(/<[^>]+>/g, '') + ', submissions ' + (h.submission_period_dates || '?') + ' (' + (h.time_left_to_submission || '') + ')' + (h.registrations_count ? ', ' + h.registrations_count + ' registered' : '') + '.',
        value_cents: v && v.currency === 'USD' ? v.cents : null, value_kind: 'prize pool (upper bound)', value_note: 'the whole pool shared by every winner; not what an entry would win',
        deadline: end, risk: 'high', risk_why: 'judged contest: most entries win nothing' + (h.registrations_count ? ' (' + h.registrations_count + ' registered)' : ''),
        who: 'both', next_step: 'Verse drafts an entry from a Verse feature that fits the themes; you register and submit.',
        asks: ['Registering on Devpost and submitting accepts the hackathon\'s rules: your yes.'],
        verse_job: 'Life arb: draft a hackathon entry for "' + String(h.title).slice(0, 80) + '" (Devpost' + (end ? ', closes ' + end.slice(0, 10) : '') + ') from a Verse feature; Atom submits' }); })
    .filter((o) => !o.deadline || Date.parse(o.deadline) > now).slice(0, max);
}

/** Top Class Actions' open-settlements RSS -> each settlement with a claim deadline it states. Pure. */
export function settlementOpps(xml, { now = Date.now(), max = 15 } = {}) {
  const items = String(xml || '').split('<item>').slice(1).map((s) => ({
    title: ((/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(s) || [])[1] || '').trim(),
    link: ((/<link>([^<]*)/.exec(s) || [])[1] || '').trim(),
    text: (/<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(s) || /<description>([\s\S]*?)<\/description>/.exec(s) || [])[1] || '' }));
  const clean = (t) => t.replace(/&#8217;|&#039;/g, "'").replace(/&#8211;|&#8212;/g, '-').replace(/&amp;/g, '&').replace(/&#\d+;/g, '');
  return items.filter((i) => i.title && i.link).map((i) => { const end = textDeadline(i.text) || textDeadline(i.title);
    const per = /(?:up to|receive|payments? of|get)\s+([$][\d,.]+[kK]?)/i.exec(clean(i.text + ' ' + i.title)); const v = per ? money(per[1]) : null;
    return opp({ source_id: 'topclassactions', kind: 'settlement', category: 'class-action settlements', title: clean(i.title), url: i.link,
      evidence: 'Top Class Actions' + (end ? ': claim deadline ' + end.slice(0, 10) : ': no claim deadline in the feed') + (per ? '; the post says ' + per[0] : '') + '.',
      value_cents: v ? v.cents : null, value_kind: 'cash', value_note: per ? 'the most a single claim can get, as the post states it ("' + per[0] + '"); often less' : null,
      deadline: end, risk: 'low', risk_why: 'file only if you are in the class: a false claim is fraud',
      next_step: 'Read who qualifies on the settlement page; file the claim only if that is you.',
      asks: ['Filing a claim attests that you qualify: your own yes and your own form.'] }); })
    .filter((o) => !o.deadline || Date.parse(o.deadline) > now).slice(0, max);
}

const KIND_OF = { 'hackathon prizes': 'hackathon', 'bug bounties and code bounties': 'bounty', 'class-action settlements': 'settlement', 'startup credit programs': 'credits',
  'unused credits': 'credits', grants: 'grant', 'unclaimed property': 'unclaimed', 'payouts and balances': 'payout', 'marketplace and platform payouts': 'payout',
  'affiliate programs': 'affiliate', 'missed upsells': 'verse' };

/** Verse's own found-money list (/treasury/found.json) -> opportunities. Reached, claimable or Verse's own; never one not reached. Pure. */
export function foundOpps(found, { now = Date.now() } = {}) {
  return ((found && found.finds) || []).filter((f) => f && (f.status === 'ready to claim' || f.status === 'Verse does it')).map((f) => {
    const kind = KIND_OF[f.category] || 'other';
    const deadline = kind === 'hackathon' ? devpostDeadline((/\(([^,]+,\s*\d{4})/.exec(f.title) || [])[1]) : null;
    const isPool = f.prize_pool_cents != null && f.value_cents == null;
    const verse = f.status === 'Verse does it';
    return opp({ source_id: 'found-money', kind, category: f.category, title: f.title, url: f.source,
      evidence: 'Verse\'s found-money scan (' + String((found.as_of || '').slice(0, 10)) + '): ' + (f.value_note || 'value not stated') + (f.fit ? '; ' + f.fit : '') + '.',
      value_cents: isPool ? f.prize_pool_cents : f.value_cents, value_kind: isPool ? 'prize pool (upper bound)' : kind === 'bounty' ? 'cash' : kind === 'credits' ? 'credits' : 'cash',
      value_note: f.value_note, deadline, risk: kind === 'hackathon' ? 'high' : kind === 'bounty' ? 'medium' : 'low',
      risk_why: kind === 'hackathon' ? 'judged contest' : kind === 'bounty' ? 'paid only if your fix is the one merged' : (f.needs || ''),
      who: verse ? 'verse' : kind === 'bounty' || kind === 'hackathon' ? 'both' : 'atom', next_step: f.next_step,
      asks: verse ? [] : [f.needs ? 'Needs you: ' + f.needs : 'Needs your own sign-in or application.'],
      verse_job: verse ? 'Life arb: ' + String(f.next_step || f.title).slice(0, 150) + ' (' + String(f.source || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 30) + ')' : null });
  }).filter((o) => !o.deadline || Date.parse(o.deadline) > now);
}

/** Same opportunity from two sources (Devpost live and the found-money copy): keep the live one. Pure. */
export function dedupe(list) {
  const key = (o) => String(o.url || '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase() || o.id;
  const seen = new Map();
  for (const o of list) { const k = key(o); const had = seen.get(k); if (!had || (had.source_id === 'found-money' && o.source_id !== 'found-money')) seen.set(k, o); }
  return [...seen.values()];
}

/** The ranking: deadlines within URGENT_DAYS first (soonest first), then by what the value is (cash before retail before credits before
 *  an upper bound before unknown), then net value per hour of Atom's time, then the nearer deadline. Pure. */
export function rank(list, { now = Date.now(), urgentDays = URGENT_DAYS } = {}) {
  const lim = now + urgentDays * 864e5;
  const urgent = (o) => o.deadline && Date.parse(o.deadline) <= lim ? 0 : 1;
  const tier = (o) => { const i = TIERS.indexOf(o.value_kind); return i < 0 ? TIERS.length : i; };
  const ph = (o) => (o.per_hour_cents == null ? (o.value_cents == null ? -1 : 0) : o.per_hour_cents);
  const dl = (o) => (o.deadline ? Date.parse(o.deadline) : Infinity);
  return [...list].sort((a, b) => urgent(a) - urgent(b) || (urgent(a) === 0 ? dl(a) - dl(b) : 0) || tier(a) - tier(b) || ph(b) - ph(a) || (b.value_cents || 0) - (a.value_cents || 0) || dl(a) - dl(b))
    .map((o, i) => ({ ...o, rank: i + 1, urgent: urgent(o) === 0 }));
}

/** What could not be scanned, as asks: a source that needs a key or an account only Atom can open. Static and honest. */
export const GAPS = [
  { what: 'resale flips (buy low, sell higher)', why: 'no sold-price data without a marketplace API key (eBay\'s Browse and Marketplace Insights APIs need a developer account)', ask: 'Should Verse ask you to open an eBay developer account so it can read sold prices?' },
  { what: 'paid research studies and user tests', why: 'the listings (Prolific, Respondent, User Interviews) sit behind a sign-in', ask: 'Only you can sign up; Verse would rank the studies once you share a feed.' },
];

async function get(fetchImpl, url, { json = false } = {}) {
  try {
    const r = await fetchImpl(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, status: r.status, body: json ? await r.json() : await r.text() };
  } catch (e) { return { ok: false, status: 0, why: String((e && e.name) || e) }; }
}

/** Runs every scanner. `assets(path)` reads a static file of the site (found.json). Never throws; each source reports its own state. */
export async function scan({ fetchImpl = fetch, assets, now = Date.now() } = {}) {
  const sources = {}, all = [];
  const fj = assets ? await assets('/treasury/found.json').then(async (r) => (r.ok ? { ok: true, body: await r.json() } : { ok: false, status: r.status })).catch(() => ({ ok: false, status: 0 }))
    : await get(fetchImpl, 'https://a-to-mind.com/treasury/found.json', { json: true });
  if (fj.ok) { const o = foundOpps(fj.body, { now }); all.push(...o); sources['found-money'] = { state: 'read', as_of: fj.body.as_of || null, count: o.length, url: 'https://a-to-mind.com/treasury/found.json' }; }
  else sources['found-money'] = { state: 'not reached (' + fj.status + ')', count: 0 };
  const [gp, dp, tca] = await Promise.all([
    get(fetchImpl, 'https://www.gamerpower.com/api/giveaways', { json: true }),
    get(fetchImpl, 'https://devpost.com/api/hackathons?status[]=open&order_by=deadline', { json: true }),
    get(fetchImpl, 'https://topclassactions.com/category/lawsuit-settlements/open-lawsuit-settlements/feed/'),
  ]);
  const add = (id, r, fn, url) => { if (r.ok) { const o = fn(r.body); all.push(...o); sources[id] = { state: 'read', count: o.length, url }; } else sources[id] = { state: 'not reached (' + r.status + ')', count: 0, url }; };
  add('gamerpower', gp, (b) => giveawayOpps(b, { now }), 'https://www.gamerpower.com/api/giveaways');
  add('devpost', dp, (b) => hackathonOpps(b && b.hackathons, { now }), 'https://devpost.com/api/hackathons');
  add('topclassactions', tca, (b) => settlementOpps(b, { now }), 'https://topclassactions.com/category/lawsuit-settlements/open-lawsuit-settlements/');
  const ranked = rank(dedupe(all), { now });
  return { as_of: new Date(now).toISOString(), sources, count: ranked.length, opportunities: ranked, gaps: GAPS };
}

/** The jobs Verse can do with no one's yes (a hackathon entry draft, an upsell on its own page), at most `max` new ones per scan. Pure. */
export function verseJobs(ranked, { max = 3, have = new Set() } = {}) {
  return ranked.filter((o) => o.verse_job && (o.who === 'verse' || o.who === 'both') && !have.has('lifearb:' + o.id)).slice(0, max)
    .map((o) => ({ target: 'lifearb:' + o.id, ask: o.verse_job.slice(0, 200) }));
}
