const f = document.getElementById('f');
const out = document.getElementById('out');
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const obs = document.getElementById('obs').value.trim();
  if (!obs) { out.hidden = false; out.textContent = 'Observation required.'; return; }
  // Promotion sentence discarded; not in hash
  const payload = obs + '|unattested|promotion-refusal';
  const h = await sha256(payload);
  out.hidden = false;
  out.innerHTML = '<strong>Promotion-refusal id (SHA-256 of observation + unattested flag):</strong><br>' + h +
    '<p class="note">This hash marks discardable ledger data. It is not an attestation, not a promotion to fact, not a seal, and not a claim. Hypothesis text was discarded and is not in the hash. Unattested default.</p>';
});
