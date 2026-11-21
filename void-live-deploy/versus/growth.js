// The owner Tower's growth section. The board is /tower.ideas.json, which the owner gate already keeps private.
// Every value is set with textContent, so a title in the board cannot become markup.

function line(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export async function renderGrowth(root) {
  root.replaceChildren(line('Reading the growth loop.'));
  let board = null;
  try {
    const r = await fetch('/tower.ideas.json', { cache: 'no-store' });
    if (r.ok) board = await r.json();
  } catch { board = null; }
  const box = document.createElement('div');
  box.append(line('Growth loop'));
  if (!board) { box.append(line('No board yet.')); root.replaceChildren(box); return; }
  const cost = board.cost || {};
  box.append(line('Pass rate: ' + (board.passRate == null ? 'none yet' : board.passRate)));
  box.append(line('Building this run: ' + (board.n == null ? 0 : board.n)));
  box.append(line('Cost: ' + (cost.paidCents || 0) + ' cents, ' + (cost.minutes || 0) + ' minutes. ' + (cost.note || '')));
  const picks = document.createElement('ul');
  for (const p of board.picks || []) {
    const li = document.createElement('li');
    li.textContent = (p.total || 0) + ' ' + (p.title || '') + ' ' + ((p.gate && p.gate.say) || '');
    picks.append(li);
  }
  box.append(picks);
  const levers = document.createElement('ul');
  for (const [name, row] of Object.entries(board.levers || {})) {
    const li = document.createElement('li');
    li.textContent = name + ': ' + (row && row.effect || '');
    levers.append(li);
  }
  box.append(levers);
  const back = document.createElement('a');
  back.href = '/versus/';
  back.textContent = 'Tower';
  box.append(back);
  root.replaceChildren(box);
}
