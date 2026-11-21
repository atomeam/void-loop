// /jobs/: one page for every jobs-lane site. Written by tools/tool-site-pages.mjs; query picks the panel.
const ALL = ["search","saved","alerts","tracker","feed","sources","regions","categories","tags","companies"];
const go = () => {
  const q = new URLSearchParams(location.search);
  const panel = q.get('panel');
  const preset = {};
  if (q.get('region')) preset.region = q.get('region');
  if (q.get('salary') === '1' || q.get('salary') === 'true') { preset.salaryOnly = true; preset.sort = q.get('sort') || 'salary'; }
  if (q.get('sort')) preset.sort = q.get('sort');
  return import('/lib/jobs-ui.js').then(({ mountJobs }) => {
    mountJobs(document.getElementById('app'), { panels: ALL, preset, de: {"h1":"Jobs","intro":"Suchen Sie Remote-Jobs nach Stichwort, Region, Kategorie, Schlagwort, Gehalt und Unternehmen, richten Sie Benachrichtigungen ohne Konto ein, filtern und sortieren Sie sie, merken Sie sich Jobs und Suchen, sehen Sie, was seit Ihrem letzten Besuch neu ist, und führen Sie Ihre Bewerbungen (beworben, Gespräch, Angebot) mit Notizen in einer Liste, die dieses Gerät nie verlässt. Die Anzeigen kommen von Remotive, Jobicy und Himalayas; beworben wird auf der Originalanzeige."} });
    if (panel) {
      const el = document.getElementById('jb-' + panel) || document.getElementById(panel);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
    }
  }).finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/jobs/')));
};
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
