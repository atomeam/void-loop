(async function () {
  const btn = document.getElementById('hashBtn');
  const out = document.getElementById('out');
  btn.addEventListener('click', async () => {
    // Class only. Persistence / recording sentence deliberately excluded.
    const classText = 'optin-gaze-or-gesture|unattested|recording-refusal';
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(classText));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    out.textContent = 'recording-refusal id: ' + hex + '\n(not a track, not a command, not persisted)';
  });
})();
