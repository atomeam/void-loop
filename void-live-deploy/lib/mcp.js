// mcp — Verse as an MCP server (frontier #6): the JSON-RPC half of functions/api/mcp.js, pure and tested in node
// (tools/mcp.test.mjs). An MCP client POSTs one JSON-RPC message to /api/mcp (the streamable HTTP transport, answered with plain
// JSON, no stream) and lists and calls Verse's tools. Every tool is read-only: it computes from what it is given and from Verse's own
// tables and reaches no other service, except ask_void, which is /api/answer itself (the route hands it over, ctx.answer: the open
// web and the model, on that endpoint's terms and limits). One, review_code_closer, is /api/review itself (the route hands it over, ctx.review): the
// closer read by a model comes only with the key that endpoint takes, on its terms, and the only thing written is that key's daily
// count. /tools.json is the same list, public. The skill tools (asked by Verse, 2026-10-15) are Verse's most proven read-only (up to ten)
// skills, generated from the ratings (tools/mcp-skills.mjs -> lib/mcp-skills.js): each is ask_void's own path with the skill's
// name on it and the link where the skill itself runs. skill_health reads skills/families.json (the route lends it, ctx.families).
import { quick } from './review-api.js';
import { jde, moonPhase } from './sky-math.js';
import { activeShowers, nextShower } from './showers.js';
import { SKILL_TOOLS } from './mcp-skills.js';
import { drive } from './drive.js';
import { auditPage } from './seo-audit.js';
import { readingLevel, proofread } from './writing-aids.js';
import { parse as parseColour, contrast as contrastOf, passes, toHex } from './colour.js';

