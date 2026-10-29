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
  assert.equal((html.match(/<option value="/g) || []).length, 204); // detect + 100 from, 100 to, the tone select's default, and the language search's to/from pair
  for (const w of ['Document', 'Dictionary', 'Back-translate', 'Tone', 'Translate a website', 'Into several languages', 'Glossary', 'Practice', '.docx,.pptx,.xlsx,.pdf']) assert.ok(html.includes(w), w);
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

// ---- documents, dictionary, alternatives, tone, websites (the gaps in domains/features/translate.json, closed 2026-10-25) ----
import * as D from '../void-live-deploy/lib/translate-docs.js';
import { tonesFor, romanize } from '../void-live-deploy/lib/translate-langs.js';
import * as WD from '../void-live-deploy/lib/translate-words.js';
import * as WEB from '../void-live-deploy/lib/translate-web.js';
import { dictionary, alternativesFor, toned } from '../void-live-deploy/functions/api/translate.js';
const td = new TextDecoder();

test('zip: CRC-32 is the zip one, and what is zipped unzips byte for byte', async () => {
  assert.equal(D.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bin = new Uint8Array(3000).map((_, i) => (i * 7) & 255), z = await D.zip([{ name: 'a/ü.xml', data: '<x>hé</x>' }, { name: 'b.bin', data: bin }]);
  const back = await D.unzip(z); assert.deepEqual(back.map((f) => f.name), ['a/ü.xml', 'b.bin']); assert.equal(td.decode(back[0].data), '<x>hé</x>'); assert.deepEqual([...back[1].data], [...bin]);
  await assert.rejects(D.unzip(new Uint8Array(40)), /not a zip/);
});

test('a .docx keeps its layout: a sentence split over runs is translated whole into the first run, styles, tables, numbers and nested text boxes stay', async () => {
  const doc = '<w:document xmlns:w="w"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Annual </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>report</w:t></w:r></w:p>'
    + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Good morning &amp; welcome</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>42</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
    + '<w:p><w:r><w:t xml:space="preserve">Outer </w:t></w:r><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>Inner box</w:t></w:r></w:p></w:txbxContent></w:pict></w:r><w:r><w:t>text</w:t></w:r></w:p><w:p/></w:body></w:document>';
  const z = await D.zip([{ name: '[Content_Types].xml', data: '<Types/>' }, { name: 'word/document.xml', data: doc }, { name: 'word/header1.xml', data: '<w:hdr xmlns:w="w"><w:p><w:r><w:t>Annual report</w:t></w:r></w:p></w:hdr>' }, { name: 'word/media/p.png', data: new Uint8Array([137, 80, 78, 71]) }]);
  const r = await D.readOffice('report.docx', z);
  assert.equal(r.kind, 'docx'); assert.deepEqual(r.parts, ['Annual report', 'Good morning & welcome', 'Outer text', 'Inner box']); // the header's "Annual report" is the same paragraph, asked once
  const ES = { 'Annual report': 'Informe anual', 'Good morning & welcome': 'Buenos días y bienvenidos', 'Inner box': 'Caja interior', 'Outer text': 'Texto exterior' };
  const files = await D.unzip(await r.rebuild(r.parts.map((p) => ES[p])));
  const x = td.decode(files.find((f) => f.name === 'word/document.xml').data);
  assert.match(x, /<w:pStyle w:val="Title"\/><\/w:pPr><w:r><w:t xml:space="preserve">Informe anual<\/w:t><\/w:r><w:r><w:rPr><w:b\/><\/w:rPr><w:t><\/w:t>/);
  assert.match(x, /Buenos días y bienvenidos/); assert.match(x, /<w:t>42<\/w:t>/); assert.match(x, /<w:t xml:space="preserve">Caja interior<\/w:t>/); assert.match(x, /Texto exterior/);
  assert.match(td.decode(files.find((f) => f.name === 'word/header1.xml').data), /Informe anual/);
  assert.deepEqual([...files.find((f) => f.name === 'word/media/p.png').data], [137, 80, 78, 71]);
});

test('a .xlsx translates its shared strings (not the phonetic guides, numbers or formulas) and a .pptx its slides and notes', async () => {
  const ss = '<sst><si><t>Hello</t></si><si><r><t>Thank </t></r><r><rPr><b/></rPr><t>you</t></r></si><si><t>2024</t></si><si><t>東京</t><rPh><t>トウキョウ</t></rPh></si></sst>';
  const sheet = '<worksheet><sheetData><row><c t="s"><v>0</v></c><c><f>A1*2</f><v>4</v></c><c t="inlineStr"><is><t>Inline note</t></is></c></row></sheetData></worksheet>';
  const x = await D.readOffice('b.xlsx', await D.zip([{ name: 'xl/sharedStrings.xml', data: ss }, { name: 'xl/worksheets/sheet1.xml', data: sheet }]));
  assert.deepEqual(x.parts, ['Hello', 'Thank you', '東京', 'Inline note']);
  const xf = await D.unzip(await x.rebuild(['Hola', 'Gracias', 'Tokio', 'Nota']));
  assert.equal(td.decode(xf[0].data), '<sst><si><t>Hola</t></si><si><r><t>Gracias</t></r><r><rPr><b/></rPr><t></t></r></si><si><t>2024</t></si><si><t>Tokio</t><rPh><t>トウキョウ</t></rPh></si></sst>');
  assert.match(td.decode(xf[1].data), /<f>A1\*2<\/f><v>4<\/v>.*<t>Nota<\/t>/);
  const p = await D.readOffice('c.pptx', await D.zip([{ name: 'ppt/slides/slide1.xml', data: '<p:sld><a:p><a:r><a:t>Welcome</a:t></a:r></a:p></p:sld>' }, { name: 'ppt/notesSlides/notesSlide1.xml', data: '<p:notes><a:p><a:r><a:t>Say hi</a:t></a:r></a:p></p:notes>' }, { name: 'ppt/theme/theme1.xml', data: '<a:t>Office Theme</a:t>' }]));
  assert.deepEqual(p.parts, ['Welcome', 'Say hi']);
  await assert.rejects(D.readOffice('d.docx', await D.zip([{ name: 'x.xml', data: '<x/>' }])), /no Word document/);
});

test('a PDF comes back as a .docx, page by page and paragraph by paragraph; long texts go in chunks under the cap and come back whole', async () => {
  assert.deepEqual(D.pdfParagraphs('The cat sat on the mat and looked out of the\nwindow at the birds.\nTitle\n\nA hyphen-\nated word.'), ['The cat sat on the mat and looked out of the window at the birds.', 'Title', 'A hyphenated word.']);
  const f = await D.unzip(await D.docxOf([['Uno.', 'Dos.'], ['Tres.']], 'ar'));
  assert.deepEqual(f.map((x) => x.name), ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
  const body = td.decode(f[2].data); assert.equal((body.match(/w:type="page"/g) || []).length, 1); assert.match(body, /<w:bidi\/>.*Uno\./);
  const long = 'One sentence here. '.repeat(400).trim(), B = D.batchesOf(['short', long, 'end'], 4500, 40);
  assert.ok(B.batches.every((b) => b.join('\n\n').length <= 4500 && b.length <= 40)); assert.ok(B.pieces > 3);
  assert.deepEqual(B.join(B.batches.flat()), ['short', long, 'end']);
  const many = D.batchesOf(Array.from({ length: 100 }, (_, i) => 'cell ' + i), 4500, 40); assert.deepEqual(many.batches.map((b) => b.length), [40, 40, 20]);
});

test('tone: the languages that have it, Korean its three speech levels; romanization on the device', () => {
  assert.deepEqual(tonesFor('de').map((t) => t.id), ['formal', 'informal']); assert.match(tonesFor('de')[0].label, /Sie/); assert.match(tonesFor('fr')[1].label, /tu/);
  assert.deepEqual(tonesFor('ko').map((t) => t.id), ['formal', 'polite', 'casual']); assert.match(tonesFor('ko')[2].label, /반말/); assert.equal(tonesFor('ja').length, 2);
  assert.deepEqual(tonesFor('en'), []); assert.deepEqual(tonesFor('zh'), []);
  assert.equal(romanize('Привет, как дела?'), 'Privet, kak dela?'); assert.equal(romanize('Γεια σου κόσμε'), 'Geia sou kósme');
  assert.equal(romanize('안녕하세요'), 'annyeonghaseyo'); assert.equal(romanize('감사합니다'), 'gamsahamnida'); assert.equal(romanize('한국어'), 'hangugeo');
  assert.equal(romanize('ありがとう'), 'arigatou'); assert.equal(romanize('ちょっと'), 'chotto'); assert.equal(romanize('コーヒー'), 'koohii');
  assert.equal(romanize('日本語です'), ''); assert.equal(romanize('hola'), ''); assert.equal(romanize('你好'), '');
});

test('the model\'s answers are read whatever their shape, cleaned to the dictionary\'s and the alternatives\' shape', () => {
  assert.deepEqual(WD.jsonIn('Sure! ```json\n{"a":{"b":"}"}}\n```'), { a: { b: '}' } }); assert.equal(WD.jsonIn('no json'), null); assert.equal(WD.said({ response: { x: 1 } }), '{"x":1}');
  const e = WD.entryOf({ pos: [{ pos: 'noun', senses: [{ def: 'a financial institution', example: 'I went to the bank.', example_tr: 'Fui al banco.' }, { def: '' }] }], alternatives: [{ text: 'banco', freq: 'Common' }, { text: 'Banco', freq: 'rare' }, { text: 'orilla', freq: 'weird' }], forms: ['banks', 'banks', ''] });
  assert.equal(e.pos[0].senses.length, 1); assert.deepEqual(e.alternatives.map((a) => [a.text, a.freq]), [['banco', 'common'], ['orilla', 'less common']]); assert.deepEqual(e.forms, ['banks']);
  assert.deepEqual(WD.entryOf(null), { pos: [], alternatives: [], forms: [] });
  const a = WD.altsOf({ alternatives: [{ text: 'feliz', sentence: 'El gato está feliz.' }, { text: 'contento', sentence: 'El gato está contento.' }, { text: 'alegre', sentence: 'no word here' }] }, 'feliz');
  assert.deepEqual(a, [{ text: 'contento', sentence: 'El gato está contento.' }, { text: 'alegre', sentence: '' }]);
  assert.deepEqual(WD.glossaryOf([['checkout', 'caja'], ['cart', 'carrito'], ['', 'x']], 'Go to checkout now'), [['checkout', 'caja']]);
  assert.equal(WD.editedOf('"Wie geht es Ihnen?"', 'Wie geht es dir?'), 'Wie geht es Ihnen?'); assert.equal(WD.editedOf('', 'x'), ''); assert.equal(WD.editedOf('a'.repeat(500), 'short'), '');
  assert.match(WD.wordPrompt('bank', 'en', 'es')[1].content, /"bank" \(English\).*Spanish/s); assert.match(WD.tonePrompt('Hola', 'Hi', 'de', 'the formal register', [['cart', 'Warenkorb']])[1].content, /formal register.*"cart" → "Warenkorb"/s);
});

const stubFetch = (routes) => async (url) => { for (const [re, body, status = 200, headers = {}] of routes) if (re.test(url)) return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }); throw new Error('unrouted ' + url); };
const WIKI = { en: [{ partOfSpeech: 'Noun', language: 'English', definitions: [{ definition: 'An <a href="x">institution</a> where one can keep money.', examples: ['I went to the <b>bank</b>.'] }, { definition: 'plural of banks' }] }], es: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'other' }] }] };
const MEM = { responseStatus: 200, responseData: { translatedText: 'banco' }, matches: [{ translation: 'banco', match: 1, 'usage-count': 5 }, { translation: 'orilla', match: 0.7, 'usage-count': 1 }, { translation: 'Banco.', match: 0.9 }] };

