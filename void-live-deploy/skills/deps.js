/**
 * deps skill - "dependency map", "what depends on lib/where.js", "who imports skills/scene3d.js": who imports whom under the site's
 * own code, from skills/deps.json (tools/deps.mjs reads the import lines of skills/**, lib/** and functions/**; nothing is
 * guessed). Asked by Verse (its reflection of 2026-10-12, ask-20261012-1942-2): "Create a 'dependency map' visualization that
 * shows which skills (like 'forge') are most impacted by changes in core code imports."
 * The card: the lib files the most skills depend on (directly or through another file), one row each with a bar; tap a row to
 * see every dependant, skills first. "what depends on <file>" opens the card on that file. One accent (--d-key).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export const DEPS_URL = '/skills/deps.json';
const TOP = 12;

const norm = (t) => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
const FILE = "((?:lib|skills|functions)/[a-z0-9_./-]+|[a-z0-9_.-]+\\.m?js)";
const MAP = new RegExp('^(?:(?:show|open|give|draw)(?:\\s+me)?\\s+)?(?:the\\s+|your\\s+|void\'?s\\s+|v01d\'?s\\s+)?(?:code\\s+|import\\s+|skill\\s+)?dependenc(?:y|ies)\\s+(?:map|graph|tree)$|^(?:what|which)\\s+(?:lib\\s+)?files?\\s+(?:do\\s+)?(?:the\\s+)?(?:most\\s+)?skills\\s+depend\\s+on$', 'i');
const ONE = new RegExp('^(?:(?:show|tell)\\s+me\\s+)?(?:what|who|which\\s+(?:skills|files))\\s+(?:depends?\\s+on|imports?|uses?|needs?)\\s+(?:the\\s+)?' + FILE + '$|^(?:dependants|dependents|importers|dependencies)\\s+of\\s+' + FILE + '$|^' + FILE + '\\s+(?:dependants|dependents|importers)$', 'i');
/** the ask as the card reads it: { file } for one file's dependants, {} for the whole map, null for anything else. Pure. */
export function parseAsk(t) {
  const s = norm(t);
  if (MAP.test(s)) return {};
  const m = ONE.exec(s);
  if (!m) return null;
  return { file: (m[1] || m[2] || m[3]).replace(/^\/+/, '') };
}

/** the file the ask named, found in the map: an exact path, else the one file whose name matches (lib/where.js for "where.js"). Pure. */
export function findFile(deps, name) {
  const files = Object.keys((deps && deps.files) || {});
  if (!name) return null;
  if (files.includes(name)) return name;
  const base = name.split('/').pop();
  const hits = files.filter((f) => f.split('/').pop() === base);
  return hits.length === 1 ? hits[0] : hits.find((f) => f.startsWith('lib/')) || hits[0] || null;
}

