/**
 * poster skill: "make this a poster" (frontier #15, the first piece's visible half). The open card (the open page, the
 * selected card, else the newest one) becomes a print-ready poster file at 12×18, 18×24 or 24×36 inches, 150 dpi, drawn in
 * this browser: nothing is uploaded. Ordering it waits for a print-on-demand account (its key as a Pages secret) and a yes
 * on the confirm line, so the card says that plainly and shows no price it has no source for.
 * "make this a poster", "print this card as a poster", "turn this into a poster".
 */
export const DPI = 150;
export const POSTER_SIZES = [[12, 18], [18, 24], [24, 36]].map(([w, h]) => ({ w, h, name: `${w}×${h} in`, px: [w * DPI, h * DPI] }));

export function posterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  // "order …" is the spend path (lib/approval-core.js order.place, the confirm line): the real order goes there once a
  // print account is connected, so this skill takes make/print/turn and leaves "order" to the confirm line
  return /^(?:please\s+)?(?:(?:make|print|turn)\s+(?:this|the open card|this card|it)\s+(?:as|into)\s+an?\s+poster|make\s+(?:this|it)\s+(?:an?\s+)?poster|(?:make|print)\s+an?\s+poster\s+(?:of|from)\s+(?:this|this card|it)|poster\s+of\s+this(?:\s+card)?)$/.test(t);
}

// Where each line goes on a w×h poster: the title large at the top, the card's text wrapped inside the margins, a small
// a-to-mind.com mark at the foot. measure(text, size) is the canvas's measureText width (a stand-in in tests).
export function layoutPoster({ title, text }, w, h, measure) {
  const margin = Math.round(w * 0.08), inner = w - 2 * margin, lines = [];
  const wrap = (s, size) => {
    const out = []; let cur = '';
    for (const word of String(s).split(/\s+/).filter(Boolean)) {
      const next = cur ? cur + ' ' + word : word;
      if (measure(next, size) <= inner || !cur) cur = next; else { out.push(cur); cur = word; }
    }
    if (cur) out.push(cur);
    return out.map((l) => { while (l.length > 1 && measure(l, size) > inner) l = l.slice(0, -2) + '…'; return l; });
  };
  const titleSize = Math.round(w * 0.07), bodySize = Math.round(w * 0.028), markSize = Math.round(w * 0.016);
  let y = margin + titleSize, cut = false;
  for (const l of wrap(title || 'Void', titleSize).slice(0, 3)) { lines.push({ text: l, size: titleSize, x: margin, y, weight: 600 }); y += titleSize * 1.15; }
  y += bodySize * 1.2;
  const foot = h - margin, last = foot - markSize * 3;
  for (const para of String(text || '').split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
    for (const l of wrap(para, bodySize)) {
      if (y > last) { cut = true; break; }
      lines.push({ text: l, size: bodySize, x: margin, y, weight: 400 }); y += bodySize * 1.45;
    }
    if (cut) break;
    y += bodySize * 0.6;
  }
  lines.push({ text: 'a-to-mind.com', size: markSize, x: margin, y: foot, weight: 400, mark: true });
  return { margin, lines, cut };
}

// the card the person means: the open page, else the selected card on the stage, else the newest one
function openCard(api) {
  const page = document.querySelector('.vpage.on');
  const S = api.stage, id = S && S.selected && S.selected(), things = (S && S.things && S.things()) || {};
  const pick = id || Object.keys(things).pop();
  const el = page || (pick && (document.querySelector('.side-card[data-of="' + CSS.escape(pick) + '"]') || document.querySelector('.thing[data-id="' + CSS.escape(pick) + '"]')));
  if (!el) return null;
  const h = el.querySelector('h1, h2, h3'), all = (el.innerText || '').trim();
  const title = h ? h.innerText.trim() : all.split('\n')[0];
  const text = h ? all.replace(h.innerText, '').trim() : all.split('\n').slice(1).join('\n');
  return all ? { title: title.slice(0, 120), text: text.slice(0, 6000) } : null;
}

function draw(card, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#07070b'; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.7);
  glow.addColorStop(0, 'rgba(120,130,255,0.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const font = (size, weight) => `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  const measure = (t, size) => { g.font = font(size, 400); return g.measureText(t).width; };
  const L = layoutPoster(card, w, h, measure);
  for (const l of L.lines) { g.font = font(l.size, l.weight); g.fillStyle = l.mark ? 'rgba(255,255,255,0.45)' : '#f2f2f7'; g.fillText(l.text, l.x, l.y); }
  return c;
}

async function run(text, api) {
  const { showPage } = api;
  if (!posterOf(text)) return 'none';
  const card = openCard(api);
  if (!card) { showPage((p) => { p.innerHTML = '<h2>Make this a poster</h2><p>Open or summon a card first, then say <b>make this a poster</b>.</p>'; }); return 'poster'; }
  const el = showPage((p) => {
    p.innerHTML = '<h2>Make this a poster</h2><p class="poster-of"></p><img class="poster-preview" alt="The poster" style="max-width:100%;max-height:46vh;display:block;margin:8px auto;border-radius:6px">'
      + '<div class="poster-sizes"></div><p class="src">Ordering it printed is not connected yet: once a print-on-demand account is, "order this as a poster" will show its price and ask for a yes before anything is charged. Nothing is charged or sent today. The file is drawn in this browser; nothing is uploaded.</p>';
  });
  if (!el) return 'poster';
  el.querySelector('.poster-of').textContent = 'From the card: ' + card.title;
  el.querySelector('.poster-preview').src = draw(card, 600, 900).toDataURL('image/png');
  const box = el.querySelector('.poster-sizes');
  for (const s of POSTER_SIZES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'poster-size';
    b.textContent = `Download the ${s.name} print file (${s.px[0]}×${s.px[1]} px)`;
    b.addEventListener('click', () => draw(card, s.px[0], s.px[1]).toBlob((blob) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `void-poster-${s.w}x${s.h}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png'));
    box.appendChild(b);
  }
  return 'poster';
}

export default {
  name: 'poster',
  examples: ['make this a poster', 'print this card as a poster', 'turn this into a poster', 'make a poster of this card', 'poster of this'],
  nearMisses: ['what is a poster', 'poster sizes', 'share this card', 'how do I hang a poster', 'order this as a poster'],
  match(lower, text) { return posterOf(text); },
  run,
};
