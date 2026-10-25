// The card a "chat fills a page" skill shows (owner, 2026-10-25: "make sure Verse knows how to fill out its own relevant pages for you just by
// chatting with it"): what a plan() did (or would do) to a page's own store, in words, with Undo, a link to the page, a Confirm for a weak match and
// the choices when two things fit. One drawing for the calendar, recipes and generators skills (notes-fill has its own, older copy).
// plan(store, intent, now) -> { kind: 'write'|'confirm'|'ask'|'show'|'none', said, title, store, changes, openId, preview, question, options, hits, lines, intent }
// undo(store, changes, now) -> the store as it was. Nothing is written unseen: a write happens only in a 'write' result.
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (label, fn) => { const b = mk('button', 'nf-btn', label); b.type = 'button'; b.style.cssText = 'font:inherit;font-size:13px;margin:4px 6px 0 0;padding:4px 12px;min-height:36px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
const linkEl = (href, label) => { const a = mk('a', 'vc-page', label); a.href = href; a.style.cssText = 'display:inline-block;margin:6px 0 2px;font-size:13px;font-weight:600'; return a; };
const logOf = (key) => { try { const l = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } };
const saveLog = (key, l) => { try { localStorage.setItem(key, JSON.stringify(l.slice(-20))); } catch (_) {} };

/** draws the plan's outcome into el, running a write at once and wiring Undo, Confirm and the choices. */
export function drawFill(el, { intent, plan, undo, read, write, logKey, openHref, openLabel, hint, heading }) {
  const r = plan(read(), intent, Date.now()); el.replaceChildren();
  const h = mk('h2', '', r.kind === 'write' ? r.title || heading : r.kind === 'confirm' ? 'Write this?' : r.kind === 'ask' ? 'Which one?' : r.title || heading); el.append(h);
  const again = (next) => drawFill(el, { intent: next, plan, undo, read, write, logKey, openHref, openLabel, hint, heading });
  if (r.kind === 'write') {
    if (!write(r.store)) { el.append(mk('p', '', 'This browser would not let me save (private window?). Nothing was written.')); return r; }
    const entry = { id: Math.random().toString(36).slice(2, 9), said: r.said, at: Date.now(), changes: r.changes }; saveLog(logKey, [...logOf(logKey), entry]);
    el.append(mk('p', '', r.said + '.')); if (r.detail) el.append(mk('p', 'src', r.detail));
    const row = mk('div', ''); el.append(row);
    row.append(btn('Undo', () => { write(undo(read(), r.changes, Date.now())); saveLog(logKey, logOf(logKey).filter((x) => x.id !== entry.id)); el.replaceChildren(mk('h2', '', 'Undone'), mk('p', '', r.said + ': put back as it was.')); }));
    if (openHref) row.append(linkEl(openHref(r.openId), openLabel));
    for (const o of r.offers || []) row.append(btn(o.label, () => again(o.intent)));
  } else if (r.kind === 'confirm') {
    el.append(mk('p', '', r.preview + '?')); if (r.detail) el.append(mk('p', 'src', r.detail));
    el.append(btn('Confirm', () => again(r.intent)), btn('Cancel', () => el.replaceChildren(mk('h2', '', 'Cancelled'), mk('p', '', 'Nothing was written.'))));
  } else if (r.kind === 'ask') {
    el.append(mk('p', '', r.question)); for (const o of r.options) el.append(btn(o.label, () => again(o.intent)));
  } else if (r.kind === 'show') {
    for (const l of r.lines || []) el.append(mk('p', '', l));
    for (const x of r.hits || []) { const p = mk('p', ''); const a = mk('a', '', x.title); a.href = openHref(x.id); a.style.fontWeight = '700'; p.append(a, document.createTextNode(x.snippet ? ': ' + x.snippet : '')); el.append(p); }
    for (const o of [...(r.offers || []), ...(r.offer ? [r.offer] : [])]) el.append(btn(o.label, () => again(o.intent)));
    if (openHref) el.append(linkEl(openHref(r.openId), openLabel));
  } else el.append(mk('p', '', hint));
  return r;
}