export const PROTOCOL = '2025-06-18';
export const SERVER = { name: 'void', title: 'Verse (a-to-mind.com)', version: '1.2.0' };
// Verse's MCP Server Card (SEP-2127, Final; schema v1): the static card at the reserved place beside the endpoint,
// /api/mcp/server-card (functions/api/mcp/server-card.js). Identity matches server.json (the registry entry) and the
// endpoint is the one initialize answers on, with the protocol version it speaks; no tools are listed (the card format
// leaves them to tools/list). Pure.
export const CARD_SCHEMA = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
export function serverCard(origin = 'https://a-to-mind.com') {
  return {
    $schema: CARD_SCHEMA,
    name: 'io.github.atomeam/void',
    version: SERVER.version,
    title: SERVER.title,
    description: 'Ask Verse anything with sources, plus code review, SEO audit, readability, contrast and sky facts.',
    websiteUrl: origin,
    repository: { url: 'https://github.com/atomeam/void-loop', source: 'github' },
    icons: [{ src: origin + '/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] }],
    remotes: [{ type: 'streamable-http', url: origin + '/api/mcp', supportedProtocolVersions: [PROTOCOL] }],
  };
}
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
// what shape an agent wants back (asked by Verse, ask-20261014-1722-1): 'text' (default: the words, sources listed) or 'raw_data'
// (the structured result as JSON text). 'image' is named so an agent learns it is not offered yet, rather than guessing.
const RESPONSE_TYPE = { type: 'string', enum: ['text', 'raw_data', 'image'], description: "What to get back: 'text' (default) or 'raw_data' (the structured result as JSON). 'image' is not offered yet." };
export function shaped(result, type) {
  if (!result || result.isError || !type || type === 'text') return result;
  if (type === 'raw_data') return { ...result, content: [{ type: 'text', text: JSON.stringify(result.structuredContent || {}) }] };
  return { content: [{ type: 'text', text: "This tool gives 'text' or 'raw_data'; 'image' is not offered yet." }], isError: true };
}
const DATE = { type: 'string', description: 'An ISO date or date-time (UTC). Leave it out for now.' };
const SITE = 'https://a-to-mind.com';
const ASKS = { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }; // a model and the open web answer
// one of Verse's most proven skills as its own tool: the definition is built from lib/mcp-skills.js, never written by hand
const skillTool = (s) => ({ name: s.tool, title: "Verse's " + s.skill + ' skill', annotations: ASKS,
  description: "Ask Verse's \"" + s.skill + "\" skill (" + s.familyName + "), one of the proven skills with the most evidence that Verse offers over MCP (read-only): rated proven on a-to-mind.com from evidence (real asks in Verse's benchmark, its tests), never from how it describes itself. Asks like "
    + s.examples.map((e) => '"' + e + '"').join(', ') + ". Over MCP it is answered the way ask_void is: Verse's answer engine (a model, citing Wikipedia when it matches; up to 12 a minute per caller). The skill itself works it out on its own card at the \"open\" link in the result.",
  inputSchema: { type: 'object', required: ['ask'], properties: { ask: { type: 'string', description: 'The ask in plain words (3 to 600 characters)' + (s.examples[0] ? ', e.g. "' + s.examples[0] + '"' : '') + '.' }, response_type: RESPONSE_TYPE } } });

export const TOOLS = [
  { name: 'ask_void', title: 'Ask Verse anything', annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    description: "Ask Verse a question in plain words and get its answer: a short, direct answer from Verse's answer engine (a-to-mind.com), citing the Wikipedia pages it drew on when they match. Ask about Verse itself (\"what are you building?\") and it answers from its own live facts. Up to 12 model answers a minute per caller; a repeated question may come from the 7-day cache.",
    inputSchema: { type: 'object', required: ['ask'], properties: { ask: { type: 'string', description: 'The question, in plain words (3 to 600 characters).' }, response_type: RESPONSE_TYPE } } },
  { name: 'review_code', title: 'Review code (instant checks)', annotations: RO,
    description: "Verse's instant code review: pattern checks for bugs, risks and style in pasted code or a diff's added lines, in many languages. The same checks a-to-mind.com runs when someone asks Verse to review code. No model; the closer read is not included. Its structured result says basis 'patterns' and confidence 'low'.",
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The code to review (up to 60,000 characters).' }, diff: { type: 'string', description: 'A unified diff instead of code: only the added lines are reviewed, with their line numbers in the new file.' }, lang: { type: 'string', description: 'The language, if known (javascript, python, go, rust, sql, ...).' } } } },
  { name: 'review_code_closer', title: 'Review code (with the closer read)', annotations: { ...RO, idempotentHint: false },
    description: "Verse's code review with the closer read: the instant checks, then an AI reviewer that confirms real findings, drops wrong ones and adds what the patterns missed, each quoting its line. The closer read needs a key in the MCP request's Authorization header (Bearer: a MultiVerse review key vr1.… or a Verse Code Review Pro license key; https://a-to-mind.com/code-review/#pro). Without one you get the instant checks and how to get it. The structured result says what it rests on: basis 'closer_read' (confidence 'reviewed') only when the closer read came back, else 'patterns' (confidence 'low').",
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The code to review (up to 60,000 characters).' }, diff: { type: 'string', description: 'A unified diff instead of code: the added lines are reviewed.' }, lang: { type: 'string', description: 'The language, if known.' } } } },
  { name: 'moon_phase', title: "The moon's phase", annotations: RO,
    description: "The moon's illuminated fraction, whether it is waxing or waning, and the phase's name for a moment, from Meeus' formulas (Astronomical Algorithms, ch. 47-48).",
    inputSchema: { type: 'object', properties: { date: DATE } } },
  { name: 'meteor_showers', title: 'Meteor showers', annotations: RO,
    description: 'The meteor showers active on a date (strongest first, with days to each peak and the peak rate) and the next peak on or after it, from the IMO calendar of the major showers.',
    inputSchema: { type: 'object', properties: { date: DATE } } },
  { name: 'drive_time', title: 'Drive time between two places', annotations: { ...RO, idempotentHint: false, openWorldHint: true },
    description: "How long the drive is between two places, and how far, from a live routing service (the public OSRM router, no key; road network at free-flow speed, so no live traffic). Places by name (looked up with Open-Meteo's geocoder) or as \"lat,lon\". Verse's rides family checks this same router once a day.",
    inputSchema: { type: 'object', required: ['from', 'to'], properties: { from: { type: 'string', description: 'Where from: a place name ("San Francisco") or "lat,lon".' }, to: { type: 'string', description: 'Where to: a place name or "lat,lon".' } } } },
  ...SKILL_TOOLS.map(skillTool),
  // Verse's own tools, the ones it runs on its own pages (owner, 2026-10-26: "Verse uses its own tools"): pure, computed from what is given
  { name: 'seo_audit', title: 'SEO audit of a page', annotations: RO,
    description: "Verse's SEO audit of one page's HTML, the same one it runs over every page of a-to-mind.com before it ships (tools/seo-audit.mjs): the title and meta description (there, and cut short in a result or not), the canonical link (there and pointing at the page), JSON-LD that parses, one h1, the html lang, the share card (og:title, og:image), the internal links it makes, and how hard the description is to read (Flesch-Kincaid grade). Give the page's own path so the canonical can be checked. Links are listed, not fetched.",
    inputSchema: { type: 'object', required: ['html'], properties: { html: { type: 'string', description: 'The page HTML (up to 500,000 characters).' }, path: { type: 'string', description: "The page's path on its site, like /pricing/ (default /)." }, response_type: RESPONSE_TYPE } } },
  { name: 'readability', title: 'How easy a text is to read', annotations: RO,
    description: "How easy a text is to read, from the readability tool on a-to-mind.com/word-count/ that Verse also runs on its own page descriptions: the Flesch reading ease and Flesch-Kincaid grade with who reads it comfortably, the words and sentences counted, and what a proofread would fix (doubled words, extra spaces, common misspellings, sentences without a capital). No model.",
    inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string', description: 'The text (5 words to 100,000 characters).' }, response_type: RESPONSE_TYPE } } },
  { name: 'colour_contrast', title: 'Colour contrast (WCAG)', annotations: RO,
    description: "The WCAG contrast ratio of a text colour on a background colour, and which levels it passes (AA, AA large, AAA, AAA large), from a-to-mind.com/color/. Colours as hex (#6d4aff), rgb(), hsl() or a CSS name.",
    inputSchema: { type: 'object', required: ['text', 'background'], properties: { text: { type: 'string', description: 'The text colour.' }, background: { type: 'string', description: 'The background colour.' } } } },
  { name: 'skill_health', title: "Verse's skill-family health", annotations: RO,
    description: "How far each of Verse's skills is checked, family by family (a-to-mind.com/skills/families.json). Every skill is rated from evidence only, never from how it describes itself: experiment (nothing checks it), tested, checked or proven (its own tests, the browser suite, real asks in Verse's benchmark). Gives the totals, each family's counts and share proven, the skills failing a benchmark ask, and which skills have their own tool here. Name a family to get each of its skills with its rating and why.",
    inputSchema: { type: 'object', properties: { family: { type: 'string', description: "A family's id (families[].id in this tool's result, e.g. numbers) for its skills one by one." }, response_type: RESPONSE_TYPE } } },
  { name: 'skill_discovery', title: "Discover Verse's skills by family", annotations: RO,
    description: "Skill Discovery (asked by Verse): what skills Verse has and how they are spread across its families, for an agent that wants to know where to look before it asks. Gives each family's id, name, what it is for, how many skills it holds, its share of all of Verse's skills (the distribution), and the skills in it by name with their rating; ask for one family, or only the skills at a rating. Read from a-to-mind.com/skills/families.json, rated from evidence only. Ask a skill by name through ask_void or the skill's own tool.",
    inputSchema: { type: 'object', properties: { family: { type: 'string', description: "Only this family (an id from the result, e.g. numbers)." }, tier: { type: 'string', enum: ['experiment', 'tested', 'checked', 'proven'], description: 'Only skills rated at least this high.' }, response_type: RESPONSE_TYPE } } },
];

const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const toolResult = (text, data) => ({ content: [{ type: 'text', text }], structuredContent: data, isError: false });
const toolError = (text) => ({ content: [{ type: 'text', text }], isError: true });
function when(a) {
  if (a == null || a === '') return new Date();
  const d = new Date(String(a));
  return Number.isNaN(d.getTime()) ? null : d;
}
// what a review rests on (asked by Verse): pattern checks alone are low confidence; the closer read is only claimed when its answer came back
const BASIS = {
  patterns: { basis: 'patterns', confidence: 'low', line: 'Basis: pattern checks only, no model. A finding can be a false positive, and finding nothing is not proof the code is right.' },
  closer_read: { basis: 'closer_read', confidence: 'reviewed', line: 'Basis: pattern checks, then an AI reviewer read the code. It can still miss things.' },
};
const based = (text, data, read) => { const b = BASIS[read ? 'closer_read' : 'patterns']; return toolResult(text + '\n\n' + b.line, { ...data, basis: b.basis, confidence: b.confidence }); };
const PHASES = [[0.02, 'new moon'], [0.35, 'crescent'], [0.65, 'quarter'], [0.98, 'gibbous'], [1.01, 'full moon']];

// the closer read: /api/review answers (ctx.review hands it { code | diff, lang } with the caller's Authorization), this words it
async function closer(a, ctx) {
  if (typeof a.code !== 'string' && typeof a.diff !== 'string') return toolError('Give the code to review as "code" (or a unified diff as "diff").');
  if (!ctx || typeof ctx.review !== 'function') return toolError('The closer read is only reachable at https://a-to-mind.com/api/mcp.');
  const args = { ...(typeof a.code === 'string' ? { code: a.code } : { diff: a.diff }), ...(typeof a.lang === 'string' ? { lang: a.lang } : {}) };
  const { status, body } = await ctx.review(args);
  if (!body || status !== 200 || body.ok === false) return toolError('The review said no: ' + String((body && body.error) || 'status ' + status).slice(0, 200));
  const { ok: _ok, ...data } = body;
  const found = (data.findings || []).length ? data.findings.map((f) => 'line ' + f.line + ' · ' + f.kind + ' · ' + f.message).join('\n') : 'The instant checks found nothing in ' + data.lines + ' line' + (data.lines === 1 ? '' : 's') + '.';
  const more = data.answer ? '\n\nCloser read:\n' + data.answer : data.note || data.upgrade ? '\n\n' + [data.note, data.upgrade].filter(Boolean).join(' ') : '';
  return based(found + more, data, data.review === 'model' && !!data.answer);
}

// ask_void: /api/answer answers (ctx.answer hands it { ask } with the caller's connection, so its per-caller limit holds), this words it
async function askVoid(a, ctx) {
  const ask = typeof a.ask === 'string' ? a.ask.trim().slice(0, 600) : '';
  if (ask.length < 3) return toolError('Give the question as "ask", in plain words.');
  if (!ctx || typeof ctx.answer !== 'function') return toolError('Asking Verse is only reachable at https://a-to-mind.com/api/mcp.');
  const { status, body } = await ctx.answer({ ask });
  if (status === 429) return toolError('Slow down: Verse answers up to 12 questions a minute per caller. Try again in a minute.');
  if (!body || !body.answer) return toolError('Verse had no answer for that just now' + (body && body.note ? ' (' + String(body.note).slice(0, 160) + ')' : '') + '. Rephrase it, or try again in a moment.');
  const sources = (body.sources || []).map(({ title, url }) => ({ title, url }));
  const text = body.answer + (sources.length ? '\n\nSources:\n' + sources.map((x) => '- ' + x.title + ': ' + x.url).join('\n') : '');
  return toolResult(text, { answer: body.answer, sources, at: body.at || null, cached: !!body.cached });
}

// a skill tool: ask_void's path exactly (same checks, same limit), then the skill's name and the link where the skill itself runs
async function askSkill(s, a, ctx) {
  const r = await askVoid(a, ctx);
  if (r.isError) return r;
  const open = SITE + '/?q=' + encodeURIComponent(a.ask.trim().slice(0, 600));
  return { ...r, content: [{ type: 'text', text: r.content[0].text + '\n\nThe ' + s.skill + ' skill itself: ' + open }], structuredContent: { ...r.structuredContent, skill: s.skill, path: 'answer_engine', open } };
}

const TIERS = ['experiment', 'tested', 'checked', 'proven'];
const pct = (n, of) => (of ? Math.round((n / of) * 1000) / 1000 : 0);
// skill_health: skills/families.json (ctx.families reads it as the site serves it), summed up for an agent. Read-only.
async function health(a, ctx) {
  if (!ctx || typeof ctx.families !== 'function') return toolError('The skill ratings are only reachable at https://a-to-mind.com/api/mcp (or read https://a-to-mind.com/skills/families.json).');
  const data = await ctx.families().catch(() => null);
  if (!data || !Array.isArray(data.families)) return toolError('The skill ratings could not be read just now; try https://a-to-mind.com/skills/families.json.');
  const want = typeof a.family === 'string' ? a.family.trim().toLowerCase() : '';
  if (want && !data.families.some((f) => f.id === want)) return toolError('No family "' + want.slice(0, 40) + '". The families: ' + data.families.map((f) => f.id).join(', ') + '.');
  const totals = Object.fromEntries(TIERS.map((t) => [t, data.families.reduce((n, f) => n + ((f.count && f.count[t]) || 0), 0)]));
  const skills = TIERS.reduce((n, t) => n + totals[t], 0);
  const families = data.families.map((f) => {
    const list = Array.isArray(f.skills) ? f.skills : [], count = Object.fromEntries(TIERS.map((t) => [t, (f.count && f.count[t]) || 0]));
    const out = { id: f.id, name: f.name, for: f.for, skills: list.length, count, proven_share: pct(count.proven, list.length), failing: list.filter((s) => s.failing && s.failing.length).map((s) => s.name) };
    if (f.id === want) out.members = list.map((s) => ({ name: s.name, tier: s.tier, why: s.why, ...(s.failing && s.failing.length ? { failing: s.failing } : {}) }));
    return out;
  });
  const tools = SKILL_TOOLS.map((s) => s.tool);
  const failing = families.flatMap((f) => f.failing);
  const text = skills + ' skills, rated from evidence only: ' + TIERS.slice().reverse().map((t) => totals[t] + ' ' + t).join(', ') + ' (' + Math.round(pct(totals.proven, skills) * 100) + '% proven).\n'
    + families.map((f) => f.name + ': ' + f.count.proven + ' of ' + f.skills + ' proven').join('\n')
    + (failing.length ? '\nFailing a benchmark ask: ' + failing.join(', ') + '.' : '\nNo skill is failing a benchmark ask.')
    + '\nTheir own tools here: ' + tools.join(', ') + '.'
    + (want ? '\n\n' + families.find((f) => f.id === want).members.map((s) => s.name + ': ' + s.tier + ' (' + s.why + ')').join('\n') : '');
  return toolResult(text, { skills, totals, proven_share: pct(totals.proven, skills), families, failing, tools, source: SITE + '/skills/families.json' });
}

// skill_discovery: the same ratings, laid out as a map of the families for finding a skill: counts, each family's share of all skills, member names.
async function discovery(a, ctx) {
  if (!ctx || typeof ctx.families !== 'function') return toolError('The skill families are only reachable at https://a-to-mind.com/api/mcp (or read https://a-to-mind.com/skills/families.json).');
  const data = await ctx.families().catch(() => null);
  if (!data || !Array.isArray(data.families)) return toolError('The skill families could not be read just now; try https://a-to-mind.com/skills/families.json.');
  const want = typeof a.family === 'string' ? a.family.trim().toLowerCase() : '', floor = TIERS.indexOf(a.tier);
  if (a.tier !== undefined && floor < 0) return toolError('tier is one of: ' + TIERS.join(', ') + '.');
  if (want && !data.families.some((f) => f.id === want)) return toolError('No family "' + want.slice(0, 40) + '". The families: ' + data.families.map((f) => f.id).join(', ') + '.');
  const all = data.families.reduce((n, f) => n + (Array.isArray(f.skills) ? f.skills.length : 0), 0);
  const families = data.families.filter((f) => !want || f.id === want).map((f) => {
    const list = Array.isArray(f.skills) ? f.skills : [], shown = list.filter((s) => TIERS.indexOf(s.tier) >= floor);
    return { id: f.id, name: f.name, for: f.for, skills: list.length, share: pct(list.length, all), proven: list.filter((s) => s.tier === 'proven').length, members: shown.map((s) => ({ name: s.name, tier: s.tier })) };
  });
  const text = all + ' skills in ' + data.families.length + ' families' + (floor > 0 ? ' (listing those rated ' + TIERS[floor] + ' or better)' : '') + ':\n'
    + families.map((f) => f.name + ' (' + f.id + '): ' + f.skills + ' skills, ' + Math.round(f.share * 100) + '% of all, ' + f.proven + ' proven' + (f.members.length ? ' \u2014 ' + f.members.map((m) => m.name).join(', ') : '')).join('\n');
  return toolResult(text, { skills: all, family_count: data.families.length, distribution: families.map((f) => ({ id: f.id, skills: f.skills, share: f.share })), families, source: SITE + '/skills/families.json' });
}

const RUN = {
  ask_void: askVoid,
  skill_health: health,
  skill_discovery: discovery,
  ...Object.fromEntries(SKILL_TOOLS.map((s) => [s.tool, (a, ctx) => askSkill(s, a, ctx)])),
  review_code_closer: closer,
  seo_audit(a) {
    if (typeof a.html !== 'string' || !a.html.trim()) return toolError('Give the page as "html".');
    if (a.html.length > 500000) return toolError('That page is over 500,000 characters.');
    const path = typeof a.path === 'string' && a.path.startsWith('/') ? a.path.slice(0, 300) : '/';
    const r = auditPage(a.html, path), out = { path, title: r.title, description: r.description, canonical: r.canonical, h1: r.h1, grade: r.grade, ease: r.ease, defects: r.defects, notes: r.notes, internal_links: r.links.slice(0, 200) };
    const text = (r.defects.length ? r.defects.length + ' problem' + (r.defects.length === 1 ? '' : 's') + ':\n' + r.defects.map((d) => '- ' + d.kind + ': ' + d.message).join('\n') : 'No problems found.')
      + (r.notes.length ? '\nWorth a look: ' + r.notes.map((d) => d.message).join('; ') + '.' : '') + (r.grade != null ? '\nThe description reads at grade ' + r.grade + ' (ease ' + r.ease + ').' : '')
      + '\n' + r.links.length + ' internal link' + (r.links.length === 1 ? '' : 's') + ' (not fetched).';
    return toolResult(text, out);
  },
  readability(a) {
    const t = typeof a.text === 'string' ? a.text.slice(0, 100000) : '';
    const lv = readingLevel(t); if (!lv) return toolError('Give at least 5 words as "text".');
    const issues = proofread(t).fixes;
    return toolResult('Reading ease ' + lv.ease + ' (' + lv.label + ', ' + lv.who + '), grade ' + lv.grade + '; ' + lv.words + ' words in ' + lv.sentences + ' sentence' + (lv.sentences === 1 ? '' : 's') + '.' + (issues.length ? ' To proofread: ' + issues.join(', ') + '.' : ''), { ...lv, proofread: issues });
  },
  colour_contrast(a) {
    const fg = parseColour(a.text), bg = parseColour(a.background);
    if (!fg || !bg) return toolError('Give two colours as "text" and "background" (hex, rgb(), hsl() or a CSS name).');
    const ratio = Math.round(contrastOf(fg, bg) * 100) / 100, p = passes(ratio);
    return toolResult(ratio + ':1 for ' + toHex(fg) + ' on ' + toHex(bg) + ': ' + (p.aa ? 'passes AA' + (p.aaa ? ' and AAA' : '') : p.aaLarge ? 'passes AA for large text only' : 'fails AA') + '.', { text: toHex(fg), background: toHex(bg), ratio, ...p });
  },
  review_code(a) {
    if (typeof a.code !== 'string' && typeof a.diff !== 'string') return toolError('Give the code to review as "code" (or a unified diff as "diff").');
    const r = quick({ code: a.code, diff: a.diff, lang: typeof a.lang === 'string' ? a.lang : undefined });
    const text = r.findings.length ? r.findings.map((f) => 'line ' + f.line + ' · ' + f.kind + ' · ' + f.message).join('\n') : 'The instant checks found nothing in ' + r.lines + ' line' + (r.lines === 1 ? '' : 's') + '.';
    return based(text, { lang: r.lang, lines: r.lines, findings: r.findings }, false);
  },
  moon_phase(a) {
    const d = when(a.date); if (!d) return toolError('That date could not be read; use ISO, like 2026-10-11 or 2026-10-11T21:00:00Z.');
    const p = moonPhase(jde(d)), name = PHASES.find(([x]) => p.fraction < x)[1];
    const phase = name === 'new moon' || name === 'full moon' ? name : (p.waxing ? 'waxing ' : 'waning ') + (name === 'quarter' ? (p.waxing ? 'first quarter' : 'last quarter') : name);
    const out = { date: d.toISOString(), illuminated: Math.round(p.fraction * 1000) / 1000, waxing: p.waxing, phase };
    return toolResult(Math.round(p.fraction * 100) + '% lit, ' + phase + ' (' + out.date + ').', out);
  },
  async drive_time(a, ctx) {
    const r = await drive(a.from, a.to, (ctx && ctx.fetch) || fetch);
    if (!r.ok) return toolError(r.error);
    return toolResult('About ' + r.minutes + ' min by car, ' + r.km + ' km, from ' + (r.from.name || r.from.lat + ',' + r.from.lon) + ' to ' + (r.to.name || r.to.lat + ',' + r.to.lon) + ' (' + r.note + '; ' + r.service + ').', r);
  },
  meteor_showers(a) {
    const d = when(a.date); if (!d) return toolError('That date could not be read; use ISO, like 2026-10-11.');
    const active = activeShowers(d).map(({ name, zhr, daysToPeak, note }) => ({ name, zhr, daysToPeak, note }));
    const n = nextShower(d), next = n && { name: n.name, peak: n.date.toISOString().slice(0, 10), zhr: n.zhr, note: n.note };
    const text = (active.length ? 'Active: ' + active.map((s) => s.name + ' (up to ' + s.zhr + ' an hour, peak ' + (s.daysToPeak === 0 ? 'today' : s.daysToPeak > 0 ? 'in ' + s.daysToPeak + ' days' : Math.abs(s.daysToPeak) + ' days ago') + ')').join(', ') + '. ' : 'No major shower is active. ')
      + (next ? 'Next peak: ' + next.name + ' on ' + next.peak + '.' : '');
    return toolResult(text, { date: d.toISOString().slice(0, 10), active, next });
  },
};

/** one JSON-RPC message in, its reply out (null for a notification, which gets none). ctx: what the route lends a tool (ctx.review) */
export async function rpc(msg, ctx) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid request: one JSON-RPC 2.0 message');
  const { id, method } = msg, params = (msg.params && typeof msg.params === 'object') ? msg.params : {};
  if (id === undefined) return null; // notifications (notifications/initialized, cancelled) need no reply
  if (method === 'initialize') return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: "Verse's read-only tools: ask Verse anything (ask_void, its answer engine), the instant code review, its SEO audit of a page (seo_audit), readability, colour contrast, the closer read (with a key in Authorization), the moon's phase, the meteor showers, a tool for each of its most proven read-only skills (skill_*, answered the way ask_void is), and skill_health (how far each skill is checked). ask_void, the skill tools and the closer read call a model." });
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const fn = Object.prototype.hasOwnProperty.call(RUN, params.name) ? RUN[params.name] : null;
    if (!fn) return err(id, -32602, 'Unknown tool: ' + String(params.name).slice(0, 60));
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
    try { return ok(id, shaped(await fn(args, ctx), args.response_type)); } catch (_) { return ok(id, toolError('The tool failed on that input.')); }
  }
  return err(id, -32601, 'Method not found: ' + method.slice(0, 60));
}
