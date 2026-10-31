// The live MCP proof, kept as a finding (owner, 2026-10-30: "When that live client call gets proven, it's worth logging as a finding
// with the artifact (the actual request/response)"). tools/mcp-probe.mjs, run by .github/workflows/mcp-live.yml with the official MCP
// SDK client against https://a-to-mind.com/api/mcp, writes what it sent and what came back to MCP_RECORD. This tool turns that record
// into an artifact (findings/mcp/<date>T<hhmm>.json: the server, the tools it listed, and each tools/call request with its response,
// attempt "live" and the occasion number) and one `finding` line in the growth ledger pointing at it. The workflow commits both.
// One finding a UTC day at most (a deploy can run the probe many times a day); --force writes one anyway.
//   node tools/mcp-finding.mjs /tmp/mcp-record.json            write the artifact and the ledger line
//   node tools/mcp-finding.mjs /tmp/mcp-record.json --dry      print the artifact, write nothing
// Exit 0 when a finding was written (or one is already kept today), 1 when the record is not a passing run, 2 when it is missing.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = join(root, 'findings', 'mcp');
export const TEXT_MAX = 4000;
const NAME = /^\d{4}-\d\d-\d\dT\d{4}\.json$/;

// a response text is kept whole up to TEXT_MAX characters; a longer one says how much was left out
const keepText = (t) => { const s = String(t || ''); return s.length <= TEXT_MAX ? s : s.slice(0, TEXT_MAX) + ' [' + (s.length - TEXT_MAX) + ' more characters not kept]'; };
const keepContent = (content) => (Array.isArray(content) ? content : []).map((c) => (c && typeof c.text === 'string' ? { ...c, text: keepText(c.text) } : c));

/** The artifact for one probe record. Pure: the record goes in, the artifact comes out. */
export function artifactOf(rec, occasion = 1) {
  const calls = (Array.isArray(rec && rec.calls) ? rec.calls : []).map((c) => ({
    request: c.request, response: { ...c.response, content: keepContent(c.response && c.response.content) }, ms: Math.round(c.ms || 0), ok: !!c.ok, ...(c.expect ? { expect: c.expect } : {}),
  }));
  const ok = !!(rec && rec.ok && rec.server && calls.length && calls.every((c) => c.ok));
  return {
    attempt: 'live', occasion, at: String((rec && rec.at) || ''), family: 'mcp', url: String((rec && rec.url) || ''), client: String((rec && rec.client) || ''),
    server: (rec && rec.server) || null, tools: Array.isArray(rec && rec.tools) ? rec.tools : [], calls, ok,
    error: ok ? '' : String((rec && rec.error) || 'the probe did not finish').replace(/\s+/g, ' ').slice(0, 300),
  };
}

export const artifactName = (a) => a.at.slice(0, 13) + a.at.slice(14, 16) + '.json';
// a call that answered its own ask, by tool name; the refusal check is counted apart
const answered = (a) => a.calls.filter((c) => c.ok && c.expect !== 'refused').map((c) => c.request && c.request.params && c.request.params.name);
export const ledgerWhat = (a) => {
  const names = answered(a), skills = names.filter((n) => /^skill_/.test(n)), refused = a.calls.some((c) => c.ok && c.expect === 'refused');
  return a.ok
    ? `MCP proven against the live site${a.occasion > 1 ? ', occasion ' + a.occasion : ' for the first time'}: a real MCP client (${a.client}) initialized ${a.server.name} ${a.server.version} at ${a.url}, listed ${a.tools.length} tools and called ${names.length} of them, each with the answer it was asked for` +
      (skills.length ? `, ${skills.length} of them Verse's own skills run by their own code (${skills.join(', ')})` : '') +
      `${refused ? '; a skill refused an ask that is not its own' : ''}; read-only, no key, no person in the loop (artifact findings/mcp/${artifactName(a)})`
    : `MCP client run against the live site did not pass (${a.error}); attempt live, occasion ${a.occasion} (artifact findings/mcp/${artifactName(a)})`;
};

const kept = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => NAME.test(f)) : []);
/** The occasion number: one more than the artifacts already kept. */
export const nextOccasion = (dir = DIR) => kept(dir).length + 1;
/** true when an artifact is already kept for this UTC day */
export const keptToday = (at, dir = DIR) => kept(dir).some((f) => f.slice(0, 10) === String(at).slice(0, 10));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2], dry = process.argv.includes('--dry'), force = process.argv.includes('--force');
  if (!file || !existsSync(file)) { console.error('mcp-finding: no probe record at ' + (file || '(none given)')); process.exit(2); }
  const a = artifactOf(JSON.parse(readFileSync(file, 'utf8')), nextOccasion());
  if (dry) { console.log(JSON.stringify(a, null, 1)); process.exit(a.ok ? 0 : 1); }
  if (!a.ok) { console.error('mcp-finding: the probe did not pass, no finding written: ' + a.error); process.exit(1); }
  if (!force && keptToday(a.at)) { console.log('mcp-finding: a finding is already kept for ' + a.at.slice(0, 10) + '; nothing written'); process.exit(0); }
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, artifactName(a)), JSON.stringify(a, null, 1) + '\n');
  const ref = 'https://github.com/atomeam/void-loop/blob/main/findings/mcp/' + artifactName(a);
  const g = spawnSync(process.execPath, [join(root, 'tools', 'grow.mjs'), 'finding', ledgerWhat(a), '--by', 'mcp-live', '--ref', ref, '--ledger'], { encoding: 'utf8' });
  if (g.status !== 0) { console.error('mcp-finding: the ledger line was not written: ' + (g.stderr || g.stdout).slice(0, 200)); process.exit(1); }
  console.log('### MCP, live finding\n\n| What | |\n|:--|:--|\n| server | ' + a.server.name + ' ' + a.server.version + ' |\n| tools listed | ' + a.tools.length + ' |\n| calls answered | ' + answered(a).length + ' |\n| occasion | ' + a.occasion + ' |\n| artifact | findings/mcp/' + artifactName(a) + ' |');
  process.exit(0);
}
