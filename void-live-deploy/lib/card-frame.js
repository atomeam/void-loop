// V01D cards (owner, 2026-10-16: "cards should look like actual cards, like magic cards ... with stats and an intention to add to the
// overall V01D experience"; "even what's new pussycat becomes its own magic style card, which we will call V01D cards").
// Every page V01D puts up is a card: a foil frame (its colour is the family, its foil the rarity), a title bar with a cost, an art box
// with the family's glyph, a type line with a rarity gem, the body as the text box, an "adds to V01D" line, and a footer with a collector
// number and a power/toughness plate. Nothing is invented: the rarity is the skill's evidence rating (proven mythic, checked rare, tested
// uncommon, experiment common); the cost is how many words you say to play it; power is its success rate out of nine and toughness the
// real asks that proved it; the collector number is its page in the V01D Book; "adds" is the one line the book says it does. An answer
// fetched from a source (an encyclopedia page) is an Answer card: power is how many sources it stands on, toughness how many days old the
// source is. The Illuminati card game (Steve Jackson Games) lends its three stats and its control arrows: Power, Resistance and Income,
// and arrows on the card's edges, from the site's real dependency map (skills/deps.json): an arrow out for each thing the skill controls
// (what it imports), an arrow in at the top when other skills lean on it, Income being how many do. Pure: cardOf(), chromeHtml(); the page calls keep() and style().
import { hueOf, glyphSvg } from './guide.js';

export const RARITY = {
  proven: { name: 'Mythic', gem: '#f0852d', foil: '#ffb347,#c4561a,#ffd27a,#b8430f' }, checked: { name: 'Rare', gem: '#e3c15a', foil: '#f1dc8a,#a98a2e,#f6e7a6,#8a6d1c' },
  tested: { name: 'Uncommon', gem: '#c5ccd6', foil: '#e8edf4,#8b95a3,#dfe5ee,#6f7886' }, experiment: { name: 'Common', gem: '#6b7280', foil: '#4a4f5a,#2a2e36,#4a4f5a,#23262d' },
};
const TIERS = ['experiment', 'tested', 'checked', 'proven'];

/** what a card shows, from what the site already knows: { rarity, hue, chapter, cost, typeLine, power, toughness, number, tested, adds, name, fetched }. Pure.
 *  skill: a families.json skill ({ name, tier, why, last_tested, success_rate }) or null; page: its guide.json page or null; book: guide.json;
 *  kind: 'Answer' | 'Skill' | 'Game' | 'Miniature'; sources / ageDays: for a fetched answer, how many sources and how old the newest is */
export function cardOf({ skill = null, page = null, book = null, kind = '', sources = null, ageDays = null, deps = null } = {}) {
  const chap = page && book ? (book.chapters || []).find((c) => c.id === page.chapter) : null;
  const tier = (skill && skill.tier) || (page && page.tier) || '';
  const rarity = RARITY[tier] || null, ti = Math.max(0, TIERS.indexOf(tier)); // an unknown tier word counts as the lowest, never negative
  const typeKind = kind || (page && page.game ? 'Game' : page && page.kind === 'mini' ? 'Miniature' : skill || page ? 'Skill' : 'Answer');
  const words = page && page.examples && page.examples[0] ? String(page.examples[0]).trim().split(/\s+/).length : 0;
  const sr = skill && Number.isFinite(+skill.success_rate) ? Math.max(0, Math.min(1, +skill.success_rate)) : null;
  const why = String((skill && skill.why) || (page && page.why) || ''), asks = (/(\d+)\s+real asks?/.exec(why) || [])[1];
  const stats = !!(skill || page) && tier !== '', fetched = !stats && typeKind === 'Answer' && sources != null && sources > 0;
  const chapter = page ? page.chapter : 'words';
  return {
    rarity, chapter, hue: hueOf(chapter), fetched,
    cost: words ? Math.min(6, words) : 0,
    typeLine: typeKind + (typeKind === 'Answer' ? ' — ' + (fetched ? (sources === 1 ? 'from a source' : 'from ' + sources + ' sources') : 'from V01D') : chap && chap.name ? ' — ' + chap.name : ''),
    power: stats ? (sr == null ? ti * 2 : Math.round(sr * 9)) : fetched ? Math.min(9, sources) : null,
    toughness: stats ? (asks ? Math.min(99, +asks) : ti + 1) : fetched ? (ageDays == null ? 1 : Math.max(0, Math.min(99, Math.round(ageDays)))) : null,
    income: stats && deps ? (deps.importedBy || []).length : null, arrowsOut: stats && deps ? Math.min(3, (deps.imports || []).length) : 0, arrowIn: !!(stats && deps && (deps.importedBy || []).length),
    number: page && book ? String(page.n).padStart(3, '0') + '/' + String((book.pages || []).length || '').padStart(3, '0') : '',
    tested: (skill && skill.last_tested) || '',
    adds: page && page.line ? String(page.line).replace(/\s+/g, ' ').slice(0, 120) : fetched ? 'A fact it did not have to be taught: fetched, sourced and dated.' : '',
    name: (skill && skill.name) || (page && page.name) || '',
  };
}

