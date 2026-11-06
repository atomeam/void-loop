// Every lab experiment opens a working tool (the owner asked on 2026-11-06 for every lab experiment to become a useful tool).
// An experiment page keeps its demo, and its footer bar gains "Use it: <tool>", the tool its idea became (tools/lab-grade.mjs IDEAS, or the
// nearest one in FOLDS). /lab/use-it.js opens that tool over the demo, by itself on the first visit of a session, so the address does the job.
//   node tools/lab-use-it.mjs            gives every published experiment its tool, fills the idea of any catalog entry that had none, redraws the gallery
//   node tools/lab-use-it.mjs --check    exits 1 when an experiment page lacks its tool (the lab tests run this)
// tools/lab-sync.mjs calls applyAll after every import, so each new draft is published with its tool. Tested in tools/lab-use-it.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ideaOf, foldOf, toolOf } from './lab-grade.mjs';
import { barOf, readCatalog, writeCatalog } from './lab-import.mjs';

export { barOf };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LAB = path.join(root, 'void-live-deploy', 'lab');
export const USE_JS = '/lab/use-it.js';

const BAR = /<footer class="vl-bar">[\s\S]*?<\/footer>(?:<script src="\/lab\/use-it\.js" defer><\/script>)?/;
/** the page with its bar set to barOf(tool); the same page back when it has no bar. Idempotent. Pure. */
export function withTool(html, tool) { return BAR.test(html) ? String(html).replace(BAR, () => barOf(tool)) : String(html); }
/** the tool a catalog entry opens: null for a draft graded a tool (it is one already) or a broken one. Pure. */
export function toolForEntry(e) { return e && e.grade === 'toy' && e.idea ? toolOf(e.idea) : null; }

/** the catalog with an idea on every toy that had none (its name and title read as ideaOf reads a draft, else its fold). Pure. */
export function backfill(catalog) {
  return catalog.map((e) => {
    if (e.grade !== 'toy' || e.idea) return e;
    const d = { dir: e.source || e.slug, spec: '# ' + (e.title || '') }, i = ideaOf(d);
    return i ? { ...e, idea: i.key } : { ...e, idea: foldOf(d).key, folded: true };
  });
}

/** gives every published experiment in lab its tool. Returns { pages, tools, changed, missing: [slugs still without one] }. */
export function applyAll({ lab = LAB, catalog, write = true } = {}) {
  let pages = 0, tools = 0, changed = 0; const missing = [];
  for (const e of catalog) {
    const f = path.join(lab, e.slug, 'index.html'); if (!fs.existsSync(f)) continue; pages++;
    const tool = toolForEntry(e), was = fs.readFileSync(f, 'utf8'), now = withTool(was, tool);
    if (tool) { if (now.includes('class="vl-use"')) tools++; else missing.push(e.slug); }
    if (now !== was) { changed++; if (write) fs.writeFileSync(f, now); }
  }
  return { pages, tools, changed, missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), was = readCatalog(LAB), catalog = check ? was : backfill(was);
  if (!check) writeCatalog(catalog, LAB);
  const r = applyAll({ catalog, write: !check }), need = catalog.filter((e) => toolForEntry(e) && fs.existsSync(path.join(LAB, e.slug, 'index.html'))).length;
  const stale = check ? catalog.filter((e) => toolForEntry(e) && fs.existsSync(path.join(LAB, e.slug, 'index.html')) && withTool(fs.readFileSync(path.join(LAB, e.slug, 'index.html'), 'utf8'), toolForEntry(e)) !== fs.readFileSync(path.join(LAB, e.slug, 'index.html'), 'utf8')) : [];
  console.log('lab-use-it: ' + r.pages + ' experiment pages, ' + r.tools + ' of ' + need + ' open their tool' + (check ? '' : ', ' + r.changed + ' rewritten'));
  if (check && (r.missing.length || stale.length)) { console.error('lab-use-it: without their tool: ' + [...new Set([...r.missing, ...stale.map((e) => e.slug)])].slice(0, 20).join(', ') + ' (run node tools/lab-use-it.mjs)'); process.exit(1); }
}
