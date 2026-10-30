// /generators/forum/'s code (the comments engine with topics: functions/api/comments.js), kept out of the page so it needs no inline-script CSP rule
import { mountRelated } from '/lib/toolkit.js';
import { mountComments } from '/lib/comments-ui.js';
addEventListener('load', async () => {
  const $ = (id) => document.getElementById(id), q = new URLSearchParams(location.search), t = q.get('t') || '';
  const say = (x) => { $('note').textContent = x || ''; };
  let token = '';
  async function topics() {
    try { const j = await (await fetch('/api/comments?topics=1')).json(); if (!j.ok) throw 0; token = j.check.token; $('tSumL').textContent = 'A quick check that you are a person: ' + j.check.q;
      $('topics').replaceChildren(...(j.items.length ? j.items.map((x) => { const li = document.createElement('li'), a = document.createElement('a'); a.href = '/generators/forum/?t=' + x.id; a.textContent = x.title;
        const m = document.createElement('div'); m.className = 'meta'; m.textContent = x.name + ' · ' + x.replies + (x.replies === 1 ? ' reply' : ' replies') + ' · ' + new Date(x.last).toLocaleDateString(); li.append(a, m); return li; })
        : [Object.assign(document.createElement('li'), { className: 'note', textContent: 'No topics yet. Start the first one!' })]));
    } catch (_) { $('topics').replaceChildren(Object.assign(document.createElement('li'), { className: 'note', textContent: 'The forum needs the internet.' })); }
  }
  if (/^[a-z2-7]{10}$/.test(t)) {
    $('list').hidden = true; $('topic').hidden = false;
    try { const j = await (await fetch('/api/comments?thread=forum:' + t)).json(); if (!j.ok) throw new Error(j.error); $('topicTitle').textContent = j.topic.title; document.title = j.topic.title + ' · Generators forum · Verse'; mountComments($('posts'), 'forum:' + t); }
    catch (e) { $('topicTitle').textContent = navigator.onLine ? 'That topic is not here (it may have been taken down).' : 'The forum needs the internet.'; }
    $('repTopic').addEventListener('click', async () => { if (!confirm('Report this topic as rude or spam? Three reports hide it until it is looked at.')) return; try { await fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ act: 'report-topic', id: t }) }); } catch (_) {} $('repTopic').textContent = 'Reported'; $('repTopic').disabled = true; });
  } else topics();
  $('newForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('tGo').disabled = true; say('');
    try { const j = await (await fetch('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ act: 'topic', title: $('tTitle').value, name: $('tName').value, text: $('tText').value, answer: $('tSum').value, token, website: $('tTrap').value }) })).json();
      if (j.ok) { location.href = '/generators/forum/?t=' + j.id; return; } say(j.error || 'It could not be posted just now.'); topics(); } catch (_) { say('The forum needs the internet.'); }
    $('tGo').disabled = false;
  });
  mountRelated($('related'), '/generators/');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
});
