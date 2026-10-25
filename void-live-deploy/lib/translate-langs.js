// The translator's languages (the tower's Google Translate floor, /translate/): the 100 languages Meta's M2M-100 model translates between,
// by their two-letter (or three-letter) code, with the English name and the name a speaker uses. Pure, shared by the page and /api/translate.
// Also the language detector: Google detects the language typed; Verse does it on the device from the script of the text (Cyrillic, Greek,
// Arabic, Hebrew, Devanagari, Thai, kana, hangul, han) and, for the Latin alphabet, from the little words every language is full of.
export const LANGS = Object.freeze({
  af: ['Afrikaans', 'Afrikaans'], am: ['Amharic', 'አማርኛ'], ar: ['Arabic', 'العربية'], ast: ['Asturian', 'Asturianu'], az: ['Azerbaijani', 'Azərbaycan'],
  ba: ['Bashkir', 'Башҡорт'], be: ['Belarusian', 'Беларуская'], bg: ['Bulgarian', 'Български'], bn: ['Bengali', 'বাংলা'], br: ['Breton', 'Brezhoneg'],
  bs: ['Bosnian', 'Bosanski'], ca: ['Catalan', 'Català'], ceb: ['Cebuano', 'Cebuano'], cs: ['Czech', 'Čeština'], cy: ['Welsh', 'Cymraeg'],
  da: ['Danish', 'Dansk'], de: ['German', 'Deutsch'], el: ['Greek', 'Ελληνικά'], en: ['English', 'English'], es: ['Spanish', 'Español'],
  et: ['Estonian', 'Eesti'], fa: ['Persian', 'فارسی'], ff: ['Fulah', 'Fulfulde'], fi: ['Finnish', 'Suomi'], fr: ['French', 'Français'],
  fy: ['Frisian', 'Frysk'], ga: ['Irish', 'Gaeilge'], gd: ['Scottish Gaelic', 'Gàidhlig'], gl: ['Galician', 'Galego'], gu: ['Gujarati', 'ગુજરાતી'],
  ha: ['Hausa', 'Hausa'], he: ['Hebrew', 'עברית'], hi: ['Hindi', 'हिन्दी'], hr: ['Croatian', 'Hrvatski'], ht: ['Haitian Creole', 'Kreyòl ayisyen'],
  hu: ['Hungarian', 'Magyar'], hy: ['Armenian', 'Հայերեն'], id: ['Indonesian', 'Bahasa Indonesia'], ig: ['Igbo', 'Igbo'], ilo: ['Ilocano', 'Ilokano'],
  is: ['Icelandic', 'Íslenska'], it: ['Italian', 'Italiano'], ja: ['Japanese', '日本語'], jv: ['Javanese', 'Basa Jawa'], ka: ['Georgian', 'ქართული'],
  kk: ['Kazakh', 'Қазақ'], km: ['Khmer', 'ខ្មែរ'], kn: ['Kannada', 'ಕನ್ನಡ'], ko: ['Korean', '한국어'], lb: ['Luxembourgish', 'Lëtzebuergesch'],
  lg: ['Ganda', 'Luganda'], ln: ['Lingala', 'Lingála'], lo: ['Lao', 'ລາວ'], lt: ['Lithuanian', 'Lietuvių'], lv: ['Latvian', 'Latviešu'],
  mg: ['Malagasy', 'Malagasy'], mk: ['Macedonian', 'Македонски'], ml: ['Malayalam', 'മലയാളം'], mn: ['Mongolian', 'Монгол'], mr: ['Marathi', 'मराठी'],
  ms: ['Malay', 'Bahasa Melayu'], my: ['Burmese', 'မြန်မာ'], ne: ['Nepali', 'नेपाली'], nl: ['Dutch', 'Nederlands'], no: ['Norwegian', 'Norsk'],
  ns: ['Northern Sotho', 'Sesotho sa Leboa'], oc: ['Occitan', 'Occitan'], or: ['Odia', 'ଓଡ଼ିଆ'], pa: ['Punjabi', 'ਪੰਜਾਬੀ'], pl: ['Polish', 'Polski'],
  ps: ['Pashto', 'پښتو'], pt: ['Portuguese', 'Português'], ro: ['Romanian', 'Română'], ru: ['Russian', 'Русский'], sd: ['Sindhi', 'سنڌي'],
  si: ['Sinhala', 'සිංහල'], sk: ['Slovak', 'Slovenčina'], sl: ['Slovenian', 'Slovenščina'], so: ['Somali', 'Soomaali'], sq: ['Albanian', 'Shqip'],
  sr: ['Serbian', 'Српски'], ss: ['Swati', 'siSwati'], su: ['Sundanese', 'Basa Sunda'], sv: ['Swedish', 'Svenska'], sw: ['Swahili', 'Kiswahili'],
  ta: ['Tamil', 'தமிழ்'], th: ['Thai', 'ไทย'], tl: ['Filipino', 'Filipino'], tn: ['Tswana', 'Setswana'], tr: ['Turkish', 'Türkçe'],
  uk: ['Ukrainian', 'Українська'], ur: ['Urdu', 'اردو'], uz: ['Uzbek', 'Oʻzbek'], vi: ['Vietnamese', 'Tiếng Việt'], wo: ['Wolof', 'Wolof'],
  xh: ['Xhosa', 'isiXhosa'], yi: ['Yiddish', 'ייִדיש'], yo: ['Yoruba', 'Yorùbá'], zh: ['Chinese', '中文'], zu: ['Zulu', 'isiZulu'],
});
export const CODES = Object.freeze(Object.keys(LANGS));
export const COUNT = CODES.length;
export const MAX_CHARS = 5000; // the same ceiling Google's text box has

