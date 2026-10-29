async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const classText = 'local-map-not-sense:sealed-channel-class:visual-to-auditory-proxy:refusal-of-replacement';
const discarded = 'this substitutes for or restores the original sense'; // discarded, not hashed

async function update() {
  const id = await sha256(classText);
  document.getElementById('hash').textContent = id;
}

document.getElementById('rehash').addEventListener('click', update);
update();
