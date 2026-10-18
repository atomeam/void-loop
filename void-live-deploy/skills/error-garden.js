/**
 * error-garden skill — "plant my mistake: <text>" puts a mistake in a garden on the stage as a sprout; planting the same
 * mistake again (same content words) turns it into a weed that grows with each repeat; writing a rule next to it ("write a rule
 * for my mistake: <words> => <rule>", or the box on the card) turns it into compost and shows the rule. "show my error garden"
 * brings the card back; "plant my test failures" plants every distinct failing check of incidents.json (a check that failed in two incidents is a weed). Kept with the stage on this device; nothing is sent anywhere. Asked for by the owner (2026-10-18).
 */
import { escHtml, addThing, cardEl, keepOut, firstOf, tidy } from '../lib/stage-pack.js';
import { words, sameThing } from '../lib/stage-words.js';
import { failurePlants } from '../lib/autopsy.js';

const MAX_PLANTS = 40;
const PLANT = /^(?:please\s+)?plant\s+(?:my|a|this|another)\s+(?:mistake|error)\s*[:\-]\s*(.+)$/i;
const SHOW = /^(?:please\s+)?(?:show|open|water|see|bring\s+up)\s+(?:me\s+)?(?:my\s+|the\s+)?error\s+garden(?:\s+please)?$/i;
const RULE = /^(?:please\s+)?(?:write|add|put)\s+(?:a\s+)?rule\s+(?:for|next\s+to|beside)\s+(?:my\s+)?(?:the\s+)?mistake\s*[:\-]?\s*(.+?)\s*(?:=>|->)\s*(.+)$/i;

const FAILURES = /^(?:please\s+)?(?:(?:plant|grow|garden|sow)\s+(?:all\s+)?(?:my\s+|the\s+|your\s+)?(?:recent\s+)?(?:test\s+|check\s+|suite\s+)?(?:failures|errors|incidents|red\s+checks)(?:\s+(?:from|of)\s+(?:the\s+)?(?:incident\s+autopsy|site\s+test|browser\s+suite))?(?:\s+(?:in|into|to|in\s+to)\s+(?:my\s+|the\s+)?error\s+garden)?|visuali[sz]e\s+(?:your\s+|the\s+|my\s+)?(?:own\s+)?(?:test\s+|check\s+|suite\s+)(?:failures|errors))(?:\s+please)?$/i;

/** what an ask wants of the garden: { act:'plant', text } | { act:'show' } | { act:'rule', about, rule } | { act:'failures' } | null. Pure. */
export function gardenIntent(text) {
  const t = tidy(text);
  let m;
  if ((m = PLANT.exec(t))) { const x = m[1].trim().slice(0, 200); return words(x).length ? { act: 'plant', text: x } : null; }
  if (SHOW.test(t)) return { act: 'show' };
  if (FAILURES.test(t)) return { act: 'failures' };
  if ((m = RULE.exec(t))) { const about = m[1].trim(), rule = m[2].trim().slice(0, 200); return words(about).length && rule.length >= 3 ? { act: 'rule', about, rule } : null; }
  return null;
}

/** the stage of a plant: sprout (once), weed (planted again, no rule), compost (a rule is written). Pure. */
export function stageOf(p) {
  if (p && p.rule) return 'compost';
  return p && p.count >= 2 ? 'weed' : 'sprout';
}

/** plant a mistake: a repeat of one already there bumps its count, anything else is a new sprout. Returns { plants, index, stage }. Pure. */
export function plant(plants, text, now = Date.now()) {
  const list = (plants || []).map((p) => ({ ...p }));
  const i = list.findIndex((p) => sameThing(p.text, text));
  if (i >= 0) { list[i].count = (list[i].count || 1) + 1; list[i].last = now; return { plants: list, index: i, stage: stageOf(list[i]) }; }
  list.push({ text: String(text).slice(0, 200), count: 1, first: now, last: now, rule: '' });
  const kept = list.slice(-MAX_PLANTS);
  return { plants: kept, index: kept.length - 1, stage: 'sprout' };
}

/** plant a list of { text, count } (the incidents' failing checks): one already there keeps the larger count, the rest are new; the newest 40 stay. Pure. */
export function plantMany(plants, items, now = Date.now()) {
  let list = (plants || []).map((p) => ({ ...p }));
  for (const it of items || []) {
    const i = list.findIndex((p) => sameThing(p.text, it.text));
    if (i >= 0) { list[i].count = Math.max(list[i].count || 1, it.count || 1); list[i].last = now; }
    else list.push({ text: String(it.text).slice(0, 200), count: Math.max(1, it.count | 0), first: now, last: now, rule: '' });
  }
  return list.slice(-MAX_PLANTS);
}

/** write the rule next to the mistake it is about (best word match); a short rule or no match leaves the garden as it was. Pure. */
export function writeRule(plants, about, rule) {
  const r = String(rule || '').trim();
  const list = (plants || []).map((p) => ({ ...p }));
  if (r.length < 3) return { plants: list, index: -1, stage: null };
  const i = list.findIndex((p) => sameThing(p.text, about, 0.5));
  if (i < 0) return { plants: list, index: -1, stage: null };
  list[i].rule = r.slice(0, 200);
  return { plants: list, index: i, stage: 'compost' };
}

