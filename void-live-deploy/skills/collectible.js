/**
 * collectible skill (owner, 2026-10-18: "make a collectible card of [anything]" ... "foil / normal / full-art variants", "a print sheet of 9";
 * "the art should be of each card's subject, like a magic card or some other really cool collectors card"): "make a collectible card of a dragon",
 * "mint a card of the moon", "collectible card of tokyo". The subject is asked like any ask, so its own answer card appears (Verse's frame,
 * stats, rarity, the void art of its subject and the Art Forge's painting); this skill then marks it a collectible and gives it a strip of
 * variants (Normal, Foil: a holographic sweep over the art, Full art: the art fills a tall window) and a print sheet of 9 (the saved card
 * picture, lib/card-image.js, tiled 3 x 3 on one PNG). Nothing is sent anywhere by this skill.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { readCard, imageData, artPicture } from '../lib/card-share.js';
import { cardSvg, toPng, CARD_W, CARD_H } from '../lib/card-image.js';
import { paintNow } from '../lib/card-forge.js';

const WHEN = /^(?:(?:please\s+)?(?:make|mint|create|forge|give)\s+(?:me\s+)?(?:a|an|my)?\s*)?(?:collectible|collector'?s?|trading|holo(?:graphic)?|foil)\s+card\s+(?:of|for|about|from)\s+(.{1,80})$|^mint\s+(?:me\s+)?(?:a\s+)?card\s+(?:of|for|about)\s+(.{1,80})$/i;
export const VARIANTS = ['normal', 'foil', 'full'];
/** the subject of a collectible ask, or ''. Pure. */
export function subjectOf(text) {
  const m = WHEN.exec(String(text || '').trim().replace(/[?!.]+$/, ''));
  return m ? (m[1] || m[2] || '').replace(/^(?:a|an|the)\s+/i, '').trim() : '';
}
/** where each of the 9 cards goes on a print sheet: 3 x 3 with a gutter, in sheet pixels. Pure. */
export function sheetPlan(w = CARD_W, h = CARD_H, gap = 24) {
  const out = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push({ x: gap + c * (w + gap), y: gap + r * (h + gap), w, h });
  return { width: 3 * w + 4 * gap, height: 3 * h + 4 * gap, cells: out };
}

export const COLLECT_CSS = '.vcard.vc-collect .vc-art::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none}'
  + '.vcard.vc-collect[data-variant=foil] .vc-art::before{background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.16) 45%,rgba(110,255,240,.12) 48%,rgba(255,120,240,.12) 51%,transparent 56%);background-size:300% 100%;mix-blend-mode:screen;animation:vc-holo 3.6s linear infinite}'
  + '.vpage.vcard.vc-collect[data-variant=foil]{--foil:linear-gradient(135deg,#ffb347,#ff9ad5,#7affd9,#9eb2ff,#ffd27a)}'
  + '@keyframes vc-holo{from{background-position:130% 0}to{background-position:-130% 0}}@media (prefers-reduced-motion:reduce){.vcard.vc-collect[data-variant=foil] .vc-art::before{animation:none;background-position:50% 0}}'
  + '.vcard.vc-collect[data-variant=full] .vc-art{aspect-ratio:3/4;max-height:min(560px,62vh)}'
  + '.vcard .vc-variants{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 18px 0}.vcard .vc-variants button{font:600 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:999px;border:1px solid var(--edge);background:rgba(0,0,0,.35);color:inherit;cursor:pointer}'
  + '.vcard .vc-variants button[aria-pressed=true]{background:var(--edge);color:#0a0a12}';

