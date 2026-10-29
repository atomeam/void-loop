// Which sites a versus job may name (owner, 2026-10-29: "its supposed to be all sites ever made smallest first"). A versus job builds a Verse page
// against one site, so it may name only a site of the tower's own ranking: a floor (lib/tower.js FLOORS) or a ranked site of the frontier
// (void-live-deploy/tower.frontier.json, written by tools/easiest-sites.mjs). And never a gambling or crypto site, whatever the ranking says:
// #1470 was a lap on "versus: wheelofgold.com", a site the model itself had called "a crypto rewards and gambling platform" on 2026-10-26, and it
// made "Crypto rewards and gambling" a core feature for Verse to match. The job was queued by tools/tower-self.mjs (a site no floor covers) and
// run days later by tools/verse-job.mjs; both ask here now, the first before it queues and the second before it runs. Pure, no network.
import { hostOf } from '../void-live-deploy/lib/tower.js';

// words that say a site is a gambling or crypto site: by its title, the words the scan kept about it, or a floor's own words. Whole words only, so a
// "cryptography" tool, an "alphabet" page or a meeting "time slot" picker is not caught.
export const OFF_LIMITS = /\b(?:gambl\w*|casinos?|jackpots?|lotter(?:y|ies)|lotto|sweepstakes?|poker|roulette|betting|sportsbooks?|crypto(?:currenc(?:y|ies))?|bitcoin|airdrops?|faucets?|spin (?:to|and) win|slot (?:gacor|online|machines?)|online slots?|megaways)\b/i;

/** the host a versus job names ("versus:a.com:speed" -> "a.com"), else null. Pure. */
export const versusHost = (target) => { const p = String(target || '').split(':'); return p[0].toLowerCase() === 'versus' && p[1] ? p[1].trim().toLowerCase() : null; };

/** the ranking as { hosts: Set, text: Map host -> words about it }: every floor and every ranked frontier site. Pure. */
export function rankingOf({ frontier = null, floors = [], state = {} } = {}) {
  const list = Array.isArray(frontier) ? frontier : frontier && Array.isArray(frontier.sites) ? frontier.sites : [];
  const hosts = new Set(), text = new Map(), add = (h, ...words) => { if (!h) return; hosts.add(h); text.set(h, [text.get(h) || '', ...words].join(' ')); };
  for (const f of floors) add(hostOf(f.url) || hostOf(f.site), f.label, f.ask); // not f.learned: that is what Verse learned ("with crypto" is the Web Crypto API)
  for (const x of list) add(hostOf(x && (x.site || x.host)), x && x.title);
  const seen = (state && state.sites) || {};
  for (const [h, v] of Object.entries(seen)) if (hosts.has(h)) text.set(h, [text.get(h), v && v.title, v && v.why].join(' '));
  return { hosts, text };
}

/** whether a host is a gambling or crypto site by what the ranking and the scan know of it. Pure. */
export const offLimits = (host, ranking) => OFF_LIMITS.test(String((ranking && ranking.text.get(host)) || ''));

/** whether a job may run: { ok: true } for any job that is not a versus job; a versus job only for a ranked site that is not off limits, else
 *  { ok: false, why }. Pure. */
export function versusAllowed(target, ranking) {
  const host = versusHost(target);
  if (!host) return /^versus:/i.test(String(target || '')) ? { ok: false, why: 'names no site' } : { ok: true };
  if (!ranking.hosts.has(host)) return { ok: false, why: host + ' is not in the smallest-first ranking (no floor, not in tower.frontier.json)' };
  if (offLimits(host, ranking)) return { ok: false, why: host + ' is a gambling or crypto site' };
  return { ok: true };
}
