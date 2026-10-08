/**
 * trialwatch skill — which longevity results are being repeated, live from the primary registry (domains/void.growth.md,
 * Next [think-tank] "live longevity trial watch"). Reads the ClinicalTrials.gov API v2 from the browser (open to any
 * origin) for a fixed watchlist and shows each trial's title, status, enrollment, primary-completion date, whether
 * results are posted, and a link to the record, with the date and time of the check. Each good check is kept in this
 * browser; with the network off the card shows that last snapshot and its date. The honest companion to the senolytic
 * MASH card. "trial watch", "longevity trials", "is anyone repeating the senolytic liver trial".
 */
export const API = 'https://clinicaltrials.gov/api/v2/studies/';
export const SNAP_KEY = 'a2m.trialwatch.v1';
export const WATCH = [
  { topic: 'Senolytics in fatty liver (MASH)', ids: ['NCT05506488'], note: 'No follow-up senolytic liver trial is registered yet.' },
  { topic: 'Senolytics in frailty with HIV', ids: ['NCT07144293'] },
  { topic: 'GLP-1 drugs and DNA-methylation age', ids: ['NCT07220473', 'NCT07707778', 'NCT07293325'] },
  { topic: 'Rapamycin', ids: ['NCT06727305', 'NCT07191353'] },
];

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show(?:\s+me)?|open|check)\s+(?:the\s+)?)?(?:(?:longevity\s+)?trial\s+watch|longevity\s+trials|longevity\s+trial\s+watch)$|^(?:is\s+anyone|is\s+anybody|has\s+anyone)\s+(?:repeating|replicating|redoing)\s+the\s+senolytic\s+(?:liver|mash|nash)\s+trial$/;
export function trialwatchOf(text) { return ASK_RE.test(CLEAN(text)); }

// one registry record (API v2 JSON) to a row; missing parts become null, never a guess
export function rowOf(id, j) {
  const p = (j && j.protocolSection) || {}, idm = p.identificationModule || {}, st = p.statusModule || {}, d = p.designModule || {};
  return {
    id,
    title: idm.briefTitle || idm.officialTitle || null,
    status: st.overallStatus ? String(st.overallStatus).replace(/_/g, ' ').toLowerCase() : null,
    enrollment: d.enrollmentInfo && d.enrollmentInfo.count != null ? +d.enrollmentInfo.count : null,
    primaryCompletion: (st.primaryCompletionDateStruct && st.primaryCompletionDateStruct.date) || null,
    results: j && typeof j.hasResults === 'boolean' ? j.hasResults : null,
    href: 'https://clinicaltrials.gov/study/' + id,
  };
}

async function fetchOne(id, fetchFn, ms) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), ms);
  try { const r = await fetchFn(API + id, ctl ? { signal: ctl.signal } : undefined); if (!r.ok) throw new Error('HTTP ' + r.status); return rowOf(id, await r.json()); }
  finally { if (t) clearTimeout(t); }
}
/** Check every watchlist trial. Resolves to { at, rows, failed } (rows that answered; ids that did not). */
export async function check(fetchFn = (u, o) => fetch(u, o), now = () => new Date(), ms = 8000) {
  const ids = WATCH.flatMap((w) => w.ids), got = await Promise.allSettled(ids.map((id) => fetchOne(id, fetchFn, ms)));
  const rows = {}, failed = [];
  got.forEach((g, i) => { if (g.status === 'fulfilled') rows[ids[i]] = g.value; else failed.push(ids[i]); });
  return { at: now().toISOString(), rows, failed };
}
function loadSnap() { try { const s = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); return s && s.at && s.rows ? s : null; } catch (_) { return null; } }
function saveSnap(s) { try { localStorage.setItem(SNAP_KEY, JSON.stringify(s)); } catch (_) {} }

const when = (iso) => { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export function trialwatchHtml(esc, data, from) {
  const head = from === 'live' ? 'Checked live from ClinicalTrials.gov on ' + when(data.at) : from === 'snapshot' ? 'ClinicalTrials.gov could not be reached; showing the last check, from ' + when(data.at) : '';
  return '<h2>Longevity trial watch</h2><div class="sub">' + esc(head) + '</div>'
    + WATCH.map((w) => '<h3 style="margin:14px 0 4px;font-size:15px">' + esc(w.topic) + '</h3>'
      + (w.note ? '<p>' + esc(w.note) + '</p>' : '')
      + '<ul>' + w.ids.map((id) => { const r = data.rows[id];
        if (!r) return '<li><a href="https://clinicaltrials.gov/study/' + esc(id) + '" target="_blank" rel="noopener">' + esc(id) + '</a> · <span style="color:#8a8a92">no answer from the registry in this check</span></li>';
        const bits = [r.status && r.status, r.enrollment != null && r.enrollment + ' enrolled', r.primaryCompletion && 'primary completion ' + r.primaryCompletion, r.results === true ? 'results posted' : r.results === false ? 'no results posted' : null].filter(Boolean);
        return '<li><a href="' + esc(r.href) + '" target="_blank" rel="noopener">' + esc(id) + '</a> ' + esc(r.title || '') + '<br><span style="color:#8a8a92">' + esc(bits.join(' · ')) + '</span></li>'; }).join('') + '</ul>').join('')
    + '<div class="src">Source: the ClinicalTrials.gov registry (the primary record for each trial). A trial being registered or recruiting says nothing yet about whether it works.</div>';
}

async function run(text, api) {
  if (!trialwatchOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Longevity trial watch</h2><div class="sub">checking ClinicalTrials.gov…</div>'; });
  let data = null;
  try { data = await check(); } catch (_) { data = null; }
  const live = data && Object.keys(data.rows).length > 0;
  if (live) { saveSnap({ at: data.at, rows: data.rows }); el.innerHTML = trialwatchHtml(esc, data, 'live'); return 'trialwatch'; }
  const snap = loadSnap();
  if (snap) { el.innerHTML = trialwatchHtml(esc, snap, 'snapshot'); return 'trialwatch'; }
  el.innerHTML = '<h2>Longevity trial watch</h2><p>ClinicalTrials.gov could not be reached just now, and this browser has no earlier check saved. Ask again in a moment.</p>'
    + '<p style="color:#8a8a92">Watching: ' + esc(WATCH.flatMap((w) => w.ids).join(', ')) + '.</p>';
  return 'trialwatch';
}

export default {
  name: 'trialwatch',
  examples: ['trial watch', 'longevity trials', 'longevity trial watch', 'is anyone repeating the senolytic liver trial'],
  nearMisses: ['what is a clinical trial', 'watch a trial', 'longevity tips', 'trial and error', 'smart watch trial'],
  trialwatchOf,
  match(lower, text) { return trialwatchOf(text); },
  run,
};
