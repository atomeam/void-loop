import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LANGS, CODES, COUNT, MAX_CHARS, codeOf, nameOf, detect, wordsFor } from '../void-live-deploy/lib/translate-langs.js';
import { translatedOf, viaMyMemory, translate, onRequestPost } from '../void-live-deploy/functions/api/translate.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');

test('the translator has the 100 languages of the model, each with a name a speaker uses', () => {
  assert.equal(COUNT, 100); assert.equal(CODES.length, 100);
  for (const [c, v] of Object.entries(LANGS)) { assert.match(c, /^[a-z]{2,3}$/); assert.equal(v.length, 2); assert.ok(v[0] && v[1], c); }
  assert.equal(MAX_CHARS, 5000);
});

test('a language however it is written', () => {
  assert.equal(codeOf('es'), 'es'); assert.equal(codeOf('Spanish'), 'es'); assert.equal(codeOf('español'), 'es'); assert.equal(codeOf('zh-CN'), 'zh'); assert.equal(codeOf('pt-BR'), 'pt');
  assert.equal(codeOf('mandarin'), 'zh'); assert.equal(codeOf('brazilian portuguese'), 'pt'); assert.equal(codeOf('tagalog'), 'tl'); assert.equal(codeOf('farsi'), 'fa'); assert.equal(codeOf('nb-NO'), 'no');
  assert.equal(codeOf('klingon'), ''); assert.equal(codeOf(''), ''); assert.equal(nameOf('ja'), 'Japanese');
});

test('the detector reads a script at a glance and the Latin alphabet by its little words', () => {
  assert.equal(detect('こんにちは、元気ですか'), 'ja'); assert.equal(detect('안녕하세요'), 'ko'); assert.equal(detect('你好，世界'), 'zh'); assert.equal(detect('Привет, как дела?'), 'ru');
  assert.equal(detect('Привіт, як справи?'), 'uk'); assert.equal(detect('مرحبا بالعالم'), 'ar'); assert.equal(detect('سلام، چطوری؟'), 'fa'); assert.equal(detect('שלום עולם'), 'he');
  assert.equal(detect('नमस्ते दुनिया'), 'hi'); assert.equal(detect('Γεια σου κόσμε'), 'el'); assert.equal(detect('สวัสดีครับ'), 'th');
  assert.equal(detect('the cat is on the table and it is not happy'), 'en'); assert.equal(detect('el gato está en la mesa y no es feliz'), 'es');
  assert.equal(detect('le chat est sur la table et il est content'), 'fr'); assert.equal(detect('die Katze ist auf dem Tisch und sie ist nicht froh'), 'de');
  assert.equal(detect('il gatto è sul tavolo e non è contento'), 'it'); assert.equal(detect('o gato está na mesa e não está feliz'), 'pt');
  assert.equal(detect('de kat zit op de tafel en is niet blij'), 'nl'); assert.equal(detect('bu bir kedi ve çok mutlu değil'), 'tr');
  assert.equal(detect('hello'), ''); assert.equal(detect('12345'), ''); assert.equal(detect(''), '');
});

test('the page speaks German to a German browser and English otherwise', () => {
  const d = wordsFor('de-DE'), e = wordsFor('en-US');
  assert.equal(d.translate, 'Übersetzen'); assert.equal(e.translate, 'Translate'); assert.equal(d.langs, '100 Sprachen'); assert.equal(e.langs, '100 languages');
  for (const k of Object.keys(e)) assert.ok(d[k], k);
});

test('the model answer and MyMemory answer are read whatever their shape', async () => {
  assert.equal(translatedOf({ translated_text: ' hola ' }), 'hola'); assert.equal(translatedOf({ result: { translated_text: 'hola' } }), 'hola'); assert.equal(translatedOf(null), '');
  const fetchFn = async () => ({ json: async () => ({ responseStatus: 200, responseData: { translatedText: 'hola' } }) });
  assert.equal(await viaMyMemory('hello', 'en', 'es', fetchFn), 'hola');
  const matches = async () => ({ json: async () => ({ responseStatus: 200, responseData: { translatedText: '' }, matches: [{ translation: 'bonjour', match: 1 }, { translation: 'salut', match: .5 }] }) });
  assert.equal(await viaMyMemory('hello', 'en', 'fr', matches), 'bonjour');
  const warn = async () => ({ json: async () => ({ responseStatus: 200, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } }) });
  assert.equal(await viaMyMemory('hello', 'en', 'fr', warn), '');
});

