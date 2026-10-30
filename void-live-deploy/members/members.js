// /members/ (functions/api/members.js, lib/members.js): what paid Verse gives, the idea form for members, their ideas and the wall.
// The perks come from lib/members.js itself, so the page reads right even when the API is out; the tier comes from the server only.
import { perks as perksOf, LIVE, BUY } from '/lib/members.js';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const PILOT = new URLSearchParams(location.search).has('pilot'); // the pre-launch pilot (functions/api/members.js)
let me = null; try { me = JSON.parse(localStorage.getItem('a2m.void.me.v1') || 'null'); } catch (_) { me = null; }
const auth = () => { const h = { 'content-type': 'application/json' }; if (me && me.token) h.authorization = 'Bearer ' + me.token; return h; };

// buying while signed in carries your Verse's id, so the purchase unlocks that Verse (functions/api/gumroad.js url_params.void)
function buyLink(href) { try { const u = new URL(href); if (me && me.userId) u.searchParams.set('void', me.userId); return u.href; } catch (_) { return href; } }

function ideas(list) {
  const ul = $('ideas'); ul.textContent = '';
  if (!list || !list.length) { ul.append(el('li', 'muted', 'None yet.')); return; }
  for (const i of list) {
    const li = el('li'); li.append(el('div', null, i.text));
    const st = el('div', 'st ' + String(i.state).replace(/\s+/g, '-'), i.status || 'In the queue');
    if (i.pr) { st.append(' · '); const a = el('a', null, 'see the change'); a.href = i.pr; a.rel = 'noopener'; st.append(a); }
    li.append(st); ul.append(li);
  }
}

function showPerks(list) {
  const ul = $('perks'); ul.textContent = '';
  for (const p of list) { const li = el('li'); li.append(el('b', null, p.title), el('span', null, p.text)); ul.append(li); }
}
showPerks(perksOf(LIVE));
$('buy').href = buyLink(BUY);

async function load() {
  let j = null;
  try { j = await (await fetch('/api/members', { headers: auth(), cache: 'no-store' })).json(); } catch (_) { j = null; }
  if (j && Array.isArray(j.perks) && j.perks.length) showPerks(j.perks);
  if (me && me.userId) $('how').textContent = 'You are signed in, so joining unlocks this Verse. After you pay, come back to this tab.';
  const paid = j && j.signedIn && j.tier === 'paid';
  $('claim').hidden = !(j && j.signedIn && !paid); // a purchase that did not carry this Verse's id is linked with the receipt
  if (paid) { $('buy').hidden = true; $('how').textContent = 'You are a member. Thank you for building Verse.'; }
  const open = j && (j.live || PILOT);
  $('lab').hidden = !(paid && open);
  $('soon').hidden = !(paid && !open);
  if (paid && open) { $('left').textContent = String(j.left ?? 0); $('send').disabled = !(j.left > 0); ideas(j.ideas); }
  const w = (j && j.wall) || [];
  $('built').hidden = !w.length;
  const wall = $('wall'); wall.textContent = '';
  for (const x of w) { const li = el('li'); li.append(el('div', null, x.text)); const by = el('div', 'muted', 'by ' + x.by); if (x.pr) { by.append(' · '); const a = el('a', null, 'the change'); a.href = x.pr; a.rel = 'noopener'; by.append(a); } li.append(by); wall.append(li); }
}

// the live price from the store (lib/gumroad.js catalog), never typed into the page
fetch('/api/catalog').then((r) => r.json()).then((c) => {
  const v = (c.products || []).find((p) => p.slug === 'yinmj');
  if (v && v.price_cents) $('price').textContent = ' · $' + (v.price_cents / 100).toFixed(v.price_cents % 100 ? 2 : 0) + (v.recurrence === 'monthly' ? ' a month' : v.recurrence === 'yearly' ? ' a year' : '');
}).catch(() => {});

$('send').addEventListener('click', async () => {
  const idea = $('idea').value.trim(), say = $('say');
  if (!idea) { say.textContent = 'Write your idea first.'; return; }
  $('send').disabled = true; say.textContent = 'Sending…';
  let r = null, j = null;
  try { r = await fetch('/api/members', { method: 'POST', headers: auth(), body: JSON.stringify(PILOT ? { idea, pilot: true } : { idea }) }); j = await r.json(); } catch (_) { j = null; }
  if (r && r.ok && j && j.ok) { say.textContent = 'Sent. Verse will build it and list it under your ideas.'; $('idea').value = ''; }
  else say.textContent = (j && j.error) || 'It did not send; try again.';
  await load();
});

// the buyer pays in a new tab; when they come back here, the page reads the tier again (the ping lands within seconds)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });

$('claimgo').addEventListener('click', async () => {
  const order = $('order').value.trim(), email = $('email').value.trim(), say = $('claimsay');
  if (!order || !email) { say.textContent = 'Give the Order ID and the email first.'; return; }
  $('claimgo').disabled = true; say.textContent = 'Checking your order…';
  let r = null, j = null;
  try { r = await fetch('/api/members', { method: 'POST', headers: auth(), body: JSON.stringify({ do: 'claim', order, email }) }); j = await r.json(); } catch (_) { j = null; }
  $('claimgo').disabled = false;
  if (r && r.ok && j && j.ok) say.textContent = 'Done. MultiVerse is on for this Verse.';
  else say.textContent = (j && j.error) || 'Verse could not check that order; try again.';
  await load();
});

load();
