/**
 * automations skill — the owner's own "when this happens, do that" rules, as a card (lib/automations.js says what a rule
 * may do; /api/automations keeps and runs them). Lists each rule with its trigger and steps, a switch, Run now and
 * Delete; the last runs and what each step said; and New, from a template or written as JSON. A new webhook rule shows
 * its address and secret once. Owner-only: without the owner's key or session the card says so and fetches nothing.
 * "my automations", "show my automations", "automations", "new automation", "zaps".
 */
const OWNER_KEY = 'a2m.void.owner.v1';
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };

export function automationsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:show|open|list)\s+)?(?:me\s+)?(?:my\s+)?(?:void\s+)?(?:automations?|zaps|workflows? i (?:made|set up))$|^(?:new|make|create|add)\s+(?:an?\s+)?automation$|^(?:my\s+)?automation\s+rules$|^what\s+automations\s+(?:do\s+i\s+have|are\s+(?:on|running))$/.test(t)) return { open: true };
  return null;
}

const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const MUTED = 'color:var(--muted,#9a9aa2)';
const describe = (r) => (r.when.on === 'webhook' ? 'When the webhook is called' : 'When you press Run now') + (r.when.match ? ' and ' + Object.entries(r.when.match).map(([k, v]) => k + ' is ' + v).join(', ') : '');
const STEP_TEXT = { note: (s) => 'note: ' + s.text, 'queue.add': (s) => 'add a job: ' + s.ask, 'github.comment': (s) => 'comment on ' + s.repo + ' #' + s.issue,
  'github.pr': (s) => 'open a pull request on ' + s.repo + ' (' + s.files.length + ' file' + (s.files.length === 1 ? '' : 's') + ', branch ' + s.branch + ')', 'http.post': (s) => 'post to ' + s.url };
const stepText = (s) => (STEP_TEXT[s.action] ? STEP_TEXT[s.action](s) : s.action);

// A pressed .g-btn shrinks (transform), and inside a tilted card (.thing is preserve-3d) that moves its hit area, so the
// release lands on the parent and the click is lost at the bottom of a tall card. This card shows a press by colour instead (a filter would flatten it the same way).
const PRESS_CSS = '.automations-card .g-btn:active:not(:disabled){transform:none;background:rgba(255,255,255,.16)}';
function pressStyle() { if (document.getElementById('automations-press')) return; const st = document.createElement('style'); st.id = 'automations-press'; st.textContent = PRESS_CSS; document.head.append(st); }

