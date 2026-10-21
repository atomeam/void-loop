// The tome: the Verse Book read the way Skyrim's books are read (owner, 2026-10-16: "research how the books on Skyrim work and
// make it like that ... its supposed to be the graphic style and visuals of the way they do books"). In Skyrim a book you pick
// up fills the screen: the world dims behind it, a worn leather tome lies open on two parchment pages set in a serif with the
// text of the book and nothing else (no menu, no tabs, no chrome), and your only controls are turning the page and closing it.
// This file is the pure half: the tome's CSS and every page typeset for parchment (a running head, a title with a rule, a drop
// capital, the asks as lines of italic ink, the folio in the outer corner). skills/guide.js mounts it full screen and turns the
// leaves. The content is the same skills/guide.json page data the generator writes (lib/guide.js), so nothing is left out.
import { glyphSvg, openerSvg, TIERS, TIER_MEANING } from './guide.js';
import { artSvg, seasonOf } from './card-art.js';
import { rulesPageHtml, RULES_CSS } from './rule-registry.js';

export const SERIF = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "URW Palladio L", Georgia, "Times New Roman", serif';

// parchment grain and foxing, two tiny SVG tiles (no image files): a fine noise and a sparse mottle
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .25 0 0 0 0 .12 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")";
const MOTTLE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='420'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.012' numOctaves='2' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .28 0 0 0 0 .08 0 0 0 .55 -.22'/%3E%3C/filter%3E%3Crect width='420' height='420' filter='url(%23m)'/%3E%3C/svg%3E\")";

