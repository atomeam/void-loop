import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rotateLetters, ESSAY, running, doneSites, nextSite, cardHtml, cardSay, selfLead, SITES } from '../void-live-deploy/lib/least.js';

const page = (p) => readFileSync(new URL('../void-live-deploy/' + p, import.meta.url), 'utf8');
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const BANNED = /\b(exam scores?|skill counts?|gates?|families|percentages?|assimilat\w*|proven|working on)\b/i;

test('a letter rotation holds, and thirteen places undoes itself', () => {
  assert.equal(rotateLetters('Hello, world!', 13), 'Uryyb, jbeyq!');
  assert.equal(rotateLetters('Uryyb, jbeyq!', 13), 'Hello, world!');
  assert.equal(rotateLetters('Az!', 1), 'Ba!');
  assert.equal(rotateLetters('n!', -1), 'm!');
});

test('fewest jobs come first, and a site is finished only when its jobs have been run', () => {
  assert.deepEqual(running().map((s) => s.host).slice(0, 3), ['motherfuckingwebsite.com', 'rot13.com', 'tsundere.pw']);
  assert.ok(!running().some((s) => s.host === 'neverssl.com'));
  assert.ok(SITES.some((s) => s.host === 'neverssl.com' && s.aside));
  assert.deepEqual(doneSites().map((s) => s.host), ['motherfuckingwebsite.com', 'rot13.com', 'tsundere.pw']);
  assert.equal(nextSite().host, 'hackertyper.net');
});

test('the card is the finished sites, in words', () => {
  const h = cardHtml((s) => String(s));
  assert.match(h, /href="\/sites\/rot13.com\/"/);
  assert.match(h, /href="\/memes\/#tsundere-pw"/);
  assert.doesNotMatch(h, /hackertyper|yesno\.wtf|neverssl/);
  assert.doesNotMatch(text(h), BANNED);
  assert.equal(cardSay(), 'Finished: motherfuckingwebsite.com, rot13.com and tsundere.pw.');
  assert.match(selfLead('a page that rotates letters'), /Next: fill the screen with code as you type/);
  assert.doesNotMatch(selfLead(''), BANNED);
});

test('the pages do the job and cite the history', () => {
  const rot = page('sites/rot13.com/index.html'), plain = page('sites/motherfuckingwebsite.com/index.html'), memes = page('memes/index.html');
  assert.match(rot, /rotateLetters/);
  assert.match(rot, /web.archive.org\/web\/20010419151735/);
  assert.match(rot, /en\.wikipedia\.org\/wiki\/ROT13/);
  assert.equal((plain.match(/<style/g) || []).length, 0);
  assert.ok(text(plain).includes(ESSAY.slice(0, 40)));
  assert.match(plain, /digiday\.com\/marketing\/web-design/);
  assert.match(plain, /Barry T\. Smith/);
  assert.match(memes, /id="tsundere-pw"/);
  assert.match(memes, /Fripp Don't Interact/);
  assert.match(memes, /dictionary\.cambridge\.org/);
  assert.doesNotMatch(memes, /<audio|<video|\.mp3/i);
  for (const file of [rot, plain, memes, page('conquered/index.html')]) assert.doesNotMatch(text(file), BANNED);
});
