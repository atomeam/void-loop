/**
 * print-file skill — export the stage as one 3MF a slicer can open.
 * Uses the bodies already built for the stage (figure.js). An empty stage
 * stays empty: no stand-in cube, no published page.
 * "download motelet" stays with the figure skill (STL of that one body).
 */
import { bodyFor } from './figure.js';

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function printFileOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?export\s+a\s+print\s+file$/i.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?export\s+the\s+stage(?:\s+as\s+(?:a\s+)?3mf)?$/i.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?(?:save|download)\s+(?:a\s+)?(?:3mf|print\s+file)(?:\s+of\s+the\s+stage)?$/i.test(t)) return { what: 'stage' };
  if (/^(?:please\s+)?print\s+file\s+for\s+the\s+slicer$/i.test(t)) return { what: 'stage' };
  return null;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function u16(n) { return [n & 255, (n >> 8) & 255]; }
function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]; }

/** STORE zip (no compression). 3MF is a package, so a slicer needs the zip, not bare XML. */
export function zipStore(files) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : enc.encode(f.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);
    const cen = new Uint8Array(46 + name.length);
    cen.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset)]);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length;
  }
  const cenBytes = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  end.set([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cenBytes), ...u32(offset), 0, 0]);
  const out = new Uint8Array(offset + cenBytes + 22);
  let p = 0;
  for (const local of locals) { out.set(local, p); p += local.length; }
  for (const cen of central) { out.set(cen, p); p += cen.length; }
  out.set(end, p);
  return out;
}

function num(v) {
  const n = Math.abs(v) < 1e-9 ? 0 : +v.toFixed(4);
  return String(n);
}

/** Triangles already on the stage. Empty in, empty out. */
export function stageTriangles(things) {
  const list = Object.values(things || {}).filter((t) => t && t.kind === 'fig3d');
  if (!list.length) return [];
  const tris = [];
  list.forEach((th, i) => {
    const parts = bodyFor(th, things) || [];
    const dx = i * 40;
    for (const part of parts) for (const [a, b, c] of part.tris || []) {
      tris.push([[a[0] + dx, a[1], a[2]], [b[0] + dx, b[1], b[2]], [c[0] + dx, c[1], c[2]]]);
    }
  });
  return tris;
}

export function modelXml(tris) {
  const verts = [];
  const faces = [];
  const key = (v) => v.map(num).join(',');
  const at = new Map();
  for (const [a, b, c] of tris) {
    const ids = [a, b, c].map((v) => {
      const k = key(v);
      if (at.has(k)) return at.get(k);
      const id = verts.length;
      verts.push(v);
      at.set(k, id);
      return id;
    });
    faces.push(ids);
  }
  const vxml = verts.map((v) => '<vertex x="' + num(v[0]) + '" y="' + num(v[1]) + '" z="' + num(v[2]) + '"/>').join('');
  const txml = faces.map((f) => '<triangle v1="' + f[0] + '" v2="' + f[1] + '" v3="' + f[2] + '"/>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
    + '<resources><object id="1" type="model"><mesh><vertices>' + vxml + '</vertices><triangles>' + txml + '</triangles></mesh></object></resources>'
    + '<build><item objectid="1"/></build></model>';
}

/** 3MF package, or null when the stage has nothing to print. */
export function stage3mf(things) {
  const tris = stageTriangles(things);
  if (!tris.length) return null;
  const model = modelXml(tris);
  return zipStore([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
    { name: '3D/3dmodel.model', data: model }
  ]);
}

function save3mf(bytes) {
  const blob = new Blob([bytes], { type: 'model/3mf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'void-stage.3mf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function run(text, api) {
  const hit = printFileOf(text);
  if (!hit) return 'none';
  const things = api.stage && api.stage.things ? api.stage.things() : {};
  const file = stage3mf(things);
  if (!file) {
    if (api.say) api.say('the stage is empty');
    return 'print-file';
  }
  save3mf(file);
  if (api.say) api.say('void-stage.3mf · ' + Object.values(things).filter((t) => t && t.kind === 'fig3d').length + ' on the stage');
  return 'print-file';
}

export default {
  name: 'print-file',
  examples: ['export a print file', 'export the stage as 3mf', 'download a 3mf of the stage', 'save a print file', 'print file for the slicer'],
  nearMisses: ['download motelet', 'summon motelet', 'export a csv', 'what is a slicer'],
  printFileOf,
  stageTriangles,
  stage3mf,
  match(lower, text) { return !!printFileOf(text); },
  run
};
