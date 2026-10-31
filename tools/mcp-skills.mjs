// mcp-skills — which of Verse's skills get their own tool in Verse's MCP server (asked by Verse, 2026-10-15: "Define and implement
// the MCP tool definitions for my top 10 most 'proven' skills to ensure seamless cross-agent invocation"). Generated from data,
// never picked by hand: skills/families.json (the ratings, from evidence only, tools/families.mjs), skills/index.json (what is
// live) and tools/bench.json (the real asks that earned the rating, used as each tool's examples).
// The rule, in order:
//   1. rated proven in families.json, and a live skill (skills/index.json, or a member of a family skill there)
//   2. read-only over MCP: its family answers a question in words (OVER_MCP), and it is not held back (HELD, each with why:
//      live data the answer engine has no feed for, random output that must never come from a shared cache, a thing that only
//      works on the stage, or a dedicated tool already). Nothing that sends, books, spends or touches the owner's data: those
//      families are not in OVER_MCP at all.
//   3. the most evidence first: real asks in the benchmark + browser-suite mentions + 1 for its own self-test (read off the
//      rating's own words), ties by name; up to TOP are kept, listed by name so a swap in rank alone is not drift.
// Each tool runs the skill's own code on the server (lib/mcp-run.js: the same run() the page calls, its card read back as text),
// never a model in its place; lib/mcp.js says so in every description and hands back the link where the skill runs on its card.
//   node tools/mcp-skills.mjs           write void-live-deploy/lib/mcp-skills.js (and the tool names on /code-review/)
//   node tools/mcp-skills.mjs --check   exit 1 if either is out of step with the data (checks.mjs runs this)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'void-live-deploy/lib/mcp-skills.js');
const PAGE = resolve(root, 'void-live-deploy/code-review/index.html');
export const TOP = 10;
// families whose skills answer a question in words. Left out: make, games, stage and time (they put things on the person's
// stage), self (acts on Verse itself or for its owner: actions, automations, memory, store), body (a person's own health dates
// stay in their browser), numbers (its skills work out an exact answer on the page; over MCP the answer engine, a model, would
// answer instead and could get the sum wrong under a "proven" name. They come back when the sums run on the server too)
export const OVER_MCP = ['words', 'sky'];
const LIVE = 'live data: the answer engine has no live feed for it and would guess';
export const HELD = {
  weather: LIVE, worldtime: LIVE, air: LIVE, uv: LIVE, pollen: LIVE, quake: LIVE, 'aurora-tonight': LIVE, moontonight: LIVE,
  'night-sky': LIVE, 'sky-card': LIVE, sky: LIVE, suntimes: LIVE, crypto: LIVE, news: LIVE, sport: LIVE, coral: LIVE,
  trialwatch: LIVE, releasenotes: LIVE,
  util: 'passwords and random picks must never come from a shared answer cache',
  counter: 'a thing on the stage', place: 'a map on the stage', 'pdf-card': 'needs a PDF file', video: 'plays a video', 'video-play': 'plays a video',
  moon: 'moon_phase is its tool already', meteors: 'meteor_showers is its tool already',
};

/** the evidence in a rating's own words (tools/families.mjs ratingOf): { suite, browser, bench, score }. Pure. */
export function evidenceOf(why) {
  const w = String(why || ''), n = (re) => { const m = re.exec(w); return m ? +m[1] : 0; };
  const suite = /\ba self-test\b/.test(w), browser = n(/(\d+) browser-suite mention/), bench = n(/(\d+) real asks? in the benchmark/);
  return { suite, browser, bench, score: bench + browser + (suite ? 1 : 0) };
}

