const status = document.getElementById('status');
const result = document.getElementById('result');
const output = document.getElementById('output');
const canvas = document.getElementById('fp');
const ctx = canvas.getContext('2d');
let currentPrivPem = '';
let currentPub = '';

function bytesToBase64(bytes) {
  let bin = '';
  for (let b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function encodeMpint(bytes) {
  // SSH mpint: 4-byte length + data, with leading zero if high bit set
  let data = new Uint8Array(bytes);
  if (data[0] & 0x80) {
    const padded = new Uint8Array(data.length + 1);
    padded.set(data, 1);
    data = padded;
  }
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length);
  const out = new Uint8Array(4 + data.length);
  out.set(len);
  out.set(data, 4);
  return out;
}

function encodeString(str) {
  const enc = new TextEncoder().encode(str);
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, enc.length);
  const out = new Uint8Array(4 + enc.length);
  out.set(len);
  out.set(enc, 4);
  return out;
}

function makeOpenSSHPublic(rawPub, comment) {
  // rawPub is 32 bytes for Ed25519
  const type = encodeString('ssh-ed25519');
  const key = encodeMpint(rawPub); // actually for ed25519 it's the raw key with length
  // Correct: the key blob is string(type) + string(raw32)
  const keyBlobParts = [encodeString('ssh-ed25519'), encodeStringBytes(rawPub)];
  let keyBlobLen = 0;
  keyBlobParts.forEach(p => keyBlobLen += p.length);
  const keyBlob = new Uint8Array(keyBlobLen);
  let off = 0;
  keyBlobParts.forEach(p => { keyBlob.set(p, off); off += p.length; });
  const b64 = bytesToBase64(keyBlob);
  return `ssh-ed25519 ${b64}${comment ? ' ' + comment : ''}`;
}

function encodeStringBytes(bytes) {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, bytes.length);
  const out = new Uint8Array(4 + bytes.length);
  out.set(len);
  out.set(bytes, 4);
  return out;
}

function pemFromPkcs8(pkcs8) {
  const b64 = bytesToBase64(new Uint8Array(pkcs8));
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

function drawFingerprint(rawPub) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;
  const cells = 16;
  const cw = w / cells, ch = h / cells;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const idx = (i * cells + j) % rawPub.length;
      const v = rawPub[idx];
      const hue = (v * 1.4) % 360;
      const sat = 40 + (v % 60);
      const light = 30 + (v % 40);
      ctx.fillStyle = `hsl(${hue},${sat}%,${light}%)`;
      ctx.fillRect(i * cw, j * ch, cw - 1, ch - 1);
    }
  }
  // Overlay a soft border from first bytes
  ctx.strokeStyle = `hsl(${rawPub[0]},70%,50%)`;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
}

document.getElementById('gen').onclick = async () => {
  status.textContent = 'Generating…';
  try {
    if (!crypto.subtle || !crypto.subtle.generateKey) throw new Error('Web Crypto not available');
    const keyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    );
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const comment = document.getElementById('comment').value.trim();
    currentPub = makeOpenSSHPublic(rawPub, comment);
    currentPrivPem = pemFromPkcs8(pkcs8);
    output.textContent = currentPub;
    drawFingerprint(rawPub);
    result.hidden = false;
    status.textContent = 'Key pair generated locally. Private key ready to download.';
    // Save metadata only (not private) to localStorage
    try {
      localStorage.setItem('verse-ssh-last-pub', currentPub);
      localStorage.setItem('verse-ssh-last-comment', comment);
    } catch (e) { console.debug("lab f752-local-ssh-key-generator:", e); }
  } catch (err) {
    status.textContent = 'Error: ' + err.message + '. Ed25519 may not be supported in this browser.';
    console.error(err);
  }
};

document.getElementById('copyPub').onclick = async () => {
  try {
    await navigator.clipboard.writeText(currentPub);
    status.textContent = 'Public key copied.';
  } catch {
    status.textContent = 'Copy failed – select and copy manually.';
  }
};

document.getElementById('dlPriv').onclick = () => {
  const blob = new Blob([currentPrivPem], { type: 'application/x-pem-file' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'id_ed25519.pem';
  a.click();
  URL.revokeObjectURL(a.href);
  status.textContent = 'Private key downloaded. Keep it secret!';
};

document.getElementById('dlFp').onclick = () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'ssh-fingerprint.png';
  a.click();
  status.textContent = 'Fingerprint PNG downloaded.';
};

// Restore last public if any
try {
  const last = localStorage.getItem('verse-ssh-last-pub');
  if (last) {
    document.getElementById('comment').value = localStorage.getItem('verse-ssh-last-comment') || '';
  }
} catch (e) { console.debug("lab f752-local-ssh-key-generator:", e); }
