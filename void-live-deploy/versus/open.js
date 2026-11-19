// (lib/versus-floor.js names the sites Versus is measured against, so it is loaded only once the owner gate has said yes.)
// Asks the owner gate for the elevator numbers, then ranks the next fight from the exam, the open wants and the nightly pick. Visitors get nothing.
import { ownerLink } from '../lib/owner-link.js';

async function readJson(path) {
  try {
    const r = await fetch(path, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

// the owner-only files (lib/owner-gate.js) open for scripts and images through a cookie the server sets once the owner check has passed
let cookie = null;
const openFiles = (token) => cookie || (cookie = fetch('/api/owner-cookie', { method: 'POST', headers: { authorization: 'Bearer ' + token }, cache: 'no-store' }).then(() => {}, () => {}));

/** the owner token this browser holds, or '' for anyone else. */
export async function ownerToken() {
  try { return (await ownerLink()) || ''; } catch (_) { return ''; }
}

export async function ownerModel() {
  const token = await ownerToken();
  if (!token) return null;
  try {
    const r = await fetch('/api/versus-floor', { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
    if (!r.ok) return null;
    await openFiles(token);
    const model = await r.json(), { gapText, modelFrom } = await import('../lib/versus-floor.js');
    const [exam, self, nightly] = await Promise.all([readJson('/exam/latest.json'), readJson('/self.json'), readJson('/progress/nightly.json')]);
    return modelFrom(model, gapText({ exam, nightly, wants: self && self.open }));
  } catch (_) { return null; }
}
