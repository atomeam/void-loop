// Versus measurements and the owner elevator. Pure. A floor is a Verse page that exists and works.
// Measurements are kept and never decide a floor. A card is never a floor. Visitors see a sign.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ASPECTS = Object.freeze([
  { id: 'speed', hi: false, unit: 'ms' },
  { id: 'reliability', hi: true, unit: 'of 3' },
  { id: 'mobile', hi: false, unit: 'px' },
  { id: 'accessibility', hi: false, unit: 'unnamed' },
  { id: 'offline', hi: true, unit: '' },
]);

/** the three Versus pages. Each one exists and works, so each is a floor. The gate still measures them. */
export const TOOLS = Object.freeze([
  { id: 'readable', name: 'A readable page', page: '/our-motherfucking-version/', rival: 'motherfuckingwebsite.com', url: 'https://motherfuckingwebsite.com/', kind: 'page', works: true, features: ['plain page', 'weigh markup'] },
  { id: 'tracks', name: 'Track times', page: '/track-times/', rival: 'tsundere.pw', url: 'https://tsundere.pw/', kind: 'page', works: true, features: ['track list', 'start times'] },
  { id: 'letters', name: 'Rotate letters', page: '/rotate-letters/', rival: 'rot13.com', url: 'https://rot13.com/', kind: 'page', works: true, features: ['letter shift'] },
]);

/** pages that already do the job, so they are floors. The open rows are the fights still to build. */
export const NEXT = Object.freeze([
  { id: 'podcasts', name: 'Podcast player', page: '/podcasts/', rival: 'podcastindex.org', url: 'https://podcastindex.org/', kind: 'page', works: true, features: ['podcast', 'audio', 'episode'] },
  { id: 'scores', name: 'Scoreboard', page: '/scores/', rival: 'livescore.com', url: 'https://www.livescore.com/', kind: 'page', works: true, features: ['score', 'board', 'standings'] },
  { id: 'units', name: 'Unit converter', page: '/convert/', rival: 'convertlive.com', url: 'https://convertlive.com/', kind: 'page', works: true, features: ['convert', 'unit'] },
  { id: 'patterns', name: 'Pattern tester', page: '/patterns/', rival: 'regex101.com', url: 'https://regex101.com/', kind: 'page', works: true, features: ['code', 'regex', 'pattern'] },
  { id: 'schedules', name: 'Schedules', page: '/schedules/', rival: 'crontab.guru', url: 'https://crontab.guru/', kind: 'page', works: true, features: ['cron', 'schedule'] },
  { id: 'meanings', name: 'Word meanings', page: '/meanings/', rival: 'wiktionary.org', url: 'https://en.wiktionary.org/', kind: 'page', works: true, features: ['define', 'dictionary', 'meaning'] },
  { id: 'qr', name: 'QR codes', page: '/qr/', rival: 'myqrcode.com', url: 'https://myqrcode.com/', kind: 'page', works: false, features: ['qr', 'code'] },
]);

export const SITES = Object.freeze([...TOOLS, ...NEXT]);

/** better, equal, or worse from two numbers. Null when either number is missing. Pure. */
export function plainVerdict(verse, best, higher = false) {
  if (!Number.isFinite(verse) || !Number.isFinite(best)) return null;
  if (verse === best) return 'equal';
  return (higher ? verse > best : verse < best) ? 'better' : 'worse';
}

const KEY = { speed: 'speed', reliability: 'reliability', mobile: 'mobile', accessibility: 'a11y', offline: 'offline' };

/** one tool's five rows from two measure() results, or null when the other page was not read. Pure. */
export function rowsFromMeasures(verse, rival) {
  if (!verse || !rival || !rival.reliability) return null;
  const out = {};
  for (const a of ASPECTS) {
    const v = plainVerdict(verse[KEY[a.id]], rival[KEY[a.id]], a.hi);
    if (!v) return null;
    out[a.id] = { verdict: v, verse: verse[KEY[a.id]], best: rival[KEY[a.id]] };
  }
  return out;
}

/** a floor when the page exists and works. A card never is. Rows are ignored. Pure. */
export function isFloor(site) {
  return !!(site && site.kind === 'page' && site.page && site.works === true);
}

