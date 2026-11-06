// GET /api/paypal: what Verse sells through PayPal checkout (functions/api/paypal/review.js serves the calls themselves).
import { catalog } from './review.js';
export const onRequestGet = catalog;