const gem = (r) => (r ? '<i class="vc-gem" style="background:' + r.gem + ';color:' + r.gem + '" title="' + r.name + '"></i>' : '');
/** the art box, the type bar, the adds line and the footer as HTML. Pure. */
export function chromeHtml(c, esc) {
  const art = '<div class="vc-art">' + glyphSvg({ chapter: c.chapter, name: c.name || c.typeLine, kind: 'skill' }, 54) + '</div>';
  const type = '<div class="vc-type"><span>' + esc(c.typeLine) + '</span>' + gem(c.rarity) + '</div>';
  const adds = c.adds ? '<div class="vc-adds"><b>Adds to V01D</b> ' + esc(c.adds) + '</div>' : '';
  const stat = (k, v, t) => '<span title="' + t + '">' + k + '<b>' + v + '</b></span>';
  const plate = c.power == null ? '' : '<div class="vc-pt">' + (c.fetched ? stat('P', c.power, 'power: the sources it stands on') + stat('R', c.toughness, 'resistance: days since the source was edited')
    : stat('P', c.power, 'power: success rate out of nine') + stat('R', c.toughness, 'resistance: real asks that proved it') + (c.income == null ? '' : stat('I', c.income, 'income: how many other files lean on it'))) + '</div>';
  const arrows = '<div class="vc-arrows" aria-hidden="true">' + (c.arrowIn ? '<i class="in">\u25bc</i>' : '') + ['r', 'b', 'l'].slice(0, c.arrowsOut).map((d) => '<i class="' + d + '">\u25b6</i>').join('') + '</div>';
  const foot = '<div class="vc-foot"><div class="vc-num">' + (c.rarity ? esc(c.rarity.name) + ' · ' : '') + (c.number ? esc(c.number) + ' · ' : '') + 'V01D' + (c.tested ? ' · tested ' + esc(c.tested) : '') + '</div>' + plate + '</div>';
  return { art, type, adds, foot, arrows };
}