/** gap notes from the weakest exam domains, the nightly pick, open wants, and missed asks. Pure. */
export function gapText({ exam, nightly, wants, misses } = {}) {
  const parts = [];
  if (nightly && nightly.pick) parts.push(nightly.pick.id, nightly.pick.why);
  const domains = (exam && exam.domains) || {};
  const ranked = Object.entries(domains)
    .map(([id, d]) => ({ id, score: d && d.score, fails: (d && d.fails) || [] }))
    .filter((d) => Number.isFinite(d.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  for (const d of ranked) {
    parts.push(d.id);
    for (const f of d.fails.slice(0, 3)) {
      parts.push(f && f.ask);
      if (f && Array.isArray(f.failed)) parts.push(...f.failed);
    }
  }
  const lines = (xs) => (Array.isArray(xs) ? xs : []).slice(0, 12).map((x) => (typeof x === 'string' ? x : x && (x.ask || x.item || x.words))).filter(Boolean);
  parts.push(...lines(wants), ...lines(misses));
  return parts.filter(Boolean).join(' ');
}

/** how many feature words show up in the gap notes. Ties keep list order. Size is ignored. Pure. */
export function rankSites(sites, gaps) {
  const words = String(gaps || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const hit = (f) => words.some((w) => f.includes(w) || w.includes(f));
  return sites.map((s, i) => ({ s, i, n: (s.features || []).filter((f) => hit(String(f).toLowerCase())).length }))
    .sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.s);
}

const sigOf = (tools) => TOOLS.map((t) => t.id + '=' + ASPECTS.map((a) => ((tools[t.id] || {})[a.id] || {}).verdict || '-').join(',')).join('|');

/** true when a new measurement changes a verdict. Missing tools count as unmeasured. Pure. */
export function verdictsChanged(prev, next) {
  return sigOf((prev && prev.tools) || {}) !== sigOf((next && next.tools) || {});
}

/** the owner model again, with gap notes from the exam, the wants and the nightly pick. Rows stay. Pure. */
export function modelFrom(apiModel, gaps = '') {
  const tools = {};
  for (const s of (apiModel && apiModel.sites) || []) if (s && s.rows) tools[s.id] = { ...s.rows, at: s.at || '' };
  return viewModel({ tools }, gaps);
}

/** what the owner elevator shows. Pure. */
export function viewModel(verdicts, gaps = '') {
  const tools = (verdicts && verdicts.tools) || {};
  const open = rankSites(SITES.filter((t) => !isFloor(t)), gaps);
  const fight = open[0] || null;
  const floor = SITES.filter((t) => isFloor(t)).length;
  const shown = SITES.filter((t) => isFloor(t)).concat(fight ? [fight] : []);
  return {
    floor,
    total: SITES.length,
    fight: fight ? fight.rival : '',
    sites: shown.map((t) => ({ id: t.id, name: t.name, page: t.page, rival: t.rival, at: (tools[t.id] && tools[t.id].at) || '', rows: tools[t.id] || null, floor: isFloor(t) })),
  };
}

const num = (a, n) => {
  if (!Number.isFinite(n)) return '';
  if (a.id === 'offline') return n ? 'yes' : 'no';
  if (a.id === 'reliability') return n + ' of 3';
  return n + (a.unit ? ' ' + a.unit : '');
};

const SIGN_CSS = '<style>.elv{position:relative;max-width:100%}.elv-doors{display:grid;grid-template-columns:1fr 2px 1fr;height:14rem;border-radius:14px;overflow:hidden;background:#10141c;border:1px solid #2a2a2a}.elv-door{background:linear-gradient(180deg,#242a38,#12151c 55%,#1a1e28)}.elv-seam{background:rgb(var(--d-key) / .4)}.elv-sign{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-3deg);margin:0;padding:1.15rem 1.3rem .9rem;width:min(14rem,78%);text-align:center;background:#f3efe6;color:#161616;font-family:ui-serif,Georgia,serif;font-size:clamp(1.5rem,6vw,1.85rem);font-weight:700;line-height:1.15;box-shadow:0 12px 28px rgba(0,0,0,.38)}.elv-tape{position:absolute;left:50%;top:-11px;width:4.4rem;height:.95rem;transform:translateX(-50%) rotate(4deg);background:rgb(var(--d-key) / .42)}</style>';
/** the taped sign. Nothing else. Pure. */
export function visitorHtml() {
  return SIGN_CSS + '<div class="elv" data-owner="0"><div class="elv-doors" aria-hidden="true"><span class="elv-door"></span><span class="elv-seam"></span><span class="elv-door"></span></div>'
    + '<h1 class="elv-sign"><span class="elv-tape" aria-hidden="true"></span>Out of Order</h1></div>';
}

/** the working elevator for the owner: floor, current fight, comparison numbers. No sign. Pure. */
export function ownerHtml(model) {
  const m = model || { floor: 0, fight: '', sites: [] };
  const steps = Math.max(1, m.floor || 0);
  const sites = (m.sites || []).map((s) => {
    const head = '<h2>' + esc(s.rival) + '</h2><p><a href="' + esc(s.page) + '">' + esc(s.name) + '</a></p>';
    if (!s.rows) return '<article class="elv-card">' + head + '<p>' + (s.floor ? 'page is up' : 'still open') + '</p></article>';
    const when = s.at ? esc(String(s.at).slice(0, 10)) : '';
    const rows = ASPECTS.map((a) => {
      const r = s.rows[a.id];
      if (!r) return '<tr><td>' + esc(a.id) + '</td><td colspan="3">not measured yet</td></tr>';
      return '<tr data-v="' + esc(r.verdict) + '"><td>' + esc(a.id) + '</td><td>' + esc(num(a, r.verse)) + '</td><td>' + esc(num(a, r.best)) + '</td><td>' + esc(r.verdict) + '</td></tr>';
    }).join('');
    return '<article class="elv-card">' + head + (s.floor ? '<p>page is up</p>' : '') + '<div class="elv-scroll"><table><thead><tr><th>Aspect</th><th>Verse</th><th>' + esc(s.rival) + '</th><th></th></tr></thead><tbody>'
      + rows + '</tbody></table></div>' + (when ? '<p class="elv-when">' + when + '</p>' : '') + '</article>';
  }).join('');
  return SIGN_CSS + '<style>.elv-live{display:grid;gap:.9rem}.elv-head{display:grid;justify-items:center}.elv-arrow{width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:16px solid rgb(var(--d-key));filter:drop-shadow(0 0 8px rgb(var(--d-key) / .75))}.elv-num{margin:.15rem 0 0;font-size:clamp(3.2rem,18vw,4.6rem);line-height:.9;font-variant-numeric:tabular-nums;font-weight:700;color:rgb(var(--d-key));text-shadow:0 0 16px rgb(var(--d-key) / .55)}.elv-of{margin:.15rem 0 0;color:var(--d-ink-3);font-variant-numeric:tabular-nums}.elv-shaft{position:relative;height:6.5rem;border-radius:12px;background:#0c0e14;border:1px solid #2a2a2a;overflow:hidden}.elv-car{position:absolute;left:10px;right:10px;bottom:8px;height:2rem;border-radius:7px;background:rgb(var(--d-key));animation:elv-rise 1.4s steps(var(--steps,1),end) both}.elv-fight{margin:0;font-size:clamp(1.2rem,5vw,1.6rem);overflow-wrap:anywhere}.elv-card{border-top:1px solid #2a2a2a;padding-top:.8rem}.elv-card h2{font-size:1rem;margin:0 0 .3rem;overflow-wrap:anywhere}.elv-scroll{overflow-x:auto;max-width:100%}.elv-card table{width:100%;border-collapse:collapse;font-size:.95rem}.elv-card th,.elv-card td{text-align:left;padding:.4rem .35rem;border-bottom:1px solid #222;white-space:nowrap}.elv-card tr[data-v="better"] td:last-child{color:rgb(var(--d-teal))}.elv-card tr[data-v="worse"] td:last-child{color:rgb(var(--d-warm))}.elv-when{margin:.35rem 0 0;color:var(--d-ink-3);font-size:.9rem}@keyframes elv-rise{from{transform:translateY(0)}to{transform:translateY(calc(var(--floor, 0) * -2.1rem))}}@media (prefers-reduced-motion:reduce){.elv-car{animation:none}}</style>'
    + '<div class="elv elv-live" data-owner="1" style="--floor:' + (m.floor || 0) + ';--steps:' + steps + '">'
    + '<div class="elv-head"><span class="elv-arrow" aria-hidden="true"></span><p class="elv-num">' + (m.floor || 0) + '</p><p class="elv-of">' + (m.floor || 0) + ' / ' + (m.total || 0) + '</p></div>'
    + '<div class="elv-shaft" aria-hidden="true"><span class="elv-car"></span></div>'
    + '<h1 class="elv-fight">' + esc(m.fight || '') + '</h1>'
    + sites + '</div>';
}
