// /pdf/toolbox/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountPdf } from '/lib/pdf-ui.js';
mountPdf(document.getElementById('app'), {"tools":["merge","split","extract","rotate","compress","img2pdf","pdf2img","watermark","numbers","crop","info","pages"]});
mountRelated(document.getElementById('related'), '/pdf/toolbox/');
