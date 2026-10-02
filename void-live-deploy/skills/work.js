/**
 * work skill — remote jobs from Remotive (no key; assimilate row 5)
 * "find me work as a designer", "remote jobs for python", "jobs as a writer".
 * Calm listing + a plain check-yourself line (no fake scam score).
 */
export function workOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:find\s+(?:me\s+)?(?:work|jobs?|a\s+job)|remote\s+jobs?(?:\s+for)?|jobs?(?:\s+for)?)\s+(?:as\s+(?:a\s+|an\s+)?)?(.{2,40})$/i);
  if (m) {
    const q = m[1].replace(/^(?:a|an|the)\s+/i, '').trim();
    if (!q || /^(?:me|you|void|it|that|this)$/i.test(q)) return null;
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
    const j = await fetch('https://remotive.com/api/remote-jobs?limit=8&search=' + encodeURIComponent(q)).then((r) => r.json());
    if (!api._pageStill(el)) return 'work';
    const jobs = ((j && j.jobs) || []).filter((d) => d && d.title && d.url);
    if (!jobs.length) throw 0;
    const rows = jobs.slice(0, 8).map((d) => {
      const where = d.candidate_required_location || '';
      const who = d.company_name || '';
      const kind = (d.job_type || '').replace(/_/g, ' ');
      const bits = [who, where, kind].filter(Boolean).join(' · ');
      return '<li><a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.title) + '</a>'
        + (bits ? '<br><span style="color:#8a8a8a">' + esc(bits) + '</span>' : '') + '</li>';
    }).join('');
    el.innerHTML = '<h2>Remote work · ' + esc(q) + '</h2><ul>' + rows + '</ul>'
      + '<p style="color:#8a8a8a;font-size:13px">Listings from Remotive · open the link and check the company yourself before you apply.</p>'
      + '<div class="src">Source: <a href="https://remotive.com/remote-jobs/search?search=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">Remotive</a></div>';
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