function style() { if (!document.getElementById('collect-css')) { const s = document.createElement('style'); s.id = 'collect-css'; s.textContent = COLLECT_CSS; document.head.appendChild(s); } }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** a 3 x 3 sheet of the card's saved picture, downloaded as a PNG */
export async function printSheet(el) {
  const d = readCard(el), data = imageData(el, d); if (!data.art) data.art = await artPicture(el).catch(() => '');
  const blob = await toPng(cardSvg(data, {}), 1), url = URL.createObjectURL(blob), img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
  const plan = sheetPlan(img.naturalWidth || CARD_W, img.naturalHeight || CARD_H), c = document.createElement('canvas'); c.width = plan.width; c.height = plan.height;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  for (const p of plan.cells) g.drawImage(img, p.x, p.y, p.w, p.h);
  URL.revokeObjectURL(url);
  const out = await new Promise((ok) => c.toBlob(ok, 'image/png')); if (!out) return false;
  const a = document.createElement('a'), u = URL.createObjectURL(out); a.href = u; a.download = (String(d.t || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card') + '-sheet-of-9.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  el.dataset.sheet = String(plan.cells.length); return true;
}

function strip(el) {
  if (el.querySelector(':scope > .vc-variants')) return;
  const bar = document.createElement('div'); bar.className = 'vc-variants'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Card variant');
  const set = (v) => { el.dataset.variant = v; for (const b of bar.querySelectorAll('[data-variant]')) b.setAttribute('aria-pressed', String(b.dataset.variant === v)); };
  for (const [v, label] of [['normal', 'Normal'], ['foil', 'Foil'], ['full', 'Full art']]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.variant = v; b.textContent = label;
    b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); set(v); }); bar.appendChild(b);
  }
  const sheet = document.createElement('button'); sheet.type = 'button'; sheet.textContent = 'Print sheet of 9'; sheet.dataset.sheetBtn = '1';
  sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
  sheet.addEventListener('click', async (e) => { e.stopPropagation(); sheet.disabled = true; sheet.textContent = 'making the sheet…'; let ok = false; try { ok = await printSheet(el); } catch (_) {} sheet.disabled = false; sheet.textContent = ok ? 'Sheet saved · again' : 'Could not make the sheet'; });
  bar.appendChild(sheet);
  const art = el.querySelector(':scope > .vc-type') || el.querySelector(':scope > .vc-art'); if (art) art.after(bar); else el.appendChild(bar);
  set('foil');
}

async function run(text, api) {
  const subject = subjectOf(text); if (!subject) return 'none';
  style();
  const before = document.querySelector('.vpage.on');
  await api.stage.ask(subject);
  let el = null; for (let i = 0; i < 60 && !el; i++) { const c = document.querySelector('.vpage.on.vcard'); if (c && c !== before && c._vcard) el = c; else await wait(100); } // the subject's own answer frames its card
  if (!el) { const c = document.querySelector('.vpage.on'); if (c && c !== before) el = c; } // not framed yet: the page frames it once this skill returns
  if (!el) { api.say('no card came back for ' + subject); return 'collectible'; }
  el.dataset.collect = subject; el.dataset.deckKind = 'collectible'; // the binder files it as a collectible (lib/card-deck.js)
  el.classList.add('vc-collect'); strip(el);
  let asked = false; const paintOnce = () => { if (!asked && el._vcard) { asked = true; paintNow(el); } }; // the real painting of the subject (lib/card-forge.js), over the void art once it lands
  setTimeout(paintOnce, 600);
  // the frame is rebuilt as the answer's facts arrive: put the strip back when that happens
  const mo = new MutationObserver(() => { if (!el.isConnected) { mo.disconnect(); return; } paintOnce(); if (el.classList.contains('vc-collect') && !el.querySelector(':scope > .vc-variants')) { const v = el.dataset.variant; strip(el); if (v) el.querySelector('.vc-variants [data-variant="' + v + '"]')?.click(); } });
  mo.observe(el, { childList: true });
  return 'collectible';
}

export default {
  name: 'collectible',
  examples: ['make a collectible card of a dragon', 'mint a card of the moon', 'collectible card of tokyo', 'make me a foil card of a black hole'],
  nearMisses: ['make a card for my mom', 'trading card values', 'collectible coins', 'business card ideas'],
  match(lower, text) { return !!subjectOf(text || lower); },
  run,
};
