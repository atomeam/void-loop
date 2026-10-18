/**
 * stage-image skill — the stage as a picture, and a code that opens it (tools pack 5, owner 2026-10-18; numbers 101, 102, 108).
 * "copy the stage as an image" paints every card on the stage into one PNG and puts it on the clipboard (101); "copy this card as a png"
 * does the picked card alone (102); where the browser will not paste a picture it saves the PNG instead and says so. The card is painted
 * as it looks (the browser draws a copy of it, styles and all); a card it cannot paint that way (a video, a 3D view) is drawn as a plain
 * labelled box rather than left out. "qr code for this stage view" shows a QR code (lib/qr.js, made here, no service) for this page's
 * address (108): scanning it opens Verse on another device. The stage itself stays on this device, a QR code cannot carry it.
 * The collectible skill still copies a Verse answer card; this one is for the things on the stage. Nothing is uploaded.
 */
import { imageIntent, unionBox, pixelSize, foreignSvg, plainLayout } from '../lib/stage-image.js';
import { qrMatrix, qrSvg } from '../lib/qr.js';
import { thingLabel } from '../lib/stage-find.js';
import { localDay } from '../lib/stage-pack.js';

const BTN = 'font:inherit;cursor:pointer;margin:0 .5em .4em 0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:2px 11px';

/** a copy of a live element the browser can paint on its own: its computed styles written in, canvases as pictures, frames as boxes. */
function snap(src) {
  const tag = src.tagName;
  const cs = getComputedStyle(src);
  let css = '';
  for (const p of cs) css += p + ':' + cs.getPropertyValue(p) + ';';
  if (tag === 'CANVAS') { const img = document.createElement('img'); try { img.src = src.toDataURL('image/png'); } catch (_) { /* a 3D view cannot be read */ } img.setAttribute('style', css); return img; }
  if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'AUDIO' || tag === 'OBJECT' || tag === 'EMBED') { const d = document.createElement('div'); d.setAttribute('style', css + ';background:#222;border:1px dashed #666'); d.textContent = ''; return d; }
  if (tag === 'SCRIPT' || tag === 'STYLE') return document.createComment('');
  const dst = src.cloneNode(false);
  dst.setAttribute('style', css);
  if (tag === 'IMG') { try { const c = document.createElement('canvas'); c.width = src.naturalWidth; c.height = src.naturalHeight; c.getContext('2d').drawImage(src, 0, 0); dst.setAttribute('src', c.toDataURL('image/png')); } catch (_) { dst.removeAttribute('src'); } }
  if (tag === 'TEXTAREA') dst.textContent = src.value;
  if (tag === 'INPUT') dst.setAttribute('value', src.value);
  if (tag === 'svg' || src instanceof SVGElement) { return src.cloneNode(true); }
  for (const ch of src.childNodes) dst.appendChild(ch.nodeType === 1 ? snap(ch) : ch.cloneNode(true));
  return dst;
}

/** true when the canvas holds one colour only (nothing was painted on the background). */
export function blankCanvas(ctx, w, h) {
  try {
    const n = 24; let first = null;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const d = ctx.getImageData(Math.min(w - 1, Math.floor((i + 0.5) * w / n)), Math.min(h - 1, Math.floor((j + 0.5) * h / n)), 1, 1).data, k = d[0] + ',' + d[1] + ',' + d[2] + ',' + d[3];
      if (first === null) first = k; else if (k !== first) return false;
    }
    return true;
  } catch (_) { return false; }
}

const stageBackground = () => { const c = getComputedStyle(document.body).backgroundColor; return c && c !== 'rgba(0, 0, 0, 0)' ? c : '#05060a'; };

/** paint these stage elements (with their stage things for labels) into a PNG blob. { blob, via, w, h } */
export async function paint(els, things) {
  const rects = els.map((e) => e.getBoundingClientRect());
  const box = unionBox(rects);
  if (!box) return null;
  const px = pixelSize(box.w, box.h, 2);
  const canvas = document.createElement('canvas'); canvas.width = px.w; canvas.height = px.h;
  const ctx = canvas.getContext('2d');
  const bg = stageBackground();
  // 1. the real thing: the cards copied with their styles into a picture the browser paints
  try {
    const root = document.createElement('div');
    root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    root.setAttribute('style', 'position:relative;width:' + box.w + 'px;height:' + box.h + 'px;background:' + bg + ';overflow:hidden');
    els.forEach((el, i) => {
      const c = snap(el), r = rects[i];
      c.style.position = 'absolute'; c.style.left = Math.round(r.left - box.x) + 'px'; c.style.top = Math.round(r.top - box.y) + 'px'; c.style.margin = '0'; c.style.transform = 'none'; c.style.opacity = '1'; c.style.visibility = 'visible'; c.style.animation = 'none'; c.style.transition = 'none'; // a card still fading in is painted whole
      root.appendChild(c);
    });
    const svg = foreignSvg(new XMLSerializer().serializeToString(root), box.w, box.h), href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    // the browser can hand the picture back a moment before it has painted the cards: load it afresh and draw again until something other than the background shows
    let blob = null;
    for (let tries = 0; tries < 3 && !blob; tries++) {
      const img = new Image();
      img.src = href;
      await img.decode();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      ctx.fillStyle = bg; ctx.fillRect(0, 0, px.w, px.h);
      ctx.drawImage(img, 0, 0, px.w, px.h);
      if (blankCanvas(ctx, px.w, px.h)) { await new Promise((r) => setTimeout(r, 150)); continue; }
      blob = await new Promise((ok) => { try { canvas.toBlob(ok, 'image/png'); } catch (_) { ok(null); } });
    }
    if (blob) return { blob, via: 'cards', w: px.w, h: px.h };
  } catch (_) { /* the browser would not paint it: the plain version below */ }
  // 2. the plain version: a labelled box per card
  const c2 = document.createElement('canvas'); c2.width = px.w; c2.height = px.h;
  const g = c2.getContext('2d');
  g.scale(px.scale, px.scale);
  g.fillStyle = bg; g.fillRect(0, 0, box.w, box.h);
  const lay = plainLayout(els.map((e, i) => { const th = things[e.dataset.id]; return { left: rects[i].left, top: rects[i].top, width: rects[i].width, height: rects[i].height, kind: th ? th.kind : '', label: th ? thingLabel(th) : '' }; }), box);
  g.textBaseline = 'top';
  for (const b of lay) {
    g.fillStyle = 'rgba(30,30,44,.95)'; g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    g.beginPath(); g.roundRect ? g.roundRect(b.x, b.y, b.w, b.h, 12) : g.rect(b.x, b.y, b.w, b.h); g.fill(); g.stroke();
    g.fillStyle = '#e8e8e8'; g.font = '600 13px system-ui,sans-serif'; g.fillText(b.title, b.x + 10, b.y + 8, Math.max(10, b.w - 20));
    g.font = '13px system-ui,sans-serif'; g.fillText(b.text, b.x + 10, b.y + 28, Math.max(10, b.w - 20));
  }
  const blob = await new Promise((ok) => c2.toBlob(ok, 'image/png'));
  return blob ? { blob, via: 'plain', w: px.w, h: px.h } : null;
}

