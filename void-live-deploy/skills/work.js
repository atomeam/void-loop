/**
 * work skill — remote jobs (no key; assimilate row 5): "find me work as a designer", "remote jobs for python", "jobs as a writer".
 * Calm listing + a plain check-yourself line (no fake scam score). Since 2026-10-26 the listings come from Verse's own /api/jobs (Remotive, Jobicy and Himalayas,
 * cached on the edge within each source's terms, lib/jobs-core.js) rather than from Remotive straight from each visitor's browser, each credited to its source, and
 * the card opens the full jobs page (/jobs/) with the search in its link.
 */
export function workOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:find\s+(?:me\s+)?(?:work|jobs?|a\s+job)|remote\s+jobs?(?:\s+for)?|jobs?(?:\s+for)?)\s+(?:as\s+(?:a\s+|an\s+)?)?(.{2,40})$/i);
  if (m) {
    const q = m[1].replace(/^(?:a|an|the)\s+/i, '').trim();
    if (!q || /^(?:me|you|(?:verse|void)|it|that|this)$/i.test(q)) return null;
    if (/^(?:table|flight|hotel|meeting|appointment)\b/i.test(q)) return null;
    return q;
  }
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = workOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Work</h2><div class="sub">…</div>'; });
  try {
    const [j, C] = await Promise.all([fetch('/api/jobs').then((r) => r.json()), import('../lib/jobs-core.js')]);
    if (!api._pageStill(el)) return 'work';
    const jobs = C.search(C.merge((j && j.jobs) || []), { q });
    const page = '/jobs/?q=' + encodeURIComponent(q);
    if (!jobs.length) { el.innerHTML = '<h2>Work</h2><p>No remote listings matched that right now. Try a shorter role name, or <a href="' + esc(page) + '">open the jobs page</a> to search every way.</p>'; return 'work'; }
    const rows = jobs.slice(0, 8).map((d) => {
      const bits = [d.company, d.loc || 'Anywhere', (C.TYPES[d.type] || ''), C.salaryText(d.salary)].filter(Boolean).join(' · ');
      return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.title) + '</a>'
        + '<br><span style="color:#8a8a8a">' + esc(bits) + ' · via ' + esc(C.SOURCES[d.src].name) + '</span></li>';
    }).join('');
    el.innerHTML = '<h2>Remote work · ' + esc(q) + '</h2><p style="color:#8a8a8a;font-size:13px">' + esc(jobs.length + ' remote jobs') + '</p><ul>' + rows + '</ul>'
      + '<p style="color:#8a8a8a;font-size:13px">Listings from Remotive, Jobicy and Himalayas, each linked to its original posting · check the company yourself before you apply.</p>'
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
  examples: ['find me work as a designer', 'remote jobs for python', 'jobs as a writer', 'find jobs as a marketer'],
  nearMisses: ['what is a job', 'book a table', 'how to write a resume', 'news anchor jobs', 'good job'],
  match(lower, text) { return !!workOf(text); },
  run
};
