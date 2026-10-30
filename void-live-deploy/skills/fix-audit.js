/**
 * fix-audit skill - "audit your fixes", "post-fix audit", "fix evidence audit", "did your fixes break anything" (asked by Verse): every fix
 * in the growth ledger with the evidence rating of each skill it names (current or predating the fix) and any failing check in a different
 * family within 48 hours after it, plus whether the /fix/ pages can move the friction line (lib/fix-audit.js). Own files only, no model.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { auditOf, auditHtml } from '../lib/fix-audit.js';
const YOUR = "(?:your|(?:verse|v01d|void)'?s)";
const WHEN = new RegExp('^(?:(?:run|show|open|do)(?: me)? (?:the |a |' + YOUR + ' )?)?(?:audit ' + YOUR + ' (?:fixes|fixed skills)|post[- ]fix audit|fix(?:es)? (?:evidence )?audit|evidence audit(?: of ' + YOUR + ' fixe?d? skills| of the fixed skills)?|did ' + YOUR.replace("your|", "your|") + ' fixes break anything|did (?:the|your) fixes break (?:anything|another family|other skills)|are (?:the|your) /?fix/? pages (?:reducing|lowering|cutting) (?:the )?friction)$');
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[\u2019]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const get = async (u, text) => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? (text ? await r.text() : await r.json()) : null; } catch (_) { return null; } };
async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Fix audit</h2><div class="sub">reading my fixes…</div>'; }); // void-review: ok (constant)
  const [ledger, fam, inc, fix] = await Promise.all([get('/void.growth.json'), get('/skills/families.json'), get('/incidents.json'), get('/fix/', true)]);
  if (!el || (_pageStill && !_pageStill(el))) return 'fix-audit';
  if (!ledger || !fam) { el.innerHTML = '<h2>Fix audit</h2><p>I could not read my ledger or my ratings just now, so I will not guess.</p>'; return 'fix-audit'; }
  const pages = fix ? new Set([...fix.matchAll(/href="(?:\/fix\/|\.\/)?([a-z0-9-]{6,})\/?"/g)].map((m) => m[1])).size || null : null;
  el.innerHTML = auditHtml(auditOf(ledger, fam, inc || { incidents: [] }), esc, { fixPages: pages }); // void-review: ok: auditHtml escapes every value
  return 'fix-audit';
}
export default {
  name: 'fix-audit',
  about: 'Every fix I made, whether the fixed skill was re-rated after it, and whether it broke a skill in another family.',
  examples: ['audit your fixes', 'post-fix audit', 'fix evidence audit', 'did your fixes break anything', 'evidence audit of the fixed skills', 'are the fix pages reducing friction'],
  nearMisses: ['fix my bike', 'audit my taxes', 'fix this code', 'post a fix', 'evidence of climate change'],
  match(lower, text) { return WHEN.test(CLEAN(text || lower)); },
  run,
};
