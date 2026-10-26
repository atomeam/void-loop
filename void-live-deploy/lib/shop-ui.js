/**
 * shop-ui: the screen of the shopping pages (/shop/ and one page per site of the shopping lane, lib/shop-sites.js). One module; each page asks for the panels it needs:
 * mountShop(root, { panels: ['lookup', 'stores', 'cart', 'track', 'prices', 'unit', 'wish', 'returns'] }). Kept on the device: the list, the parcels, the prices, the wish
 * lists and the return windows live in this browser (a2m.void.shop.v1). What leaves: a barcode or a name looked up goes to the open product databases (said beside the
 * box), and the links the visitor opens (stores and carriers, from closed lists). Verse sells nothing here and reads no carrier's status. English and German.
 * Pure logic: lib/shop-core.js. Tests: tools/shop.test.mjs, tools/shop-page.mjs.
 */
import * as C from '/lib/shop-core.js';
import { DE } from '/lib/shop-de.js';
import { icsOf } from '/lib/ics.js';

const KEY = 'a2m.void.shop.v1', SW_CACHE = 'void-shell-v2';
const isDe = () => /^de\b/i.test(navigator.language || '') || new URLSearchParams(location.search).get('lang') === 'de';
export const t = (s) => (isDe() && DE[s]) || s;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (root, sel) => root.querySelector(sel);
const lang = () => (isDe() ? 'de-DE' : 'en-US');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeUrl = (u) => (/^https?:\/\/[^\s<>"']+$/i.test(String(u || '').trim()) ? String(u).trim().slice(0, 500) : '');
function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked: the page still works */ } return m; }
const M = () => mem();
const cur = () => (/^[A-Z]{3}$/.test(M().cur || '') ? M().cur : isDe() ? 'EUR' : 'USD');
const fm = (c) => (c == null ? '–' : C.money(c, cur(), lang()));
const say = (el, s) => { if (el) el.textContent = s; };
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
async function shareOrCopy(url, title, msg) { try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(url); say(msg, t('Copied the link.')); } catch (_) { say(msg, url); } }
const panel = (id, title, help) => { const s = document.createElement('section'); s.className = 'panel'; s.id = id; s.innerHTML = '<h2>' + esc(t(title)) + '</h2>' + (help ? '<p class="soft">' + esc(t(help)) + '</p>' : ''); return s; };
const checkLabel = (c) => '<span class="tag tag-' + c + '">' + esc(t(c === 'partly' ? 'address partly confirmed' : c === 'confirmed' ? 'address confirmed' : 'address unconfirmed')) + '</span>';
const bus = new Map(); const on = (k, f) => { if (!bus.has(k)) bus.set(k, []); bus.get(k).push(f); }; const fire = (k, v) => (bus.get(k) || []).forEach((f) => f(v));

// ---------- product lookup by name or barcode, with the camera ----------
const PCACHE = 'a2m.void.shop.products.v1';
function cacheGet(k) { try { return (JSON.parse(localStorage.getItem(PCACHE) || '{}') || {})[k] || null; } catch (_) { return null; } }
function cachePut(k, v) { try { const m = JSON.parse(localStorage.getItem(PCACHE) || '{}') || {}; m[k] = v; const ks = Object.keys(m); if (ks.length > 150) delete m[ks[0]]; localStorage.setItem(PCACHE, JSON.stringify(m)); } catch (_) { /* full */ } }
async function getJson(url) { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000); try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(tm); } }
/** a barcode in the open databases, the first that knows it: [product] or [] */
async function byCode(b) {
  const k = 'c:' + b.code, hit = cacheGet(k); if (hit) return { rows: hit, cached: true };
  for (const db of C.PRODUCT_DBS) for (const code of C.lookupCodes(b)) {
    const j = await getJson(C.productUrl(db, code)).catch(() => null); if (j && j.status === 1 && j.product) { const p = C.productOf({ code, ...j.product }, db); if (p) { cachePut(k, [p]); return { rows: [p] }; } }
  }
  cachePut(k, []); return { rows: [] };
}
async function byName(q) {
  const k = 'n:' + q.toLowerCase(), hit = cacheGet(k); if (hit) return { rows: hit, cached: true };
  const out = []; for (const db of C.PRODUCT_DBS.slice(0, 2)) { const j = await getJson(C.searchUrl(db, q)).catch(() => null); for (const r of (j && j.products) || []) { const p = C.productOf(r, db); if (p) out.push(p); } if (out.length >= 6) break; }
  cachePut(k, out.slice(0, 12)); return { rows: out.slice(0, 12) };
}
function lookupPanel() {
  const s = panel('lookup', 'Find a product', 'By name, brand or barcode, from the open product databases. The barcode or the words you look up are sent to them (Open Food Facts and its sister projects); nothing else is.');
  s.insertAdjacentHTML('beforeend', '<div class="row"><div class="field grow"><label for="l-q">' + esc(t('Barcode or product name')) + '</label><input type="search" id="l-q" autocomplete="off" inputmode="search" placeholder="3017624010701 · oat milk"></div></div>'
    + '<div class="row"><button type="button" class="go" id="l-go">' + esc(t('Look up')) + '</button><button type="button" id="l-scan">' + esc(t('Scan with the camera')) + '</button><span class="soft" id="l-noscan" hidden>' + esc(t('This browser has no barcode reader: type the number under the bars.')) + '</span></div>'
    + '<div id="l-cam" class="cam" hidden><video id="l-video" playsinline muted></video><button type="button" id="l-stop">' + esc(t('Stop the camera')) + '</button></div>'
    + '<p class="live" id="l-msg" role="status"></p><div id="l-code"></div><ul class="prods" id="l-out"></ul>'
    + '<p class="note">' + esc(t('Product data: Open Food Facts, Open Products Facts and Open Beauty Facts, under the Open Database License (ODbL); each product under the Database Contents License; pictures under CC BY-SA. Anyone can add or fix a product on their sites.')) + '</p>');
  const q = $(s, '#l-q'), msg = $(s, '#l-msg'), out = $(s, '#l-out'), codeEl = $(s, '#l-code');
  async function go(text) {
    const v = String(text == null ? q.value : text).trim(); if (!v) { say(msg, t('Type a barcode or a name.')); return; } q.value = v; out.textContent = ''; codeEl.textContent = '';
    const b = C.readBarcode(v); fire('query', b ? b.code : v);
    if (b) codeEl.innerHTML = '<p class="' + (b.valid ? 'ok' : 'bad') + '"><b>' + esc(b.kind) + ' ' + esc(b.isbn10 || b.code) + '</b>: ' + esc(b.valid ? t('the check digit is right') : t('the check digit is wrong') + (b.want != null ? ' (' + t('it should be') + ' ' + b.want + ')' : '')) + (b.isbn10 ? ' · ISBN-13 ' + esc(b.code) : '') + (b.kind === 'UPC-A' ? ' · EAN-13 0' + esc(b.code) : '') + '</p>';
    if (b && !b.valid) { say(msg, t('A wrong check digit usually means a typo: check the number.')); return; }
    say(msg, t('Looking it up…')); s.setAttribute('aria-busy', 'true');
    let res; try { res = b ? await byCode(b) : await byName(v); } catch (_) { res = { rows: [], failed: true }; }
    s.removeAttribute('aria-busy');
    if (!res.rows.length) { say(msg, navigator.onLine === false ? t('Offline: only products you looked up before are kept on this device.') : b ? t('Not in the open databases yet. You can add it on Open Food Facts, or search the stores below.') : t('Nothing found by that name. Try fewer words, or search the stores below.')); return; }
    say(msg, res.rows.length + ' ' + t(res.rows.length === 1 ? 'product found' : 'products found') + (res.cached ? ' · ' + t('kept on this device') : ''));
    for (const p of res.rows) {
      const db = C.PRODUCT_DBS.find((d) => d.id === p.db) || C.PRODUCT_DBS[0], li = document.createElement('li'); li.className = 'prod';
      li.innerHTML = (p.image ? '<img src="' + esc(p.image) + '" alt="" width="64" height="64" loading="lazy" referrerpolicy="no-referrer">' : '<span class="noimg" aria-hidden="true">▢</span>')
        + '<div><b>' + esc(p.name) + '</b>' + (p.brand ? ' · ' + esc(p.brand) : '') + (p.qty ? ' · ' + esc(p.qty) : '') + '<br><span class="soft">' + (p.code ? esc(t('Barcode')) + ' ' + esc(p.code) : '') + (p.category ? ' · ' + esc(p.category) : '') + (p.grade ? ' · Nutri-Score ' + esc(p.grade.toUpperCase()) : '') + '</span>'
        + '<div class="row"><button type="button" class="add">' + esc(t('Add to my list')) + '</button><button type="button" class="srch">' + esc(t('Search the stores')) + '</button><a class="btn" rel="noopener noreferrer" target="_blank" href="' + esc(C.productPage(db, p.code)) + '">' + esc(t('On')) + ' ' + esc(db.name) + '</a></div></div>';
      $(li, '.add').addEventListener('click', () => { fire('add', { name: [p.brand, p.name].filter(Boolean).join(' '), unit: p.qty, code: p.code }); say(msg, t('Added to your list.')); });
      $(li, '.srch').addEventListener('click', () => fire('query', [p.brand, p.name].filter(Boolean).join(' ')));
      out.append(li);
    }
  }
  $(s, '#l-go').addEventListener('click', () => { out.style.minHeight = ''; go(); }); q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); out.style.minHeight = ''; go(); } });
  // the camera: BarcodeDetector where the browser has one (Chrome on Android and desktop, Edge, Opera); otherwise the typed box
  let stream = null, timer = 0; const cam = $(s, '#l-cam'), video = $(s, '#l-video');
  const stop = () => { clearInterval(timer); if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; cam.hidden = true; };
  const can = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!can) { $(s, '#l-scan').hidden = true; $(s, '#l-noscan').hidden = false; }
  $(s, '#l-scan').addEventListener('click', async () => {
    try { const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'] }); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.srcObject = stream; cam.hidden = false; await video.play(); say(msg, t('Point the camera at the bars.'));
      timer = setInterval(async () => { try { const r = await det.detect(video); if (r && r[0] && r[0].rawValue) { const v = r[0].rawValue; stop(); go(v); } } catch (_) { /* a frame not ready */ } }, 250);
    } catch (_) { stop(); say(msg, t('The camera could not be opened: type the number instead.')); }
  });
  $(s, '#l-stop').addEventListener('click', stop);
  const p0 = new URLSearchParams(location.search); const start = p0.get('code') || (p0.get('q') && !p0.get('track') ? p0.get('q') : '');
  // a lookup asked in the link starts with the screen and keeps room for its answer while it is fetched, so what is below does not jump when it lands
  if (start) { out.style.minHeight = C.readBarcode(start) ? '96px' : '360px'; go(start.slice(0, 80)); }
  return s;
}

