// /pdf/toolbox/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountPdf } from '/lib/pdf-ui.js';
mountPdf(document.getElementById('app'), {"tools":["merge","split","extract","order","rotate","compress","img2pdf","pdf2img","watermark","numbers","crop","info","pages"]});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/pdf/toolbox/'));
