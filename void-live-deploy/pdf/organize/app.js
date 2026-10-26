// /pdf/organize/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountPdf } from '/lib/pdf-ui.js';
mountPdf(document.getElementById('app'), {"tools":["pages","merge"]});
mountRelated(document.getElementById('related'), '/pdf/organize/');
