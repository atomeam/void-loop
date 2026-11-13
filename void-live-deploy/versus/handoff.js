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
    const el = a.dataset.from && document.querySelector(a.dataset.from);
    const raw = el ? ('value' in el ? el.value : el.textContent) : (a.dataset.fallback || '');
    const v = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!v) return;
    const u = new URL(a.dataset.base, location.origin);
    u.searchParams.set(a.dataset.param || 'text', v);
    a.href = u.pathname + u.search;
  }
}
paint();
document.addEventListener('input', paint);
document.addEventListener('handoff', paint);
