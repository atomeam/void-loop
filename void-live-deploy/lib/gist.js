// A gist with no server (owner, 2026-10-24: "verse can eat github starting with the smallest"): the smallest piece of GitHub is a gist, a snippet
// someone pastes and shares by link. GitHub makes you sign in to make one and keeps it on its servers. Here the files are packed into the link itself
// (compressed, then base64url, in the part after the #), so there is nothing to store, no account, and nothing a stranger could make a server hold or
// serve: opening a link only ever shows its own text, drawn as text. Shared by /g/ (the page) and skills/gist.js (the card).

export const MAX_FILES = 8;
export const MAX_TEXT = 60000;      // characters of text in all (the link would pass what browsers and chat apps carry soon after)
export const MAX_LINK = 90000;      // characters of packed link
const OUT_CAP = 400000;             // bytes a link may unpack to: a crafted link cannot grow into memory

/** a file name that is safe to show and to download: letters, digits, dot, dash, underscore, space; at most 60; never empty. Pure. */
export const cleanName = (n) => String(n == null ? '' : n).replace(/[^\w.\- ]/g, '').replace(/^\.+/, '').trim().slice(0, 60) || 'snippet.txt';
/** the files cleaned: at most MAX_FILES, names cleaned and made different, text cut at MAX_TEXT in all. Pure. */
export function cleanFiles(files) {
  const seen = new Set(), out = []; let left = MAX_TEXT;
  for (const f of Array.isArray(files) ? files : []) {
    if (out.length >= MAX_FILES) break;
    let name = cleanName(Array.isArray(f) ? f[0] : f && f.name); const base = name; for (let i = 2; seen.has(name.toLowerCase()); i++) name = base.replace(/(\.[^.]*)?$/, '-' + i + '$1');
    seen.add(name.toLowerCase());
    const text = String(Array.isArray(f) ? f[1] : f && f.text || '').replace(/\r\n?/g, '\n').slice(0, Math.max(0, left)); left -= text.length;
    out.push([name, text]);
  }
  return out.length ? out : [['snippet.txt', '']];
}

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'), bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4)), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
async function readCapped(stream, cap) {
  const r = stream.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > cap) { try { await r.cancel(); } catch (_) {} throw new Error('too big'); } parts.push(value); }
  const out = new Uint8Array(n); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out;
}

// a gist holds its files and, for an edited copy, the files it was copied from (so the copy can show what changed). The packed form is the
// compressed JSON { f: files, p: previous } (an older link is just the files array). Locked: the compressed bytes are encrypted with AES-GCM under
// a key made from the passphrase (PBKDF2, SHA-256, 210,000 rounds, a fresh salt) before they go in the link, so the link alone reads as noise.
const ROUNDS = 210000;
async function keyFrom(pass, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pass)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const compress = (bytes) => readCapped(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')), OUT_CAP);
const inflate = (bytes) => readCapped(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')), OUT_CAP);
const okFiles = (files) => Array.isArray(files) && files.length > 0 && files.every((f) => Array.isArray(f) && typeof f[0] === 'string' && typeof f[1] === 'string');

/** the files (and what they were copied from) as one link fragment, or null when they do not fit. With a passphrase the link is locked. */
export async function pack(files, opts = {}) {
  const prev = okFiles(opts.prev) ? cleanFiles(opts.prev) : null, body = prev ? { f: cleanFiles(files), p: prev } : cleanFiles(files);
  let bytes = await compress(new TextEncoder().encode(JSON.stringify(body))), tag = 'v1.';
  if (opts.pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(opts.pass, salt), bytes));
    bytes = new Uint8Array(28 + sealed.length); bytes.set(salt, 0); bytes.set(iv, 16); bytes.set(sealed, 28); tag = 'v1e.';
  }
  const s = tag + b64(bytes);
  return s.length <= MAX_LINK ? s : null;
}
/** is this link locked with a passphrase? Pure. */
export const isLocked = (fragment) => /^#?v1e\.[A-Za-z0-9_-]+$/.test(String(fragment || ''));
/** the gist in a link: { files, prev } (prev is null unless it is an edited copy), or null for anything that is not a gist link, or a locked one
 *  without the right passphrase. Never throws. */