const FOIL = (r) => 'linear-gradient(135deg,' + (r ? r.foil : '#5b6483,#2c3350,#5b6483,#262c46') + ')';
export const CARD_CSS = [
  '.vpage.vcard{--h:230;--edge:hsl(var(--h) 38% 48%);padding:0 0 12px!important;border:10px solid transparent!important;border-radius:22px!important;',
  'background:linear-gradient(170deg,hsl(var(--h) 26% 15%),hsl(var(--h) 22% 8%)) padding-box,var(--foil,' + FOIL(null) + ') border-box!important;',
  'box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 0 0 2px rgba(0,0,0,.5),inset 0 0 0 3px var(--edge)!important}',
  '.vpage.vcard[data-rarity=mythic]{--foil:' + FOIL(RARITY.proven) + '}.vpage.vcard[data-rarity=rare]{--foil:' + FOIL(RARITY.checked) + '}.vpage.vcard[data-rarity=uncommon]{--foil:' + FOIL(RARITY.tested) + '}.vpage.vcard[data-rarity=common]{--foil:' + FOIL(RARITY.experiment) + '}',
  '.vcard>*:not(.vc-art):not(.vc-type):not(.vc-foot):not(.vc-adds):not(.vc-title):not(style){margin-left:18px;margin-right:18px}',
  '.vcard .vc-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 12px 0!important;padding:5px 12px;background:linear-gradient(90deg,hsl(var(--h) 28% 22%),hsl(var(--h) 24% 15%));border:2px solid var(--edge);border-radius:12px 12px 6px 6px/16px 16px 6px 6px;font-weight:600;letter-spacing:.02em;font-size:20px}',
  '.vcard .vc-title::after{content:attr(data-cost);font-size:13px;letter-spacing:.18em;color:hsl(var(--h) 60% 74%);white-space:nowrap}',
  '.vcard .vc-art{display:flex;align-items:center;justify-content:center;height:72px;margin:7px 12px 0;border:2px solid var(--edge);border-radius:4px;background:radial-gradient(ellipse at 50% 120%,hsl(var(--h) 60% 40% / .55),transparent 70%),linear-gradient(180deg,hsl(var(--h) 30% 12%),hsl(var(--h) 34% 20%));overflow:hidden}.vcard .vc-art .gglyph{filter:drop-shadow(0 0 8px hsl(var(--h) 80% 60% / .6))}',
  '.vcard .vc-type{display:flex;align-items:center;justify-content:space-between;margin:7px 12px 12px;padding:3px 12px;background:linear-gradient(90deg,hsl(var(--h) 26% 21%),hsl(var(--h) 22% 16%));border:2px solid var(--edge);border-radius:6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:hsl(var(--h) 40% 78%)}',
  '.vcard .vc-gem{width:11px;height:11px;transform:rotate(45deg);border-radius:2px;box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 9px currentColor}',
  '.vcard .vc-adds{margin:8px 12px 0;padding:8px 12px;border-top:1px solid var(--edge);font-size:12.5px;font-style:italic;color:hsl(var(--h) 18% 74%)}.vcard .vc-adds b{font-style:normal;letter-spacing:.08em;text-transform:uppercase;font-size:11px;color:hsl(var(--h) 55% 72%);margin-right:6px}',
  '.vcard .vc-foot{position:sticky;bottom:-12px;padding:8px 0 12px;background:linear-gradient(180deg,transparent,hsl(var(--h) 22% 8%) 38%);z-index:2;display:flex;align-items:flex-end;justify-content:space-between;margin:8px 12px 0;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:hsl(var(--h) 15% 62%)}',
  '.vcard .vc-pt{min-width:58px;text-align:center;padding:3px 12px;background:linear-gradient(180deg,hsl(var(--h) 28% 26%),hsl(var(--h) 26% 14%));border:2px solid var(--edge);border-radius:9px 4px 9px 4px;font-size:17px;font-weight:700;letter-spacing:.05em;color:#f3efe2;box-shadow:0 2px 6px rgba(0,0,0,.5)}',
  '.vcard .vc-pt{display:flex;gap:8px;padding:3px 9px}.vcard .vc-pt span{font-size:10px;letter-spacing:.1em;color:hsl(var(--h) 30% 70%);display:flex;align-items:baseline;gap:3px}.vcard .vc-pt b{font-size:16px;color:#f3efe2;letter-spacing:.02em}',
  '.vcard .vc-arrows i{position:absolute;font-style:normal;font-size:12px;line-height:1;color:var(--edge);text-shadow:0 0 6px currentColor}.vcard .vc-arrows .in{top:-2px;left:50%;transform:translateX(-50%)}.vcard .vc-arrows .r{right:-1px;top:50%;transform:translateY(-50%)}.vcard .vc-arrows .l{left:-1px;top:50%;transform:translateY(-50%) scaleX(-1)}.vcard .vc-arrows .b{bottom:-3px;left:50%;transform:translateX(-50%) rotate(90deg)}',
  '@media (max-width:520px){.vcard .vc-title{margin:8px 6px 0!important;font-size:18px}.vcard .vc-art,.vcard .vc-type,.vcard .vc-adds,.vcard .vc-foot{margin-left:6px;margin-right:6px}.vcard .vc-art{height:58px}.vcard .vc-pt{gap:5px;padding:3px 6px}.vcard .vc-foot{font-size:9.5px;gap:6px}}',
].join('');

