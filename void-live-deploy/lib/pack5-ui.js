// Tools pack 5: the one list card the search, pile, bookmark, export and copy-stack asks draw (browser only). Every dynamic part is escaped.
const BTN = 'font:inherit;cursor:pointer;margin-right:.55em;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:1px 9px';

/** an answer card of rows, each with a button; onPick(row, button) runs on a tap. rows: [{ text, sub }]. Returns the card element. */
export function listPage(api, title, rows, o = {}) {
  const { esc } = api;
  const el = api.showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2>'; });
  const body = rows.length
    ? '<ol class="p5-rows" style="padding-left:1.4em;margin:.4em 0">' + rows.map((r, i) => '<li style="margin:.3em 0"><button type="button" class="p5-go" data-i="' + i + '" style="' + BTN + '">' + esc(r.action || o.action || 'go') + '</button><span class="p5-text">' + esc(r.text) + '</span>' + (r.sub ? ' <span class="p5-sub" style="opacity:.6;font-size:.85em">' + esc(r.sub) + '</span>' : '') + '</li>').join('') + '</ol>'
    : '<p>' + esc(o.empty || 'Nothing yet.') + '</p>';
  el.innerHTML = '<h2>' + esc(title) + '</h2>' + body + (o.foot ? '<div class="src">' + esc(o.foot) + '</div>' : ''); // void-review: ok: every dynamic part above goes through esc
  el.querySelectorAll('button.p5-go').forEach((b) => b.addEventListener('click', () => { if (o.onPick) o.onPick(rows[+b.dataset.i], b); }));
  return el;
}

/** scroll to a thing, pick it and outline it for a moment. */
export function goTo(stageApi, id) {
  try { stageApi.closePage && stageApi.closePage(); } catch (_) { /* no page open */ }
  stageApi.center ? stageApi.center(id) : stageApi.select(id);
  const el = stageApi.stage.querySelector('[data-id="' + CSS.escape(id) + '"]');
  if (el) {
    try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (_) { /* old browser */ }
    el.style.outline = '2px solid #ffd166'; setTimeout(() => { try { el.style.outline = ''; } catch (_) { /* gone */ } }, 1400);
  }
  return !!el;
}
