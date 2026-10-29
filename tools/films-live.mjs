// The live films, checked from outside (.github/workflows/films-live.yml, manual): what a stranger sees at /films/ and
// /api/films (the films listed, a signed link that plays, no reviews, not the owner), and that the owner key is let in as the
// owner. Prints a Markdown table for the job summary; only counts and yes/no, never a key, a signed link or a film's words.
// A passkey sign-in needs the owner's device, so the owner row checks the key (Bearer READ_TOKEN), the same check ownerOk runs.
//   READ_TOKEN=… node tools/films-live.mjs [--site https://a-to-mind.com]
// Exit 1 when a stranger's view is wrong, 3 when the site cannot be reached.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkFilms(site, key, get = fetch) {
  const base = site.replace(/\/+$/, ''), rows = [], row = (what, ok, saw) => rows.push({ what, ok, saw });
  const page = await get(base + '/films/');
  const html = page.ok ? await page.text() : '';
  row('/films/ opens', page.status === 200 && /<html/i.test(html), 'HTTP ' + page.status);
  const r = await get(base + '/api/films');
  const j = await r.json().catch(() => null);
  const films = j && Array.isArray(j.films) ? j.films : null;
  row('a stranger gets the list', r.status === 200 && !!films, 'HTTP ' + r.status + (films ? ', ' + films.length + ' film' + (films.length === 1 ? '' : 's') : ''));
  row('a stranger sees films', !!films && films.length > 0, films ? films.length + ' listed' : 'no list');
  row('a stranger is not the owner', !!j && j.owner === false && !j.member, j ? 'owner ' + j.owner + ', member ' + !!j.member : 'no answer');
  row('a stranger sees no reviews', !!films && films.every((f) => f.reviews == null), films ? films.filter((f) => f.reviews != null).length + ' with reviews' : 'no list');
  const first = films && films[0];
  if (first && first.src) {
    const v = await get(base + first.src, { headers: { range: 'bytes=0-1023' } });
    row('the newest film plays (a range of it)', v.status === 206 && /video\/mp4/.test(v.headers.get('content-type') || ''), 'HTTP ' + v.status + ', ' + (v.headers.get('content-type') || 'no type'));
    if (v.body && v.body.cancel) await v.body.cancel().catch(() => {});
  } else row('the newest film plays (a range of it)', false, 'no film to try');
  if (!key) row('the owner key is let in as the owner', null, 'not checked: the secret VOID_OWNER_TOKEN is empty');
  else {
    const o = await get(base + '/api/films', { headers: { authorization: 'Bearer ' + key } });
    const oj = await o.json().catch(() => null);
    row('the owner key is let in as the owner', o.status === 200 && !!oj && oj.owner === true, 'HTTP ' + o.status + ', owner ' + (oj ? oj.owner : '?')
      + (oj && oj.owner === false ? ' (VOID_OWNER_TOKEN is not the Pages READ_TOKEN)' : ''));
  }
  return rows;
}

export function filmsReport(site, rows) {
  const mark = (ok) => (ok === null ? '–' : ok ? '✅' : '❌');
  return '### Films on ' + site + '\n\n| check | | saw |\n|:--|:-:|:--|\n' + rows.map((x) => '| ' + x.what + ' | ' + mark(x.ok) + ' | ' + x.saw + ' |').join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf('--site'), site = i >= 0 ? args[i + 1] : 'https://a-to-mind.com';
  let rows;
  try { rows = await checkFilms(site, process.env.READ_TOKEN || process.env.VOID_OWNER_TOKEN || ''); } catch (e) { console.error('films check: ' + site + ' could not be reached: ' + (e.message || e)); process.exit(3); }
  process.stdout.write(filmsReport(site, rows));
  process.exit(rows.some((x) => x.ok === false) ? 1 : 0);
}
