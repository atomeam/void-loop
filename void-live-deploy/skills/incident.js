/**
 * incident skill — write an incident brief, the blameless way (domains/void.assimilate.md, ask "write an incident brief":
 * timeline, impact, cause if known, next steps). "write an incident brief", "incident report for the login outage",
 * "postmortem template", "write a postmortem for the checkout outage".
 * One card: status, severity (SEV1-4 in plain words), the four moments (started, detected, mitigated, resolved) with time
 * to detect / mitigate / resolve worked out, impact, a timeline, the cause (or "not known yet"), next steps with owners,
 * and a live Markdown copy to paste wherever the team keeps them. Blameless: it asks what happened and what will change,
 * never who is at fault (the postmortem culture in Google's SRE book). Nothing is sent anywhere; the draft stays in this
 * browser (a2m.void.incident.v1) until "clear".
 */
const KEY = 'a2m.void.incident.v1';
export const SEVERITY = [
  ['SEV1', 'critical: the service is down or data is at risk for many people'],
  ['SEV2', 'major: a core feature is broken or badly degraded for many people'],
  ['SEV3', 'minor: a feature is degraded for some people, with a workaround'],
  ['SEV4', 'low: little or no effect on people; worth learning from'],
];
export const STATUS = ['investigating', 'mitigated', 'resolved'];

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WHAT = '(?:incident\\s+(?:brief|report|review|summary|write-?up)|post-?mortem|post[\\s-]incident\\s+review|outage\\s+(?:report|brief|summary|write-?up))';
const ASK_RE = new RegExp('^(?:please\\s+)?(?:(?:help\\s+me\\s+)?(?:write|draft|start|make|create|do|open)\\s+(?:me\\s+)?(?:an?\\s+|the\\s+|our\\s+)?)?' + WHAT + '(?:\\s+template)?(?:\\s+(?:for|about|on)\\s+(.+?))?(?:\\s*:\\s*(.+))?$', 'i');
/** { title } when the ask wants an incident brief (title from "for the login outage" or after a colon), else null. */
export function incidentOf(text) {
  const t = CLEAN(text), m = ASK_RE.exec(t);
  if (!m) return null;
  // a bare "postmortem" can mean an autopsy: it needs a verb, "template", "for …" or a colon to be an incident brief
  if (/^post-?mortem$/i.test(t)) return null;
  const raw = (m[1] || m[2] || '').replace(/^(?:the|our|a|an)\s+/i, '').trim();
  return { title: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '' };
}

/** Minutes between two datetime-local strings ("2026-10-08T14:05"), or null when either is missing or out of order. */
export function minutesBetween(a, b) {
  const x = Date.parse(a), y = Date.parse(b);
  return isFinite(x) && isFinite(y) && y >= x ? Math.round((y - x) / 60000) : null;
}
export function span(min) {
  if (min == null) return '';
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return h < 48 ? h + ' h' + (m ? ' ' + m + ' min' : '') : Math.round(h / 24 * 10) / 10 + ' days';
}
/** Time to detect, to mitigate and to resolve, each counted from when it started. */
export function durations(s) {
  return { detect: minutesBetween(s.started, s.detected), mitigate: minutesBetween(s.started, s.mitigated), resolve: minutesBetween(s.started, s.resolved) };
}
const when = (v) => (v ? v.replace('T', ' ') : '');

/** The brief as Markdown: only what was filled in, with the cause marked "not known yet" until it is. */
export function briefMarkdown(s) {
  const d = durations(s), sev = SEVERITY.find((x) => x[0] === s.severity), L = [];
  L.push('# Incident brief: ' + (s.title || 'untitled'));
  L.push('', '**Status:** ' + (s.status || 'investigating') + (sev ? ' · **Severity:** ' + sev[0] + ' (' + sev[1] + ')' : ''));
  const times = [['Started', s.started], ['Detected', s.detected, d.detect, 'to detect'], ['Mitigated', s.mitigated, d.mitigate, 'to mitigate'], ['Resolved', s.resolved, d.resolve, 'to resolve']].filter((x) => x[1]);
  if (times.length) { L.push('', '## When'); times.forEach((x) => L.push('- ' + x[0] + ': ' + when(x[1]) + (x[2] != null ? ' (' + span(x[2]) + ' ' + x[3] + ')' : ''))); }
  L.push('', '## Impact', (s.impact || '').trim() || '_Who or what was affected, how many, for how long._');
  const tl = (s.timeline || []).filter((r) => (r.at || r.what || '').trim());
  if (tl.length) { L.push('', '## Timeline'); tl.forEach((r) => L.push('- ' + (r.at ? when(r.at) + ' ' : '') + (r.what || '').trim())); }
  L.push('', '## Cause', (s.cause || '').trim() || '_Not known yet._');
  const nx = (s.next || []).filter((r) => (r.what || '').trim());
  L.push('', '## Next steps');
  if (nx.length) nx.forEach((r) => L.push('- [ ] ' + r.what.trim() + (r.owner ? ' (owner: ' + r.owner.trim() + ')' : '') + (r.due ? ' (due ' + r.due + ')' : '')));
  else L.push('_What will change so this does not happen again, each with an owner._');
  L.push('', '_Blameless: this records what happened and what will change, not who is at fault._');
  return L.join('\n') + '\n';
}

const blank = (title) => ({ title: title || '', status: 'investigating', severity: '', started: '', detected: '', mitigated: '', resolved: '', impact: '', cause: '', timeline: [{ at: '', what: '' }], next: [{ what: '', owner: '', due: '' }] });
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && typeof s === 'object' && Array.isArray(s.timeline) && Array.isArray(s.next) ? s : null; } catch (_) { return null; } }
function save(s) { try { if (JSON.stringify(s) === JSON.stringify(blank(''))) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} } // an empty form leaves nothing behind