// ---------- the same search on the stores ----------
function storesPanel() {
  const s = panel('stores', 'Search the stores', 'One search opened on each store from a fixed list of addresses, carrying nothing but your words: no tracking, no affiliate code.');
  s.insertAdjacentHTML('beforeend', '<div class="grid2"><div class="field"><label for="s-q">' + esc(t('Product or barcode')) + '</label><input type="search" id="s-q" autocomplete="off"></div><div class="field"><label for="s-reg">' + esc(t('Stores in')) + '</label><select id="s-reg"><option value="all">' + esc(t('Everywhere')) + '</option><option value="us">' + esc(t('United States')) + '</option><option value="uk">' + esc(t('United Kingdom')) + '</option><option value="de">' + esc(t('Germany')) + '</option></select></div></div>'
    + '<ul class="plist" id="s-list"></ul><p class="note">' + esc(t('Verse sells only its own things, at')) + ' <a href="/store/">/store/</a>. ' + esc(t('Prices, stock and delivery are on the stores.')) + '</p>');
  const q = $(s, '#s-q'), reg = $(s, '#s-reg'), list = $(s, '#s-list');
  reg.value = isDe() ? 'de' : M().region || 'all';
  const draw = () => { const links = C.storeLinks(q.value, reg.value); list.innerHTML = links.length ? links.map((l) => '<li><a class="btn" rel="noopener noreferrer" target="_blank" href="' + esc(l.url) + '">' + esc(t('Search on')) + ' ' + esc(l.name) + '</a> ' + checkLabel(l.check) + '</li>').join('') : '<li class="soft">' + esc(t('Type a product to see the links.')) + '</li>'; };
  q.addEventListener('input', draw); reg.addEventListener('change', () => { keep({ region: reg.value }); draw(); });
  on('query', (v) => { q.value = v; draw(); });
  const p0 = new URLSearchParams(location.search); if (p0.get('q') || p0.get('code')) q.value = (p0.get('q') || p0.get('code')).slice(0, 80);
  draw(); return s;
}

