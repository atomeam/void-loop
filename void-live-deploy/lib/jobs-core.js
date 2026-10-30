/**
 * jobs-core: the listings and the logic of the jobs pages (/jobs/ and one page per site of the jobs lane, lib/job-sites.js). Owner, 2026-10-26: "we have to have
 * everything all the sites have"; the Versus floor is LinkedIn Jobs.
 * Where the listings come from, and what each source asks (read from each source's own API page on 2026-10-26; docs/playbooks/jobs-feeds.md):
 *   - Remotive (github.com/remotive-com/remote-jobs-api): link back to the URL found on Remotive AND name Remotive as the source; never submit its jobs to other job
 *     sites (Google Jobs, LinkedIn Jobs...); never show them to collect sign-ups or emails; read it a couple of times a day at most (more than 2 a minute is blocked);
 *     its listings arrive 24 hours late.
 *   - Jobicy (github.com/Jobicy/remote-jobs-api): keep Jobicy as the source and its canonical url; never present a listing as your own; no automated sync more often
 *     than once an hour; cache.
 *   - Himalayas (github.com/Himalayas-App/remote-jobs-api, himalayas.app/docs/remote-jobs-api): credit Himalayas wherever a listing shows; every Apply goes to its
 *     applicationLink; never pass the jobs on to other job boards, aggregators, Google Jobs or LinkedIn Jobs, through feeds or JobPosting structured data; data is
 *     refreshed every 24 hours, so read it once a day.
 *   Not used: Remote OK (its terms are only inside its API answer, which this builder could not read itself) and Arbeitnow (no API terms found; the site's terms allow
 *   personal, non-commercial viewing only). Nothing is scraped.
 * So: every listing names its source and links to the original posting on the source's own site (Apply goes there; Verse has no one-click apply and no profile);
 * the feed (RSS) carries only Jobicy listings; no page carries JobPosting data. Descriptions are cut to a short plain-text excerpt with emails, phone numbers,
 * street addresses and links taken out (scrub), and no logo is loaded (no third-party request from the visitor's browser).
 * Pure (Intl is the only outside thing it reads). Tests: tools/jobs.test.mjs.
 */
import { redactPersonal } from './privacy.js';
import { fold, escText } from './ics.js';

export const SOURCES = Object.freeze({
  remotive: { name: 'Remotive', home: 'https://remotive.com/', host: 'remotive.com', api: 'https://remotive.com/api/remote-jobs', terms: 'https://github.com/remotive-com/remote-jobs-api', ttl: 12 * 3600, feed: false, delayed: true },
  jobicy: { name: 'Jobicy', home: 'https://jobicy.com/', host: 'jobicy.com', api: 'https://jobicy.com/api/jobs', terms: 'https://github.com/Jobicy/remote-jobs-api', ttl: 3600, feed: true },
  himalayas: { name: 'Himalayas', home: 'https://himalayas.app/', host: 'himalayas.app', api: 'https://himalayas.app/jobs/api', terms: 'https://himalayas.app/docs/remote-jobs-api', ttl: 24 * 3600, feed: false },
});