/** the card's rows: the top lib files with their counts, and the dependants of one file when asked. Pure. */
export function rows(deps, top = TOP) {
  const libs = ((deps && Array.isArray(deps.libs) && deps.libs) || []).filter((l) => l && l.file).slice(0, top);
  return { libs, max: Math.max(1, ...libs.map((l) => Number(l.skills) || 0)), counted: Number(deps && deps.counted) || Object.keys((deps && deps.files) || {}).length };
}
/** every dependant of one file, grouped: skills, then lib, then functions, each sorted; direct ones first in each group. Pure. */
export function dependantsOf(deps, file) {
  const f = deps && deps.files && deps.files[file];
  if (!f) return null;
  const direct = new Set(f.importedBy || []), all = [...(f.importedBy || []), ...(f.reachedBy || [])];
  const group = (re) => all.filter((p) => re.test(p)).sort((a, b) => (direct.has(b) - direct.has(a)) || (a < b ? -1 : 1)).map((p) => ({ file: p, direct: direct.has(p) }));
  return { file, imports: f.imports || [], skills: group(/^skills\//), lib: group(/^lib\//), functions: group(/^functions\//), total: all.length };
}

const pct = (n, of) => (of ? Math.round((n / of) * 1000) / 10 : 0);
function listHtml(esc, label, items) {
  if (!items.length) return '';
  return '<div class="sub" style="font-size:12px;margin:8px 0 2px">' + esc(label) + ' (' + items.length + ')</div><ul class="dp-list" style="list-style:none;margin:0;padding:0">'
    + items.map((d) => '<li data-dep="' + esc(d.file) + '" style="padding:3px 0;font-size:13px;font-variant-numeric:tabular-nums"><code style="font-family:inherit;color:var(--d-ink,#f2f4fb)">' + esc(d.file) + '</code>'
      + (d.direct ? '' : ' <span class="sub" style="font-size:12px">through another file</span>') + '</li>').join('') + '</ul>';
}
/** one file's dependants as HTML (the open row, or the whole answer to "what depends on x"). Pure. */
export function fileHtml(esc, deps, file) {
  const D = dependantsOf(deps, file);
  if (!D) return '<p>No file called <code>' + esc(file) + '</code> is in the map. Paths look like lib/where.js or skills/scene3d.js.</p>';
  return '<div class="dp-file" data-file="' + esc(file) + '">'
    + '<div class="sub" style="font-size:13px;margin:4px 0 0">' + (D.total ? D.total + ' file' + (D.total === 1 ? '' : 's') + ' depend' + (D.total === 1 ? 's' : '') + ' on <code>' + esc(file) + '</code>: ' + D.skills.length + ' skill' + (D.skills.length === 1 ? '' : 's') + ', ' + D.lib.length + ' lib, ' + D.functions.length + ' server route' + (D.functions.length === 1 ? '' : 's') + '.' : 'Nothing imports <code>' + esc(file) + '</code>.')
    + (D.imports.length ? ' It imports ' + D.imports.length + ': ' + D.imports.map((i) => '<code>' + esc(i) + '</code>').join(', ') + '.' : '') + '</div>'
    + listHtml(esc, 'Skills', D.skills) + listHtml(esc, 'Shared code', D.lib) + listHtml(esc, 'Server routes', D.functions) + '</div>';
}

/** the whole card's body (below the title); `open` is a file to start expanded. Pure. */
export function mapHtml(esc, deps, open) {
  const R = rows(deps);
  if (!R.libs.length) return '<p>The dependency map could not be read just now. Ask again in a moment.</p>';
  return '<div class="sub" style="font-size:13px;margin:2px 0 10px">' + R.counted + ' files read by their import lines. The shared code the most skills depend on, directly or through another file; a change there reaches every skill listed.</div>'
    + '<div class="dp-rows">' + R.libs.map((l) => { const isOpen = open === l.file; return '<div class="dp-lib" data-lib="' + esc(l.file) + '">'
      + '<button type="button" aria-expanded="' + (isOpen ? 'true' : 'false') + '" data-open="' + esc(l.file) + '" style="all:unset;box-sizing:border-box;display:block;width:100%;min-height:44px;padding:8px 0;cursor:pointer;border-top:1px solid rgba(255,255,255,.06)">'
      + '<span style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:5px"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(l.file) + '</b>'
      + '<span class="sub dp-count" data-skills="' + (Number(l.skills) || 0) + '" style="font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap">' + (Number(l.skills) || 0) + ' skill' + (l.skills === 1 ? '' : 's') + ', ' + (Number(l.dependants) || 0) + ' in all <span aria-hidden="true">›</span></span></span>'
      + '<div class="dp-bar" role="img" aria-label="' + esc(l.file + ': ' + l.skills + ' skills depend on it') + '" style="height:8px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.04);box-shadow:0 0 0 1px rgba(255,255,255,.06) inset"><span style="display:block;height:100%;width:' + pct(Number(l.skills) || 0, R.max) + '%;background:rgb(var(--d-key, 158 178 255) / .85)"></span></div>'
      + '</button><div class="dp-open"' + (isOpen ? '' : ' hidden') + '>' + (isOpen ? fileHtml(esc, deps, l.file) : '') + '</div></div>'; }).join('') + '</div>'
    + (open && !R.libs.some((l) => l.file === open) ? '<div class="dp-asked" style="margin-top:12px"><b style="font-weight:600;color:var(--d-ink,#f2f4fb)">' + esc(open) + '</b>' + fileHtml(esc, deps, open) + '</div>' : '')
    + '<div class="sub" style="font-size:12px;line-height:1.5;margin-top:10px">Tap a file to see what depends on it. Ask "what depends on lib/where.js" for any file. Static imports only: a path built at run time is not in the map.</div>'
    + '<div class="src">Source: skills/deps.json, written from the import lines by tools/deps.mjs</div>';
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const ask = parseAsk(text) || {};
  const head = '<h2>What depends on what</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">reading the map…</div>'; }); // void-review: ok (head is a constant heading; nothing from a user)
  let deps = null;
  try { const r = await fetch(DEPS_URL, { cache: 'no-cache' }); deps = r.ok ? await r.json() : null; } catch (_) { deps = null; }
  if (!el || (_pageStill && !_pageStill(el))) return 'deps';
  const open = ask.file ? findFile(deps, ask.file) || ask.file : null;
  el.innerHTML = head + mapHtml(esc, deps, open);
  el.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button[data-open]'); if (!b) return;
    const box = b.parentNode && b.parentNode.querySelector('.dp-open'); if (!box) return;
    const show = box.hidden; box.hidden = !show; b.setAttribute('aria-expanded', String(show));
    if (show && !box.innerHTML) box.innerHTML = fileHtml(esc, deps, b.getAttribute('data-open'));
  });
  return 'deps';
}

