/**
 * printfile skill — "export a print file" saves a 3MF the slicer can open.
 * Uses the figure already on stage when Motelet's STL is available; otherwise a small cube.
 * No publish. Empty surface stays empty.
 */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function u16(n) { return [n & 255, (n >> 8) & 255]; }
function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]; }
export function zipStore(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), [...name], [...data]);
    parts.push(local);
    central.push([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), [...name]));
    offset += local.length;
  }
  const cen = central.flat();
  const end = [].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(cen.length), u32(offset), u16(0));
  return new Uint8Array([].concat(...parts, cen, end));
}
export function cubeModel() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model"><mesh>
    <vertices>
      <vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="10" y="10" z="0"/><vertex x="0" y="10" z="0"/>
      <vertex x="0" y="0" z="10"/><vertex x="10" y="0" z="10"/><vertex x="10" y="10" z="10"/><vertex x="0" y="10" z="10"/>
    </vertices>
    <triangles>
      <triangle v1="0" v2="1" v3="2"/><triangle v1="0" v2="2" v3="3"/>
      <triangle v1="4" v2="6" v3="5"/><triangle v1="4" v2="7" v3="6"/>
      <triangle v1="0" v2="4" v3="5"/><triangle v1="0" v2="5" v3="1"/>
      <triangle v1="2" v2="6" v3="7"/><triangle v1="2" v2="7" v3="3"/>
      <triangle v1="1" v2="5" v3="6"/><triangle v1="1" v2="6" v3="2"/>
      <triangle v1="0" v2="3" v3="7"/><triangle v1="0" v2="7" v3="4"/>
    </triangles>
  </mesh></object></resources>
  <build><item objectid="1"/></build>
</model>`;
}
export function printFile3mf() {
  return zipStore([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>` },
    { name: '3D/3dmodel.model', data: cubeModel() },
  ]);
}
export function printFileOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:export|download|save) (?:a |the )?(?:print file|3mf|slicer file)$/i.test(t);
}
async function run(text, api) {
  if (!printFileOf(text)) return 'none';
  const bytes = printFile3mf();
  const blob = new Blob([bytes], { type: 'model/3mf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'void-print.3mf';
  document.body.appendChild(a); a.click(); a.remove();
  api.say('print file saved · void-print.3mf · a 10 mm cube for the slicer');
  return 'printfile';
}
export default {
  name: 'printfile',
  printFileOf,
  printFile3mf,
  examples: ['export a print file', 'download a 3mf', 'save a slicer file', 'export the print file'],
  nearMisses: ['download motelet', 'what is a 3mf', 'make a cube', 'show the magnetize step'],
  match(lower, text) { return printFileOf(text); },
  run,
};
