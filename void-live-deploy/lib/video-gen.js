// The AI video page's rules (owner, 2026-10-30: "same with image and video ... we should have the best of everything"), shared by the page
// (/video/) and its server half (functions/api/clip.js). The clip comes from a partner video model on Workers AI (lib/studio.js videoAskOf),
// billed in dollars from the account's AI Gateway credits, so the page is off until a real test clip has worked: never a sample or a stand-in.
// Pure: no fetch, no storage. Tests: tools/video-gen.test.mjs.
import { cleanLine, refusalOf } from './image-gen.js';

export const PROMPT_MAX = 400;
/** the lengths a visitor picks, in seconds: short drafts, so the day's dollars make many clips */
export const SECONDS = Object.freeze([2, 3, 5]);
/** the shapes, named as /image/ names them, and the partner model's aspect for each */
export const ASPECTS = Object.freeze({ landscape: '16:9', portrait: '9:16', square: '1:1' });
/** clips a minute and a day from one connection (keyed like /image/: a hash of the address, the day and the SALT secret) */
export const PER_MINUTE = 2, PER_CONN = 3;
/** dollars a day for everyone's clips, unless PUBLIC_VIDEO_DAILY_USD says otherwise (never more than MAX_PUBLIC_USD) */
export const PUBLIC_DAILY_USD = 0.25, MAX_PUBLIC_USD = 2;
/** the self-check: one 1 second draft clip (half a cent) while video is off, at most once every PROBE_EVERY_MS, inside PROBE_DAILY_USD */
export const PROBE_SECONDS = 1, PROBE_DAILY_USD = 0.02, PROBE_EVERY_MS = 6 * 3600e3;
export const PROBE_PROMPT = 'a small paper boat floating on a calm pond, gentle ripples, soft daylight, safe for work';

export const secondsOf = (x) => (SECONDS.includes(Number(x)) ? Number(x) : 3);
export const shapeOf = (k) => (typeof k === 'string' && Object.hasOwn(ASPECTS, k) ? k : 'landscape');
/** the day's public dollar cap from the environment: a number from 0 to MAX_PUBLIC_USD, else the default. Pure. */
export function publicCapOf(env) {
  const raw = env && env.PUBLIC_VIDEO_DAILY_USD, n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_PUBLIC_USD) : PUBLIC_DAILY_USD;
}
/** whether a model's error says the account has no AI Gateway credits (live, 2026-10-30: "2021: Insufficient AI Gateway credits"). Pure. */
export const noCredits = (why) => /insufficient[^.]{0,40}credits|\b2021\b/i.test(String(why || ''));

/** the visitor's words, or the reason they get no clip ('empty', 'secret', 'unsuitable', ...): the same checks as /image/. Pure. */
export function promptCheck(text, isSecret = () => false) {
  const prompt = cleanLine(text, PROMPT_MAX);
  const why = refusalOf(prompt, '', 'none', isSecret);
  return why ? { why } : { prompt };
}

/** what the stored self-check row says: { on, why, at, due }. No row yet: off and due. Off rows are due again after PROBE_EVERY_MS. Pure. */
export function stateOf(row, now = Date.now()) {
  if (!row) return { on: false, why: 'unchecked', at: 0, due: true };
  const on = Number(row.on) === 1, at = Number(row.at) || 0;
  return { on, why: String(row.why || (on ? 'ok' : 'unchecked')), at, due: !on && now - at >= PROBE_EVERY_MS };
}
/** the stored row after one test clip: on only when a real clip came back. Pure. */
export function afterProbe(result, now = Date.now()) {
  const r = result || {};
  if (r.state === 'video' && r.real) return { on: 1, why: 'ok', at: now };
  if (r.state === 'resting') return { on: 0, why: 'cap', at: now };
  if (noCredits(r.why)) return { on: 0, why: 'credits', at: now };
  return { on: 0, why: 'failed', at: now };
}

/** what the page says, by reason */
export const SAYS = Object.freeze({
  credits: 'Video turns on when credits are added. Verse checks by itself every few hours and turns this page on after its first real test clip.',
  unchecked: 'Verse has not tested the video maker yet. It checks by itself, and this page turns on after the first real test clip.',
  failed: 'The video maker did not answer its last test. Verse tries again by itself every few hours.',
  cap: 'Today\'s video budget is used up. It comes back at midnight UTC.',
  off: 'Video is off on this deploy right now.',
  mine: 'That is all the clips one person can make today. More tomorrow.',
  slow: 'One clip at a time, please. Try again in a minute.',
  busy: 'The video maker did not finish that clip. Try again in a minute.',
  gone: 'That picture is no longer in today\'s list. Make it again on the image page, then press Animate this.',
  empty: 'Type what should happen in the clip first.',
  secret: 'That looks like a key or a password, so I left it alone.',
  unsuitable: 'I don\'t make that kind of video.',
  person: 'I don\'t make videos of real people. Try a made-up character.',
  kept: 'I don\'t make that kind of video.',
});
export const sayOf = (why) => SAYS[why] || SAYS.busy;
