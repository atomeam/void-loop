// functions/api/aurora.js's brain: read NOAA's planetary K-index once, answer { kp, at } or { kp: null }. No input from the caller at all.
import { parseKp } from '../skills/aurora.js';
export const FEED = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
export const FRESH_S = 15 * 60;
export async function readKp(fetcher = fetch) {
  try {
    const res = await fetcher(FEED, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
    if (!res.ok) return { kp: null };
    const text = await res.text();
    if (text.length > 200000) return { kp: null }; // the feed is a few kilobytes; anything much bigger is not it
    return parseKp(JSON.parse(text)) || { kp: null };
  } catch (_) { return { kp: null }; }
}
