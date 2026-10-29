    // Minimal local hash of the sealed class only. No network. No claim field.
    document.getElementById('hash').addEventListener('click', async () => {
      const text = document.getElementById('sensation').value.trim();
      if (!text) return;
      const enc = new TextEncoder().encode('sensation-class:' + text);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      document.getElementById('refusal').textContent = hex.slice(0, 16) + '… (attestation-refusal)';
      // Explicitly do not keep or hash any claim sentence.
    });
  