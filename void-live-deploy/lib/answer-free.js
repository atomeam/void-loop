// answer-free — /api/answer's free-resource routing (owner, 2026-11-03: free-resource arbitrage; 2026-11-04: Verse's own bots answer
// what they can). Each ask goes to the best free resource for its kind, with fallback down the chain:
//   1. Verse's own bots (bots/kit.js, bots/families.js): an exact, computable ask ("3 miles to km", "is 97 prime", "255 in binary",
//      "what does http 429 mean") is answered by the live bot whose job it is. A bot answers only when its own probe or checks pass
//      in this isolate (the same gate tools/bot-factory.mjs uses), so a broken bot is skipped, never trusted. Pure, no network, no quota.
//   2. Free public APIs from resources/free.json through lib/free-router.js (its per-resource daily share and failover): a research ask
//      ("papers on sea level rise") goes to OpenAlex (keyless). A failed or exhausted API falls through to the model.
//   3. The model: the free Workers AI chat model (lib/models.js FREE_MODEL) stays the default and is called directly by answer.js as
//      before. Only when it fails does freeLlm() try the other free LLM tiers in the registry that Atom has added a key for (one
//      legitimate account each), via the router's quota-aware failover, before the second Workers AI model, paid, and the open web.
// Every reply says which resource answered (`source`), so routing is visible on the card and in /api/answer's JSON.
//   const plan = planOf(ask)                                 -> { kind: 'bot'|'api'|'llm', ... } (pure)
//   const out  = await routeFree(ask, { env, registry })      -> null (go on to the model) or { answer, sources, source, route, ... }
//   const alt  = await freeLlm(messages, { env, registry })   -> null or { answer, source, tried }
import { BOTS, BOT, probe } from '../bots/kit.js';
import { families, check } from '../bots/families.js';
import { fxCode } from '../bots/fx-pairs.js';
import { holidayCode } from '../bots/holidays.js';
import { runJob } from './free-router.js';