function mount(th, stageApi) {
  pressStyle();
  const card = el('div');
  card.className = 'thing kept-card game-card automations-card';
  card.dataset.id = th.id;
  card.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(460px, calc(100vw - 20px))';
  const head = el('div'); head.className = 'g-head';
  const title = el('span', null, 'Automations'); title.className = 'g-title';
  const sub = el('span', null, 'when this happens, do that'); sub.className = 'g-sub';
  head.append(title, sub);
  const status = el('div', 'margin-top:6px;' + MUTED); status.className = 'automations-status g-status'; status.setAttribute('aria-live', 'polite');
  const list = el('div', 'display:grid;gap:10px;margin-top:10px'); list.className = 'automations-list';
  const runs = el('div', 'margin-top:12px;display:grid;gap:4px'); runs.className = 'automations-runs';
  const secret = el('div', 'display:none;margin-top:10px;padding:8px;border:1px solid rgba(255,255,255,.2);border-radius:8px;word-break:break-all'); secret.className = 'automations-secret';
  card.append(head, status, list, secret);
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn) => { const b = stop(el('button', null, label)); b.type = 'button'; b.className = 'g-btn ' + cls; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };

  const tok = ownerToken();
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);
  if (!tok) { status.textContent = 'Automations are the owner’s. Unlock Void first (unlock <key>, or sign in with your passkey), then ask again.'; return; }

  let data = null;
  const call = async (method, body) => {
    const r = await fetch('/api/automations', { method, headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.errors ? j.errors.join(' · ') : j.error || (r.status === 401 ? 'only the owner can see automations' : 'the automations service answered ' + r.status));
    return j;
  };
  const act = async (method, body, said) => {
    status.textContent = said || 'working…';
    try { const j = await call(method, body); data = j; paint(); if (j.run) status.textContent = j.run.skipped ? 'Not run: ' + j.run.skipped : j.run.ok ? 'Ran: ' + j.run.log.map((l) => l.said).join(' · ') : 'Stopped: ' + j.run.log.map((l) => l.said).join(' · '); else status.textContent = ''; return j; }
    catch (e) { status.textContent = e.message; return null; }
  };

  // New: a template to start from, or JSON written by hand
  const form = el('div', 'margin-top:12px;display:none'); form.className = 'automations-new';
  const pickT = stop(el('select', 'width:100%')); pickT.className = 'automations-template';
  const area = stop(el('textarea', 'width:100%;min-height:150px;margin-top:6px;font:12px ui-monospace,monospace;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px'));
  area.className = 'automations-json'; area.spellcheck = false;
  area.addEventListener('keydown', (e) => e.stopPropagation());
  const saveBtn = btn('Save rule', 'g-primary automations-save', async () => {
    let rule; try { rule = JSON.parse(area.value); } catch (_) { status.textContent = 'That is not valid JSON yet.'; return; }
    const j = await act('POST', { rule }, 'saving…');
    if (!j) return;
    form.style.display = 'none';
    status.textContent = 'Saved: ' + j.saved.rule.name;
    if (j.saved.hookSecret) {
      secret.style.display = '';
      secret.textContent = 'Webhook address: ' + location.origin + j.saved.hookUrl + '  ·  secret (shown once, send it as the x-void-hook header or ?key=): ' + j.saved.hookSecret;
    }
  });
  pickT.addEventListener('change', () => { const t = data && data.templates[+pickT.value]; if (t) area.value = JSON.stringify(t, null, 2); });
  form.append(pickT, area, saveBtn);
  const newBtn = btn('New automation', 'automations-newbtn', () => { form.style.display = form.style.display === 'none' ? '' : 'none'; if (!area.value && data) area.value = JSON.stringify(data.templates[0], null, 2); });
  const bar = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px');
  bar.append(newBtn, btn('Refresh', 'automations-refresh', () => act('GET')));
  card.append(bar, form, runs);

  function paint() {
    if (!data) return;
    if (!pickT.options.length) data.templates.forEach((t, i) => { const o = el('option', null, t.name); o.value = String(i); pickT.append(o); });
    list.textContent = '';
    if (!data.rules.length) list.append(el('div', MUTED, 'No automations yet. Press New automation to make one.'));
    for (const r of data.rules) {
      const row = el('div', 'padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:10px'); row.className = 'automations-rule'; row.dataset.rule = r.id;
      const top = el('div', 'display:flex;align-items:center;gap:8px');
      const sw = stop(el('input')); sw.type = 'checkbox'; sw.checked = r.enabled; sw.className = 'automations-switch'; sw.setAttribute('aria-label', 'switch ' + r.name + ' on or off');
      sw.addEventListener('change', () => act('PATCH', { id: r.id, enabled: sw.checked }, sw.checked ? 'switching on…' : 'switching off…'));
      top.append(sw, el('strong', 'flex:1', r.name));
      top.append(btn('Run now', 'automations-run', () => act('POST', { id: r.id, run: true }, 'running ' + r.name + '…')), btn('Delete', 'automations-delete', () => { if (confirm('Delete "' + r.name + '"?')) act('DELETE', { id: r.id }, 'deleting…'); }));
      row.append(top, el('div', 'margin-top:4px;' + MUTED, describe(r) + (r.when.on === 'webhook' ? ' (' + location.origin + '/api/hook/' + r.id + ')' : '')));
      const ol = el('ol', 'margin:6px 0 0 18px;padding:0'); for (const s of r.do) ol.append(el('li', null, stepText(s)));
      row.append(ol); list.append(row);
    }
    runs.textContent = '';
    if (data.runs.length) runs.append(el('div', 'font-weight:700', 'Last runs'));
    for (const x of data.runs.slice(0, 8)) {
      const name = (data.rules.find((r) => r.id === x.rule) || { name: x.rule }).name;
      runs.append(el('div', MUTED, (x.ok ? '✓ ' : '✗ ') + new Date(x.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' · ' + name + ' · ' + x.trigger + ' · ' + x.log.map((l) => l.said).join(' · ')));
    }
    if (!status.textContent) status.textContent = (data.github ? 'GitHub is connected' : 'GitHub is not connected yet: set GITHUB_TOKEN in the Pages project, and GitHub steps will run') + ' · repos: ' + data.repos.join(', ');
  }
  act('GET', null, 'loading…').then(() => { if (status.textContent === 'loading…') status.textContent = ''; paint(); });
}

async function run(text, api) {
  if (!automationsOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'automations');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); }
  else api.summon('automations', { center: true });
  api.say('Automations · when this happens, do that · Void runs them itself');
  return 'automations';
}

export default {
  name: 'automations',
  automationsOf,
  examples: ['my automations', 'show my automations', 'automations', 'new automation', 'zaps'],
  nearMisses: ['what is automation', 'home automation', 'automation jobs', 'automate my life', 'zap the bug'],
  match(lower, text) { return !!automationsOf(text); },
  run,
  stageKinds: { automations: { mount } },
};
