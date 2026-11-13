// A title for the clips page. Pure. The archive search is built only from a title that passes this.

export function clipQuery(raw) {
  const text = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > 80) return { ok: false, reason: 'long' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\s'".,:!?-]*$/u.test(text)) return { ok: false, reason: 'odd' };
  return { ok: true, text };
}

export function archiveSearch(text) {
  return 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('(' + text + ') AND mediatype:movies') + '&fl[]=identifier&fl[]=title&fl[]=creator&rows=5&output=json';
}
