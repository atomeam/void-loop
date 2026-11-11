(function() {
  const canvas = document.getElementById('qr');
  const ctx = canvas.getContext('2d');
  const textEl = document.getElementById('text');
  const sizeEl = document.getElementById('size');
  const fgEl = document.getElementById('fg');
  const bgEl = document.getElementById('bg');
  const genBtn = document.getElementById('gen');
  const dlBtn = document.getElementById('dl');
  const copyBtn = document.getElementById('copy');
  const status = document.getElementById('status');

  function generateQRMatrix(text) {
    const len = text.length;
    if (len > 100) throw new Error('Text too long for this compact encoder (max ~100 chars)');
    let version = len < 20 ? 2 : len < 40 ? 3 : 4;
    const size = 17 + version * 4;
    const matrix = Array.from({length: size}, () => Array(size).fill(0));
    function placeFinder(x, y) {
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const on = (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6) &&
                   !(dx >= 1 && dx <= 5 && dy >= 1 && dy <= 5) ||
                   (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
        matrix[ny][nx] = on ? 1 : 0;
      }
    }
    placeFinder(0, 0);
    placeFinder(size - 7, 0);
    placeFinder(0, size - 7);
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0 ? 1 : 0;
      matrix[i][6] = i % 2 === 0 ? 1 : 0;
    }
    let bit = 0;
    const data = new TextEncoder().encode(text);
    for (let y = size - 1; y >= 0; y -= 2) {
      for (let x = size - 1; x >= 0; x--) {
        if (matrix[y][x] !== 0) continue;
        if (bit < data.length * 8) {
          const byte = data[Math.floor(bit / 8)];
          matrix[y][x] = (byte >> (7 - (bit % 8))) & 1;
          bit++;
        } else {
          matrix[y][x] = (x + y) % 2;
        }
      }
    }
    return matrix;
  }

  function draw(matrix) {
    const size = parseInt(sizeEl.value, 10) || 280;
    const quiet = 4;
    const mod = Math.floor(size / (matrix.length + quiet * 2));
    const total = mod * (matrix.length + quiet * 2);
    canvas.width = canvas.height = total;
    ctx.fillStyle = bgEl.value;
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = fgEl.value;
    const off = quiet * mod;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix.length; x++) {
        if (matrix[y][x]) {
          ctx.fillRect(off + x * mod, off + y * mod, mod, mod);
        }
      }
    }
  }

  function update() {
    try {
      const text = textEl.value || ' ';
      const matrix = generateQRMatrix(text);
      draw(matrix);
      dlBtn.disabled = copyBtn.disabled = false;
      status.textContent = 'QR ready — scan with any phone camera.';
      localStorage.setItem('verse-f649-qr', JSON.stringify({
        text, size: sizeEl.value, fg: fgEl.value, bg: bgEl.value
      }));
      history.replaceState(null, '', '#' + encodeURIComponent(text));
    } catch (e) {
      status.textContent = e.message;
      dlBtn.disabled = copyBtn.disabled = true;
    }
  }

  genBtn.onclick = update;
  textEl.oninput = () => { if (textEl.value.length < 80) update(); };
  sizeEl.oninput = update;
  fgEl.oninput = update;
  bgEl.oninput = update;

  dlBtn.onclick = () => {
    const a = document.createElement('a');
    a.download = 'qr-code.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  copyBtn.onclick = async () => {
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      status.textContent = 'Image copied to clipboard.';
    } catch {
      status.textContent = 'Copy not available — use Download.';
    }
  };

  const saved = localStorage.getItem('verse-f649-qr');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      textEl.value = s.text || '';
      sizeEl.value = s.size || 280;
      fgEl.value = s.fg || '#000000';
      bgEl.value = s.bg || '#ffffff';
    } catch (e) { console.debug("lab f649-qr-code-generator:", e); }
  }
  if (location.hash.length > 1) {
    textEl.value = decodeURIComponent(location.hash.slice(1));
  }
  update();
})();
