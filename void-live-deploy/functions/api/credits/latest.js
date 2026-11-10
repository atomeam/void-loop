// GET /api/credits/latest: the public claim feed. Names are masked. No address, no account id, no email. lib/credits.js.
import { onLatestGet } from '../../../lib/credits.js';
export const onRequestGet = onLatestGet;