// ---------- the list and cart ----------
function cartPanel() {
  const s = panel('cart', 'List and cart', 'What you mean to buy, with quantities, prices and stores: totals with tax and shipping for each store. Verse takes no payment; you check out at each store.');
  s.insertAdjacentHTML('beforeend', '<p class="soft" id="c-from" hidden></p><div class="grid4"><div class="field"><label for="c-name">' + esc(t('Item')) + '</label><input type="text" id="c-name" autocomplete="off" placeholder="' + esc(t('Milk')) + '"></div>'
    + '<div class="field"><label for="c-qty">' + esc(t('Quantity')) + '</label><input type="number" id="c-qty" min="1" max="999" value="1" inputmode="numeric"></div>'
    + '<div class="field"><label for="c-price">' + esc(t('Price each')) + '</label><input type="text" id="c-price" inputmode="decimal" placeholder="2.49"></div>'
    + '<div class="field"><label for="c-store">' + esc(t('Store')) + '</label><input type="text" id="c-store" list="c-stores" autocomplete="off"><datalist id="c-stores"></datalist></div></div>'
    + '<div class="row"><button type="button" class="go" id="c-add">' + esc(t('Add')) + '</button><span class="live" id="c-msg" role="status"></span></div>'
    + '<div id="c-list"></div><div id="c-tot" class="tot"></div>'
    + '<details class="more"><summary>' + esc(t('Currency, tax and shipping')) + '</summary><div class="grid3"><div class="field"><label for="c-cur">' + esc(t('Currency')) + '</label><select id="c-cur">' + ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'INR'].map((c) => '<option>' + c + '</option>').join('') + '</select></div>'
    + '<div class="field"><label for="c-tax">' + esc(t('Sales tax %')) + '</label><input type="number" id="c-tax" min="0" max="30" step="0.1" inputmode="decimal"></div></div><div id="c-ship"></div><p class="soft">' + esc(t('Tax is an estimate on the goods; shipping is what you type for each store, free once the goods reach the amount you give.')) + '</p></details>'
    + '<div class="row"><button type="button" id="c-link">' + esc(t('Share this list')) + '</button><button type="button" id="c-csv">' + esc(t('Export CSV')) + '</button><label class="btn" for="c-imp">' + esc(t('Import CSV')) + '</label><input type="file" id="c-imp" class="pick" accept=".csv,text/csv"><button type="button" id="c-clear">' + esc(t('Clear ticked')) + '</button><button type="button" id="c-print">' + esc(t('Print')) + '</button></div>');
  const msg = $(s, '#c-msg'), listEl = $(s, '#c-list'), totEl = $(s, '#c-tot');
  let items = (M().list || []).map(C.itemOf).filter(Boolean);
  const h = location.hash.match(/#list=([A-Za-z0-9_-]+)/); if (h) { const got = C.listFromToken(h[1]); if (got && got.items.length) { items = got.items.map((x) => ({ ...x, id: uid() })); keep({ list: items }); const f = $(s, '#c-from'); f.hidden = false; f.textContent = t('This list came from a link') + (got.title ? ': ' + got.title : '') + '. ' + t('It is now kept on this device.'); } }
  const save = () => keep({ list: items }), opts = () => ({ taxPct: +M().tax || 0, ship: M().ship || {} });
  function draw() {
    const tot = C.cartTotals(items, opts()), stores = [...new Set(items.map((x) => x.store).filter(Boolean))];
    $(s, '#c-stores').innerHTML = stores.map((x) => '<option value="' + esc(x) + '">').join('');
    if (!items.length) { listEl.innerHTML = '<p class="soft">' + esc(t('The list is empty. Add an item above, or from a product you looked up.')) + '</p>'; totEl.textContent = ''; drawShip(stores); return; }
    listEl.innerHTML = tot.stores.map((g, gi) => '<div class="grp"><h3>' + esc(g.store || t('No store yet')) + ' <span class="soft">· ' + g.count + ' ' + esc(t(g.count === 1 ? 'item' : 'items')) + '</span></h3><ul class="items">' + g.items.map((x) => '<li data-id="' + esc(x.id) + '" class="' + (x.done ? 'done' : '') + '"><label class="chk"><input type="checkbox" class="tick"' + (x.done ? ' checked' : '') + '><span class="nm">' + esc(x.name) + (x.unit ? ' <span class="soft">' + esc(x.unit) + '</span>' : '') + '</span></label>'
      + '<span class="qty"><button type="button" class="dec" aria-label="' + esc(t('One fewer')) + '">−</button><span>' + x.qty + '</span><button type="button" class="inc" aria-label="' + esc(t('One more')) + '">+</button></span><span class="amt">' + (x.price == null ? '<span class="soft">' + esc(t('no price')) + '</span>' : esc(fm(x.price * x.qty))) + '</span><button type="button" class="del" aria-label="' + esc(t('Remove')) + ' ' + esc(x.name) + '">✕</button></li>').join('') + '</ul>'
      + '<p class="sub">' + esc(t('Goods')) + ' ' + esc(fm(g.subtotal)) + ' · ' + esc(t('tax')) + ' ' + esc(fm(g.tax)) + ' · ' + esc(t('shipping')) + ' ' + esc(g.free ? t('free') : fm(g.shipping)) + ' · <b>' + esc(t('total')) + ' ' + esc(fm(g.total)) + '</b>' + (g.toFree > 0 ? ' · ' + esc(fm(g.toFree)) + ' ' + esc(t('more for free shipping')) : '') + '</p>'
      + (g.store ? '<p class="row">' + checkoutLinks(g) + '</p>' : '') + '</div>').join('');
    const named = tot.stores.filter((g) => g.store).length;
    totEl.innerHTML = '<p class="big">' + esc(fm(tot.total)) + '</p><p class="soft"><b>' + esc(t('in all')) + '</b>, ' + tot.count + ' ' + esc(t(tot.count === 1 ? 'item' : 'items')) + (named > 1 ? ' ' + esc(t('from')) + ' ' + named + ' ' + esc(t('stores')) : '') + '</p><p class="soft">' + esc(t('Goods')) + ' ' + esc(fm(tot.subtotal)) + ' + ' + esc(t('tax')) + ' ' + esc(fm(tot.tax)) + ' + ' + esc(t('shipping')) + ' ' + esc(fm(tot.shipping)) + (tot.unpriced ? ' · ' + tot.unpriced + ' ' + esc(t('without a price')) : '') + '</p>';
    drawShip(stores);
  }
  // check out at each store: the store's own search for each item (a store Verse knows), or Verse's own store
  function checkoutLinks(g) {
    if (/^verse$/i.test(g.store)) return '<a class="btn" href="/store/">' + esc(t('Check out at Verse’s store')) + '</a>';
    const st = C.STORES.find((x) => x.name.toLowerCase() === g.store.toLowerCase() || x.id === g.store.toLowerCase().replace(/\W/g, ''));
    if (!st) return '<span class="soft">' + esc(t('Check out at the store itself.')) + '</span>';
    return g.items.filter((x) => !x.done).slice(0, 6).map((x) => '<a class="btn" rel="noopener noreferrer" target="_blank" href="' + esc(st.url(x.code || x.name)) + '">' + esc(x.name) + ' ' + esc(t('on')) + ' ' + esc(st.name) + '</a>').join(' ');
  }
  function drawShip(stores) {
    const sh = M().ship || {}; $(s, '#c-ship').innerHTML = stores.length ? stores.map((x, i) => '<div class="grid3 shiprow" data-store="' + esc(x) + '"><div class="field"><label>' + esc(x) + '</label><span class="soft">' + esc(t('shipping')) + '</span></div><div class="field"><label for="c-sc' + i + '">' + esc(t('Shipping cost')) + '</label><input type="text" id="c-sc' + i + '" class="sc" inputmode="decimal" value="' + esc(sh[x] && sh[x].cost ? (sh[x].cost / 100).toFixed(2) : '') + '"></div><div class="field"><label for="c-sf' + i + '">' + esc(t('Free over')) + '</label><input type="text" id="c-sf' + i + '" class="sf" inputmode="decimal" value="' + esc(sh[x] && sh[x].freeOver != null ? (sh[x].freeOver / 100).toFixed(2) : '') + '"></div></div>').join('') : '';
  }
  $(s, '#c-ship').addEventListener('change', (e) => { const row = e.target.closest('.shiprow'); if (!row) return; const sh = M().ship || {}, k = row.dataset.store; sh[k] = { cost: C.cents($(row, '.sc').value) || 0, freeOver: $(row, '.sf').value.trim() ? C.cents($(row, '.sf').value) : null }; keep({ ship: sh }); draw(); });
  function add(x) { const it = C.itemOf({ ...x, id: uid() }); if (!it) return false; const same = items.find((y) => y.name.toLowerCase() === it.name.toLowerCase() && y.store === it.store && !y.done); if (same) same.qty = Math.min(999, same.qty + it.qty); else items.push(it); save(); draw(); return true; }
  $(s, '#c-add').addEventListener('click', () => { const name = $(s, '#c-name').value.trim(); if (!name) { say(msg, t('Name the item first.')); return; } const pr = $(s, '#c-price').value.trim(); if (pr && C.cents(pr) == null) { say(msg, t('That price could not be read.')); return; }
    add({ name, qty: $(s, '#c-qty').value, price: pr ? C.cents(pr) : null, store: $(s, '#c-store').value }); $(s, '#c-name').value = ''; $(s, '#c-price').value = ''; $(s, '#c-qty').value = '1'; say(msg, t('Added.')); $(s, '#c-name').focus(); });
  $(s, '#c-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $(s, '#c-add').click(); } });
  listEl.addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (!li) return; const x = items.find((y) => y.id === li.dataset.id); if (!x) return;
    if (e.target.closest('.inc')) x.qty = Math.min(999, x.qty + 1); else if (e.target.closest('.dec')) x.qty = Math.max(1, x.qty - 1); else if (e.target.closest('.del')) items = items.filter((y) => y !== x); else return; save(); draw(); });
  listEl.addEventListener('change', (e) => { if (!e.target.classList.contains('tick')) return; const x = items.find((y) => y.id === e.target.closest('li').dataset.id); if (x) { x.done = e.target.checked; save(); draw(); } });
  const curSel = $(s, '#c-cur'); curSel.value = cur(); curSel.addEventListener('change', () => { keep({ cur: curSel.value }); draw(); fire('money'); });
  const tax = $(s, '#c-tax'); tax.value = M().tax || ''; tax.addEventListener('change', () => { keep({ tax: Math.min(30, Math.max(0, +tax.value || 0)) }); draw(); });
  $(s, '#c-csv').addEventListener('click', () => { if (!items.length) { say(msg, t('The list is empty.')); return; } download('shopping-list.csv', C.listCsv(items, opts()), 'text/csv'); });
  $(s, '#c-imp').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rows = C.listFromCsv(await f.text()); let n = 0; for (const r of rows) if (add(r)) n++; say(msg, t('Imported') + ' ' + n + ' ' + t(n === 1 ? 'item' : 'items') + '.'); e.target.value = ''; });
  $(s, '#c-clear').addEventListener('click', () => { const n = items.filter((x) => x.done).length; items = items.filter((x) => !x.done); save(); draw(); say(msg, n + ' ' + t('ticked items cleared.')); });
  $(s, '#c-print').addEventListener('click', () => window.print());
  $(s, '#c-link').addEventListener('click', () => { if (!items.length) { say(msg, t('The list is empty.')); return; } shareOrCopy(location.origin + location.pathname + '#list=' + C.listToToken(items), t('Shopping list'), msg); });
  on('add', (x) => add(x)); on('money', draw);
  draw(); return s;
}

