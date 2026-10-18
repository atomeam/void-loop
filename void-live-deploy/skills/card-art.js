/**
 * card-art skill — offline collectible card generator for V01D.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "make a collectible card of a void moth", "foil card of the clock",
 * "full-art card of night", "print sheet of my cards".
 * Pure canvas in this browser: nothing uploaded, no external image API,
 * no WebGPU diffusion, no local inference server. Empty surface stays empty.
 */

const CARD_W = 750;
const CARD_H = 1050;

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_COLOR = {
  common: '#8a8a92',
  uncommon: '#3fbf6a',
  rare: '#5b8def',
  epic: '#b07ce8',
  legendary: '#e0a24a',
};

/** Parse the ask into { kind, subject?, variant?, rarity? } or null. */
export function cardOf(text) {
  const t = String(text || '').trim().toLowerCase()
    .replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

  if (/^(?:print|download)\s+(?:a\s+)?(?:sheet|page)\s+of\s+(?:my\s+)?cards$/.test(t)) {
    return { kind: 'sheet' };
  }

  let m = t.match(/^(?:(?:make|create|draw|generate|summon)\s+)?(?:an?\s+)?(?:collectible\s+)?(?:(foil|full-?art|normal)\s+)?card\s+(?:of|for|about)\s+(.+)$/);
  if (!m) m = t.match(/^(?:(foil|full-?art)\s+)?card\s+(?:of|for)\s+(.+)$/);
  if (!m) return null;

  const variant = (m[1] || 'normal').replace(/-/g, '');
  let subject = (m[2] || '').trim().slice(0, 80);
  if (!subject || /^(this|it|that|a card)$/.test(subject)) return null;

  let rarity = 'rare';
  const rar = subject.match(/\s+(common|uncommon|rare|epic|legendary)$/);
  if (rar) {
    rarity = rar[1];
    subject = subject.slice(0, rar.index).trim();
  }
  if (!subject) return null;

  return { kind: 'card', subject, variant, rarity };
}

function statsFor(subject) {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  const pick = (n) => 1 + ((h = (h * 1664525 + 1013904223) >>> 0) % n);
  return { power: pick(10), focus: pick(10), weird: pick(10), grace: pick(10) };
}

function loreFor(subject) {
  const bits = [
    'It appears only when asked.',
    'Born in the empty stage.',
    'Keeps its own silence.',
    'Drawn from the void itself.',
    'A single ask made it real.',
  ];
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h + subject.charCodeAt(i) * (i + 1)) % bits.length;
  return bits[h];
}

function titleCase(s) {
  return String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Draw one card onto a canvas. Procedural void art only — fully offline. */
export function drawCard({ subject, variant = 'normal', rarity = 'rare' }, w = CARD_W, h = CARD_H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return c;

  const title = titleCase(subject).slice(0, 28);
  const stats = statsFor(subject);
  const lore = loreFor(subject);
  const accent = RARITY_COLOR[rarity] || RARITY_COLOR.rare;
  const isFoil = variant === 'foil';
  const isFull = variant === 'fullart' || variant === 'fullart';

  g.fillStyle = '#07070b';
  g.fillRect(0, 0, w, h);

  const glow = g.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.7);
  glow.addColorStop(0, isFoil ? 'rgba(180,160,255,0.22)' : 'rgba(90,110,255,0.14)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  const m = Math.round(w * 0.045);
  g.strokeStyle = isFoil ? accent : 'rgba(255,255,255,0.18)';
  g.lineWidth = isFoil ? 6 : 3;
  g.strokeRect(m, m, w - 2 * m, h - 2 * m);

  const artTop = m + Math.round(h * 0.06);
  const artH = isFull ? h - 2 * m - Math.round(h * 0.22) : Math.round(h * 0.52);
  const artLeft = m + Math.round(w * 0.04);
  const artW = w - 2 * artLeft;

  g.save();
  g.beginPath();
  g.rect(artLeft, artTop, artW, artH);
  g.clip();
  g.fillStyle = '#0c0c14';
  g.fillRect(artLeft, artTop, artW, artH);

  g.strokeStyle = accent;
  g.globalAlpha = 0.35;
  g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const y = artTop + (artH * (i + 1)) / 8;
    g.beginPath();
    g.moveTo(artLeft, y);
    for (let x = 0; x <= artW; x += 8) {
      const wave = Math.sin((x + i * 40) * 0.02) * 12 + Math.sin((x + i * 17) * 0.05) * 6;
      g.lineTo(artLeft + x, y + wave);
    }
    g.stroke();
  }
  g.globalAlpha = 0.7;
  g.fillStyle = accent;
  g.beginPath();
  g.arc(artLeft + artW * 0.5, artTop + artH * 0.45, Math.min(artW, artH) * 0.08, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.restore();

  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 2;
  g.strokeRect(artLeft, artTop, artW, artH);

  const titleY = artTop + artH + Math.round(h * 0.055);
  g.fillStyle = '#f2f2f7';
  g.font = '600 ' + Math.round(w * 0.065) + 'px ui-sans-serif, system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText(title, artLeft, titleY);

  g.fillStyle = accent;
  g.font = '600 ' + Math.round(w * 0.028) + 'px ui-sans-serif, system-ui, sans-serif';
  g.fillText(rarity.toUpperCase(), artLeft, titleY + Math.round(h * 0.035));

  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = '400 ' + Math.round(w * 0.032) + 'px ui-sans-serif, system-ui, sans-serif';
  g.fillText(lore, artLeft, titleY + Math.round(h * 0.07));

  if (!isFull) {
    const pills = [
      ['PWR', stats.power],
      ['FOC', stats.focus],
      ['WRD', stats.weird],
      ['GRC', stats.grace],
    ];
    const pillW = Math.round(artW / pills.length) - 8;
    const pillY = h - m - Math.round(h * 0.09);
    pills.forEach((p, i) => {
      const x = artLeft + i * (pillW + 8);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x, pillY, pillW, Math.round(h * 0.055));
      g.fillStyle = accent;
      g.font = '600 ' + Math.round(w * 0.028) + 'px ui-sans-serif, system-ui, sans-serif';
      g.fillText(p[0], x + 8, pillY + Math.round(h * 0.022));
      g.fillStyle = '#f2f2f7';
      g.font = '600 ' + Math.round(w * 0.04) + 'px ui-sans-serif, system-ui, sans-serif';
      g.fillText(String(p[1]), x + 8, pillY + Math.round(h * 0.045));
    });
  }

  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.font = '400 ' + Math.round(w * 0.022) + 'px ui-sans-serif, system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText('V01D · a-to-mind.com', w - m, h - m + 2);

  if (isFoil) {
    const sheen = g.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(0.55, 'rgba(200,180,255,0.12)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);
  }

  return c;
}

function downloadCanvas(canvas, name) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

async function runCard(want, api) {
  const { showPage, esc } = api;
  const title = titleCase(want.subject);
  const el = showPage((p) => {
    p.innerHTML =
      '<h2>Collectible card</h2>' +
      '<p class="sub">' + esc(title) + ' · ' + esc(want.variant) + ' · ' + esc(want.rarity) + '</p>' +
      '<img class="card-preview" alt="The card" style="max-width:100%;max-height:55vh;display:block;margin:10px auto;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.5)">' +
      '<div class="card-actions" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"></div>' +
      '<div class="src">Drawn offline in this browser · nothing uploaded · V01D collectible set</div>';
  });
  if (!el) return 'card-art';

  const canvas = drawCard(want);
  const img = el.querySelector('.card-preview');
  if (img) img.src = canvas.toDataURL('image/png');

  const box = el.querySelector('.card-actions');
  if (box) {
    const addBtn = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'g-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      box.appendChild(b);
    };
    const slug = want.subject.replace(/\s+/g, '-').slice(0, 32);
    addBtn('Download PNG', () => downloadCanvas(canvas, 'v01d-card-' + slug + '.png'));
    addBtn('Foil version', () => {
      const foil = drawCard({ ...want, variant: 'foil' });
      if (img) img.src = foil.toDataURL('image/png');
      downloadCanvas(foil, 'v01d-card-foil-' + slug + '.png');
    });
    addBtn('Full-art version', () => {
      const full = drawCard({ ...want, variant: 'fullart' });
      if (img) img.src = full.toDataURL('image/png');
    });
  }
  return 'card-art';
}

