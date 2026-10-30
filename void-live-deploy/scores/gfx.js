// Match graphics on a game's detail and on a story (loaded after the page has drawn): the pictures lib/matchgfx.js draws, each in a box whose shape is kept before it is
// filled (no layout shift), with the facts as a caption, and Save picture (a PNG made in this browser) and Copy picture. Nothing leaves the device.
import * as G from '/lib/matchgfx.js';

const NS = 'http://www.w3.org/2000/svg';
const parse = (svg) => { const d = new DOMParser().parseFromString(svg, 'image/svg+xml'); return d.documentElement && d.documentElement.nodeName === 'svg' ? document.importNode(d.documentElement, true) : null; };
/** the picture as a PNG blob, drawn at 1200 px wide from the SVG text */
export async function toPng(svg) {
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg); if (!m) throw new Error('no size');
  const w = 1200, h = Math.round(w * (+m[2]) / (+m[1])), sized = svg.replace('width="100%"', 'width="' + w + '" height="' + h + '"'), url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try { const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; }); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('png'))), 'image/png')); } finally { URL.revokeObjectURL(url); }
}
/** one picture in its reserved box with its caption and its two buttons: { svg, alt } from lib/matchgfx.js */
export function box(h, pic, name, say = () => {}) {
  const [, , vw, vh] = /viewBox="(\d+) (\d+) (\d+) (\d+)"/.exec(pic.svg) || [0, 0, 600, 200], holder = h('div', { style: 'aspect-ratio:' + vw + '/' + vh + ';width:100%' }), node = parse(pic.svg); if (node) holder.append(node);
  return h('figure', { style: 'margin:8px 0' }, holder, h('figcaption', { class: 'note', style: 'min-height:0', text: pic.alt }),
    h('div', { class: 'row', style: 'margin:0 0 6px' }, h('button', { type: 'button', text: 'Save picture', onclick: async () => { try { const b = await toPng(pic.svg), a = h('a', { href: URL.createObjectURL(b), download: name + '.png' }); document.body.append(a); a.click(); a.remove(); } catch (_) { say('Could not make the picture here.'); } } }),
      h('button', { type: 'button', text: 'Copy picture', onclick: async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng(pic.svg) })]); say('Picture copied.'); } catch (_) { say('This browser cannot copy a picture; use Save picture.'); } } })));
}
/** the pane of pictures for one game: score card, timeline (when the feed lists events), stats bars, lineups on a pitch (when it gives a formation), the win-chance curve while it is live */
export function pane(h, game, sum, leagueName, wp, when, say) {
  const pics = [G.scoreCard(game, leagueName, 'ESPN', when)];
  if ((game.events && game.events.length) || (sum && sum.events && sum.events.length)) pics.push(G.timeline({ ...game, events: game.events && game.events.length ? game.events : sum.events }));
  if (sum && sum.stats && sum.stats.length === 2 && sum.stats[0].stats.length) pics.push(G.statsBars(game.home.name, game.away.name, sum.stats[0].stats.map((x, i) => ({ label: x.label, home: x.value, away: (sum.stats[1].stats.find((y) => y.label === x.label) || {}).value })).filter((x) => x.away !== undefined)));
  const pt = sum && sum.lineups && G.pitch(game, sum.lineups); if (pt) pics.push(pt);
  if (wp && wp.length > 1) pics.push(G.curve(wp, game.home.name, game.away.name));
  return h('div', { class: 'pane' }, h('h2', { text: 'Match graphics', style: 'margin-top:0' }), pics.map((p, i) => box(h, p, 'verse-' + game.id + '-' + i, say)));
}
export { G };
