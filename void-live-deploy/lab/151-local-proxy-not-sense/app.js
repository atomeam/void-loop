async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('seal').addEventListener('click', async () => {
  const source = document.getElementById('source').value.trim() || 'unspecified';
  const proxy = document.getElementById('proxy').value.trim() || 'unspecified';
  // Claim sentence is read but deliberately discarded from the hash payload
  const claim = document.getElementById('claim').value;
  const payload = `local-proxy-not-sense|source=${source}|proxy=${proxy}|flag=unattested|refusal=native-sense`;
  const h = await sha256(payload);
  document.getElementById('hash').textContent = h;
  document.getElementById('status').textContent = 'unattested — substitution mark is not a native sense';
  // claim is intentionally unused in the hash
});