test('the dictionary: Wiktionary\'s meanings, the model\'s translations with how common each is and its examples; MyMemory\'s translations when the model is off', async () => {
  const f = stubFetch([[/wiktionary/, WIKI], [/mymemory/, MEM]]);
  const model = { AI: { run: async () => ({ response: JSON.stringify({ pos: [{ pos: 'noun', senses: [{ def: 'money place', example: 'The bank is closed.', example_tr: 'El banco está cerrado.' }] }], alternatives: [{ text: 'banco', freq: 'common', means: 'money' }, { text: 'orilla', freq: 'less common', means: 'river' }], forms: ['banks'] }) }) } };
  const d = await dictionary(model, 'bank', 'en', 'es', 'en', f);
  assert.equal(d.pos[0].pos, 'noun'); assert.equal(d.pos[0].senses[0].def, 'An institution where one can keep money.'); assert.equal(d.pos[0].senses[0].example, 'I went to the bank.'); assert.equal(d.pos[0].senses.length, 1);
  assert.deepEqual(d.alternatives.map((a) => a.text), ['banco', 'orilla']); assert.deepEqual(d.examples, [{ src: 'The bank is closed.', tgt: 'El banco está cerrado.' }]); assert.deepEqual(d.forms, ['banks']); assert.deepEqual(d.sources, ['Wiktionary', 'Verse']); assert.ok(d.keep);
  const off = await dictionary({}, 'bank', 'en', 'es', 'en', f);
  assert.deepEqual(off.alternatives.map((a) => [a.text, a.freq]), [['banco', 'common'], ['orilla', 'rare']]); assert.deepEqual(off.sources, ['Wiktionary', 'MyMemory']);
  const none = await dictionary({}, 'zzqx', 'en', 'es', 'en', stubFetch([[/wiktionary/, {}, 404], [/mymemory/, { responseStatus: 200, responseData: { translatedText: '' }, matches: [] }]]));
  assert.equal(none.keep, false);
});

