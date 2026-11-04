// /contribute/: every bot (bots/registry.json) and skill (the skills/ folder on GitHub) with a link to its source, filterable.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SRC = 'https://github.com/atomeam/void-loop/blob/main/void-live-deploy/';
let bots = [], skills = [];
function draw() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const hit = (s) => !q || s.toLowerCase().includes(q);
  const b = bots.filter((x) => hit(x.id + ' ' + (x.job || '') + ' ' + (x.cat || '')));
  const s = skills.filter((x) => hit(x));
  document.getElementById('bots-h').textContent = 'Bots (' + b.length + ')';
  document.getElementById('skills-h').textContent = 'Skills (' + s.length + ')';
  // void-review: ok (every value passes through esc)
  document.getElementById('bots').innerHTML = b.map((x) => {
    const file = (x.from || []).find((f) => /\.(m?js|json)$/.test(f));
    return '<tr><td><b>' + esc(x.id) + '</b><br><span class="note">' + esc(x.cat || '') + '</span></td><td>' + esc(x.job || '') + '</td><td>' + (file ? '<a href="' + SRC + esc(file) + '">source</a>' : '') + '</td></tr>';
  }).join('') || '<tr><td class="note">' + (bots.length ? 'No match.' : 'No bots listed yet.') + '</td></tr>';
  // void-review: ok (every value passes through esc)
  document.getElementById('skills').innerHTML = s.slice(0, 600).map((n) => '<tr><td>' + esc(n.replace(/\.m?js$/, '')) + '</td><td><a href="' + SRC + 'skills/' + esc(n) + '">source</a></td></tr>').join('') || '<tr><td class="note">' + (skills.length ? 'No match.' : 'The skills list did not load. Browse them on GitHub.') + '</td></tr>';
}
fetch('/bots/registry.json').then((r) => r.json()).then((d) => { bots = (d && d.bots || []).filter((x) => x.status === 'live'); draw(); }).catch(draw);
fetch('https://api.github.com/repos/atomeam/void-loop/contents/void-live-deploy/skills?ref=main').then((r) => r.json()).then((d) => { skills = Array.isArray(d) ? d.filter((f) => f.type === 'file' && /\.m?js$/.test(f.name)).map((f) => f.name) : []; draw(); }).catch(draw);
document.getElementById('q').addEventListener('input', draw);
