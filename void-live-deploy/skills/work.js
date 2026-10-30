/**
 * work skill — remote jobs (no key; assimilate row 5): "find me work as a designer", "remote jobs for python", "jobs as a writer", and the role first or with a place: "software jobs in boston", "jobs in berlin".
 * Calm listing + a plain check-yourself line (no fake scam score). Since 2026-10-26 the listings come from Verse's own /api/jobs (Remotive, Jobicy and Himalayas,
 * cached on the edge within each source's terms, lib/jobs-core.js) rather than from Remotive straight from each visitor's browser, each credited to its source, and
 * the card opens the full jobs page (/jobs/) with the search in its link. Since 2026-10-30 it also reads the jobs page's snapshot (/jobs/snapshot.json), as the
 * page does, so the card and the page count the same listings, and it answers each jobs page's own stage ask ("remote jobs by salary", "job alerts") with that page.
 */
import { jobAskOf } from '../lib/job-sites.js';
// words that read as a role in "<role> jobs" but are not one: Steve Jobs, "good job", "my jobs", a question
const NOT_ROLE = /^(?:steve|good|great|nice|well|odd|blow|hand|inside|side|the|my|your|our|their|his|her|no|any|all|some|many|more|new|lost|cut|green|remote|find|show|search|get|look|what|how|why|who|where|when|is|are|do|does)$/i;
// what follows a bare "jobs" when it is the news or a framework, not a role: "jobs report", "jobs act", "jobs to be done"
const NOT_TOPIC = /^(?:report|reports|data|numbers?|figures?|growth|market|act|day|program|programme|to be done|done|summit|fair|board|cuts?|crisis)\b/i;
const NOT_PLACE = /^(?:me|my area|here|home)$/i;
// a jobs ask with no role: a search verb, or "remote" / "work from home", must say it is a job hunt
const WFH = '(?:remote|work[- ]from[- ]home|wfh)';
// a jobs page's own view, not a role: each jobs page's stage ask ("remote jobs by salary", "job alerts", "remote companies hiring", lib/job-sites.js) opens that page
const LANE_PAGES = new Set(['/jobs/alerts/', '/jobs/salary/', '/jobs/regions/', '/jobs/categories/', '/jobs/tags/', '/jobs/companies/']);
// a lane's words where a role would stand: "highest paying jobs", "jobs by salary", "job categories", "job alerts"
const LANE_ROLE = [[/^(?:alerts?|job\s+alerts?)$/i, '/jobs/alerts/'], [/^(?:by\s+salary|with\s+salar(?:y|ies)|(?:highest|best|top|well)[- ]paying|high[- ]paying|paying)$/i, '/jobs/salary/'],
  [/^(?:by\s+)?(?:regions?)$/i, '/jobs/regions/'], [/^(?:by\s+)?(?:categor(?:y|ies))$/i, '/jobs/categories/'], [/^(?:by\s+)?tags?$/i, '/jobs/tags/'], [/^(?:by\s+)?compan(?:y|ies)$/i, '/jobs/companies/']];
const ANY_ROLE = new RegExp('^(?:(?:find|search(?:\\s+for)?|look(?:\\s+for)?|hunt\\s+for)\\s+(?:me\\s+)?(?:some\\s+)?(?:' + WFH + '\\s+)?(?:jobs?|work|a\\s+job|a\\s+' + WFH + '\\s+job)'
  + '|(?:show|list)\\s+(?:me\\s+)?' + WFH + '\\s+(?:jobs?|work)|' + WFH + '\\s+jobs?|(?:' + WFH + '\\s+)?job\\s+(?:search|hunt(?:ing)?|listings?|openings))$', 'i');
