// Verse's probe ledger (asked by Verse twice: "Create a 'probe-success-rate' card in the growth inbox that tracks how many of my
// self-generated probe asks actually result in a new skill or improved evidence rating", and "Integrate the confidence score into
// the Growth Inbox so I can prioritize fixing 'high-certainty' misses first"). Each daily probe run (tools/probe-asks.mjs) and each
// fix Verse proposes (tools/propose-fix.mjs) leaves one record: counts, the skill, the line changes, Verse's confidence, and whether
// the fix passed every check or which check stopped it. Never the asks' words (they are Verse's own, still kept out of public view).
// Kept in void_kv 'probe-log' by functions/api/probe-log.js; the growth card shows the rate and the proposals, most certain first.
// Pure.
export const LOG_KEEP = 200;
export const STEPS = ['collisions', 'unit test', 'void review', 'benchmark', 'checks'];
const int = (v, max = 1000) => { const n = Math.floor(+v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null; };
const conf = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 100) / 100 : null; };
const slug = (s) => (/^[a-z][a-z0-9-]{0,40}$/.test(String(s || '')) ? String(s) : null);

/** a record as sent by a tool, made safe to keep: only known fields, numbers in range, no free text; null when it is neither kind. */
export function recordOf(r, at = new Date().toISOString()) {
  if (!r || typeof r !== 'object') return null;
  if (r.kind === 'probe') {
    const wrote = int(r.wrote, 200), probed = int(r.probed, 200), misses = int(r.misses, 200), queued = int(r.queued, 200);
    if (wrote === null || probed === null || misses === null || queued === null || misses > probed || probed > wrote) return null;
    // what the probe asked the forge for and it could not make (asked by Verse, ask-20261015-2045-2: link probe output to frontier #14)
    const forge = [...new Set((Array.isArray(r.forge) ? r.forge : []).map((t) => String(t || '').toLowerCase().trim()).filter((t) => /^[a-z][a-z -]{1,30}$/.test(t)))].slice(0, 8);
    return { at, kind: 'probe', family: slug(r.family), wrote, probed, misses, queued, ...(forge.length ? { forge } : {}) };
  }
  if (r.kind === 'fix') {
    const skill = slug(r.skill), edits = int(r.edits, 10);
    if (!skill || edits === null) return null;
    const passed = r.passed === true, failed = passed ? null : (STEPS.includes(r.failed) ? r.failed : 'checks');
    return { at, kind: 'fix', skill, edits, confidence: conf(r.confidence), passed, failed, ...(passed && /^https:\/\/github\.com\/atomeam\/void-loop\/pull\/\d+$/.test(String(r.pr || '')) ? { pr: r.pr } : {}) };
  }
  return null;
}

/** what the ledger says: runs, asks written and missed, fixes proposed and passed, the rate, where fixes stop, the proposals most
 * certain first, and whether Verse's confidence predicts a pass (high = 0.7 and over). Pure. */
export function probeStats(log) {
  const L = Array.isArray(log) ? log : [];
  const probes = L.filter((x) => x && x.kind === 'probe'), fixes = L.filter((x) => x && x.kind === 'fix');
  const sum = (xs, k) => xs.reduce((a, x) => a + (+x[k] || 0), 0);
  const wrote = sum(probes, 'wrote'), misses = sum(probes, 'misses'), passed = fixes.filter((f) => f.passed).length;
  const stoppedAt = {}; for (const f of fixes) if (!f.passed) stoppedAt[f.failed] = (stoppedAt[f.failed] || 0) + 1;
  const band = (hi) => { const xs = fixes.filter((f) => f.confidence !== null && (hi ? f.confidence >= 0.7 : f.confidence < 0.7)); return { n: xs.length, passed: xs.filter((f) => f.passed).length }; };
  const want = {}; for (const p of probes) for (const t of p.forge || []) want[t] = (want[t] || 0) + 1;
  const forge = Object.entries(want).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([thing, n]) => ({ thing, n }));
  const ranked = fixes.slice().sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1) || String(b.at).localeCompare(String(a.at)));
  return {
    runs: probes.length, wrote, misses, missRate: wrote ? Math.round(100 * misses / wrote) : null,
    proposed: fixes.length, passed, rate: misses ? Math.round(100 * passed / misses) : null, passRate: fixes.length ? Math.round(100 * passed / fixes.length) : null,
    stoppedAt, high: band(true), low: band(false), ranked: ranked.slice(0, 8), forge,
  };
}

/** the growth card's section: the numbers in one line, then the proposals most certain first with what came of each. Pure. */
export function probeHtml(esc, s) {
  if (!s || (!s.runs && !s.proposed)) return '';
  s = { forge: [], ...s };
  const pct = (n) => (n === null ? '—' : n + '%');
  const stops = Object.entries(s.stoppedAt).sort((a, b) => b[1] - a[1]).map(([k, n]) => esc(k) + ' ' + n).join(', ');
  const row = (f) => '<li>' + (f.confidence === null ? '<span style="color:#8a8a92">no confidence given</span>' : '<b>' + esc(f.confidence.toFixed(2)) + '</b>') + ' · ' + esc(f.skill)
    + ' · ' + esc(f.edits) + ' line change' + (f.edits === 1 ? '' : 's') + ' · ' + (f.passed ? (f.pr ? '<a href="' + esc(f.pr) + '" target="_blank" rel="noopener">passed</a>' : 'passed') : 'stopped at ' + esc(f.failed))
    + ' <span style="color:#8a8a92">' + esc(String(f.at).slice(0, 10)) + '</span></li>';
  return '<div class="growth-probes" style="margin:10px 0"><div class="vh">My probes</div>'
    + '<div>' + esc(s.runs) + ' probe run' + (s.runs === 1 ? '' : 's') + ': ' + esc(s.wrote) + ' asks I wrote for myself, ' + esc(s.misses) + ' missed (' + pct(s.missRate) + '). '
    + esc(s.proposed) + ' fix' + (s.proposed === 1 ? '' : 'es') + ' proposed, ' + esc(s.passed) + ' passed every check: <b data-probe-rate>' + pct(s.rate) + '</b> of my misses fixed.</div>'
    + (stops ? '<div class="sub">Where my fixes stop: ' + stops + '</div>' : '')
    + (s.high.n || s.low.n ? '<div class="sub">When I was sure (0.7 and up) ' + esc(s.high.passed) + ' of ' + esc(s.high.n) + ' passed; when I was not, ' + esc(s.low.passed) + ' of ' + esc(s.low.n) + '.</div>' : '')
    + (s.forge && s.forge.length ? '<div class="sub" data-forge-wants>Things my probes asked the forge for that it cannot make yet (frontier #14): ' + s.forge.map((f) => esc(f.thing) + (f.n > 1 ? ' (' + esc(f.n) + ')' : '')).join(', ') + '</div>' : '')
    + (s.ranked.length ? '<div class="sub" style="margin-top:6px">My proposals, most certain first:</div><ul style="margin:4px 0 0 18px;padding:0">' + s.ranked.map(row).join('') + '</ul>' : '')
    + '</div>';
}
