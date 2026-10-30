// The team chat's own routes (/team/join/<code>, /team/mcp) pass through the same defences as every /api route (lib/guard.js): per-connection
// limits, size caps, the brake on wrong keys (a wrong join code is a 401 and counts), no cross-site writes, no CORS.
import { guard } from '../../lib/guard.js';
export const onRequest = guard;