// research asks, in order: OpenAlex on Atom's free key, OpenAlex keyless (a tiny daily budget), then Crossref (keyless, generous)
export const RESEARCH = ['openalex-key', 'openalex', 'crossref'];
const NUM = '(-?\\d[\\d,]*(?:\\.\\d+)?)';
const num = (s) => parseFloat(String(s).replace(/,/g, ''));
// spoken unit names to bots/families.js unit keys (one dimension each; ambiguous words like "calories" or "tons" are left to the model)
const UNIT = {
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm', km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km', cm: 'cm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm', mm: 'mm', millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
  in: 'in', inch: 'in', inches: 'in', ft: 'ft', foot: 'ft', feet: 'ft', yd: 'yd', yard: 'yd', yards: 'yd', mi: 'mi', mile: 'mi', miles: 'mi', 'nautical mile': 'nmi', 'nautical miles': 'nmi', 'light year': 'ly', 'light years': 'ly', 'light-years': 'ly', 'light-year': 'ly', au: 'au', parsec: 'pc', parsecs: 'pc', furlong: 'furlong', furlongs: 'furlong',
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', g: 'g', gram: 'g', grams: 'g', mg: 'mg', milligram: 'mg', milligrams: 'mg', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', oz: 'oz', ounce: 'oz', ounces: 'oz', stone: 'st', st: 'st', carat: 'ct', carats: 'ct',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l', ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', gallon: 'gal_us', gallons: 'gal_us', gal: 'gal_us', quart: 'qt_us', quarts: 'qt_us', pint: 'pt_us', pints: 'pt_us', cup: 'cup_us', cups: 'cup_us', 'fl oz': 'floz_us', 'fluid ounce': 'floz_us', 'fluid ounces': 'floz_us', tablespoon: 'tbsp_us', tablespoons: 'tbsp_us', tbsp: 'tbsp_us', teaspoon: 'tsp_us', teaspoons: 'tsp_us', tsp: 'tsp_us',
  acre: 'acre', acres: 'acre', hectare: 'ha', hectares: 'ha', ha: 'ha', 'square feet': 'ft2', 'sq ft': 'ft2', 'square meters': 'm2', 'square metres': 'm2', 'square miles': 'mi2', 'square kilometers': 'km2', 'square kilometres': 'km2',
  second: 's', seconds: 's', sec: 's', secs: 's', minute: 'min', minutes: 'min', mins: 'min', hour: 'h', hours: 'h', hr: 'h', hrs: 'h', day: 'day', days: 'day', week: 'week', weeks: 'week', year: 'year', years: 'year', decade: 'decade', decades: 'decade', century: 'century', centuries: 'century', millisecond: 'ms', milliseconds: 'ms',
  byte: 'B', bytes: 'B', bit: 'bit', bits: 'bit', kb: 'kB', kilobytes: 'kB', mb: 'MB', megabytes: 'MB', gb: 'GB', gigabytes: 'GB', tb: 'TB', terabytes: 'TB', kib: 'KiB', mib: 'MiB', gib: 'GiB', tib: 'TiB', mbps: 'Mbit', gbps: 'Gbit',
  mph: 'mph', 'miles per hour': 'mph', 'km/h': 'km/h', kph: 'km/h', 'kilometers per hour': 'km/h', 'kilometres per hour': 'km/h', 'm/s': 'm/s', 'meters per second': 'm/s', knot: 'knot', knots: 'knot', mach: 'mach',
  joule: 'J', joules: 'J', j: 'J', kj: 'kJ', kilojoules: 'kJ', kcal: 'kcal', kilocalories: 'kcal', kwh: 'kWh', 'kilowatt hours': 'kWh', 'kilowatt-hours': 'kWh', wh: 'Wh', btu: 'BTU', btus: 'BTU', ev: 'eV', therm: 'therm', therms: 'therm',
  pa: 'Pa', pascal: 'Pa', pascals: 'Pa', kpa: 'kPa', bar: 'bar', bars: 'bar', atm: 'atm', atmosphere: 'atm', atmospheres: 'atm', psi: 'psi', mmhg: 'mmHg', torr: 'torr', inhg: 'inHg',
  watt: 'W', watts: 'W', w: 'W', kw: 'kW', kilowatt: 'kW', kilowatts: 'kW', mw: 'MW', megawatts: 'MW', hp: 'hp', horsepower: 'hp',
  degree: 'deg', degrees: 'deg', deg: 'deg', radian: 'rad', radians: 'rad', rad: 'rad', gradian: 'grad', gradians: 'grad', turn: 'turn', turns: 'turn',
  hz: 'Hz', hertz: 'Hz', khz: 'kHz', mhz: 'MHz', ghz: 'GHz', rpm: 'rpm',
};
const TEMP = { c: 'C', celsius: 'C', centigrade: 'C', f: 'F', fahrenheit: 'F', k: 'K', kelvin: 'K', kelvins: 'K', r: 'R', rankine: 'R' };
const unitOf = (w) => { const t = String(w || '').toLowerCase().replace(/^degrees? /, '').replace(/^°\s*/, '').replace(/\.$/, '').trim(); return TEMP[t] ? { temp: TEMP[t] } : UNIT[t] ? { unit: UNIT[t] } : null; };
const BASES = { binary: 2, bin: 2, octal: 8, oct: 8, decimal: 10, dec: 10, hex: 16, hexadecimal: 16, 'base 2': 2, 'base 8': 8, 'base 10': 10, 'base 16': 16, 'base 36': 36 };

const clean = (ask) => String(ask || '').trim().replace(/\s+/g, ' ').replace(/[?!.]+$/, '').replace(/^(?:hey |hi |ok |please |verse,? )+/i, '').replace(/^(?:can you |could you |please )?(?:tell me |show me )?/i, '').replace(/ please$/i, '').trim();