/** a jobs ask as { q, loc }: the role (may be '') and the place (may be ''). Null when the text is not a jobs ask. Pure. */
export function workAsk(text) {
  let t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '), loc = '', placed = false;
  // "... in Boston", "... near me": the place comes off the end first
  const at = t.match(/^(.+?)\s+(?:in|near|around|based in)\s+(?:the\s+)?([a-z][a-z .'-]{1,30})$/i);
  if (at && /\b(?:jobs?|work|positions|openings|vacancies|hiring)\b/i.test(at[1])) { t = at[1]; placed = true; loc = NOT_PLACE.test(at[2].trim()) ? '' : at[2].trim(); }
  // 2026-10-30: no role at all, "find remote jobs", "find me a job", "work from home jobs", "job search": every role. Checked before the
  // role rules, which read "search" in "job search" as a role. A bare "jobs" or "show me jobs" stays out: Verse has jobs of its own (the misses queue)
  if (ANY_ROLE.test(t)) return { q: '', loc };
  // the place stays with the lane: "job alerts in Berlin" is the alerts page's view of Berlin, not a role called "alerts"
  { const lane = jobAskOf(t); if (LANE_PAGES.has(lane)) return { q: '', loc, lane }; }
  const role = (q, bare) => {
    q = String(q || '').replace(/^(?:a|an|the)\s+/i, '').trim();
    const lane = LANE_ROLE.find(([re]) => re.test(q));
    if (lane) return { lane: lane[1] };
    if (!q || /^(?:me|you|(?:verse|void)|it|that|this)$/i.test(q)) return null;
    if (/^(?:table|flight|hotel|meeting|appointment)\b/i.test(q) || NOT_ROLE.test(q) || NOT_ROLE.test(q.split(' ')[0]) || (bare && NOT_TOPIC.test(q))) return null;
    return q;
  };
  let m = t.match(/^(?:find\s+(?:me\s+)?(?:work|jobs?|a\s+job)|remote\s+jobs?(\s+for)?|jobs?(\s+for)?)\s+(as\s+(?:a\s+|an\s+)?)?(.{2,40})$/i);
  if (m) { const q = role(m[4], !m[1] && !m[2] && !m[3] && /^jobs?\s/i.test(t)); return q && q.lane ? { q: '', loc, lane: q.lane } : q ? { q, loc } : null; }
  // "software jobs", "remote designer jobs", "python developer positions", "teacher job openings"
  m = t.match(/^(?:find\s+(?:me\s+)?|show\s+(?:me\s+)?|any\s+)?(?:remote\s+)?((?:[a-z+#.]+\s+){0,3}?[a-z+#.]+)\s+(?:jobs|positions|job\s+openings|openings|vacancies)$/i);
  // a role is a noun phrase: "turn the misses into jobs" and "queue these as jobs" are not
  if (m && !/\b(?:into|to|the|of|my|your|our|from|and|with|me|us|as|these|those|them)\b/i.test(m[1])) { const q = role(m[1]); if (q && q.lane) return { q: '', loc, lane: q.lane }; if (q) return { q, loc }; }
  // "jobs in Berlin", "remote jobs near me": the place alone
  if (placed && /^(?:find\s+(?:me\s+)?|show\s+(?:me\s+)?)?(?:remote\s+)?(?:jobs|job\s+openings)$/i.test(t)) return { q: '', loc };
  return null;
}
/** the role alone (kept for the callers that read only the role) */
export function workOf(text) { const a = workAsk(text); return (a && a.q) || null; }
async function run(text, api) {
  const { showPage, esc } = api;
  const ask = workAsk(text);
  if (!ask) return 'none';
  const { q, loc, lane } = ask, pay = lane === '/jobs/salary/', what = [q || 'every role', loc && 'open to ' + loc, pay && 'with pay, highest first'].filter(Boolean).join(' · ');
  const el = showPage((p) => { p.innerHTML = '<h2>Work</h2><div class="sub">…</div>'; });
  try {
    // the snapshot the jobs page also reads (lib/jobs-ui.js), so the card counts what the page counts; a missing snapshot leaves the live feeds
    const snapOf = fetch('/jobs/snapshot.json').then((r) => (r && r.ok !== false ? r.json() : null)).catch(() => null);
    const [j, C, snap] = await Promise.all([fetch('/api/jobs').then((r) => r.json()), import('../lib/jobs-core.js'), snapOf]);
    if (!api._pageStill(el)) return 'work';
    const jobs = C.search(C.merge((snap && snap.jobs) || [], (j && j.jobs) || []), pay ? { q, loc, salaryOnly: true, sort: 'salary' } : { q, loc });
    // a lane page reads the same query as /jobs/ (lib/jobs-ui.js), so the place carries over: "job alerts in Berlin" opens alerts for Berlin
    const page = lane ? lane + (loc ? '?' + C.toQuery({ loc }) : '') : '/jobs/?' + C.toQuery({ q, loc });
    // a place may mean on-site work too, which these remote listings do not hold: the same search on two big boards, opened by the visitor
    const there = loc ? '<p style="color:#8a8a8a;font-size:13px">The same search for ' + esc(loc) + ' on the big job boards: ' + C.searchLinks({ q, loc }).filter((x) => x.id === 'linkedin' || x.id === 'indeed').map((x) => '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a>').join(' · ') + '</p>' : '';
    if (!jobs.length) { el.innerHTML = '<h2>Work</h2><p>No remote listings matched that right now. Try a shorter role name, or <a href="' + esc(page) + '">open the jobs page</a> to search every way.</p>' + there; return 'work'; }
    const rows = jobs.slice(0, 8).map((d) => {
      const bits = [d.company, d.loc || 'Anywhere', (C.TYPES[d.type] || ''), C.salaryText(d.salary)].filter(Boolean).join(' · ');
      return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.title) + '</a>'
        + '<br><span style="color:#8a8a8a">' + esc(bits) + ' · via ' + esc(C.SOURCES[d.src].name) + '</span></li>';
    }).join('');
    el.innerHTML = '<h2>Remote work · ' + esc(what) + '</h2><p style="color:#8a8a8a;font-size:13px">' + esc(jobs.length === 1 ? '1 remote job' : jobs.length + ' remote jobs' + (jobs.length > 8 ? ', the first 8 here' : '')) + '</p><ul>' + rows + '</ul>'
      + '<p style="color:#8a8a8a;font-size:13px">Listings from Remotive, Jobicy and Himalayas, each linked to its original posting · check the company yourself before you apply.</p>' + there
      + '<div class="src"><a href="' + esc(page) + '">Open the full jobs page</a>: filters, saved jobs, alerts and an application tracker</div>';
    return 'work';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Work</h2><p>No remote listings turned up for that. Try a shorter role name.</p>';
    return 'work';
  }
}
export default {
  name: 'work',
  examples: ['find me work as a designer', 'remote jobs for python', 'jobs as a writer', 'find jobs as a marketer', 'software jobs in boston', 'remote designer jobs', 'jobs in berlin', 'find remote jobs', 'job search', 'remote jobs by salary', 'job alerts', 'remote companies hiring'],
  nearMisses: ['what is a job', 'book a table', 'how to write a resume', 'good job', 'steve jobs', 'jobs report', 'jobs to be done', 'show me jobs', 'get a job'],
  match(lower, text) { return !!workAsk(text); },
  run
};
