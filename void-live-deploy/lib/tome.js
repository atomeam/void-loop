// The tome: the Book of Verse read the way Skyrim's books are read (owner, 2026-10-16: "research how the books on Skyrim work and
// make it like that ... its supposed to be the graphic style and visuals of the way they do books"). In Skyrim a book you pick
// up fills the screen: the world dims behind it, a worn leather tome lies open on two parchment pages set in a serif with the
// text of the book and nothing else (no menu, no tabs, no chrome), and your only controls are turning the page and closing it.
// This file is the pure half: the tome's CSS and every page typeset for parchment (a running head, a title with a rule, a drop
// capital, the asks as lines of italic ink, the folio in the outer corner). skills/guide.js mounts it full screen and turns the
// leaves. The content is the same skills/guide.json page data the generator writes (lib/guide.js), so nothing is left out.
import { glyphSvg, openerSvg, TIERS, TIER_MEANING } from './guide.js';
import { artSvg, seasonOf } from './card-art.js';
import { rulesPageHtml, RULES_CSS } from './rule-registry.js';
import { dayLabel } from './book-news.js';

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
  '.tome{position:relative;--th:min(86vh,calc(100vh - 96px),calc(94vw / 1.46));--th:min(86dvh,calc(100dvh - 96px),calc(94vw / 1.46));height:var(--th);width:calc(var(--th) * 1.46);container-type:size;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.4,.1,.2,1)}',
  '.tome.shut{transform:translateX(-25%) scale(.96)}',
  '.tome.shut .tome-page,.tome.shut .tome-stack{opacity:0;transition:opacity .25s ease}.tome-page,.tome-stack{transition:opacity .25s ease}',
  // boards and spine: dark worn leather with a blind-tooled double border
  '.tome-boards{position:absolute;inset:-1.6% -1.4%;border-radius:.6% 1.4% 1.4% .6%/.9% 2% 2% .9%;background:linear-gradient(135deg,#3a2616,#24170d 45%,#1b110a);box-shadow:0 40px 90px rgba(0,0,0,.75),0 6px 18px rgba(0,0,0,.6),inset 0 0 0 1px rgba(205,165,95,.22),inset 0 0 0 5px rgba(0,0,0,.25),inset 0 0 0 6px rgba(205,165,95,.14)}',
  '.tome-boards::after{content:"";position:absolute;inset:0;background:' + GRAIN + ';opacity:.5;border-radius:inherit;mix-blend-mode:multiply}',
  '.tome-spine{position:absolute;top:-1.6%;bottom:-1.6%;left:50%;width:4%;transform:translateX(-50%);background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.55) 42%,rgba(0,0,0,.62) 58%,rgba(0,0,0,0));z-index:3;pointer-events:none}',
  // the pages: parchment, darker at the edges and in the gutter, grained and foxed
  '.tome-page,.tome-face{filter:var(--tome-tone,none);transition:filter .6s ease}', // the site's health tints the parchment (parchmentFilter)
  '.tome-page,.tome-face{position:absolute;top:0;bottom:0;width:50%;box-sizing:border-box;padding:6.2cqh 6cqh 7.4cqh;overflow:hidden;background-color:#e6d5ae;'
    + 'background-image:radial-gradient(ellipse at 18% 12%,rgba(255,250,236,.5),rgba(255,250,236,0) 55%),radial-gradient(ellipse at 85% 90%,rgba(110,70,25,.16),rgba(110,70,25,0) 55%),' + MOTTLE + ',' + GRAIN + ';'
    + 'background-size:auto,auto,420px 420px,160px 160px;box-shadow:inset 0 0 7cqh rgba(95,58,18,.26);color:#2b1b0e;line-height:1.46;font-size:2.35cqh}',
  '.tome-page::-webkit-scrollbar,.tome-face::-webkit-scrollbar{width:5px}.tome-page::-webkit-scrollbar-thumb,.tome-face::-webkit-scrollbar-thumb{background:rgba(109,76,42,.4);border-radius:2px}.tome-page,.tome-face{scrollbar-width:thin;scrollbar-color:rgba(109,76,42,.4) transparent}',
  '.tome-fit{display:flow-root}.tome-page.has-tier,.tome-face.has-tier{padding-bottom:12.5cqh}',
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
  // the leather board fills the face; the words are stamped in gold into it (a gold gradient clipped to the letters, a dark lip above and a pale one below)
  '.tome-cover .cover-art.cover-leather,.tome-backcover .cover-art.cover-leather{position:absolute!important;inset:0;width:auto!important;margin:0!important;border:0!important;border-radius:inherit;background:#3b2414;box-shadow:none;overflow:hidden}.cover-leather svg{display:block;width:100%;height:100%}',
  '.tome-cover .face.out,.tome-backcover{justify-content:flex-start!important;overflow:hidden}.tome-cover .face.out::before{content:none}.tome-cover .seal,.tome-backcover .seal{display:none}',
  '.tome-cover .gilt,.tome-backcover .gilt{position:relative;z-index:1;background:linear-gradient(170deg,#fff3c4 0%,#e8bf62 30%,#a06d24 55%,#f2d27c 75%,#8a5718 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 -1px 0 rgba(10,5,2,.9)) drop-shadow(0 1px 0 rgba(190,140,90,.35));text-align:center}',
  '.tome-cover .gilt.title,.tome-backcover .gilt.title{margin-top:21.5cqh;font-size:4.8cqh;font-weight:700;letter-spacing:.08em;font-variant:small-caps;line-height:1.05;padding:0 12%}',
  '.tome-cover .gilt.line,.tome-backcover .gilt.line{font-style:italic;font-size:2.1cqh;letter-spacing:.04em;margin-top:1cqh}.tome-cover .gilt.foot,.tome-backcover .gilt.foot{position:absolute;left:0;right:0;bottom:14cqh;margin:0;font-style:normal;font-variant:small-caps;letter-spacing:.14em;font-size:2.3cqh}',
  '.tome-cover .newbadge{z-index:1;position:absolute!important;left:50%;bottom:7cqh;transform:translateX(-50%);white-space:nowrap}',
  '.tome-cover .title{font-variant:small-caps;letter-spacing:.14em;font-size:4cqh;position:relative}.tome-cover .line{font-style:italic;font-size:2cqh;color:rgba(214,179,92,.8);margin-top:1cqh;position:relative}',
  // the prompt, as a game writes it along the foot of the screen
  '.tome-prompt{position:absolute;left:0;right:0;bottom:2.4vh;text-align:center;color:rgba(232,214,178,.8);font-size:13px;letter-spacing:.16em;text-transform:uppercase;pointer-events:none}',
  '.tome-prompt kbd{font:inherit;border:1px solid rgba(232,214,178,.55);border-radius:3px;padding:1px 7px;margin:0 6px 0 14px;color:rgba(232,214,178,.95)}.tome-prompt kbd:first-child{margin-left:0}',
  '.tome-prompt .phone{display:none}',
  // one page at a time on a phone: the book is a single sheet, the cover the same width
  '@media (max-width:700px){.tome{--th:min(84vh,calc(94vw / .73));width:calc(var(--th) * .73)}.tome.shut,.tome.shut.back{transform:scale(.96)}.tome-backcover{width:calc(100% + 2.8%);left:-1.4%;border-radius:1.4%/2%}.tome-page,.tome-face,.tome-leaf,.tome-cover{width:100%;left:0}.tome-cover{width:calc(100% + 2.8%);left:-1.4%}.tome-leaf.fwd{left:0}.tome-spine{display:none}'
    + '.tome-page.left,.tome-page.right{border-radius:.6%/.9%;box-shadow:inset 0 0 7cqh rgba(95,58,18,.26)}.tome-stack.left{display:none}.tome-list{columns:1}.tome-prompt .desk{display:none}.tome-prompt .phone{display:inline}}',
  '@media (prefers-reduced-motion:reduce){.tome,.tome-cover,.tome-leaf,#vtome{transition:none}}', // none, not .01s: a transform transition still waits on the compositor to start, and headless Chrome left the shut tilt standing (the tester saw the open book 312px left at 1920x1080)
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
// Verse's own picture for the pages about Verse itself (owner, 2026-10-24: "Verse is a universe that comes from an Atom", "represents its growth
// plus im Atom", "needs to look more universe and less atom", "design an atom shaped galaxy that looks natural", with a picture: a spiral
// galaxy, golden core, whose arms are three orbit rings of stars, blue clusters, pink nebula knots and dark dust lanes, in a field of stars).
// Drawn here from a fixed seed, so the same growth draws the same sky: the rings' stars number the entries in Verse's growth ledger (`grown`),
// so the galaxy fills in as Verse grows. Ids are per call so two on one spread do not share gradients or filters.
let ringN = 0;
export function verseUniverse(h = 80, w = 320, grown = 0) {
  const n = 'vu' + (++ringN), cx = w / 2, cy = h / 2, f = (v) => (Math.round(v * 10) / 10).toString(), u = h / 100; // u: one hundredth of the height
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647), pick = (a) => a[Math.floor(rnd() * a.length)];
  const m = Math.min(1, 0.25 + h / 400); // fewer stars on a small picture: one too small to see is only weight (an 80 px banner draws about half)
  const dot = (x, y, r, c, o) => '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + c + '" opacity="' + f(o) + '"/>';
  // the far field: stars of every colour, a few bright ones with four-point spikes, and small distant galaxies
  let field = '';
  for (let i = 0; i < Math.round(160 * m); i++) field += dot(rnd() * w, rnd() * h, (0.15 + rnd() * 0.45) * u * 0.6, pick(['#fff', '#fff', '#ffe9c4', '#cfe0ff', '#ffd2a8']), 0.35 + rnd() * 0.6);
  for (let i = 0; i < 4; i++) { const x = rnd() * w, y = rnd() * h, L = (1.5 + rnd() * 2.5) * u; field += '<g opacity=".9" stroke="#fff" stroke-width="' + f(0.12 * u) + '"><line x1="' + f(x - L) + '" y1="' + f(y) + '" x2="' + f(x + L) + '" y2="' + f(y) + '"/><line x1="' + f(x) + '" y1="' + f(y - L) + '" x2="' + f(x) + '" y2="' + f(y + L) + '"/></g>' + dot(x, y, 0.5 * u, '#fff', 1); }
  for (let i = 0; i < 6; i++) { const x = rnd() * w, y = rnd() * h; field += '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f((0.8 + rnd() * 1.2) * u) + '" ry="' + f((0.3 + rnd() * 0.4) * u) + '" transform="rotate(' + Math.round(rnd() * 180) + ' ' + f(x) + ' ' + f(y) + ')" fill="#f1cf98" opacity=".55" filter="url(#' + n + 's)"/>'; }
  // the three rings: tilted ellipses of stars, each with a soft blue glow, a dark dust lane just inside, blue clusters and pink knots along it
  const per = Math.max(Math.round(120 * m), Math.min(600, Math.round((grown || 0) / 1.6 * m))), A = Math.min(w * 0.4, h * 0.9), B = A * 0.34;
  let glow = '', dust = '', stars = '', knots = '';
  for (const deg of [-12, 48, 108]) {
    const rad = (deg * Math.PI) / 180, P = (t, s = 1, j = 0) => { const x = Math.cos(t) * A * s, y = Math.sin(t) * B * s; return [cx + x * Math.cos(rad) - y * Math.sin(rad) + j * (rnd() - 0.5), cy + x * Math.sin(rad) + y * Math.cos(rad) + j * (rnd() - 0.5)]; };
    const ring = (sw, c, o, s = 1) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + f(A * s) + '" ry="' + f(B * s) + '" transform="rotate(' + deg + ' ' + cx + ' ' + cy + ')" fill="none" stroke="' + c + '" stroke-opacity="' + o + '" stroke-width="' + f(sw * u) + '"/>';
    glow += ring(7, '#6f95ff', '.12') + ring(3.2, '#a9c6ff', '.26') + ring(1.3, '#e8f0ff', '.32', 0.995); // the band's haze, wide and faint to narrow and bright
    dust += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + f(A * 0.975) + '" ry="' + f(B * 0.95) + '" transform="rotate(' + deg + ' ' + cx + ' ' + cy + ')" fill="none" stroke="#3a2516" stroke-opacity=".55" stroke-width="' + f(0.9 * u) + '" stroke-dasharray="' + f(6 * u) + ' ' + f(1.5 * u) + ' ' + f(2 * u) + ' ' + f(1 * u) + '"/>';
    const ph = rnd() * 6;
    for (let i = 0; i < per; i++) { const t = rnd() * Math.PI * 2, thick = (1.6 + 4 * Math.pow(Math.sin(2 * t + ph), 2)) * u; // a band that swells and thins as it goes round
      const [x, y] = P(t, 0.985 + (rnd() - 0.5) * 0.05, thick); stars += dot(x, y, (0.1 + Math.pow(rnd(), 3) * 0.55) * u, pick(['#dbe8ff', '#b9d0ff', '#fff', '#fff', '#fff3df']), 0.35 + rnd() * 0.6); }
    for (let i = 0; i < 9; i++) { const [x, y] = P(rnd() * Math.PI * 2, 1, 1.5 * u); knots += dot(x, y, (0.6 + rnd() * 0.8) * u, rnd() < 0.55 ? '#ff7fb0' : '#8fb6ff', 0.75); }
  }
  // the core: a golden glow and a tight spiral of warm stars winding into it
  let core = '', arms = '';
  const R = 30 * u, sp = (arm, t) => { const k = arm * Math.PI + t * 3.4 * Math.PI, r = (1.5 + t * R / u) * u; return [cx + Math.cos(k) * r, cy + Math.sin(k) * r * 0.8]; };
  for (const arm of [0, 1]) { let d = ''; for (let i = 0; i <= 40; i++) { const [x, y] = sp(arm, i / 40); d += (i ? 'L' : 'M') + f(x) + ' ' + f(y); } arms += '<path d="' + d + '" fill="none" stroke="#ffd79a" stroke-opacity=".35" stroke-width="' + f(3.5 * u) + '" stroke-linecap="round"/>'; }
  for (let i = 0; i < Math.round(420 * m); i++) { const t = Math.pow(rnd(), 0.75), [x, y] = sp(i % 2, t), j = (0.8 + t * 3.5) * u;
    core += dot(x + j * (rnd() - 0.5), y + j * (rnd() - 0.5), (0.1 + Math.pow(rnd(), 2.5) * 0.45) * u, pick(['#fff4dc', '#ffe1a8', '#ffd08a', '#fff', '#ffb6c9']), 0.45 + rnd() * 0.5); }
  return '<div class="tome-art"><svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img" aria-label="Verse: a galaxy shaped like an atom, grown from it, ' + per * 3 + ' stars in its rings for its growth" style="display:block;border-radius:6px">'
    + '<defs><radialGradient id="' + n + 'c" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".18" stop-color="#ffe7b8" stop-opacity=".95"/><stop offset=".5" stop-color="#d9a866" stop-opacity=".4"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/></radialGradient>'
    + '<filter id="' + n + 'b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="' + f(1.6 * u) + '"/></filter>'
    + '<filter id="' + n + 's" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + f(0.35 * u) + '"/></filter></defs>'
    + '<rect width="' + w + '" height="' + h + '" fill="#030306"/>' + field
    + '<g filter="url(#' + n + 'b)">' + glow + arms + '</g>' + '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + f(36 * u) + '" ry="' + f(29 * u) + '" fill="url(#' + n + 'c)"/>'
    + core + '<g filter="url(#' + n + 's)">' + dust + '</g>' + stars + '<g filter="url(#' + n + 's)">' + knots + '</g>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(3 * u) + '" fill="#fffaf0" filter="url(#' + n + 's)"/></svg></div>';
}
const stop = (s) => { s = String(s || '').trim(); return !s || /[.!?…:)"”’']$/.test(s) ? s : s + '.'; }; // a line ends as a sentence does
export function pageHtml(p, book, esc) {
  const t = book.totals || {}, chap = chapterOf(book, p.chapter);
  if (p.kind === 'cover') { // the title page
    const firsts = (book.chapters || []).filter((c) => c.kind === 'family' || c.kind === 'games').map((c) => book.pages.slice(c.from, c.to).find((x) => x.kind === 'skill')).filter(Boolean);
    return '<div class="tome-kicker">a-to-mind.com</div><h3 class="tome-title big">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body"><p class="tome-note" style="text-align:center">' + esc(p.line) + '</p>'
      + openerSvg({ skills: firsts.map((x) => x.name) }, book, 10) + '<p class="tome-sub">' + t.skills + ' skills · ' + t.games + ' games · ' + t.minis + ' miniatures<br>' + t.pages + ' pages</p></div>';
  }
  if (p.kind === 'how') {
    return '<div class="tome-kicker">Start here</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + (p.part === 2 ? '<p class="lead">More of the first things to say. Each line of ink below is an ask: touch it and the book closes to do it.</p>' : pageArt(p, 100) + '<p class="lead">The stage is the dark space behind this book. The box at the bottom is where you ask, in plain words. '
      + 'Say what you want and it appears on the stage: a card you can read, a thing you can drag, a board you can play on.</p><p>Esc or a tap on the void closes a card. Any line of ink in this book that reads like an ask can be touched, and the book closes to do it.</p>')
      + (p.core || []).map((c) => '<p class="tome-note"><b>' + esc(c.name) + '</b> · ' + esc(c.line) + '</p><ul class="tome-try gb-try">' + c.examples.map((a) => '<li><a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>').join('') + '</ul>').join('')
      // the store, named where a first visit reads (owner, 2026-10-18: the corner "support Verse" link is gone, "but make the store easy to find")
      + (p.part === 1 ? '' : '<p class="tome-note tome-store"><b>The store</b> · what Verse sells, and how to support it.</p><ul class="tome-try gb-try"><li><a href="#" data-ask="open the store">open the store</a></li><li><a href="#" data-ask="support void">support void</a></li></ul>') + '</div>';
  }
  if (p.kind === 'legend') {
    return '<div class="tome-kicker">Start here</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + pageArt(p, 100) + '<p class="lead">Each page is one thing Verse does: its name, one line on what it does, two or three asks to say, and a rating.</p>'
      + '<p>The rating is earned from evidence, never claimed:</p><dl class="tome-legend gb-legend">' + TIERS.slice().reverse().map((k) => '<dt>' + k + '</dt><dd>' + esc(TIER_MEANING[k]) + '</dd>').join('') + '</dl>'
      + '<p class="tome-note">A page with a box drawn on it is a game on the rack; a page headed 3D is a miniature a card carries.</p></div>';
  }
  if (p.kind === 'toc') return '<div class="tome-kicker">Start here</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + tocHtml(book, esc) + '</div>';
  if (p.kind === 'news') { // a page of the newest changes a visitor can try (lib/book-news.js): by the visitor's own day, then by kind; an ask is
    // touched to run it on the stage, a page of the site opens as a link; a day with asks that answered live (claims-verified.json) plays them all
    const tryLink = (t) => (t.charAt(0) === '/' ? ' <a href="' + esc(t) + '" class="tome-tryit">open it</a>' : ' <a href="#" class="tome-tryit" data-ask="' + esc(t) + '">try it</a>');
    return '<div class="tome-kicker">Just shipped</div><h3 class="tome-title">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + verseUniverse(80, 320, p.grown)
      + (p.days || []).map((d) => { const live = (d.all || d.groups.flatMap((g) => g.items)).filter((e) => e.live).length; // the whole day: the link plays every live line of it
        return '<div class="tome-day">' + esc(dayLabel(d.day)) + (live ? ' <a href="#" class="tome-showday" data-showcase-day="' + esc(d.day) + '">play ' + (live === 1 ? 'it' : 'all ' + live) + ' on the stage</a>' : '') + '</div>' + d.groups.map((g) => '<div class="tome-say">' + esc(g.name) + '</div><ul class="tome-try gb-try tome-newsl">' + g.items.map((e) => '<li>' + esc(e.line) + (e.try ? tryLink(e.try) : '') + '</li>').join('') + '</ul>').join(''); }).join('') + '</div>';
  }
  if (p.kind === 'opener') {
    const n = (p.skills || []).length, counts = chap.count ? TIERS.slice().reverse().filter((k) => chap.count[k]).map((k) => chap.count[k] + ' ' + k).join(' · ') : '';
    return '<div class="tome-kicker">Chapter</div><h3 class="tome-title big" style="margin-top:8cqh">' + esc(p.title) + '</h3><div class="tome-rule"></div><div class="tome-body">' + pageArt(p, 150) + '<p class="tome-note" style="text-align:center">' + esc(stop(p.line || '')) + '</p>' + openerSvg(p, book, 16)
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
  const head = side === 'left' ? '<span>' + esc(book.title || 'The Book of Verse') + '</span><span></span>' : '<span></span><span>' + esc(chap.name || '') + '</span>';
  // the page's words sit in .tome-fit, which skills/guide.js scales down until they all fit above the footer (the rating and the
  // folio, which keep their own reserved strip): the sheet never scrolls and never cuts a line
  const html = pageHtml(p, book, esc), at = html.lastIndexOf('<div class="tome-tier');
  const words = at >= 0 ? html.slice(0, at) : html, foot = at >= 0 ? html.slice(at) : '';
  return '<div class="tome-head">' + head + '</div><div class="tome-fit">' + words + '</div>' + foot + '<div class="tome-folio">' + p.n + '</div>';
}

/** how thick each stack of unread leaves is, 0..1, from the page you are on. Pure. */
export function stacks(cur, total) { const t = Math.max(1, total || 1); return { left: Math.min(1, Math.max(0, (cur - 1) / t)), right: Math.min(1, Math.max(0, (t - cur) / t)) }; }

/** the prompt along the foot of the screen. Pure. */
export const PROMPT = '<span class="desk"><kbd>◂ ▸</kbd>Turn page<kbd>Home</kbd>Cover<kbd>Esc</kbd>Close</span><span class="phone">Swipe to turn · tap the dark to close</span>';

// The cover is a tooled leather binding (owner, 2026-10-25: "this should be an awesomely detailed realistic engraved leather book cover"), drawn as one
// inline SVG so it needs no image file and works offline: pebbled leather grain lit for relief, worn darker edges and scuffs, the hinge groove by the spine,
// two blind-tooled fillets pressed into the leather, a gilt frame with a dotted roll, gilt fleurons in the four corners, and a gilt medallion in the middle
// stamped with Verse's mark (one galaxy shaped like an atom, atomGalaxy below). The words are real text over it, stamped in gold (TOME_CSS .gilt).
const GOLD = '<linearGradient id="tg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".22" stop-color="#e2b65a"/><stop offset=".48" stop-color="#9c6a22"/><stop offset=".7" stop-color="#f0cf78"/><stop offset="1" stop-color="#7c4d16"/></linearGradient>';
// a corner fleuron: scrolls running along both edges and a leaf pointing in, drawn for the top-left corner (the other three are its mirror images)
const FLEURON = 'M0 0 C40 2 70 10 92 30 C104 42 102 60 88 62 C76 63 72 50 80 44 C86 40 92 46 88 50 M0 0 C2 40 10 70 30 92 C42 104 60 102 62 88 C63 76 50 72 44 80 C40 86 46 92 50 88 '
  + 'M0 0 C26 22 46 36 72 72 M72 72 C58 70 48 62 46 50 C58 52 66 60 72 72 C70 58 62 48 50 46 M72 72 C82 86 96 92 110 92 C100 100 86 100 78 92 '
  + 'M18 6 C34 16 44 18 58 16 M6 18 C16 34 18 44 16 58 M30 30 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0';
// The medallion's mark is ONE galaxy shaped like an atom (owner, 2026-10-25: "the verse book should have an atom shaped galaxy on cover not a galaxy with an
// atom around it"), the canvas seal's atom galaxy (lib/void-seal.js drawSeal) pressed in gilt: three tilted streams of gas, dust and stars ARE the galaxy's
// arms and the atom's orbits at once, crossing round a blazing bulge (the nucleus); each "electron" is a star cluster riding in its stream. No rails, no
// separate spiral. Each stream's width and light swell and pinch round it (seeded harmonics); depth as in the seal: the back halves, the bulge, then the
// front halves, whose dust lanes pass dark over the light. Seeded (mulberry32), so the cover is the same for everyone.
const seeded = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** the atom galaxy as SVG for a medallion of radius R at (cx, cy): needs the tg-gas, tg-puff, tg-bulge, tg-haze and tg-glow defs of leatherSvg. Pure. */
export function atomGalaxy(cx, cy, R) {
  const r = seeded(0x5e4b00c), gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += r(); return (u - 2) / 0.58; };
  const n = (v) => (Math.round(v * 10) / 10).toString(), TAU = Math.PI * 2;
  const streams = [-4, 56, 116].map((deg, k) => {
    const rot = deg * Math.PI / 180, c = Math.cos(rot), s = Math.sin(rot), rx = R * (0.9 + r() * 0.04), ratio = 0.3 + r() * 0.04, ry = rx * ratio;
    const harm = [1, 2, 3, 5].map((f) => ({ f, a: (0.5 / f) * (0.6 + r() * 0.8), ph: r() * TAU })), lane = r() * TAU;
    const swell = (t) => { let v = 0; for (const q of harm) v += q.a * Math.sin(q.f * t + q.ph); return v; };
    const at = (t, off = 0) => { const x = Math.cos(t) * (rx + off), y = Math.sin(t) * (ry + off * ratio); return [cx + x * c - y * s, cy + x * s + y * c]; };
    return { k, at, swell, lane, e: [0.45, 3.55, 2.55][k], wid: (t) => R * 0.15 * Math.max(0.25, 1 + 0.85 * swell(t)), lum: (t) => Math.max(0.25, 0.75 + 0.45 * swell(t + 1.3)) };
  });
  // a ribbon of the stream from t0 to t1 whose width follows the stream's (k: a fraction of it), as one closed path
  const ribbon = (S, t0, t1, k) => { const out = [], inn = []; for (let i = 0; i <= 18; i++) { const t = t0 + (t1 - t0) * i / 18, wd = S.wid(t) * k; out.push(S.at(t, wd / 2)); inn.push(S.at(t, -wd / 2)); }
    return 'M' + out.concat(inn.reverse()).map(([x, y]) => n(x) + ' ' + n(y)).join('L') + 'Z'; };
  const half = (S, near) => {
    const t0 = near ? 0 : Math.PI, t1 = t0 + Math.PI, pick = () => t0 + r() * Math.PI;
    const wake = (t) => { const d = ((S.e - t) % TAU + TAU) % TAU; return d < 0.7 ? 1 - d / 0.7 : 0; }; // the gas trailing the cluster
    let g = '<path d="' + ribbon(S, t0, t1, 1.25) + '" fill="url(#tg-gas)" opacity="' + (near ? 0.5 : 0.36) + '" filter="url(#tg-haze)"/>'
      + '<path d="' + ribbon(S, t0, t1, 0.42) + '" fill="#f4d48a" opacity="' + (near ? 0.42 : 0.3) + '" filter="url(#tg-haze)"/>';
    // knots of gas: soft gilt puffs scattered across the stream, brighter in the cluster's wake
    for (let i = 0; i < 12; i++) { const t = pick(), wd = S.wid(t), [x, y] = S.at(t, gauss() * wd * 0.3), rad = wd * (0.35 + r() * 0.5);
      g += '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + n(rad) + '" fill="url(#tg-puff)" opacity="' + n(Math.min(1, (0.25 + 0.35 * S.lum(t)) * (1 + wake(t))) * (near ? 1 : 0.75)) + '"/>'; }
    // stars: tiny gilt dots, most tight to the spine, a few flung out; zero-length round-capped strokes, one path per size
    const dots = ['', '', ''];
    for (let i = 0; i < 86; i++) { const t = pick(), stray = r() < 0.08, wd = S.wid(t), [x, y] = S.at(t, gauss() * wd * (stray ? 1.3 : 0.32)), b = r() * S.lum(t);
      dots[b > 0.72 ? 2 : b > 0.4 ? 1 : 0] += 'M' + n(x) + ' ' + n(y) + 'h0'; }
    g += dots.map((d, z) => d ? '<path d="' + d + '" stroke="' + ['#c9954a', '#f2cf7c', '#fff4cf'][z] + '" stroke-width="' + [1.3, 1.9, 2.7][z] + '" stroke-linecap="round" opacity="' + [0.7, 0.85, 1][z] + '"/>' : '').join('');
    // dust: a dark lane braided inside the stream, pressed soft into the gilt where the stream swells, broken where it thins (one path per weight)
    const dust = ['', '', ''];
    for (let i = 0; i < 30; i++) { const a = t0 + Math.PI * i / 30, b = a + Math.PI / 30 * 1.1, sw = S.swell(a * 2.3 + S.lane); if (sw < 0.2) continue;
      const off = (t) => (0.04 + Math.sin(t * 3 + S.lane) * 0.12) * S.wid(t), [x0, y0] = S.at(a, off(a)), [x1, y1] = S.at(b, off(b));
      dust[sw > 0.75 ? 2 : sw > 0.45 ? 1 : 0] += 'M' + n(x0) + ' ' + n(y0) + 'L' + n(x1) + ' ' + n(y1); }
    g += '<g stroke="#1c0e05" stroke-linecap="round" fill="none" filter="url(#tg-soft)" opacity="' + (near ? 0.55 : 0.4) + '">' + dust.map((d, z) => d ? '<path d="' + d + '" stroke-width="' + n(R * [0.025, 0.04, 0.055][z]) + '"/>' : '').join('') + '</g>';
    // the cluster ("electron"): a white-gold core in a knot of tiny stars, on whichever half it rides
    if ((Math.sin(S.e) > 0) === near) { const [ex, ey] = S.at(S.e), kr = R * 0.05; let knot = '';
      for (let i = 0; i < 12; i++) { const d = Math.abs(gauss()) * kr, a = r() * TAU; knot += 'M' + n(ex + Math.cos(a) * d) + ' ' + n(ey + Math.sin(a) * d) + 'h0'; }
      g += '<circle cx="' + n(ex) + '" cy="' + n(ey) + '" r="' + n(kr * 2.8) + '" fill="url(#tg-puff)"/><circle cx="' + n(ex) + '" cy="' + n(ey) + '" r="' + n(kr * 0.75) + '" fill="#fff6d6" filter="url(#tg-glow)"/>'
        + '<path d="' + knot + '" stroke="#fff4cf" stroke-width="1.6" stroke-linecap="round"/>'; }
    return g;
  };
  // the bulge: the nucleus, a slightly flattened blaze of gold with a warm halo and a crowd of stars in it
  const Rn = R * 0.24; let crowd = '';
  for (let i = 0; i < 44; i++) { const d = Math.abs(gauss()) * Rn * 0.55, a = r() * TAU; crowd += 'M' + n(cx + Math.cos(a) * d) + ' ' + n(cy + Math.sin(a) * d * 0.8) + 'h0'; }
  const bulge = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + n(Rn * 2.1) + '" ry="' + n(Rn * 1.8) + '" fill="url(#tg-bulge)" opacity=".45"/>'
    + '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + n(Rn) + '" ry="' + n(Rn * 0.84) + '" fill="url(#tg-bulge)" filter="url(#tg-glow)"/>'
    + '<path d="' + crowd + '" stroke="#fffbe8" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>';
  // the galaxy's own halo: one faint glow of old stars that the three streams share, so they read as one body
  const halo = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + n(R * 0.95) + '" ry="' + n(R * 0.9) + '" fill="url(#tg-bulge)" opacity=".16"/>';
  return '<g class="atom-galaxy">' + halo + streams.map((S) => half(S, false)).join('') + bulge + streams.map((S) => half(S, true)).join('') + '</g>';
}
/** the leather board as one SVG, w x h in its own units (the cover is about 0.73 wide for 1 high). Pure. */
export function leatherSvg({ medallion = true, w = 730, h = 1000 } = {}) {
  const fr = (i, cls) => '<rect class="' + cls + '" x="' + i + '" y="' + i + '" width="' + (w - 2 * i) + '" height="' + (h - 2 * i) + '" rx="' + Math.max(2, 14 - i / 8) + '"/>';
  const blind = (i) => '<g fill="none"><rect x="' + i + '" y="' + i + '" width="' + (w - 2 * i) + '" height="' + (h - 2 * i) + '" stroke="#120904" stroke-width="3.2" opacity=".85"/>'
    + '<rect x="' + (i + 1.6) + '" y="' + (i + 1.6) + '" width="' + (w - 2 * i - 3.2) + '" height="' + (h - 2 * i - 3.2) + '" stroke="#8a5a34" stroke-width="1" opacity=".55"/></g>';
  const corner = (x, y, sx, sy) => '<g transform="translate(' + x + ' ' + y + ') scale(' + sx + ' ' + sy + ')"><path d="' + FLEURON + '" class="gold-line"/></g>';
  const cx = w / 2, cy = h * 0.5, R = Math.min(w, h) * 0.22;
  const med = medallion ? '<g>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 1.12) + '" fill="#2a170b" opacity=".55"/>' // the medallion is pressed: a shade darker than the board
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 1.12) + '" fill="none" stroke="#120904" stroke-width="3"/>'
    + '<g filter="url(#tg-emboss)"><circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 1.06) + '" class="gold-line" stroke-width="3"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.98) + '" class="gold-dots"/></g>'
    + atomGalaxy(cx, cy, R) + '</g>' : '';
  // scuffs: a few pale strokes where the board has rubbed, fixed so the book is the same for everyone
  const scuffs = [[120, 180, 60, -8], [560, 830, 80, 12], [610, 240, 40, 30], [180, 760, 50, -20], [400, 120, 70, 4], [90, 520, 36, 70]].map(([x, y, l, a]) => '<line x1="' + x + '" y1="' + y + '" x2="' + (x + l * Math.cos(a * Math.PI / 180)).toFixed(0) + '" y2="' + (y + l * Math.sin(a * Math.PI / 180)).toFixed(0) + '" stroke="#c09468" stroke-width="2" stroke-linecap="round" opacity=".12" filter="url(#tg-soft)"/>').join('');
  return '<svg class="tome-leather" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>' + GOLD
    // the leather: a fine fractal grain lit from the top left (relief), over a slow mottle of darker and lighter hide
    + '<filter id="tg-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="3" result="n"/><feDiffuseLighting in="n" surfaceScale="1.6" lighting-color="#d9b48a" result="l"><feDistantLight azimuth="225" elevation="58"/></feDiffuseLighting><feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/></filter>'
    + '<filter id="tg-mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .009" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .14  0 0 0 0 .07  0 0 0 0 .02  0 0 0 .9 -.25"/></filter>'
    // gilt: the gold catches a specular light and sits pressed into the leather (a dark lip above, a pale one below)
    + '<filter id="tg-emboss" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b"/><feSpecularLighting in="b" surfaceScale="3" specularConstant=".9" specularExponent="18" lighting-color="#fff6d8" result="s"><feDistantLight azimuth="225" elevation="45"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>'
    + '<feOffset in="SourceAlpha" dx="-1" dy="-1.2" result="up"/><feFlood flood-color="#0b0502" flood-opacity=".9"/><feComposite in2="up" operator="in" result="dark"/><feOffset in="SourceAlpha" dx="1" dy="1.4" result="dn"/><feFlood flood-color="#b98552" flood-opacity=".35"/><feComposite in2="dn" operator="in" result="lite"/>'
    + '<feMerge><feMergeNode in="dark"/><feMergeNode in="lite"/><feMergeNode in="SourceGraphic"/><feMergeNode in="sp"/></feMerge></filter>'
    + '<filter id="tg-soft"><feGaussianBlur stdDeviation="1.4"/></filter>'
    // the atom galaxy's light: gas blurred soft, a faint glow round the hot parts, and the gilt of the gas, the knots and the bulge
    + '<filter id="tg-haze" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>'
    + '<filter id="tg-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<linearGradient id="tg-gas" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc96"/><stop offset=".5" stop-color="#c58d3c"/><stop offset="1" stop-color="#e8bf68"/></linearGradient>'
    + '<radialGradient id="tg-puff"><stop offset="0" stop-color="#ffeab0" stop-opacity=".75"/><stop offset=".45" stop-color="#d9a24c" stop-opacity=".3"/><stop offset="1" stop-color="#9c6a22" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="tg-bulge"><stop offset="0" stop-color="#fffdf0"/><stop offset=".25" stop-color="#ffe6a0"/><stop offset=".55" stop-color="#e2b65a" stop-opacity=".75"/><stop offset="1" stop-color="#9c6a22" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="tg-wear" cx="50%" cy="46%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></radialGradient>'
    + '<linearGradient id="tg-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>'
    + '<style>.gold-line{fill:none;stroke:url(#tg-gold);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.gold-dots{fill:none;stroke:url(#tg-gold);stroke-width:3.2;stroke-linecap:round;stroke-dasharray:0 9}</style></defs>'
    + '<rect width="' + w + '" height="' + h + '" fill="#4a2c17"/>'
    + '<rect width="' + w + '" height="' + h + '" fill="#4a2c17" filter="url(#tg-grain)" opacity=".85" style="mix-blend-mode:multiply"/>'
    + '<rect width="' + w + '" height="' + h + '" filter="url(#tg-mottle)"/>'
    // the hinge: the groove where the board bends at the spine
    + '<rect x="22" y="0" width="5" height="' + h + '" fill="#120904" opacity=".7"/><rect x="27" y="0" width="2" height="' + h + '" fill="#a07048" opacity=".25"/>'
    + blind(40) + blind(52)
    + '<g filter="url(#tg-emboss)">' + fr(70, 'gold-line') + fr(78, 'gold-dots') + fr(86, 'gold-line')
    + corner(86, 86, 1, 1) + corner(w - 86, 86, -1, 1) + corner(86, h - 86, 1, -1) + corner(w - 86, h - 86, -1, -1) + '</g>'
    + blind(Math.round(h * 0.2)) // an inner panel pressed blind round the medallion
    + med + scuffs
    + '<rect width="' + w + '" height="' + h + '" fill="url(#tg-sheen)"/><rect width="' + w + '" height="' + h + '" fill="url(#tg-wear)"/>'
    + '</svg>';
}
/** the back cover: the same tooled leather and medallion, and the last words. Pure. */
export function backCoverHtml(book, esc) {
  return '<div class="cover-art cover-leather">' + leatherSvg({ medallion: true }) + '</div><div class="gilt title">The End</div><div class="gilt line">' + esc(book.title || 'The Book of Verse') + '</div><div class="gilt line foot">a-to-mind.com</div>';
}
/** the shut cover's face: the tooled leather board with the title stamped in gold above the medallion and nothing else (no tagline, no page count: owner, 2026-10-25, "no book ever lists its page count on the cover"). Pure. */
export function coverHtml(book, esc) {
  return '<div class="face out"><div class="cover-art cover-leather">' + leatherSvg() + '</div><div class="gilt title">' + esc(book.title || 'The Book of Verse') + '</div>' + (book.news && book.news.unseen ? '<div class="newbadge" role="status">' + book.news.unseen + ' new since you last opened the book</div>' : '') + '</div><div class="face in"></div>';
}
