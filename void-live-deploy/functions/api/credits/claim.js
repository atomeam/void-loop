// POST /api/credits/claim claims or spends internal credits. GET is this member's balance. lib/credits.js.
import { onClaimGet, onClaimPost } from '../../../lib/credits.js';
export const onRequestGet = onClaimGet;
export const onRequestPost = onClaimPost;
