async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('hashBtn').addEventListener('click', async () => {
  const obs = document.getElementById('obs').value.trim();
  const hyp = document.getElementById('hyp').value.trim();
  const boost = document.getElementById('boost').value.trim();
  const payload = obs + '\n' + hyp + '\nunattested|quiet-filter|no-boost';
  const id = await sha256(payload);
  document.getElementById('hashOut').textContent = id;
  document.getElementById('discarded').textContent = boost || '(empty)';
  document.getElementById('out').hidden = false;
});