/** the whole look, one stylesheet. Pure. */
export const TOME_CSS = [
  // the screen: the stage dims behind the book (as the world does in Skyrim); nothing of the page's own chrome shows through
  'html.v-tome #stage{filter:brightness(.42) blur(2px);transition:filter .5s ease}html.v-tome #void-syn{opacity:.25}',
  'html.vtome-open,html.vtome-open body{overscroll-behavior:none}#vtome{touch-action:pan-y;position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;perspective:2200px;perspective-origin:50% 45%;font-family:' + SERIF + ';color:#2b1b0e;opacity:0;transition:opacity .35s ease}#vtome.on{opacity:1}',
  '#vtome .tome-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(14,10,6,.45),rgba(5,4,2,.9) 78%)}',
  // the book: height-led so two pages always fit; everything inside is sized from the book (cqh), so it reads the same on any screen
  '.tome{position:relative;--th:min(86vh,calc(94vw / 1.46));height:var(--th);width:calc(var(--th) * 1.46);container-type:size;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.4,.1,.2,1)}',
  '.tome.shut{transform:translateX(-25%) scale(.96)}',
  '.tome.shut .tome-page,.tome.shut .tome-stack{opacity:0;transition:opacity .25s ease}.tome-page,.tome-stack{transition:opacity .25s ease}',
  // boards and spine: dark worn leather with a blind-tooled double border
  '.tome-boards{position:absolute;inset:-1.6% -1.4%;border-radius:.6% 1.4% 1.4% .6%/.9% 2% 2% .9%;background:linear-gradient(135deg,#3a2616,#24170d 45%,#1b110a);box-shadow:0 40px 90px rgba(0,0,0,.75),0 6px 18px rgba(0,0,0,.6),inset 0 0 0 1px rgba(205,165,95,.22),inset 0 0 0 5px rgba(0,0,0,.25),inset 0 0 0 6px rgba(205,165,95,.14)}',
  '.tome-boards::after{content:"";position:absolute;inset:0;background:' + GRAIN + ';opacity:.5;border-radius:inherit;mix-blend-mode:multiply}',
  '.tome-spine{position:absolute;top:-1.6%;bottom:-1.6%;left:50%;width:4%;transform:translateX(-50%);background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.55) 42%,rgba(0,0,0,.62) 58%,rgba(0,0,0,0));z-index:3;pointer-events:none}',
  // the pages: parchment, darker at the edges and in the gutter, grained and foxed
  '.tome-page,.tome-face{filter:var(--tome-tone,none);transition:filter .6s ease}', // the site's health tints the parchment (parchmentFilter)
  '.tome-page,.tome-face{position:absolute;top:0;bottom:0;width:50%;box-sizing:border-box;padding:6.2cqh 6cqh 7.4cqh;overflow-y:auto;overflow-x:hidden;background-color:#e6d5ae;'
    + 'background-image:radial-gradient(ellipse at 18% 12%,rgba(255,250,236,.5),rgba(255,250,236,0) 55%),radial-gradient(ellipse at 85% 90%,rgba(110,70,25,.16),rgba(110,70,25,0) 55%),' + MOTTLE + ',' + GRAIN + ';'
    + 'background-size:auto,auto,420px 420px,160px 160px;box-shadow:inset 0 0 7cqh rgba(95,58,18,.26);color:#2b1b0e;line-height:1.46;font-size:2.35cqh}',
  '.tome-page::-webkit-scrollbar,.tome-face::-webkit-scrollbar{width:5px}.tome-page::-webkit-scrollbar-thumb,.tome-face::-webkit-scrollbar-thumb{background:rgba(109,76,42,.4);border-radius:2px}.tome-page,.tome-face{scrollbar-width:thin;scrollbar-color:rgba(109,76,42,.4) transparent}',
  '.tome-page.left{left:0;border-radius:.6% 0 0 .6%/.9% 0 0 .9%;box-shadow:inset 0 0 7cqh rgba(95,58,18,.26),inset -5cqh 0 6cqh -4cqh rgba(60,35,10,.5)}',
  '.tome-page.right{right:0;border-radius:0 .6% .6% 0/0 .9% .9% 0;box-shadow:inset 0 0 7cqh rgba(95,58,18,.26),inset 5cqh 0 6cqh -4cqh rgba(60,35,10,.5)}',
  // the thickness of what is not open: the leaves stacked at each outer edge, more on the side you have read
  '.tome-stack{position:absolute;top:.6%;bottom:.6%;width:calc(.5cqh + var(--k,0) * 3cqh);background:repeating-linear-gradient(90deg,#efe3c4 0,#efe3c4 1px,#cdb98d 1px,#cdb98d 2px);box-shadow:0 0 .6cqh rgba(0,0,0,.35)}',
  '.tome-stack.left{right:100%;border-radius:.4cqh 0 0 .4cqh}.tome-stack.right{left:100%;border-radius:0 .4cqh .4cqh 0}',
  // type: a running head, a title with a rule, a lead paragraph with a drop capital, the asks as lines of ink, the folio outside
  '.tome-head{position:absolute;top:2.6cqh;left:6cqh;right:6cqh;font-size:1.65cqh;letter-spacing:.2em;text-transform:uppercase;color:#6d4c2a;display:flex;justify-content:space-between}',
  '.tome-folio{position:absolute;bottom:3cqh;font-size:1.9cqh;letter-spacing:.12em;color:#6d4c2a}.tome-page.left .tome-folio,.tome-face.left .tome-folio{left:6cqh}.tome-page.right .tome-folio,.tome-face.right .tome-folio{right:6cqh}',
  '.tome-kicker{font-size:1.75cqh;letter-spacing:.22em;text-transform:uppercase;text-align:center;color:#6d4c2a;margin:0 0 .6cqh}',
  '.tome-title{font-variant:small-caps;letter-spacing:.05em;font-size:4.2cqh;line-height:1.1;text-align:center;margin:0;color:#2b1b0e;font-weight:600}.tome-title small{display:block;font-variant:normal;font-size:2cqh;letter-spacing:.08em;color:#6d4c2a;margin-top:.3cqh}',
  '.tome-title.big{font-size:6.4cqh;margin-top:12cqh}.tome-rule{height:1px;margin:1.4cqh 14% 2cqh;background:linear-gradient(90deg,rgba(60,35,10,0),rgba(60,35,10,.6),rgba(60,35,10,0))}',
  '.tome-body p{margin:0 0 1.1cqh;text-align:justify;hyphens:auto;text-wrap:pretty;overflow-wrap:break-word;word-break:break-word}.tome-body p.lead::first-letter{float:left;font-size:3.1em;line-height:.8;padding:.06em .1em 0 0;color:#5a2412;font-weight:600}',
  '.tome-body .tome-note{font-style:italic;color:#4f3418;text-align:left}.tome-body .tome-sub{text-align:center;color:#6d4c2a;font-size:2cqh;letter-spacing:.06em;margin:1cqh 0}',
  '.tome-epigraph{font-style:italic;text-align:center;color:#5a3a1c;font-size:2.1cqh;margin:-.6cqh 6% 1.8cqh;line-height:1.4}',
  '.tome-say{margin:1.6cqh 0 .4cqh;font-variant:small-caps;letter-spacing:.14em;color:#6d4c2a;font-size:2cqh}',
  '.tome-try{margin:0;padding:0;list-style:none}.tome-try li{margin:.5cqh 0;font-style:italic;padding-left:2.2cqh;text-indent:-2.2cqh}.tome-try li::before{content:"\\2014  ";font-style:normal;color:#7a4a22}',
  '.tome a{color:#3a2412;text-decoration:none;border-bottom:1px dotted rgba(90,50,20,.6);cursor:pointer}.tome a:hover{color:#7a2a12;border-bottom-color:currentColor}',
  '.tome-art{margin:0 0 1.2cqh;border:1px solid rgba(74,46,22,.5);border-radius:3px;overflow:hidden;background:#150d07;box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)}.tome-art svg{display:block;width:100%;height:auto}',
  '.tome-plate{float:right;margin:0 0 1cqh 2cqh;shape-outside:margin-box}.tome .gglyph{color:#4a2e16!important;filter:sepia(1) saturate(.55) brightness(.72);opacity:.9}',
  '.tome .gopener{display:flex;flex-wrap:wrap;justify-content:center;gap:.6cqh;margin:1.5cqh 0}.tome .gopener a{border:0;display:flex}',
  '.tome-list{margin:0;padding:0;list-style:none;columns:2;column-gap:4cqh;font-size:2cqh}.tome-list li{display:flex;align-items:baseline;margin:.35cqh 0;break-inside:avoid}.tome-list li a{border:0}.tome-list .lead-dots{flex:1;border-bottom:1px dotted rgba(90,50,20,.55);margin:0 .6cqh;transform:translateY(-.5cqh)}.tome-list .n{color:#6d4c2a}',
  '.tome-day{font-weight:700;font-size:2cqh;margin:1.2cqh 0 .1cqh;color:#4a2c12;border-bottom:1px solid rgba(122,74,34,.35)}.tome-newsl li{font-size:1.85cqh;line-height:1.3}.tome-tryit{font-size:1.6cqh;white-space:nowrap}.tome-showday{font-size:1.5cqh;font-weight:400;margin-left:1cqh;white-space:nowrap}.tome-new{font-style:normal;font-size:1.5cqh;color:#fff;background:#8f2d1c;border-radius:1cqh;padding:.1cqh .8cqh;vertical-align:middle}',
  '.tome-toc li{font-size:2.2cqh;margin:.75cqh 0}.tome-toc .tome-for{display:block;font-size:1.8cqh;font-style:italic;color:#6d4c2a;margin:.1cqh 0 0 2.2cqh}.tome-toc-dense li{font-size:1.9cqh;margin:.35cqh 0}.tome-toc-dense .tome-for{font-size:1.5cqh;margin:0 0 0 2.2cqh}',
  '.tome-legend dt{font-variant:small-caps;letter-spacing:.1em;color:#2b1b0e;margin-top:1cqh}.tome-legend dd{margin:0;font-style:italic;color:#4f3418}',
  '.tome-tier{position:absolute;bottom:2.6cqh;left:16%;right:16%;text-align:center;font-size:1.6cqh;line-height:1.35;color:#6d4c2a}.tome-tier b{display:block;font-weight:600;letter-spacing:.22em;text-transform:uppercase;font-size:1.75cqh;color:#4a2e16}.tome-tier span{font-style:italic;display:block;overflow-wrap:break-word}',
  // the leaf in the air: a sheet with a face on each side that swings about the spine
  '.tome-leaf{position:absolute;top:0;bottom:0;width:50%;transform-style:preserve-3d;z-index:4;transition:transform .72s cubic-bezier(.42,.05,.28,1);pointer-events:none}',
  '.tome-leaf.fwd{left:50%;transform-origin:left center}.tome-leaf.back{left:0;transform-origin:right center}',
  '.tome-face{left:0;right:auto;width:100%;backface-visibility:hidden}.tome-face.under{transform:rotateY(180deg)}',
  '.tome-leaf::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(0,0,0,0) 40%);opacity:0;transition:opacity .36s ease;pointer-events:none}.tome-leaf.going::after{opacity:1}',
  // the cover: shut it is all you see; it swings open on the spine in half a second (Skyrim's fBookOpenTime), then lies under the left page
  '.tome-cover{position:absolute;top:-1.6%;bottom:-1.6%;left:50%;width:calc(50% + 1.4%);transform-origin:left center;transform-style:preserve-3d;z-index:6;transition:transform .55s cubic-bezier(.4,.1,.2,1);transform:rotateY(0deg)}',
  // shutting the book does not swing the cover across the pages (owner, 2026-10-17: "the cover is popping up in the middle of the book when closed"):
  // the cover would appear at once, lying on the left page, and cross the spine; instead it fades in where it belongs while the book slides to the middle
  // a shut book is one board: the cover alone (or the back cover alone), not the cover beside an empty board
  '@media (min-width:701px){.tome.shut .tome-boards{clip-path:inset(-4% -4% -4% 50%)}.tome.shut.back .tome-boards{clip-path:inset(-4% 50% -4% -4%)}.tome-boards{transition:clip-path .35s ease}}',
  '.tome.shut .tome-cover{transition:none;animation:tome-cover-in .45s ease both}@keyframes tome-cover-in{from{opacity:0}to{opacity:1}}',
  '.tome.open .tome-cover{transform:rotateY(-180deg)}.tome.opened .tome-cover{visibility:hidden}',
  '.tome-cover .face{position:absolute;inset:0;backface-visibility:hidden;border-radius:0 1.4% 1.4% 0/0 2% 2% 0}',
  '.tome-cover .face.out{background:linear-gradient(135deg,#3f2a18,#25170d 50%,#1a110a);box-shadow:inset 0 0 0 1px rgba(205,165,95,.3),inset 0 0 0 6px rgba(0,0,0,.25),inset 0 0 0 7px rgba(205,165,95,.18),8px 0 30px rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#d6b35c}',
  '.tome-cover .face.out::before{content:"";position:absolute;inset:0;background:' + GRAIN + ';opacity:.45;mix-blend-mode:multiply;border-radius:inherit}',
  '.tome-cover .face.in{transform:rotateY(180deg);background:#e2d1a8;background-image:' + MOTTLE + ',' + GRAIN + ';box-shadow:inset 0 0 6cqh rgba(95,58,18,.3)}',
  '.tome-cover .seal{width:11cqh;height:11cqh;border-radius:50%;border:2px solid rgba(214,179,92,.75);box-shadow:inset 0 0 0 5px rgba(0,0,0,.2),inset 0 0 0 6px rgba(214,179,92,.5);display:flex;align-items:center;justify-content:center;font-size:4.4cqh;letter-spacing:.08em;font-weight:700;margin-bottom:3cqh;position:relative}',
  // the back cover: shown when the book is shut after its last page; the book slides the other way so this board is the one in the middle
  '.tome-backcover{position:absolute;top:-1.6%;bottom:-1.6%;left:-1.4%;width:calc(50% + 1.4%);z-index:6;display:none;flex-direction:column;align-items:center;text-align:center;color:rgba(214,179,92,.9);border-radius:1.4% 0 0 1.4%/2% 0 0 2%;background:linear-gradient(225deg,#3f2a18,#25170d 50%,#1a110a);box-shadow:inset 0 0 0 1px rgba(205,165,95,.3),inset 0 0 0 6px rgba(0,0,0,.25),inset 0 0 0 7px rgba(205,165,95,.18),-8px 0 30px rgba(0,0,0,.5);padding-top:6cqh;box-sizing:border-box}',
  '.tome-backcover .seal{width:9cqh;height:9cqh;border-radius:50%;border:2px solid rgba(214,179,92,.75);display:flex;align-items:center;justify-content:center;font-size:5cqh}.tome-backcover .cover-art{width:78%;margin:1.4cqh auto 0;border:1px solid rgba(214,179,92,.45);border-radius:4px;overflow:hidden;background:#120b06}.tome-backcover .cover-art svg{display:block;width:100%;height:auto}.tome-backcover .title{font-variant:small-caps;letter-spacing:.14em;font-size:4cqh;margin-top:2cqh}.tome-backcover .line{font-style:italic;font-size:2cqh;color:rgba(214,179,92,.8);margin-top:1cqh}',
  '.tome.shut.back{transform:translateX(25%) scale(.96)}.tome.shut.back .tome-backcover{display:flex}.tome.shut.back .tome-cover{visibility:hidden}',
  '.tome-cover .cover-art{width:78%;margin:1.4cqh auto 0;position:relative;border:1px solid rgba(214,179,92,.45);border-radius:4px;overflow:hidden;background:#120b06;box-shadow:inset 0 0 0 2px rgba(0,0,0,.35)}.tome-cover .cover-art svg{display:block;width:100%;height:auto}',
  '.tome-tocover{position:absolute;top:max(10px,1.6vh);left:max(10px,1.6vw);z-index:9;font:inherit;font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:8px 14px;border-radius:999px;border:1px solid rgba(214,179,92,.55);background:rgba(36,23,13,.88);color:#f0e3c4;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.5)}.tome-tocover:hover,.tome-tocover:focus-visible{border-color:rgba(240,214,140,.95)}',
  '.tome-cover .newbadge{position:relative;display:inline-block;margin-top:1.6cqh;padding:.5cqh 1.6cqh;border-radius:2cqh;background:#8f2d1c;color:#fff4dc;font-size:1.8cqh;letter-spacing:.04em;box-shadow:0 .3cqh 1cqh rgba(0,0,0,.5)}',
  '.tome-cover .title{font-variant:small-caps;letter-spacing:.14em;font-size:4cqh;position:relative}.tome-cover .line{font-style:italic;font-size:2cqh;color:rgba(214,179,92,.8);margin-top:1cqh;position:relative}',
  // the prompt, as a game writes it along the foot of the screen
  '.tome-prompt{position:absolute;left:0;right:0;bottom:2.4vh;text-align:center;color:rgba(232,214,178,.8);font-size:13px;letter-spacing:.16em;text-transform:uppercase;pointer-events:none}',
  '.tome-prompt kbd{font:inherit;border:1px solid rgba(232,214,178,.55);border-radius:3px;padding:1px 7px;margin:0 6px 0 14px;color:rgba(232,214,178,.95)}.tome-prompt kbd:first-child{margin-left:0}',
  '.tome-prompt .phone{display:none}',
  // one page at a time on a phone: the book is a single sheet, the cover the same width
  '@media (max-width:700px){.tome{--th:min(84vh,calc(94vw / .73));width:calc(var(--th) * .73)}.tome.shut,.tome.shut.back{transform:scale(.96)}.tome-backcover{width:calc(100% + 2.8%);left:-1.4%;border-radius:1.4%/2%}.tome-page,.tome-face,.tome-leaf,.tome-cover{width:100%;left:0}.tome-cover{width:calc(100% + 2.8%);left:-1.4%}.tome-leaf.fwd{left:0}.tome-spine{display:none}'
    + '.tome-page.left,.tome-page.right{border-radius:.6%/.9%;box-shadow:inset 0 0 7cqh rgba(95,58,18,.26)}.tome-stack.left{display:none}.tome-list{columns:1}.tome-prompt .desk{display:none}.tome-prompt .phone{display:inline}}',
  '@media (prefers-reduced-motion:reduce){.tome,.tome-cover,.tome-leaf,#vtome{transition-duration:.01s}}',
].join('') + RULES_CSS; // the rule registry's illuminated entries (asked by Verse)

