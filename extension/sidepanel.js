// The panel is the only door between Void (the frame, a-to-mind.com) and the extension. Both sides check who is talking:
// this page takes messages only from the Void frame's own window at a-to-mind.com, and Void (void.html) takes them only from this extension's pinned id.
const VOID = 'https://a-to-mind.com/';
const VOID_ORIGIN = new URL(VOID).origin;
const frame = document.getElementById('void');
const toVoid = (msg) => { try { frame.contentWindow.postMessage(msg, VOID_ORIGIN); } catch (_) {} };

// B1: the tab you last pointed Void at (title, address, selection, the box you were in); the tab id stays here, Void doesn't need it
let tab = null;
const send = () => { if (tab) { const { tabId, ...shown } = tab; toVoid({ type: 'void-ext:tab', tab: shown }); } };
chrome.storage.session.get('tab').then(({ tab: t }) => { if (t) { tab = t; send(); } });
chrome.storage.session.onChanged.addListener((c) => { if (c.tab && c.tab.newValue) { tab = c.tab.newValue; send(); } });

// #134: "Ask Void about this page" / "Help me with this draft" open Void with ?q=<ask>&ctx=1; Void says it is ready and gets the page
// by postMessage (never in the address, which keeps only 300 characters and ends up in logs), then sends it to its answer engine.
let pending = null;
function ask(a) {
  if (!a || !a.q) return;
  pending = a.page ? a : null;
  frame.src = VOID + '?q=' + encodeURIComponent(a.q) + (a.page ? '&ctx=1' : '');
}
chrome.storage.session.get('ask').then(({ ask: a }) => { if (a) { chrome.storage.session.remove('ask'); ask(a); } });
chrome.storage.session.onChanged.addListener((c) => { if (c.ask && c.ask.newValue) { chrome.storage.session.remove('ask'); ask(c.ask.newValue); } });