// checked by tools/skills-check.mjs on every run: the asks it takes, the rows and the HTML on a made-up map
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const deps = { counted: 4, libs: [{ file: 'lib/a.js', skills: 2, direct: 1, dependants: 3 }, { file: 'lib/b.js', skills: 0, direct: 0, dependants: 0 }],
    files: { 'lib/a.js': { imports: [], importedBy: ['lib/b.js', 'skills/x.js'], reachedBy: ['skills/y.js'] }, 'lib/b.js': { imports: ['lib/a.js'], importedBy: [] }, 'skills/x.js': { imports: ['lib/a.js'], importedBy: [] }, 'skills/y.js': { imports: ['lib/b.js'], importedBy: [] } } };
  const D = dependantsOf(deps, 'lib/a.js'), h = mapHtml(esc, deps, null), o = mapHtml(esc, deps, 'lib/a.js');
  const ok = JSON.stringify(parseAsk('Show me the dependency map?')) === '{}' && JSON.stringify(parseAsk('what depends on lib/where.js')) === '{"file":"lib/where.js"}'
    && JSON.stringify(parseAsk('who imports scene3d.js')) === '{"file":"scene3d.js"}' && parseAsk('what depends on the weather') === null && parseAsk('map') === null && parseAsk('dependency injection') === null
    && findFile(deps, 'a.js') === 'lib/a.js' && findFile(deps, 'skills/x.js') === 'skills/x.js' && findFile(deps, 'zzz.js') === null
    && D.total === 3 && D.skills.map((s) => s.file + (s.direct ? '' : '*')).join() === 'skills/x.js,skills/y.js*' && D.lib.length === 1 && D.functions.length === 0
    && rows(deps).max === 2 && h.includes('data-lib="lib/a.js"') && h.includes('4 files read') && !h.includes('class="dp-file"') && o.includes('class="dp-file"') && o.includes('3 files depend on')
    && mapHtml(esc, deps, 'lib/zz.js').includes('No file called <code>lib/zz.js</code>') && mapHtml(esc, null).includes('could not be read') && !fileHtml(esc, deps, '<b>').includes('<b>');
  return { ok, got: ok ? '' : JSON.stringify({ D, parse: [parseAsk('what depends on lib/where.js'), parseAsk('who imports scene3d.js')] }) };
}

export default {
  name: 'deps',
  examples: ['dependency map', 'show me the dependency map', 'what depends on lib/where.js', 'who imports skills/scene3d.js', 'show me your dependency graph',
    'which files do the most skills depend on', 'dependants of lib/ask-text.js', 'what uses lib/guard.js', 'code dependency map'],
  nearMisses: ['map', 'dependency injection', 'what depends on the weather', 'show me a map', 'map of paris', 'who imports coffee', 'dependencies', 'npm dependencies'],
  suite,
  match(lower, text) { return parseAsk(text || lower) !== null; },
  run,
};
