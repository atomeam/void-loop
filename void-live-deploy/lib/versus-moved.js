// The pages that moved into the owner-only Versus keep their old addresses as redirects, and the redirect keeps the query, so an old bookmark such
// as /rival/?site=abc lands on the same view (/versus/?view=rival&site=abc). They live here and not in _redirects because Cloudflare runs _redirects
// before any function and drops the query when the target has its own; functions/_middleware.js answers these first. A visitor who follows one only
// ever gets the Out of Order sign: the owner check is the page's, not the redirect's.
import { parseRedirects, redirectTo } from './page-pass.js';

const MOVED = [
  ['/rival', '/versus/?view=rival'], ['/rival/', '/versus/?view=rival'],
  ['/compare', '/versus/?view=compare'], ['/compare/', '/versus/?view=compare'],
].map(([from, to]) => from + ' ' + to + ' 301').join('\n');
const TABLE = parseRedirects(MOVED);

/** { to, status } for an old address, with its query kept; null for any other path. Pure. */
export const movedTo = (pathname, search) => redirectTo(TABLE, String(pathname || ''), String(search || ''));
export const MOVED_PATHS = [...TABLE.keys()];
