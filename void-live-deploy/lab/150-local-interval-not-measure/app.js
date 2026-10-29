    let startT = null;
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const elapsed = document.getElementById('elapsed');
    const hyp = document.getElementById('hyp');
    const hashBtn = document.getElementById('hash');
    const out = document.getElementById('out');

    startBtn.addEventListener('click', () => {
      startT = performance.now();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      elapsed.textContent = 'Elapsed: running…';
    });

    stopBtn.addEventListener('click', () => {
      if (!startT) return;
      const ms = Math.round(performance.now() - startT);
      elapsed.textContent = `Elapsed: ${ms} ms (local observation only)`;
      stopBtn.disabled = true;
      startBtn.disabled = false;
      startT = null;
    });

    async function sha256(str) {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    hashBtn.addEventListener('click', async () => {
      const obs = elapsed.textContent || 'no-mark';
      const h = hyp.value.trim() || 'none';
      // duration-claim sentence deliberately excluded from payload
      const payload = `interval-observation:${obs}|hypothesis-discarded|unattested:true|refusal:measurement`;
      const id = await sha256(payload);
      out.textContent = `refusal-id: ${id}`;
    });
  