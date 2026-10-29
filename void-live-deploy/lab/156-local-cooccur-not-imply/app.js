const btn = document.getElementById('hashBtn');
const out = document.getElementById('out');
btn.addEventListener('click', async () => {
  const a = document.getElementById('obsA').value.trim();
  const b = document.getElementById('obsB').value.trim();
  const i = document.getElementById('imply').value.trim();
  if (!a || !b) return;
  const payload = `${a}|${b}|unattested`;
  const enc = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const hash = Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2,'0')).join('');
  document.getElementById('hashOut').textContent = hash;
  document.getElementById('discOut').textContent = i || '(none typed)';
  out.hidden = false;
  const rec = { a, b, hash, at: new Date().toISOString(), discarded: i };
  localStorage.setItem('atm-cooccur-156', JSON.stringify(rec));
});