const chapterOf = (book, id) => (book.chapters || []).find((c) => c.id === id) || {};
const jump = (n, label, esc) => '<a href="#" class="gjump" data-page="' + n + '">' + esc(label) + '</a>';
const asks = (list, esc) => (list && list.length ? '<div class="tome-say">Say</div><ul class="tome-try gb-try">' + list.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>' : '');

/** the contents page's list: every chapter with its first page; past ten chapters it sets tighter so the last still sits above the
 *  page number (the What's new chapter made it thirteen). Pure. */
/** the parchment's tone from the Status card's last reading on this device (asked by Verse: "a 'scented-parchment' CSS filter that subtly
 *  shifts the color temperature of the tome based on the 'status' skill's current health"): warm sepia when all is well, cooler and greyer
 *  the more fails; '' (the parchment as drawn) with no reading or one over a day old. health: { failing, checked, at }. Pure. */
export function parchmentFilter(health, now = Date.now()) {
  if (!health || !Number.isFinite(health.at) || now - health.at > 864e5 || !(health.checked > 0)) return '';
  const bad = Math.min(1, Math.max(0, health.failing) / Math.max(1, Math.min(health.checked, 10)) * 2.5); // two failing of ten is already half cold
  if (!bad) return 'sepia(.18) saturate(1.08)';
  return 'sepia(' + (0.18 * (1 - bad)).toFixed(2) + ') saturate(' + (1 - 0.3 * bad).toFixed(2) + ') hue-rotate(' + Math.round(-14 * bad) + 'deg) brightness(' + (1 - 0.05 * bad).toFixed(2) + ')';
}

export function tocHtml(book, esc) {
  const list = (book.chapters || []).filter((c) => c.id !== 'front');
  return '<ul class="tome-toc tome-try gb-toc' + (list.length > 10 ? ' tome-toc-dense' : '') + '">' + list.map((c) => '<li>' + jump(c.from, c.name, esc) + ' <span class="n">· ' + c.from + '</span>' + (c.id === 'news' && book.news && book.news.unseen ? ' <b class="tome-new">' + book.news.unseen + ' new</b>' : '') + (c.for ? '<span class="tome-for">' + esc(c.for) + '</span>' : '') + '</li>').join('') + '</ul>';
}

/** one page typeset for the tome (without its running head and folio, which the spread adds). Pure. */
/** the page's own ink art (lib/card-art.js): the plate a card of its kind gets, keyed by the page so it is always the same picture, haunted in October. '' if it cannot draw. */
const pageArt = (p, h = 120) => {
  try {
    return '<div class="tome-art">' + artSvg({ key: 'book:' + (p.name || p.title || p.kind), name: p.title || '', kind: p.kind === 'mini' ? 'Miniature' : p.game ? 'Game' : p.kind === 'skill' ? 'Skill' : 'Idea', chapter: p.chapter, rarity: p.tier || 'common', season: seasonOf(new Date().getMonth(), typeof location !== 'undefined' ? location.search : '') }, { w: 420, h }) + '</div>';
  } catch (_) { return ''; }
};
export function pageHtml(p, book, esc) {
  const t = book.totals || {}, chap = chapterOf(book, p.chapter);
  if (p.kind === 'cover') { // the title page
    const firsts = (book.chapters || []).filter((c) => c.kind === 'family' || c.kind === 'games').map((c) => book.pages.slice(c.from, c.to).find((x) => x.kind === 'skill')).filter(Boolean);
    return '<div class="tome-kicker">a-to-mind.com</div><h3 class="tome-title big">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body"><p class="tome-note" style="text-align:center">' + esc(p.line) + '</p>'
      + openerSvg({ skills: firsts.map((x) => x.name) }, book, 10) + '<p class="tome-sub">' + t.skills + ' skills · ' + t.games + ' games · ' + t.minis + ' miniatures<br>' + t.pages + ' pages</p></div>';
  }
  if (p.kind === 'how') {
    return '<div class="tome-kicker">Start here</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + pageArt(p, 100) + '<p class="lead">The stage is the dark space behind this book. The box at the bottom is where you ask, in plain words. '
      + 'Say what you want and it appears on the stage: a card you can read, a thing you can drag, a board you can play on.</p><p>Esc or a tap on the void closes a card. Any line of ink in this book that reads like an ask can be touched, and the book closes to do it.</p>'
      + (p.core || []).map((c) => '<p class="tome-note"><b>' + esc(c.name) + '</b> · ' + esc(c.line) + '</p><ul class="tome-try gb-try">' + c.examples.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>').join('')
      // the store, named where a first visit reads (owner, 2026-10-18: the corner "support Verse" link is gone, "but make the store easy to find")
      + '<p class="tome-note tome-store"><b>The store</b> · what Verse sells, and how to support it.</p><ul class="tome-try gb-try"><li><a href="#" data-ask="open the store">open the store</a></li><li><a href="#" data-ask="support void">support void</a></li></ul></div>';
  }
  if (p.kind === 'legend') {
    return '<div class="tome-kicker">Start here</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + pageArt(p, 100) + '<p class="lead">Each page is one thing Verse does: its name, one line on what it does, two or three asks to say, and a rating.</p>'
      + '<p>The rating is earned from evidence, never claimed:</p><dl class="tome-legend gb-legend">' + TIERS.slice().reverse().map((k) => '<dt>' + k + '</dt><dd>' + esc(TIER_MEANING[k]) + '</dd>').join('') + '</dl>'
      + '<p class="tome-note">A page with a box drawn on it is a game on the rack; a page headed 3D is a miniature a card carries.</p></div>';
  }
  if (p.kind === 'toc') return '<div class="tome-kicker">Start here</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + tocHtml(book, esc) + '</div>';
  if (p.kind === 'news') { // a page of the newest ledger entries (lib/book-news.js): by day, then by kind, each line its own words and an ask to try it
    const when = (d) => { const t = new Date(d + 'T12:00:00Z'); return isNaN(t) ? d : t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); };
    return '<div class="tome-kicker">Fresh from the ledger</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + pageArt(p, 80)
      + (p.days || []).map((d) => '<div class="tome-day">' + esc(when(d.day)) + (d.groups.some((g) => g.items.some((e) => e.try)) ? ' <a href="#" class="tome-showday" data-showcase-day="' + esc(d.day) + '">show these on the stage</a>' : '') + '</div>' + d.groups.map((g) => '<div class="tome-say">' + esc(g.name) + '</div><ul class="tome-try gb-try tome-newsl">' + g.items.map((e) => '<li>' + esc(e.line) + (e.try ? ' <a href="#" class="tome-tryit" data-ask="' + esc(e.try) + '">try it</a>' : '') + '</li>').join('') + '</ul>').join('')).join('') + '</div>';
  }
  if (p.kind === 'opener') {
    const n = (p.skills || []).length, counts = chap.count ? TIERS.slice().reverse().filter((k) => chap.count[k]).map((k) => chap.count[k] + ' ' + k).join(' · ') : '';
    return '<div class="tome-kicker">Chapter</div><h3 class="tome-title big" style="margin-top:8cqh">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + pageArt(p, 150) + '<p class="tome-note" style="text-align:center">' + esc(p.line || '') + '</p>' + openerSvg(p, book, 16)
      + '<p class="tome-sub">' + n + (p.chapter === 'minis' ? ' miniatures' : p.chapter === 'rules' ? ' rules, tried in this order' : ' skills') + (counts ? '<br>' + counts : '') + '<br>pages ' + chap.from + '–' + chap.to + '</p></div>';
  }
  if (p.kind === 'rules') return rulesPageHtml(p, esc); // the rule registry (asked by Verse): lib/rule-registry.js
  if (p.kind === 'index') {
    return '<div class="tome-kicker">Index</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body"><ul class="tome-list gb-list">' + (p.entries || []).map((e) => '<li>' + jump(e.page, e.name, esc) + '<span class="lead-dots"></span><span class="n">' + e.page + '</span></li>').join('') + '</ul></div>';
  }
  // a skill, a boxed game, a miniature: a plate of its glyph, its name, one line with a drop capital, the asks, its rating along the foot
  // (the chapter is the running head already, so the kicker only says what is not a plain skill: a boxed game, a miniature)
  const kicker = p.kind === 'mini' ? '3D miniature' : p.game ? 'On the rack' : '';
  const sub = p.kind === 'skill' && p.game && p.name !== p.title.toLowerCase() ? '<small>' + esc(p.name) + '</small>' : p.kind === 'mini' ? '<small>a thing a card carries</small>' : '';
  const line = String(p.line || ''), dropCap = /^[A-Za-z]/.test(line); // a line that opens with a quote mark keeps its first letter in the line
  let body = (kicker ? '<div class="tome-kicker">' + esc(kicker) + '</div>' : '<div class="tome-kicker tome-kicker-blank">&nbsp;</div>') + '<h3 class="tome-title">' + esc(p.title) + sub + '</h3><div class="tome-rule"></div><div class="tome-body">'
    + pageArt(p, 150) + (p.flavor ? '<p class="tome-epigraph">' + esc(p.flavor) + '</p>' : '') + '<div class="tome-plate">' + glyphSvg(p, 64) + '</div>'
    + '<p class="' + (dropCap ? 'lead ' : '') + 'gb-line">' + esc(line) + (/[.!?…]$/.test(line) ? '' : '.') + '</p>';
  if (p.kind === 'mini' && p.ownerPage) body += '<p class="tome-note">Carried by the ' + jump(p.ownerPage, (p.card || p.owner) + ' card, page ' + p.ownerPage, esc) + '.</p>';
  else if (p.kind === 'mini' && p.card) body += '<p class="tome-note">Carried by ' + esc(p.card) + '.</p>';
  body += asks(p.examples, esc) + '</div>';
  if (p.tier) body += '<div class="tome-tier gb-tier gb-tier-' + esc(p.tier) + '" title="' + esc(p.why || '') + '"><b>' + esc(p.tier) + '</b><span>' + esc(TIER_MEANING[p.tier] || '') + '</span></div>';
  return body;
}

/** a page with its running head and folio, as it sits on the left or the right. Pure. */
export function sheetHtml(p, book, side, esc) {
  if (!p) return '';
  const chap = chapterOf(book, p.chapter);
  // the running heads as a book sets them: the book's title on the left-hand page, the chapter on the right-hand page
  const head = side === 'left' ? '<span>' + esc(book.title || 'The Verse Book') + '</span><span></span>' : '<span></span><span>' + esc(chap.name || '') + '</span>';
  return '<div class="tome-head">' + head + '</div>' + pageHtml(p, book, esc) + '<div class="tome-folio">' + p.n + '</div>';
}

/** how thick each stack of unread leaves is, 0..1, from the page you are on. Pure. */
export function stacks(cur, total) { const t = Math.max(1, total || 1); return { left: Math.min(1, Math.max(0, (cur - 1) / t)), right: Math.min(1, Math.max(0, (t - cur) / t)) }; }

/** the prompt along the foot of the screen. Pure. */
export const PROMPT = '<span class="desk"><kbd>◂ ▸</kbd>Turn page<kbd>Home</kbd>Cover<kbd>Esc</kbd>Close</span><span class="phone">Swipe to turn · tap the dark to close</span>';

/** the shut cover's face. Pure. */
/** the back cover: the same worn leather, the ink plate again, and the last words. Pure. */
export function backCoverHtml(book, esc) {
  let art = ''; try { art = artSvg({ key: 'the-v01d-book-back', name: 'The end', kind: 'Book', rarity: 'mythic', season: seasonOf(new Date().getMonth(), typeof location !== 'undefined' ? location.search : '') }, { w: 420, h: 240 }); } catch (_) {}
  return '<div class="seal">V</div><div class="cover-art">' + art + '</div><div class="title">The End</div><div class="line">' + esc(book.title || 'The Verse Book') + '</div><div class="line">a-to-mind.com</div>';
}
export function coverHtml(book, esc) {
  const t = book.totals || {};
  // the cover carries Verse's own ink art (lib/card-art.js): the same plate a Book card gets, haunted in October
  let art = ''; try { art = artSvg({ key: 'the-v01d-book', name: book.title || 'The Verse Book', kind: 'Book', rarity: 'mythic', season: seasonOf(new Date().getMonth(), typeof location !== 'undefined' ? location.search : '') }, { w: 420, h: 240 }); } catch (_) {}
  return '<div class="face out"><div class="seal">V</div><div class="cover-art">' + art + '</div><div class="title">' + esc(book.title || 'The Verse Book') + '</div><div class="line">everything it can do, one page each</div><div class="line">' + (t.pages || '') + ' pages</div>' + (book.news && book.news.unseen ? '<div class="newbadge" role="status">' + book.news.unseen + ' new since you last opened the book</div>' : '') + '</div><div class="face in"></div>';
}
