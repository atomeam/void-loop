/**
 * skill-eclipse skill - "eclipse media skills until friday", "eclipse money skills for an hour", "lift the eclipse" (asked by the owner,
 * 2026-10-18, stage pack G). Hides a whole family of skills (skills/families.json; matched by family id or the common word: media,
 * money, games, time, body, sky, ...) from routing until the time passes, on this device only (localStorage key `eclipse`, lib/state.js):
 * void.html firstSkill skips the hidden skill names, so the router behaves as if they did not exist. A small chip "eclipsed: media ·
 * until fri" stays on the page and lifts that family on a tap. Never eclipsed: this skill, guide, status, stage; the stage family is
 * refused. Parsing and the lists are pure (lib/eclipse.js, tools/stage-pack-g.test.mjs). Nothing is sent anywhere. "solar eclipse tonight"
 * is the sky skill's, not this one's.
 */
import { eclipseOf, parseUntil, namesFor, withEntry, without, active, load, save, chipText, ALIAS } from '../lib/eclipse.js';

const hasDom = () => typeof document !== 'undefined' && !!document.body;
let ticker = 0;

function lift(fam) {
  const list = load(); save(without(list, fam)); paint();
}
/** draw one chip per running eclipse; none when none. Safe to call any time. */
export function paint() {
  if (!hasDom()) return;
  let box = document.getElementById('eclipse-chips');
  const list = load(), now = Date.now();
  if (!list.length) { if (box) box.remove(); clearInterval(ticker); ticker = 0; return; }
  if (!box) {
    box = document.createElement('div'); box.id = 'eclipse-chips'; box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:60;display:flex;gap:6px;flex-wrap:wrap;max-width:calc(100vw - 20px)';
    document.body.appendChild(box);
  }
  box.textContent = '';
  for (const e of list) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'eclipse-chip'; b.dataset.fam = e.fam;
    b.textContent = chipText(e, now); b.title = 'tap to lift this eclipse'; b.setAttribute('aria-label', 'lift the eclipse of ' + e.label + ' skills');
    b.style.cssText = 'font:11px/1 system-ui,sans-serif;padding:5px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(20,20,30,.78);color:#ddd;cursor:pointer;opacity:.85';
    b.addEventListener('click', () => lift(e.fam));
    box.appendChild(b);
  }
  if (!ticker) ticker = setInterval(paint, 15000);
}
if (hasDom()) paint(); else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', paint, { once: true });

async function families() {
  try { const r = await fetch('/skills/families.json'); return r.ok ? await r.json() : null; } catch (_) { return null; }
}

async function run(text, api) {
  const want = eclipseOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const card = (html, line) => { showPage((el) => { el.innerHTML = '<h2>' + esc('Skill eclipse') + '</h2>' + html + '<div class="src">Source: kept on this device only · the router skips these skills until the time passes · never hides guide, status, stage or this skill</div>'; }); api.say(line || ''); };
  if (want.act === 'lift') {
    const n = active(load()).length; save([]); paint();
    card('<p class="ecl-line">' + esc(n ? 'the eclipse is lifted: every skill is back' : 'no eclipse is on') + '</p>');
    return 'skill-eclipse';
  }
  if (want.ids.includes('stage')) { card('<p class="ecl-line">' + esc('the stage skills stay: they are how you lift an eclipse') + '</p>'); return 'skill-eclipse'; }
  const when = want.span ? parseUntil(want.span) : null;
  if (!when) {
    card('<p class="ecl-line">' + esc(want.span ? 'I did not understand "' + want.span + '"' : 'for how long?') + '</p><p>' + esc('say it like "eclipse ' + want.words + ' skills until friday" or "for an hour" (up to 30 days)') + '</p>');
    return 'skill-eclipse';
  }
  const fj = await families();
  let list = load();
  const tokens = want.words.split(/\s*(?:,|&|\band\b)\s*/), done = [];
  for (const id of want.ids) {
    const names = namesFor(fj, [id]);
    if (!names.length) continue;
    const label = (tokens.find((t) => ALIAS[t.replace(/^the\s+/, '')] === id) || id).replace(/^the\s+/, '');
    list = withEntry(list, { fam: id, label, names, until: when.until, how: when.how });
    done.push({ label, n: names.length });
  }
  if (!done.length) { card('<p class="ecl-line">' + esc('I could not read the skill families just now, so nothing is eclipsed') + '</p>'); return 'skill-eclipse'; }
  save(list); paint();
  card('<p class="ecl-line">' + done.map((d) => esc(d.label + ' (' + d.n + ' skills)')).join(', ') + esc(' ' + when.how + ' · say "lift the eclipse" or tap the chip') + '</p>');
  return 'skill-eclipse';
}

export default {
  name: 'skill-eclipse',
  examples: ['eclipse media skills until friday', 'eclipse money skills for an hour', 'lift the eclipse'],
  nearMisses: ['solar eclipse tonight', 'next lunar eclipse', 'eclipse of the heart lyrics', 'eclipse photography tips'],
  match(lower, text) { return !!eclipseOf(text || lower); },
  run,
  eclipseOf, paint,
};
