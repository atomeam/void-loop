// GET /api/x402: what Verse sells per call over x402 (functions/api/x402/review.js serves the calls themselves).
import { catalog } from './review.js';
export const onRequestGet = catalog;
