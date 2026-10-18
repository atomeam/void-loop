/**
 * error-garden skill — "plant my mistake: <text>" puts a mistake in a garden on the stage as a sprout; planting the same
 * mistake again (same content words) turns it into a weed that grows with each repeat; writing a rule next to it ("write a rule
 * for my mistake: <words> => <rule>", or the box on the card) turns it into compost and shows the rule. "show my error garden"
 * brings the card back. Kept with the stage on this device; nothing is sent anywhere. Asked for by the owner (2026-10-18).
 * The site's own red checks grow here too (asked by Void, 2026-10-18: "any new red browser check automatically generates a summary card in the
 * error-garden"): when the garden is shown or mounted it reads incidents.json (every red browser suite on main, tools/incident-log.mjs) and
 * plants each failing check of the incidents it has not seen as a sprout, "red check: <the check's title>"; the same check failing again is a
 * weed, and a rule written beside it (the fix) is compost. The first time a garden meets the file only the newest incident is planted, so an
 * old stage is not flooded; "plant the red checks" reads it again. The shas seen stay on the garden, on this device.
 */
import { escHtml, addThing, cardEl, keepOut, firstOf, tidy } from '../lib/stage-pack.js';
import { words, sameThing } from '../lib/stage-words.js';
import { parseIncidents, titleOf } from '../lib/autopsy.js';

const MAX_PLANTS = 40;
export const INCIDENT_BATCH = 12; // red checks planted from one reading at most (newest first)
const SUITE_END = /^suite ran to the end$/i; // the suite's own last line, not a check
const INCIDENTS = /^(?:please\s+)?(?:plant|add|read)\s+(?:the\s+|my\s+)?(?:red|failed|failing)\s+(?:checks?|incidents?|suites?)(?:\s+(?:in|into|to)\s+(?:my\s+|the\s+)?(?:error\s+)?garden)?(?:\s+please)?$/i;
const PLANT = /^(?:please\s+)?plant\s+(?:my|a|this|another)\s+(?:mistake|error)\s*[:\-]\s*(.+)$/i;
const SHOW = /^(?:please\s+)?(?:show|open|water|see|bring\s+up)\s+(?:me\s+)?(?:my\s+|the\s+)?error\s+garden(?:\s+please)?$/i;
const RULE = /^(?:please\s+)?(?:write|add|put)\s+(?:a\s+)?rule\s+(?:for|next\s+to|beside)\s+(?:my\s+)?(?:the\s+)?mistake\s*[:\-]?\s*(.+?)\s*(?:=>|->)\s*(.+)$/i;

