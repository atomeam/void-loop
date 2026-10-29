// /members/ (functions/api/members.js, lib/members.js): what paid Verse gives, the idea form for members, their ideas and the wall.
// The tier comes from the server; this page only shows what /api/members says.
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
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

async function load() {
  let j = null;
  try { j = await (await fetch('/api/members', { headers: auth(), cache: 'no-store' })).json(); } catch (_) { j = null; }
  const perks = (j && j.perks) || [];
  const ul = $('perks'); ul.textContent = '';
  for (const p of perks) { const li = el('li'); li.append(el('b', null, p.title), el('span', null, p.text)); ul.append(li); }
  $('buy').href = buyLink((j && j.buy) || $('buy').href);
  if (me && me.userId) $('how').textContent = 'You are signed in, so joining unlocks this Verse.';
  const paid = j && j.signedIn && j.tier === 'paid';
  if (paid) { $('buy').hidden = true; $('how').textContent = 'You are a member. Thank you for building Verse.'; }
  $('lab').hidden = !(paid && j.live);
  $('soon').hidden = !(paid && !j.live);
  if (paid && j.live) { $('left').textContent = String(j.left ?? 0); $('send').disabled = !(j.left > 0); ideas(j.ideas); }
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
  try { r = await fetch('/api/members', { method: 'POST', headers: auth(), body: JSON.stringify({ idea }) }); j = await r.json(); } catch (_) { j = null; }
  if (r && r.ok && j && j.ok) { say.textContent = 'Sent. Verse will build it and list it under your ideas.'; $('idea').value = ''; }
  else say.textContent = (j && j.error) || 'It did not send; try again.';
  await load();
});

load();