window.addEventListener('message', (e) => {
  if (e.origin !== VOID_ORIGIN || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
  const m = e.data;
  if (m.type === 'void-ext:ready') { toVoid({ type: 'void-ext:hello', version: chrome.runtime.getManifest().version }); send(); }
  else if (m.type === 'void.ctx.ready' && pending) { toVoid({ type: 'void.ctx', q: pending.q, page: pending.page }); pending = null; }
  else if (m.type === 'void-ext:thread') { // "draft for me: proposal": the thread text, read now, for Void to send once
    chrome.runtime.sendMessage({ type: 'thread' }).then((r) => toVoid({ type: 'void-ext:threaded', id: m.id, ...(r || { ok: false, why: 'no-reply' }) }))
      .catch(() => toVoid({ type: 'void-ext:threaded', id: m.id, ok: false, why: 'no-reply' }));
  }
  else if (m.type === 'void-ext:draft' && typeof m.text === 'string') {
    chrome.runtime.sendMessage({ type: 'draft', text: m.text }).then((r) => toVoid({ type: 'void-ext:drafted', id: m.id, ...(r || { ok: false, why: 'no-reply' }) }))
      .catch(() => toVoid({ type: 'void-ext:drafted', id: m.id, ok: false, why: 'no-reply' }));
  }
});

// --- B3: Void proposes one step; this panel (the extension, not the page in the frame) shows it with its site, the element's
// label and the text, and only your Yes here runs it, and only on a site on your allow list. Each step leaves an execution
// record through Void (/api/actions, kind extension.act): running before the step, then done or failed; a No is stubbed.
const $ = (s) => document.querySelector(s);
const hostOf = (u) => { try { return new URL(u).host; } catch (_) { return ''; } };
const getAllow = async () => ((await chrome.storage.local.get('allow')).allow || []);
const setAllow = (list) => chrome.storage.local.set({ allow: [...new Set(list)].sort((a, b) => a.localeCompare(b)) }); // host names, in alphabetical order

async function paintSites() {
  const allow = await getAllow(), host = tab ? hostOf(tab.url) : '';
  $('#sites .n').textContent = allow.length;
  $('#sites .none').hidden = allow.length > 0;
  const ul = $('#sites .list'); ul.textContent = '';
  for (const h of allow) {
    const li = document.createElement('li'); const s = document.createElement('span'); s.textContent = h;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.title = 'Void may no longer act on ' + h;
    x.addEventListener('click', async () => { await setAllow((await getAllow()).filter((y) => y !== h)); });
    li.append(s, x); ul.append(li);
  }
  const add = $('#sites .add');
  add.hidden = !host || allow.includes(host);
  add.textContent = 'allow ' + host;
}
$('#sites .add').addEventListener('click', async () => { const h = tab && hostOf(tab.url); if (h) await setAllow([...(await getAllow()), h]); });
chrome.storage.onChanged.addListener((c, area) => { if ((area === 'local' && c.allow) || (area === 'session' && c.tab)) paintSites(); });
paintSites();

// a request to Void (the frame) and its answer: Void writes the record, because the owner's key lives with Void
let seq = 0; const waiting = {};
function askVoid(msg) {
  return new Promise((resolve) => {
    const id = ++seq; waiting[id] = resolve;
    setTimeout(() => { if (waiting[id]) { delete waiting[id]; resolve({ ok: false, why: 'no-reply' }); } }, 8000);
    toVoid({ ...msg, id });
  });
}
window.addEventListener('message', (e) => {
  if (e.origin !== VOID_ORIGIN || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
  const m = e.data;
  if (m.type === 'void-ext:recorded' && waiting[m.id]) { const r = waiting[m.id]; delete waiting[m.id]; r(m); }
  else if (m.type === 'void-ext:propose' && (m.step || Array.isArray(m.steps))) propose(m.steps || [m.step], !!(m.step && m.step.auto));
});

// A short run (Adam, 2026-10-10): two or three steps proposed as one card, a Yes for each, in order. It stops at the first No
// (that step is recorded as stubbed) or the first step the page refuses (recorded as failed); nothing after it runs.
const MAX_STEPS = 3, ARM_MS = 400; // a new step's Yes ignores clicks for a moment, so one double-click can't approve two steps
let open = null;
const clean = (raw) => ({ action: raw && raw.action === 'click' ? 'click' : raw && raw.action === 'fill' ? 'fill' : '', label: String((raw && raw.label) || '').slice(0, 120).trim(), text: String((raw && raw.text) || '').slice(0, 20000) });
async function propose(raws, auto) {
  const tell = (said) => toVoid({ type: 'void-ext:acted', auto, ...said }); // auto: Void proposed it from a draft, nobody typed it
  if (!raws.length || raws.length > MAX_STEPS) return tell({ ok: false, why: raws.length ? 'too-many' : 'bad-step' });
  const steps = raws.map(clean), of = steps.length;
  const host = tab ? hostOf(tab.url) : '';
  if (steps.some((s) => !s.action || !s.label)) return tell({ ok: false, why: 'bad-step' });
  if (!host) return tell({ ok: false, why: 'no-tab' });
  if (!(await getAllow()).includes(host)) return tell({ ok: false, why: 'not-allowed', host }); // no card at all
  if (open) return tell({ ok: false, why: 'busy' });
  open = { steps, host };
  $('.act-site').textContent = host;
  const what = (s) => (s.action === 'fill' ? 'fill the field “' : 'click the button “') + s.label + '”';
  const ol = $('.act-steps'); ol.textContent = ''; ol.hidden = of < 2;
  const items = steps.map((s) => { const li = document.createElement('li'); li.textContent = what(s); ol.append(li); return li; });
  $('#act').classList.add('on');
  let r = null, i = 0;
  for (; i < of; i++) {
    const step = steps[i], ref = host + ' · ' + step.label;
    $('.act-count').textContent = of > 1 ? 'step ' + (i + 1) + ' of ' + of : 'step';
    $('.act-what').textContent = what(step);
    $('.act-text').textContent = step.text; $('.act-text').hidden = $('.act-text-k').hidden = step.action !== 'fill';
    items[i].className = 'now';
    const armed = Date.now() + (i ? ARM_MS : 0);
    const answer = await new Promise((resolve) => {
      $('.act-yes').onclick = () => { if (Date.now() >= armed) resolve(true); };
      $('.act-no').onclick = () => { if (Date.now() >= armed) resolve(false); };
    });
    $('.act-yes').onclick = $('.act-no').onclick = null; // nothing answers the next step until it is shown
    const did = (step.action === 'fill' ? 'fill ' : 'click ') + step.label + ' on ' + host;
    if (!answer) {
      items[i].className = 'no';
      const rec = await askVoid({ type: 'void-ext:record', op: 'stub', kind: 'extension.act', ref, text: 'would have ' + (step.action === 'fill' ? 'filled ' : 'clicked ') + step.label + ' on ' + host + '; you said no' });
      r = { ok: false, why: 'said-no', recorded: !!rec.ok }; break;
    }
    const rec = await askVoid({ type: 'void-ext:record', op: 'begin', kind: 'extension.act', ref });
    if (!rec.ok) { r = { ok: false, why: 'no-record', detail: rec.why }; break; } // no record, no action
    r = await chrome.runtime.sendMessage({ type: 'act', step, host }).catch(() => ({ ok: false, why: 'no-reply' })) || { ok: false, why: 'no-reply' };
    await askVoid({ type: 'void-ext:record', op: 'end', recordId: rec.recordId, state: r.ok ? 'done' : 'failed', text: r.ok ? (r.did === 'clicked' ? 'clicked ' : 'filled ') + step.label + ' on ' + host : 'could not ' + did + ': ' + (r.why || 'no reply') });
    items[i].className = r.ok ? 'done' : 'failed';
    if (!r.ok) break;
  }
  $('#act').classList.remove('on'); open = null;
  tell({ ...r, host, ...(of > 1 ? { of, at: Math.min(i + 1, of), done: r.ok ? of : i } : {}) });
}
