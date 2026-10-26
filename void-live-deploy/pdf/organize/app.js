// /pdf/organize/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountPdf } from '/lib/pdf-ui.js';
mountPdf(document.getElementById('app'), {"tools":["pages","merge","split"],"also":["rotate","extract","img2pdf","compress"]});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/pdf/organize/'));
