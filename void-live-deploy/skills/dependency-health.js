/**
 * dependency-health skill - "dependency health", "how healthy are your dependencies", "are the shared files stable": the dependency map
 * (skills/deps.json, tools/deps.mjs) held against two stability requirements, per shared file that many skills depend on. Asked by Verse
 * (its reflection of 2026-10-18): "Create a 'dependency-health' skill that compares the current deps.json against stability requirements."
 * The requirements are written on the card and checked from evidence only:
 *   1. a lib file that HEAVY or more skills depend on has a test file that imports it (deps.json `tests`, counted from the tests' import lines);
 *   2. at least half of those skills are rated checked or proven (skills/families.json).
 * A file that meets both is steady; one that does not says which it misses. Static imports only, as the map. One accent (--d-key).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export const DEPS_URL = '/skills/deps.json', FAMILIES_URL = '/skills/families.json';
export const HEAVY = 8;       // a lib file this many skills depend on is "heavily used": the requirements apply to it
export const SOUND_SHARE = 0.5; // at least this share of its dependent skills rated checked or proven

const norm = (t) => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
const ASK = /^(?:(?:show|give|open|run|do)(?:\s+me)?\s+|check\s+)?(?:(?:the|your|my|(?:verse|v01d)'?s)\s+)?(?:code\s+|import\s+)?dependency\s+health(?:\s+(?:check|report|card))?$|^(?:how\s+(?:healthy|stable|sound)\s+are|are)\s+(?:the\s+|your\s+|verse'?s\s+)?(?:code\s+)?(?:dependencies|dependency\s+(?:files|libs|libraries)|shared\s+(?:files|code|libs))(?:\s+(?:healthy|stable|sound|steady))?$|^is\s+(?:the\s+|your\s+)?shared\s+code\s+(?:healthy|stable|sound)$/;
/** true for an ask for the dependency-health card. Pure. */
export const parseAsk = (t) => ASK.test(norm(t));

const isSkillFile = (p) => /^skills\/[^/]+\.js$/.test(p);
const skillName = (p) => p.replace(/^skills\//, '').replace(/\.js$/, '');
const tierMap = (fam) => { const m = {}; for (const f of (fam && fam.families) || []) for (const s of f.skills || []) m[s.name] = s.tier; return m; };

/** each heavily used lib file judged against the two requirements: { rows, heavy, steady, files } from the map and the families. Pure.
 *  rows: [{ file, skills, tests, sound, rated, share, needsTest, weak, steady }] worst first (a missing test, then a weak share, then the most skills). */
export function healthOf(deps, fam, heavy = HEAVY) {
  const libs = ((deps && Array.isArray(deps.libs) && deps.libs) || []).filter((l) => l && l.file && Number(l.skills) >= heavy);
  const tier = tierMap(fam), files = (deps && deps.files) || {};
  const rows = libs.map((l) => {
    const f = files[l.file] || {}, dep = [...(f.importedBy || []), ...(f.reachedBy || [])].filter(isSkillFile);
    const rated = dep.filter((p) => tier[skillName(p)]).length, sound = dep.filter((p) => /^(?:checked|proven)$/.test(tier[skillName(p)] || '')).length;
    const total = dep.length || Number(l.skills) || 0, share = total ? sound / total : 0;
    const needsTest = !(Number(l.tests) > 0), weak = share < SOUND_SHARE;
    return { file: l.file, skills: Number(l.skills) || 0, tests: Number(l.tests) || 0, sound, rated, total, share, needsTest, weak, steady: !needsTest && !weak };
  });
  rows.sort((a, b) => (b.needsTest - a.needsTest) || (b.weak - a.weak) || (b.skills - a.skills) || (a.file < b.file ? -1 : 1));
  return { rows, heavy: rows.length, steady: rows.filter((r) => r.steady).length, files: Number(deps && deps.counted) || Object.keys(files).length };
}

const pctOf = (x) => Math.round(x * 100);
/** the card's body: the verdict, the requirements, and one row per heavily used lib file. Pure. */
export function cardHtml(esc, deps, fam) {
  const H = healthOf(deps, fam);
  if (!H.heavy) return '<p>The dependency map could not be read just now, or no shared file has ' + HEAVY + ' skills depending on it. Ask again in a moment.</p>';
  const open = H.heavy - H.steady;
  return '<div class="dh-verdict sub" style="font-size:13px;margin:2px 0 8px"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + H.steady + ' of ' + H.heavy + '</b> shared files that ' + HEAVY + ' or more skills depend on meet both requirements'
    + (open ? '; ' + open + ' ' + (open === 1 ? 'does' : 'do') + ' not.' : '.') + '</div>'
    + '<ol class="dh-req sub" style="font-size:12px;line-height:1.5;margin:0 0 10px;padding-left:18px"><li>A file ' + HEAVY + ' or more skills depend on has a test file that imports it.</li><li>At least half of the skills that depend on it are rated checked or proven.</li></ol>'
    + '<div class="dh-rows">' + H.rows.map((r) => '<div class="dh-row" data-file="' + esc(r.file) + '" data-steady="' + (r.steady ? 'yes' : 'no') + '" style="padding:8px 0;border-top:1px solid rgba(255,255,255,.08)">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(r.file) + '</b>'
      + '<span class="dh-verdict-word" style="font-size:12px;white-space:nowrap;color:' + (r.steady ? 'var(--d-ok,#7fe3a8)' : 'var(--d-key,#ffc36b)') + '">' + (r.steady ? 'steady' : r.needsTest && r.weak ? 'needs a test, dependants weakly checked' : r.needsTest ? 'needs a test' : 'dependants weakly checked') + '</span></div>'
      + '<div class="sub" style="font-size:12px;font-variant-numeric:tabular-nums;margin-top:2px">' + r.skills + ' skills depend on it · ' + r.tests + ' test file' + (r.tests === 1 ? '' : 's') + ' import' + (r.tests === 1 ? 's' : '') + ' it · ' + r.sound + ' of ' + r.total + ' of them checked or proven (' + pctOf(r.share) + '%)</div></div>').join('') + '</div>'
    + '<div class="sub" style="font-size:12px;line-height:1.5;margin-top:10px">Ask "what depends on lib/where.js" for the skills behind one file. Static imports only: a path built at run time is not in the map.</div>'
    + '<div class="src">Source: skills/deps.json (tools/deps.mjs) and skills/families.json (tools/families.mjs)</div>';
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const head = '<h2>How steady are the shared files?</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">reading the map…</div>'; }); // void-review: ok (head is a constant heading; nothing from a user)
  const get = async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const [deps, fam] = await Promise.all([get(DEPS_URL), get(FAMILIES_URL)]);
  if (!el || (_pageStill && !_pageStill(el))) return 'dependency-health';
  el.innerHTML = head + cardHtml(esc, deps, fam);
  return 'dependency-health';
}

