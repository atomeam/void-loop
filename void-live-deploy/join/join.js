// /join/: the public offer. A license/order from the Gumroad receipt joins the team (the $1 Join the Team is a 7-day trial),
// then the member key is exchanged for the signed verse_session cookie (functions/api/member-session.js). A stored team key or a
// signed-in Verse account is tried first, so a returning member goes straight through. Nothing here trusts the browser: the API
// checks the Gumroad sale and the D1 member row; the cookie is only a claim that the gate re-checks.
const $ = (id) => document.getElementById(id);
const next = (() => {
  const s = new URLSearchParams(location.search).get('next');
  try {
    const u = new URL(s || '/', location.origin);
    return u.origin === location.origin && u.pathname.startsWith('/') && !u.pathname.startsWith('//') ? u.pathname + u.search + u.hash : '/';
  } catch (_) { return '/'; }
})();
const say = (id, msg, bad) => { const e = $(id); if (!e) return; e.textContent = msg || ''; e.className = 'say' + (bad ? ' bad' : ''); };
const go = () => { location.href = next; };

async function session(key) {
  try { return (await fetch('/api/member-session', { method: 'POST', headers: { authorization: 'Bearer ' + key }, cache: 'no-store' })).ok; } catch (_) { return false; }
}
(async () => {
  try { const k = localStorage.getItem('a2m.team.key.v1'); if (k && await session(k)) return go(); } catch (_) {}
  try { const t = (JSON.parse(localStorage.getItem('a2m.void.me.v1') || 'null') || {}).token; if (t && await session(t)) return go(); } catch (_) {}
})();

// the products from the public jobs board (join-the-team and every store product that opens the team); the $1 option is the fallback
(async () => {
  try {
    const j = await (await fetch('/api/team?jobs', { cache: 'no-store' })).json();
    if (!Array.isArray(j.products) || !j.products.length) return;
    const s = $('product'); s.textContent = '';
    for (const p of j.products) {
      const o = document.createElement('option');
      o.value = p.slug;
      o.textContent = p.name + (p.slug === 'join-the-team' ? ' — $1 trial' : '');
      s.append(o);
    }
  } catch (_) { /* the $1 option stays */ }
})();

$('join').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('name').value.trim(), product = $('product').value;
  const license = $('license').value.trim(), order = $('order').value.trim(), email = $('email').value.trim();
  if (!name) return say('say', 'Pick the name your teammates will see.', true);
  if (!license && !order) return say('say', 'Paste the license key, or the Order ID and the email you paid with.', true);
  if (order && !email) return say('say', 'The Order ID needs the email you paid with.', true);
  say('say', 'checking…');
  try {
    const r = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'member', name, product, ...(license ? { key: license } : { order, email }) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.key) return say('say', j.say || j.error || 'that did not join; check the license and try again', true);
    try { localStorage.setItem('a2m.team.key.v1', j.key); } catch (_) {}
    if (!(await session(j.key))) return say('say', 'you joined, but the members cookie did not set; paste the member key below', true);
    say('say', 'welcome, ' + (j.name || name) + '; opening Verse…');
    go();
  } catch (_) { say('say', 'the membership desk did not answer; try again in a moment', true); }
});

$('keyform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const k = $('key').value.trim();
  if (!k) return;
  try {
    if (await session(k)) { try { localStorage.setItem('a2m.team.key.v1', k); } catch (_) {} go(); }
    else say('keysay', 'that key is not an active member', true);
  } catch (_) { say('keysay', 'the membership desk did not answer', true); }
});
