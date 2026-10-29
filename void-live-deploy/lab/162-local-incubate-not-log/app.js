(function () {
  const startBtn = document.getElementById('start');
  const endBtn = document.getElementById('end');
  const noteEl = document.getElementById('note');
  const status = document.getElementById('status');
  const hashEl = document.getElementById('hash');
  let t0 = null;

  async function sha256Hex(str) {
    const bytes = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }

  startBtn.addEventListener('click', function () {
    t0 = performance.now();
    startBtn.disabled = true;
    endBtn.disabled = false;
    status.textContent = 'Local incubation start mark placed. Note and delta will be discarded.';
    hashEl.textContent = '—';
    noteEl.value = '';
  });

  endBtn.addEventListener('click', async function () {
    if (t0 === null) return;
    const t1 = performance.now();
    const _delta = t1 - t0; // computed then discarded
    const _note = noteEl.value; // read then discarded; never enters hash
    noteEl.value = '';
    t0 = null;
    startBtn.disabled = false;
    endBtn.disabled = true;
    status.textContent = 'Incubation marked. Record sentence discarded.';
    const classStr = 'local-incubate-not-log|log-refusal|unattested';
    const h = await sha256Hex(classStr);
    hashEl.textContent = h;
  });
})();
