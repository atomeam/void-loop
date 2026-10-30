// yamljson: YAML to JSON and JSON to YAML for the converter card (skills/util.js, kind 'yamljson'). The reader takes the YAML people
// write by hand: block maps and lists, flow [ ] and { }, plain, single- and double-quoted scalars, | and > blocks, comments, anchors,
// aliases, "<<" merges and several documents (one JSON array then). Plain scalars follow the YAML 1.2 core schema: null, true, false
// and numbers become those values, and "yes", "no", "on" and "off" stay text. A fault names its line. The writer quotes every string
// a YAML reader could take as another type (YAML 1.1 readers included), so a round trip keeps the data. Pure: no DOM.
// tools/yaml-json.test.mjs tests it.

class YamlError extends Error { constructor(msg, line) { super(msg); this.line = line; } }

const NUM_INT = /^[-+]?[0-9]+$/, NUM_FLOAT = /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$/;

/** a plain scalar as its YAML 1.2 core value: null, true, false, a number, or the text. Pure. */
export function plainValue(s) {
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (s === 'true' || s === 'True' || s === 'TRUE') return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  if (NUM_INT.test(s)) { const n = Number(s); return Number.isSafeInteger(n) ? n : s; }
  if (/^0x[0-9a-fA-F]+$/.test(s)) { const n = parseInt(s.slice(2), 16); return Number.isSafeInteger(n) ? n : s; }
  if (/^0o[0-7]+$/.test(s)) { const n = parseInt(s.slice(2), 8); return Number.isSafeInteger(n) ? n : s; }
  if (NUM_FLOAT.test(s)) return Number(s);
  return s; // .inf and .nan have no JSON form, so they stay text
}

const ESC = { 0: '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\x85', _: '\xa0', L: '\u2028', P: '\u2029' };

// the text of a double-quoted scalar between its quotes, line breaks already folded
function unescapeDouble(s, line) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { out += c; continue; }
    const e = s[++i];
    if (e in ESC) { out += ESC[e]; continue; }
    const len = e === 'x' ? 2 : e === 'u' ? 4 : e === 'U' ? 8 : 0;
    const hex = s.slice(i + 1, i + 1 + len);
    if (!len || !new RegExp('^[0-9a-fA-F]{' + len + '}$').test(hex)) throw new YamlError('"\\' + (e || '') + '" is not an escape YAML knows', line);
    out += String.fromCodePoint(parseInt(hex, 16)); i += len;
  }
  return out;
}

// fold the lines of a quoted or plain scalar: one line break is a space, each empty line is a line break
function fold(parts) {
  let out = '', blanks = 0, first = true;
  for (const p of parts) {
    if (p === '') { blanks++; continue; }
    out += first ? p : (blanks ? '\n'.repeat(blanks) : ' ') + p;
    first = false; blanks = 0;
  }
  return out;
}

const indentOf = (s) => s.length - s.replace(/^ +/, '').length;

// the text of a line without its comment: a # at the start or after a space, outside quotes, starts a comment
export function stripComment(s) {
  let q = null, prev = ' ';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q === "'") { if (c === "'") { if (s[i + 1] === "'") i++; else q = null; } prev = c; continue; }
    if (q === '"') { if (c === '\\') i++; else if (c === '"') q = null; prev = c; continue; }
    if ((c === '"' || c === "'") && /[\s:\-[{,]/.test(prev)) { q = c; prev = c; continue; }
    if (c === '#' && /\s/.test(prev)) return s.slice(0, i).replace(/\s+$/, '');
    prev = c;
  }
  return s.replace(/\s+$/, '');
}

class Reader {
  constructor(lines, first) { this.lines = lines; this.first = first; this.i = 0; this.anchors = new Map(); }
  no(i = this.i) { return this.first + i + 1; }
  text(i) { return stripComment(this.lines[i]); }
  // the index of the next line with content, from this.i
  next() {
    let i = this.i;
    while (i < this.lines.length && !this.text(i).trim()) i++;
    return i;
  }
  fail(msg, i = this.i) { throw new YamlError(msg, this.no(i)); }

