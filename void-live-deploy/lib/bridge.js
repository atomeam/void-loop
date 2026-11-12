// Deterministic local analyzer for Live Workspace Fusion bridge cards.
// Extracts field names, endpoints, URLs and simple types from staged inputs to surface
// connections (including snake_case <-> camelCase) and deltas (type/name mismatches).

const SNAKE = /[a-z0-9]+(?:_[a-z0-9]+)+/g;
const CAMEL = /\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g;
const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;
const ENDPOINT_RE = /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s"'`)]*)|\b(\/v\d+\/[a-z0-9/_\-{}:.]*)/gi;
const JSON_KEY_RE = /"([A-Za-z0-9_.-]+)"\s*:/g;
const PATH_RE = /["'`](\/[a-z0-9][a-z0-9/_\-{}:.]*)["'`]|(?:^|\s)(\/v\d+\/[a-z0-9/_\-{}:.]*)/gim;
const TRANSPORT_KEYS = new Set(['body', 'headers', 'method', 'params', 'query', 'queries', 'response', 'request', 'path', 'url', 'endpoint', 'status', 'statuscode', 'data', 'payload', 'options', 'config']);

function normName(s) { return String(s || '').replace(/[_-]+/g, '').toLowerCase(); }
function uniq(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }
function clip(s, n = 160) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; } // ellipsis-ok: utility clip, callers wrap or scroll the full text
function isPayloadLeaf(keys, types) { // heuristic: treat as a payload wrapper (not a leaf field name) when it mostly carries nested fields
  const set = new Set(keys || []);
  return ['user_id','userid','id','name','email','title','value','amount','price','count'].some(k => set.has(k)) || Object.keys(types || {}).length > 0;
}