export async function open(fragment, pass) {
  try {
    const m = /^#?v1(e?)\.([A-Za-z0-9_-]+)$/.exec(String(fragment || '')); if (!m || m[2].length > MAX_LINK) return null;
    let bytes = unb64(m[2]);
    if (m[1]) { if (!pass || bytes.length < 29) return null; bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(16, 28) }, await keyFrom(pass, bytes.subarray(0, 16)), bytes.subarray(28))); }
    const body = JSON.parse(new TextDecoder().decode(await inflate(bytes)));
    if (okFiles(body)) return { files: cleanFiles(body), prev: null };
    if (body && okFiles(body.f)) return { files: cleanFiles(body.f), prev: okFiles(body.p) ? cleanFiles(body.p) : null };
    return null;
  } catch (_) { return null; }
}
/** the files in an unlocked link, or null (kept for the GitHub file view and older callers). */
export async function unpack(fragment) { const g = await open(fragment); return g ? g.files : null; }

/** what changed between two texts, line by line: [['=', line] | ['-', line] | ['+', line]] (a longest-common-subsequence diff). Pure. */
export function lineDiff(a, b) {
  const x = String(a).split('\n'), y = String(b).split('\n');
  if (x.length * y.length > 4e6) return [...x.map((l) => ['-', l]), ...y.map((l) => ['+', l])]; // too big to compare closely: all out, all in
  const n = x.length, m = y.length, L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (x[i] === y[j]) { out.push(['=', x[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', x[i++]]); else out.push(['+', y[j++]]); }
  while (i < n) out.push(['-', x[i++]]); while (j < m) out.push(['+', y[j++]]);
  return out;
}

/** the language of a file from its name, for colouring: 'js', 'py', 'json', 'html', 'css', 'sh', 'md' or '' (plain). Pure. */
export function langOf(name) {
  const e = (/\.([a-z0-9]+)$/i.exec(String(name || '')) || [])[1];
  return ({ js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js', json: 'json', py: 'py', html: 'html', htm: 'html', xml: 'html', svg: 'html', css: 'css', scss: 'css', sh: 'sh', bash: 'sh', zsh: 'sh', md: 'md',
    go: 'c', rs: 'c', c: 'c', h: 'c', cpp: 'c', java: 'c', cs: 'c', swift: 'c', kt: 'c', php: 'c', rb: 'py', yml: 'py', yaml: 'py', toml: 'py' })[String(e || '').toLowerCase()] || '';
}
const KW = {
  js: 'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof of in null undefined true false this interface type enum implements',
  py: 'def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue None True False self async await',
  c: 'fn func let mut const var if else for while loop match switch case break continue return struct enum impl trait type pub use mod package import class public private static void int string bool float double null nil true false new this self async await',
  sh: 'if then else fi for do done while case esac function echo export cd ls grep sed awk cat in return exit',
  css: '', json: 'true false null', html: '', md: '',
};
/** a line cut into [kind, text] pieces for colouring: kind is 'c' comment, 's' string, 'n' number, 'k' keyword or '' plain. Pure; every character of the line is in exactly one piece. */
export function tokens(line, lang) {
  if (!lang || lang === 'md') return [['', line]];
  const kw = new Set((KW[lang] || '').split(' ').filter(Boolean)), out = [];
  const com = lang === 'py' || lang === 'sh' ? '#[^\\n]*' : lang === 'html' ? '<!--[\\s\\S]*?-->' : lang === 'css' ? '\\/\\*[\\s\\S]*?\\*\\/' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const re = new RegExp('(' + com + ')|("(?:[^"\\\\]|\\\\.)*"?|\'(?:[^\'\\\\]|\\\\.)*\'?|`(?:[^`\\\\]|\\\\.)*`?)|(\\b\\d[\\d_.]*(?:e[+-]?\\d+)?\\b|#[0-9a-fA-F]{3,8}\\b)|([A-Za-z_$][\\w$]*)', 'g');
  let last = 0, m;
  const push = (k, t) => { if (!t) return; if (out.length && out[out.length - 1][0] === k) out[out.length - 1][1] += t; else out.push([k, t]); };
  while ((m = re.exec(line))) {
    push('', line.slice(last, m.index)); last = m.index + m[0].length;
    if (m[1]) push('c', m[0]); else if (m[2]) push('s', m[0]); else if (m[3]) push('n', m[0]); else push(kw.has(m[4]) ? 'k' : '', m[0]);
    if (m[0] === '') re.lastIndex++;
  }
  push('', line.slice(last));
  return out.length ? out : [['', line]];
}

// GitHub's next piece: one file, read straight from GitHub's public raw address (raw.githubusercontent.com answers any page), coloured and
// numbered here. A github.com file link ("…/blob/main/src/a.js#L10-L20") or a raw link becomes { owner, repo, rest, name, raw, page, lines }.
const PART = /^[A-Za-z0-9_.-]{1,100}$/, REST = /^[A-Za-z0-9._~+@%-]+(?:\/[A-Za-z0-9._~+@%-]+){1,40}$/;
/** the GitHub file a link names, or null. `rest` is the branch or commit then the path, as GitHub's own raw address takes it. Pure. */
export function ghFileOf(text) {
  const t = String(text == null ? '' : text).trim().slice(0, 500);
  const m = /(?:^|\s)(?:https?:\/\/)?(?:www\.)?github\.com\/([^\s/]+)\/([^\s/]+)\/blob\/([^\s#?]+)(?:\?[^\s#]*)?(?:#L(\d+)(?:-L(\d+))?)?/i.exec(t)
    || /(?:^|\s)(?:https?:\/\/)?raw\.githubusercontent\.com\/([^\s/]+)\/([^\s/]+)\/([^\s#?]+)(?:\?[^\s#]*)?(?:#L(\d+)(?:-L(\d+))?)?/i.exec(t);
  if (!m) return null;
  const [, owner, repo, rest] = m;
  if (!PART.test(owner) || !PART.test(repo) || /^\.+$/.test(owner) || /^\.+$/.test(repo) || !REST.test(rest) || /(?:^|\/)\.\.?(?:\/|$)/.test(rest)) return null;
  const a = m[4] ? Math.min(+m[4], 200000) : 0, b = m[5] ? Math.min(+m[5], 200000) : a;
  return { owner, repo, rest, name: cleanName(decodeURIComponent(rest.split('/').pop())), raw: 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + rest,
    page: 'https://github.com/' + owner + '/' + repo + '/blob/' + rest, lines: a ? [Math.min(a, b), Math.max(a, b)] : null };
}
/** the address of Verse's own page for a GitHub file. Pure. */
export const ghFilePage = (f) => '/g/?gh=' + encodeURIComponent(f.owner + '/' + f.repo + '/' + f.rest) + (f.lines ? '&L=' + f.lines[0] + '-' + f.lines[1] : '');
/** a GitHub file's text, at most 400 KB, or { error } in plain words. */
export async function ghFileText(f, get = fetch) {
  try {
    const r = await get(f.raw, { redirect: 'follow' });
    if (r.status === 404) return { error: 'GitHub has no public file there (a private repo, a wrong branch or a wrong path).' };
    if (!r.ok) return { error: 'GitHub did not send the file just now (' + r.status + ').' };
    const bytes = await readCapped(r.body, OUT_CAP).catch(() => null);
    if (!bytes) return { error: 'That file is over 400 KB: open it on GitHub.' };
    const text = new TextDecoder().decode(bytes);
    if (/\u0000/.test(text.slice(0, 8000))) return { error: 'That is not a text file (an image or a program): open it on GitHub.' };
    return { text };
  } catch (_) { return { error: 'GitHub could not be reached just now.' }; }
}
/** draw code into an element: line numbers, colouring, the given lines lit; only text nodes, never markup. */
export function renderCode(box, name, text, lit) {
  const doc = box.ownerDocument, el = (tag, cls, t) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (t != null) e.textContent = t; return e; };
  const pre = el('pre', 'gist-pre'), lang = langOf(name), lines = String(text).replace(/\n$/, '').split('\n'), nums = el('span', 'ln'), body = el('code');
  nums.textContent = lines.map((_, i) => i + 1).join('\n');
  lines.forEach((l, i) => {
    const row = el('span', lit && i + 1 >= lit[0] && i + 1 <= lit[1] ? 'lit' : null); if (row.className) row.dataset.line = String(i + 1);
    for (const [k, t] of tokens(l, lang)) row.appendChild(k ? el('span', k, t) : doc.createTextNode(t));
    body.appendChild(row); if (i < lines.length - 1) body.appendChild(doc.createTextNode('\n'));
  });
  pre.append(nums, body); box.textContent = ''; box.appendChild(pre);
  return pre;
}
