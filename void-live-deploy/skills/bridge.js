/**
 * bridge skill - Live Workspace Fusion Step 1: synthesize 2-3 explicitly staged inputs
 * (tab snapshots, URLs, snippets) into a Bridge Card with connections, deltas and next actions.
 * Primary trigger: handle() when stageInputs.length >= 2 (programmatic). Also matchable by ask.
 * Includes a deterministic local analyzer fallback when /api/answer returns 204/unavailable so
 * offline/local runs (tools/ask.mjs stubs /api/*) still produce real cross-input synthesis.
 */
import { analyzeBridge } from '../lib/bridge.js';
export { analyzeBridge };

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

export function renderBridgeCard(container, contract) {
  if (!container) return;
  const c = contract || {};
  const badge = (sev) => ({ mismatch: '#ff8a8a', missing: '#ffc46b', conflict: '#ff8a8a', risk: '#ffc46b', info: '#8ab4ff' }[sev] || '#9a9a9a');
  const conns = (c.connections || []).map(x => `<li><b>${esc(x.type || 'link')}</b> · ${esc(x.detail || '')}${x.confidence ? ` <span style="color:#8a8a8a">(${esc(x.confidence)})</span>` : ''}</li>`).join('') || '<li style="color:#8a8a8a">No direct connections found from the excerpts.</li>';
  const deltas = (c.deltas || []).map(x => `<li><span style="color:${badge(x.severity)};font-weight:600">${esc(x.severity || 'note')}</span> · ${esc(x.detail || '')}</li>`).join('') || '<li style="color:#8a8a8a">No notable deltas flagged.</li>';
  const next = c.nextActions || c.actions || [];
  const actions = next.map((a, i) => `<div style="margin:6px 0"><button type="button" class="bridge-act" data-i="${i}" style="font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 10px;cursor:pointer">${esc(a.label || 'Action')}</button><div style="color:#8a8a8a;font-size:12px;margin-top:2px">${esc(a.rationale || '')}</div></div>`).join('');
  const limits = (c.limitations && c.limitations.length) ? `<div class="sub" style="margin-top:10px;color:#8a8a8a">Limits: ${esc(c.limitations.join(' · '))}</div>` : '';
  const ins = (c.inputs || []).map(x => esc(x.title || x.id || 'input')).join(' · ');
  container.innerHTML = `<h2>Bridge</h2><div class="sub">${esc(c.summary || 'Synthesis of staged inputs.')}</div>`
    + `<div class="sub" style="margin-top:4px">Inputs: ${ins || '—'}</div>`
    + `<h3 style="margin:14px 0 6px;font-weight:500">Connections</h3><ul class="bridge-connections">${conns}</ul>`
    + `<h3 style="margin:14px 0 6px;font-weight:500">Deltas</h3><ul class="bridge-deltas">${deltas}</ul>`
    + `<h3 style="margin:14px 0 6px;font-weight:500">Next actions</h3><div class="bridge-actions">${actions}</div>`
    + limits + `<div class="src">Bridge card · ${esc(c.local ? 'local synthesis' : 'synthesized')} · ${(new Date()).toISOString().slice(0,10)}</div>`;
  container.querySelectorAll('.bridge-act').forEach((btn) => btn.addEventListener('click', async () => {
    const a = (next)[+btn.dataset.i]; if (!a) return;
    const p = a.payload || {};
    if (a.kind === 'copy' || p.code) {
      const text = p.code || a.label || '';
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; setTimeout(() => { if (btn.isConnected) btn.textContent = a.label || 'Copy'; }, 1200); }
      catch (_) { btn.textContent = 'Select to copy'; }
    } else if (a.kind === 'ask' && p.ask) {
      const input = document.getElementById('input'); if (input) { input.value = p.ask; input.focus(); }
      btn.textContent = 'Ready in ask bar';
    }
  }));
}

export default {
  name: 'bridge',
  examples: ['bridge these inputs', 'compare these inputs', 'synthesize these sources'],
  nearMisses: ['bridge two pieces of text together', 'compare these two files'],
  match(lower) { return /\b(bridge|compare|synthesize|fuse)\b.*\b(inputs?|sources?|tabs?|snippets?|artifacts?)\b/.test(lower) || lower === 'bridge these inputs'; },
  async run(text, api) { return runBridge(text, api); }
};

// Two small sample inputs: a server reply and the page code that reads it, so the card shows a real bridge straight away.
export const SAMPLES = [
  { id: 'in_1', kind: 'snippet', title: 'Server reply', sourceUrl: '', content: 'GET /v1/users/42\n{ "user_id": 42, "display_name": "Ada", "created_at": "2026-01-02", "plan": "free" }' },
  { id: 'in_2', kind: 'snippet', title: 'Page code', sourceUrl: '', content: 'const r = await fetch("/v1/users/" + id); const u = await r.json();\nshow(u.userId, u.displayName, u.email);' },
];

// Asked by name with fewer than two staged inputs (two or more go straight to void.html's showBridge): the card says how to
// stage them and bridges the two samples on a tap, with the same local analyzer, so the ask never ends on a blank.
export function runBridge(text, api) {
  if (!api || !api.showPage) return 'none';
  const staged = (typeof window !== 'undefined' && window.stageInputsApi && window.stageInputsApi.list) ? window.stageInputsApi.list() : [];
  if (staged.length >= 2) { const el = api.showPage(() => {}); renderBridgeCard(el, { ...analyzeBridge(staged, String(text || 'Bridge these inputs')), local: true }); return 'bridge'; }
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>Bridge</h2><div class="sub">Bridge reads two or three inputs side by side and shows how they connect, where they disagree and what to do next.</div>'
      + '<div class="sub" style="margin-top:8px">' + (staged.length === 1 ? 'One input is staged. Paste or drop one more' : 'Paste or drop two or three snippets, links or tabs into the ask bar') + ' (each becomes a chip), then ask again.</div>'
      + '<div style="margin-top:12px"><button type="button" class="bridge-sample" style="font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 10px;cursor:pointer">Bridge two samples</button></div>';
  });
  const btn = el && el.querySelector && el.querySelector('.bridge-sample');
  if (btn) btn.addEventListener('click', () => renderBridgeCard(el, { ...analyzeBridge(SAMPLES, 'Bridge two samples'), local: true }));
  if (api.say) api.say('');
  return 'bridge';
}
