// Asks the owner gate for the elevator numbers. Visitors get nothing.
import { ownerLink } from '../lib/owner-link.js';

export async function ownerModel() {
  let token = '';
  try { token = await ownerLink(); } catch (_) { token = ''; }
  if (!token) return null;
  try {
    const r = await fetch('/api/versus-floor', { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}
