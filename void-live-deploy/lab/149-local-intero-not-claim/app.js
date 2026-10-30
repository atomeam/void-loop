async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('go').addEventListener('click', async () => {
  const obs = document.getElementById('obs').value.trim();
  const claim = document.getElementById('claim').value; // intentionally unused
  if (!obs) return;
  // claim is discarded — not included
  const payload = obs + '|hypothesis-unattested|unattested';
  const id = await sha256(payload);
  document.getElementById('hash').textContent = id;
  document.getElementById('out').hidden = false;
  // claim textarea left as-is for user awareness that it was not hashed
});