function extract(input) {
  const text = String(input.content || '');
  const keys = []; let m;
  const kr = new RegExp(JSON_KEY_RE); while ((m = kr.exec(text))) keys.push(m[1]); // void-review: ok (constant regex literal, not user input)
  const snake = text.match(SNAKE) || [];
  const camel = text.match(CAMEL) || [];
  const urls = uniq((text.match(URL_RE) || []).concat(input.sourceUrl ? [input.sourceUrl] : []));
  const endpoints = [];
  const er = new RegExp(ENDPOINT_RE); while ((m = er.exec(text))) endpoints.push((m[1] || m[2] || '').trim()); // void-review: ok (constant regex literal, not user input)
  const pr = new RegExp(PATH_RE); while ((m = pr.exec(text))) { const p = (m[1] || m[2] || '').trim(); if (p && p !== '/' && /\/[a-z0-9]/i.test(p)) endpoints.push(p); } // void-review: ok (constant regex literal, not user input)
  const params = []; const types = {};
  const fn = /\bfunction\s+[A-Za-z0-9_$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*(?::\s*[^{=]+)?\s*(?:=>|\{)/g;
  while ((m = fn.exec(text))) {
    const raw = (m[1] || m[2] || '');
    raw.split(',').forEach((p) => {
      const pt = p.trim(); if (!pt) return;
      const tm = pt.match(/^([A-Za-z0-9_$]+)\s*(?::\s*([A-Za-z0-9_\[\]|<>]+))?/);
      if (tm) { params.push(tm[1]); if (tm[2]) types[tm[1]] = String(tm[2]).toLowerCase(); }
    });
  }
  const tr = /\b([A-Za-z0-9_$]+)\s*:\s*(string|number|boolean|int|integer|float|any|unknown)/gi;
  while ((m = tr.exec(text))) types[m[1]] = String(m[2]).toLowerCase();
  const vr = /"([A-Za-z0-9_.-]+)"\s*:\s*"[^"]*"/g; while ((m = vr.exec(text))) if (!types[m[1]]) types[m[1]] = 'string';
  const vrn = /"([A-Za-z0-9_.-]+)"\s*:\s*-?\d(?:[\d.]*)/g; while ((m = vrn.exec(text))) if (!types[m[1]]) types[m[1]] = 'number';
  const names = uniq([].concat(keys, snake, camel, params));
  const payload = isPayloadLeaf(keys, types);
  return { id: input.id, kind: input.kind, title: input.title || '', sourceUrl: input.sourceUrl || '', names, keys: uniq(keys), snake: uniq(snake), camel: uniq(camel), params: uniq(params), types, urls, endpoints: uniq(endpoints), payload, text };
}

function isTransportName(name, ex) {
  const n = normName(name);
  if (!TRANSPORT_KEYS.has(n)) return false;
  // allow if it looks like an actual payload leaf (e.g. an explicit param/type with same name) on a side that is itself a payload/leaf collection
  if (ex.payload && (ex.params.includes(name) || ex.types[name])) return false;
  // if it's only present as a wrapper-like key among other payload keys, treat as transport wrapper
  return true;
}

function findConnections(a, b) {
  const out = []; const seen = new Set();
  for (const x of a.names) for (const y of b.names) {
    if (isTransportName(x, a) || isTransportName(y, b)) continue;
    if (x === y) {
      const k = 'eq:' + x; if (seen.has(k)) continue; seen.add(k);
      out.push({ from: a.id, to: b.id, type: 'field-map', detail: `Shared name \`${x}\` appears in both inputs`, refs: { a: x, b: y }, confidence: 'high' });
    } else if (normName(x) && normName(x) === normName(y) && (/_/.test(x) || /_/.test(y) || /[A-Z]/.test(x) || /[A-Z]/.test(y))) {
      const k = 'norm:' + normName(x); if (seen.has(k)) continue; seen.add(k);
      const style = (/_/.test(x) ? 'snake_case' : 'camelCase') + ' ↔ ' + (/_/.test(y) ? 'snake_case' : 'camelCase');
      out.push({ from: a.id, to: b.id, type: 'field-map', detail: `Likely same field with different naming: \`${x}\` (${a.title || a.id}) ↔ \`${y}\` (${b.title || b.id}) [${style}]`, refs: { a: x, b: y }, confidence: 'high' });
    }
  }
  const epA = new Set(a.endpoints), epB = new Set(b.endpoints);
  for (const e of epA) if (epB.has(e)) { const k = 'ep:' + e; if (seen.has(k)) continue; seen.add(k); out.push({ from: a.id, to: b.id, type: 'endpoint', detail: `Shared endpoint/path \`${e}\``, refs: { a: e, b: e }, confidence: 'high' }); }
  for (const u of a.urls) if (b.text.includes(u)) out.push({ from: a.id, to: b.id, type: 'dependency', detail: `URL ${clip(u, 80)} from ${a.title || a.id} is referenced in ${b.title || b.id}`, refs: { a: u, b: u }, confidence: 'medium' });
  return out;
}

function findDeltas(a, b, connections) {
  const out = [];
  for (const c of connections) {
    if (c.type !== 'field-map' || !c.refs) continue;
    const ta = (a.types[c.refs.a] || '').toLowerCase();
    const tb = (b.types[c.refs.b] || '').toLowerCase();
    if (ta && tb && ta !== tb) out.push({ severity: 'mismatch', between: [a.id, b.id], detail: `Type mismatch for \`${c.refs.a}\` ↔ \`${c.refs.b}\`: ${ta} vs ${tb}`, evidence: { a: `${c.refs.a}: ${ta}`, b: `${c.refs.b}: ${tb}` }, refs: c.refs });
    if (c.refs.a !== c.refs.b) out.push({ severity: 'info', between: [a.id, b.id], detail: `Naming differs: \`${c.refs.a}\` vs \`${c.refs.b}\` (map/normalize at the boundary)`, evidence: { a: c.refs.a, b: c.refs.b }, refs: c.refs });
  }
  if (!connections.length) out.push({ severity: 'info', between: [a.id, b.id], detail: 'No obvious shared fields/endpoints detected from excerpts; synthesis may need more context.', evidence: {} });
  return out;
}

function buildActions(connections, deltas, exById) {
  const actions = [];
  const fieldMaps = connections.filter(c => c.type === 'field-map' && c.refs);
  const hasRename = fieldMaps.some(c => c.refs.a !== c.refs.b);
  const hasMismatch = deltas.some(d => d.severity === 'mismatch' && d.refs);
  if (fieldMaps.length) {
    const ex = exById || {};
    const score = (id, name) => {
      const e = ex[id] || {}; let s = 0;
      if ((e.keys || []).includes(name)) s += 3;
      if (/_/.test(name)) s += 1;
      if ((e.params || []).includes(name)) s -= 2;
      return s;
    };
    const lines = fieldMaps.slice(0, 8).map(c => {
      let { a, b } = c.refs; // a from c.from, b from c.to
      let fromId = c.from, toId = c.to;
      // orient so target/output key is the payload/schema-ish side when clear, source is caller side
      if (score(fromId, a) < score(toId, b)) { [a, b] = [b, a]; [fromId, toId] = [toId, fromId]; }
      const targetName = a, sourceName = b, targetId = fromId, sourceId = toId;
      const d = deltas.find(x => x.refs && ((x.refs.a === c.refs.a && x.refs.b === c.refs.b) || (x.refs.a === c.refs.b && x.refs.b === c.refs.a)));
      let expr = `input.${sourceName}`;
      if (d && /string vs number|number vs string/i.test(d.detail)) {
        const tgtType = (ex[targetId] && ex[targetId].types && ex[targetId].types[targetName]) || '';
        const srcType = (ex[sourceId] && ex[sourceId].types && ex[sourceId].types[sourceName]) || '';
        if (/string/.test(tgtType)) expr = `String(input.${sourceName})`;
        else if (/number|int|integer|float/.test(tgtType)) expr = `Number(input.${sourceName})`;
        else if (/number|int|integer|float/.test(srcType)) expr = `String(input.${sourceName})`;
        else if (/string/.test(srcType)) expr = `Number(input.${sourceName})`;
      }
      if (sourceName === targetName) return `  ${JSON.stringify(targetName)}: ${expr},`;
      return `  ${JSON.stringify(targetName)}: ${expr}, // ${sourceName} -> ${targetName}`;
    });
    const code = `// adapter: normalize caller payload for the endpoint\nfunction adapt(input) {\n  return {\n${lines.join('\n')}\n  };\n}\n`;
    actions.push({ id: 'act_adapter', label: 'Copy adapter scaffold', kind: 'copy', rationale: hasMismatch ? 'Normalizes naming/types at the call site' : 'Maps field names across inputs', payload: { code } });
  }
  if (!actions.length) actions.push({ id: 'act_compare', label: 'Copy comparison summary', kind: 'copy', rationale: 'Keep a record of how these inputs relate', payload: { code: connections.map(c => '- ' + c.detail).join('\n') || '- No direct overlap found' } });
  actions.push({ id: 'act_refine', label: 'Refine with a follow-up ask', kind: 'ask', rationale: 'Ask Verse to go deeper on a specific connection or delta', payload: { ask: 'Focus on the most important mismatch between these inputs and propose a concrete fix.' } });
  return actions;
}

export function analyzeBridge(rawInputs, ask = '') {
  const inputs = (rawInputs || []).slice(0, 3).map((it, i) => ({ id: it.id || ('in_' + (i + 1)), kind: it.kind || 'snippet', title: String(it.title || ('Input ' + (i + 1))).slice(0, 120), sourceUrl: String(it.sourceUrl || '').slice(0, 500), content: String(it.content || '').slice(0, 6000) }));
  const ex = inputs.map(extract);
  const connections = []; const deltas = [];
  for (let i = 0; i < ex.length; i++) for (let j = i + 1; j < ex.length; j++) {
    const cs = findConnections(ex[i], ex[j]);
    connections.push(...cs);
    deltas.push(...findDeltas(ex[i], ex[j], cs));
  }
  const ckey = new Set(); const cuniq = connections.filter(c => { const k = [c.from,c.to,c.type,c.refs&&c.refs.a,c.refs&&c.refs.b,c.detail].join('|'); if (ckey.has(k)) return false; ckey.add(k); return true; });
  const dkey = new Set(); const duniq = deltas.filter(d => { const k = [d.severity,(d.between||[]).join(','),d.detail].join('|'); if (dkey.has(k)) return false; dkey.add(k); return true; });
  const exById = Object.fromEntries(ex.map(e => [e.id, e]));
  const nextActions = buildActions(cuniq, duniq, exById);
  const limitations = [];
  inputs.forEach((it) => { if (!String(it.content || '').trim()) limitations.push(`No content captured for ${it.title || it.id}`); });
  if (inputs.some(it => String(it.content || '').length >= 6000)) limitations.push('Synthesis used truncated excerpts (first 6000 chars per input).');
  const mismatchCount = duniq.filter(d => d.severity !== 'info').length;
  const summary = cuniq.length ? `Found ${cuniq.length} connection${cuniq.length === 1 ? '' : 's'} and ${mismatchCount} notable delta${mismatchCount === 1 ? '' : 's'} across ${inputs.length} inputs.` : `Compared ${inputs.length} inputs but found no obvious shared fields/endpoints from the available excerpts.`;
  return { kind: 'bridge', version: 1, inputs: inputs.map(({id, kind, title, sourceUrl}) => ({id, kind, title, sourceUrl})), summary, connections: cuniq, deltas: duniq, nextActions, actions: nextActions, limitations, ask: String(ask || '').slice(0, 300) };
}
