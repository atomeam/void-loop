// The gate badge (owner, 2026-10-28, via the lead agent: every floor says honestly what beating it takes). Each floor of the tower carries one:
//   Code     software Verse can build now, on the device or on its own server
//   Partner  the real thing needs a licensed partner or a partner's API (live fares, a payments processor, a licensed data feed, video owners)
//   License  the real thing needs a licence of Verse's own (a music streaming catalogue)
// A regulated floor (money, government, health, food, travel tickets, betting) also has a stage: 1 on-device prep and the maths, then a hand-off
// to the official service; 2 a partner bridge; 3 a direct licence. Today no partner or licence exists, so every regulated floor stands at stage 1,
// and the build queue (lib/tower.js) picks only Code work or stage 1 on a regulated floor: nothing is faked past what is real.
// Keyed by the floor id (a lane site by its leader too), else by words in the site's host. Pure.

/** floors whose real version needs a partner or a licence, by floor id: [gate, why] */
export const GATED = Object.freeze({
  shopping: ['Partner', 'selling and shipping goods needs a payments processor and sellers'],
  travel: ['Partner', 'live fares and tickets come from airlines and a fare partner'],
  finance: ['Partner', 'real-time exchange prices are licensed data; free quotes may be delayed'],
  video: ['Partner', 'other people\'s videos are shown only through their owners\' players'],
  music: ['License', 'streaming a music catalogue needs a licence'],
  sports: ['Partner', 'live scores and match data come from a data partner'],
  jobs: ['Partner', 'job posts come from the boards and employers that publish them'],
});
// lane sites that are plain software even though their lane leader is gated (a metronome needs no music licence)
const LANE_CODE = /^(music|travel|finance|sports|jobs): /;
/** regulated work, by floor id or by words in a host: [why] */
export const REGULATED_IDS = Object.freeze({ shopping: 'taking payments', travel: 'selling air tickets' });
export const REGULATED_RE = /\b(bank|banking|credit ?union|loan|lending|mortgage|insurance|insurer|tax|irs|hmrc|gov|government|dmv|passport|visa|health|clinic|pharmacy|medical|doctor|food ?delivery|grocer|doordash|ubereats|grubhub|instacart|brokerage|trading|exchange|payments?|paypal|venmo|wallet|lottery|betting|casino|gambl\w*)\b/i;
export const STAGES = Object.freeze({ 1: 'on-device prep and the maths, then a hand-off to the official service', 2: 'a partner bridge', 3: 'a direct licence' });

// a site on a government domain that only publishes open data (the forecast) is not regulated work
const OPEN_DATA = new Set(['weather']);
const hostWords = (f) => String((f && (f.url || f.site)) || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[./-]+/g, ' ');

/** one floor's badge: { gate: 'Code'|'Partner'|'License', why, regulated, stage (1-3, regulated floors only), stageWhy }. Pure. */
export function badgeOf(f) {
  const id = String((f && f.id) || ''), lead = String((f && f.lane) || '');
  const g = LANE_CODE.test(id) ? null : GATED[id] || null;
  const regWhy = REGULATED_IDS[id] || (lead && !LANE_CODE.test(id) && REGULATED_IDS[lead]) || ((hostWords(f) + ' ' + id).match(REGULATED_RE) || [])[0] || '';
  const regulated = !!regWhy && !OPEN_DATA.has(id) && !OPEN_DATA.has(lead);
  const gate = (f && f.gateBadge) || (g ? g[0] : regulated ? 'Partner' : 'Code');
  const stage = regulated ? Math.min(3, Math.max(1, Number(f && f.stage) || 1)) : null;
  return { gate, why: g ? g[1] : regulated ? 'regulated: ' + regWhy : 'software Verse can build now', regulated, stage, stageWhy: stage ? STAGES[stage] : '' };
}
/** the badge as a person reads it: "[Gate: Code]" or "[Gate: Partner] · Stage 1". Pure. */
export const badgeText = (b) => '[Gate: ' + b.gate + ']' + (b.stage ? ' · Stage ' + b.stage : '');
/** whether the build queue may pick a floor: Code work, or stage 1 on a regulated floor. Pure. */
export const buildable = (b) => !!b && (b.gate === 'Code' || (b.regulated && b.stage === 1));
