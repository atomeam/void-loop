// Asks the owner gate for the elevator numbers, then ranks the next fight from the exam, the open wants and the nightly pick. Visitors get nothing.
import { ownerLink } from '../lib/owner-link.js';
import { gapText, modelFrom } from '../lib/versus-floor.js';

async function readJson(path) {
  try {
    const r = await fetch(path, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

export async function ownerModel() {
  let token = '';
  try { token = await ownerLink(); } catch (_) { token = ''; }
  if (!token) return null;
  try {
    const r = await fetch('/api/versus-floor', { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
    if (!r.ok) return null;
    const model = await r.json();
    const [exam, self, nightly] = await Promise.all([readJson('/exam/latest.json'), readJson('/self.json'), readJson('/progress/nightly.json')]);
    return modelFrom(model, gapText({ exam, nightly, wants: self && self.open }));
  } catch (_) { return null; }
}
