// Every /api route passes through Void's defences first (lib/guard.js): per-connection limits, size caps, a brake on
// wrong keys, no cross-site writes, no CORS. Retired routes (/api/memory/context, /api/ingest, /api/attest) stay dead:
// nothing here serves them, GET still falls through to the empty page and POST is refused.
import { guard } from '../../lib/guard.js';
export const onRequest = guard;
