/**
 * reliability-pack skill — one page that gathers the reliability pieces for a system:
 * suggested monitors, verification checks, a status digest from live readings, and
 * the incident path. Rules-based. Nothing is sent. Nothing is claimed as already measured.
 * "reliability pack for the invoice automation", "SLA pack for onboarding",
 * "uptime pack for the support router".
 */
import { suggestMonitors } from './monitor-pack.js';
import { suggestChecks } from './verify-pack.js';
import { digestOf } from './status-digest.js';

export function isReliabilityPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:reliability|sla|uptime)\s+(?:pack|package|ownership)?\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+)?(?:reliability|sla)\s+pack\b/i.test(t)
    || /\b(?:reliability|sla)\s+(?:pack|for|of|owns)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

async function readJson(url, fetchFn) {
  try {
    const r = await fetchFn(url, { cache: 'no-cache' });
    if (!r || !r.ok) return { error: 'answered HTTP ' + ((r && r.status) || 0) };
    return { body: await r.json() };
  } catch (_) {
    return { error: 'did not answer' };
  }
}

export function packFor(text, statusBody, statusError, incidentsBody, incidentsError) {
  const name = subjectOf(text);
  const status = digestOf(text, statusBody, statusError, incidentsBody, incidentsError);
  return {
    subject: name,
    monitors: suggestMonitors(name),
    checks: suggestChecks(name),
    status,
    clientKeeps: 'The confirm line for any spend or send, and the outcome.',
    next: 'Ask for the monitor pack or a status digest when you want those pages on their own.'
  };
}

function render(esc, p) {
  const items = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  return '<h2>Reliability pack: ' + esc(p.subject) + '</h2>'
    + '<p>Suggested monitors, verification checks, the current status reading, and the incident path. Nothing is claimed as already measured.</p>'
    + '<h3>Suggested monitors</h3><ul>' + items(p.monitors) + '</ul>'
    + '<h3>Suggested verification checks</h3><ul>' + items(p.checks) + '</ul>'
    + '<h3>Status reading</h3><p><strong>' + esc(p.status.headline) + '</strong></p>'
    + '<ul>' + items(p.status.lines) + '</ul>'
    + '<h3>What the client keeps</h3><p>' + esc(p.clientKeeps) + '</p>'
    + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
    + '<p class="sub">Nothing is sent. A reading that did not answer is named. Suggested monitors and checks are not live results.</p>'
    + '<div class="src">Source: A-to-Mind reliability-pack, using monitor-pack, verify-pack and status-digest · nothing sent</div>';
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const fetchFn = typeof api.fetch === 'function' ? api.fetch : (typeof fetch === 'function' ? ((u, o) => fetch(u, o)) : null);
  let status = { error: 'was not called' }, incidents = { error: 'was not called' };
  if (fetchFn) {
    [status, incidents] = await Promise.all([
      readJson('/api/status', fetchFn),
      readJson('/incidents.json', fetchFn)
    ]);
  }
  const p = packFor(
    text,
    status.body,
    status.error ? 'the status API ' + status.error : '',
    incidents.body,
    incidents.error ? 'the incident log ' + incidents.error : ''
  );
  showPage((el) => { el.innerHTML = render(esc, p); });
  return 'reliability-pack';
}

export const builtWith = ['monitor-pack', 'status-digest', 'verify-pack', 'full-handoff'];
export default {
  name: 'reliability-pack',
  examples: [
    'reliability pack for the invoice automation',
    'SLA pack for onboarding',
    'uptime pack for the support router',
    'reliability package for weekly reports'
  ],
  nearMisses: [
    'what is reliability',
    'status digest',
    'monitor pack',
    'time saved'
  ],
  match: (low, raw) => isReliabilityPack(raw || low),
  run,
  async suite() {
    const p = packFor(
      'reliability pack for the invoice automation',
      null, 'the status API did not answer',
      null, 'the incident log did not answer'
    );
    const hasInvoice = p.monitors.some((m) => /invoice|paid|overdue|remind/i.test(m))
      && p.checks.some((c) => /invoice|paid|unpaid|remind/i.test(c));
    const emptySurface = p.status.overall === 'unknown'
      && !/99(?:\.9+)?\s*%/.test(JSON.stringify(p))
      && !/\ball green\b/i.test(JSON.stringify(p));
    const matchOk = this.examples.every(isReliabilityPack) && !this.nearMisses.some(isReliabilityPack);
    let html = '';
    await this.run('reliability pack for the invoice automation', {
      showPage: (fn) => { const el = { innerHTML: '' }; fn(el); html = el.innerHTML; },
      esc: (s) => String(s ?? ''),
      fetch: async () => ({ ok: false, status: 404 })
    });
    const hasRender = html.includes('Reliability pack: invoice automation')
      && html.includes(p.monitors[0])
      && html.includes(p.checks[0])
      && html.includes(p.status.headline)
      && html.includes(p.subject)
      && /Nothing is sent/.test(html)
      && !/heavy lifting/i.test(html)
      && !/Verse will own/i.test(html)
      && !/Verse owns the reliability/i.test(html)
      && !/99(?:\.9+)?\s*%/.test(html);
    const ok = matchOk && hasInvoice && emptySurface && hasRender;
    return { ok, got: ok ? 'match works; subject data is used; unanswered readings are named' : 'mismatch' };
  }
};
