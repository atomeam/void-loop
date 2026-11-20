// The taped Out of Order sign every visitor sees in place of Versus. Its own small file, so a visitor is never sent lib/versus-floor.js, which names
// the sites Versus is measured against (owner only: lib/owner-gate.js).
export const SIGN_CSS = '<style>.elv{position:relative;max-width:100%}.elv-doors{display:grid;grid-template-columns:1fr 2px 1fr;height:14rem;border-radius:14px;overflow:hidden;background:#10141c;border:1px solid #2a2a2a}.elv-door{background:linear-gradient(180deg,#242a38,#12151c 55%,#1a1e28)}.elv-seam{background:rgb(var(--d-key) / .4)}.elv-sign{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-3deg);margin:0;padding:1.15rem 1.3rem .9rem;width:min(14rem,78%);text-align:center;background:#f3efe6;color:#161616;font-family:ui-serif,Georgia,serif;font-size:clamp(1.5rem,6vw,1.85rem);font-weight:700;line-height:1.15;box-shadow:0 12px 28px rgba(0,0,0,.38)}.elv-tape{position:absolute;left:50%;top:-11px;width:4.4rem;height:.95rem;transform:translateX(-50%) rotate(4deg);background:rgb(var(--d-key) / .42)}</style>';
/** the taped sign. Nothing else. Pure. */
export function visitorHtml() {
  return SIGN_CSS + '<div class="elv" data-owner="0"><div class="elv-doors" aria-hidden="true"><span class="elv-door"></span><span class="elv-seam"></span><span class="elv-door"></span></div>'
    + '<h1 class="elv-sign"><span class="elv-tape" aria-hidden="true"></span>Out of Order</h1></div>';
}

