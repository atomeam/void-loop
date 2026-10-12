/**
 * kept skill — an answer you kept on the stage: "keep this" puts the open answer up as a card, "call this my tip" names it,
 * "refresh this" asks it again. The asks stay in the page (they work on whatever answer is open, and public /@name pages
 * show their cards the same way); this draws the card: pinned up with a red pushpin at a slight tilt of its own, the title
 * in the felt-tip hand, the answer scrolling under the pin. Moved out of void.html in cleanup step 6.
 */

/** a kept card's own slight tilt, -2 to 2 degrees, the same every time for the same card (as skills/image.js). Pure. */
export function tiltOf(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.round(((Math.abs(h) % 41) - 20) / 10 * 10) / 10 || 0.8; // never square
}

/** "as of 4:05 PM" (and the day when it is not today), on the dated answers the page keeps */
function asOf(t, now = new Date()) {
  return ' · as of ' + t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    + (t.toDateString() === now.toDateString() ? '' : ', ' + t.toLocaleDateString([], { month: 'short', day: 'numeric' })) + ' · say “refresh this”';
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card pinned';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  el.style.width = (th.w || 320) + 'px';
  el.style.rotate = tiltOf(th.id) + 'deg';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const head = document.createElement('div');
  head.className = 'kept-head';
  head.textContent = th.name || th.ask || 'kept';
  const body = document.createElement('div');
  body.className = 'kept-body';
  // void-review: ok: the html is the page's own: "keep this" copies the answer it already drew, a synced stage passes the page's
  // cleanHTML on the way in, and a public /@name page's cards are escaped text (as when this lived in void.html)
  body.innerHTML = th.html || ''; // void-review: ok
  body.querySelectorAll('.asof[data-t]').forEach((a) => { a.textContent = asOf(new Date(a.dataset.t)); });
  body.querySelectorAll('h2').forEach((h) => { h.style.cssText = 'font-size:16px;margin:0 0 2px;font-weight:500'; });
  body.querySelectorAll('iframe').forEach((f) => { f.style.height = '220px'; });
  body.querySelectorAll('a[data-alt], a[data-ask]').forEach((a) => a.removeAttribute('href'));
  el.appendChild(head); el.appendChild(body);
  stageApi.bindDrag(el, th);
  body.addEventListener('pointerdown', (e) => { if (e.target.closest('a, iframe')) e.stopPropagation(); });
  stageApi.stage.appendChild(el);
}

export default {
  name: 'kept',
  examples: [],
  nearMisses: [],
  match() { return false; }, // "keep this" and "call this" stay in the page: they work on the answer that is open
  async run() { return 'none'; },
  stageKinds: { kept: { mount } },
};
