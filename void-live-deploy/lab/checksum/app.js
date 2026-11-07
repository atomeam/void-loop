// /lab/checksum/: is this download the file it says it is? SHA-256 (and MD5, SHA-1, SHA-512) of any file, on this device, against a pasted sum.
import { sha256, BIG, expectedOf, verdictOf, sumsFileOf, sumLine, sizeOf } from './sums.js';
import { md5, toHex } from '/lib/hash.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id), rows = [];
const want = () => ({ 'SHA-256': true, MD5: $('a-md5').checked, 'SHA-1': $('a-sha1').checked, 'SHA-512': $('a-sha512').checked });
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };

async function hashFile(file, row) {
  const out = {}, w = want();
  if (file.size > BIG) {
    // too big for one read: SHA-256 in 8 MB pieces, the others need the whole file at once
    const h = sha256(), step = 8 * 1024 * 1024;
    for (let at = 0; at < file.size; at += step) {
      h.update(new Uint8Array(await file.slice(at, at + step).arrayBuffer()));
      row.say.textContent = 'Checking… ' + Math.floor(Math.min(1, (at + step) / file.size) * 100) + '%';
    }
    out['SHA-256'] = h.hex();
    for (const a of ['MD5', 'SHA-1', 'SHA-512']) if (w[a]) out[a] = null;
    return out;
  }
  row.say.textContent = 'Checking…';
  const bytes = new Uint8Array(await file.arrayBuffer());
  out['SHA-256'] = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  if (w['SHA-1']) out['SHA-1'] = toHex(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)));
  if (w['SHA-512']) out['SHA-512'] = toHex(new Uint8Array(await crypto.subtle.digest('SHA-512', bytes)));
  if (w.MD5) out.MD5 = toHex(md5(bytes));
  return out;
}
function judge(row) {
  const pasted = expectedOf($('expect').value), list = sumsFileOf($('sums').value), named = list.find((s) => s.name === row.file.name || s.name.endsWith('/' + row.file.name));
  row.verdict.textContent = ''; row.verdict.className = 'note';
  for (const [algo, hex] of Object.entries(row.out || {})) {
    if (!hex) continue;
    const v = verdictOf(hex, pasted, algo) || (named ? verdictOf(hex, named, algo) : '');
    if (v === 'match') { row.verdict.textContent = 'Matches the ' + algo + ' you gave' + (named && !pasted ? ' in the list' : '') + ': this is the file.'; row.verdict.className = 'ok'; return; }
    if (v === 'differs') { row.verdict.textContent = 'Does NOT match the ' + algo + ' you gave. The file is different, damaged or not the one the sum is for: do not run it.'; row.verdict.className = 'bad'; return; }
  }
  if (pasted || named) row.verdict.textContent = 'The sum you gave is ' + (pasted || named).algo + '; tick it above to compare.';
}
function show(row) {
  row.list.textContent = '';
  for (const [algo, hex] of Object.entries(row.out)) {
    const li = el('li'); li.append(el('b', null, algo + ' '));
    if (!hex) { li.append(el('span', 'note', 'too big to read in one go; SHA-256 is checked in pieces')); row.list.append(li); continue; }
    const code = el('span', 'mono', hex), b = el('button', null, 'Copy'); b.type = 'button';
    b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(hex); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400); } catch (_) { getSelection().selectAllChildren(code); } });
    li.append(code, ' ', b); row.list.append(li);
  }
  row.say.textContent = sizeOf(row.file.size); judge(row); $('save').disabled = !rows.some((r) => r.out);
}
async function add(files) {
  for (const file of files) {
    const box = el('div', 'panel'), row = { file, say: el('span', 'note'), list: el('ul'), verdict: el('p', 'note'), out: null };
    const head = el('div', 'row'); head.append(el('b', null, file.name), row.say); box.append(head, row.list, row.verdict); $('out').prepend(box); rows.push(row);
    try { row.out = await hashFile(file, row); show(row); } catch (e) { row.say.textContent = 'Could not read this file: ' + (e && e.message || e); }
  }
}
$('pick').addEventListener('change', (e) => add([...e.target.files]));
const drop = $('drop');
drop.addEventListener('click', () => $('pick').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('pick').click(); } });
for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
for (const id of ['expect', 'sums']) $(id).addEventListener('input', () => { for (const r of rows) if (r.out) judge(r); });
for (const id of ['a-md5', 'a-sha1', 'a-sha512']) $(id).addEventListener('change', () => { for (const r of rows) if (r.out) hashFile(r.file, r).then((o) => { r.out = o; show(r); }); });
$('save').addEventListener('click', () => {
  const text = rows.filter((r) => r.out && r.out['SHA-256']).map((r) => sumLine(r.out['SHA-256'], r.file.name)).join('\n') + '\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'SHA256SUMS'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
// text: the same sums of what is typed (its UTF-8 bytes), as `echo -n text | sha256sum` gives
$('text').addEventListener('input', async () => {
  const t = new TextEncoder().encode($('text').value);
  $('texthash').textContent = $('text').value ? toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', t))) : '';
});
const q = new URLSearchParams(location.search); if (q.has('sum')) $('expect').value = q.get('sum');
mountRelated($('related'), '/lab/checksum/');
