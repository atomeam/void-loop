const $ = id => document.getElementById(id);
const preview = $('preview');
const ctx = preview.getContext('2d');
const full = document.createElement('canvas');
full.width = 1050;
full.height = 600;
const fctx = full.getContext('2d');

const themes = {
  slate: { bg: '#1e2937', fg: '#f8fafc', accent: '#94a3b8' },
  blue: { bg: '#1e3a8a', fg: '#eff6ff', accent: '#60a5fa' },
  emerald: { bg: '#064e3b', fg: '#ecfdf5', accent: '#34d399' },
  amber: { bg: '#78350f', fg: '#fffbeb', accent: '#fbbf24' },
  rose: { bg: '#881337', fg: '#fff1f2', accent: '#fb7185' },
  dark: { bg: '#0f172a', fg: '#e2e8f0', accent: '#38bdf8' }
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem('verse-card') || '{}');
    ['name','title','phone','email','web'].forEach(k => { if (s[k]) $(k).value = s[k]; });
    if (s.theme) $('theme').value = s.theme;
  } catch (e) { console.debug("lab f753-local-business-card-maker:", e); }
  draw();
}
function save() {
  const data = {
    name: $('name').value, title: $('title').value, phone: $('phone').value,
    email: $('email').value, web: $('web').value, theme: $('theme').value
  };
  localStorage.setItem('verse-card', JSON.stringify(data));
}
function draw() {
  const t = themes[$('theme').value] || themes.slate;
  const name = $('name').value || 'Your Name';
  const title = $('title').value || 'Title';
  const phone = $('phone').value;
  const email = $('email').value;
  const web = $('web').value;

  // Full resolution
  fctx.fillStyle = t.bg;
  fctx.fillRect(0, 0, 1050, 600);
  fctx.fillStyle = t.accent;
  fctx.fillRect(0, 0, 12, 600);
  fctx.fillStyle = t.fg;
  fctx.font = 'bold 72px system-ui, sans-serif';
  fctx.fillText(name, 60, 180);
  fctx.font = '36px system-ui, sans-serif';
  fctx.fillStyle = t.accent;
  fctx.fillText(title, 60, 240);
  fctx.fillStyle = t.fg;
  fctx.font = '28px system-ui, sans-serif';
  let y = 340;
  if (phone) { fctx.fillText(phone, 60, y); y += 48; }
  if (email) { fctx.fillText(email, 60, y); y += 48; }
  if (web) { fctx.fillText(web.replace(/^https?:\/\//, ''), 60, y); }

  // Preview (half scale)
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, 525, 300);
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, 6, 300);
  ctx.fillStyle = t.fg;
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText(name, 30, 90);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = t.accent;
  ctx.fillText(title, 30, 120);
  ctx.fillStyle = t.fg;
  ctx.font = '14px system-ui, sans-serif';
  y = 170;
  if (phone) { ctx.fillText(phone, 30, y); y += 24; }
  if (email) { ctx.fillText(email, 30, y); y += 24; }
  if (web) { ctx.fillText(web.replace(/^https?:\/\//, ''), 30, y); }
  save();
}

['name','title','phone','email','web','theme'].forEach(id => {
  $(id).addEventListener('input', draw);
});

$('download').onclick = () => {
  draw();
  const a = document.createElement('a');
  a.href = full.toDataURL('image/png');
  a.download = 'business-card.png';
  a.click();
};
$('copy').onclick = () => {
  const lines = [
    $('name').value, $('title').value, $('phone').value, $('email').value, $('web').value
  ].filter(Boolean).join('\n');
  navigator.clipboard.writeText(lines).then(() => {
    const b = $('copy');
    const old = b.textContent;
    b.textContent = 'Copied';
    setTimeout(() => b.textContent = old, 1200);
  });
};

// Optional spatial tilt
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta == null) return;
    const x = Math.max(-15, Math.min(15, (e.gamma || 0) * 0.3));
    const y = Math.max(-15, Math.min(15, (e.beta - 30) * 0.15));
    preview.style.transform = `rotateX(${ -y }deg) rotateY(${ x }deg)`;
  });
}

load();
