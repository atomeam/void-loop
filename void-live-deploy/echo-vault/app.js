const find = document.querySelector('#find');
const articles = [...document.querySelectorAll('article')];
const none = document.querySelector('#none');

function apply() {
  const q = find.value.trim().toLowerCase();
  let shown = 0;
  for (const article of articles) {
    const hay = (article.dataset.words + ' ' + article.textContent).toLowerCase();
    const on = !q || hay.includes(q);
    article.hidden = !on;
    if (on) shown += 1;
  }
  none.hidden = shown > 0;
}

const entry = new URLSearchParams(location.search).get('entry');
if (entry) {
  const el = document.getElementById(entry);
  if (el) el.scrollIntoView({ block: 'start' });
}
find.addEventListener('input', apply);
apply();
