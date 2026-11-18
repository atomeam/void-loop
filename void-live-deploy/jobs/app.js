// /jobs/: one jobs page for every jobs-lane site. Panels and presets come from the query.
const ALL = ["search","saved","alerts","tracker","feed","sources","regions","categories","tags","companies"];
const go = () => {
  const q = new URLSearchParams(location.search);
  const panel = q.get('panel');
  const preset = {};
  if (q.get('region')) preset.region = q.get('region');
  if (q.get('salary') === '1' || q.get('salary') === 'true') { preset.salaryOnly = true; preset.sort = q.get('sort') || 'salary'; }
  if (q.get('sort')) preset.sort = q.get('sort');
  return import('/lib/jobs-ui.js').then(({ mountJobs }) => {
    const root = document.getElementById('app');
    mountJobs(root, { panels: ALL, preset, de: { h1: 'Jobs', intro: 'Suchen Sie Remote-Jobs nach Stichwort, Ort, Schlagwort und Gehalt, filtern und sortieren Sie sie, merken Sie sich Jobs und Suchen, sehen Sie, was seit Ihrem letzten Besuch neu ist, und führen Sie Ihre Bewerbungen mit Notizen in einer Liste, die dieses Gerät nie verlässt.' } });
    if (panel) {
      const el = document.getElementById('jb-' + panel) || document.getElementById(panel) || document.querySelector('#jb-' + panel + ', #' + panel + ', [id*="' + panel + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
    }
  }).finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/jobs/')));
};
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
