/**
 * sprite-sheet skill: "clean up a sprite sheet" / "split a sprite sheet into frames" / "remove the magenta background from a sprite sheet" puts a card on
 * the stage: choose a PNG drawn on a magenta (#ff00ff) background, say its grid (columns x rows) and the frame size, and the card keys out the magenta,
 * cuts the grid, crops and fits each sprite (centred, or standing on the cell's floor), shows the frames playing and offers the clean transparent sheet
 * to save. The picture never leaves this browser. Joined from the owner's repos (frontier "absorb and connect every repo", 2026-10-29): the cleanup of
 * generate2dsprite from agent-sprite-forge (MIT License, Copyright (c) 2026 0x0funky), ported to lib/sprite-sheet.js (tests: tools/sprite-sheet.test.mjs).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { cardEl, keepOut, addThing } from '../lib/stage-pack.js';
import { splitGrid, composeSheet, gridOf } from '../lib/sprite-sheet.js';

const SHEET = '(?:sprite\\s*sheets?|spritesheets?|sprites?|animation\\s+sheets?|sprite\\s+atlas)';
const ASK = new RegExp('^(?:please\\s+)?(?:'
  + '(?:clean(?:\\s+up)?|tidy(?:\\s+up)?|fix|process|prepare|key(?:\\s+out)?|cut(?:\\s+up)?|slice(?:\\s+up)?|split(?:\\s+up)?)\\s+(?:a\\s+|my\\s+|this\\s+|the\\s+)?' + SHEET + '(?:\\s+(?:into|in\\s+to)\\s+(?:frames|cells|tiles))?'
  + '|(?:remove|take\\s+out|delete|strip|key\\s+out)\\s+(?:the\\s+)?(?:magenta|pink|chroma|chroma[\\s-]?key|#?ff00ff)\\s+(?:background\\s+|bg\\s+)?(?:from|off|of)\\s+(?:a\\s+|my\\s+|this\\s+|the\\s+)?' + SHEET
  + '|(?:make|turn)\\s+(?:a\\s+|my\\s+|this\\s+|the\\s+)?' + SHEET + '\\s+(?:transparent|clear)'
  + '|' + SHEET + '\\s+(?:cleaner|cleanup|clean\\s+up|splitter|slicer|cutter|tool|maker)'
  + ')(?:\\s+(?:\\d{1,2}\\s*(?:x|by)\\s*\\d{1,2}|\\d{1,2}\\s*(?:columns?|cols?|frames?|rows?)|\\d{2,3}\\s*(?:px|pixels?)))*$');

/** is this ask for the sprite sheet card. Pure. */
export function spriteIntent(text) { return ASK.test(String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')); }

const MAX_SIDE = 2048;
const field = (cls, label, value, min, max) => '<label style="display:inline-flex;gap:4px;align-items:center;margin-right:8px">' + label
  + ' <input type="number" class="' + cls + '" value="' + value + '" min="' + min + '" max="' + max + '" style="width:52px;font:inherit;font-size:13px"></label>';

function mount(th, stageApi) {
  const whole = (v, lo, hi, d) => { const n = Math.round(+v); return n >= lo && n <= hi ? n : d; };
  const el = cardEl(th, stageApi, 'sprite-card'), g = { cols: whole(th.cols, 1, 16, 4), rows: whole(th.rows, 1, 16, 1), cell: whole(th.cell, 16, 512, 64) };
  el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">Clean a sprite sheet</div>' // void-review: ok (fixed words and the three whole numbers above)
    + '<div style="font-size:13px;opacity:.8;margin-bottom:8px">Choose a PNG drawn on a magenta (#ff00ff) background. It stays in this browser; you get back the frames on a clear background, cut and lined up.</div>'
    + '<div style="font-size:13px;margin-bottom:6px">' + field('sp-cols', 'Columns', g.cols, 1, 16) + field('sp-rows', 'Rows', g.rows, 1, 16) + field('sp-cell', 'Frame px', g.cell, 16, 512) + '</div>'
    + '<div style="font-size:13px;margin-bottom:8px"><label style="margin-right:8px"><input type="checkbox" class="sp-feet"> Stand on the floor</label>'
    + '<label><input type="checkbox" class="sp-largest"> Largest piece only</label></div>'
    + '<input type="file" class="sp-file" accept="image/png,image/webp,image/gif" aria-label="choose a sprite sheet PNG" style="font:inherit;font-size:13px">'
    + '<div class="sp-out" role="status" style="margin-top:10px;font-size:13px"></div>'
    + '<div class="src" style="font-size:11px;opacity:.7;margin-top:8px">The cleanup steps of generate2dsprite (agent-sprite-forge, MIT License, Copyright (c) 2026 0x0funky), done on this device.</div>';
  const $ = (s) => el.querySelector(s), file = $('.sp-file'), out = $('.sp-out');
  let timer = 0, url = '';
  const show = async () => {
    const f = file.files && file.files[0]; if (!f) return;
    clearInterval(timer); if (url) URL.revokeObjectURL(url);
    out.textContent = 'Working...';
    let bmp;
    try { bmp = await createImageBitmap(f); } catch (_) { out.textContent = 'That file is not a picture this browser can open.'; return; }
    if (bmp.width > MAX_SIDE || bmp.height > MAX_SIDE) { out.textContent = 'That sheet is ' + bmp.width + ' x ' + bmp.height + ' pixels; the most is ' + MAX_SIDE + ' on a side.'; return; }
    const num = (s, lo, hi, d) => { const n = Math.round(+$(s).value); return n >= lo && n <= hi ? n : d; };
    const cols = num('.sp-cols', 1, 16, 4), rows = num('.sp-rows', 1, 16, 1), cell = num('.sp-cell', 16, 512, 64);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const cx = c.getContext('2d'); cx.drawImage(bmp, 0, 0);
    const src = cx.getImageData(0, 0, c.width, c.height);
    const { frames, info } = splitGrid(src, rows, cols, cell, { align: $('.sp-feet').checked ? 'feet' : 'center', componentMode: $('.sp-largest').checked ? 'largest' : 'all', sharedScale: $('.sp-feet').checked });
    const sheet = composeSheet(frames, rows, cols, cell), sc = document.createElement('canvas');
    sc.width = sheet.width; sc.height = sheet.height; sc.getContext('2d').putImageData(new ImageData(sheet.data, sheet.width, sheet.height), 0, 0);
    const empty = info.filter((x) => !x.crop).length;
    out.textContent = '';
    const said = document.createElement('div'); said.className = 'sp-said';
    said.textContent = frames.length + ' frame' + (frames.length === 1 ? '' : 's') + ' of ' + cell + ' x ' + cell + ' from a ' + cols + ' x ' + rows + ' grid' + (empty ? ', ' + empty + ' of them empty (check the grid)' : '') + '.';
    const check = 'background:repeating-conic-gradient(#444 0 25%,#666 0 50%) 0 0/16px 16px;image-rendering:pixelated;border-radius:6px';
    const play = document.createElement('canvas'); play.className = 'sp-play'; play.width = play.height = cell;
    play.style.cssText = check + ';width:' + Math.min(160, cell * 2) + 'px;height:' + Math.min(160, cell * 2) + 'px;display:block;margin:8px 0';
    const pc = play.getContext('2d'); let i = 0;
    const tick = () => { pc.clearRect(0, 0, cell, cell); pc.putImageData(new ImageData(frames[i % frames.length].data, cell, cell), 0, 0); i++; };
    tick(); if (frames.length > 1) timer = setInterval(() => { if (!el.isConnected) { clearInterval(timer); return; } tick(); }, 125);
    sc.className = 'sp-sheet'; sc.style.cssText = check + ';display:block;max-width:100%;max-height:200px;margin:4px 0';
    out.append(said, play, sc);
    sc.toBlob((b) => {
      if (!b) return; url = URL.createObjectURL(b);
      const a = document.createElement('a'); a.className = 'sp-save'; a.href = url; a.download = f.name.replace(/(\.[a-z0-9]+)?$/i, '-clean.png'); a.textContent = 'Save the clean sheet (PNG)';
      a.style.cssText = 'color:#9fd0ff'; out.appendChild(a);
    }, 'image/png');
  };
  file.addEventListener('change', show);
  for (const s of ['.sp-cols', '.sp-rows', '.sp-cell', '.sp-feet', '.sp-largest']) $(s).addEventListener('change', show);
  for (const n of el.querySelectorAll('input')) keepOut(n);
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
}

export default {
  name: 'sprite-sheet',
  examples: ['clean up a sprite sheet', 'split a sprite sheet into frames', 'remove the magenta background from a sprite sheet', 'sprite sheet cleaner', 'make my sprite sheet transparent', 'slice a spritesheet 4x2 64px'],
  nearMisses: ['draw a sprite', 'what is a sprite', 'sprite soda', 'clean my room', 'remove the background from a photo', 'split the bill'],
  spriteIntent,
  match(lower, text) { return spriteIntent(text || lower); },
  async run(text, api) {
    const th = addThing(api.stage, 'sprites', gridOf(text)); api.stage.select(th.id); api.stage.render();
    if (api.say) api.say('choose a sprite sheet · it stays in this browser');
    return 'sprite-sheet';
  },
  stageKinds: { sprites: { mount, ephemeral: true } },
};
