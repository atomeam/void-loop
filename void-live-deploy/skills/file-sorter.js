/**
 * file-sorter skill - sorts a list of file names by kind.
 * "sort these files: app.py, LICENSE, data.csv": each name goes into one kind (licence, source code, settings, documents, data, images and
 * binaries, or unknown) with the reason and how sure the rule is. Brought in from the archived
 * autosalvage repo (archive/repos/autosalvage/evaluator.py, its rule-based classifier), rewritten in plain JS with the same rules,
 * no model and no network. It reads names only: nothing is uploaded, opened or moved.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const LICENSE_NAMES = new Set(['license', 'licence', 'copying', 'notice', 'contributing']);
const LICENSE_EXTS = new Set(['', 'txt', 'md', 'rst', 'markdown']);
const SOURCE = new Set(['py', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'rb', 'php', 'sh', 'ps1', 'kt', 'swift', 'css', 'vue', 'svelte', 'sql']);
const CONFIG = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'xml', 'env', 'lock']);
const DOCS = new Set(['md', 'rst', 'txt', 'adoc', 'html', 'htm', 'doc', 'docx', 'rtf', 'odt']);
const DATA = new Set(['csv', 'tsv', 'jsonl', 'parquet', 'db', 'sqlite', 'xls', 'xlsx']);
const BINARY = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'woff', 'woff2', 'ttf', 'pdf', 'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib', 'mp3', 'mp4', 'wav', 'mov']);
const CONFIG_NAMES = new Set(['dockerfile', 'makefile', '.gitignore', '.editorconfig', '.npmrc', 'procfile']);
export const KINDS = ['Licence', 'Source code', 'Settings', 'Documents', 'Data', 'Images and binaries', 'Unknown'];

/** { name, kind, sure, why } for one file name. Pure. */
export function sortFile(raw) {
  const name = String(raw).trim().replace(/^["'`]|["'`]$/g, '');
  const base = name.split(/[\\/]/).pop().toLowerCase();
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1) : '';
  const stem = dot > 0 ? base.slice(0, dot) : base;
  if (LICENSE_NAMES.has(stem) && LICENSE_EXTS.has(ext)) return { name, kind: 'Licence', sure: 98, why: 'named like a licence or project notice' };
  if (CONFIG_NAMES.has(base)) return { name, kind: 'Settings', sure: 85, why: 'a well-known settings file name' };
  if (SOURCE.has(ext)) return { name, kind: 'Source code', sure: 90, why: '.' + ext + ' is a programming language file' };
  if (CONFIG.has(ext)) return { name, kind: 'Settings', sure: 85, why: '.' + ext + ' is a settings format' };
  if (DOCS.has(ext)) return { name, kind: 'Documents', sure: 80, why: '.' + ext + ' is a text document' };
  if (DATA.has(ext)) return { name, kind: 'Data', sure: 80, why: '.' + ext + ' holds tables or records' };
  if (BINARY.has(ext)) return { name, kind: 'Images and binaries', sure: 90, why: '.' + ext + ' is an image, media, font, archive or program file' };
  return { name, kind: 'Unknown', sure: 30, why: ext ? 'no rule for .' + ext : 'no extension and not a known name' };
}

const ASK = /^(?:please\s+)?(?:sort|classify|group|organi[sz]e|categori[sz]e)\s+(?:these|my|the(?:se)?)?\s*files?(?:\s+by\s+(?:kind|type))?\s*[:\-]\s*(.+)$|^(?:please\s+)?what\s+(?:kind|kinds|type|types)\s+of\s+files?\s+(?:are|is)\s+(?:these|this|they)\s*[:\-]?\s*(.+)$/i;
/** the file names an ask lists, or null. Pure. */
export function filesOf(text) {
  const m = String(text || '').trim().replace(/[?]+$/, '').match(ASK);
  if (!m) return null;
  const names = (m[1] || m[2] || '').split(/\s*(?:,|;|\n|\band\b)\s*|\s+(?=\S+\.\w)/).map((s) => s.trim()).filter(Boolean);
  if (!names.length || names.length > 200) return null;
  if (!names.some((n) => /\.\w{1,8}$/.test(n) || LICENSE_NAMES.has(n.toLowerCase()) || CONFIG_NAMES.has(n.toLowerCase()))) return null;
  return names;
}

/** the files grouped by kind, in KINDS order: [{ kind, files: [...] }]. Pure. */
export function groupFiles(names) {
  const sorted = names.map(sortFile);
  return KINDS.map((kind) => ({ kind, files: sorted.filter((f) => f.kind === kind) })).filter((g) => g.files.length);
}

function run(text, api) {
  const names = filesOf(text);
  if (!names) return 'none';
  const { showPage, esc } = api;
  const groups = groupFiles(names);
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(names.length + (names.length === 1 ? ' file' : ' files') + ' sorted by kind') + '</h2>'
      + groups.map((g) => '<h3 style="margin:12px 0 4px">' + esc(g.kind) + ' (' + g.files.length + ')</h3><ul style="margin:0;padding-left:18px">'
        + g.files.map((f) => '<li style="overflow-wrap:anywhere"><b>' + esc(f.name) + '</b>: ' + esc(f.why) + ' (rule confidence ' + f.sure + '%)</li>').join('') + '</ul>').join('')
      + '<div class="src">Sorted by file name and extension only, with the rules from the archived autosalvage project. Nothing was opened or uploaded.</div>';
  });
  return 'file-sorter';
}

export default {
  name: 'file-sorter',
  examples: [
    'sort these files: app.py, LICENSE, data.csv, logo.png',
    'what kind of files are these: README.md, config.yaml',
    'classify files: main.go, notes.txt',
  ],
  nearMisses: [
    'sort these numbers: 3, 1, 2',
    'how do i sort files in windows',
  ],
  match(lower, text) { return !!filesOf(text || lower); },
  run,
  suite() {
    const g = groupFiles(['app.py', 'LICENSE', 'data.csv', 'logo.png', 'mystery']);
    const ok = g.length === 5 && g[0].kind === 'Licence' && sortFile('mystery').kind === 'Unknown' && filesOf('sort these numbers: 3, 1, 2') === null;
    return { ok, got: g.map((x) => x.kind).join(', ') };
  },
};
