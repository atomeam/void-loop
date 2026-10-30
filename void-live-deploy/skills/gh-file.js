/**
 * gh-file skill - one file from GitHub, read in Verse (owner, 2026-10-24: Verse eats GitHub from the smallest piece; after gists, the file view).
 * A pasted github.com file link ("…/blob/main/src/a.js#L10-L20") or a raw.githubusercontent.com link: the file, coloured and numbered, the linked
 * lines lit, read straight from GitHub's public raw address (no Verse server, no token, nothing stored). "Open the whole file" goes to
 * a-to-mind.com/g/?gh=…, where "Edit a copy" turns it into a gist. Ranked before the repo skill, which keeps plain repo links.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { ghFileOf, ghFilePage, ghFileText, renderCode } from '../lib/gist.js';

const SHOW = 80; // lines on the card; the page has the rest
const CSS = '<style>.vpage:has(.ghf-box) .vc-art{display:none}.ghf-box{position:relative;max-height:60vh;overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(0,0,0,.25)}'
  + '.ghf-box pre{margin:0;padding:8px 10px;display:grid;grid-template-columns:auto 1fr;gap:0 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}'
  + '.ghf-box .ln{opacity:.45;text-align:right;user-select:none}.ghf-box .c{color:#8f8aa8;font-style:italic}.ghf-box .s{color:#7ee0a0}.ghf-box .n{color:#ffb27a}.ghf-box .k{color:#b9a2ff;font-weight:600}'
  + '.ghf-box .lit{background:rgba(255,209,102,.22);display:inline-block;min-width:100%}.ghf-links{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0;font-size:13px}</style>';

async function run(text, api) {
  const f = ghFileOf(text);
  if (!f) return 'none';
  const { showPage, esc } = api;
  const el = showPage((card) => {
    // the card's "Open the full page" link (lib/card-frame.js PAGE_OF) opens this same file on /g/, not an empty snippet
    card.dataset.page = ghFilePage(f);
    card.innerHTML = CSS + '<h2>' + esc(f.name) + '</h2><div class="sub">' + esc(f.owner + '/' + f.repo) + ' · reading it from GitHub…</div><div class="ghf-box"></div>'
      + '<div class="ghf-links"><a class="ghf-full" href="' + esc(ghFilePage(f)) + '" target="_blank" rel="noopener">Open the whole file</a><a href="' + esc(f.page) + '" target="_blank" rel="noopener">On GitHub</a></div>'
      + '<div class="src">Read from GitHub\'s public raw address; nothing is stored. Public repositories only.</div>';
  });
  if (!el || !el.querySelector) return 'gh-file';
  const r = await ghFileText(f), sub = el.querySelector('.sub'), box = el.querySelector('.ghf-box');
  if (r.error) { sub.textContent = r.error; box.remove(); return 'gh-file'; }
  const lines = r.text.replace(/\n$/, '').split('\n'), n = lines.length;
  // the linked lines and a little around them, else the top of the file
  const from = f.lines ? Math.max(1, f.lines[0] - 10) : 1, to = Math.min(n, Math.max(from + SHOW - 1, f.lines ? f.lines[1] + 10 : 0));
  const part = lines.slice(from - 1, to).join('\n'), lit = f.lines ? [f.lines[0] - from + 1, f.lines[1] - from + 1] : null;
  renderCode(box, f.name, part, lit);
  if (from > 1) box.querySelectorAll('.ln').forEach((x) => { x.textContent = Array.from({ length: to - from + 1 }, (_, i) => from + i).join('\n'); });
  sub.textContent = f.owner + '/' + f.repo + ' · ' + n.toLocaleString('en') + ' line' + (n === 1 ? '' : 's') + (to - from + 1 < n ? ' · showing ' + from + '–' + to : '');
  const first = box.querySelector('.lit'); if (first) box.scrollTop = Math.max(0, first.offsetTop - box.clientHeight / 2); // inside the box only: the card keeps its title in view
  return 'gh-file';
}

export default {
  name: 'gh-file',
  examples: ['https://github.com/atomeam/void-loop/blob/main/README.md', 'https://github.com/nodejs/node/blob/main/README.md#L1-L10', 'https://raw.githubusercontent.com/nodejs/node/main/README.md'],
  nearMisses: ['https://github.com/atomeam/void-loop', 'look at atomeam/void-loop', 'github.com/nodejs/node/issues/1'],
  match(lower, text) { return !!ghFileOf(text || lower); },
  run
};
