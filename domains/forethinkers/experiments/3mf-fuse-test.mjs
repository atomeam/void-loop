// Fused-body slice test (2026-11-04): five touching parts in the slot-tested layout E (one object per part, each with its own one-color colorgroup).
// Usage: node domains/forethinkers/experiments/3mf-fuse-test.mjs [outdir]  -> E-row.3mf (five bars sharing side faces), E-stack.3mf (five 3 mm layers sharing top faces).
// Slice with OrcaSlicer 2.4.2 CLI: --arrange 0 --orient 0 --load-settings "machine.json;process.json" --load-filaments "f1..f5.json" --slice 0 (flatten BBL profiles with orca-flatten-profile.mjs).
import { zipStore } from '../../../void-live-deploy/skills/print-file.js';
import { writeFileSync, mkdirSync } from 'node:fs';
const OUT = process.argv[2] || '/tmp/3mf-fuse-test'; mkdirSync(OUT, { recursive: true });
const MATS = [['dielectric','#E8E2D0'],['conductive','#B87333'],['soft-magnetic','#5A5F66'],['hard-magnetic','#1F2A44'],['flexible','#3FA34D']];
const T = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
const box = ([x,y,z],[w,d,h]) => ({ v: [[0,0,0],[w,0,0],[w,d,0],[0,d,0],[0,0,h],[w,0,h],[w,d,h],[0,d,h]].map(([a,b,c])=>[a+x,b+y,c+z]), t: T });
const mesh = ({v,t}) => '<mesh><vertices>'+v.map(([x,y,z])=>`<vertex x="${x}" y="${y}" z="${z}"/>`).join('')+'</vertices><triangles>'+t.map(([a,b,c])=>`<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join('')+'</triangles></mesh>';
const CT='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
const RELS='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
const NS='unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"';
const base='<basematerials id="1">'+MATS.map(([n,c])=>`<base name="${n}" displaycolor="${c}FF"/>`).join('')+'</basematerials>';
const cgs=MATS.map(([,c],i)=>`<m:colorgroup id="${2+i}"><m:color color="${c}FF"/></m:colorgroup>`).join('');
// Layouts with shared faces (zero gap). Offsets put the body near bed centre (128,128).
const layouts = {
  // side by side along x: five 8x8x6 bars touching
  'row': MATS.map((_,i)=>box([110+i*8,124,0],[8,8,6])),
  // stacked like a motor: dielectric base, conductive layer, soft core, hard ring layer, flexible cap
  'stack': MATS.map((_,i)=>box([118,118,i*3],[20,20,3])),
};
for (const [name, boxes] of Object.entries(layouts)) {
  const objs = boxes.map((b,i)=>`<object id="${10+i}" type="model" name="${MATS[i][0]}" pid="${2+i}" pindex="0">${mesh(b)}</object>`).join('');
  const items = boxes.map((_,i)=>`<item objectid="${10+i}"/>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><model ${NS}><metadata name="Application">ft-3mf-fuse-test</metadata><resources>${base}${cgs}${objs}</resources><build>${items}</build></model>`;
  writeFileSync(`${OUT}/E-${name}.3mf`, zipStore([{name:'[Content_Types].xml',data:CT},{name:'_rels/.rels',data:RELS},{name:'3D/3dmodel.model',data:xml}]));
  console.log(`${OUT}/E-${name}.3mf`);
}