  // a node whose first line has at least this indent, or null when the next content line is less indented
  node(min) {
    const i = this.next();
    if (i >= this.lines.length) { this.i = i; return null; }
    const ind = indentOf(this.lines[i]), t = this.text(i).trim();
    if (ind < min) return null;
    this.i = i;
    if (/^-(?:\s|$)/.test(t)) return this.seq(ind);
    if (keyOf(t, this.no(i))) return this.map(ind);
    return this.scalarAt(t, ind - 1);
  }

  // anchors (&name) and tags (!tag) in front of a value
  props(rest) {
    let anchor = null, tag = null, m;
    while ((m = rest.match(/^([&!])(\S*)\s*/))) {
      if (m[1] === '&') { if (!m[2]) this.fail('An anchor needs a name, as in &base'); anchor = m[2]; } else tag = m[1] + m[2];
      rest = rest.slice(m[0].length);
    }
    return { anchor, tag, rest };
  }
  keep(anchor, tag, v) {
    if (tag === '!!str' && v !== null && typeof v !== 'object') v = String(v);
    else if ((tag === '!!int' || tag === '!!float') && typeof v === 'string' && NUM_FLOAT.test(v)) v = Number(v);
    if (anchor) this.anchors.set(anchor, v);
    return v;
  }

  map(ind) {
    const obj = {};
    for (;;) {
      const i = this.next();
      if (i >= this.lines.length) { this.i = i; break; }
      const li = indentOf(this.lines[i]);
      if (li < ind) break;
      this.i = i;
      const t = this.text(i).trim();
      if (li > ind) this.fail('This line is indented more than the key above it');
      if (/^-(?:\s|$)/.test(t)) break;
      if (/^\?(?:\s|$)/.test(t)) this.fail('Complex keys ("? ") are not supported');
      const kv = keyOf(t, this.no(i));
      if (!kv) this.fail('Expected "key: value" here');
      const v = this.valueAfter(kv.rest, ind);
      if (kv.key === '<<' && !kv.quoted && v && typeof v === 'object') {
        // a merge: keys the map states itself win over the merged ones
        for (const src of Array.isArray(v) ? v : [v]) if (src && typeof src === 'object' && !Array.isArray(src)) for (const k of Object.keys(src)) if (!Object.prototype.hasOwnProperty.call(obj, k)) put(obj, k, src[k]);
        continue;
      }
      put(obj, kv.key, v);
    }
    return obj;
  }

  seq(ind) {
    const arr = [];
    for (;;) {
      const i = this.next();
      if (i >= this.lines.length) { this.i = i; break; }
      const li = indentOf(this.lines[i]), t = this.text(i).trim();
      if (li < ind || !/^-(?:\s|$)/.test(t)) {
        if (li > ind) { this.i = i; this.fail('This line is indented more than the list item above it'); }
        break;
      }
      if (li > ind) { this.i = i; this.fail('This list item is indented more than the one above it'); }
      this.i = i;
      const line = this.lines[i], content = stripComment(line.slice(li + 1));
      const { anchor, tag, rest } = this.props(content.trim());
      let v;
      if (!rest) { this.i = i + 1; v = this.node(ind + 1); }
      else if (/^[|>]/.test(rest)) v = this.block(rest, ind);
      else {
        // the item's text is read as a node of its own, at the column it starts in, so "- a: 1" and the keys under it make one map
        const col = li + 1 + (content.length - content.trimStart().length) + (content.trim().length - rest.length);
        this.lines[i] = ' '.repeat(col) + line.slice(col);
        v = this.node(col);
      }
      arr.push(this.keep(anchor, tag, v));
    }
    return arr;
  }

  // the value after "key:" on the key's own line, or under it
  valueAfter(rest, ind) {
    const { anchor, tag, rest: r } = this.props(rest);
    let v;
    if (!r) {
      const k = this.i;
      this.i = k + 1;
      const j = this.next();
      if (j < this.lines.length && indentOf(this.lines[j]) === ind && /^-(?:\s|$)/.test(this.text(j).trim())) { this.i = j; v = this.seq(ind); }
      else v = this.node(ind + 1);
    } else if (/^[|>]/.test(r)) v = this.block(r, ind);
    else v = this.inline(r, ind);
    return this.keep(anchor, tag, v);
  }

