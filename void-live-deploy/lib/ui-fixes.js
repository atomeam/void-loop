/** UI fixes: sticky card share bar + digest show-me pill. Import injectUiFixes() from the page boot once. */
export const UI_FIX_CSS = `.vcard .vc-share{position:sticky!important;bottom:0!important;z-index:3!important;padding:10px 0 8px!important;margin-top:12px!important;border-top:1px solid rgba(255,255,255,.12)!important;background:linear-gradient(180deg,transparent,rgba(12,14,22,.96) 30%)!important;box-sizing:border-box!important}.vcard{scroll-padding-bottom:96px!important}.showcase-show-me,.away-see.showcase-show-me{display:inline-flex!important;align-items:center!important;padding:3px 12px!important;border-radius:999px!important;background:rgba(160,190,255,.14)!important;border:1px solid rgba(160,190,255,.32)!important;min-height:28px!important;font-weight:500!important;text-decoration:none!important}`;
export function injectUiFixes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('verse-ui-fixes')) return;
  const s = document.createElement('style');
  s.id = 'verse-ui-fixes';
  s.textContent = UI_FIX_CSS;
  document.head.appendChild(s);
}