/** what an ask wants of the garden: { act:'plant', text } | { act:'show' } | { act:'rule', about, rule } | null. Pure. */
export function gardenIntent(text) {
  const t = tidy(text);
  let m;
  if ((m = PLANT.exec(t))) { const x = m[1].trim().slice(0, 200); return words(x).length ? { act: 'plant', text: x } : null; }
  if (SHOW.test(t)) return { act: 'show' };
  if (INCIDENTS.test(t)) return { act: 'incidents' };
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

/** the summary a red check is planted as: its title (the words before the first colon), so the same check failing on another day reads as the same plant. Pure. */
export const checkSummary = (check) => 'red check: ' + titleOf(check);

/** plant the red checks of incidents.json the garden has not seen: { plants, seen, planted, weeds }. Incidents are taken oldest first so a check that
 *  failed twice counts twice (a weed); the suite's own "suite ran to the end" line is not a check. A garden meeting the file for the first time
 *  (no shas seen) plants only the newest incident and remembers every sha, so an old stage is not flooded; after that every unseen incident is
 *  planted, INCIDENT_BATCH checks at most. A plant from a red check carries from: 'incident', the check's words (ref) and the newest sha. Pure. */
export function plantIncidents(plants, incidentsJson, seen = [], now = Date.now()) {
  const inc = parseIncidents(incidentsJson), had = new Set((seen || []).map(String));
  const fresh = inc.filter((i) => !had.has(i.sha));
  const take = (had.size ? fresh : fresh.slice(0, 1)).slice().reverse(); // oldest first
  let list = (plants || []).map((p) => ({ ...p })), planted = 0, weeds = 0, budget = INCIDENT_BATCH;
  for (const i of take) {
    const at = Number.isFinite(Date.parse(i.at)) ? Date.parse(i.at) : now;
    for (const check of i.checks) {
      if (SUITE_END.test(check.trim()) || budget <= 0) continue;
      budget--;
      // the same check is known by its exact title (not by shared words: "chess rules" and "checkers rules" are two checks, and every one of them says "red check")
      const key = titleOf(check), ref = String(check).slice(0, 160), sha = i.sha.slice(0, 7), k = list.findIndex((p) => p.from === 'incident' && p.key === key);
      if (k >= 0) { const p = list[k]; p.count = (p.count || 1) + 1; p.last = at; p.sha = sha; p.ref = ref; weeds++; continue; }
      list.push({ text: checkSummary(check), key, count: 1, first: at, last: at, rule: '', from: 'incident', ref, sha }); list = list.slice(-MAX_PLANTS); planted++;
    }
  }
  return { plants: list, seen: [...new Set([...had, ...inc.map((i) => i.sha)])].slice(-200), planted, weeds };
}

let incidentsOnce = null; // one reading of incidents.json per page load (a mount runs on every render)
async function readIncidents(again = false) {
  if (again || !incidentsOnce) incidentsOnce = fetch('/incidents.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return incidentsOnce;
}
/** read the red checks into this garden; true when it changed */
async function growIncidents(th, stageApi, again = false) {
  const j = await readIncidents(again);
  if (!j) return false;
  const r = plantIncidents(th.plants, j, th.incidentsSeen);
  const changed = r.planted + r.weeds > 0 || (r.seen.length !== (th.incidentsSeen || []).length);
  th.plants = r.plants; th.incidentsSeen = r.seen;
  if (changed) { stageApi.save(); stageApi.render(); }
  return r.planted + r.weeds > 0 ? r : false;
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
  const red = th.plants.filter((p) => p.from === 'incident').length;
  head.innerHTML = '<b>Error garden</b> · ' + escHtml(th.plants.length ? th.plants.length + ' planted' + (red ? ' · ' + red + ' from red checks' : '') : 'nothing planted yet: say "plant my mistake: ..."');
  head.style.marginBottom = '6px';
  el.appendChild(head);
  th.plants.forEach((p) => {
    const st = stageOf(p);
    const row = document.createElement('div');
    row.className = 'eg-plant'; row.dataset.stage = st; row.dataset.count = String(p.count || 1); if (p.from) row.dataset.from = p.from;
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:4px 0';
    const g = document.createElement('span'); g.innerHTML = GLYPH[st]; g.title = st; // void-review: ok (GLYPH is this file's own constant table, st is one of its keys)
    const body = document.createElement('div'); body.style.flex = '1';
    const when = p.from === 'incident' && Number.isFinite(p.last) ? ' · ' + new Date(p.last).toISOString().slice(0, 10) : '';
    body.innerHTML = '<div>' + escHtml(p.text) + '</div><div style="font-size:11px;opacity:.7">' + st + (st === 'weed' ? ' · came back ×' + p.count : '') + (p.sha ? ' · failed on ' + escHtml(p.sha) + when : '') + '</div>'
      + (p.ref ? '<div class="eg-ref" style="font-size:11px;opacity:.6">' + escHtml(p.ref) + '</div>' : '') + (p.rule ? '<div class="eg-rule" style="font-size:12px;color:#ffd166">rule: ' + escHtml(p.rule) + '</div>' : '');
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
  growIncidents(th, stageApi).catch(() => {}); // the site's red checks grow here (one reading a page load; a change re-renders)
}

/** the stage kind's ask hook; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const it = gardenIntent(text);
  if (!it) return '';
  let th = firstOf(stageApi, 'errgarden');
  if (!th) th = addThing(stageApi, 'errgarden', { plants: [] });
  if (it.act === 'incidents') {
    stageApi.select(th.id); stageApi.save(); stageApi.render();
    growIncidents(th, stageApi, true).then((r) => stageApi.say(r ? 'planted ' + r.planted + ' red check' + (r.planted === 1 ? '' : 's') + (r.weeds ? ', ' + r.weeds + ' came back as weeds' : '') : 'no new red checks')).catch(() => stageApi.say('could not read the incidents'));
    return 'error-garden';
  }
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
  examples: ['plant my mistake: I sent the email before checking it', 'show my error garden', 'plant the red checks in my garden'],
  nearMisses: ['how do I garden', 'what is an error budget', 'plant tomatoes in spring', 'what broke lately'],
  gardenIntent,
  match(lower, text) { return !!gardenIntent(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'error-garden' : 'none'; },
  stageKinds: { errgarden: { mount, ask } },
};