// ---------- parcels: the carrier named from the number, its own page linked ----------
function trackPanel() {
  const s = panel('track', 'Track a parcel', 'Paste one tracking number or several, one a line. The carrier (UPS, USPS, FedEx, DHL, Royal Mail, Canada Post, Amazon, DPD, GLS, Evri, OnTrac, PostNL and the posts of other countries) is named from the number’s format and check digit, and its own tracking page opens from the link. Verse does not read the carrier’s status.');
  s.insertAdjacentHTML('beforeend', '<div class="field"><label for="t-in">' + esc(t('Tracking numbers')) + '</label><textarea id="t-in" rows="3" autocomplete="off" spellcheck="false" placeholder="1Z999AA10123456784"></textarea></div><div class="row"><button type="button" class="go" id="t-go">' + esc(t('Find the carrier')) + '</button><span class="live" id="t-msg" role="status"></span></div>'
    + '<ul class="plist" id="t-out"></ul><h3>' + esc(t('Your parcels')) + '</h3><ul class="plain" id="t-saved"></ul><div class="row"><button type="button" id="t-ics">' + esc(t('Calendar reminders (.ics)')) + '</button></div>');
  const inp = $(s, '#t-in'), out = $(s, '#t-out'), msg = $(s, '#t-msg'), saved = $(s, '#t-saved');
  const parcels = () => (M().parcels || []).filter((p) => p && p.n);
  function find() {
    const nums = [...new Set(inp.value.split(/[\n,;]+/).map(C.cleanNumber).filter((x) => x.length >= 8))].slice(0, 40); out.textContent = '';
    if (!nums.length) { say(msg, t('Paste a tracking number first.')); return; }
    say(msg, nums.length + ' ' + t(nums.length === 1 ? 'number read' : 'numbers read'));
    for (const n of nums) {
      const cs = C.detectCarrier(n), li = document.createElement('li'); li.className = 'card';
      if (!cs.length) li.innerHTML = '<b>' + esc(n) + '</b>: <span class="bad">' + esc(t('no carrier’s format fits this number. Check it, or look it up on the shop’s order page.')) + '</span>';
      else { const best = cs[0];
        li.innerHTML = '<b>' + esc(n) + '</b><br>' + esc(best.name) + ' · <span class="' + (best.sure === 'bad check digit' ? 'bad' : best.sure === 'check digit' ? 'ok' : 'soft') + '">' + esc(t(best.sure === 'check digit' ? 'check digit right' : best.sure === 'bad check digit' ? 'check digit wrong: a typo?' : 'format fits')) + '</span><br><span class="soft">' + esc(t(best.why)) + '</span>'
          + '<div class="row"><a class="btn go" rel="noopener noreferrer" target="_blank" href="' + esc(best.url) + '">' + esc(t('Track on')) + ' ' + esc(best.name) + '</a> ' + checkLabel(best.check) + '</div>'
          + (cs.length > 1 ? '<p class="soft">' + esc(t('It could also be:')) + ' ' + cs.slice(1).map((c) => '<a rel="noopener noreferrer" target="_blank" href="' + esc(c.url) + '">' + esc(c.name) + '</a>').join(', ') + '</p>' : '')
          + '<div class="grid2"><div class="field"><label for="t-l-' + esc(n) + '">' + esc(t('What is it?')) + '</label><input type="text" id="t-l-' + esc(n) + '" class="lab" maxlength="80"></div><div class="field"><label for="t-d-' + esc(n) + '">' + esc(t('Expected on')) + '</label><input type="date" id="t-d-' + esc(n) + '" class="exp"></div></div><div class="row"><button type="button" class="keep">' + esc(t('Keep this parcel')) + '</button></div>';
        $(li, '.keep').addEventListener('click', () => { const list = parcels().filter((p) => p.n !== n); list.unshift({ n, carrier: best.id, label: $(li, '.lab').value.trim().slice(0, 80), exp: $(li, '.exp').value || '', added: today(), got: false }); keep({ parcels: list.slice(0, 100) }); drawSaved(); say(msg, t('Kept on this device.')); }); }
      out.append(li);
    }
  }
  function drawSaved() {
    const list = parcels(); if (!list.length) { saved.innerHTML = '<li class="soft">' + esc(t('None kept yet.')) + '</li>'; return; }
    saved.innerHTML = list.map((p, i) => { const c = C.CARRIERS[p.carrier] || C.CARRIERS.ups, d = p.exp ? C.daysBetween(today(), p.exp) : null;
      return '<li data-i="' + i + '"><label class="chk"><input type="checkbox" class="got"' + (p.got ? ' checked' : '') + '><span>' + esc(p.label || p.n) + '</span></label> <span class="soft">' + esc(c.name) + ' · ' + esc(p.n) + (p.exp ? ' · ' + (p.got ? esc(t('delivered')) : d > 0 ? esc(t('expected in')) + ' ' + d + ' ' + esc(t(d === 1 ? 'day' : 'days')) : d === 0 ? esc(t('expected today')) : esc(t('was expected')) + ' ' + esc(p.exp)) : '') + '</span> <a class="btn" rel="noopener noreferrer" target="_blank" href="' + esc(c.url(p.n)) + '">' + esc(t('Track')) + '</a> <button type="button" class="rm" aria-label="' + esc(t('Remove')) + '">✕</button></li>'; }).join('');
  }
  saved.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (!li || !e.target.closest('.rm')) return; const list = parcels(); list.splice(+li.dataset.i, 1); keep({ parcels: list }); drawSaved(); });
  saved.addEventListener('change', (e) => { const li = e.target.closest('li[data-i]'); if (!li) return; const list = parcels(); if (list[+li.dataset.i]) list[+li.dataset.i].got = e.target.checked; keep({ parcels: list }); drawSaved(); });
  $(s, '#t-go').addEventListener('click', find);
  $(s, '#t-ics').addEventListener('click', () => { const ev = C.reminderEvents(parcels().filter((p) => p.exp && !p.got).map((p) => ({ id: 'p' + p.n, title: '📦 ' + (p.label || p.n) + ' (' + ((C.CARRIERS[p.carrier] || {}).name || '') + ')', date: p.exp })).concat(returnsEvents()));
    const ics = icsOf(ev); if (!ics) { say(msg, t('Give a parcel an expected date first.')); return; } download('parcels.ics', ics, 'text/calendar'); });
  const p0 = new URLSearchParams(location.search).get('track'); if (p0) { inp.value = p0.slice(0, 1000); find(); }
  drawSaved(); return s;
}