test('other words for one word of a translation, each with its sentence rewritten; without the model, MyMemory\'s round trip', async () => {
  const model = { AI: { run: async (m, a) => ({ response: '{"alternatives":[{"text":"contento","sentence":"El gato está contento."},{"text":"alegre","sentence":"El gato está alegre."}]}' }) } };
  const r = await alternativesFor(model, 'feliz', 'El gato está feliz.', 'The cat is happy.', 'en', 'es', async () => { throw new Error('never'); });
  assert.equal(r.via, 'verse'); assert.deepEqual(r.alternatives.map((a) => a.sentence), ['El gato está contento.', 'El gato está alegre.']);
  const f = stubFetch([[/langpair=es\|en/, { responseStatus: 200, responseData: { translatedText: 'happy' } }], [/langpair=en\|es/, { responseStatus: 200, responseData: { translatedText: 'feliz' }, matches: [{ translation: 'contento', match: 0.9 }, { translation: 'feliz', match: 1 }] }]]);
  const m = await alternativesFor({}, 'feliz', 'El gato está feliz.', 'The cat is happy.', 'en', 'es', f);
  assert.equal(m.via, 'mymemory'); assert.deepEqual(m.alternatives, [{ text: 'contento', sentence: '' }]);
});

test('tone and glossary: the model edits the translation; without it the plain translation comes back, saying so', async () => {
  let asked = '';
  const model = { AI: { run: async (m, a) => { asked = a.messages[1].content; return { response: 'Wie geht es Ihnen?' }; } } };
  assert.deepEqual(await toned(model, 'Wie geht es dir?', 'How are you?', 'de', 'formal', []), { text: 'Wie geht es Ihnen?', tone: 'formal', note: '' }); assert.match(asked, /"Sie"/);
  const off = await toned({}, 'Wie geht es dir?', 'How are you?', 'de', 'formal', []); assert.equal(off.text, 'Wie geht es dir?'); assert.equal(off.tone, ''); assert.match(off.note, /plain translation/);
  assert.deepEqual(await toned(model, 'Hello', 'Hi', 'en', 'formal', []), { text: 'Hello', tone: '', note: '' }); // English has one tone: nothing asked
  const ko = { AI: { run: async (m, a) => { asked = a.messages[1].content; return { response: '고마워' }; } } };
  assert.equal((await toned(ko, '감사합니다', 'Thanks', 'ko', 'casual', [])).text, '고마워'); assert.match(asked, /반말/);
  const req = (body) => ({ json: async () => body, headers: { get: () => '' }, url: 'https://a-to-mind.com/api/translate' });
  const env = { AI: { run: async (m, a) => (a.messages ? { response: 'Wie geht es Ihnen?' } : { translated_text: 'Wie geht es dir?' }) } };
  const j = await (await onRequestPost({ request: req({ text: 'How are you?', from: 'en', to: 'de', tone: 'formal' }), env })).json();
  assert.equal(j.text, 'Wie geht es Ihnen?'); assert.equal(j.tone, 'formal');
});

