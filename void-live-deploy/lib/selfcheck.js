// lib/selfcheck.js: Verse checks its own pages (owner, 2026-10-30: "go all out fixing stuff ... build anything you need or want to help you
// right into Verse"). After each deploy tools/self-check.mjs opens every page of the live sitemap in headless Chrome, judges each with
// pageProblems below, and hands the report to /api/selfcheck (owner key), which keeps the newest one; the status card ("verse status",
// skills/status.js) shows it and, for the owner, opens by itself when a page is broken. Honest by construction: the report says how many
// pages were opened, when, on which deploy and how; a page is "broken" only for something it was seen to do, never for something guessed.
// Pure: no fetch, no DOM. Tests: tools/selfcheck.test.mjs.

// pages that are not tools, so a missing "Use with" row (lib/toolkit.js mountRelated, .tk-row) is not a gap on them
export const NOT_TOOLS = Object.freeze(['/', '/privacy/', '/members/', '/store/receipt/', '/calendar/embed/', '/conquered/', '/history/', '/handoff.html']);
export const KINDS = Object.freeze({
  status: 'does not open', script: 'script error', request: 'a file or API it needs fails', empty: 'shows nothing', light: 'light page (off design)',
  link: 'dead link', wording: 'wording', unwired: 'not wired into the tools',
});
export const SERIOUS = Object.freeze(['status', 'script', 'request', 'empty', 'link']);
export const REPORT_MAX = 80, WHY_MAX = 160;

/** relative luminance of a CSS colour "rgb(a)(r, g, b[, a])", or null when it is transparent or unreadable. Pure. */
export function luminance(css) {
  const m = String(css || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i); if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) < 0.5) return null;
  const ch = (v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(m[1]) + 0.7152 * ch(m[2]) + 0.0722 * ch(m[3]);
}

// "fight" went (owner, 2026-10-29: "verse doesnt fight any sight ... its assimilate"); the old name V01D never shows to a person (AGENTS.md)
const WORDING = [[/\bfight(?:s|ing)?\b/i, 'says "fight": Verse assimilates'], [/\bV01D\b/, 'says the old name V01D']];
const clip = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, WHY_MAX);
const tool = (path) => !NOT_TOOLS.includes(path) && !/^\/lab\//.test(path);

/** What one page was seen to do wrong: [{ kind, why }]. seen: { path, status, errors[], failed[{ url, status }], text, bg, toolRow, deadLinks[] }
 *  as tools/self-check.mjs read it from the rendered page. Pure. */
export function pageProblems(seen) {
  const s = seen || {}, out = [], add = (kind, why) => out.push({ kind, why: clip(why) });
  if (!(s.status >= 200 && s.status < 400)) { add('status', 'answers ' + (s.status || 'nothing')); return out; }
  for (const e of (s.errors || []).slice(0, 2)) add('script', e);
  for (const f of (s.failed || []).slice(0, 3)) add('request', (f.status || 'no answer') + ' ' + f.url);
  if (String(s.text || '').replace(/\s+/g, '').length < 20) add('empty', 'under 20 characters of text after it loaded');
  const l = luminance(s.bg); if (l !== null && l > 0.5) add('light', 'background ' + s.bg);
  for (const u of (s.deadLinks || []).slice(0, 3)) add('link', u.status + ' ' + u.url);
  for (const [re, why] of WORDING) { const m = String(s.text || '').match(new RegExp('.{0,40}' + re.source + '.{0,40}', re.flags)); if (m) add('wording', why + ': "' + m[0].trim() + '"'); }
  if (s.toolRow === false && tool(s.path)) add('unwired', 'no "Use with" row: the page is not tied to the other tools');
  return out;
}