// ---------- text ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', euro: '€', pound: '£', bull: '•', middot: '·', eacute: 'é', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß' };
/** HTML to one line of plain text: tags dropped, entities read, spaces folded. Pure. */
export function plain(html) {
  return String(html == null ? '' : html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(?:p|li|div|h\d)>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => safeChar(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
}
const safeChar = (n) => (n > 31 && n < 0x110000 && n !== 127 ? String.fromCodePoint(n) : ' ');
/** personal data out of a listing's text (the same rules as tools/site-re.mjs scrubPersonal): mailto/tel links, emails, phone numbers in any grouping, street
 *  addresses, PO boxes, IPs and card-like numbers, and bare links. Pure. */
export function scrub(s) {
  let t = String(s == null ? '' : s).replace(/\b(?:mailto|tel|sms|callto|whatsapp):[^\s"'<>]*/gi, '').replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, '')
    .replace(/\b\d{1,5}\s+(?:[A-Z][\w.'-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Strasse|Straße|Str)\b\.?/g, '')
    .replace(/\b(?:p\.?o\.? box|postfach)\s*\d+/gi, '').replace(/\+?\(?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '' : m));
  t = redactPersonal(t).replace(/\[(?:email|phone|ip|number|redacted)\]/g, '');
  return t.replace(/\s+([,.;:])/g, '$1').replace(/\s+/g, ' ').trim();
}
/** a short excerpt: whole sentences up to n characters (else whole words); the listing's own page has the rest. Pure. */
export function excerpt(text, n = 240) { const t = String(text || ''); if (t.length <= n) return t; const cut = t.slice(0, n + 1), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? ')); if (end > n * 0.4) return cut.slice(0, end + 1); const at = cut.lastIndexOf(' '); return cut.slice(0, at > 0 ? at : n).replace(/[,;:\s]+$/, ''); }
const clean = (s, n = 140) => scrub(plain(s)).slice(0, n);
const okUrl = (u, host) => { try { const x = new URL(String(u)); return x.protocol === 'https:' && (x.hostname === host || x.hostname.endsWith('.' + host)) ? x.href : ''; } catch (_) { return ''; } };
const iso = (v) => { if (v == null || v === '') return ''; const n = typeof v === 'number' || /^\d+$/.test(String(v)) ? +v : NaN; const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? String(v) : String(v).replace(' ', 'T') + 'Z'); return isNaN(d) ? '' : d.toISOString(); };
const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map((x) => clean(typeof x === 'object' ? x.name || x.title || '' : x, 40)).filter(Boolean);
const kind = (s) => { const k = String(s || '').toLowerCase().replace(/[_\s]+/g, '-'); return /full/.test(k) ? 'full-time' : /part/.test(k) ? 'part-time' : /contract|freelance/.test(k) ? 'contract' : /intern/.test(k) ? 'internship' : /temp/.test(k) ? 'temporary' : k ? 'other' : ''; };
export const VISA_RE = /\bvisa\s+sponsor(?:ship|ed)?\b|\bsponsor(?:s|ing)?\s+(?:a\s+|your\s+)?(?:work\s+)?visas?\b|\bvisa\s+support\b|\brelocation\s+(?:and|&)\s+visa\b/i;
const NO_VISA = /\b(?:no|not|cannot|can't|unable to|do not|don't|will not|won't)\s+(?:\w+\s+){0,3}sponsor|\bwithout\s+(?:visa\s+)?sponsorship\b/i;

// ---------- salary ----------
const CUR = { '$': 'USD', 'US$': 'USD', 'USD': 'USD', '€': 'EUR', 'EUR': 'EUR', '£': 'GBP', 'GBP': 'GBP', 'CAD': 'CAD', 'C$': 'CAD', 'AUD': 'AUD', 'A$': 'AUD', 'CHF': 'CHF', 'INR': 'INR', '₹': 'INR', 'PLN': 'PLN', 'SEK': 'SEK' };
const PER = (s) => (/\b(?:hour|hr|hourly|\/h)\b/i.test(s) ? 'hour' : /\b(?:day|daily)\b/i.test(s) ? 'day' : /\b(?:week|weekly)\b/i.test(s) ? 'week' : /\b(?:month|monthly|mo)\b/i.test(s) ? 'month' : 'year');
/** a salary written as text ("$80k - $100k", "€60,000–70,000 per year", "USD 45/hour") as { min, max, cur, per }, or null. Pure. */
export function parseSalary(text) {
  const s = String(text || ''); if (!/\d/.test(s)) return null;
  const cm = s.match(/US\$|C\$|A\$|[$€£₹]|\b(?:USD|EUR|GBP|CAD|AUD|CHF|INR|PLN|SEK)\b/i), cur = cm ? CUR[cm[0].toUpperCase()] || CUR[cm[0]] || 'USD' : '';
  const nums = [...s.matchAll(/(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)\s*([kK])?/g)].map((m) => { let n = +m[1].replace(/[,\s]/g, '').replace(/\.(?=\d{3}\b)/g, ''); if (m[2]) n *= 1000; return n; }).filter((n) => n >= 5);
  if (!nums.length || !cur) return null;
  const min = Math.min(nums[0], nums[1] || nums[0]), max = Math.max(nums[0], nums[1] || nums[0]);
  return { min, max, cur, per: PER(s) };
}
const PER_YEAR = { hour: 2080, day: 260, week: 52, month: 12, year: 1 };
/** a salary as a yearly figure in its own currency (the midpoint), for sorting and the minimum filter; 0 when none. Pure. */
export const yearly = (sal) => (sal && sal.max ? Math.round(((sal.min || sal.max) + sal.max) / 2 * (PER_YEAR[sal.per] || 1)) : 0);
const yearlyMin = (sal) => (sal && (sal.max || sal.min) ? Math.round((sal.max || sal.min) * (PER_YEAR[sal.per] || 1)) : 0);
/** a salary in words: "USD 80,000–100,000 a year". Pure. */
export function salaryText(sal, lang = 'en') {
  if (!sal || !(sal.min || sal.max)) return '';
  const f = (n) => Number(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 0 });
  const per = lang === 'de' ? { year: 'im Jahr', month: 'im Monat', week: 'pro Woche', day: 'pro Tag', hour: 'pro Stunde' } : { year: 'a year', month: 'a month', week: 'a week', day: 'a day', hour: 'an hour' };
  return sal.cur + ' ' + (sal.min && sal.max && sal.min !== sal.max ? f(sal.min) + '–' + f(sal.max) : f(sal.max || sal.min)) + ' ' + (per[sal.per] || per.year);
}

// ---------- regions (where a remote job may be done from) ----------
export const REGIONS = Object.freeze({ worldwide: 'Anywhere', americas: 'Americas', usa: 'USA', canada: 'Canada', latam: 'Latin America', europe: 'Europe', uk: 'UK', germany: 'Germany', emea: 'EMEA', asia: 'Asia and Pacific', africa: 'Africa', oceania: 'Australia and New Zealand' });
const REGION_RE = [['worldwide', /\b(?:worldwide|anywhere|global(?:ly)?|world|remote)\b/i], ['usa', /\b(?:usa?|u\.s\.a?\.?|united states|america(?!s)|us only|us-based)\b/i], ['canada', /\bcanad(?:a|ian)\b/i], ['latam', /\b(?:latam|latin america|south america|brazil|mexico|argentina|colombia|chile|peru)\b/i], ['americas', /\b(?:americas|north america)\b/i],
  ['uk', /\b(?:uk|u\.k\.|united kingdom|england|britain|scotland|wales)\b/i], ['germany', /\b(?:germany|deutschland|dach|berlin|munich|münchen|hamburg)\b/i], ['europe', /\b(?:europe|european|eu|eea|cet|cest|france|spain|portugal|netherlands|poland|italy|ireland|sweden|austria|switzerland|belgium|denmark|finland|norway|czech|romania)\b/i],
  ['emea', /\bemea\b/i], ['asia', /\b(?:asia|apac|india|singapore|japan|philippines|indonesia|vietnam|china|korea|pakistan|malaysia|thailand)\b/i], ['africa', /\b(?:africa|nigeria|kenya|egypt|south africa|ghana)\b/i], ['oceania', /\b(?:australia|new zealand|oceania|anz)\b/i]];
/** the regions a location line names; an empty line or "Worldwide" is anywhere. Pure. */
export function regionsOf(loc) {
  const s = String(loc || '').trim(); if (!s) return ['worldwide'];
  const out = REGION_RE.filter(([, re]) => re.test(s)).map(([k]) => k);
  return out.length ? (out.length > 1 && out[0] === 'worldwide' && /\bremote\b/i.test(s) && !/worldwide|anywhere|global/i.test(s) ? out.slice(1) : out) : ['other'];
}
// a job open in a wider region is open in the narrower one inside it
const WITHIN = { usa: ['americas'], canada: ['americas'], latam: ['americas'], uk: ['europe', 'emea'], germany: ['europe', 'emea'], europe: ['emea'], africa: ['emea'] };
/** whether a job may be done from a region. Pure. */
export const openIn = (job, region) => !region || job.regions.includes('worldwide') || job.regions.includes(region) || (WITHIN[region] || []).some((r) => job.regions.includes(r));

// ---------- normalising each source to one shape ----------
// { id, src, title, company, url (the original posting), apply (where Apply goes), loc, regions, type, level, cat, tags, salary, date, tz, excerpt, visa }
const finish = (j, desc) => { const text = scrub(plain(desc)); j.excerpt = excerpt(text, 240); j.visa = VISA_RE.test(text) && !NO_VISA.test(text); j.regions = regionsOf(j.loc); return j.id && j.title && j.url ? j : null; };
export function fromRemotive(r) {
  if (!r || typeof r !== 'object') return null; const url = okUrl(r.url, 'remotive.com');
  return finish({ id: 'remotive:' + String(r.id || '').replace(/\D/g, '').slice(0, 12), src: 'remotive', title: clean(r.title), company: clean(r.company_name, 80), url, apply: url, loc: clean(r.candidate_required_location, 120), type: kind(r.job_type), level: '', cat: clean(r.category, 40), tags: list(r.tags).slice(0, 8), salary: parseSalary(r.salary), date: iso(r.publication_date), tz: '' }, r.description);
}
export function fromJobicy(r) {
  if (!r || typeof r !== 'object') return null; const url = okUrl(r.url, 'jobicy.com');
  const sal = Number.isFinite(+r.salaryMin) || Number.isFinite(+r.salaryMax) ? { min: +r.salaryMin || 0, max: +r.salaryMax || +r.salaryMin || 0, cur: /^[A-Z]{3}$/.test(r.salaryCurrency || '') ? r.salaryCurrency : 'USD', per: PER(String(r.salaryPeriod || 'year')) } : null;
  return finish({ id: 'jobicy:' + String(r.id || '').replace(/\D/g, '').slice(0, 12), src: 'jobicy', title: clean(r.jobTitle), company: clean(r.companyName, 80), url, apply: url, loc: clean(r.jobGeo, 120), type: kind(list(r.jobType)[0]), level: /^any$/i.test(r.jobLevel || '') ? '' : clean(r.jobLevel, 30), cat: list(r.jobIndustry)[0] || '', tags: [...list(r.jobIndustry), ...list(r.jobType)].slice(0, 8), salary: sal && sal.max ? sal : null, date: iso(r.pubDate), tz: '' }, r.jobDescription || r.jobExcerpt);
}
const tzText = (a) => { const n = (Array.isArray(a) ? a : []).map(Number).filter(Number.isFinite); if (!n.length) return ''; const f = (x) => 'UTC' + (x < 0 ? '−' : '+') + Math.abs(x); const lo = Math.min(...n), hi = Math.max(...n); return lo === hi ? f(lo) : f(lo) + ' to ' + f(hi); };
const hid = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
export function fromHimalayas(r) {
  if (!r || typeof r !== 'object') return null;
  const url = okUrl(r.guid, 'himalayas.app') || okUrl(r.applicationLink, 'himalayas.app'), apply = okUrl(r.applicationLink, 'himalayas.app') || url;
  const sal = Number.isFinite(+r.minSalary) && +r.maxSalary ? { min: +r.minSalary || 0, max: +r.maxSalary, cur: /^[A-Z]{3}$/.test(r.currency || '') ? r.currency : 'USD', per: PER(String(r.salaryPeriod || 'year')) } : null;
  const lev = list(r.seniority)[0] || '';
  return finish({ id: 'himalayas:' + hid(url || r.title + r.companyName), src: 'himalayas', title: clean(r.title), company: clean(r.companyName, 80), url, apply, loc: list(r.locationRestrictions).join(', ').slice(0, 120), type: kind(r.employmentType), level: lev, cat: list(r.parentCategories)[0] || list(r.categories)[0] || '', tags: [...list(r.categories), ...list(r.parentCategories)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 8), salary: sal, date: iso(r.pubDate), tz: tzText(r.timezoneRestrictions) }, r.description || r.excerpt);
}
export const FROM = Object.freeze({ remotive: (j) => (j && j.jobs) || [], jobicy: (j) => (j && j.jobs) || [], himalayas: (j) => (j && j.jobs) || [] });
const NORM = { remotive: fromRemotive, jobicy: fromJobicy, himalayas: fromHimalayas };
/** a source's API answer as clean listings. Pure. */
export const normalise = (src, body) => (FROM[src] ? FROM[src](body) : []).map((r) => { try { return NORM[src](r); } catch (_) { return null; } }).filter(Boolean);
/** a listing read back from storage or the network, checked field by field (anything else is dropped). Pure. */
export function checkJob(j) {
  if (!j || typeof j !== 'object' || !SOURCES[j.src]) return null; const host = SOURCES[j.src].host;
  const url = okUrl(j.url, host), apply = okUrl(j.apply, host) || url; if (!url || !j.id || !j.title) return null;
  const sal = j.salary && Number.isFinite(+j.salary.max) && +j.salary.max > 0 ? { min: +j.salary.min || 0, max: +j.salary.max, cur: String(j.salary.cur || 'USD').slice(0, 3).toUpperCase(), per: PER_YEAR[j.salary.per] ? j.salary.per : 'year' } : null;
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  return { id: s(j.id, 40), src: j.src, title: s(j.title, 140), company: s(j.company, 80), url, apply, loc: s(j.loc, 120), regions: Array.isArray(j.regions) ? j.regions.filter((r) => REGIONS[r] || r === 'other').slice(0, 8) : regionsOf(j.loc), type: s(j.type, 20), level: s(j.level, 30), cat: s(j.cat, 40), tags: (Array.isArray(j.tags) ? j.tags : []).map((t) => s(t, 40)).slice(0, 8), salary: sal, date: iso(j.date), tz: s(j.tz, 40), excerpt: s(j.excerpt, 260), visa: j.visa === true };
}
/** several lists of listings as one: the same job (same source and id, or the same title and company) once, newest first. Pure. */
export function merge(...lists) {
  const seen = new Map();
  for (const l of lists) for (const raw of l || []) { const j = checkJob(raw); if (!j) continue; const k2 = (j.title + '|' + j.company).toLowerCase(); const old = seen.get(j.id) || seen.get(k2); if (old && (old.date || '') >= (j.date || '')) continue; if (old) { seen.delete(old.id); seen.delete((old.title + '|' + old.company).toLowerCase()); } seen.set(j.id, j); seen.set(k2, j); }
  return [...new Set(seen.values())].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id));
}

// ---------- search, filters, sort ----------
export const fold_ = (s) => String(s || '').replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLowerCase();
export const TYPES = Object.freeze({ 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', internship: 'Internship', temporary: 'Temporary', other: 'Other' });
export const SORTS = Object.freeze({ new: 'Newest', salary: 'Highest salary', company: 'Company A to Z', title: 'Title A to Z' });
export const EMPTY = Object.freeze({ q: '', loc: '', region: '', tag: '', cat: '', type: '', level: '', company: '', src: '', min: 0, salaryOnly: false, visa: false, days: 0, sort: 'new' });
const words = (q) => fold_(q).split(/[^a-z0-9+#.]+/).filter((w) => w.length > 0);
const hay = (j) => j._hay || (j._hay = fold_([j.title, j.company, j.cat, j.tags.join(' '), j.excerpt, j.level, j.type].join(' ')));
/** the listings that match a search { q, loc, region, tag, cat, type, level, company, src, min, salaryOnly, visa, days, sort }, sorted. Pure but for today's date. */
export function search(jobs, s = {}, now = Date.now()) {
  const f = { ...EMPTY, ...s }, qw = words(f.q), lw = words(f.loc), since = f.days > 0 ? new Date(now - f.days * 864e5).toISOString() : '';
  const out = (jobs || []).filter((j) => {
    if (qw.length) { const h = hay(j), title = fold_(j.title + ' ' + j.company); if (!qw.every((w) => h.includes(w))) return false; if (!qw.some((w) => title.includes(w) || j.tags.some((t) => fold_(t).includes(w)))) return false; }
    if (lw.length && !lw.every((w) => fold_(j.loc + ' ' + j.regions.map((r) => REGIONS[r] || '').join(' ')).includes(w)) && !(j.regions.includes('worldwide'))) return false;
    if (f.region && !openIn(j, f.region)) return false;
    if (f.tag && !j.tags.some((t) => fold_(t) === fold_(f.tag)) && fold_(j.cat) !== fold_(f.tag)) return false;
    if (f.cat && fold_(j.cat) !== fold_(f.cat)) return false;
    if (f.type && j.type !== f.type) return false;
    if (f.level && !fold_(j.level).includes(fold_(f.level))) return false;
    if (f.company && fold_(j.company) !== fold_(f.company)) return false;
    if (f.src && j.src !== f.src) return false;
    if ((f.salaryOnly || f.min > 0) && !j.salary) return false;
    if (f.min > 0 && yearlyMin(j.salary) < f.min) return false;
    if (f.visa && !j.visa) return false;
    if (since && (j.date || '') < since) return false;
    return true;
  });
  const by = { new: (a, b) => (b.date || '').localeCompare(a.date || ''), salary: (a, b) => yearly(b.salary) - yearly(a.salary) || (b.date || '').localeCompare(a.date || ''), company: (a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title), title: (a, b) => a.title.localeCompare(b.title) };
  return out.sort(by[f.sort] || by.new);
}
/** the counts of each value of a field over the listings: [[value, count], ...] most first. Pure. */
export function facet(jobs, field, limit = 40) {
  const m = new Map();
  for (const j of jobs || []) { const vals = field === 'tags' ? j.tags : field === 'regions' ? j.regions : [j[field]]; for (const v of vals) if (v) m.set(v, (m.get(v) || 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
}
/** a search as the query of a link, and back. Pure. */
export function toQuery(s) { const q = new URLSearchParams(); for (const [k, v] of Object.entries({ ...EMPTY, ...s })) if (k in EMPTY && v && v !== EMPTY[k] && !(k === 'sort' && v === 'new')) q.set(k, v === true ? '1' : String(v)); return q.toString(); }
export function fromQuery(qs) {
  const q = new URLSearchParams(qs), s = { ...EMPTY }, txt = (k, n = 60) => String(q.get(k) || '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
  for (const k of ['q', 'loc', 'tag', 'cat', 'level', 'company']) s[k] = txt(k);
  if (REGIONS[q.get('region')]) s.region = q.get('region'); if (TYPES[q.get('type')]) s.type = q.get('type'); if (SOURCES[q.get('src')]) s.src = q.get('src'); if (SORTS[q.get('sort')]) s.sort = q.get('sort');
  s.min = Math.max(0, Math.min(1e7, Math.round(+q.get('min') || 0))); s.days = [1, 3, 7, 14, 30].includes(+q.get('days')) ? +q.get('days') : 0; s.salaryOnly = q.get('salaryOnly') === '1'; s.visa = q.get('visa') === '1';
  return s;
}
/** a saved search's name from what it asks. Pure. */
export function searchName(s) { const f = { ...EMPTY, ...s }; const bits = [f.q && '“' + f.q + '”', f.tag, f.cat, f.region && REGIONS[f.region], f.loc, f.type && TYPES[f.type], f.level, f.company, f.min && '≥ ' + f.min.toLocaleString('en-US'), f.visa && 'visa', f.src && SOURCES[f.src].name].filter(Boolean); return bits.join(' · ') || 'All jobs'; }

// ---------- open the same search on the job sites (owner, 2026-10-26: "dont forget Verse can use these sites as well as beat them") ----------
/** the search { q, loc, region } as a link on each job site, each { id, name, url, check, note }. `check` says how sure the address pattern is: 'confirmed' when found
 *  in several published sources on 2026-10-26, 'partly' when part of it was, else 'unconfirmed' (the site may open its front page or its own search). The list is
 *  closed: no other host is built, every value is encoded. Nothing is sent by the page; the visitor opens the link. Pure. */
export function searchLinks(s = {}) {
  const e = encodeURIComponent, q = String(s.q || s.tag || s.cat || '').trim().slice(0, 80), loc = String(s.loc || (s.region && s.region !== 'worldwide' ? REGIONS[s.region] || '' : '')).trim().slice(0, 60);
  const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    { id: 'linkedin', name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/search/?keywords=' + e(q) + (loc ? '&location=' + e(loc) : '') + '&f_WT=2', check: 'partly', note: 'keywords and location are confirmed; f_WT=2 (remote) is read two ways by the guides' },
    { id: 'indeed', name: 'Indeed', url: 'https://www.indeed.com/jobs?q=' + e(q) + '&l=' + e(loc || 'remote'), check: 'partly', note: 'q and l are confirmed; l=remote for remote work is not' },
    { id: 'himalayas', name: 'Himalayas', url: 'https://himalayas.app/jobs' + (q ? '?q=' + e(q) : ''), check: 'partly', note: 'the q parameter is in one published example' },
    { id: 'remotive', name: 'Remotive', url: 'https://remotive.com/remote-jobs/search' + (q ? '?search=' + e(q) : ''), check: 'unconfirmed', note: 'not found in a published source' },
    { id: 'weworkremotely', name: 'We Work Remotely', url: 'https://weworkremotely.com/remote-jobs/search' + (q ? '?term=' + e(q) : ''), check: 'unconfirmed', note: 'not found in a published source' },
    { id: 'remoteok', name: 'Remote OK', url: 'https://remoteok.com/' + (slug ? 'remote-' + slug + '-jobs' : ''), check: 'unconfirmed', note: 'the tag page pattern is not confirmed' },
    { id: 'jobicy', name: 'Jobicy', url: 'https://jobicy.com/' + (q ? '?search_keywords=' + e(q) : ''), check: 'unconfirmed', note: 'not found in a published source' },
    { id: 'workingnomads', name: 'Working Nomads', url: 'https://www.workingnomads.com/jobs' + (q ? '?keywords=' + e(q) : ''), check: 'unconfirmed', note: 'not found in a published source' },
    { id: 'arbeitnow', name: 'Arbeitnow', url: 'https://www.arbeitnow.com/' + (q ? '?search=' + e(q) : ''), check: 'unconfirmed', note: 'not found in a published source' },
  ];
}

// ---------- alerts: a saved search and what is new since it was last seen ----------
/** the listings of a saved search posted after it was last opened, and the newest date among them. Pure. */
export function newSince(jobs, saved) { const all = search(jobs, saved.s || {}); const last = saved.seen || ''; return { all, fresh: last ? all.filter((j) => (j.date || '') > last) : [], newest: all.reduce((m, j) => (j.date > m ? j.date : m), '') }; }

// ---------- the feed (RSS 2.0): only the sources whose terms allow it (SOURCES[...].feed) ----------
const x = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** RSS for the listings of a search, from the feed-allowed sources only, each item linking to its original posting and naming its source. Pure. */
export function toRss(jobs, s = {}, origin = 'https://a-to-mind.com', now = new Date()) {
  const items = search((jobs || []).filter((j) => SOURCES[j.src] && SOURCES[j.src].feed), s).slice(0, 50), q = toQuery(s);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>' + x('Verse jobs: ' + searchName(s)) + '</title><link>' + x(origin + '/jobs/' + (q ? '?' + q : '')) + '</link>'
    + '<description>' + x('Remote jobs from Jobicy (jobicy.com) for this search. Each item links to its original posting; apply there.') + '</description><lastBuildDate>' + now.toUTCString() + '</lastBuildDate>'
    + items.map((j) => '<item><title>' + x(j.title + ' · ' + j.company) + '</title><link>' + x(j.url) + '</link><guid isPermaLink="true">' + x(j.url) + '</guid>' + (j.date ? '<pubDate>' + new Date(j.date).toUTCString() + '</pubDate>' : '') + '<source url="' + x(SOURCES[j.src].home) + '">' + x(SOURCES[j.src].name) + '</source><description>' + x([j.loc, salaryText(j.salary), j.excerpt, 'Source: ' + SOURCES[j.src].name].filter(Boolean).join(' · ')) + '</description></item>').join('')
    + '</channel></rss>\n';
}

// ---------- applications: a tracker kept on the device ----------
export const STAGES = Object.freeze({ saved: 'Saved', applied: 'Applied', interview: 'Interview', offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn' });
/** an application row checked field by field. Pure. */
export function cleanApp(a) {
  if (!a || typeof a !== 'object') return null; const s = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
  const title = s(a.title, 140).trim(); if (!title) return null; const d = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  let url = ''; try { const u = new URL(String(a.url || '')); if (u.protocol === 'https:' || u.protocol === 'http:') url = u.href.slice(0, 500); } catch (_) { /* no link */ }
  return { id: s(a.id, 40) || hid(title + a.company + Date.now() + Math.random()), title, company: s(a.company, 80), url, src: SOURCES[a.src] ? a.src : '', stage: STAGES[a.stage] ? a.stage : 'saved', applied: d(a.applied), next: d(a.next), notes: s(a.notes, 2000), updated: s(a.updated, 30) };
}
// The tracker holds a job when a row has its title, company and link, the same test addApp uses to skip a second copy.
export function isTracked(apps, j) {
  const r = cleanApp({ title: j && j.title, company: j && j.company, url: j && j.url }); if (!r) return false;
  return (Array.isArray(apps) ? apps : []).map(cleanApp).some((x) => x && x.title === r.title && x.company === r.company && x.url === r.url);
}
const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const APP_HEAD = ['title', 'company', 'stage', 'applied', 'next_step', 'link', 'source', 'notes', 'updated'];
/** the tracker as CSV (formula-safe cells). Pure. */
export const appsToCsv = (apps) => [APP_HEAD.join(','), ...(apps || []).map((a) => [a.title, a.company, STAGES[a.stage] || a.stage, a.applied, a.next, a.url, a.src ? SOURCES[a.src].name : '', a.notes, a.updated].map(csvCell).join(','))].join('\n') + '\n';
/** CSV text back into rows (the export's columns; a cell that was made formula-safe keeps its quote mark off). Pure. */
export function appsFromCsv(text) {
  const rows = [], t = String(text || ''); let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase()), at = (r, k) => { const i = head.indexOf(k); return i < 0 ? '' : String(r[i] || '').replace(/^'(?=[=+\-@])/, ''); };
  const stageOf = (v) => Object.keys(STAGES).find((k) => k === v.toLowerCase() || STAGES[k].toLowerCase() === v.toLowerCase()) || 'saved', srcOf = (v) => Object.keys(SOURCES).find((k) => SOURCES[k].name.toLowerCase() === v.toLowerCase()) || '';
  return rows.map((r) => cleanApp({ title: at(r, 'title'), company: at(r, 'company'), stage: stageOf(at(r, 'stage')), applied: at(r, 'applied'), next: at(r, 'next_step'), url: at(r, 'link'), src: srcOf(at(r, 'source')), notes: at(r, 'notes'), updated: at(r, 'updated') })).filter(Boolean);
}
/** the tracker's next steps (interviews, follow-ups) as a calendar file: one all-day event on each row's next-step date. Pure. */
export function appsToIcs(apps, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), ev = (apps || []).filter((a) => a.next);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Verse//Jobs//EN', 'CALSCALE:GREGORIAN'];
  for (const a of ev) { const d = a.next.replace(/-/g, ''), e = new Date(Date.parse(a.next + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, ''); lines.push('BEGIN:VEVENT', 'UID:' + a.id + '-' + d + '@a-to-mind.com', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + e, fold('SUMMARY:' + escText((STAGES[a.stage] || '') + ': ' + a.title + (a.company ? ' · ' + a.company : ''))), ...(a.url ? [fold('URL:' + a.url)] : []), ...(a.notes ? [fold('DESCRIPTION:' + escText(a.notes.slice(0, 500)))] : []), 'END:VEVENT'); }
  lines.push('END:VCALENDAR'); return lines.join('\r\n') + '\r\n';
}
/** how many of the tracker's rows stand at each stage. Pure. */
export const stageCounts = (apps) => Object.fromEntries(Object.keys(STAGES).map((k) => [k, (apps || []).filter((a) => a.stage === k).length]));

/** "3 h ago", "2 days ago" for a date (English or German). Pure but for now. */
export function ago(isoDate, lang = 'en', now = Date.now()) {
  const ms = now - Date.parse(isoDate); if (!Number.isFinite(ms)) return ''; const h = Math.round(ms / 36e5), d = Math.round(ms / 864e5);
  if (lang === 'de') return h < 1 ? 'gerade eben' : h < 24 ? 'vor ' + h + ' Std.' : d === 1 ? 'vor 1 Tag' : 'vor ' + d + ' Tagen';
  return h < 1 ? 'just now' : h < 24 ? h + ' h ago' : d === 1 ? '1 day ago' : d + ' days ago';
}
