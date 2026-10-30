// Stricter Verse: default-deny, content discarded, hash of sealed class only.
// No Web Crypto? Fallback note. No network, no storage of user text.
document.getElementById('seal').addEventListener('click', async () => {
  const recall = document.getElementById('recall').value;
  // Discard immediately; never include in hash or any export.
  document.getElementById('recall').value = '';
  const sealedClass = 'private-recall';
  let hash = 'unavailable';
  try {
    const enc = new TextEncoder().encode(sealedClass);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    hash = 'crypto-unavailable-local-only';
  }
  document.getElementById('hash').textContent = hash;
  document.getElementById('status').textContent =
    'Sealed. Recall sentence discarded and is not in the hash. Private mark ≠ shared memory ≠ collective edit. Status: unattested hypothesis. Confidence: design-material only.';
});
