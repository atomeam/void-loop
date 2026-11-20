// One quiet offer per page slot (<div data-offer="slot">), from the revenue lane's live experiments (/offers/offers.json,
// tools/revenue-lane.mjs). A visitor keeps the same variant (a random number on this device only). The button goes through
// /api/buy, which counts the click and sends the buyer to the hosted checkout; a showing is counted once per visit.
// Who is not pitched: the owner, and a MultiVerse member (the plan this offer sells is the one they have). A UniVerse member or a stranger is
// pitched MultiVerse, the next plan up. When a signed-in member's plan cannot be read, no card is shown. Cards sit only on pages anyone can
// open (tools/revenue-lane.mjs retires a slot whose page is behind the UniVerse gate), so a gated page never carries one.
const kept = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
async function hasPlan() {
  if (kept('a2m.void.owner.v1')) return true;
  let me = null; try { me = JSON.parse(kept('a2m.void.me.v1') || 'null'); } catch (_) { me = null; }
  if (!(me && me.token)) return false;
  try {
    const r = await fetch('/api/members', { headers: { authorization: 'Bearer ' + me.token }, cache: 'no-store' });
    const j = r.ok ? await r.json() : null; // void-review: ok (res.ok is checked before res.json)
    return !j || (j.signedIn && j.tier === 'paid');
  } catch (_) { return true; }
}
const el = document.querySelector('[data-offer]');
if (el) (async () => {
  const slot = el.dataset.offer;
  if (await hasPlan()) return;
  const o = await fetch('/offers/offers.json', { cache: 'no-cache' }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }).catch(() => null); // void-review: ok (res.ok is checked before res.json)
  const s = o && o.slots && o.slots[slot];
  if (!s) return;
  let pick = null, src = '';
  const run = s.running;
  if (run && run.variants && run.variants.length) {
    let r = Number(localStorage.getItem('a2m.offer.r'));
    if (!(r >= 0 && r < 1)) { r = Math.random(); try { localStorage.setItem('a2m.offer.r', String(r)); } catch (_) {} }
    pick = run.variants[Math.floor(r * run.variants.length) % run.variants.length];
    src = slot + '.' + run.exp + '.' + pick.v;
  } else if (s.champion) { pick = s.champion; src = slot + '.keep.' + pick.v; }
  if (!pick) return;
  const q = 'id=' + encodeURIComponent(pick.product) + '&from=' + encodeURIComponent(src) + (pick.direct ? '&direct=1' : '');
  const box = document.createElement('aside');
  box.className = 'verse-offer';
  box.setAttribute('aria-label', 'support Verse');
  box.style.cssText = 'max-width:640px;margin:28px auto;padding:14px 18px;border:1px solid rgba(214,178,92,.45);border-radius:12px;background:rgba(214,178,92,.06);font:15px/1.5 system-ui,sans-serif;color:inherit;display:flex;gap:14px;align-items:center;flex-wrap:wrap';
  const p = document.createElement('p'); p.style.margin = '0'; p.style.flex = '1 1 260px'; p.textContent = pick.text;
  const a = document.createElement('a'); a.href = '/api/buy?' + q; a.target = '_blank'; a.rel = 'noopener'; a.textContent = pick.cta;
  a.style.cssText = 'padding:8px 14px;border-radius:8px;background:#d6b25c;color:#111;text-decoration:none;font-weight:600;white-space:nowrap';
  box.append(p, a); el.replaceChildren(box);
  const k = 'a2m.offer.seen.' + src;
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (_) {}
  fetch('/api/buy?seen=' + encodeURIComponent(src) + '&id=' + encodeURIComponent(pick.product), { method: 'POST', keepalive: true }).catch(() => {});
})();
