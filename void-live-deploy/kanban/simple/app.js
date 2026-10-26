// /kanban/simple/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountKanban } from '/lib/kanban-ui.js';
mountKanban(document.getElementById('app'), {"features":{"filter":1,"due":1,"labels":1,"checklist":1,"archive":1,"csv":1}});
mountRelated(document.getElementById('related'), '/kanban/simple/');
