// Verse's log: the one page that holds Verse's own activity (house rule, 2026-11-09: what Verse did and when is kept, never shown on the
// stage or other pages, and lives on /log/ only, linked quietly from the footer). It draws what the self card used to carry (since you last
// looked, what Verse asked for, what got built with its week line, the growth readout, the family bars), the ledger skill by skill, the weekly
// chart and the tester trend, and the sites Versus tried. Nothing here is new data: every block reads the same files and /api/reflect as before.
// verseLogHtml is pure (data in, escaped HTML out); drawVerseLog fetches, mounts and wires the folds, the Root cause / Surface toggle and the week line.
import * as SB from './self-blocks.js';

export const LOG_PATH = '/log/';
export const LAST_KEY = 'a2m.void.self.last.v1'; // the same keepsake the self card kept, so "Since you last looked" carries on
export const SITES_MAX = 40;
const said = (s) => ({ surpassed: 'every aspect matched', 'passed, conquering in background': 'measured ahead, still being checked' })[s] || s;
const day = (t) => String(t || '').slice(0, 10);
const safePage = (p) => (/^\/[\w\-./?=&%]*$/.test(p || '') ? p : '');

/** the sites block from assimilated.json ({ sites: [{ at, site, url, status, page }] }): newest first, at most SITES_MAX rows. Pure. */
export function sitesHtml(a, esc) {
  const rows = (a && Array.isArray(a.sites) ? a.sites : []).filter((r) => r && r.site).slice().sort((x, y) => String(y.at || '').localeCompare(String(x.at || ''))).slice(0, SITES_MAX);
  if (!rows.length) return '';
  const n = (a.sites || []).length;
  return '<details class="vs-sec" data-sec="sites"><summary class="vs-sum"><h3 class="vs-h">Sites Versus tried <span class="vs-n">(' + esc(n) + ')</span></h3></summary><ul class="vs-list v-sites">'
    + rows.map((r) => { const p = safePage(r.page); return '<li data-bullet="1"><b>' + esc(day(r.at)) + '</b> · ' + esc(r.site) + ' · ' + esc(said(r.status || r.outcome || '')) + (p ? ' · <a href="' + esc(p) + '">' + esc(p.split('?')[0]) + '</a>' : '') + '</li>'; }).join('')
    + '</ul>' + (n > rows.length ? '<div class="sub vs-note"><a href="/assimilated/">All ' + esc(n) + ' sites</a></div>' : '') + '</details>';
}

/** the whole log body: { sections } from SB.selfCard (the stage keeps only the words section), then the ledger, the charts and the sites. Pure. */
export function verseLogHtml({ v = null, last = null, fam = null, now = Date.now(), built = '', progress = '', tester = '', sites = '' } = {}, esc) {
  let h = '';
  if (v && Array.isArray(v.entries)) {
    const { sections } = SB.selfCard(v, last, new Set(), now, fam);
    h += SB.selfHtml(sections.filter((s) => s.id !== 'words'), esc);
  }
  return h + built + progress + tester + sites;
}

const esc0 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** fetch, draw and wire the log into el. Returns what it drew. */
export async function drawVerseLog(el, { esc = esc0, fetchJson = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null) } = {}) {
  const kept = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (_) { return d; } };
  const [v, fam, led, tl, a] = await Promise.all(['/api/reflect', '/skills/families.json', '/void.growth.json', '/tester-log.json', '/assimilated.json'].map(fetchJson));
  const last = kept(LAST_KEY, null);
  let built = '', progress = '', tester = '';
  try { const BD = await import('./built-detail.js'); if (led) built = BD.builtDetailHtml(BD.builtByFamily(led, fam), esc); } catch (_) {}
  try { const PC = await import('./progress-chart.js'); if (led) progress = PC.progressHtml(PC.weekly(led), esc); if (tl && PC.testerHtml) tester = PC.testerHtml(tl, esc); } catch (_) {}
  const body = verseLogHtml({ v, last, fam, built, progress, tester, sites: sitesHtml(a, esc) }, esc);
  el.innerHTML = body || '<p class="sub">Nothing logged yet.</p>'; // void-review: ok: verseLogHtml escapes every value with esc
  if (v && v.follow) try { localStorage.setItem(LAST_KEY, JSON.stringify(SB.sinceMark(v, fam))); } catch (_) {}
  if (fam) try { const m = await import('./skill-confidence.js'); const slot = el.querySelector('[data-v-conf]'); if (slot) slot.innerHTML = m.sureHtml(fam, Date.now(), esc); } catch (_) {} // void-review: ok: sureHtml escapes every name
  wire(el, esc);
  return { v, drawn: !!body };
}

function wire(el, esc) {
  const fold = (ul) => { const all = ul.nextElementSibling && ul.nextElementSibling.matches('[data-v-more]') && ul.nextElementSibling.getAttribute('aria-expanded') === 'true', k = ul.dataset.depthOn || 'all'; let shown = 0;
    ul.querySelectorAll(':scope > li').forEach((li) => { const on = (k === 'all' || li.dataset.depth === k) && (all || shown < SB.FOLD); if (on) shown++; li.hidden = !on; }); };
  el.querySelectorAll('[data-v-more]').forEach((b) => b.addEventListener('click', () => { const open = b.getAttribute('aria-expanded') !== 'true', n = b.dataset.n;
    b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'show the newest ' + SB.FOLD : 'show all ' + n; const ul = b.previousElementSibling; if (ul) fold(ul); }));
  el.querySelectorAll('[data-v-depth]').forEach((b) => b.addEventListener('click', () => { const ul = el.querySelector('.v-built'); if (!ul) return;
    el.querySelectorAll('[data-v-depth]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); ul.dataset.depthOn = b.dataset.vDepth; fold(ul); }));
  // the week line keeps up: a stage change or the tab coming back reads /api/reflect again, at most once a minute (SB.VELOCITY_EVERY)
  if (!el.querySelector('.vs-velocity')) return;
  let at = 0, busy = false;
  const redraw = async () => {
    if (busy || Date.now() - at < SB.VELOCITY_EVERY) return; busy = true; at = Date.now();
    try { const nv = await fetch('/api/reflect', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)), box = el.querySelector('.vs-velocity');
      if (box && nv && nv.follow) box.outerHTML = SB.velocityHtml(SB.velocity(nv.follow.asked), esc, SB.friction(nv.asks)); } catch (_) {} // void-review: ok: velocityHtml escapes every value with esc
    busy = false; };
  addEventListener('void:stage-change', redraw);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') redraw(); });
}