async function runSheet(api) {
  const { showPage } = api;
  const samples = ['void moth', 'night clock', 'living line', 'silent mote', 'deep foil', 'aurora edge', 'stage spark', 'quiet ring', 'first ask'];
  const sheetW = CARD_W * 3 + 40;
  const sheetH = CARD_H * 3 + 40;
  const sheet = document.createElement('canvas');
  sheet.width = sheetW;
  sheet.height = sheetH;
  const g = sheet.getContext('2d');
  g.fillStyle = '#111018';
  g.fillRect(0, 0, sheetW, sheetH);

  samples.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const card = drawCard({
      subject: s,
      variant: i % 3 === 0 ? 'foil' : 'normal',
      rarity: RARITIES[i % RARITIES.length],
    });
    g.drawImage(card, 10 + col * (CARD_W + 10), 10 + row * (CARD_H + 10));
  });

  showPage((p) => {
    p.innerHTML =
      '<h2>Card print sheet</h2>' +
      '<p class="sub">3×3 sample sheet · download and print</p>' +
      '<img alt="Print sheet" style="max-width:100%;display:block;margin:10px auto;border-radius:6px">' +
      '<div class="src">Each cell is a full collectible card · offline</div>';
    const img = p.querySelector('img');
    if (img) img.src = sheet.toDataURL('image/png');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-btn';
    b.textContent = 'Download sheet PNG';
    b.addEventListener('click', () => downloadCanvas(sheet, 'v01d-card-sheet.png'));
    p.appendChild(b);
  });
  return 'card-art';
}

async function run(text, api) {
  const want = cardOf(text);
  if (!want) return 'none';
  if (want.kind === 'sheet') return runSheet(api);
  return runCard(want, api);
}

export default {
  name: 'card-art',
  examples: [
    'make a collectible card of a void moth',
    'foil card of the night clock',
    'full-art card of living line',
    'card of silent mote legendary',
    'print sheet of my cards',
  ],
  nearMisses: [
    'what is a collectible card',
    'card game rules',
    'credit card',
    'make a poster',
    'draw a circle',
  ],
  match(lower, text) {
    return !!cardOf(text || lower);
  },
  run,
  suite() {
    const a = cardOf('make a collectible card of a void moth');
    const b = cardOf('foil card of the clock');
    const c = cardOf('print sheet of my cards');
    const d = cardOf('hello world');
    return {
      ok:
        !!a && a.subject === 'a void moth' && a.variant === 'normal' &&
        !!b && b.variant === 'foil' && b.subject === 'the clock' &&
        !!c && c.kind === 'sheet' &&
        d === null,
    };
  },
};
