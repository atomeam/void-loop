// /kanban/: written by tools/tool-site-pages.mjs from lib/tool-sites.js; edit the row, not this file
import { mountRelated } from '/lib/toolkit.js';
import { mountKanban } from '/lib/kanban-ui.js';
mountKanban(document.getElementById('app'), {"features":{"boards":1,"wip":1,"lanes":1,"labels":1,"due":1,"checklist":1,"comments":1,"assignee":1,"archive":1,"filter":1,"trello":1,"timer":1,"recur":1,"print":1,"csv":1,"share":1,"colour":1,"templates":1}});
mountRelated(document.getElementById('related'), '/kanban/');
