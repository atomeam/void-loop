// Five-part test body: one closed box per MIT material class, side by side.
import { zipStore } from '../../../void-live-deploy/skills/print-file.js';
import { writeFileSync, mkdirSync } from 'node:fs';
// Usage: node domains/forethinkers/experiments/3mf-slot-test.mjs [outdir]
// Writes seven 3MF variants (A-G). Only E keeps five names on extruders 1-5 in OrcaSlicer 2.4.2 (slot test 2026-10-07).
const OUT = process.argv[2] || '/tmp/3mf-slot-test';
mkdirSync(OUT, { recursive: true });
const MATS = [
  ['dielectric', '#E8E2D0'], ['conductive', '#B87333'], ['soft-magnetic', '#5A5F66'],
  ['hard-magnetic', '#1F2A44'], ['flexible', '#3FA34D'],
];
function box(x0, w = 8, d = 8, h = 6) {
  const v = [[0,0,0],[w,0,0],[w,d,0],[0,d,0],[0,0,h],[w,0,h],[w,d,h],[0,d,h]].map(([x,y,z]) => [x + x0, y, z]);
  const t = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  return { v, t };
}
function mesh({ v, t }, triAttr = () => '') {
  return '<mesh><vertices>' + v.map(([x,y,z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('') + '</vertices><triangles>'
    + t.map(([a,b,c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"${triAttr()}/>`).join('') + '</triangles></mesh>';
}
const CT = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>';
const RELS = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
const base = '<basematerials id="1">' + MATS.map(([n, c]) => `<base name="${n}" displaycolor="${c}FF"/>`).join('') + '</basematerials>';
const cg = '<m:colorgroup id="2">' + MATS.map(([, c]) => `<m:color color="${c}FF"/>`).join('') + '</m:colorgroup>';
const NS = 'unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"';
function model(pidOf, withAssembly) {
  let objs = '', items = '';
  MATS.forEach(([n], i) => {
    const [pid, pindex] = pidOf(i);
    objs += `<object id="${10 + i}" type="model" name="${n}" pid="${pid}" pindex="${pindex}">${mesh(box(i * 10))}</object>`;
  });
  if (withAssembly) {
    objs += '<object id="20" type="model" name="motor-body"><components>' + MATS.map((_, i) => `<component objectid="${10 + i}"/>`).join('') + '</components></object>';
    items = '<item objectid="20"/>';
  } else items = MATS.map((_, i) => `<item objectid="${10 + i}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><model ${NS} requiredextensions=""><metadata name="Application">ft-3mf-test</metadata><resources>${base}${cg}${objs}</resources><build>${items}</build></model>`;
}
const variants = {
  'A-core-basematerials-objects': model((i) => [1, i], false),
  'B-colorgroup-objects': model((i) => [2, i], false),
  'C-colorgroup-assembly': model((i) => [2, i], true),
  'D-core-basematerials-assembly': model((i) => [1, i], true),
};
for (const [name, xml] of Object.entries(variants)) {
  writeFileSync(`${OUT}/${name}.3mf`, zipStore([
    { name: '[Content_Types].xml', data: CT }, { name: '_rels/.rels', data: RELS }, { name: '3D/3dmodel.model', data: xml },
  ]));
}
console.log(Object.keys(variants).join('\n'));
// One colorgroup per material (the layout Bambu Studio writes), plus basematerials names kept.
const cgs = MATS.map(([, c], i) => `<m:colorgroup id="${2 + i}"><m:color color="${c}FF"/></m:colorgroup>`).join('');
function model2(withAssembly) {
  let objs = '', items = '';
  MATS.forEach(([n], i) => { objs += `<object id="${10 + i}" type="model" name="${n}" pid="${2 + i}" pindex="0">${mesh(box(i * 10))}</object>`; });
  if (withAssembly) { objs += '<object id="20" type="model" name="motor-body"><components>' + MATS.map((_, i) => `<component objectid="${10 + i}"/>`).join('') + '</components></object>'; items = '<item objectid="20"/>'; }
  else items = MATS.map((_, i) => `<item objectid="${10 + i}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><model ${NS}><metadata name="Application">ft-3mf-test</metadata><resources>${base}${cgs}${objs}</resources><build>${items}</build></model>`;
}
for (const [name, xml] of Object.entries({ 'E-colorgroup-per-material-objects': model2(false), 'F-colorgroup-per-material-assembly': model2(true) })) {
  writeFileSync(`${OUT}/${name}.3mf`, zipStore([{ name: '[Content_Types].xml', data: CT }, { name: '_rels/.rels', data: RELS }, { name: '3D/3dmodel.model', data: xml }]));
  console.log(name);
}
// Assembly where each component's triangles carry their own colorgroup.
{
  let objs = '';
  MATS.forEach(([n], i) => { objs += `<object id="${10 + i}" type="model" name="${n}">${mesh(box(i * 10), () => ` pid="${2 + i}" p1="0"`)}</object>`; });
  objs += '<object id="20" type="model" name="motor-body"><components>' + MATS.map((_, i) => `<component objectid="${10 + i}"/>`).join('') + '</components></object>';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><model ${NS}><metadata name="Application">ft-3mf-test</metadata><resources>${base}${cgs}${objs}</resources><build><item objectid="20"/></build></model>`;
  writeFileSync(`${OUT}/G-assembly-triangle-colors.3mf`, zipStore([{ name: '[Content_Types].xml', data: CT }, { name: '_rels/.rels', data: RELS }, { name: '3D/3dmodel.model', data: xml }]));
}
