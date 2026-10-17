// "Suggest fix" on a correction (asked by Void: a button next to each entry of the self card's correction log, wired to the EXISTING propose-fix
// tool, lib/propose-fix.js and the owner-only /api/propose-fix route, frontier #28 step 3; no new route). It is for the owner only: the page draws the
// button only with the owner key (logHtml's `owner`), this module refuses without it, and the route checks the key again (ownerOk). What leaves
// the page is exactly: the skill's name, the family's id (from the families file, not typed), the ask run through redact(), the skill's own public
// file (which the route needs to read the matcher), and a fixed sentence. The visitor's own words (the correction text) are never sent.
// The click only drafts a proposal (line edits that passed the route's gate): nothing is applied here; a builder or tools/propose-fix.mjs opens
// the pull request, and Void's review and automerge gates still apply. What was sent and what came back are shown. Pure apart from the fetch it is handed.
import { redact } from './automation-fix.js';
import { familyMap } from './corrections.js';
export const FIX_ROUTE = '/api/propose-fix';
const ASK_MAX = 160;

/** true only with a non-empty owner key. The server checks the key again; this keeps the button out of everyone else's page. Pure. */
export function ownerOnly(ownerKey) { return typeof ownerKey === 'string' && ownerKey.trim().length > 0; }

/** the request body for one correction, or null when it names no skill or no ask. Never contains `entry.text`. Pure. */
export function fixRequest(entry, fam, source) {
  const skill = entry && /^[a-z][a-z0-9-]{1,40}$/.test(String(entry.skill || '')) ? entry.skill : '';
  const ask = redact(String((entry && entry.ask) || '')).replace(/\s+/g, ' ').trim().slice(0, ASK_MAX);
  if (!skill || ask.length < 3) return null;
  const f = familyMap(fam).get(skill), family = f ? f.id : '';
  return { ask, skill, mode: 'narrow', source: String(source || ''), said: 'Marked wrong from the self card correction log' + (family ? ' (family: ' + family + ')' : '') + '.' };
}

/** what was sent, in words, for the person to read (the source file is named, not repeated). Pure. */
export function sentWords(req) {
  return 'Sent to /api/propose-fix: skill ' + req.skill + (/family: ([a-z0-9-]+)/.exec(req.said) ? ', family ' + /family: ([a-z0-9-]+)/.exec(req.said)[1] : '') + ', the ask "' + req.ask + '" (secrets masked), and the skill\'s public file. Your own words were not sent.';
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** what came back, as markup (every word escaped): the proposal's why, confidence and edits, or the plain reason it failed. Pure. */
export function resultHtml(sent, got, esc = escHtml) {
  const head = '<div class="sub">' + esc(sent) + '</div>';
  if (!got || !got.ok) return head + '<div class="sub" data-fix-error="1">No proposal: ' + esc(got && got.error || 'it did not answer') + '</div>';
  const j = got.json || {};
  const edits = Array.isArray(j.edits) ? j.edits.slice(0, 4) : [];
  return head + '<div class="sub" data-fix-proposal="1">V01D proposes ' + esc(edits.length) + ' line change' + (edits.length === 1 ? '' : 's') + (Number.isFinite(+j.confidence) ? ', sure to ' + esc(Math.round(+j.confidence * 100)) + '%' : '') + ': ' + esc(j.why || '') + '</div>'
    + edits.map((e) => '<pre style="white-space:pre-wrap;font-size:12px;margin:2px 0">' + esc('- ' + e.find + '\n+ ' + e.replace) + '</pre>').join('')
    + '<div class="sub">A draft only: nothing was changed. A builder opens it as a pull request, and Void\'s review decides.</div>';
}

async function callRoute(skillName, build, { owner, fetchFn }) {
  if (!ownerOnly(owner)) return { sent: '', got: { ok: false, error: 'only the owner can ask for a fix' } };
  try {
    const sk = await fetchFn('/skills/' + encodeURIComponent(String(skillName || '')) + '.js');
    if (!sk.ok) return { sent: '', got: { ok: false, error: 'this skill has no file of its own (it is answered inside the page), so there is nothing to fix here' } };
    const req = build(await sk.text());
    if (!req) return { sent: '', got: { ok: false, error: 'this names no skill or ask' } };
    const r = await fetchFn(FIX_ROUTE, { method: 'POST', headers: { authorization: 'Bearer ' + owner.trim(), 'content-type': 'application/json' }, body: JSON.stringify(req) });
    const sent = sentWords(req);
    if (!r.ok) return { sent, got: { ok: false, error: r.status === 401 ? 'the owner key was not accepted' : (await r.text().catch(() => '')).slice(0, 160) || 'HTTP ' + r.status } };
    return { sent, got: { ok: true, json: await r.json() } };
  } catch (e) { return { sent: '', got: { ok: false, error: 'the request failed' } }; }
}

/**
 * Ask the existing route for a proposal for one correction. `owner` is the owner key (refused when empty), `fetchFn` is fetch. Resolves
 * { sent, got } with got = { ok, json } or { ok: false, error }; never throws.
 */
export function suggestFix(entry, fam, opts) { return callRoute(entry && entry.skill, (src) => fixRequest(entry, fam, src), opts); }

/** the request for a failing check of the incident autopsy (lib/autopsy.js): the mapped skill, its family and the check's name (redact()ed), nothing else. Pure. */
export function incidentRequest(check, fam, source) {
  const skill = check && /^[a-z][a-z0-9-]{1,40}$/.test(String(check.skill || '')) ? check.skill : '';
  const name = redact(String((check && check.text) || '').split(':')[0]).replace(/\s+/g, ' ').trim().slice(0, ASK_MAX);
  if (!skill || name.length < 3) return null;
  const f = familyMap(fam).get(skill);
  return { ask: name, skill, mode: 'learn', source: String(source || ''), said: 'Failing browser-suite check recorded in incidents.json' + (f ? ' (family: ' + f.id + ')' : '') + '.' };
}
/** the owner's "Suggest fix" for a failing check: the same existing route, a draft only. Never throws. */
export function suggestIncidentFix(check, fam, opts) { return callRoute(check && check.skill, (src) => incidentRequest(check, fam, src), opts); }
