/**
 * incident-autopsy skill - "incident autopsy", "which skill family is unhealthy" (asked by Verse): reads the site's own incidents.json (every red
 * browser suite on main) and places each failing check in a skill family by its name (lib/autopsy.js); a check that matches no skill is listed as
 * unmapped, never guessed. Shows the latest incidents with their commit, a count per family, and "No incidents recorded." when the file is empty.
 * Fetches only the site's own files; no model, no key. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { autopsy, autopsyHtml, ERROR_TINT, REACT_ON } from '../lib/autopsy.js';
import { reactionBar } from '../lib/reaction-bar.js'; // spectators react to an incident; 'confused' and 'pity' wear the warning look (asked by Verse)
const WHEN = /^(?:(?:show|open|give)(?:\s+me)?\s+)?(?:the\s+|an\s+|your\s+)?(?:incident\s+autopsy(?:\s+(?:for|of|in)\s+(?:the\s+)?([a-z0-9][a-z0-9 -]{0,40}?))?|autopsy\s+of\s+(?:the\s+)?(?:failed|failing|red)\s+(?:suites?|checks?|incidents?)|(?:show\s+(?:me\s+)?)?(?:the\s+)?remediation\s+drafts?(?:\s+for\s+the\s+(?:last|latest)\s+incidents?)?|send\s+the\s+root\s+cause\s+to\s+the\s+builders?|which\s+(?:skill\s+)?famil(?:y|ies)\s+(?:is|are)\s+(?:unhealthy|failing|breaking|red))$/i;
const norm = (t) => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim();
// a family named after the autopsy ("incident autopsy for time", the link on a stability sparkline, asked by Verse): its id or its name, from families.json; '' for any other word
const famOf = (text, fam) => { const m = WHEN.exec(norm(text)), w = m && m[1] ? m[1].trim() : '', f = w && ((fam && fam.families) || []).find((x) => x && (String(x.id).toLowerCase() === w || String(x.name || '').toLowerCase() === w)); return f ? String(f.id) : ''; };

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  const head = '<h2>Incident autopsy</h2>';
  const el = showPage((p) => { p.innerHTML = head + '<div class="sub">reading the incidents…</div>'; }); // void-review: ok (constant heading; nothing from a user)
  const get = async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const [inc, fam, guide] = await Promise.all([get('/incidents.json'), get('/skills/families.json'), get('/skills/guide.json')]);
  if (!el || (_pageStill && !_pageStill(el))) return 'incident-autopsy';
  el.innerHTML = head + autopsyHtml(autopsy(inc, fam, guide, famOf(text, fam)), esc) + '<div class="src">Source: incidents.json, written by tools/incident-log.mjs when a browser suite on main fails · families from skills/families.json</div>'; // void-review: ok: autopsyHtml escapes every word with esc
  // a reaction bar under each of the newest incidents (hidden unless /api/react answers; the slug is checked against incidents.json by the route)
  for (const li of [...el.querySelectorAll('li[data-incident]')].slice(0, REACT_ON)) {
    const bar = reactionBar(li.dataset.incident, { tint: ERROR_TINT }); if (!bar) continue;
    bar.style.margin = '4px 0 2px'; const inner = li.querySelector('ul'); li.insertBefore(bar, inner);
  }
  // the root-cause action (asked by Verse): the brief goes to the clipboard, ready for a builder agent; nothing is posted for the visitor
  el.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-builder-brief]'); if (!b) return;
    let ok = false; try { await navigator.clipboard.writeText(b.getAttribute('data-builder-brief')); ok = true; } catch (_) {}
    b.textContent = ok ? 'Copied: paste it to a builder agent or into the issue' : 'Select the steps above to copy them';
  });
  return 'incident-autopsy';
}

// checked by tools/skills-check.mjs on every run: the mapping and the markup on a made-up sample
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fam = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock' }, { name: 'family-health' }] }] };
  const a = autopsy({ incidents: [{ at: '2026-10-17T09:00:00Z', sha: 'abcdef1234', suite: 's', checks: ['clock: "what time" <b>x</b>', 'zzz: nothing'] }] }, fam, { pages: [] });
  const h = autopsyHtml(a, esc);
  const ok = a.families.length === 1 && a.families[0].count === 1 && a.unmapped.length === 1 && h.includes('&lt;b&gt;') && !h.includes('<b>x') && autopsyHtml(autopsy({ incidents: [] }, fam, null), esc).includes('No incidents recorded')
    && h.includes('data-remediation=') && h.includes('test_void.mjs --only') && WHEN.test(norm('Which skill family is unhealthy?')) && !WHEN.test('family health');
  return { ok, got: ok ? '' : h };
}

export default {
  name: 'incident-autopsy',
  examples: ['incident autopsy', 'which skill family is unhealthy', 'autopsy of the failed suites', 'which family is failing', 'show me the incident autopsy', 'incident autopsy for time', 'remediation draft for the last incident', 'send the root cause to the builders'],
  nearMisses: ['autopsy of a frog', 'what is an incident report', 'family health', 'show me your skill families', 'which family is the oldest', 'incident'],
  suite,
  match(lower, text) { return WHEN.test(norm(text || lower)); },
  run,
};
