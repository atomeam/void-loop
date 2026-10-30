// a 3D figure in a band at the top of a stage card (docs/miniatures.md, "Page cards"; owner, 2026-10-25: "should be a card for all too and 3d figure
// if possible"): the band is prepended to the card, the miniature mounts in it, and a device without WebGL drops the band and keeps the flat card.
// Returns the mount's promise (the live handle, or null when it did not mount). Used by the tool cards' skills (util, wheel, pwcheck, translate, recipe).
export function bandMini(api, el, kind, data, label, height) {
  if (!el || !api || !api.stage || !api.stage.miniature) return Promise.resolve(null);
  const band = document.createElement('div'); band.className = 'vmini';
  band.style.cssText = 'height:' + (height || (Math.min(innerWidth, innerHeight) < 560 ? 160 : 190)) + 'px;margin:0 0 6px';
  el.prepend(band);
  return api.stage.miniature(band, kind, data, { key: kind + ':' + Date.now().toString(36), label }).catch(() => { band.remove(); return null; });
}