/** the code for a language however it is written: 'es', 'Spanish', 'español', 'zh-CN', 'pt-BR'; '' when unknown. Pure. */
export function codeOf(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return '';
  const base = t.replace(/[_-].*$/, '');
  if (LANGS[base]) return base;
  if (base === 'nb' || base === 'nn') return 'no';
  if (base === 'fil') return 'tl';
  if (base === 'iw') return 'he';
  for (const [c, [en, own]] of Object.entries(LANGS)) if (en.toLowerCase() === t || own.toLowerCase() === t) return c;
  // 'spanish', 'the spanish language', 'mandarin', 'brazilian portuguese'
  if (/mandarin|cantonese|simplified|traditional/.test(t)) return 'zh';
  if (/brazil/.test(t)) return 'pt';
  if (/tagalog|filipino/.test(t)) return 'tl';
  if (/farsi/.test(t)) return 'fa';
  if (/flemish/.test(t)) return 'nl';
  for (const [c, [en]] of Object.entries(LANGS)) if (t.includes(en.toLowerCase())) return c;
  return '';
}
export const nameOf = (code) => (LANGS[code] ? LANGS[code][0] : String(code || ''));

// the scripts a glance tells apart
const SCRIPTS = [
  [/[぀-ヿ]/, 'ja'], [/[가-힯]/, 'ko'], [/[฀-๿]/, 'th'], [/[຀-໿]/, 'lo'], [/[ក-៿]/, 'km'], [/[က-႟]/, 'my'],
  [/[֐-׿]/, 'he'], [/[؀-ۿ]/, 'ar'], [/[ऀ-ॿ]/, 'hi'], [/[ঀ-৿]/, 'bn'], [/[਀-੿]/, 'pa'], [/[઀-૿]/, 'gu'],
  [/[଀-୿]/, 'or'], [/[஀-௿]/, 'ta'], [/[ಀ-೿]/, 'kn'], [/[ഀ-ൿ]/, 'ml'], [/[඀-෿]/, 'si'], [/[Ⴀ-ჿ]/, 'ka'],
  [/[԰-֏]/, 'hy'], [/[ሀ-፿]/, 'am'], [/[Ͱ-Ͽ]/, 'el'], [/[一-鿿]/, 'zh'],
];
// Arabic script: Persian and Urdu have letters Arabic does not
const PERSIAN = /[پچژگ]/, URDU = /[ٹڈڑںھہے]/;
// Cyrillic: letters that pick a language out
const CYRILLIC = [[/[ґєії]/, 'uk'], [/[ўі]/, 'be'], [/[ѓќѕ]/, 'mk'], [/[ђћјљњ]/, 'sr'], [/[ҙқңүұөһ]/, 'kk'], [/[өү]/, 'mn']];
// Latin alphabet: the little words, lowest common denominators of each language
const WORDS = {
  en: 'the and is are you to of in it that this for with was not have what how', es: 'el la los las es una un y que de en por para con no se su como está muy',
  fr: 'le la les est une un et que de des en pour pas avec vous je nous ce qui sur', de: 'der die das ist und nicht ich sie ein eine mit zu auf für wie ich bin es',
  it: 'il la gli le è una un e che di per non con sono questo anche come più', pt: 'o a os as é uma um e que de em não para com você eu está isso como',
  nl: 'de het een is en niet van ik je dat met voor op zijn ook maar wat hoe', sv: 'och att det är en ett jag inte som på för med har du vad hur',
  da: 'og at det er en et jeg ikke som på for med har du hvad hvordan', no: 'og at det er en et jeg ikke som på for med har du hva hvordan',
  fi: 'ja on ei se että minä olen sinä mitä kuinka tämä hän me ovat', pl: 'i nie jest się na to że w z do jak co ja ty jestem był',
  cs: 'a je ne se na to že v s do jak co já ty jsem byl', tr: 'bir ve bu ne için ile çok değil ben sen var nasıl mı mi da de',
  id: 'dan yang di ini itu untuk dengan tidak saya kamu apa bagaimana adalah ada', ms: 'dan yang di ini itu untuk dengan tidak saya awak apa bagaimana adalah ada',
  vi: 'và là của không tôi bạn có một này cái gì như thế nào được', ro: 'și este nu o un cu pentru la ce cum eu tu sunt în de',
  hu: 'és a az nem egy van hogy mi hogyan én te ez volt', sw: 'na ni ya kwa si mimi wewe nini vipi hii hiyo katika',
  tl: 'at ang ng sa ay hindi ako ikaw ano paano ito iyon mga', ca: 'i el la els les és una un que de per amb no jo tu com què',
  af: 'en die is nie ek jy wat hoe dit het van vir met', cy: 'a y yr yn mae ddim i ti beth sut hwn hon', ga: 'agus an tá ní mé tú cad conas seo sin',
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([c, w]) => [c, new Set(w.split(' '))]));
// letters only one Latin-script language in the list writes much
const MARKS = [[/[ãõ]/, 'pt'], [/[ñ¿¡]/, 'es'], [/[ßẞ]/, 'de'], [/[ø]/, 'da'], [/[å]/, 'sv'], [/[ę ą ł ż ź ś ć ń]/, 'pl'], [/[ěřůň]/, 'cs'], [/[şğı]/, 'tr'], [/[ăț ş]/, 'ro'], [/[őű]/, 'hu'], [/[ạảấầắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]/i, 'vi'], [/[çàèéìíòóùú].*[çàèéìíòóùú]/i, null]];

