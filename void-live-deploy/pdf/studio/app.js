// /pdf/studio/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountPdf } from '/lib/pdf-ui.js';
mountPdf(document.getElementById('app'), {"tools":["compress","merge","split","pages","rotate","extract","img2pdf","pdf2img","numbers","watermark","crop","info"]});
mountRelated(document.getElementById('related'), '/pdf/studio/');
