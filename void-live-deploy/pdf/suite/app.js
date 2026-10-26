// /pdf/suite/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountPdf } from '/lib/pdf-ui.js';
mountPdf(document.getElementById('app'), {"tools":["merge","split","pages","extract","rotate","compress","img2pdf","pdf2img","numbers","watermark","crop","info"]});
mountRelated(document.getElementById('related'), '/pdf/suite/');
