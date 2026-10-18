// lib/context-check.js: the extension's context check (asked by Verse, 2026-10-14): the dominant kind of a tab from counts alone,
// and one matching skill for it.
import assert from 'node:assert/strict';
import { contentOf, suggestFor, suggestionHtml, SUGGESTIONS } from '../void-live-deploy/lib/context-check.js';

assert.equal(contentOf({ text: 3000, images: 0, rows: 0, cells: 0 }), 'text');
assert.equal(contentOf({ text: 200 }), 'text');
assert.equal(contentOf({ text: 199 }), '', 'too little to call');
assert.equal(contentOf({ text: 120, images: 1 }), 'image', 'one big picture, little text');
assert.equal(contentOf({ text: 1200, images: 3 }), 'image', 'a gallery');
assert.equal(contentOf({ text: 1200, images: 1 }), 'text', 'an article with one picture is text');
assert.equal(contentOf({ text: 400, rows: 10, cells: 40 }), 'table');
assert.equal(contentOf({ text: 5000, rows: 3, cells: 6 }), 'text', 'a small table on a long page is not the page');
assert.equal(contentOf({ text: 100, rows: 2, cells: 4 }), '', 'two rows is not a table');
assert.equal(contentOf({ text: 300, rows: 4, cells: 12, images: 2 }), 'table', 'a table wins over pictures');
assert.equal(contentOf({ text: -5, images: 'many', rows: NaN }), '', 'bad counts are nothing');
assert.equal(contentOf(null), ''); assert.equal(contentOf('text'), '');

assert.deepEqual(suggestFor('text'), SUGGESTIONS.text); assert.equal(suggestFor(''), null); assert.equal(suggestFor('toString'), null, 'only the three kinds');
assert.equal(suggestFor('text').intent, 'summary', 'text: the card\'s own summary draft');
assert.equal(suggestFor('image').ask, 'what is this worth', 'pictures: the appraiser');
assert.equal(suggestFor('table').ask, 'make a list', 'a table: a list to check off');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
assert.equal(suggestionHtml(esc, ''), '');
assert.ok(suggestionHtml(esc, 'text').includes('mostly text · try <a href="#" class="tab-suggest" data-intent="summary">draft for me: summary</a>'));
assert.ok(suggestionHtml(esc, 'table').includes('data-ask="make a list"'));
assert.ok(suggestionHtml(esc, 'image').includes('mostly pictures') && suggestionHtml(esc, 'image').includes('data-ask="what is this worth"'));
console.log('context-check: ok');
