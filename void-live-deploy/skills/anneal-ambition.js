/**
 * anneal-ambition skill - "set my ambition temperature for the podcast" starts a schedule for a project that works like
 * annealing: HOT (propose freely), then COOLING (the temperature falls by a fixed rate each day; no new proposal is taken
 * until the list is cut to the stated size, so you must select and delete), then COLD (commit: the list is locked). The phase
 * comes from the date, not from a button. Asked for by the owner (2026-10-18). Kept on this device with the stage; nothing
 * is sent anywhere.
 */
import { addThing, cardEl, keepOut, localDay, tidy } from '../lib/stage-pack.js';

export const DEFAULTS = { hotDays: 7, coolDays: 14, keep: 3, rate: 0.85 };

/** { project, hotDays, coolDays, keep } from "set my ambition temperature for X" with optional ", hot 5 days, cool 10 days,
 *  keep 2"; null when it is not this ask. Pure. */
export function parseAnneal(text) {
  const m = /^(?:please\s+)?set\s+(?:up\s+)?(?:my\s+)?ambition\s+temperature\s*(?:for|on|of)\s+(.+)$/i.exec(tidy(text));
  if (!m) return null;
  let rest = m[1];
  const grab = (re, dflt, lo, hi) => { const x = re.exec(rest); if (!x) return dflt; rest = rest.replace(re, ''); return Math.min(hi, Math.max(lo, Math.round(Number(x[1])))); };
  const hotDays = grab(/[,;]?\s*hot\s+(?:for\s+)?(\d+)\s*days?/i, DEFAULTS.hotDays, 0, 365);
  const coolDays = grab(/[,;]?\s*cool(?:ing)?\s+(?:for\s+)?(\d+)\s*days?/i, DEFAULTS.coolDays, 1, 365);
  const keep = grab(/[,;]?\s*keep\s+(\d+)/i, DEFAULTS.keep, 1, 20);
  const project = rest.replace(/^the\s+/i, '').replace(/[,;\s]+$/, '').trim().slice(0, 60);
  return project ? { project, hotDays, coolDays, keep } : null;
}

const dayNum = (key) => { const [y, mo, d] = String(key).split('-').map(Number); return Math.round(Date.UTC(y, mo - 1, d) / 86400000); };

/** whole days from `start` to `today` (both YYYY-MM-DD), never negative. Pure. */
export function daysSince(start, today) { return Math.max(0, dayNum(today) - dayNum(start)); }

/** { phase:'hot'|'cooling'|'cold', temp:0..1, day, left } for a schedule on a date. Hot holds 1; cooling multiplies by `rate`
 *  every day after the hot days; cold starts when the cooling days are used up. Pure. */
export function phaseOf(th, today) {
  const hot = th.hotDays ?? DEFAULTS.hotDays, cool = th.coolDays ?? DEFAULTS.coolDays, rate = th.rate ?? DEFAULTS.rate;
  const day = daysSince(th.start, today);
  if (day < hot) return { phase: 'hot', temp: 1, day, left: hot - day };
  if (day < hot + cool) return { phase: 'cooling', temp: Math.round(Math.pow(rate, day - hot + 1) * 1000) / 1000, day, left: hot + cool - day };
  return { phase: 'cold', temp: Math.round(Math.pow(rate, cool) * 1000) / 1000, day, left: 0 };
}

/** may a new proposal go on the list now? { ok, why }. Hot: yes. Cooling: only while the list is under the kept size (so a
 *  list longer than that must be cut first). Cold: never. Pure. */
export function canPropose(th, today) {
  const p = phaseOf(th, today), n = (th.items || []).length, keep = th.keep ?? DEFAULTS.keep;
  if (p.phase === 'hot') return { ok: true, why: '' };
  if (p.phase === 'cold') return { ok: false, why: 'Cold: the list is committed.' };
  return n < keep ? { ok: true, why: '' } : { ok: false, why: 'Cooling: cut the list to ' + (keep - 1) + ' or fewer before proposing, it holds ' + keep + ' at most (now ' + n + ').' };
}

/** may an item be deleted now? Deleting is the work of cooling and still fine while hot; cold locks it. Pure. */
export function canDelete(th, today) { return phaseOf(th, today).phase !== 'cold'; }

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'anneal-ambition');
  th.items = Array.isArray(th.items) ? th.items : [];
  const body = document.createElement('div'); el.appendChild(body);
  const paint = () => {
    const today = localDay(), p = phaseOf(th, today), prop = canPropose(th, today);
    body.innerHTML = '';
    const add = (tag, txt, cls) => { const d = document.createElement(tag); if (cls) d.className = cls; d.textContent = txt; body.appendChild(d); return d; };
    add('div', 'Ambition temperature · ' + th.project, 'an-head').style.fontWeight = '700';
    const ph = add('div', p.phase.toUpperCase() + ' · temperature ' + p.temp + ' · ' + (p.phase === 'cold' ? 'committed' : p.left + ' day' + (p.left === 1 ? '' : 's') + ' left in this phase'), 'an-phase');
    ph.dataset.phase = p.phase; ph.style.margin = '4px 0';
    const ul = document.createElement('ul'); ul.style.cssText = 'margin:4px 0;padding-left:18px'; body.appendChild(ul);
    th.items.forEach((it, i) => {
      const li = document.createElement('li'); li.className = 'an-item'; li.textContent = it + ' ';
      if (canDelete(th, today)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'an-del'; b.textContent = 'delete'; b.setAttribute('aria-label', 'delete ' + it);
        b.style.cssText = 'font:inherit;font-size:11px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;border-radius:10px;cursor:pointer';
        b.addEventListener('click', (e) => { e.stopPropagation(); th.items.splice(i, 1); stageApi.save(); paint(); }); keepOut(b); li.appendChild(b); }
      ul.appendChild(li);
    });
    const row = document.createElement('div'); body.appendChild(row);
    const inp = document.createElement('input'); inp.className = 'an-input'; inp.placeholder = 'propose an ambition'; inp.setAttribute('aria-label', 'propose an ambition'); inp.disabled = !prop.ok;
    inp.style.cssText = 'font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:3px 6px;width:60%';
    const go = document.createElement('button'); go.type = 'button'; go.className = 'an-add'; go.textContent = 'Propose'; go.disabled = !prop.ok; go.style.cssText = 'font:inherit;margin-left:6px;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
    const submit = () => { const v = inp.value.trim().slice(0, 80); if (!v || !canPropose(th, localDay()).ok) return; th.items.push(v); stageApi.save(); paint(); };
    go.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    keepOut(inp); keepOut(go); row.append(inp, go);
    if (!prop.ok) add('div', prop.why, 'an-refuse').style.cssText = 'font-size:12px;margin-top:4px;color:#ffb36b';
  };
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const p = parseAnneal(text);
  if (!p) return '';
  addThing(stageApi, 'anneal', { project: p.project, start: localDay(), hotDays: p.hotDays, coolDays: p.coolDays, keep: p.keep, rate: DEFAULTS.rate, items: [] });
  stageApi.save(); stageApi.render();
  return 'anneal-ambition';
}

export default {
  name: 'anneal-ambition',
  examples: ['set my ambition temperature for the podcast', 'set my ambition temperature for the book, hot 5 days, cool 10 days, keep 2'],
  nearMisses: ['set my room temperature', 'what is simulated annealing', 'set my ambition'],
  parseAnneal,
  match(lower, text) { return parseAnneal(text || lower) !== null; },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'anneal-ambition' : 'none'; },
  stageKinds: { anneal: { mount, ask } },
};
