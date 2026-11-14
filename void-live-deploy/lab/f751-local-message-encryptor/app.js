const messageEl = document.getElementById('message');
const passEl = document.getElementById('pass');
const resultEl = document.getElementById('result');
const runBtn = document.getElementById('run');
const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');

let lastResult = '';

function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(text, passphrase) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text)
  );
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(b64, passphrase) {
  try {
    const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    if (combined.length < 28) throw new Error('Too short');
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);
    const key = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plain);
  } catch (e) {
    throw new Error('Decryption failed. Wrong passphrase or corrupt data.');
  }
}

runBtn.addEventListener('click', async () => {
  const text = messageEl.value.trim();
  const pass = passEl.value;
  if (!text || !pass) {
    resultEl.innerHTML = '<span class="error">Please enter both a message and a passphrase.</span>';
    return;
  }
  resultEl.textContent = 'Working…';
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  try {
    let result;
    if (getMode() === 'encrypt') {
      result = await encrypt(text, pass);
    } else {
      result = await decrypt(text, pass);
    }
    lastResult = result;
    resultEl.textContent = result;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
  } catch (err) {
    resultEl.innerHTML = `<span class="error">${err.message}</span>`;
  }
});

copyBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(lastResult);
    const orig = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = orig, 1500);
  } catch {
    resultEl.innerHTML += '<br><span class="error">Clipboard access denied. Select and copy manually.</span>';
  }
});

downloadBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([lastResult], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = getMode() === 'encrypt' ? 'encrypted.txt' : 'decrypted.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});

// Update button label
document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener('change', () => {
    runBtn.textContent = getMode() === 'encrypt' ? 'Encrypt' : 'Decrypt';
  });
});
runBtn.textContent = 'Encrypt';