test('the model first, MyMemory when it fails, paragraph by paragraph', async () => {
  const calls = [];
  const env = { AI: { run: async (m, a) => { calls.push([m, a]); return { translated_text: a.text === 'hello' ? 'hola' : 'adiós' }; } } };
  const r = await translate(env, 'hello\n\ngoodbye', 'en', 'es', async () => { throw new Error('never'); });
  assert.deepEqual(r, { text: 'hola\n\nadiós', via: 'verse' }); assert.equal(calls.length, 2); assert.equal(calls[0][0], '@cf/meta/m2m100-1.2b'); assert.deepEqual(calls[0][1], { text: 'hello', source_lang: 'en', target_lang: 'es' });
  const down = { AI: { run: async () => { throw new Error('down'); } } };
  const f = await translate(down, 'hello', 'en', 'es', async () => ({ json: async () => ({ responseStatus: 200, responseData: { translatedText: 'hola' } }) }));
  assert.deepEqual(f, { text: 'hola', via: 'mymemory' });
});

test('the endpoint: detects the language, refuses what it cannot take', async () => {
  const req = (body) => ({ json: async () => body, headers: { get: () => '' }, url: 'https://a-to-mind.com/api/translate' });
  const env = { AI: { run: async (m, a) => ({ translated_text: a.source_lang === 'es' ? 'hello' : 'hola' }) } };
  let r = await onRequestPost({ request: req({ text: 'hola, ¿cómo está usted hoy?', to: 'en' }), env }); let j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.text, 'hello'); assert.equal(j.from, 'es'); assert.equal(j.detected, 'es'); assert.equal(j.via, 'verse');
  r = await onRequestPost({ request: req({ text: 'hello', from: 'en', to: 'Spanish' }), env }); j = await r.json(); assert.equal(j.text, 'hola'); assert.equal(j.to, 'es');
  r = await onRequestPost({ request: req({ text: 'hello', to: 'klingon' }), env }); assert.equal(r.status, 400);
  r = await onRequestPost({ request: req({ to: 'es' }), env }); assert.equal(r.status, 400);
  r = await onRequestPost({ request: req({ text: 'x'.repeat(5001), to: 'es' }), env }); assert.equal(r.status, 400);
  r = await onRequestPost({ request: req({ text: 'hello', from: 'en', to: 'en' }), env }); j = await r.json(); assert.equal(j.via, 'same'); assert.equal(j.text, 'hello');
});

test('the page carries what the floor is measured on, in its first paint', () => {
  const html = fs.readFileSync(path.join(root, 'translate', 'index.html'), 'utf8');
  for (const w of ['100 languages', 'Detect language', 'Listen', 'Speak', 'Camera or photo', 'Copy', 'Share link', 'Saved phrases', 'History', 'offline', 'og:title', 'twitter:card', 'addEventListener(\'load\'']) assert.ok(html.includes(w), w);
  assert.equal((html.match(/<option value="/g) || []).length, 201); // detect + 100 from, 100 to
  assert.ok(!/<link rel="modulepreload"[^>]*(?:three|scene3d)/.test(html));
  for (const w of ['Übersetzer', 'Anhören', 'Sprechen']) assert.ok(html.includes(w), w);
});

test('files keep their shape: subtitles their numbers and timings, JSON its keys, text its paragraphs', async () => {
  const { fileParts } = await import('../void-live-deploy/lib/translate-langs.js');
  const srt = fileParts('a.srt', '1\n00:00:01,000 --> 00:00:02,000\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nGoodbye\n');
  assert.deepEqual(srt.parts, ['Hello there', 'Goodbye']); assert.equal(srt.rebuild(['Hola', 'Adiós']), '1\n00:00:01,000 --> 00:00:02,000\nHola\n\n2\n00:00:03,000 --> 00:00:04,000\nAdiós\n');
  const js = fileParts('en.json', '{"greet":"Hello","n":3,"menu":{"open":"Open","list":["Yes","No"]}}');
  assert.deepEqual(js.parts, ['Hello', 'Open', 'Yes', 'No']); assert.deepEqual(JSON.parse(js.rebuild(['Hola', 'Abrir', 'Sí', 'No'])), { greet: 'Hola', n: 3, menu: { open: 'Abrir', list: ['Sí', 'No'] } });
  const tx = fileParts('a.txt', 'One.\n\nTwo.'); assert.deepEqual(tx.parts, ['One.', 'Two.']); assert.equal(tx.rebuild(['Uno.', 'Dos.']), 'Uno.\n\nDos.');
});
