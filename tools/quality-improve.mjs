// The quality engine's fixes. Each is a shared component or a measured rule that lifts every page it is given to, applied to the page's own
// file as one small, reversible change that carries its own signature (what must be in the live page once it is out) and its own undo.
// A fix reaches the target page and the pages like it (the same family, the same weakness), so one change lifts many.
import fs from 'node:fs';
import path from 'node:path';
import { rulesFor, bareRules, withBlock, blockRules, START as DESIGN_START, END as DESIGN_END } from './design-loop.mjs';

export const POLISH = '<link rel="stylesheet" href="/lib/verse-polish.css">';
export const SCENE = '<script type="module" src="/lib/verse-scene.js"></script>';
/** pages a fix never edits: the home (its starfield and heart stay as they are), the games and labs (their own canvases), the Echo Vault page, and anything that is not a plain page */
export const HANDS_OFF = /^\/$|^\/(?:arcade|echo-vault|games|lab|boards|fanfic|calendar\/embed)(?:\/|$)|debris-field/;
const into = (html, tag) => (/<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>') : null);
const without = (html, tag) => html.replace('\n' + tag, '').replace(tag, '');

export const IMPROVERS = Object.freeze({
  scene3d: {
    criterion: 'graphics', what: 'a real-time 3D backdrop (WebGL2, a light phone tier, 60 fps) from the shared scene',
    applies: (row, html, route) => !HANDS_OFF.test(route) && !html.includes('id="blub"') && !html.includes('verse-scene.js') && /<\/head>/i.test(html) && /<body/i.test(html),
    apply: (html) => into(html, SCENE), undo: (html) => without(html, SCENE), signature: 'verse-scene.js',
  },
  polish: {
    criterion: 'motion', what: 'eased hover, press and focus feedback and reduced motion, from the shared polish stylesheet',
    applies: (row, html, route) => !HANDS_OFF.test(route) && !html.includes('verse-polish.css') && /<\/head>/i.test(html),
    apply: (html) => into(html, POLISH), undo: (html) => without(html, POLISH), signature: 'verse-polish.css',
  },
  design: {
    criterion: 'layout', what: 'the colours and sizes that fix every contrast and tap-target failure the page measured',
    applies: (row, html, route, details) => !HANDS_OFF.test(route) && !!details && !!details.fail && (details.fail.contrast.length + details.fail.targets.length + (details.fail.bare ? details.fail.bare.unstyled.length + details.fail.bare.empty.length : 0)) > 0,
    apply: (html, details) => { const rules = { ...rulesFor(details.fail), ...bareRules(details.fail.bare) }; return Object.keys(rules).length ? withBlock(html, rules) : null; },
    undo: (html) => { const a = html.indexOf(DESIGN_START), b = html.indexOf(DESIGN_END); if (a < 0 || b < a) return html; return html.slice(0, a).replace(/<style>\s*$/, '') + html.slice(b + DESIGN_END.length).replace(/^\s*<\/style>\n?/, ''); },
    signature: 'verse design loop',
  },
});
const ORDER_BY_CRITERION = { graphics: ['scene3d'], motion: ['polish'], layout: ['design'] };

/** the page file for a route in the checkout, or null */
export function fileOf(root, route) {
  const f = path.join(root, 'void-live-deploy', route.replace(/^\//, ''), 'index.html');
  return fs.existsSync(f) ? f : null;
}
/** the fixes that can lift this surface, best first: the criteria it loses the most on, each with an improver that applies, ranked by what has worked. Pure over the page text. */
export function candidates(row, html, route, details, stats, rank) {
  const out = [];
  for (const w of row.score.weakest) for (const id of rank(ORDER_BY_CRITERION[w.id] || [], stats)) { const I = IMPROVERS[id]; if (I && !out.includes(id) && I.applies(row, html, route, details)) out.push(id); }
  return out;
}
/** apply one fix to a page file in the checkout; returns { file, signature } or null when nothing changed. */
export function applyTo(root, route, id, details) {
  const f = fileOf(root, route); if (!f) return null;
  const html = fs.readFileSync(f, 'utf8'), next = IMPROVERS[id].apply(html, details);
  if (!next || next === html) return null;
  fs.writeFileSync(f, next);
  return { file: path.relative(root, f), signature: IMPROVERS[id].signature };
}
export function undoOn(root, route, id) {
  const f = fileOf(root, route); if (!f) return null;
  const html = fs.readFileSync(f, 'utf8'), next = IMPROVERS[id].undo(html);
  if (next === html) return null;
  fs.writeFileSync(f, next); return { file: path.relative(root, f) };
}