/** which free resource should take this ask: a bot (with its input), a public API, or the default model. Pure. */
export function planOf(ask) {
  const a = clean(ask), t = a.toLowerCase();
  if (!a || a.length > 140 || /\n/.test(String(ask))) return { kind: 'llm', why: a.length > 140 ? 'long ask: the model' : 'default' };
  let m;
  // unit conversion: "3 miles to km", "convert 10 kg into pounds", "what is 100 f in c", "how many feet in 2 miles"
  const conv = (n, from, to) => {
    const x = unitOf(from), y = unitOf(to);
    if (x && y && x.temp && y.temp && x.temp !== y.temp) return { kind: 'bot', bot: 'temp-' + x.temp + '-to-' + y.temp, input: String(n), say: n + ' °' + x.temp + ' = ' };
    if (x && y && x.unit && y.unit && x.unit !== y.unit) return { kind: 'bot', bot: x.unit + '-to-' + y.unit, input: String(n), say: n + ' ' + x.unit + ' = ' };
    return null;
  };
  if ((m = t.match(new RegExp('^(?:convert |what is |what\'s |whats |how much is |how many is )?' + NUM + ' ?((?:degrees? )?[a-z°/][a-z°/ -]{0,24}?) (?:to|in|into|as|in terms of) ((?:degrees? )?[a-z°/][a-z°/ -]{0,24}?)$')))) { const p = conv(num(m[1]), m[2], m[3]); if (p) return p; }
  if ((m = t.match(new RegExp('^how many ([a-z°/][a-z°/ -]{0,24}?) (?:are |is )?(?:there )?in (?:a |an |one )?' + NUM + '? ?([a-z°/][a-z°/ -]{0,24}?)$')))) { const p = conv(m[2] ? num(m[2]) : 1, m[3], m[1]); if (p) return p; }
  // currency, after units so "10 pounds to kg" stays a weight: "100 usd to eur", "50 pounds to euros"
  if ((m = t.match(new RegExp('^(?:convert |what is |what\'s )?' + NUM + ' ([a-z]{2,12}) (?:to|in|into) ([a-z]{2,12})$')))) { const a = fxCode(m[2]), b = fxCode(m[3]); if (a && b && a !== b) return { kind: 'bot', bot: 'fx-' + a + '-to-' + b, input: String(num(m[1])), say: num(m[1]) + ' ' + a.toUpperCase() + ' = ' }; }
  // number bases: "255 in binary", "convert 1010 from binary to decimal"
  if ((m = t.match(/^(?:convert |what is |what's )?(\d{1,15}) (?:in|to|into) (binary|bin|octal|oct|hex|hexadecimal|base 2|base 8|base 16|base 36)$/))) return { kind: 'bot', bot: 'base10-to-base' + BASES[m[2]], input: m[1], say: m[1] + ' in ' + m[2] + ' = ' };
  if ((m = t.match(/^(?:convert )?([0-9a-f]{1,15}) from (binary|octal|hex|hexadecimal|decimal) (?:to|into) (binary|octal|hex|hexadecimal|decimal)$/)) && BASES[m[2]] !== BASES[m[3]] && [...m[1]].every((c) => parseInt(c, 36) < BASES[m[2]])) return { kind: 'bot', bot: 'base' + BASES[m[2]] + '-to-base' + BASES[m[3]], input: m[1], say: m[1] + ' (' + m[2] + ') in ' + m[3] + ' = ' };
  // the kit's single-job bots
  if ((m = t.match(/^is (\d{1,12}) (?:a )?prime(?: number)?$/))) return { kind: 'bot', bot: 'prime-checker', input: m[1], say: '' };
  if ((m = t.match(/^(?:what is |write |convert )?(\d{1,4}) (?:in|to|into|as) roman numerals?$/)) && +m[1] >= 1 && +m[1] <= 3999) return { kind: 'bot', bot: 'roman-numerals', input: m[1], say: m[1] + ' in Roman numerals: ' };
  if ((m = t.match(new RegExp('^what percent(?:age)? (?:of ' + NUM + ' is ' + NUM + '|is ' + NUM + ' of ' + NUM + ')$')))) { const [x, y] = m[1] != null ? [m[2], m[1]] : [m[3], m[4]]; if (num(y) !== 0) return { kind: 'bot', bot: 'percent-bot', input: num(x) + ' of ' + num(y), say: num(x) + ' is ', tail: ' of ' + num(y) }; }
  if ((m = t.match(/^(?:what (?:does|is) )?(?:an? )?(?:http )?(?:status )?(?:code )?(\d{3})(?: http)?(?: status)?(?: code)?(?: error)?(?: mean)?$/)) && /\b(?:http|status)\b/.test(t)) return { kind: 'bot', bot: 'status-code', input: m[1], say: 'HTTP ' + m[1] + ': ', unless: 'unknown code' };
  if ((m = t.match(/^(?:convert |what (?:date|time) is )?(?:unix |epoch )?(?:time ?stamp|timestamp|epoch|unix time) (\d{9,11})(?: to (?:a )?(?:date|utc))?$/))) return { kind: 'bot', bot: 'unix-time', input: m[1], say: 'Unix time ' + m[1] + ' is ' };
  if ((m = t.match(/^(?:how many )?days (?:between|from) (\d{4}-\d\d-\d\d) (?:and|to|until) (\d{4}-\d\d-\d\d)$/))) return { kind: 'bot', bot: 'days-between', input: m[1] + ' to ' + m[2], say: 'From ' + m[1] + ' to ' + m[2] + ': ' };
  if ((m = t.match(/^is (\d{4}-\d\d-\d\d) (?:a )?(?:public |bank )?holiday(?: in| for) ([a-z][a-z .'-]{1,40})$/))) { const code = holidayCode(m[2]); if (code) return { kind: 'bot', bot: 'holiday-' + code, input: m[1], say: m[1] + ' in ' + code.toUpperCase() + ': ' }; }
  if ((m = a.match(/^base64(?: encode)? ["“]?(.{1,100}?)["”]?$/i)) && !/^decode\b/i.test(m[1])) return { kind: 'bot', bot: 'base64-bot', input: m[1], say: 'Base64 of "' + m[1] + '": ' };
  if ((m = t.match(/^(?:convert )?(#[0-9a-f]{6}|#[0-9a-f]{3}) (?:to|in|as) rgb$/))) return { kind: 'bot', bot: 'hex-color', input: m[1], say: m[1] + ' = ' };
  // the bots absorbed from the owner's other repositories and the first site's drafts (bots/salvaged.js): each answers one narrow ask
  if ((m = a.match(/^(?:check|vet) (?:this |my |a )?glassbox claim:? (.{3,})$/i))) return { kind: 'bot', bot: 'glassbox-claim', input: m[1], say: 'Glassbox claim: ' };
  if ((m = a.match(/^(?:check|promote) (?:this |my |the |a )?glassbox batch:? (\{.*\})$/i))) return { kind: 'bot', bot: 'glassbox-promote', input: m[1], say: 'Glassbox batch: ' };
  if ((m = a.match(/^(?:what is |what's )?(?:the )?(?:wix |velo |wix velo )(?:http )?(?:endpoint|url|route|path) (?:for|of) ((?:get|post|put|delete|options|use)_[\w$]+)$/i))) return { kind: 'bot', bot: 'velo-endpoint', input: m[1], say: '' };
  if ((m = a.match(/^check (?:this |my |the )?(?:external )?link(?: tag)?:? (<a\s[\s\S]*<\/a>)$/i))) return { kind: 'bot', bot: 'external-link-check', input: m[1], say: 'Link: ' };
  if ((m = a.match(/^check (?:this |my |the )?breadcrumbs?(?: trail)?:? (.+\s>\s.+)$/i))) return { kind: 'bot', bot: 'breadcrumb-check', input: m[1], say: 'Breadcrumbs: ' };
  if ((m = a.match(/^check (?:this |my |the )?canonical(?: url| link| tag)?(?: for)?:? (https?:\/\/\S+) (?:(?:->|→|is|=) )?(\S+)$/i))) return { kind: 'bot', bot: 'canonical-check', input: m[1] + ' ' + m[2], say: 'Canonical: ' };
  if ((m = a.match(/^copy receipt (?:for |of )?:? ?(.{1,120})$/i))) return { kind: 'bot', bot: 'copy-receipt', input: m[1], say: 'Copy receipt: ' };
  if ((m = a.match(/^(?:voice plan|match (?:this |my )?(?:voice )?transcript)(?: for)?:? (.{3,})$/i))) return { kind: 'bot', bot: 'voice-plan', input: m[1], say: 'Voice plan: ' };
  if ((m = a.match(/^check (?:this |my |the )?run graph:? (nodes?\s*:.+)$/i))) return { kind: 'bot', bot: 'run-graph-check', input: m[1], say: 'Run graph: ' };
  if ((m = t.match(/^(?:are |is )?(\d{1,2}:\d\d|\d{1,4}) and (\d{1,2}:\d\d|\d{1,4}) (?:in )?(?:the )?same (?:time )?bin(?: at (\d{1,2})(?: ?min(?:utes?)?)?)?$/))) return { kind: 'bot', bot: 'same-bin', input: m[1] + ' ' + m[2] + (m[3] ? ' at ' + m[3] : ''), say: m[1] + ' and ' + m[2] + ': ' };
  if ((m = a.match(/^(?:recall gap|compare (?:these |two |my )?recalls?):? ([^|]+\|[^|]+)$/i))) return { kind: 'bot', bot: 'recall-gap', input: m[1], say: 'Recall gap: ' };
  if ((m = a.match(/^check (?:this |my |an? )?answer block:? (.+\|.+\|.+)$/i))) return { kind: 'bot', bot: 'answer-block-check', input: m[1], say: 'Answer block: ' };
  if ((m = a.match(/^replay (?:this |my |the |a )?run:? (.{3,})$/i))) return { kind: 'bot', bot: 'run-replay', input: m[1], say: 'Run replay: ' };
  // research: a scholarly ask goes to OpenAlex, the open catalog of papers (keyless, resources/free.json 'openalex')
  if ((m = a.match(/^(?:find |list |search for |search )?(?:some |the )?(?:recent |latest |top |key )?(?:research |scientific |academic |scholarly )?(?:papers|studies|research|articles|journal articles|publications|literature) (?:on|about|regarding|into|for) (.{3,100})$/i))) return { kind: 'api', api: 'search', ids: RESEARCH, query: m[1].trim(), why: 'research ask' };
  return { kind: 'llm', why: 'default' };
}

// the live gate: a bot answers only when its own probe (kit) or every check (families) passes here, memoized per isolate
let FAM = null; const LIVE = new Map();
function liveBot(id) {
  if (LIVE.has(id)) return LIVE.get(id);
  let bot = BOT(id), ok = false;
  if (bot) ok = probe(bot).ok;
  else { if (!FAM) FAM = new Map(families().map((b) => [b.id, b])); bot = FAM.get(id); ok = !!bot && check(bot).ok; }
  const out = ok ? bot : null; LIVE.set(id, out); return out;
}
export const botCount = () => BOTS.length + (FAM ? FAM.size : families().length);

/** run the bot a plan names: { answer, bot } or null (no such bot, its gate failed, it threw, or it gave nothing useful). Pure. */
export function runBot(plan) {
  const bot = plan && plan.kind === 'bot' ? liveBot(plan.bot) : null; if (!bot) return null;
  let out; try { out = String(bot.run(plan.input)); } catch (_) { return null; }
  if (!out || /NaN|undefined|Infinity|Invalid Date/.test(out) || (plan.unless && out === plan.unless)) return null;
  return { answer: (plan.say || '') + out + (plan.tail || ''), bot: { id: bot.id, job: bot.job, from: bot.from || [], family: bot.family || null } };
}

// OpenAlex (https://docs.openalex.org): /works?search= with only the fields the card shows; an error status the router counts as quota or error
const UA = { 'user-agent': 'Verse (a-to-mind.com; https://a-to-mind.com/free/)', accept: 'application/json' };
const openalex = async (job, r, env) => {
  const keyName = String((r && r.access) || '').split(':')[1], key = keyName && env ? env[keyName] : '';
  const u = 'https://api.openalex.org/works?per-page=5&select=id,display_name,publication_year,doi,cited_by_count,authorships&search=' + encodeURIComponent(job.query) + (key ? '&api_key=' + encodeURIComponent(key) : '');
  const res = await fetch(u, { headers: UA, signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
  if (!res.ok) { const e = new Error('openalex ' + res.status); e.status = res.status; throw e; }
  const works = ((await res.json()).results || []).filter((w) => w && w.display_name).slice(0, 5);
  if (!works.length) throw new Error('openalex: nothing found');
  return works;
};
// Crossref (https://api.crossref.org): /works?query= mapped to the same shape OpenAlex gives, so one answer writer serves both
const crossref = async (job) => {
  const u = 'https://api.crossref.org/works?rows=5&select=DOI,title,issued,author,is-referenced-by-count&query=' + encodeURIComponent(job.query);
  const res = await fetch(u, { headers: UA, signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
  if (!res.ok) { const e = new Error('crossref ' + res.status); e.status = res.status; throw e; }
  const items = (((await res.json()).message || {}).items || []).filter((w) => w && w.title && w.title[0] && w.DOI).slice(0, 5);
  if (!items.length) throw new Error('crossref: nothing found');
  return items.map((w) => ({ id: 'https://doi.org/' + w.DOI, doi: 'https://doi.org/' + w.DOI, display_name: w.title[0], publication_year: w.issued && w.issued['date-parts'] && w.issued['date-parts'][0] && w.issued['date-parts'][0][0] || null,
    cited_by_count: w['is-referenced-by-count'] || 0, authorships: (w.author || []).map((a) => ({ author: { display_name: [a.given, a.family].filter(Boolean).join(' ') || a.name || '' } })) }));
};
export const ADAPTERS = { 'openalex-key': openalex, openalex, crossref };
const CATALOG = { 'openalex-key': 'OpenAlex (the open catalog of scholarly works)', openalex: 'OpenAlex (the open catalog of scholarly works)', crossref: 'Crossref (the open registry of scholarly DOIs)' };
export function openalexAnswer(query, works, from = 'openalex') {
  const lines = works.map((w, i) => {
    const au = (w.authorships || []).map((x) => x && x.author && x.author.display_name).filter(Boolean);
    return (i + 1) + '. ' + String(w.display_name).replace(/<[^>]+>/g, '') + (w.publication_year ? ' (' + w.publication_year + ')' : '') + (au.length ? ', ' + au[0] + (au.length > 1 ? ' et al.' : '') : '') + (w.cited_by_count ? ', cited ' + w.cited_by_count + ' times' : '') + ' [' + (i + 1) + ']';
  });
  const sources = works.map((w) => ({ title: String(w.display_name).replace(/<[^>]+>/g, '').slice(0, 200), url: /^https:\/\/doi\.org\//.test(String(w.doi || '')) ? w.doi : String(w.id || '').replace(/^https:\/\/openalex\.org\//, 'https://openalex.org/') }));
  return { answer: 'Papers on ' + query + ', from ' + (CATALOG[from] || CATALOG.openalex) + ':\n' + lines.join('\n'), sources };
}

/** load resources/free.json the way functions/api/free.js does (the deploy's own asset); null when it can't be read */
export async function loadRegistry(env, origin) {
  try { const r = env && env.ASSETS ? await env.ASSETS.fetch(new Request(new URL('/resources/free.json', origin))) : null; return r && r.ok ? await r.json() : null; } catch (_) { return null; }
}
const only = (registry, ids) => ({ ...registry, resources: ids.map((id) => ((registry && registry.resources) || []).find((r) => r.id === id)).filter(Boolean) });

/** route an ask to a bot or a free public API; null = the default model takes it (as before). */
export async function routeFree(ask, { env = {}, registry = null, adapters = ADAPTERS, now = Date.now() } = {}) {
  const plan = planOf(ask);
  if (plan.kind === 'bot') {
    const b = runBot(plan);
    return b ? { answer: b.answer, sources: [], source: 'bot:' + b.bot.id, route: 'bot', bot: b.bot, at: new Date(now).toISOString() } : null;
  }
  if (plan.kind === 'api' && registry) {
    const out = await runJob(only(registry, plan.ids), plan.api, { query: plan.query }, { env, adapters, now });
    if (out.ok && ADAPTERS[out.id]) { const o = openalexAnswer(plan.query, out.result, out.id); return { ...o, source: 'free:' + out.id, route: 'api', tried: out.tried, at: new Date(now).toISOString() }; }
    return null; // the API was out, failed or found nothing: the model answers, as for any other ask
  }
  return null;
}

// the other free LLM tiers (resources/free.json, kind 'llm', each only once Atom has added its one key). OpenAI-compatible chat endpoints.
// Gemini's free tier may train on prompts, so visitor asks never go there (its registry note); Workers AI is answer.js's own direct call.
export const LLM_ENDPOINTS = {
  'groq-free': { url: 'https://api.groq.com/openai/v1/chat/completions', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  'cerebras-free': { url: 'https://api.cerebras.ai/v1/chat/completions', key: 'CEREBRAS_API_KEY', model: 'llama-3.3-70b' },
  'openrouter-free': { url: 'https://openrouter.ai/api/v1/chat/completions', key: 'OPENROUTER_API_KEY', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  'mistral-free': { url: 'https://api.mistral.ai/v1/chat/completions', key: 'MISTRAL_API_KEY', model: 'mistral-small-latest' },
  'github-models': { url: 'https://models.github.ai/inference/chat/completions', key: 'GITHUB_MODELS_TOKEN', model: 'openai/gpt-4.1-mini' },
};
export function llmAdapters() {
  const out = {};
  for (const [id, ep] of Object.entries(LLM_ENDPOINTS)) out[id] = async (job, r, env) => {
    const res = await fetch(ep.url, { method: 'POST', headers: { authorization: 'Bearer ' + env[ep.key], 'content-type': 'application/json' }, body: JSON.stringify({ model: ep.model, messages: job.messages, max_tokens: 1500 }), signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
    if (!res.ok) { const e = new Error(id + ' ' + res.status); e.status = res.status; throw e; }
    const j = await res.json(); const text = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
    if (!text) throw new Error(id + ': empty');
    return text;
  };
  return out;
}
/** the free LLM failover after Workers AI's own model fails: null when no other free tier is set up or all are out */
export async function freeLlm(messages, { env = {}, registry = null, adapters = null, now = Date.now() } = {}) {
  if (!registry) return null;
  const ids = Object.keys(LLM_ENDPOINTS);
  const out = await runJob(only(registry, ids), 'llm', { messages }, { env, adapters: adapters || llmAdapters(), now });
  return out.ok ? { answer: out.result, source: 'free:' + out.id, tried: out.tried } : null;
}