/** the chosen skills: [{ skill, tool, family, familyName, examples }], by name. Pure, given the data. */
export function choose(families, live, bench, top = TOP) {
  const liveSet = new Set(live), out = [];
  for (const f of (families && families.families) || []) {
    if (!OVER_MCP.includes(f.id)) continue;
    for (const s of f.skills || []) {
      if (s.tier !== 'proven' || !liveSet.has(s.name) || Object.prototype.hasOwnProperty.call(HELD, s.name)) continue;
      out.push({ s, f, ev: evidenceOf(s.why) });
    }
  }
  out.sort((a, b) => b.ev.score - a.ev.score || (a.s.name < b.s.name ? -1 : 1));
  const wants = (b, n) => b && typeof b.want === 'string' && b.want.split('|').some((w) => w === 'skill:' + n || w === n);
  return out.slice(0, top).map(({ s, f }) => ({
    skill: s.name, tool: 'skill_' + s.name.replace(/[^a-z0-9]/g, '_'), family: f.id, familyName: f.name,
    // the first real asks routed to it (the benchmark is append-only, so these stay put)
    examples: [...new Set(bench.filter((b) => wants(b, s.name)).map((b) => String(b.ask)))].slice(0, 3),
  })).sort((a, b) => (a.skill < b.skill ? -1 : 1));
}

/** the live skill names: skills/index.json, a family skill counted by its members (as tools/families.mjs does) */
function liveNames() {
  return JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8')).flatMap((n) => {
    let src = ''; try { src = readFileSync(resolve(root, 'void-live-deploy/skills/' + n + '.js'), 'utf8'); } catch (_) {}
    const m = /^\s*\*\s*parts:\s*\[([^\]]*)\]/m.exec(src);
    return m ? Array.from(m[1].matchAll(/'([a-z0-9-]+)'/g)).map((x) => x[1]) : [n];
  });
}

export function moduleText(chosen) {
  return '// GENERATED by tools/mcp-skills.mjs from skills/families.json, skills/index.json and tools/bench.json: never hand-edit.\n'
    + '// Verse\'s most proven read-only skills, each its own MCP tool (lib/mcp.js). Regenerate: node tools/mcp-skills.mjs\n'
    + '// SKILL_MODULES is each skill\'s own code: the tool runs it on the server (lib/mcp-run.js), the same code the page runs.\n'
    + chosen.map((c, i) => 'import s' + i + " from '../skills/" + c.skill + ".js';\n").join('')
    + 'export const SKILL_TOOLS = ' + JSON.stringify(chosen, null, 1) + ';\n'
    + 'export const SKILL_MODULES = { ' + chosen.map((c, i) => JSON.stringify(c.skill) + ': s' + i).join(', ') + ' };\n';
}
// the sentence on /code-review/ that names the skill tools (tools/mcp.test.mjs: the page names every tool tools/list serves)
const MARK = /(<span id="skill-tools">)[\s\S]*?(<\/span>)/;
export function pageWith(html, chosen) {
  const names = chosen.map((c) => '<code>' + c.tool + '</code>').join(', ');
  return html.replace(MARK, (_, a, b) => a + names + b);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fam = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/families.json'), 'utf8'));
  const bench = JSON.parse(readFileSync(resolve(root, 'tools/bench.json'), 'utf8'));
  const chosen = choose(fam, liveNames(), bench);
  const text = moduleText(chosen), html = readFileSync(PAGE, 'utf8'), page = pageWith(html, chosen);
  const problems = [];
  if (!chosen.length) problems.push('no skill qualifies for an MCP tool');
  if (!MARK.test(html)) problems.push('void-live-deploy/code-review/index.html has no <span id="skill-tools"> to name the skill tools in');
  if (process.argv.includes('--check')) {
    let cur = ''; try { cur = readFileSync(OUT, 'utf8'); } catch (_) {}
    if (cur !== text) problems.push('void-live-deploy/lib/mcp-skills.js is out of step with the skill ratings (node tools/mcp-skills.mjs)');
    if (page !== html) problems.push('the skill tools named on /code-review/ are out of step (node tools/mcp-skills.mjs)');
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log('ok: ' + chosen.length + ' skill tools: ' + chosen.map((c) => c.tool).join(', ')); process.exit(0);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  writeFileSync(OUT, text); writeFileSync(PAGE, page);
  console.log(chosen.map((c) => c.tool + '  (' + c.familyName + ')').join('\n'));
}
