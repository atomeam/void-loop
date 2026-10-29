/**
 * fringe-to-skill skill - "fringe to skill", "which skills came from the fringe", "what did the fringe experiments teach": every
 * published fringe family from the ledger (tools/fringe.json, written to /fringe/ledger.json by tools/fringe.mjs --publish) with
 * its live drafts, its research notes' findings, what its runs were built toward (the ledger's `near`: a miss-board target or a
 * router skill) and the core skills its notes name, each a link from the experiment to the skill it grew into.
 * Asked by Verse (ask-20261013-0026-2: "a dashboard that visualizes the relationship between a fringe experiment and its potential
 * as a permanent skill"; ask-20261013-1719-1 and -2: link ledger entries to the router's near misses, flag what matches no skill).
 * Read-only: a family whose notes name no skill is shown as "no skill yet", which is the flag; nothing is scored or counted
 * about people.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export const LEDGER_URL = '/fringe/ledger.json';

const norm = (t) => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
const WHEN = new RegExp('^(?:(?:show|open|give|list)(?:\\s+me)?\\s+)?(?:the\\s+|your\\s+|(?:verse|void)\'?s\\s+|(?:verse|v01d)\'?s\\s+)?'
  + '(?:fringe\\s+to\\s+skills?(?:\\s+(?:card|map|board))?|fringe\\s+(?:ledger|findings|research(?:\\s+notes)?|experiments?\\s+(?:to|into)\\s+skills?)|fringe\\s+experiments?(?:\\s+(?:findings|results|notes))?|from\\s+fringe\\s+to\\s+skills?)$'
  + '|^(?:which|what)\\s+skills?\\s+(?:came|grew|come|grows?)\\s+(?:out\\s+of|from)\\s+(?:the\\s+)?fringe(?:\\s+experiments?)?$'
  + '|^what\\s+(?:did|have|has)\\s+(?:the\\s+)?fringe(?:\\s+experiments?)?\\s+(?:teach|taught|learn|learned|found|find)(?:\\s+(?:you|us|(?:verse|void)|(?:verse|v01d)|verse))?$', 'i');
export const asksFringe = (t) => WHEN.test(norm(t));

/** the card's rows from ledger.json: each published family, newest first, with the words the card shows. Pure. */
export function rows(led) {
  const fams = ((led && Array.isArray(led.families) && led.families) || []).filter((f) => f && f.family);
  return fams.map((f) => ({
    family: String(f.family), name: String(f.family).replace(/-/g, ' '), runs: Number(f.runs) || 0,
    drafts: (Array.isArray(f.drafts) ? f.drafts : []).filter((d) => d && /^[a-z0-9-]+$/.test(String(d.id || ''))).map((d) => ({ id: d.id, label: String(d.label || ''), at: String(d.at || '') })),
    behavior: String(f.behavior || ''), findings: (Array.isArray(f.findings) ? f.findings : []).map(String), failures: (Array.isArray(f.failures) ? f.failures : []).filter((x) => x && x.what).map((x) => String(x.what)),
    near: (Array.isArray(f.near) ? f.near : []).map(String), skills: (Array.isArray(f.skills) ? f.skills : []).filter((s) => /^[a-z0-9-]+$/.test(String(s))).map(String),
  }));
}