test('a website: only public http(s) names, no private hosts, ports, passwords or Verse itself; its words come back as text, redirects checked again', async () => {
  for (const bad of ['http://localhost/', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://10.0.0.1', 'http://router/', 'http://intranet.corp/', 'file:///etc/passwd', 'ftp://example.org/', 'http://user:pw@example.org/', 'http://example.org:8080/', 'https://a-to-mind.com/api/translate', 'http://0x7f000001/', 'gopher://x.org'])
    assert.throws(() => WEB.checkUrl(bad), Error, bad);
  assert.equal(WEB.checkUrl('example.org/a#b').href, 'https://example.org/a');
  const html = '<html lang="fr"><head><title>Le &amp; titre</title><style>p{}</style><script>alert(1)</script></head><body><nav><a href="/a">Accueil</a> <a href="javascript:alert(1)">x</a></nav><h1>Bonjour</h1><p>Un <b>chat</b> noir.<br>Deux</p><!-- c --><ul><li>Pomme</li><li>12</li></ul><p onclick="x()">Un <a href="https://ex.org/b#c">lien</a></p></body></html>';
  const x = WEB.extract(html, 'https://site.fr/page');
  assert.equal(x.title, 'Le & titre'); assert.equal(x.lang, 'fr');
  assert.deepEqual(x.blocks, [{ h: 0, text: 'Accueil x' }, { h: 1, text: 'Bonjour' }, { h: 0, text: 'Un chat noir.' }, { h: 0, text: 'Deux' }, { h: 0, text: 'Pomme' }, { h: 0, text: 'Un lien' }]);
  assert.deepEqual(x.links, [{ text: 'Accueil', url: 'https://site.fr/a' }, { text: 'lien', url: 'https://ex.org/b' }]);
  assert.ok(!JSON.stringify(x).includes('alert'));
  const hop = stubFetch([[/^https:\/\/short\.ly/, '', 302, { location: 'http://127.0.0.1/admin' }]]);
  await assert.rejects(WEB.fetchPage('https://short.ly/x', hop), /number address/);
  const ok = stubFetch([[/^https:\/\/a\.org\/$/, '', 301, { location: '/fr/' }], [/^https:\/\/a\.org\/fr\/$/, '<title>T</title><p>Salut le monde</p>', 200, { 'content-type': 'text/html; charset=utf-8' }]]);
  const pg = await WEB.fetchPage('a.org', ok); assert.equal(pg.url, 'https://a.org/fr/'); assert.match(pg.html, /Salut/);
  await assert.rejects(WEB.fetchPage('https://a.org/x.zip', stubFetch([[/a\.org/, 'PK', 200, { 'content-type': 'application/zip' }]])), /not a web page/);
  const big = stubFetch([[/a\.org/, '<p>' + 'mot '.repeat(600000) + '</p>', 200, { 'content-type': 'text/html' }]]);
  assert.ok((await WEB.fetchPage('https://a.org/', big)).html.length <= WEB.MAX_BYTES);
});

test('the endpoint\'s modes: a word, alternatives, a page; a bad mode or a missing part is a 400', async () => {
  const req = (body) => ({ json: async () => body, headers: { get: () => '' }, url: 'https://a-to-mind.com/api/translate' });
  const was = globalThis.fetch;
  globalThis.fetch = stubFetch([[/wiktionary/, WIKI], [/mymemory/, MEM], [/^https:\/\/site\.fr/, '<title>Hi</title><h2>Bonjour</h2><p>Le monde</p>', 200, { 'content-type': 'text/html' }]]);
  try {
    let r = await onRequestPost({ request: req({ mode: 'word', text: 'bank', from: 'en', to: 'es' }), env: {} }); let j = await r.json();
    assert.equal(r.status, 200); assert.equal(j.pos[0].pos, 'noun'); assert.equal(j.alternatives[0].text, 'banco'); assert.ok(!('keep' in j));
    r = await onRequestPost({ request: req({ mode: 'word', text: 'a whole long sentence here', to: 'es' }), env: {} }); assert.equal(r.status, 400);
    r = await onRequestPost({ request: req({ mode: 'alts', word: 'banco', sentence: 'Fui al banco.', source: 'I went to the bank.', to: 'es' }), env: {} }); j = await r.json(); assert.equal(r.status, 200); assert.ok(Array.isArray(j.alternatives));
    r = await onRequestPost({ request: req({ mode: 'alts', word: 'banco', to: 'es' }), env: {} }); assert.equal(r.status, 400);
    r = await onRequestPost({ request: req({ mode: 'page', url: 'site.fr/x' }), env: {} }); j = await r.json();
    assert.equal(r.status, 200); assert.equal(j.title, 'Hi'); assert.deepEqual(j.blocks, [{ h: 2, text: 'Bonjour' }, { h: 0, text: 'Le monde' }]);
    r = await onRequestPost({ request: req({ mode: 'page', url: 'http://localhost:8788/' }), env: {} }); assert.equal(r.status, 400);
    r = await onRequestPost({ request: req({ mode: 'nope', to: 'es' }), env: {} }); assert.equal(r.status, 400);
  } finally { globalThis.fetch = was; }
});