// ---------- price log, targets and price-drop reminders ----------
function pricesPanel() {
  const s = panel('prices', 'Price log and targets', 'Write down the prices you see, with the store and a target. The lowest, the latest and the change are worked out here; set a day to check again and take it to your calendar. Verse does not watch store prices for you.');
  s.insertAdjacentHTML('beforeend', '<div class="grid4"><div class="field"><label for="p-name">' + esc(t('Product')) + '</label><input type="text" id="p-name" list="p-names" autocomplete="off"><datalist id="p-names"></datalist></div><div class="field"><label for="p-price">' + esc(t('Price seen')) + '</label><input type="text" id="p-price" inputmode="decimal"></div><div class="field"><label for="p-store">' + esc(t('Store')) + '</label><input type="text" id="p-store" autocomplete="off"></div><div class="field"><label for="p-target">' + esc(t('Target price')) + '</label><input type="text" id="p-target" inputmode="decimal"></div></div>'
    + '<div class="row"><button type="button" class="go" id="p-add">' + esc(t('Log the price')) + '</button><span class="live" id="p-msg" role="status"></span></div><div id="p-list"></div><div class="row"><button type="button" id="p-ics">' + esc(t('Price check reminders (.ics)')) + '</button><button type="button" id="p-csv">' + esc(t('Export CSV')) + '</button></div>');
  const msg = $(s, '#p-msg'), list = $(s, '#p-list'), P = () => M().prices || {};
  function draw() {
    const all = P(), names = Object.keys(all); $(s, '#p-names').innerHTML = names.map((n) => '<option value="' + esc(n) + '">').join('');
    if (!names.length) { list.innerHTML = '<p class="soft">' + esc(t('No prices logged yet.')) + '</p>'; return; }
    list.innerHTML = names.map((n) => { const r = all[n], st = C.priceStats(r.log, r.target);
      const pts = (r.log || []).slice(-20), mx = Math.max(...pts.map((x) => x.price), r.target || 0, 1), mn = Math.min(...pts.map((x) => x.price), r.target == null ? Infinity : r.target);
      const y = (v) => 38 - ((v - mn) / Math.max(1, mx - mn)) * 32, path = pts.map((x, i) => (i ? 'L' : 'M') + (pts.length > 1 ? (i * 200) / (pts.length - 1) : 100).toFixed(1) + ',' + y(x.price).toFixed(1)).join(' ');
      return '<div class="card" data-n="' + esc(n) + '"><b>' + esc(n) + '</b> <span class="soft">· ' + st.n + ' ' + esc(t(st.n === 1 ? 'price' : 'prices')) + '</span><dl class="dl"><div><dt>' + esc(t('Lowest seen')) + '</dt><dd>' + esc(fm(st.lowest)) + '</dd></div><div><dt>' + esc(t('Latest')) + '</dt><dd>' + esc(fm(st.latest)) + (st.latestStore ? ' · ' + esc(st.latestStore) : '') + ' · ' + esc(st.latestAt || '') + '</dd></div><div><dt>' + esc(t('Change since the first')) + '</dt><dd>' + (st.change > 0 ? '+' : st.change < 0 ? '−' : '') + esc(fm(Math.abs(st.change))) + '</dd></div>'
        + '<div><dt>' + esc(t('Target')) + '</dt><dd>' + (r.target == null ? esc(t('none')) : esc(fm(r.target)) + ' · ' + (st.targetMet ? '<b class="ok">' + esc(t('your target is met')) + '</b>' : esc(fm(st.latest - r.target)) + ' ' + esc(t('to go'))) ) + '</dd></div></dl>'
        + (pts.length > 1 ? '<div class="chart"><svg viewBox="0 0 200 42" role="img" aria-label="' + esc(t('Prices over time')) + '"><path d="' + path + '" fill="none" stroke="currentColor" stroke-width="2"/>' + (r.target != null ? '<line x1="0" x2="200" y1="' + y(r.target).toFixed(1) + '" y2="' + y(r.target).toFixed(1) + '" stroke="currentColor" stroke-dasharray="4 3" opacity=".5"/>' : '') + '</svg></div>' : '')
        + '<div class="row"><label class="soft" for="p-c-' + esc(n.replace(/\W/g, '')) + '">' + esc(t('Check again on')) + '</label><input type="date" class="chk-on" id="p-c-' + esc(n.replace(/\W/g, '')) + '" value="' + esc(r.check || '') + '">' + C.storeLinks(n, 'us').slice(0, 2).map((l) => '<a class="btn" rel="noopener noreferrer" target="_blank" href="' + esc(l.url) + '">' + esc(t('Search on')) + ' ' + esc(l.name) + '</a>').join(' ') + '<button type="button" class="rm" aria-label="' + esc(t('Remove')) + ' ' + esc(n) + '">✕</button></div></div>'; }).join('');
    const due = names.filter((n) => all[n].check && all[n].check <= today()); if (due.length) say(msg, t('Due for a price check today:') + ' ' + due.join(', '));
  }
  $(s, '#p-add').addEventListener('click', () => { const n = $(s, '#p-name').value.trim().slice(0, 80), p = C.cents($(s, '#p-price').value), tg = $(s, '#p-target').value.trim(); if (!n) { say(msg, t('Name the product first.')); return; }
    const all = P(), r = all[n] || { log: [], target: null }; if (p != null) r.log = (r.log || []).concat({ price: p, store: $(s, '#p-store').value.trim().slice(0, 40), at: today() }).slice(-200); if (tg) r.target = C.cents(tg); all[n] = r; keep({ prices: all }); $(s, '#p-price').value = ''; draw(); say(msg, p != null ? t('Logged.') : t('Target kept.')); });
  list.addEventListener('change', (e) => { const c = e.target.closest('[data-n]'); if (!c || !e.target.classList.contains('chk-on')) return; const all = P(); all[c.dataset.n].check = e.target.value; keep({ prices: all }); });
  list.addEventListener('click', (e) => { const c = e.target.closest('[data-n]'); if (!c || !e.target.closest('.rm')) return; const all = P(); delete all[c.dataset.n]; keep({ prices: all }); draw(); });
  $(s, '#p-ics').addEventListener('click', () => { const all = P(), ev = C.reminderEvents(Object.keys(all).filter((n) => all[n].check).map((n) => ({ id: 'c' + n.replace(/\W/g, ''), title: '🏷 ' + t('Check the price of') + ' ' + n + (all[n].target != null ? ' (' + t('target') + ' ' + fm(all[n].target) + ')' : ''), date: all[n].check }))); const ics = icsOf(ev); if (!ics) { say(msg, t('Set a day to check again first.')); return; } download('price-checks.ics', ics, 'text/calendar'); });
  $(s, '#p-csv').addEventListener('click', () => { const all = P(), rows = [['product', 'price', 'store', 'date', 'target']]; for (const n of Object.keys(all)) for (const x of all[n].log || []) rows.push([n, (x.price / 100).toFixed(2), x.store, x.at, all[n].target == null ? '' : (all[n].target / 100).toFixed(2)]); download('prices.csv', rows.map((r) => r.map((v) => { let c = String(v); if (/^[=+\-@]/.test(c)) c = "'" + c; return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n') + '\r\n', 'text/csv'); });
  on('money', draw); draw(); return s;
}

// ---------- unit prices ----------
function unitPanel() {
  const s = panel('unit', 'Unit price', 'Which pack is the better buy: type each price and its size (500 g, 1.5 l, 6 x 330 ml, 12 rolls) and see the price per 100 g, per 100 ml or each.');
  s.insertAdjacentHTML('beforeend', '<div id="u-rows"></div><div class="row"><button type="button" id="u-more">' + esc(t('Another pack')) + '</button></div><div id="u-out" class="tablewrap"></div>');
  const rows = $(s, '#u-rows'), out = $(s, '#u-out'); let n = 0;
  const addRow = (lab = '', price = '', size = '') => { n++; const d = document.createElement('div'); d.className = 'grid3 urow'; d.innerHTML = '<div class="field"><label for="u-l' + n + '">' + esc(t('Pack')) + '</label><input type="text" id="u-l' + n + '" class="ul" value="' + esc(lab || t('Pack') + ' ' + n) + '"></div><div class="field"><label for="u-p' + n + '">' + esc(t('Price')) + '</label><input type="text" id="u-p' + n + '" class="up" inputmode="decimal" value="' + esc(price) + '"></div><div class="field"><label for="u-s' + n + '">' + esc(t('Size')) + '</label><input type="text" id="u-s' + n + '" class="us" value="' + esc(size) + '" placeholder="500 g"></div>'; rows.append(d); };
  const draw = () => { const offers = [...rows.querySelectorAll('.urow')].map((r) => ({ label: $(r, '.ul').value, price: $(r, '.up').value, size: $(r, '.us').value })); const res = C.unitPrices(offers);
    if (!res.length) { out.innerHTML = '<p class="soft">' + esc(t('Type at least one price and size.')) + '</p>'; return; }
    out.innerHTML = (res[0].mixed ? '<p class="warn">' + esc(t('These sizes are in different kinds of unit (weight, volume, count) and cannot be compared.')) + '</p>' : '') + '<table class="tbl"><thead><tr><th>' + esc(t('Pack')) + '</th><th>' + esc(t('Price')) + '</th><th>' + esc(t('Unit price')) + '</th><th></th></tr></thead><tbody>' + res.map((r) => '<tr><td>' + esc(r.label) + '</td><td>' + esc(fm(r.price)) + '</td><td>' + esc(C.money(Math.round(r.per * 100) / 100, cur(), lang())) + ' ' + esc(t(C.perLabel(r.base))) + '</td><td>' + (r.best ? '<b class="ok">' + esc(t('best buy')) + '</b>' : r.mixed ? '' : '+' + r.more + '%') + '</td></tr>').join('') + '</tbody></table>'; };
  addRow('', '3.99', '500 g'); addRow('', '6.49', '1 kg'); rows.addEventListener('input', draw); $(s, '#u-more').addEventListener('click', () => { addRow(); draw(); }); on('money', draw); draw(); return s;
}

// ---------- wish lists ----------
function wishPanel() {
  const s = panel('wish', 'Wish lists', 'Lists of things you would like, each with a link, a price and a note. Share a list as a link: whoever opens it can mark a wish as bought, on their own copy, so gifts are not doubled.');
  s.insertAdjacentHTML('beforeend', '<p class="soft" id="w-from" hidden></p><div class="grid2"><div class="field"><label for="w-list">' + esc(t('List')) + '</label><select id="w-list"></select></div><div class="field"><label for="w-new">' + esc(t('New list')) + '</label><div class="row tight"><input type="text" id="w-new" maxlength="60" placeholder="' + esc(t('Birthday')) + '"><button type="button" id="w-mk">' + esc(t('Make')) + '</button></div></div></div>'
    + '<div class="grid4"><div class="field"><label for="w-name">' + esc(t('Wish')) + '</label><input type="text" id="w-name" maxlength="120"></div><div class="field"><label for="w-url">' + esc(t('Link (optional)')) + '</label><input type="url" id="w-url" inputmode="url" placeholder="https://"></div><div class="field"><label for="w-price">' + esc(t('Price')) + '</label><input type="text" id="w-price" inputmode="decimal"></div><div class="field"><label for="w-pri">' + esc(t('How much')) + '</label><select id="w-pri"><option value="3">' + esc(t('Really want')) + '</option><option value="2" selected>' + esc(t('Would like')) + '</option><option value="1">' + esc(t('Nice to have')) + '</option></select></div></div>'
    + '<div class="field"><label for="w-note">' + esc(t('Note: size, colour, model')) + '</label><input type="text" id="w-note" maxlength="200"></div><div class="row"><button type="button" class="go" id="w-add">' + esc(t('Add the wish')) + '</button><span class="live" id="w-msg" role="status"></span></div>'
    + '<ul class="plain" id="w-items"></ul><div class="row"><button type="button" id="w-link">' + esc(t('Share this list')) + '</button><button type="button" id="w-print">' + esc(t('Print')) + '</button><button type="button" id="w-cart">' + esc(t('Move bought-for-me wishes off')) + '</button></div>');
  const msg = $(s, '#w-msg'), sel = $(s, '#w-list'), ul = $(s, '#w-items');
  const W = () => { const w = M().wishes; return w && typeof w === 'object' && Object.keys(w).length ? w : { [t('My wishes')]: [] }; };
  let curList = M().wishList || Object.keys(W())[0];
  const h = location.hash.match(/#wish=([A-Za-z0-9_-]+)/); if (h) { const got = C.listFromToken(h[1]); if (got) { const name = (got.title || t('Shared list')).slice(0, 60), w = W(); w[name] = got.items.map((x) => ({ id: uid(), name: x.name, price: x.price, url: safeUrl(x.url), note: x.unit || '', pri: x.qty > 0 && x.qty < 4 ? x.qty : 2, bought: x.done })); keep({ wishes: w, wishList: name }); curList = name; const f = $(s, '#w-from'); f.hidden = false; f.textContent = t('This wish list came from a link. Mark what you buy as bought; it stays on this device.'); } }
  function draw() {
    const w = W(); if (!w[curList]) curList = Object.keys(w)[0]; sel.innerHTML = Object.keys(w).map((k) => '<option' + (k === curList ? ' selected' : '') + '>' + esc(k) + '</option>').join('');
    const items = (w[curList] || []).slice().sort((a, b) => (a.bought - b.bought) || (b.pri - a.pri));
    ul.innerHTML = items.length ? items.map((x) => '<li data-id="' + esc(x.id) + '" class="' + (x.bought ? 'done' : '') + '"><label class="chk"><input type="checkbox" class="bought"' + (x.bought ? ' checked' : '') + '><span>' + esc(x.name) + '</span></label> <span class="soft">' + '★'.repeat(x.pri || 2) + (x.price != null ? ' · ' + esc(fm(x.price)) : '') + (x.note ? ' · ' + esc(x.note) : '') + (x.bought ? ' · ' + esc(t('bought')) : '') + '</span> ' + (safeUrl(x.url) ? '<a class="btn" rel="noopener noreferrer nofollow" target="_blank" href="' + esc(safeUrl(x.url)) + '">' + esc(t('Open the link')) + '</a> ' : '<a class="btn" rel="noopener noreferrer" target="_blank" href="' + esc(C.storeLinks(x.name)[0].url) + '">' + esc(t('Search on')) + ' Amazon</a> ') + '<button type="button" class="rm" aria-label="' + esc(t('Remove')) + ' ' + esc(x.name) + '">✕</button></li>').join('') : '<li class="soft">' + esc(t('No wishes on this list yet.')) + '</li>';
  }
  const saveList = (items) => { const w = W(); w[curList] = items; keep({ wishes: w, wishList: curList }); };
  sel.addEventListener('change', () => { curList = sel.value; keep({ wishList: curList }); draw(); });
  $(s, '#w-mk').addEventListener('click', () => { const n = $(s, '#w-new').value.trim().slice(0, 60); if (!n) return; const w = W(); if (!w[n]) w[n] = []; curList = n; keep({ wishes: w, wishList: n }); $(s, '#w-new').value = ''; draw(); });
  $(s, '#w-add').addEventListener('click', () => { const name = $(s, '#w-name').value.trim().slice(0, 120); if (!name) { say(msg, t('Name the wish first.')); return; } const url = $(s, '#w-url').value.trim(); if (url && !safeUrl(url)) { say(msg, t('A link starts with https://')); return; }
    const w = W(), items = w[curList] || []; items.push({ id: uid(), name, url: safeUrl(url), price: C.cents($(s, '#w-price').value), note: $(s, '#w-note').value.trim().slice(0, 200), pri: +$(s, '#w-pri').value || 2, bought: false }); saveList(items); for (const id of ['#w-name', '#w-url', '#w-price', '#w-note']) $(s, id).value = ''; draw(); say(msg, t('Added.')); });
  ul.addEventListener('change', (e) => { const li = e.target.closest('li[data-id]'); if (!li) return; const items = W()[curList] || [], x = items.find((y) => y.id === li.dataset.id); if (x) { x.bought = e.target.checked; saveList(items); draw(); } });
  ul.addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (!li || !e.target.closest('.rm')) return; saveList((W()[curList] || []).filter((y) => y.id !== li.dataset.id)); draw(); });
  $(s, '#w-link').addEventListener('click', () => { const items = W()[curList] || []; if (!items.length) { say(msg, t('Add a wish first.')); return; } shareOrCopy(location.origin + location.pathname + '#wish=' + C.listToToken(items.map((x) => ({ name: x.name, qty: x.pri || 2, price: x.price, url: x.url, unit: String(x.note || '').slice(0, 30), done: x.bought })), curList), curList, msg); });
  $(s, '#w-print').addEventListener('click', () => window.print());
  $(s, '#w-cart').addEventListener('click', () => { const items = W()[curList] || [], n = items.filter((x) => x.bought).length; saveList(items.filter((x) => !x.bought)); draw(); say(msg, n + ' ' + t('bought wishes taken off the list.')); });
  on('money', draw); draw(); return s;
}

// ---------- return windows ----------
const returnsList = () => (M().returns || []).filter((x) => x && x.name);
const returnsEvents = () => returnsList().filter((x) => !x.sent).map((x) => { const w = C.returnWindow(x.bought, x.days, today()); return w ? { id: 'r' + x.id, title: '↩ ' + t('Last day to return') + ' ' + x.name + (x.store ? ' (' + x.store + ')' : ''), date: w.due } : null; }).filter(Boolean);
function returnsPanel() {
  const s = panel('returns', 'Return windows', 'Keep what you bought with the store’s return window: the last day to send it back is counted down here, and goes to your calendar.');
  s.insertAdjacentHTML('beforeend', '<div class="grid4"><div class="field"><label for="r-name">' + esc(t('What you bought')) + '</label><input type="text" id="r-name" maxlength="100"></div><div class="field"><label for="r-store">' + esc(t('Store')) + '</label><input type="text" id="r-store" maxlength="40"></div><div class="field"><label for="r-date">' + esc(t('Bought or delivered on')) + '</label><input type="date" id="r-date"></div><div class="field"><label for="r-days">' + esc(t('Days to return')) + '</label><input type="number" id="r-days" min="1" max="365" value="30" inputmode="numeric"></div></div>'
    + '<div class="row"><button type="button" class="go" id="r-add">' + esc(t('Keep the return window')) + '</button><button type="button" id="r-ics">' + esc(t('Calendar reminders (.ics)')) + '</button><span class="live" id="r-msg" role="status"></span></div><ul class="plain" id="r-list"></ul>');
  const msg = $(s, '#r-msg'), ul = $(s, '#r-list'); $(s, '#r-date').value = today();
  function draw() { const list = returnsList(); if (!list.length) { ul.innerHTML = '<li class="soft">' + esc(t('Nothing kept yet.')) + '</li>'; return; }
    ul.innerHTML = list.map((x) => { const w = C.returnWindow(x.bought, x.days, today()); if (!w) return ''; const st = x.sent ? t('sent back') : w.state === 'closed' ? t('the window closed on') + ' ' + w.due : w.state === 'today' ? t('last day today') : w.left + ' ' + t(w.left === 1 ? 'day left' : 'days left') + ', ' + t('until') + ' ' + w.due;
      return '<li data-id="' + esc(x.id) + '"><label class="chk"><input type="checkbox" class="sent"' + (x.sent ? ' checked' : '') + '><span>' + esc(x.name) + '</span></label> <span class="' + (x.sent ? 'soft' : w.state === 'soon' || w.state === 'today' ? 'warn' : w.state === 'closed' ? 'bad' : 'ok') + '">' + esc(st) + '</span>' + (x.store ? ' <span class="soft">· ' + esc(x.store) + '</span>' : '') + ' <button type="button" class="rm" aria-label="' + esc(t('Remove')) + ' ' + esc(x.name) + '">✕</button></li>'; }).join(''); }
  $(s, '#r-add').addEventListener('click', () => { const name = $(s, '#r-name').value.trim(), d = $(s, '#r-date').value, days = +$(s, '#r-days').value; if (!name || !d || !(days > 0)) { say(msg, t('Name it, and give the day and the number of days.')); return; }
    keep({ returns: [{ id: uid(), name: name.slice(0, 100), store: $(s, '#r-store').value.trim().slice(0, 40), bought: d, days: Math.min(365, days), sent: false }, ...returnsList()].slice(0, 100) }); $(s, '#r-name').value = ''; draw(); say(msg, t('Kept on this device.')); });
  ul.addEventListener('change', (e) => { const li = e.target.closest('li[data-id]'); if (!li) return; const list = returnsList(), x = list.find((y) => y.id === li.dataset.id); if (x) { x.sent = e.target.checked; keep({ returns: list }); draw(); } });
  ul.addEventListener('click', (e) => { const li = e.target.closest('li[data-id]'); if (!li || !e.target.closest('.rm')) return; keep({ returns: returnsList().filter((y) => y.id !== li.dataset.id) }); draw(); });
  $(s, '#r-ics').addEventListener('click', () => { const ics = icsOf(C.reminderEvents(returnsEvents())); if (!ics) { say(msg, t('Keep a return window first.')); return; } download('returns.ics', ics, 'text/calendar'); });
  draw(); return s;
}

const PANELS = { lookup: lookupPanel, stores: storesPanel, cart: cartPanel, track: trackPanel, prices: pricesPanel, unit: unitPanel, wish: wishPanel, returns: returnsPanel };
function keepForOffline() {
  try {
    if (!('caches' in window)) return; const app = location.pathname + 'app.js';
    caches.open(SW_CACHE).then((c) => Promise.all([location.pathname, app, '/lib/shop-ui.js', '/lib/shop-core.js', '/lib/shop-de.js', '/lib/ics.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/shop-sites.js', '/lib/flight-sites.js'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {});
  } catch (_) { /* no cache here: the page still works online */ }
}
/** mounts the panels a page asks for into root: { panels: [...], de: { h1, intro } }. */
export function mountShop(root, cfg = {}) {
  root.textContent = '';
  const n = document.createElement('p'); n.className = 'notice'; n.textContent = t('Verse does not stock or ship goods: you buy from the stores. This page finds products, keeps your list, cart, parcels and prices on this device, and opens the stores’ and carriers’ own pages.'); root.append(n);
  for (const p of cfg.panels || ['lookup', 'stores', 'cart']) if (PANELS[p]) root.append(PANELS[p](cfg));
  const foot = document.createElement('div'); foot.className = 'row'; foot.innerHTML = '<button type="button" id="sh-share">' + esc(t('Share link')) + '</button> <span class="live" id="sh-sharemsg" role="status"></span>'; root.append(foot);
  $(foot, '#sh-share').addEventListener('click', () => shareOrCopy(location.href.replace(/#.*$/, ''), document.title, $(foot, '#sh-sharemsg')));
  if (isDe()) { document.documentElement.lang = 'de'; if (cfg.de) { const h = document.querySelector('h1'), p = document.querySelector('.intro'); if (h && cfg.de.h1) h.textContent = cfg.de.h1; if (p && cfg.de.intro) p.textContent = cfg.de.intro; if (cfg.de.h1) document.title = cfg.de.h1 + ' · Verse'; } }
  const hash = location.hash.replace(/^#/, ''); if (/^[a-z]+$/.test(hash) && document.getElementById(hash)) setTimeout(() => document.getElementById(hash).scrollIntoView(), 0);
  document.documentElement.dataset.shopReady = '1';
  keepForOffline();
}
