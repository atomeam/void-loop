// The hand-off from a busy page to /members/ carries what the visitor is looking at (Adam: every hand-off carries and applies real data).
// A page builds /members/?from=<page>&keep=<what>&go=<path that reopens it>; /members/ reads it back (parseKeep), shows exactly that,
// holds it on the device, and saves it into the member's Verse memory (/api/memory, kind "note") once they are a paid member. Pure but `wireOffer`.
export const FROM = { chords: 'chord sheet', music: 'setlist', news: 'news section', brain: 'brain topic', team: 'team channel' };
export const PENDING = 'a2m.members.keep.v1';
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const safeGo = (from, go) => { const g = String(go || ''); return g.startsWith('/' + from + '/') && !g.startsWith('//') ? g.slice(0, 300) : '/' + from + '/'; };

/** what each page is showing right now, from its own URL (and the setlist from the device). */
export function contextOf(from, loc, extra = {}) {
  const q = new URLSearchParams(loc.search || ''), h = new URLSearchParams(String(loc.hash || '').replace(/^#/, ''));
  if (from === 'chords') { const c = clip(q.get('chord') || q.get('q'), 40), s = clip(q.get('scale'), 60);
    return c ? { keep: c + ' chord sheet', go: '/chords/?chord=' + encodeURIComponent(c) } : s ? { keep: s + ' scale', go: '/chords/?scale=' + encodeURIComponent(s) } : { keep: 'your chord sheets', go: '/chords/' }; }
  if (from === 'music') { const l = (extra.setlist || []).filter((e) => e && e.bpm); if (!l.length) return { keep: 'your setlists', go: '/music/' };
    return { keep: 'setlist: ' + clip(l.map((e) => (e.name ? e.name + ' ' : '') + e.bpm + ' BPM').join(', '), 140), go: extra.go || '/music/' }; }
  if (from === 'news') { const s = clip(q.get('sec') || 'top', 20), t = clip(q.get('q'), 60);
    return { keep: t ? 'news on "' + t + '"' : (s === 'top' ? 'top stories' : s) + ' news section', go: '/news/?' + (t ? 'q=' + encodeURIComponent(t) : 'sec=' + encodeURIComponent(s)) }; }
  if (from === 'brain') { const t = clip(q.get('t') || q.get('find'), 80);
    return t ? { keep: 'brain topic: ' + t, go: '/brain/?t=' + encodeURIComponent(t) } : { keep: 'what your brain learns', go: '/brain/' }; }
  if (from === 'team') { const c = clip(h.get('c') || 'work', 30).replace(/[^\w-]/g, '');
    return { keep: '#' + c + ' team channel', go: '/team/#c=' + c }; }
  return null;
}
export function keepHref(from, ctx) {
  const u = new URLSearchParams({ from }); if (ctx) { u.set('keep', ctx.keep); u.set('go', ctx.go); }
  return '/members/?' + u.toString();
}
/** /members/ reads the hand-off back; anything not from the five pages or not pointing back at its own page is dropped. */
export function parseKeep(search) {
  const q = new URLSearchParams(search || ''), from = q.get('from');
  if (!FROM[from]) return null;
  const keep = clip(q.get('keep'), 160) || 'your ' + FROM[from] + 's';
  return { from, what: FROM[from], keep, go: safeGo(from, q.get('go')) };
}
/** the Verse memory record a member keeps (lib/memory-core.js cleanRecord shape). */
export function recordOf(item) {
  const id = ('keep-' + item.from + '-' + item.keep.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/-+$/, '').slice(0, 80);
  return { id, kind: 'note', name: clip(item.keep, 120), summary: clip('Kept from /' + item.from + '/: ' + item.keep + ' · reopen ' + item.go, 300), links: [item.from], state: '' };
}
/** on a page: the offer link always carries what is on screen at the moment it is used. */
export function wireOffer(from, extra = () => ({})) {
  const a = document.querySelector('#member-offer a'); if (!a) return;
  const set = () => { try { a.href = keepHref(from, contextOf(from, location, extra())); } catch (_) { /* the plain link still works */ } };
  set(); for (const ev of ['pointerdown', 'focus', 'mouseenter', 'keydown']) a.addEventListener(ev, set);
  addEventListener('hashchange', set); addEventListener('popstate', set);
}