  scalarAt(t, parent) {
    const { anchor, tag, rest } = this.props(t);
    if (!rest) { this.i++; return this.keep(anchor, tag, this.node(parent + 1)); }
    if (/^[|>]/.test(rest)) return this.keep(anchor, tag, this.block(rest, parent));
    return this.keep(anchor, tag, this.inline(rest, parent));
  }

  // a scalar or a flow collection that starts on line this.i; continuation lines must be indented more than parent
  inline(r, parent) {
    const start = this.i;
    if (r[0] === '*') {
      const name = r.slice(1).trim();
      if (!this.anchors.has(name)) this.fail('No anchor named &' + name + ' comes before *' + name);
      this.i++; return this.anchors.get(name);
    }
    if (r[0] === '[' || r[0] === '{') {
      let src = r, j = start;
      for (;;) {
        const f = new Flow(src, this.no(start), this.anchors);
        const res = f.tryAll();
        if (res.ok) { this.i = j + 1; return res.v; }
        if (!res.open || ++j >= this.lines.length) this.fail(res.msg, res.open ? start : j);
        src += '\n' + this.text(j);
      }
    }
    if (r[0] === '"' || r[0] === "'") {
      const q = r[0], parts = [];
      let cur = r.slice(1), j = start;
      for (;;) {
        const end = q === '"' ? closeDouble(cur) : closeSingle(cur);
        if (end >= 0) {
          parts.push(j === start ? cur.slice(0, end) : cur.slice(0, end).trim());
          const after = stripComment(cur.slice(end + 1)).trim();
          if (after) { if (/^:(?:\s|$)/.test(after)) this.fail('A key and value on one line need a map, not a scalar'); this.fail('Text after the closing quote'); }
          this.i = j + 1;
          break;
        }
        parts.push(j === start ? cur.replace(/\s+$/, '') : cur.trim());
        if (++j >= this.lines.length) this.fail('This quoted text is not closed', start);
        cur = this.lines[j];
      }
      const folded = fold(parts.map((p, k) => (k && !p.trim() ? '' : p)));
      return q === '"' ? unescapeDouble(folded, this.no(start)) : folded.replace(/''/g, "'");
    }
    if (/:\s/.test(r) || /:$/.test(r)) this.fail('A key and value on one line need a new line and an indent');
    const parts = [r.trim()];
    let j = start + 1, blanks = 0;
    while (j < this.lines.length) {
      const raw = this.lines[j];
      if (!raw.trim()) { blanks++; j++; continue; }
      const tx = stripComment(raw);
      if (!tx.trim() || indentOf(raw) <= parent || /^\s*#/.test(raw)) break;
      if (keyOf(tx.trim(), this.no(j))) break;
      for (; blanks; blanks--) parts.push('');
      parts.push(tx.trim()); j++;
    }
    this.i = j - blanks;
    return parts.length === 1 ? plainValue(parts[0]) : fold(parts);
  }

  // a | or > block scalar; the header is on line this.i
  block(header, parent) {
    const m = header.match(/^([|>])([1-9]?)([+-]?)([1-9]?)\s*$/);
    if (!m) this.fail('A block scalar header is |, >, or one of them with + - or an indent number');
    const literal = m[1] === '|', chomp = m[3], given = +(m[2] || m[4]) || 0;
    let j = this.i + 1, ci = given ? Math.max(0, parent) + given : 0;
    const body = [];
    for (; j < this.lines.length; j++) {
      const raw = this.lines[j];
      if (!raw.trim()) { body.push(raw.length > ci && ci ? raw.slice(ci) : ''); continue; }
      const li = indentOf(raw);
      if (!ci) { if (li <= parent) break; ci = li; }
      if (li < ci) break;
      body.push(raw.slice(ci));
    }
    let trail = 0;
    while (body.length && !body[body.length - 1].trim()) { body.pop(); trail++; }
    this.i = j - trail;
    if (!body.length) return chomp === '+' ? '\n'.repeat(trail) : '';
    let text = body[0];
    for (let k = 1; k < body.length; k++) {
      const prev = body[k - 1], b = body[k], normal = (x) => x !== '' && !/^\s/.test(x);
      if (literal) { text += '\n' + b; continue; }
      // > folds a break between two plain lines to a space; a break before empty lines goes, unless more-indented text follows them
      let sep = '\n';
      if (normal(prev) && normal(b)) sep = ' ';
      else if (normal(prev) && b === '') { let n = k; while (n < body.length && body[n] === '') n++; if (n < body.length && normal(body[n])) sep = ''; }
      text += sep + b;
    }
    return chomp === '-' ? text : chomp === '+' ? text + '\n' + '\n'.repeat(trail) : text + '\n';
  }
}

function closeDouble(s) { for (let i = 0; i < s.length; i++) { if (s[i] === '\\') i++; else if (s[i] === '"') return i; } return -1; }
function closeSingle(s) { for (let i = 0; i < s.length; i++) { if (s[i] === "'") { if (s[i + 1] === "'") i++; else return i; } } return -1; }

// "key: rest" with a plain or quoted key, or null
function keyOf(t, line) {
  if (t[0] === '"' || t[0] === "'") {
    const end = t[0] === '"' ? closeDouble(t.slice(1)) : closeSingle(t.slice(1));
    if (end < 0) throw new YamlError('A quoted key or value is not closed', line);
    const after = t.slice(end + 2), m = after.match(/^\s*:(?:\s+|$)/);
    if (!m) return null;
    const raw = t.slice(1, end + 1);
    return { key: t[0] === '"' ? unescapeDouble(raw, line) : raw.replace(/''/g, "'"), rest: after.slice(m[0].length).trim(), quoted: true };
  }
  if (/^[[{&*!|>%@`]/.test(t) || /^-(?:\s|$)/.test(t)) return null;
  const m = t.match(/^([^\s#][^#]*?)\s*:(?:\s+|$)/);
  if (!m) return null;
  return { key: m[1], rest: t.slice(m[0].length).trim(), quoted: false };
}

// a key set as data, so a key named "__proto__" is a key like any other
function put(obj, k, v) { Object.defineProperty(obj, k, { value: v, enumerable: true, writable: true, configurable: true }); }

// flow collections: [a, b] and {a: 1, b: 2}, nested, across lines
class Flow {
  constructor(s, line, anchors) { this.s = s; this.p = 0; this.line = line; this.anchors = anchors; }
  tryAll() {
    try {
      const v = this.value();
      this.ws();
      if (this.p < this.s.length) return { ok: false, msg: 'Text after the closing bracket' };
      return { ok: true, v };
    } catch (e) {
      if (e === OPEN) return { ok: false, open: true, msg: 'This [ or { is not closed' };
      if (e instanceof YamlError) return { ok: false, msg: e.message };
      throw e;
    }
  }
  ws() { while (this.p < this.s.length && /\s/.test(this.s[this.p])) this.p++; }
  value() {
    this.ws();
    const c = this.s[this.p];
    if (c === undefined) throw OPEN;
    if (c === '[') return this.list();
    if (c === '{') return this.obj();
    if (c === '"' || c === "'") return this.quoted();
    if (c === '*') {
      const m = this.s.slice(this.p + 1).match(/^[^\s,[\]{}]+/), name = m ? m[0] : '';
      this.p += 1 + name.length;
      if (!this.anchors.has(name)) throw new YamlError('No anchor named &' + name + ' comes before *' + name, this.line);
      return this.anchors.get(name);
    }
    return plainValue(this.plain());
  }
  plain() {
    let out = '';
    while (this.p < this.s.length) {
      const c = this.s[this.p];
      if (',[]{}'.includes(c)) break;
      if (c === ':' && (this.p + 1 >= this.s.length || /[\s,[\]{}]/.test(this.s[this.p + 1]))) break;
      out += c; this.p++;
    }
    return out.replace(/\s*\n\s*/g, ' ').trim();
  }
  quoted() {
    const q = this.s[this.p], rest = this.s.slice(this.p + 1), end = q === '"' ? closeDouble(rest) : closeSingle(rest);
    if (end < 0) throw OPEN;
    this.p += end + 2;
    const raw = fold(rest.slice(0, end).split('\n').map((x, k) => (k ? x.trim() : x)));
    return q === '"' ? unescapeDouble(raw, this.line) : raw.replace(/''/g, "'");
  }
  list() {
    this.p++; const arr = [];
    for (;;) {
      this.ws();
      if (this.p >= this.s.length) throw OPEN;
      if (this.s[this.p] === ']') { this.p++; return arr; }
      arr.push(this.value());
      this.ws();
      if (this.s[this.p] === ',') { this.p++; continue; }
      if (this.s[this.p] === ']') { this.p++; return arr; }
      if (this.p >= this.s.length) throw OPEN;
      throw new YamlError('Expected a comma or ] in this list', this.line);
    }
  }
  obj() {
    this.p++; const o = {};
    for (;;) {
      this.ws();
      if (this.p >= this.s.length) throw OPEN;
      if (this.s[this.p] === '}') { this.p++; return o; }
      const c = this.s[this.p], k = c === '"' || c === "'" ? this.quoted() : this.plain();
      this.ws();
      let v = null;
      if (this.s[this.p] === ':') { this.p++; this.ws(); if (!',}'.includes(this.s[this.p])) v = this.value(); }
      put(o, String(k), v);
      this.ws();
      if (this.s[this.p] === ',') { this.p++; continue; }
      if (this.s[this.p] === '}') { this.p++; return o; }
      if (this.p >= this.s.length) throw OPEN;
      throw new YamlError('Expected a comma or } in this map', this.line);
    }
  }
}
const OPEN = Symbol('open');

/** YAML text to the value of each document. Throws an Error with .line on a fault. Pure. */
export function parseYamlDocs(text) {
  const all = String(text == null ? '' : text).replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').split('\n');
  const tab = all.findIndex((l) => /^ *\t/.test(l) && l.trim());
  if (tab >= 0) throw new YamlError('Indent with spaces: YAML does not allow a tab here', tab + 1);
  const docs = []; let cur = [], first = 0;
  const flush = () => { if (cur.some((l) => stripComment(l).trim() && !/^%/.test(l))) docs.push({ lines: cur.filter((l) => !/^%/.test(l)), first }); };
  all.forEach((l, i) => {
    if (/^---(?:\s|$)/.test(l)) {
      flush(); first = i; cur = [l.slice(3)];
    } else if (/^\.\.\.\s*$/.test(l)) { flush(); cur = []; first = i + 1; }
    else cur.push(l);
  });
  flush();
  return docs.map(({ lines, first: f }) => {
    const r = new Reader(lines, f), v = r.node(0), rest = r.next();
    if (rest < lines.length) r.fail(indentOf(lines[rest]) ? 'This line is indented less than the block it belongs to' : 'Unexpected text here; a document holds one map, list or value', rest);
    return v;
  });
}

/** YAML text to its value; several documents give an array of them. Pure. */
export function parseYaml(text) { const d = parseYamlDocs(text); return d.length === 0 ? null : d.length === 1 ? d[0] : d; }

const what = (v) => Array.isArray(v) ? 'a list of ' + v.length + ' item' + (v.length === 1 ? '' : 's')
  : v && typeof v === 'object' ? 'a map of ' + Object.keys(v).length + ' key' + (Object.keys(v).length === 1 ? '' : 's') : 'a single value';

/** YAML text to { json, what, docs }, or { error } that names the line. Pure. */
export function yamlToJson(text) {
  if (!String(text || '').trim()) return { error: 'Paste YAML first.' };
  try {
    const d = parseYamlDocs(text), v = d.length === 0 ? null : d.length === 1 ? d[0] : d;
    return { json: JSON.stringify(v, null, 2), what: d.length > 1 ? d.length + ' documents, as one list' : what(v), docs: d.length };
  } catch (e) {
    if (e instanceof YamlError) return { error: 'Line ' + e.line + ': ' + e.message + '.' };
    throw e;
  }
}

// a string YAML must quote: empty, edge spaces, a value of another type (or a YAML 1.1 boolean), an indicator first, ": " or " #" inside
function needsQuote(s) {
  if (s === '' || s !== s.trim() || /[\x00-\x1f\x7f\u2028\u2029\x85]/.test(s)) return true;
  if (typeof plainValue(s) !== 'string') return true;
  if (/^(?:y|n|yes|no|on|off|\.inf|-\.inf|\+\.inf|\.nan)$/i.test(s) || NUM_FLOAT.test(s.replace(/_/g, '')) || /^0[xob]/i.test(s)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s) || /:(?:\s|$)|\s#/.test(s)) return true;
  return false;
}

function keyText(k) { return needsQuote(k) ? JSON.stringify(k) : k; }

// a scalar as { line } or, for text with line breaks, as a | block { head, body }
function scalar(v) {
  if (v === null) return { line: 'null' };
  if (typeof v === 'boolean' || typeof v === 'number') return { line: String(v) };
  const s = String(v);
  if (s.includes('\n') && !/[\x00-\x09\x0b-\x1f\x7f\r\u2028\u2029\x85]/.test(s) && !/^[ \n]/.test(s) && !/[ ]\n/.test(s)) {
    const core = s.replace(/\n+$/, ''), tail = s.length - core.length;
    return { head: '|' + (tail === 0 ? '-' : tail === 1 ? '' : '+'), body: (tail > 1 ? s.slice(0, -1) : core).split('\n') };
  }
  return { line: needsQuote(s) ? JSON.stringify(s) : s };
}

const isBlock = (v) => v && typeof v === 'object' && (Array.isArray(v) ? v.length : Object.keys(v).length);

// a value as YAML lines at this indent
function linesOf(v, pad) {
  const out = [];
  if (Array.isArray(v)) {
    for (const item of v) {
      if (isBlock(item)) { const sub = linesOf(item, pad + '  '); out.push(pad + '- ' + sub[0].slice(pad.length + 2), ...sub.slice(1)); continue; }
      const sc = item && typeof item === 'object' ? { line: Array.isArray(item) ? '[]' : '{}' } : scalar(item);
      if (sc.head) out.push(pad + '- ' + sc.head, ...sc.body.map((b) => (b ? pad + '  ' + b : '')));
      else out.push(pad + '- ' + sc.line);
    }
    return out;
  }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const val = v[k];
      if (isBlock(val)) { out.push(pad + keyText(k) + ':', ...linesOf(val, pad + '  ')); continue; }
      const sc = val && typeof val === 'object' ? { line: Array.isArray(val) ? '[]' : '{}' } : scalar(val);
      if (sc.head) out.push(pad + keyText(k) + ': ' + sc.head, ...sc.body.map((b) => (b ? pad + '  ' + b : '')));
      else out.push(pad + keyText(k) + ': ' + sc.line);
    }
    return out;
  }
  const sc = scalar(v);
  return sc.head ? [sc.head, ...sc.body.map((b) => (b ? '  ' + b : ''))] : [sc.line];
}

/** a value as YAML text. Pure. */
export function toYaml(v) {
  if (v && typeof v === 'object' && !isBlock(v)) return Array.isArray(v) ? '[]' : '{}';
  return linesOf(v, '').join('\n');
}

/** JSON text to { yaml, what }, or { error }. Pure. */
export function jsonToYaml(text) {
  if (!String(text || '').trim()) return { error: 'Paste JSON first.' };
  let v;
  try { v = JSON.parse(String(text)); } catch (e) { return { error: 'That is not valid JSON: ' + String(e.message || e).replace(/^JSON\.parse:\s*/, '') }; }
  return { yaml: toYaml(v), what: what(v) };
}
