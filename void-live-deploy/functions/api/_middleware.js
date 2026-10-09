// Every /api route passes through Void's defences first (lib/guard.js): per-connection limits, size caps, a brake on
// wrong keys, no cross-site writes, no CORS. Retired routes (/api/memory/context, /api/ingest, /api/attest) stay dead:
// nothing here serves them, GET still falls through to the empty page and POST is refused. (/api/memory itself, owner-only and added
// 2026-10-06 for what Void remembers, is a different route from the retired /api/memory/context, which is still not served.)
import { guard } from '../../lib/guard.js';
export const onRequest = guard;