/** the language the text is in, as a code, or '' when the text gives no clue (a number, an emoji, a name). Pure, never wrong on purpose:
 *  an unmistakable script decides at once; the Latin alphabet is read by its little words, and only a clear winner counts. */
export function detect(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  for (const [re, code] of SCRIPTS) if (re.test(t)) {
    if (code === 'ar') return URDU.test(t) ? 'ur' : PERSIAN.test(t) ? 'fa' : 'ar';
    if (code === 'zh' && /[぀-ヿ]/.test(t)) return 'ja';
    return code;
  }
  if (/[Ѐ-ӿ]/.test(t)) { for (const [re, code] of CYRILLIC) if (re.test(t)) return code; return 'ru'; }
  const words = t.toLowerCase().replace(/[^\p{L}\p{M}'’\s-]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const score = {};
  for (const w of words) for (const [c, set] of Object.entries(SETS)) if (set.has(w)) score[c] = (score[c] || 0) + 1;
  for (const [re, c] of MARKS) if (c && re.test(t)) score[c] = (score[c] || 0) + 1.5;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return words.length === 1 ? '' : 'en';
  const [best, second] = ranked;
  if (second && best[1] === second[1]) return words.length >= 6 ? best[0] : '';
  return best[0];
}

/** what the page says in the person's own language: English, or German for a German browser (the tower's local-language aspect). Pure. */
export function wordsFor(lang) {
  const de = /^de\b/i.test(String(lang || ''));
  return de ? {
    title: 'Übersetzer', detect: 'Sprache erkennen', from: 'Von', to: 'Nach', swap: 'Sprachen tauschen', placeholder: 'Text eingeben', translate: 'Übersetzen',
    listen: 'Anhören', speak: 'Sprechen', copy: 'Kopieren', copied: 'Kopiert', share: 'Link teilen', shared: 'Link kopiert', camera: 'Kamera oder Foto', clear: 'Löschen', save: 'Merken', saved: 'Gemerkt',
    history: 'Verlauf', phrasebook: 'Gemerkte Sätze', working: 'Übersetze', detected: 'Erkannt', chars: 'Zeichen', offline: 'Offline: nur gemerkte und frühere Übersetzungen', none: 'Der Übersetzer hat gerade nicht geantwortet. Bitte gleich noch einmal versuchen.',
    reading: 'Lese den Text im Bild', nothingRead: 'Im Bild war kein Text zu lesen', langs: COUNT + ' Sprachen', nothingSent: 'Nur der Text geht an Verse; nichts wird gespeichert.',
    tone: 'Ton', toneDefault: 'Standard', toneNone: 'Nur ein Ton', back: 'Rückübersetzen', backLabel: 'Zurück', dictionary: 'Wörterbuch', otherWords: 'Andere Wörter', translations: 'Übersetzungen',
    examples: 'Beispiele', forms: 'Formen', lookUp: 'Nachschlagen', noEntry: 'Kein Wörterbucheintrag für dieses Wort', noAlts: 'Keine anderen Wörter gefunden', common: 'häufig', lessCommon: 'weniger häufig', rare: 'selten',
    website: 'Eine Webseite übersetzen', websiteGo: 'Seite übersetzen', several: 'In mehrere Sprachen', severalGo: 'In alle übersetzen', glossary: 'Glossar', practice: 'Üben', show: 'Zeigen', next: 'Weiter',
    stop: 'Stopp', file: 'Dokument', close: 'Schließen', waiting: 'Kurz warten: das Minutenlimit des Übersetzers', translatingDoc: 'Übersetze das Dokument',
    pdfNote: 'Beim PDF bleibt das Layout nur als Text erhalten: die Wörter kommen Seite für Seite, Absatz für Absatz, als .docx zurück.',
  } : {
    title: 'Translate', detect: 'Detect language', from: 'From', to: 'To', swap: 'Swap languages', placeholder: 'Type to translate', translate: 'Translate',
    listen: 'Listen', speak: 'Speak', copy: 'Copy', copied: 'Copied', share: 'Share link', shared: 'Link copied', camera: 'Camera or photo', clear: 'Clear', save: 'Save', saved: 'Saved',
    history: 'History', phrasebook: 'Saved phrases', working: 'Translating', detected: 'Detected', chars: 'characters', offline: 'Offline: saved and earlier translations only', none: 'The translator did not answer just now. Try again in a moment.',
    reading: 'Reading the text in the picture', nothingRead: 'No text could be read in the picture', langs: COUNT + ' languages', nothingSent: 'Only the text goes to Verse; nothing is stored.',
    tone: 'Tone', toneDefault: 'Default', toneNone: 'One tone only', back: 'Back-translate', backLabel: 'Back', dictionary: 'Dictionary', otherWords: 'Other words', translations: 'Translations',
    examples: 'Examples', forms: 'Forms', lookUp: 'Look up', noEntry: 'No dictionary entry for this word', noAlts: 'No other words found', common: 'common', lessCommon: 'less common', rare: 'rare',
    website: 'Translate a website', websiteGo: 'Translate page', several: 'Into several languages', severalGo: 'Translate into all', glossary: 'Glossary', practice: 'Practice', show: 'Show', next: 'Next',
    stop: 'Stop', file: 'Document', close: 'Close', waiting: 'Waiting a moment: the translator\'s per-minute limit', translatingDoc: 'Translating the document',
    pdfNote: 'PDF layout is kept as text only: the words come back page by page, paragraph by paragraph, in a .docx.',
  };
}

/** the words in a file and how to put translations back: subtitles keep their numbers and timings, JSON keeps its keys and anything not a
 *  string, plain text keeps its paragraphs. { kind, parts: [text], rebuild(translated[]) -> file text }. Pure. */
export function fileParts(name, text) {
  const n = String(name || '').toLowerCase(), t = String(text || '').replace(/\r\n?/g, '\n');
  if (/\.json$/.test(n)) {
    const data = JSON.parse(t), parts = [];
    const walk = (v) => (typeof v === 'string' ? (parts.push(v), v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
    walk(data);
    return { kind: 'json', parts, rebuild: (tr) => { let i = 0; const put = (v) => (typeof v === 'string' ? tr[i++] : Array.isArray(v) ? v.map(put) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, put(x)])) : v); return JSON.stringify(put(data), null, 2) + '\n'; } };
  }
  if (/\.(?:srt|vtt)$/.test(n) || /-->/.test(t)) {
    const lines = t.split('\n'), at = [];
    lines.forEach((l, i) => { if (l.trim() && !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^WEBVTT\b|^NOTE\b|^STYLE\b/.test(l.trim())) at.push(i); });
    return { kind: /\.vtt$/.test(n) || /^WEBVTT/.test(t) ? 'vtt' : 'srt', parts: at.map((i) => lines[i]), rebuild: (tr) => { const out = lines.slice(); at.forEach((i, k) => { out[i] = tr[k]; }); return out.join('\n'); } };
  }
  const paras = t.split(/\n{2,}/);
  return { kind: 'text', parts: paras.filter((p) => p.trim()), rebuild: (tr) => { let i = 0; return paras.map((p) => (p.trim() ? tr[i++] : p)).join('\n\n'); } };
}

// ---- tone: the languages that say "you" two ways (or more), as DeepL and Papago offer ------------------------------------------------
// T-V languages get formal and informal; Korean gets its three everyday speech levels (Papago's honorifics), Japanese polite and plain.
const TV = { de: ['Sie', 'du'], fr: ['vous', 'tu'], es: ['usted', 'tú'], it: ['Lei', 'tu'], pt: ['o senhor / a senhora', 'você / tu'], nl: ['u', 'je / jij'],
  ru: ['Вы', 'ты'], uk: ['Ви', 'ти'], be: ['Вы', 'ты'], bg: ['Вие', 'ти'], pl: ['Pan / Pani', 'ty'], cs: ['vy', 'ty'], sk: ['vy', 'ty'], sl: ['vi', 'ti'],
  hr: ['Vi', 'ti'], sr: ['Ви', 'ти'], bs: ['Vi', 'ti'], mk: ['Вие', 'ти'], ro: ['dumneavoastră', 'tu'], hu: ['Ön / Maga', 'te'], tr: ['siz', 'sen'], el: ['εσείς', 'εσύ'],
  ca: ['vostè', 'tu'], gl: ['vostede', 'ti'], sv: ['ni', 'du'], no: ['De', 'du'], da: ['De', 'du'], fi: ['te', 'sinä'], et: ['teie', 'sina'], lv: ['jūs', 'tu'], lt: ['jūs', 'tu'],
  hi: ['आप', 'तुम'], ur: ['آپ', 'تم'], bn: ['আপনি', 'তুমি'], fa: ['شما', 'تو'], id: ['Anda', 'kamu'], ms: ['anda', 'kamu'], vi: ['quý vị', 'bạn'], th: ['คุณ (ครับ/ค่ะ)', 'เธอ'] };
/** the tones a language offers: [{ id, label, how }] (how: what the model is told), [] when it has one way only. Pure. */
export function tonesFor(code) {
  if (code === 'ko') return [{ id: 'formal', label: 'Formal (합쇼체)', how: 'the formal polite speech level (합쇼체, verbs ending -습니다/-ㅂ니다)' },
    { id: 'polite', label: 'Polite (해요체)', how: 'the polite speech level (해요체, verbs ending -요)' }, { id: 'casual', label: 'Casual (반말)', how: 'casual speech (반말, 해체, no -요)' }];
  if (code === 'ja') return [{ id: 'formal', label: 'Polite (です・ます)', how: 'polite Japanese (です/ます forms, keigo where natural)' }, { id: 'informal', label: 'Plain (だ・である)', how: 'plain casual Japanese (dictionary forms, no です/ます)' }];
  const tv = TV[code]; if (!tv) return [];
  return [{ id: 'formal', label: 'Formal (' + tv[0] + ')', how: 'the formal register, addressing the reader as "' + tv[0] + '"' }, { id: 'informal', label: 'Informal (' + tv[1] + ')', how: 'the informal register, addressing the reader as "' + tv[1] + '"' }];
}

// ---- romanization: the output in Latin letters, worked out on the device (Google's and Bing's transliteration line) --------------------
const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', ђ: 'đ', е: 'e', ё: 'yo', є: 'ye', ж: 'zh', з: 'z', ѕ: 'dz', и: 'i', і: 'i', ї: 'yi', й: 'y', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
  н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ў: 'w', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', џ: 'dž', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  қ: 'q', ғ: 'gh', ң: 'ng', ү: 'ü', ұ: 'u', ө: 'ö', һ: 'h', ә: 'ä', ѓ: 'gj', ќ: 'kj' };
const GRK = { α: 'a', ά: 'á', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'é', ζ: 'z', η: 'i', ή: 'í', θ: 'th', ι: 'i', ί: 'í', ϊ: 'ï', ΐ: 'ḯ', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'ó',
  π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'ý', ϋ: 'ÿ', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'ó' };
const HL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const HV = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const HT = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
const HT_ON = ['', 'g', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'r', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', ''];
const KANA = ('a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya - yu - yo ra ri ru re ro wa - - - wo n '
  + 'ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po').split(' ');
const KROW = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもや-ゆ-よらりるれろわ---をんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const SMALL = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
function kana(t) {
  const h = [...t].map((c) => { const n = c.codePointAt(0); return n >= 0x30a1 && n <= 0x30f6 ? String.fromCodePoint(n - 0x60) : c; });
  let out = '', dbl = false;
  for (let i = 0; i < h.length; i++) {
    const c = h[i], k = KROW.indexOf(c);
    if (c === 'っ') { dbl = true; continue; }
    if (c === 'ー') { const v = out.match(/[aeiou]$/); out += v ? v[0] : ''; continue; }
    let r = k >= 0 && KANA[k] !== '-' ? KANA[k] : SMALL[c] != null ? SMALL[c] : c;
    if (SMALL[c] != null && /i$/.test(out) && /^y/.test(SMALL[c]) && k < 0) { out = out.replace(/(sh|ch|j)i$/, '$1').replace(/i$/, ''); r = /(sh|ch|j)$/.test(out) ? r.slice(1) : r; }
    if (dbl && /^[a-z]/.test(r)) r = (r.startsWith('ch') ? 't' : r[0]) + r; dbl = false;
    out += r;
  }
  return out;
}
function hangul(t) {
  const cs = [...t]; let out = '';
  cs.forEach((c, i) => {
    const s = c.codePointAt(0) - 0xac00; if (s < 0 || s > 11171) { out += c; return; }
    const l = Math.floor(s / 588), v = Math.floor((s % 588) / 28), tt = s % 28, nx = (cs[i + 1] || '').codePointAt(0) - 0xac00, nl = nx >= 0 && nx <= 11171 ? Math.floor(nx / 588) : -1;
    let fin = HT[tt];
    if (tt && nl === 11) fin = HT_ON[tt]; // the final carried onto a following vowel: 한국어 hangugeo
    else if (tt && (nl === 2 || nl === 6)) fin = fin === 'k' ? 'ng' : fin === 't' ? 'n' : fin === 'p' ? 'm' : fin; // before n or m: 합니다 hamnida
    out += HL[l] + HV[v] + fin;
  });
  return out;
}
/** the text in Latin letters for Cyrillic, Greek, Korean and Japanese kana, '' for a language this cannot do (Chinese, kanji, Arabic, the
 *  Indic scripts) or text already in Latin letters. Pure. */
export function romanize(text, code) {
  const t = String(text || ''); if (!t.trim()) return '';
  const cap = (src, r) => (src !== src.toLowerCase() && r ? r[0].toUpperCase() + r.slice(1) : r);
  if (/[Ѐ-ӿ]/.test(t)) return [...t].map((c) => { const lo = c.toLowerCase(); return CYR[lo] != null ? cap(c, CYR[lo]) : c; }).join('');
  if (/[Ͱ-Ͽ]/.test(t)) return [...t.replace(/ου/g, 'ou').replace(/Ου/g, 'Ou').replace(/ού/g, 'oú')].map((c) => { const lo = c.toLowerCase(); return GRK[lo] != null ? cap(c, GRK[lo]) : c; }).join('');
  if (/[가-힯]/.test(t)) return hangul(t);
  if (code === 'ja' || /[぀-ヿ]/.test(t)) return /[一-鿿]/.test(t) ? '' : kana(t);
  return '';
}
