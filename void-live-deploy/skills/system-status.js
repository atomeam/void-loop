/**
 * system-status skill: a status card for one named system, flow or address ("status of the invoice automation", "system status for
 * the client portal", "status of https://example.com"). A member of the status family (skills/status-board.js, lists run 9,
 * 2026-11-04): status answers Verse's own health ("system status", "void status"), this answers for a system the ask names.
 * Honest by construction (lists run 9): the first version printed "Running. Last green check: today. No open incidents." for any
 * name, a state nobody had checked. Now an address in the ask is pinged from this browser with status.js's own ping(), and a name
 * with no address says plainly that Verse has no live signal for it yet and what to send so it can check.
 */
import { ping } from './status.js';

// a thing that has a status a card can show: a system, a flow, a site; never an order, a flight, a relationship (status's near misses)
const THING = /\b(?:automation|automations|flow|workflow|pipeline|system|portal|router|bot|integration|job|deploy|build|server|site|website|app|api|service|https?:\/\/\S+|[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)\b/i;
const NOT = /\b(?:my\s+(?:order|package|parcel|application|refund|claim|visa|flight)|flight|order|package|relationship|quo)\b/i;
export function isSystemStatus(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (NOT.test(t)) return false;
  return /^(?:system|automation|workflow)\s+status\s+(?:of|for)\s+\S/i.test(t)
    || /^(?:show|give|get)\s+(?:me\s+)?(?:the\s+)?(?:system|automation)\s+status\s+(?:of|for)\s+\S/i.test(t)
    || (/^status\s+(?:of|for)\s+\S/i.test(t) && THING.test(t.replace(/^status\s+(?:of|for)\s+/i, '')))
    || /^(?:\S+\s+){0,4}automation\s+status\b/i.test(t) && !/^automation\s+status$/i.test(t);
}

export function extractSystem(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = t.match(/\b(?:for|of)\s+(?:the\s+)?(.+)$/i) || t.match(/^(?:the\s+)?(.+?)\s+automation\s+status\b/i);
  return m ? m[1].trim() : 'the system';
}
/** the address to check in an ask, or null: a full http(s) address, or a bare host such as example.com. Pure. */
export function addressOf(text) {
  const s = String(text || ''), full = s.match(/https?:\/\/[^\s"'<>]+/i);
  if (full) return full[0].replace(/[).,!?]+$/, '');
  const host = s.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})(\/[^\s"'<>]*)?\b/i);
  return host ? 'https://' + host[1] + (host[2] || '/') : null;
}
// a no-cors fetch: a site that sends no CORS header still answers, the browser only hides the body; reaching it is what is checked
const reach = (u, o) => fetch(u, { ...o, mode: 'no-cors' }).then(() => ({ ok: true, status: 0 }));

/** the card's HTML for a checked address (r from ping) or for a name with no address (r null). Pure. */
export function cardHtml(esc, system, url, r) {
  const state = url
    ? (r && r.ok ? '<p><b style="color:#4caf50">Reachable</b>: ' + esc(url) + ' answered this browser in ' + r.ms + ' ms, just now.</p>'
      : '<p><b style="color:#e0584a">Not reachable</b>: ' + esc(url) + ' ' + esc((r && r.note) || 'did not answer') + ', just now.</p>')
    : '<p><b>Not connected yet.</b> Verse has no live signal for ' + esc(system) + ', so it shows no state rather than a made-up one. '
      + 'Ask again with its address (for example "status of https://example.com") and Verse checks it from this browser.</p>';
  return '<h2>System status: ' + esc(system) + '</h2>'
    + '<h3>Current state</h3>' + state
    + '<h3>What a status card for it covers</h3><ul>'
    + '<li>The address answers (checked above when one is given)</li>'
    + '<li>Its connected tools respond</li>'
    + '<li>Its automations fire on schedule</li>'
    + '<li>Its status line and docs are current</li>'
    + '</ul>'
    + '<p class="sub">Verse\'s own health is one ask away: "system status".</p>'
    + '<div class="src">Source: ' + (url ? 'a request from this browser' : 'no signal connected') + '</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const system = extractSystem(text), url = addressOf(system);
  const el = showPage((p) => { p.innerHTML = '<h2>System status</h2><div class="sub">' + (url ? 'checking ' + esc(url) : '') + '</div>'; });
  const r = url ? await ping({ name: system, for: 'status', url }, reach) : null;
  el.innerHTML = cardHtml(esc, system, url, r);
  return 'system-status';
}

const EXAMPLES = [
  'system status for the onboarding flow',
  'status of the invoice automation',
  'show system status for client portal',
  'automation status for the support router',
  'status of https://example.com',
];
const NEAR = ['what is the status', 'system health', 'check status', 'status of my order', 'flight status', 'system status'];
export default {
  name: 'system-status',
  examples: EXAMPLES,
  nearMisses: NEAR,
  match(lower, text) { return isSystemStatus(text || lower); },
  run,
  suite() {
    const ok = EXAMPLES.every(isSystemStatus) && !NEAR.some(isSystemStatus);
    return { ok, got: ok ? 'match works' : 'match broke' };
  },
};