let cache = null;
/** the site's own files, once: guide.json (the pages) and families.json (the ratings); nulls where they cannot be read */
export function loadStats() {
  if (!cache) {
    const get = (u) => fetch(u, { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    cache = Promise.all([get('/skills/guide.json'), get('/skills/families.json'), get('/skills/deps.json')]).then(([book, fam, deps]) => ({ book, fam, deps }));
  }
  return cache;
}
/** the families.json skill and the guide.json page for a skill name, or nulls. Pure. */
export function lookup(stats, name) {
  const book = stats && stats.book, fam = stats && stats.fam;
  let skill = null; for (const f of (fam && fam.families) || []) for (const s of f.skills || []) if (s.name === name) skill = s;
  const page = book ? (book.pages || []).find((p) => (p.kind === 'skill' || p.kind === 'game' || p.kind === 'mini') && p.name === name) || null : null;
  const f = stats && stats.deps && stats.deps.files, d = f && f['skills/' + name + '.js'];
  return { skill, page, book, deps: d ? { imports: (d.imports || []).filter((x) => !/\/mini\//.test(x)), importedBy: d.importedBy || [] } : null };
}
/** how many days ago a source line says it was edited ("Source: Wikipedia · last edited Sep 3, 2026"), or null. Pure. */
export function editedDaysAgo(text, now = Date.now()) {
  const m = /last edited ([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})/.exec(String(text || '')); if (!m) return null;
  const t = Date.parse(m[1]); return Number.isFinite(t) ? Math.max(0, (now - t) / 864e5) : null;
}

/** put the card's frame on a page, or refresh it: idempotent, and safe to call from a MutationObserver (it only writes when it changes). */
export function keep(el, esc, stats) {
  if (!el || !el.classList) return;
  if (!el.classList.contains('vcard')) el.classList.add('vcard');
  const name = el.dataset.skill || '', srcLinks = el.querySelectorAll('.src a').length, src = el.querySelector('.src');
  const c = cardOf({ ...lookup(stats, name), kind: el.dataset.cardKind || '', sources: name ? null : srcLinks || null, ageDays: name ? null : editedDaysAgo(src && src.textContent) });
  const key = JSON.stringify([c.typeLine, c.cost, c.power, c.toughness, c.income, c.arrowsOut, c.arrowIn, c.number, c.adds, c.rarity && c.rarity.name, c.hue]);
  const h2 = el.querySelector('h2');
  if (h2 && !h2.classList.contains('vc-title')) h2.classList.add('vc-title');
  if (el.dataset.cardKey === key && el.querySelector(':scope > .vc-type') && el.querySelector(':scope > .vc-arrows') === el.lastElementChild) return;
  for (const n of el.querySelectorAll(':scope > .vc-art, :scope > .vc-type, :scope > .vc-adds, :scope > .vc-foot, :scope > .vc-arrows')) n.remove();
  el.style.setProperty('--h', String(c.hue));
  el.dataset.cardKey = key; el.dataset.rarity = c.rarity ? c.rarity.name.toLowerCase() : 'answer';
  if (h2) h2.dataset.cost = c.cost ? '◆'.repeat(c.cost) : '';
  const html = chromeHtml(c, esc), tpl = document.createElement('template');
  tpl.innerHTML = html.art + html.type; /* void-review: ok: chromeHtml escapes every text field */ const top = [...tpl.content.childNodes];
  if (h2 && h2.parentNode === el) { let at = h2; for (const n of top) { at.after(n); at = n; } } else for (const n of top.reverse()) el.prepend(n);
  tpl.innerHTML = html.adds + html.foot + html.arrows; // void-review: ok: built by chromeHtml, every text field escaped
  for (const n of [...tpl.content.childNodes]) el.appendChild(n);
}

let styled = false;
/** the one stylesheet, once */
export function style() { if (styled || typeof document === 'undefined') return; styled = true; const s = document.createElement('style'); s.id = 'vcard-css'; s.textContent = CARD_CSS; document.head.appendChild(s); }
