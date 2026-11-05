// /agent/ while you are away: what is news, the title count and how often a hidden tab reads (lib/agent-watch.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { statusesOf, newsOf, tellOf, waiting, titleFor, nextReadIn } from '../void-live-deploy/lib/agent-watch.js';

const T = (id, status, ask = 'task ' + id) => ({ id, status, ask });

test('a task that was working and now waits, finishes or is stuck is news; the first read never is', () => {
  assert.deepEqual(newsOf(null, [T('a', 'done')]), []);
  const before = statusesOf([T('a', 'running'), T('b', 'queued'), T('c', 'running'), T('d', 'running')]);
  const news = newsOf(before, [T('a', 'needs_yes', 'email my landlord'), T('b', 'done'), T('c', 'failed'), T('d', 'running')]);
  assert.deepEqual(news.map((n) => n.status), ['needs_yes', 'done', 'failed']);
  assert.equal(news[0].title, 'Verse needs your yes');
  assert.match(news[0].body, /email my landlord/);
});
test('a yes or a no you gave yourself is not news, and a task sent from this tab is news when it lands', () => {
  assert.deepEqual(newsOf(statusesOf([T('a', 'needs_yes')]), [T('a', 'done')]), []);
  assert.deepEqual(newsOf(statusesOf([T('a', 'needs_yes')]), [T('a', 'declined')]), []);
  assert.deepEqual(newsOf(statusesOf([]), [T('n', 'done')]).map((n) => n.id), ['n']);
});
test('the title counts what waits for a yes', () => {
  assert.equal(waiting([T('a', 'needs_yes'), T('b', 'done'), T('c', 'needs_yes')]), 2);
  assert.equal(titleFor('Verse, your agent · Verse', [T('a', 'needs_yes')]), '(1) Verse, your agent · Verse');
  assert.equal(titleFor('Verse, your agent · Verse', [T('a', 'done')]), 'Verse, your agent · Verse');
});
test('a hidden tab reads only while a task is still working, or slowly when a check was asked', () => {
  assert.equal(nextReadIn([T('a', 'done')], false), 2000);
  assert.equal(nextReadIn([T('a', 'running')], true), 10000);
  assert.equal(nextReadIn([T('a', 'done'), T('b', 'needs_yes')], true), null);
  assert.equal(nextReadIn([T('a', 'done', 'check the savannah parks')], true), 60000);
});
test('the first read of a visit is the inbox kept while the tab was closed; a later read is only a change', () => {
  const inbox = [{ id: 'a', status: 'done', title: 'Verse finished a task', body: 'On your Made shelf: base64 verse inbox' }];
  assert.equal(tellOf(null, [T('a', 'done')], inbox)[0].title, 'Verse finished a task');
  assert.deepEqual(tellOf(null, [], []), []);
  assert.deepEqual(tellOf(statusesOf([T('a', 'running')]), [T('a', 'running')], inbox), []);
  assert.equal(tellOf(statusesOf([T('a', 'running')]), [T('a', 'done')], inbox)[0].status, 'done');
});
test('the page uses it: the title, a notification only when turned on, the inbox, approve and decline, and steps on the Made shelf', () => {
  const html = fs.readFileSync(new URL('../void-live-deploy/agent/index.html', import.meta.url), 'utf8');
  assert.match(html, /from '\/lib\/agent-watch\.js'/);
  assert.match(html, /id="notify"/);
  assert.match(html, /Notification\.permission !== 'granted'/);
  assert.match(html, /nextReadIn\(/);
  assert.match(html, /tellOf\(/);
  assert.match(html, /id="inbox"/);
  assert.match(html, />Approve</);
  assert.match(html, />Decline</);
  assert.match(html, /<details><summary>Steps<\/summary>/);
  assert.match(html, /data-open/);
  assert.match(html, /proactive: true/);
});
