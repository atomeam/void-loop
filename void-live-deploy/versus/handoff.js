// Fills "Use this with" links from the value on this page, so the next tool opens on that result.
const read = (sel) => {
  const el = sel && document.querySelector(sel);
  if (!el) return '';
  return 'value' in el ? String(el.value || '') : String(el.textContent || '');
};
function paint() {
  const nav = document.querySelector('nav.with');
  if (!nav) return;
  for (const a of nav.querySelectorAll('a[data-base]')) {
    const v = (read(a.dataset.from) || a.dataset.fallback || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    const u = new URL(a.dataset.base, location.origin);
    if (v) u.searchParams.set(a.dataset.param || 'text', v);
    a.href = u.pathname + u.search;
  }
}
paint();
document.addEventListener('input', paint);