const IN = 'font:inherit;color:inherit;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:5px 8px;box-sizing:border-box';
function formHtml(esc, s) {
  const f = (k, label, type) => '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#8a8a92">' + esc(label) + '<input data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(s[k] || '') + '" style="' + IN + '"></label>';
  const ta = (k, label, ph) => '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#8a8a92">' + esc(label) + '<textarea data-k="' + k + '" rows="2" placeholder="' + esc(ph) + '" style="' + IN + '">' + esc(s[k] || '') + '</textarea></label>';
  const sel = (k, label, opts) => '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#8a8a92">' + esc(label) + '<select data-k="' + k + '" style="' + IN + '">' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (s[k] === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
  const rows = (list, key, cols) => list.map((r, i) => '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:3px 0">' + cols.map(([c, ph, type, w]) => '<input data-list="' + key + '" data-i="' + i + '" data-c="' + c + '" type="' + (type || 'text') + '" placeholder="' + esc(ph) + '" value="' + esc(r[c] || '') + '" style="' + IN + ';flex:' + (w || '1 1 160px') + '">').join('') + '</div>').join('');
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0">'
    + f('title', 'what broke') + sel('status', 'status', STATUS.map((x) => [x, x])) + sel('severity', 'severity', [['', 'not set']].concat(SEVERITY.map(([k, d]) => [k, k + ' · ' + d.split(':')[0]])))
    + f('started', 'started', 'datetime-local') + f('detected', 'detected', 'datetime-local') + f('mitigated', 'mitigated', 'datetime-local') + f('resolved', 'resolved', 'datetime-local') + '</div>'
    + '<div class="inc-durations" style="color:#8a8a92;font-size:12px;min-height:1.2em"></div>'
    + ta('impact', 'impact', 'who or what was affected, how many, for how long')
    + '<div style="font-size:12px;color:#8a8a92;margin-top:8px">timeline</div>' + rows(s.timeline, 'timeline', [['at', 'when', 'datetime-local', '0 0 190px'], ['what', 'what happened']]) + '<button type="button" data-add="timeline">add a line</button>'
    + ta('cause', 'cause', 'not known yet')
    + '<div style="font-size:12px;color:#8a8a92;margin-top:8px">next steps</div>' + rows(s.next, 'next', [['what', 'what will change'], ['owner', 'owner', 'text', '0 1 120px'], ['due', 'due', 'date', '0 0 150px']]) + '<button type="button" data-add="next">add a step</button>';
}

async function run(text, api) {
  const hit = incidentOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  let s = load();
  if (!s || (hit.title && hit.title !== s.title && !s.impact && !s.cause)) s = blank(hit.title || (s && s.title) || ''); // a new named incident starts fresh unless the draft has real content
  else if (hit.title && !s.title) s.title = hit.title;
  showPage((p) => {
    const paint = () => {
      p.innerHTML = '<h2>Incident brief</h2><div class="sub">blameless: what happened and what will change · stays in this browser until you clear it</div>'
        + formHtml(esc, s)
        + '<div style="margin:12px 0 4px;display:flex;gap:8px;align-items:center"><b style="font-size:13px">Markdown</b><button type="button" data-copy>copy</button><button type="button" data-clear>clear</button></div>'
        + '<pre class="inc-md" style="white-space:pre-wrap;font-size:12px;background:rgba(255,255,255,.03);border-radius:8px;padding:8px;margin:0"></pre>'
        + '<div class="src">Severity levels and the blameless format follow common incident practice: <a href="https://sre.google/sre-book/postmortem-culture/" target="_blank" rel="noopener">Google SRE book, Postmortem Culture</a> and <a href="https://response.pagerduty.com/before/severity_levels/" target="_blank" rel="noopener">PagerDuty incident response</a>. Nothing here is sent anywhere.</div>';
      bind();
    };
    const refresh = () => {
      const d = durations(s), bits = [['to detect', d.detect], ['to mitigate', d.mitigate], ['to resolve', d.resolve]].filter((x) => x[1] != null).map((x) => span(x[1]) + ' ' + x[0]);
      p.querySelector('.inc-durations').textContent = bits.join(' · ');
      p.querySelector('.inc-md').textContent = briefMarkdown(s); save(s);
    };
    const bind = () => {
      p.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => { s[el.dataset.k] = el.value; refresh(); }));
      p.querySelectorAll('[data-list]').forEach((el) => el.addEventListener('input', () => { s[el.dataset.list][+el.dataset.i][el.dataset.c] = el.value; refresh(); }));
      p.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.add; s[k].push(k === 'next' ? { what: '', owner: '', due: '' } : { at: '', what: '' }); save(s); paint(); }));
      p.querySelector('[data-clear]').addEventListener('click', () => { s = blank(''); paint(); });
      const c = p.querySelector('[data-copy]');
      c.addEventListener('click', async () => { let ok = false; try { await navigator.clipboard.writeText(briefMarkdown(s)); ok = true; } catch (_) {} c.textContent = ok ? 'copied' : 'select it to copy'; setTimeout(() => { c.textContent = 'copy'; }, 1600); });
      refresh();
    };
    paint();
  });
  return 'incident';
}

export default {
  name: 'incident',
  examples: ['write an incident brief', 'incident report for the login outage', 'postmortem template', 'write a postmortem for the checkout outage', 'post-incident review', 'incident brief: payments down'],
  nearMisses: ['what is an incident', 'incident at work', 'police incident report near me', 'what is a postmortem', 'post mortem examination'],
  incidentOf,
  match(lower, text) { return !!incidentOf(text); },
  run,
};