const GLYPH = {
  sprout: '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 30V16" stroke="#78dc96" stroke-width="3" stroke-linecap="round"/><path d="M17 18C11 18 9 12 9 8c6 0 8 4 8 10z" fill="#78dc96"/><path d="M17 15c0-5 3-8 8-8 0 5-3 8-8 8z" fill="#5cc47f"/></svg>',
  weed: '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M17 30V12M17 24L8 12M17 22l10-12M17 28L5 22M17 28l12-6" stroke="#c9a14a" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  compost: '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><path d="M4 30c2-12 24-12 26 0z" fill="#8a6a4a"/><circle cx="12" cy="22" r="2" fill="#6b4f35"/><circle cx="21" cy="24" r="2" fill="#6b4f35"/><path d="M17 15v5" stroke="#78dc96" stroke-width="2" stroke-linecap="round"/><path d="M17 15c-3 0-4-3-4-5 3 0 4 2 4 5z" fill="#78dc96"/></svg>',
};

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'error-garden');
  el.style.minWidth = '260px';
  const head = document.createElement('div');
  head.innerHTML = '<b>Error garden</b> · ' + escHtml(th.plants.length ? th.plants.length + ' planted' : 'nothing planted yet: say "plant my mistake: ..."');
  head.style.marginBottom = '6px';
  el.appendChild(head);
  th.plants.forEach((p) => {
    const st = stageOf(p);
    const row = document.createElement('div');
    row.className = 'eg-plant'; row.dataset.stage = st; row.dataset.count = String(p.count || 1);
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:4px 0';
    const g = document.createElement('span'); g.innerHTML = GLYPH[st]; g.title = st; // void-review: ok (GLYPH is this file's own constant table, st is one of its keys)
    const body = document.createElement('div'); body.style.flex = '1';
    body.innerHTML = '<div>' + escHtml(p.text) + '</div><div style="font-size:11px;opacity:.7">' + st + (st === 'weed' ? ' · came back ×' + p.count : '') + '</div>' + (p.rule ? '<div class="eg-rule" style="font-size:12px;color:#ffd166">rule: ' + escHtml(p.rule) + '</div>' : '');
    row.append(g, body);
    if (!p.rule) {
      const inp = document.createElement('input'); inp.placeholder = 'write a rule'; inp.setAttribute('aria-label', 'rule for ' + p.text);
      inp.style.cssText = 'width:120px;font:12px system-ui;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 4px';
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && inp.value.trim().length >= 3) { p.rule = inp.value.trim().slice(0, 200); stageApi.save(); stageApi.render(); } });
      keepOut(inp); row.appendChild(inp);
    }
    el.appendChild(row);
  });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const it = gardenIntent(text);
  if (!it) return '';
  let th = firstOf(stageApi, 'errgarden');
  if (!th) th = addThing(stageApi, 'errgarden', { plants: [] });
  if (it.act === 'plant') {
    const r = plant(th.plants, it.text);
    th.plants = r.plants;
    stageApi.say(r.stage === 'sprout' ? 'planted: a sprout' : 'planted again: it is a weed now (x' + th.plants[r.index].count + ')');
  } else if (it.act === 'rule') {
    const r = writeRule(th.plants, it.about, it.rule);
    if (r.index < 0) { stageApi.say('no mistake like that in the garden'); return 'error-garden-nomatch'; }
    th.plants = r.plants;
    stageApi.say('rule written: it is compost now');
  }
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  return 'error-garden';
}

export default {
  name: 'error-garden',
  examples: ['plant my mistake: I sent the email before checking it', 'show my error garden', 'plant my test failures in my error garden', 'visualize your test failures'],
  nearMisses: ['how do I garden', 'plant tomato failures', 'what are test failures', 'what is an error budget', 'plant tomatoes in spring'],
  gardenIntent,
  match(lower, text) { return !!gardenIntent(text || lower); },
  async run(text, api) {
    if (gardenIntent(text)?.act === 'failures') {
      let j = null; try { const r = await fetch('/incidents.json', { cache: 'no-cache' }); j = r.ok ? await r.json() : null; } catch (_) { /* no incidents file: say so below */ }
      const items = failurePlants(j);
      if (!items.length) { api.stage.say('no failed checks on record: the garden stays as it is'); return 'error-garden-none'; }
      const st = api.stage; let th = firstOf(st, 'errgarden'); if (!th) th = addThing(st, 'errgarden', { plants: [] });
      th.plants = plantMany(th.plants, items);
      const weeds = th.plants.filter((p) => stageOf(p) === 'weed').length;
      st.say('planted ' + items.length + ' failed checks from the incident autopsy' + (weeds ? ': ' + weeds + ' came back and are weeds' : ''));
      st.select(th.id); st.save(); st.render(); return 'error-garden';
    }
    return ask(String(text || '').toLowerCase(), text, api.stage) ? 'error-garden' : 'none';
  },
  stageKinds: { errgarden: { mount, ask } },
};