/** The report the card shows. pages: [{ path, problems }] for every page opened. meta: { at, sha, how, of }. Pure. */
export function reportOf(pages, meta = {}) {
  const list = (pages || []).filter(Boolean), broken = list.filter((p) => p.problems && p.problems.length);
  const kinds = {}; for (const p of broken) for (const k of new Set(p.problems.map((x) => x.kind))) kinds[k] = (kinds[k] || 0) + 1;
  const rank = (p) => (p.problems.some((x) => SERIOUS.includes(x.kind)) ? 0 : 1);
  return {
    at: meta.at || new Date().toISOString(), sha: String(meta.sha || '').slice(0, 12), how: clip(meta.how || 'opened in headless Chrome'),
    of: Number(meta.of) || list.length, checked: list.length, fine: list.length - broken.length, broken: broken.length,
    serious: broken.filter((p) => rank(p) === 0).length, kinds,
    pages: broken.sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path)).slice(0, REPORT_MAX).map((p) => ({ path: clip(p.path), problems: p.problems.slice(0, 6).map((x) => ({ kind: String(x.kind), why: clip(x.why) })) })),
  };
}

/** a report as kept: only known fields, sizes capped, or null when it is not one. Pure (the API checks what the owner's job sends). */
export function cleanReport(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.pages) || !Number.isFinite(Number(r.checked))) return null;
  const pages = r.pages.slice(0, REPORT_MAX).filter((p) => p && typeof p.path === 'string' && p.path.startsWith('/') && Array.isArray(p.problems))
    .map((p) => ({ path: clip(p.path), problems: p.problems.slice(0, 6).filter((x) => x && KINDS[x.kind]).map((x) => ({ kind: x.kind, why: clip(x.why) })) }));
  const n = (v) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)));
  const kinds = {}; for (const k of Object.keys(KINDS)) if (r.kinds && r.kinds[k]) kinds[k] = n(r.kinds[k]);
  const at = Date.parse(r.at); if (!Number.isFinite(at)) return null;
  return { at: new Date(at).toISOString(), sha: String(r.sha || '').replace(/[^0-9a-f]/gi, '').slice(0, 12), how: clip(r.how), of: n(r.of), checked: n(r.checked), fine: n(r.fine), broken: n(r.broken), serious: n(r.serious), kinds, pages };
}

/** the status card's section on Verse's own pages. esc: the stage's escaper. Pure. */
export function pagesHtml(r, esc, now = Date.now()) {
  if (!r) return '<h3 style="margin:12px 0 4px;font-size:15px">Verse’s own pages</h3><p style="color:#8a8a92;margin:4px 0">Not checked yet: the page check runs after a deploy.</p>';
  const ago = Math.max(0, Math.round((now - Date.parse(r.at)) / 60000)), when = ago < 90 ? ago + ' min ago' : Math.round(ago / 60) + ' h ago';
  const dot = (serious) => '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:' + (serious ? '#e0584a' : '#d29922') + '"></span>';
  const head = r.broken ? '<span style="color:#e0584a">' + r.broken + ' of ' + r.checked + ' pages need a fix</span>' + (r.serious ? ' · ' + r.serious + ' broken' : '') : 'all ' + r.checked + ' pages fine';
  const kinds = Object.entries(r.kinds || {}).map(([k, n]) => esc(KINDS[k] || k) + ' ' + n).join(' · ');
  return '<h3 style="margin:12px 0 4px;font-size:15px">Verse’s own pages · ' + head + '</h3>'
    + '<p class="status-pages-how" style="color:#8a8a92;margin:4px 0">' + r.checked + (r.of && r.of !== r.checked ? ' of the ' + r.of : '') + ' pages in the sitemap ' + esc(r.how) + ', ' + when + (r.sha ? ' on ' + esc(r.sha.slice(0, 7)) : '') + (kinds ? ' · ' + kinds : '') + '</p>'
    + (r.pages.length ? '<table style="border-collapse:collapse">' + r.pages.slice(0, 25).map((p) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap;vertical-align:top">' + dot(p.problems.some((x) => SERIOUS.includes(x.kind))) + '<a href="' + esc(p.path) + '">' + esc(p.path) + '</a></td><td style="color:#8a8a92;padding:3px 0">'
      + p.problems.map((x) => '<b>' + esc(KINDS[x.kind] || x.kind) + '</b>: ' + esc(x.why)).join('<br>') + '</td></tr>').join('') + '</table>'
      + (r.pages.length > 25 ? '<p style="color:#8a8a92;margin:4px 0">and ' + (r.broken - 25) + ' more in GET /api/selfcheck</p>' : '') : '');
}