/** the card's body (below the title). Pure. */
export function fringeHtml(esc, led) {
  const R = rows(led);
  if (!R.length) return '<p>The fringe ledger could not be read just now. Ask again in a moment.</p>';
  const withSkill = R.filter((r) => r.skills.length).length, noted = R.filter((r) => r.findings.length || r.behavior).length;
  const chip = (t) => '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.07);font-size:12px">' + esc(t) + '</span>';
  return '<div class="sub" style="font-size:13px;margin:2px 0 10px">' + R.length + ' fringe famil' + (R.length === 1 ? 'y' : 'ies') + ' published; ' + noted + ' with research notes; ' + withSkill + ' grown into a core skill so far. From the fringe ledger, read as written.</div>'
    + '<div class="fs-rows">' + R.map((r) => '<div class="fs-family" data-family="' + esc(r.family) + '" data-skills="' + r.skills.length + '" style="padding:10px 0;border-top:1px solid rgba(255,255,255,.06)">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(r.name) + '</b><span class="sub" style="font-size:12px;white-space:nowrap">' + r.runs + ' run' + (r.runs === 1 ? '' : 's') + '</span></div>'
      + (r.drafts.length ? '<div class="fs-drafts" style="font-size:13px;margin-top:4px">' + r.drafts.map((d) => '<a href="/fringe/' + esc(d.id) + '.html" target="_blank" rel="noopener" data-draft="' + esc(d.id) + '" style="color:rgb(var(--d-key, 158 178 255))">' + esc(d.label || d.id) + '</a>' + (d.at ? ' <span class="sub" style="font-size:12px">' + esc(d.at) + '</span>' : '')).join(' · ') + '</div>' : '')
      + (r.behavior ? '<div style="font-size:13px;margin-top:4px">' + esc(r.behavior) + '</div>' : '')
      + (r.findings.length ? '<ul class="fs-findings" style="margin:4px 0 0;padding-left:18px;font-size:13px">' + r.findings.slice(0, 5).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'
        : '<div class="sub fs-none" style="font-size:12px;margin-top:4px">no research notes yet: its runs recorded sources only</div>')
      + (r.failures.length ? '<div class="sub" style="font-size:12px;margin-top:4px">What failed: ' + esc(r.failures.slice(0, 3).join('; ')) + '</div>' : '')
      + '<div class="fs-link" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;font-size:12px">'
      + (r.near.length ? '<span class="sub">built toward</span> ' + r.near.map(chip).join(' ') : '')
      + (r.skills.length ? ' <span class="sub">grew into</span> ' + r.skills.map((s) => '<span data-skill="' + esc(s) + '" style="display:inline-block;padding:2px 8px;border-radius:999px;background:rgb(var(--d-key, 158 178 255) / .25);font-size:12px;color:var(--d-ink,#f2f4fb)">' + esc(s) + '</span>').join(' ')
        : '<span class="sub fs-noskill">no skill yet</span>') + '</div>'
      + '</div>').join('') + '</div>'
    + '<div class="sub" style="font-size:12px;line-height:1.5;margin-top:10px">Each row is one fringe family the ledger published: its live drafts, what its runs found, what they were built toward (the ledger\'s near: a miss-board target or a router skill) and the core skill that grew out of it when its notes name one. "No skill yet" is the flag: an experiment that matches no skill is a proposal waiting.</div>'
    + '<div class="src">Source: fringe/ledger.json, written from tools/fringe.json by tools/fringe.mjs --publish</div>';
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const head = '<h2>From the fringe to a skill</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">reading the ledger…</div>'; }); // void-review: ok (head is a constant heading; nothing from a user)
  let led = null;
  try { const r = await fetch(LEDGER_URL, { cache: 'no-cache' }); led = r.ok ? await r.json() : null; } catch (_) { led = null; }
  if (!el || (_pageStill && !_pageStill(el))) return 'fringe-to-skill';
  el.innerHTML = head + fringeHtml(esc, led);
  return 'fringe-to-skill';
}

// checked by tools/skills-check.mjs on every run: the asks, the rows and the HTML on a made-up ledger
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const led = { families: [
    { family: 'miss-board', runs: 2, drafts: [{ id: 'miss-board-4', label: 'What it <hasn\'t> heard', at: '2026-10-09' }, { id: 'Bad Id', label: 'x' }], behavior: 'See what people asked for that is not here yet', findings: ['misses cluster by hour'], failures: [{ what: 'empty board on day one', evidence: 'run 60' }], near: ['skill:growth'], skills: ['growth'] },
    { family: 'attention', runs: 1, drafts: [{ id: 'attention-9' }], findings: [], near: [], skills: [] },
  ] };
  const R = rows(led), h = fringeHtml(esc, led);
  const ok = R.length === 2 && R[0].name === 'miss board' && R[0].drafts.length === 1 && R[0].skills.join() === 'growth' && R[1].drafts[0].id === 'attention-9'
    && h.includes('href="/fringe/miss-board-4.html"') && h.includes('What it &lt;hasn\'t&gt; heard') && !h.includes('<hasn') && h.includes('misses cluster by hour') && h.includes('data-skill="growth"')
    && h.includes('What failed: empty board on day one') && h.includes('class="sub fs-none"') && h.includes('class="sub fs-noskill"') && h.includes('2 fringe families published; 1 with research notes; 1 grown into')
    && fringeHtml(esc, null).includes('could not be read') && fringeHtml(esc, { families: [] }).includes('could not be read')
    && asksFringe('Fringe to skill?') && asksFringe('which skills came from the fringe') && asksFringe('what did the fringe experiments teach you') && asksFringe('show me the fringe ledger')
    && !asksFringe('fringe') && !asksFringe('fringe festival') && !asksFringe('fringe benefits') && !asksFringe('skills');
  return { ok, got: ok ? '' : JSON.stringify(R) };
}

export default {
  name: 'fringe-to-skill',
  examples: ['fringe to skill', 'which skills came from the fringe', 'what did the fringe experiments teach', 'fringe findings', 'show me the fringe ledger', 'fringe research notes',
    'from fringe to skill', 'what skills grew out of the fringe experiments'],
  nearMisses: ['fringe', 'fringe festival', 'fringe benefits', 'skills', 'the ledger', 'what can you do', 'edinburgh fringe', 'fringe hairstyle'],
  suite,
  match(lower, text) { return asksFringe(text || lower); },
  run,
};
