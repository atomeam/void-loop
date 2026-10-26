// /kanban/quick/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountKanban } from '/lib/kanban-ui.js';
mountKanban(document.getElementById('app'), {"features":{"filter":1,"due":1,"labels":1,"checklist":1,"archive":1,"share":1}});
// the related row and the ask bar come after the first paint, so the page itself loads first
import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/kanban/quick/'));
