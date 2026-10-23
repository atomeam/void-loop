// A page that never scrolls inside itself (owner: the book repaginates instead of scrolling; 2026-10-22: pages "scroll inside itself on phones").
// fitPages(el, main) watches the page: when it holds more than its box, the blocks (main's children, the children of any [data-fit-list] inside it,
// then whatever the page adds after main, such as the card bar) are dealt onto pages that fit, with a pager. Returns { want(selector) } to turn
// to the page holding an element. Used by the Game Box (skills/gamebox.js); Verse Rally (skills/rally.js) has the same paging built in.
export function fitPages(el, main) {
  let pg = 0, fitting = false, raf = 0, wanted = '';
  const pager = document.createElement('div'); pager.className = 'fit-pager'; pager.style.cssText = 'display:flex;gap:8px;justify-content:center;align-items:center;margin-top:8px';
  // a block is a list of elements dealt together: one per child, but a [data-fit-list] grid is dealt a row at a time (items sharing a top edge)
  const blocks = () => { const out = []; for (const c of main.children) { if (c === pager) continue;
      if (c.hasAttribute('data-fit-list')) { let row = null, top = null; for (const k of c.children) { const t = Math.round(k.getBoundingClientRect().top); if (row && t === top) row.push(k); else { row = [k]; top = t; out.push(row); } } }
      else out.push([c]); }
    let n = main.nextElementSibling; while (n) { out.push([n]); n = n.nextElementSibling; } return out; };
  const hide = (b, on) => { for (const x of b) x.hidden = on; };
  const height = (b) => Math.max(...b.map((x) => x.getBoundingClientRect().height)) + 8;
  function fit() {
    fitting = true; pager.remove(); for (const x of main.querySelectorAll('[hidden]')) x.hidden = false; let n0 = main.nextElementSibling; while (n0) { n0.hidden = false; n0 = n0.nextElementSibling; } const bs = blocks();
    if (el.scrollHeight <= el.clientHeight + 1) { fitting = false; obs.takeRecords(); return; }
    const top = main.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop, hs = bs.map(height);
    let pages, slack = 56;
    for (let tries = 0; tries < 4; tries++) {
      const avail = el.clientHeight - top - slack; pages = [[]]; let h = 0;
      bs.forEach((b, i) => { if (pages[pages.length - 1].length && h + hs[i] > avail) { pages.push([]); h = 0; } pages[pages.length - 1].push(b); h += hs[i]; });
      pages.forEach((p, i) => { for (const b of p) hide(b, i !== Math.min(pg, pages.length - 1)); }); main.appendChild(pager); pager.textContent = '‹';
      const over = el.scrollHeight - el.clientHeight; pager.remove(); if (over <= 1) break; slack += over + 4;
    }
    if (wanted) { const i = pages.findIndex((p) => p.some((b) => b.some((x) => x.matches(wanted) || x.querySelector(wanted)))); if (i >= 0) pg = i; wanted = ''; }
    pg = Math.max(0, Math.min(pg, pages.length - 1)); pages.forEach((p, i) => { for (const b of p) hide(b, i !== pg); });
    pager.textContent = '';
    const btn = (label, d, on) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = !on; b.addEventListener('click', () => { pg += d; fit(); }); return b; };
    const note = document.createElement('span'); note.textContent = 'page ' + (pg + 1) + ' of ' + pages.length; note.style.cssText = 'font-size:13px;color:#b9b4a6';
    pager.append(btn('‹ back', -1, pg > 0), note, btn('next ›', 1, pg < pages.length - 1)); main.appendChild(pager); el.scrollTop = 0;
    fitting = false; obs.takeRecords();
  }
  const later = () => { if (fitting) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  const obs = new MutationObserver(later); obs.observe(el, { childList: true, subtree: true });
  el.addEventListener('toggle', later, true); addEventListener('resize', later);
  later();
  return { want(sel) { wanted = sel; later(); }, reset() { pg = 0; later(); } };
}
