// The shared app shell: where the nav goes, how the live line is worded, and the command list.
// Pure. The page that draws it is void-live-deploy/verse-shell.js. Tokens live in void-live-deploy/verse.css.
// What a stranger could do with this: nothing. It returns strings and lists. No network, no storage.

export const NAV = Object.freeze([
  { href: '/', label: 'Ask' },
  { href: '/team/', label: 'Team' },
  { href: '/bots/', label: 'Bots' },
  { href: '/agent/', label: 'Agents' },
  { href: '/conquered/', label: 'Tower', also: ['/tower/', '/tower'] },
  { href: '/films/', label: 'Films' },
  { href: '/podcast/', label: 'Podcast' }, // Verse Out Loud, a new episode every day (owner, 2026-11-06: "where is my daily verse podcast")
  { href: '/treasury/', label: 'Treasury' }, { href: '/starboard/', label: 'Starboard' },
  { href: '/scoreboard/', label: 'Scoreboard' },
  { href: '/security/', label: 'Security' },
  { href: '/limits/', label: 'Limits' },
  { href: '/contribute/', label: 'Contribute' },
]);

/** the nav item this path is on, or null. `/tower` is the Tower. `/` is Ask and nothing else. */
export function currentNav(path, nav = NAV) {
  const raw = String(path || '/');
  const p = raw === '/' ? '/' : (raw.endsWith('/') ? raw : raw + '/');
  if (p === '/') return nav.find((n) => n.href === '/') || null;
  let best = null, len = 0;
  for (const item of nav) {
    for (const h of [item.href].concat(item.also || [])) {
      if (h === '/') continue;
      const n = h.endsWith('/') ? h : h + '/';
      if ((p === n || p.startsWith(n)) && n.length > len) { best = item; len = n.length; }
    }
  }
  return best;
}

/**
 * How far a horizontal bar should scroll so an item sits fully inside it.
 * itemLeft and itemRight are distances from the bar's visible left edge (negative when the item starts off to the left).
 */
export function revealScroll({ scrollLeft = 0, clientWidth = 0, itemLeft = 0, itemRight = 0 } = {}) {
  const left = Number(scrollLeft) || 0;
  const width = Number(clientWidth) || 0;
  const start = Number(itemLeft) || 0;
  const end = Number(itemRight) || 0;
  if (start < 0) return Math.max(0, left + start);
  if (end > width) return Math.max(0, left + (end - width));
  return left;
}

/** the crew member who last said what they did. */
export function latestFeed(crew) {
  let best = null;
  for (const b of crew || []) {
    if (!b || !b.name || !b.did) continue;
    if (!best || (b.didAt || 0) > (best.didAt || 0)) best = b;
  }
  return best;
}

/** one line for the home chrome: bots here, tower wins, and the newest thing a bot did. Empty when there is nothing true to say. */
export function proofLine({ crew, beaten } = {}) {
  const list = Array.isArray(crew) ? crew : [];
  const parts = [];
  if (list.length) {
    const here = list.filter((b) => b && b.here).length;
    parts.push(here + ' of ' + list.length + ' bots here');
  }
  if (Number.isFinite(beaten)) parts.push(beaten + (beaten === 1 ? ' tower win' : ' tower wins'));
  const feed = latestFeed(list);
  if (feed) parts.push(feed.name + ': ' + String(feed.did).replace(/\s+/g, ' ').trim().slice(0, 80));
  return parts.join(' · ');
}

/** commands the palette offers. On the home page the first one focuses the ask bar. */
export function commands(path, nav = NAV) {
  const list = nav.map((n) => ({ label: n.label, href: n.href }));
  const p = String(path || '/');
  if (p === '/' || p === '') list.unshift({ label: 'Ask Verse', href: '#ask' });
  return list;
}

/** palette filter: a label or a path that contains the typed words. */
export function filterCommands(list, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return list || [];
  return (list || []).filter((c) => c && (String(c.label).toLowerCase().includes(s) || String(c.href).toLowerCase().includes(s)));
}

/** speculation rules: prefetch the shell pages when a pointer is likely to follow a link. */
export function speculationRules(nav = NAV) {
  return {
    prefetch: [{
      where: { href_matches: nav.map((n) => n.href) },
      eagerness: 'moderate',
    }],
  };
}

const DRESS = new Set(NAV.map((n) => n.href));

/** the shell paths the service worker dresses. `/tower` is Tower, which redirects to `/conquered/`. */
export function dressPath(path) {
  const raw = String(path || '/');
  const p = raw === '/' ? '/' : (raw.endsWith('/') ? raw : raw + '/');
  return DRESS.has(p);
}

/** put the token file and the shell script on a shell page that does not have them yet. Other HTML is returned unchanged. */
export function dressHtml(html, path) {
  const text = String(html || '');
  if (!dressPath(path) || text.includes('/verse-shell.js')) return text;
  let out = text;
  if (!out.includes('/verse.css')) out = out.replace('</head>', '<link rel="stylesheet" href="/verse.css">\n</head>');
  const field = (path === '/' || path === '') ? '<script type="module" src="/verse-field.js"></script>\n' : '';
  return out.replace('</body>', '<script type="module" src="/verse-shell.js"></script>\n' + field + '</body>');
}