function save(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** copy the picture, or save it when the browser will not take a picture on the clipboard. 'copied' | 'saved' */
export async function copyOrSave(blob, name) {
  try {
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); return 'copied'; }
  } catch (_) { /* denied or unsupported: save it */ }
  save(blob, name);
  return 'saved';
}

async function pictureCard(api, els, what, name) {
  const things = api.stage.things(), r = await paint(els, things);
  if (!r) { api.say('nothing to paint'); return 'none'; }
  const how = await copyOrSave(r.blob, name);
  const el = api.showPage((p) => { p.innerHTML = '<h2>' + api.esc(what) + '</h2>'; });
  const url = URL.createObjectURL(r.blob);
  el.innerHTML = '<h2>' + api.esc(what) + '</h2><p class="p5-said">' + (how === 'copied' ? 'Copied to the clipboard.' : 'Your browser would not put a picture on the clipboard, so it was saved as a file.') + '</p>' // void-review: ok: fixed words, the title is escaped
    + '<img class="p5-shot" alt="the picture" style="max-width:100%;max-height:260px;border-radius:8px;border:1px solid rgba(255,255,255,.2)"><div style="margin-top:6px"><button type="button" class="p5-save" style="' + BTN + '">Save PNG</button></div>'
    + '<div class="src">' + r.w + ' x ' + r.h + ' px, painted in this browser' + (r.via === 'plain' ? ' (as plain boxes: a card here cannot be painted as it looks)' : '') + '. Nothing is uploaded.</div>';
  el.dataset.via = r.via; el.dataset.w = r.w; el.dataset.h = r.h; el.dataset.how = how;
  el.querySelector('img.p5-shot').src = url;
  el.querySelector('button.p5-save').addEventListener('click', () => save(r.blob, name));
  return 'stage-image';
}

async function run(text, api) {
  const it = imageIntent(text);
  if (!it) return 'none';
  const st = api.stage;
  if (it.op === 'qr') {
    const href = location.href.split('#')[0];
    const q = qrMatrix(href); // the shared encoder (lib/qr.js, the spectators card's): null when the address does not fit any size
    if (!q) { api.say('this address is too long for a code'); return 'stage-image'; }
    const svg = qrSvg(q, { label: 'QR code for this page' }).replace('<svg ', '<svg width="' + (q.size + 8) * 5 + '" height="' + (q.size + 8) * 5 + '" ');
    const el = api.showPage((p) => { p.innerHTML = '<h2>QR code for this page</h2>'; });
    el.innerHTML = '<h2>QR code for this page</h2><div class="p5-qr" style="background:#fff;display:inline-block;border-radius:8px;line-height:0">' + svg + '</div><p style="word-break:break-all"></p>' // void-review: ok: the svg is built by lib/qr.js from digits only
      + '<div class="src">Scan it to open this page on another device. Your stage stays on this device; a code cannot carry it. Made here, no service involved.</div>';
    el.querySelector('p').textContent = href;
    el.dataset.qrFor = href;
    return 'stage-image';
  }
  const all = [...st.stage.querySelectorAll(':scope > .thing[data-id], :scope > [data-id]')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  if (it.op === 'card') {
    const id = st.selected(), el = id && st.stage.querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (!el) { api.say('pick a card first'); return 'stage-image'; }
    return pictureCard(api, [el], 'Card as a picture', 'void-card-' + localDay() + '.png');
  }
  if (!all.length) { api.say('nothing on the stage to paint'); return 'stage-image'; }
  return pictureCard(api, all, 'Stage as a picture', 'void-stage-' + localDay() + '.png');
}

export default {
  name: 'stage-image',
  examples: ['copy the stage as an image', 'copy this card as a png', 'qr code for this stage view', 'screenshot the stage'],
  nearMisses: ['copy the card', 'qr code for my wifi', 'what is a png', 'make an image of a cat', 'copy the list to the notepad', 'show this image https://example.org/cat.png'],
  imageIntent,
  match(lower, text) { return !!imageIntent(text || lower); },
  run,
};
