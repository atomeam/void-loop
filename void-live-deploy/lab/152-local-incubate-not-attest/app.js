document.getElementById('hashBtn').addEventListener('click', async () => {
  const text = document.getElementById('obs').value.trim();
  if (!text) { document.getElementById('out').textContent = 'Empty. Nothing hashed.'; return; }
  const encoder = new TextEncoder();
  const data = encoder.encode('incubate-not-attest|' + text + '|unattested');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  document.getElementById('out').textContent = 'SHA-256: ' + hashHex + '\nStatus: unattested local class. Refusal id generated. No storage. No share. No claim.';
  document.getElementById('obs').value = ''; // discard
});