// checked by tools/skills-check.mjs on every run: the asks it takes and the verdicts on a made-up map
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const skillsOf = (n) => Array.from({ length: n }, (_, i) => 'skills/s' + i + '.js');
  const deps = { counted: 9, libs: [{ file: 'lib/a.js', skills: 8, direct: 8, dependants: 8, tests: 2 }, { file: 'lib/b.js', skills: 9, direct: 9, dependants: 9, tests: 0 }, { file: 'lib/c.js', skills: 2, direct: 2, dependants: 2, tests: 0 }],
    files: { 'lib/a.js': { imports: [], importedBy: skillsOf(8) }, 'lib/b.js': { imports: [], importedBy: skillsOf(9) }, 'lib/c.js': { imports: [], importedBy: skillsOf(2) } } };
  const fam = { families: [{ skills: skillsOf(9).map((p, i) => ({ name: skillName(p), tier: i < 5 ? 'proven' : 'experiment' })) }] };
  const H = healthOf(deps, fam), h = cardHtml(esc, deps, fam);
  const ok = ['dependency health', 'Show me the dependency health?', 'how healthy are your dependencies', 'are the shared files stable', 'check the dependency health', 'dependency health report', 'is your shared code healthy'].every(parseAsk)
    && ['dependency map', 'dependency injection', 'npm dependency health', 'health of my plants', 'what depends on lib/a.js', 'dependencies', 'are you healthy'].every((t) => !parseAsk(t))
    && H.heavy === 2 && H.steady === 1 && H.rows[0].file === 'lib/b.js' && H.rows[0].needsTest && !H.rows[0].weak && H.rows[1].file === 'lib/a.js' && H.rows[1].steady && H.rows[1].sound === 5 && H.rows[1].total === 8
    && h.includes('1 of 2') && h.includes('data-steady="no"') && h.includes('needs a test') && !h.includes('lib/c.js') && cardHtml(esc, null, null).includes('could not be read') && !cardHtml(esc, { libs: [{ file: '<b>', skills: 9, tests: 1 }], files: {} }, fam).includes('<b>');
  return { ok, got: ok ? '' : JSON.stringify({ H: H.rows, parse: parseAsk('dependency health') }) };
}

export default {
  name: 'dependency-health',
  examples: ['dependency health', 'show me the dependency health', 'how healthy are your dependencies', 'are the shared files stable', 'check the dependency health', 'dependency health report', 'is your shared code healthy'],
  nearMisses: ['dependency map', 'dependency injection', 'npm dependency health', 'health of my plants', 'what depends on lib/where.js', 'dependencies'],
  suite,
  match(lower, text) { return parseAsk(text || lower); },
  run,
};
