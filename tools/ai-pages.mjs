// Writes the pages of two Versus floors from lib/ai-sites.js (owner, 2026-10-26: every tower site gets its own page; have everything the sites have; use the
// sites as well as beat them): /models/ (Hugging Face's floor) with /models/leaderboard/, /local/, /prices/, /arena/, and /assistant/ (Claude's floor) with
// /assistant/workspace/, /voice/, /quick/, /private/, /sources/. Every page's words and controls are in its first paint (the module, lib/models-page.js or lib/assistant-page.js, only wires them after
// load); German comes from lib/ai-de.js, which this script writes from the pairs below (T(english, german)), so a word added here is translated in one place.
// The seo block and the asks row inside their markers are filled by tools/seo-pages.mjs. The code is imported after the load event, so the first paint waits
// for nothing; there is no modulepreload block (tools/preload.mjs follows static imports only, and finds none). `node tools/ai-pages.mjs` rewrites the eleven pages and lib/ai-de.js; `--check` exits 1 when one differs.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { MODEL_SITES, ASSISTANT_SITES, TRY } from '../void-live-deploy/lib/ai-sites.js';
import { TASKS, LICENCES, SIZES, QUANTS, BENCHES, SNAPSHOT, sizeLabel, taskName, hubPage, runGB, costOf, money } from '../void-live-deploy/lib/hub-core.js';
import { TEMPLATES, STYLE_NAMES } from '../void-live-deploy/lib/assistant-core.js';
import { graphOf, withPreloads } from './preload.mjs';
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');

const DE = new Map();
/** an English text with its German, kept for lib/ai-de.js; returns the English. */
const T = (en, de) => { if (de && !DE.has(en)) DE.set(en, de); return en; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const opt = (pairs, sel) => pairs.map(([v, l]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');

const CSS = `
  :root { color-scheme: light dark; --bg: #f7f6fb; --ink: #15131c; --soft: #5d5a6b; --line: #cfcbdc; --accent: #5b36f0; --on-accent: #fff; --box: #fff; --tint: #efe9ff; --bad: #c62a40; --good: #12795a; --me: #ece6ff; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme=light]) { --bg: #0b0a10; --ink: #ecebf5; --soft: #aaa7ba; --line: #3a3649; --accent: #a58bff; --on-accent: #15131c; --box: #14121c; --tint: #221c3a; --bad: #ff6b7e; --good: #4fd6a8; --me: #241d3d; } }
  :root[data-theme=dark] { --bg: #0b0a10; --ink: #ecebf5; --soft: #aaa7ba; --line: #3a3649; --accent: #a58bff; --on-accent: #15131c; --box: #14121c; --tint: #221c3a; --bad: #ff6b7e; --good: #4fd6a8; --me: #241d3d; }
  * { box-sizing: border-box; } [hidden] { display: none !important; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 18px 16px 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; text-align: center; font-weight: 700; } h2 { font-size: 17px; margin: 0 0 8px; } h3 { font-size: 15px; margin: 10px 0 4px; }
  .sub { font-size: 14px; color: var(--soft); text-align: center; margin: 0 0 10px; min-height: 42px; }
  .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  #anav { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 0 0 12px; min-height: 92px; align-content: flex-start; }
  #anav a { font-size: 14px; padding: 8px 12px; min-height: 40px; display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; color: var(--ink); text-decoration: none; background: var(--box); }
  #anav a[aria-current=page] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
  input, select, textarea { font: inherit; font-size: 16px; color: inherit; background: var(--box); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; min-height: 44px; max-width: 100%; }
  textarea { width: 100%; min-height: 92px; resize: vertical; }
  input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button { font: inherit; font-size: 15px; border: 1px solid var(--line); border-radius: 999px; padding: 7px 14px; min-height: 44px; min-width: 44px; background: var(--box); color: var(--ink); cursor: pointer; }
  button[aria-pressed=true], button.go, button[aria-selected=true] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 600; }
  button:disabled { opacity: .5; cursor: default; } button.sm { min-height: 36px; padding: 4px 10px; font-size: 14px; }
  a { color: var(--accent); } .pane { border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin: 10px 0; background: var(--box); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
  .row > label { font-size: 13px; color: var(--soft); display: flex; flex-direction: column; gap: 2px; flex: 1 1 150px; min-width: 0; }
  .row > label select, .row > label input { width: 100%; } .row.c { justify-content: center; }
  .chk { flex: 0 1 auto !important; flex-direction: row !important; align-items: center; gap: 8px !important; color: var(--ink) !important; font-size: 15px !important; min-height: 44px; }
  .row > label.chk input[type=checkbox] { min-height: 0; width: 24px; height: 24px; flex: 0 0 auto; } input[type=checkbox] { width: 24px; height: 24px; accent-color: var(--accent); } input[type=file] { min-height: 44px; }
  .cards a, td a, .src a, .side a { display: inline-block; min-height: 24px; line-height: 24px; }
  .note { font-size: 13px; color: var(--soft); margin: 4px 0; min-height: 20px; }
  .status { font-size: 14px; min-height: 24px; margin: 6px 0; } .bad { color: var(--bad); } .good { color: var(--good); }
  .cards { list-style: none; padding: 0; margin: 8px 0; display: grid; gap: 8px; min-height: 420px; align-content: start; }
  .cards li { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; background: var(--bg); }
  .cards .t { font-weight: 650; word-break: break-word; } .cards .m { font-size: 13px; color: var(--soft); } .cards .a { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; font-size: 12px; margin: 2px 4px 2px 0; background: var(--tint); }
  .tw { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-size: 14px; } th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; } th { color: var(--soft); font-weight: 600; }
  th button { min-height: 32px; min-width: 0; padding: 2px 6px; border: 0; background: none; color: var(--soft); font-weight: 600; font-size: 13px; } th button[aria-pressed=true] { color: var(--accent); background: none; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .card-md { font-size: 15px; max-height: 70vh; overflow: auto; border-top: 1px solid var(--line); margin-top: 8px; padding-top: 8px; } .card-md pre, .msg pre { background: var(--tint); padding: 10px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
  .card-md img { max-width: 100%; } code { font-family: ui-monospace, monospace; font-size: .92em; }
  pre.cmd { background: var(--tint); padding: 10px; border-radius: 8px; overflow-x: auto; margin: 4px 0; font-size: 13px; white-space: pre-wrap; word-break: break-all; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } @media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
  .ans { border: 1px solid var(--line); border-radius: 12px; padding: 10px; min-height: 160px; background: var(--bg); overflow-wrap: anywhere; } .ans h3 { margin-top: 0; }
  .bar { height: 14px; background: var(--accent); border-radius: 4px; }
  .chat { display: grid; grid-template-columns: 250px 1fr; gap: 12px; } @media (max-width: 760px) { .chat { grid-template-columns: 1fr; } .thread { min-height: 200px; } }
  .side { border: 1px solid var(--line); border-radius: 14px; padding: 10px; background: var(--box); min-height: 120px; align-self: start; }
  .side ul { list-style: none; padding: 0; margin: 6px 0; max-height: 420px; overflow-y: auto; } .side li { display: flex; gap: 4px; align-items: center; }
  .side li a { flex: 1; display: block; padding: 8px; min-height: 40px; border-radius: 8px; color: var(--ink); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .side li a[aria-current=true] { background: var(--tint); font-weight: 600; }
  .thread { border: 1px solid var(--line); border-radius: 14px; padding: 10px; background: var(--box); min-height: 340px; display: flex; flex-direction: column; gap: 10px; overflow-wrap: anywhere; }
  .msg { padding: 8px 12px; border-radius: 12px; max-width: 100%; } .msg.user { background: var(--me); align-self: flex-end; max-width: 88%; white-space: pre-wrap; } .msg.assistant { background: var(--bg); border: 1px solid var(--line); }
  .msg .who { font-size: 12px; color: var(--soft); font-weight: 600; display: block; } .msg .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .msg p { margin: 6px 0; } .msg ul, .msg ol { padding-left: 22px; } .run-out { background: var(--bg); border: 1px dashed var(--line); border-radius: 8px; padding: 6px 8px; font: 13px ui-monospace, monospace; white-space: pre-wrap; }
  .empty { color: var(--soft); text-align: center; margin: auto 0; font-size: 15px; }
  .composer textarea { min-height: 80px; } .src { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; } .src li { border: 1px solid var(--line); border-radius: 10px; padding: 8px; font-size: 13px; }
  details { margin: 8px 0; } summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
  #related, #asks { margin-top: 14px; min-height: 48px; } footer { font-size: 13px; color: var(--soft); text-align: center; margin-top: 10px; } footer a { color: var(--soft); }
  .tk-row { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 13px; color: var(--soft); } .tk-row a { color: var(--soft); display: inline-flex; align-items: center; min-height: 32px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media print { #anav, button, .row, .side, .composer, #related, #asks { display: none !important; } .chat { display: block; } }`;

// ---------------------------------------------------------------- the models pages
const TASK_OPT = [['', T('Any task', 'Jede Aufgabe')], ...TASKS];
const LIC_OPT = [['', T('Any licence', 'Jede Lizenz')], ...LICENCES.filter(([k]) => k !== 'other').map(([k, n]) => [k, n])];
const SIZE_OPT = [['', T('Any size', 'Jede Größe')], ...SIZES.map(([k, l]) => [k, l])];
const DL_OPT = [['0', T('Any', 'Beliebig')], ['1000', '1,000+'], ['10000', '10,000+'], ['100000', '100,000+'], ['1000000', '1,000,000+']];
const SORT_OPT = [['downloads', T('Most downloads', 'Meiste Downloads')], ['likes', T('Most likes', 'Meiste Likes')], ['trending', T('Trending', 'Im Trend')], ['updated', T('Recently updated', 'Zuletzt aktualisiert')], ['new', T('Newest', 'Neueste')]];
const TRY_OPT = TRY.map((x) => [x.key, x.label]);
const tryLimits = T('Runs on Verse\'s free share of Cloudflare Workers AI: about ten messages a minute, a daily limit shared by everyone (it resets at midnight UTC), and answers of up to about 800 words. The build here may be quantized, so it can differ a little from the files on the Hub.', 'Läuft auf dem freien Anteil von Verse an Cloudflare Workers AI: etwa zehn Nachrichten pro Minute, ein Tageslimit für alle zusammen (Neustart um Mitternacht UTC) und Antworten bis etwa 800 Wörter. Die Version hier kann quantisiert sein und deshalb etwas von den Dateien im Hub abweichen.');
const snapRow = (r) => `<li><div class="t"><a href="${esc(hubPage(r.id))}" rel="noopener" target="_blank">${esc(r.id)}</a></div><div class="m">${esc(taskName(r.task))} · ${esc(r.licence || '')} · ${esc(sizeLabel(r.params))}</div></li>`;
const credit = (what) => `<section class="pane" aria-label="${T('About the data', 'Über die Daten')}"><h2>${T('About the data', 'Über die Daten')}</h2><p class="note">${what}</p></section>`;

const MODEL_BODY = {
  hub: () => `
  <section class="pane" aria-label="${T('Find a model', 'Ein Modell finden')}">
    <div class="row" role="tablist" aria-label="${T('What to browse', 'Was durchsuchen')}"><button type="button" role="tab" id="kindM" aria-selected="true">${T('Models', 'Modelle')}</button><button type="button" role="tab" id="kindD" aria-selected="false">${T('Datasets', 'Datensätze')}</button></div>
    <div class="row"><label>${T('Search', 'Suche')}<input type="search" id="q" maxlength="80" placeholder="${T('llama, whisper, bert, a person or a team', 'llama, whisper, bert, eine Person oder ein Team')}" enterkeyhint="search"></label></div>
    <div class="row"><label>${T('Task', 'Aufgabe')}<select id="task">${opt(TASK_OPT, '')}</select></label><label>${T('Licence', 'Lizenz')}<select id="lic">${opt(LIC_OPT, '')}</select></label><label>${T('Size', 'Größe')}<select id="size">${opt(SIZE_OPT, '')}</select></label><label>${T('Downloads at least', 'Mindestens Downloads')}<select id="minDl">${opt(DL_OPT, '0')}</select></label><label>${T('Sort', 'Sortierung')}<select id="sort">${opt(SORT_OPT, 'downloads')}</select></label></div>
    <p class="status" id="status" role="status" aria-live="polite">${T('Well-known open models, from this page. The live list from the Hub loads next.', 'Bekannte offene Modelle, aus dieser Seite. Die aktuelle Liste aus dem Hub lädt gleich.')}</p>
    <ul class="cards" id="list" aria-label="${T('Models', 'Modelle')}">${SNAPSHOT.slice(0, 12).map(snapRow).join('')}</ul>
    <div class="row c"><button type="button" id="more">${T('Show more', 'Mehr zeigen')}</button></div>
  </section>
  <section class="pane" id="cardPane" aria-label="${T('Model card', 'Modellkarte')}">
    <h2>${T('Model card', 'Modellkarte')}</h2>
    <p class="note" id="cardNote">${T('Press Card on any model to read its card here: what it is for, how it was trained, its limits and its licence.', 'Drücke bei einem Modell auf Karte, um seine Karte hier zu lesen: wofür es gedacht ist, wie es trainiert wurde, seine Grenzen und seine Lizenz.')}</p>
    <div class="card-md" id="cardMd" aria-live="polite"></div>
  </section>
  <section class="pane" aria-label="${T('Compare side by side', 'Nebeneinander vergleichen')}">
    <h2>${T('Compare side by side', 'Nebeneinander vergleichen')}</h2>
    <p class="note" id="cmpNote">${T('Press Compare on up to three models to see their licence, size, memory to run and downloads side by side. They stay on this device, and the link carries them.', 'Drücke bei bis zu drei Modellen auf Vergleichen, um Lizenz, Größe, Speicher zum Ausführen und Downloads nebeneinander zu sehen. Sie bleiben auf diesem Gerät, und der Link trägt sie mit.')}</p>
    <div class="tw"><table id="cmp"><tbody></tbody></table></div>
    <div class="row"><button type="button" id="cmpClear">${T('Clear the comparison', 'Vergleich leeren')}</button><button type="button" id="cmpLink">${T('Copy a link to this comparison', 'Link zu diesem Vergleich kopieren')}</button></div>
  </section>
  <section class="pane" id="tryPane" aria-label="${T('Try it', 'Ausprobieren')}">
    <h2>${T('Try it', 'Ausprobieren')}</h2>
    <p class="note">${T('Verse can run these open models for free. A model in the list that has a Try button is one of them.', 'Verse kann diese offenen Modelle kostenlos ausführen. Ein Modell in der Liste mit einem Ausprobieren-Knopf ist eines davon.')}</p>
    <div class="row"><label>${T('Model', 'Modell')}<select id="tryModel">${opt(TRY_OPT, 'verse')}</select></label></div>
    <label class="vh" for="tryIn">${T('Your prompt', 'Deine Eingabe')}</label><textarea id="tryIn" maxlength="2000" placeholder="${T('Ask the model something, for example: explain what a transformer is in three sentences.', 'Frag das Modell etwas, zum Beispiel: Erkläre in drei Sätzen, was ein Transformer ist.')}"></textarea>
    <div class="row"><button type="button" class="go" id="tryGo">${T('Run', 'Ausführen')}</button><a href="/models/arena/">${T('Put two models against each other', 'Zwei Modelle gegeneinander antreten lassen')}</a></div>
    <div class="ans" id="tryOut" aria-live="polite"></div>
    <p class="note">${tryLimits}</p>
  </section>
  <section class="pane" aria-label="${T('What each licence allows', 'Was jede Lizenz erlaubt')}">
    <h2>${T('What each licence allows', 'Was jede Lizenz erlaubt')}</h2>
    <div class="tw"><table id="lics"><thead><tr><th>${T('Licence', 'Lizenz')}</th><th>${T('Commercial use', 'Kommerzielle Nutzung')}</th><th>${T('You must', 'Du musst')}</th><th>${T('Watch for', 'Achte auf')}</th></tr></thead><tbody>${LICENCES.map(([k, n, c, must, watch]) => `<tr><td><strong>${esc(n)}</strong><br><span class="note">${esc(k)}</span></td><td>${esc(c)}</td><td>${esc(must)}</td><td>${esc(watch)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${T('A plain summary, not legal advice: the licence file in each repository is what counts.', 'Eine einfache Zusammenfassung, keine Rechtsberatung: Es gilt die Lizenzdatei im jeweiligen Repository.')}</p>
  </section>
  ${credit(T('Models and datasets are read live by your browser from the Hugging Face Hub\'s public API (no key; the Hub limits how often one address may ask, so a result is kept on this device for ten minutes). Every name links to its page on Hugging Face, where its files, discussions and full card are. Card texts belong to their authors. Sizes come from the files\' own parameter counts; a size marked "from the name" is read off the model\'s name.', 'Modelle und Datensätze liest dein Browser direkt aus der öffentlichen API des Hugging Face Hub (ohne Schlüssel; der Hub begrenzt, wie oft eine Adresse fragen darf, deshalb bleibt ein Ergebnis zehn Minuten auf diesem Gerät). Jeder Name führt zu seiner Seite bei Hugging Face mit Dateien, Diskussionen und der ganzen Karte. Die Kartentexte gehören ihren Autoren. Größen stammen aus den Parameterzahlen der Dateien; eine Größe mit „aus dem Namen“ ist aus dem Modellnamen gelesen.'))}`,

  leaderboard: () => `
  <section class="pane" aria-label="${T('Leaderboard', 'Rangliste')}">
    <div class="row"><label>${T('Search a model', 'Ein Modell suchen')}<input type="search" id="q" maxlength="80" placeholder="${T('qwen, llama, mistral', 'qwen, llama, mistral')}" enterkeyhint="search"></label><label>${T('Size', 'Größe')}<select id="size">${opt(SIZE_OPT, '')}</select></label><label>${T('Type', 'Typ')}<select id="type">${opt([['', T('Every type', 'Jeder Typ')], ['pretrained', T('Pretrained', 'Vortrainiert')], ['chat', T('Chat (instruction tuned)', 'Chat (auf Anweisungen trainiert)')], ['fine', T('Fine-tuned', 'Feinabgestimmt')]], '')}</select></label><label class="chk"><input type="checkbox" id="merges"> ${T('Show merged models', 'Zusammengeführte Modelle zeigen')}</label></div>
    <p class="status" id="status" role="status" aria-live="polite">${T('Loading the leaderboard…', 'Die Rangliste lädt…')}</p>
    <div class="tw"><table id="board"><thead><tr><th>#</th><th>${T('Compare', 'Vergleichen')}</th><th><button type="button" data-k="name">${T('Model', 'Modell')}</button></th><th class="n"><button type="button" data-k="params">${T('Size', 'Größe')}</button></th>${BENCHES.map(([k, n]) => `<th class="n"><button type="button" data-k="${k}"${k === 'average' ? ' aria-pressed="true"' : ''}>${esc(n)}</button></th>`).join('')}</tr></thead><tbody id="rows"><tr><td colspan="10" style="height:360px">&nbsp;</td></tr></tbody></table></div>
    <div class="row"><button type="button" id="more">${T('Show more', 'Mehr zeigen')}</button><button type="button" id="csv">${T('Export CSV', 'Als CSV exportieren')}</button><button type="button" id="link">${T('Copy a link to this view', 'Link zu dieser Ansicht kopieren')}</button></div>
  </section>
  <section class="pane" aria-label="${T('Compare in a chart', 'Im Diagramm vergleichen')}">
    <h2>${T('Compare in a chart', 'Im Diagramm vergleichen')}</h2>
    <p class="note" id="chartNote">${T('Tick Compare on two to four models to see their scores bar by bar.', 'Hake bei zwei bis vier Modellen Vergleichen an, um ihre Werte Balken für Balken zu sehen.')}</p>
    <div id="chart" style="min-height:60px"></div>
  </section>
  <section class="pane" aria-label="${T('What the benchmarks measure', 'Was die Benchmarks messen')}">
    <h2>${T('What the benchmarks measure', 'Was die Benchmarks messen')}</h2>
    <dl>${BENCHES.map(([, n, , d]) => `<dt><strong>${esc(n)}</strong></dt><dd class="note" style="margin:0 0 6px">${esc(d)}</dd>`).join('')}</dl>
    <p class="note">${T('Scores are percentages, normalised so that random guessing scores 0. A higher score on a test is not the same as being better at what you need: try the models yourself in the arena.', 'Die Werte sind Prozente, so normiert, dass Raten 0 ergibt. Ein höherer Wert in einem Test heißt nicht, dass ein Modell für deine Aufgabe besser ist: probier die Modelle selbst in der Arena aus.')}</p>
  </section>
  ${credit(T('Scores from the Open LLM Leaderboard by Hugging Face, which evaluated open models with the same harness on the same hardware and was archived in 2025; read live from its public table through the Hub\'s dataset viewer. Only open models are here: closed models\' scores are reported by their makers and cannot be checked the same way. Every model links to its page on the Hub.', 'Werte aus dem Open LLM Leaderboard von Hugging Face, das offene Modelle mit demselben Verfahren auf derselben Hardware getestet hat und 2025 archiviert wurde; live aus seiner öffentlichen Tabelle über den Datensatz-Viewer des Hub gelesen. Hier stehen nur offene Modelle: die Werte geschlossener Modelle melden ihre Hersteller selbst, sie lassen sich nicht gleich prüfen. Jedes Modell führt zu seiner Seite im Hub.'))}`,

  local: () => `
  <section class="pane" aria-label="${T('Find a model to run', 'Ein Modell zum Ausführen finden')}">
    <div class="row"><label>${T('Search', 'Suche')}<input type="search" id="q" maxlength="80" placeholder="${T('llama, qwen, gemma, phi', 'llama, qwen, gemma, phi')}" enterkeyhint="search"></label><label>${T('What it does', 'Was es kann')}<select id="task">${opt([['', T('Anything', 'Alles')], ['text-generation', T('Chat and text', 'Chat und Text')], ['image-text-to-text', T('Vision (reads images)', 'Sehen (liest Bilder)')], ['feature-extraction', T('Embeddings', 'Embeddings')], ['automatic-speech-recognition', T('Speech to text', 'Sprache zu Text')]], '')}</select></label><label>${T('Sort', 'Sortierung')}<select id="sort">${opt(SORT_OPT, 'downloads')}</select></label></div>
    <p class="status" id="status" role="status" aria-live="polite">${T('Models packed as GGUF files, the format that runs on an ordinary computer. Loading the list…', 'Modelle als GGUF-Dateien, das Format, das auf einem normalen Computer läuft. Die Liste lädt…')}</p>
    <ul class="cards" id="list" aria-label="${T('Models to run at home', 'Modelle für zu Hause')}"></ul>
    <div class="row c"><button type="button" id="more">${T('Show more', 'Mehr zeigen')}</button></div>
  </section>
  <section class="pane" id="filesPane" aria-label="${T('Files and commands', 'Dateien und Befehle')}">
    <h2>${T('Files and commands', 'Dateien und Befehle')}</h2>
    <p class="note" id="filesNote">${T('Press Files on a model to see each build, its size and whether it fits your memory, with the command that runs it.', 'Drücke bei einem Modell auf Dateien, um jede Version, ihre Größe und ob sie in deinen Speicher passt zu sehen, mit dem Befehl zum Starten.')}</p>
    <div id="files" aria-live="polite"></div>
  </section>
  <section class="pane" aria-label="${T('Will it fit?', 'Passt es?')}">
    <h2>${T('Will it fit?', 'Passt es?')}</h2>
    <div class="row"><label>${T('Memory you can give it (GB of RAM, or of video memory for a graphics card)', 'Speicher, den du ihm geben kannst (GB RAM oder Grafikspeicher)')}<input type="number" id="mem" min="1" max="1024" value="16" inputmode="decimal"></label><label>${T('Model size (billions of parameters)', 'Modellgröße (Milliarden Parameter)')}<input type="number" id="psize" min="0.1" max="2000" step="0.1" value="8" inputmode="decimal"></label></div>
    <div class="tw"><table id="fit"><thead><tr><th>${T('Build', 'Version')}</th><th class="n">${T('Bits per weight', 'Bits pro Gewicht')}</th><th class="n">${T('Memory to run', 'Speicher zum Ausführen')}</th><th>${T('Fits?', 'Passt?')}</th><th>${T('What it means', 'Was es bedeutet')}</th></tr></thead><tbody>${QUANTS.map(([q, b, n]) => `<tr><td>${q}</td><td class="n">${b}</td><td class="n">${runGB(8e9, b)} GB</td><td>${runGB(8e9, b) <= 16 ? 'yes' : 'no'}</td><td>${esc(n)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note" id="fitNote">${T('An 8B model at Q4_K_M has about 4.9 GB of weights and needs about 5.9 GB to run.', 'Ein 8B-Modell in Q4_K_M hat etwa 4,9 GB Gewichte und braucht etwa 5,9 GB zum Ausführen.')}</p>
    <p class="note">${T('Weights take parameters × bits ÷ 8 bytes; running adds about a fifth for the conversation\'s memory and the program. A rule of thumb: long conversations need more.', 'Gewichte brauchen Parameter × Bits ÷ 8 Bytes; beim Ausführen kommt etwa ein Fünftel für das Gesprächsgedächtnis und das Programm dazu. Eine Faustregel: lange Gespräche brauchen mehr.')}</p>
  </section>
  <section class="pane" aria-label="${T('Quantization in plain words', 'Quantisierung einfach erklärt')}">
    <h2>${T('Quantization in plain words', 'Quantisierung einfach erklärt')}</h2>
    <p class="note">${T('A model is billions of numbers. Stored at full precision each takes 16 bits; a quantized build rounds them to fewer bits, so the file is smaller and runs on less memory, at the cost of a little accuracy. Q4_K_M keeps about 4.8 bits per weight and is the usual choice; Q8_0 is close to the original at about twice the size.', 'Ein Modell sind Milliarden Zahlen. In voller Genauigkeit braucht jede 16 Bit; eine quantisierte Version rundet sie auf weniger Bits, sodass die Datei kleiner ist und mit weniger Speicher läuft, gegen etwas Genauigkeit. Q4_K_M behält etwa 4,8 Bit pro Gewicht und ist die übliche Wahl; Q8_0 ist nah am Original bei etwa doppelter Größe.')}</p>
    <h3>${T('How to run one', 'So startest du eines')}</h3>
    <ol class="note"><li>${T('Install Ollama or llama.cpp (both free and open source).', 'Installiere Ollama oder llama.cpp (beide frei und quelloffen).')}</li><li>${T('Copy the command under Files and paste it into a terminal: the file downloads once, then runs offline.', 'Kopiere den Befehl unter Dateien in ein Terminal: die Datei lädt einmal und läuft dann offline.')}</li><li>${T('Talk to it in the terminal, or open the address the program prints in your browser.', 'Sprich im Terminal mit ihm oder öffne die Adresse, die das Programm ausgibt, im Browser.')}</li></ol>
  </section>
  ${credit(T('The list is read live by your browser from the Hugging Face Hub\'s public API (models tagged GGUF), with each repository\'s file list and sizes. Every model links to its page on the Hub. The commands use features of Ollama and llama.cpp that fetch a GGUF straight from the Hub.', 'Die Liste liest dein Browser live aus der öffentlichen API des Hugging Face Hub (als GGUF markierte Modelle), mit Dateiliste und Größen jedes Repositorys. Jedes Modell führt zu seiner Seite im Hub. Die Befehle nutzen Funktionen von Ollama und llama.cpp, die ein GGUF direkt aus dem Hub laden.'))}`,

  prices: () => `
  <section class="pane" aria-label="${T('Models and prices', 'Modelle und Preise')}">
    <div class="row"><label>${T('Search', 'Suche')}<input type="search" id="q" maxlength="80" placeholder="${T('a model or a maker', 'ein Modell oder ein Hersteller')}" enterkeyhint="search"></label><label>${T('Takes in', 'Nimmt an')}<select id="inMod">${opt([['', T('Anything', 'Alles')], ['text', T('Text', 'Text')], ['image', T('Images', 'Bilder')], ['audio', T('Audio', 'Audio')], ['file', T('Files', 'Dateien')]], '')}</select></label><label>${T('Gives out', 'Gibt aus')}<select id="outMod">${opt([['', T('Anything', 'Alles')], ['text', T('Text', 'Text')], ['image', T('Images', 'Bilder')]], '')}</select></label><label>${T('Context at least', 'Kontext mindestens')}<select id="ctx">${opt([['0', T('Any', 'Beliebig')], ['32000', '32K'], ['128000', '128K'], ['200000', '200K'], ['1000000', '1M']], '0')}</select></label></div>
    <div class="row"><label>${T('Highest price in ($ per million tokens)', 'Höchster Preis Eingabe ($ pro Million Tokens)')}<input type="number" id="maxIn" min="0" step="0.01" inputmode="decimal" placeholder="${T('no limit', 'kein Limit')}"></label><label>${T('Sort', 'Sortierung')}<select id="sort">${opt([['new', T('Newest', 'Neueste')], ['in', T('Cheapest in', 'Günstigste Eingabe')], ['out', T('Cheapest out', 'Günstigste Ausgabe')], ['ctx', T('Longest context', 'Längster Kontext')], ['name', T('Name', 'Name')]], 'new')}</select></label><label class="chk"><input type="checkbox" id="free"> ${T('Free only', 'Nur kostenlose')}</label><label class="chk"><input type="checkbox" id="tools"> ${T('Uses tools', 'Kann Werkzeuge nutzen')}</label></div>
    <p class="status" id="status" role="status" aria-live="polite">${T('Loading the model list…', 'Die Modellliste lädt…')}</p>
    <div class="tw"><table><thead><tr><th>${T('Compare', 'Vergleichen')}</th><th>${T('Model', 'Modell')}</th><th class="n">${T('In $/M', 'Ein $/M')}</th><th class="n">${T('Out $/M', 'Aus $/M')}</th><th class="n">${T('Context', 'Kontext')}</th><th>${T('In → out', 'Ein → aus')}</th></tr></thead><tbody id="rows"><tr><td colspan="6" style="height:360px">&nbsp;</td></tr></tbody></table></div>
    <div class="row c"><button type="button" id="more">${T('Show more', 'Mehr zeigen')}</button></div>
  </section>
  <section class="pane" aria-label="${T('Compare side by side', 'Nebeneinander vergleichen')}">
    <h2>${T('Compare side by side', 'Nebeneinander vergleichen')}</h2>
    <p class="note" id="cmpNote">${T('Tick Compare on up to three models.', 'Hake bei bis zu drei Modellen Vergleichen an.')}</p>
    <div class="tw"><table id="cmp"><tbody></tbody></table></div>
  </section>
  <section class="pane" aria-label="${T('What would it cost?', 'Was würde es kosten?')}">
    <h2>${T('What would it cost?', 'Was würde es kosten?')}</h2>
    <div class="row"><label>${T('Model', 'Modell')}<select id="calcModel"><option value="">${T('Prices typed below', 'Preise unten eingetragen')}</option></select></label></div>
    <div class="row"><label>${T('Price in ($ per million tokens)', 'Preis Eingabe ($ pro Million Tokens)')}<input type="number" id="pIn" min="0" step="0.01" value="1" inputmode="decimal"></label><label>${T('Price out ($ per million tokens)', 'Preis Ausgabe ($ pro Million Tokens)')}<input type="number" id="pOut" min="0" step="0.01" value="2" inputmode="decimal"></label></div>
    <div class="row"><label>${T('Tokens in per request', 'Tokens Eingabe pro Anfrage')}<input type="number" id="tIn" min="0" value="1000" inputmode="numeric"></label><label>${T('Tokens out per request', 'Tokens Ausgabe pro Anfrage')}<input type="number" id="tOut" min="0" value="500" inputmode="numeric"></label><label>${T('Requests a day', 'Anfragen pro Tag')}<input type="number" id="reqs" min="0" value="1000" inputmode="numeric"></label></div>
    <p class="status" id="costOut" aria-live="polite">${money(costOf(1, 2, 1000, 500, 1000).day)} ${T('a day', 'pro Tag')}, ${money(costOf(1, 2, 1000, 500, 1000).month)} ${T('a month (30 days)', 'pro Monat (30 Tage)')}</p>
    <p class="note">${T('A token is about three quarters of an English word. 1,000 requests of 1,000 tokens in and 500 out, at $1 and $2 per million, cost $2.00 a day.', 'Ein Token ist etwa drei Viertel eines englischen Wortes. 1.000 Anfragen mit 1.000 Tokens Eingabe und 500 Ausgabe kosten bei 1 $ und 2 $ pro Million 2,00 $ pro Tag.')}</p>
  </section>
  ${credit(T('Models, prices and context lengths are read live by your browser from OpenRouter\'s public model list (no key), in US dollars per million tokens as it lists them; a model may cost less with another provider. Each model links to its page there. Verse sells nothing here and has no affiliate link.', 'Modelle, Preise und Kontextlängen liest dein Browser live aus der öffentlichen Modellliste von OpenRouter (ohne Schlüssel), in US-Dollar pro Million Tokens, wie dort angegeben; bei einem anderen Anbieter kann ein Modell weniger kosten. Jedes Modell führt zu seiner Seite dort. Verse verkauft hier nichts und hat keinen Partnerlink.'))}`,

  arena: () => `
  <section class="pane" aria-label="${T('Battle', 'Duell')}">
    <h2>${T('Battle: two hidden models, one prompt', 'Duell: zwei verborgene Modelle, eine Eingabe')}</h2>
    <div class="row"><label>${T('Category', 'Kategorie')}<select id="cat">${opt([['general', T('General', 'Allgemein')], ['coding', T('Coding', 'Programmieren')], ['writing', T('Writing', 'Schreiben')], ['math', T('Maths and reasoning', 'Mathe und Denken')], ['advice', T('Advice', 'Rat')]], 'general')}</select></label></div>
    <label class="vh" for="prompt">${T('Your prompt', 'Deine Eingabe')}</label><textarea id="prompt" maxlength="2000" placeholder="${T('Ask both models the same thing, for example: write a haiku about the sea.', 'Frag beide Modelle dasselbe, zum Beispiel: Schreib ein Haiku über das Meer.')}"></textarea>
    <div class="row"><button type="button" class="go" id="battle">${T('Battle', 'Duell starten')}</button></div>
    <div class="two"><div class="ans" id="ansA" aria-live="polite"><h3>${T('Model A', 'Modell A')}</h3></div><div class="ans" id="ansB" aria-live="polite"><h3>${T('Model B', 'Modell B')}</h3></div></div>
    <div class="row c" role="group" aria-label="${T('Your vote', 'Deine Stimme')}"><button type="button" data-vote="a" disabled>${T('A is better', 'A ist besser')}</button><button type="button" data-vote="b" disabled>${T('B is better', 'B ist besser')}</button><button type="button" data-vote="tie" disabled>${T('Tie', 'Unentschieden')}</button><button type="button" data-vote="bad" disabled>${T('Both are bad', 'Beide schlecht')}</button></div>
    <p class="status" id="reveal" role="status" aria-live="polite">${T('The names show after you vote.', 'Die Namen erscheinen nach deiner Stimme.')}</p>
  </section>
  <section class="pane" aria-label="${T('Side by side', 'Nebeneinander')}">
    <h2>${T('Side by side: you choose the models', 'Nebeneinander: du wählst die Modelle')}</h2>
    <div class="row"><label>${T('Left', 'Links')}<select id="sbA">${opt(TRY_OPT, 'verse')}</select></label><label>${T('Right', 'Rechts')}<select id="sbB">${opt(TRY_OPT, 'llama8')}</select></label><button type="button" id="sbGo">${T('Ask both', 'Beide fragen')}</button></div>
    <div class="two"><div class="ans" id="sbOutA" aria-live="polite"></div><div class="ans" id="sbOutB" aria-live="polite"></div></div>
  </section>
  <section class="pane" aria-label="${T('Your ratings', 'Deine Wertungen')}">
    <h2>${T('Your ratings', 'Deine Wertungen')}</h2>
    <div class="row"><label>${T('Category', 'Kategorie')}<select id="rcat">${opt([['', T('All categories', 'Alle Kategorien')], ['general', T('General', 'Allgemein')], ['coding', T('Coding', 'Programmieren')], ['writing', T('Writing', 'Schreiben')], ['math', T('Maths and reasoning', 'Mathe und Denken')], ['advice', T('Advice', 'Rat')]], '')}</select></label></div>
    <div class="tw"><table id="ratings"><thead><tr><th>#</th><th>${T('Model', 'Modell')}</th><th class="n">${T('Rating', 'Wertung')}</th><th class="n">${T('Wins', 'Siege')}</th><th class="n">${T('Losses', 'Niederlagen')}</th><th class="n">${T('Ties', 'Unentschieden')}</th><th class="n">${T('Battles', 'Duelle')}</th></tr></thead><tbody></tbody></table></div>
    <p class="note" id="votesNote">${T('No votes yet.', 'Noch keine Stimmen.')}</p>
    <div class="row"><button type="button" id="csv">${T('Export votes as CSV', 'Stimmen als CSV exportieren')}</button><button type="button" id="link">${T('Copy a link to my ratings', 'Link zu meinen Wertungen kopieren')}</button><button type="button" id="clear">${T('Clear my votes', 'Meine Stimmen löschen')}</button></div>
  </section>
  <section class="pane" aria-label="${T('How the rating works', 'Wie die Wertung funktioniert')}">
    <h2>${T('How the rating works', 'Wie die Wertung funktioniert')}</h2>
    <p class="note">${T('Each model starts at 1000. After a vote the winner takes points from the loser, more when it beats a higher-rated model (Elo, K = 32). Two models at 1000: the winner goes to 1016 and the loser to 984. A tie moves them toward each other; "both are bad" counts as a tie.', 'Jedes Modell beginnt bei 1000. Nach einer Stimme nimmt der Sieger dem Verlierer Punkte ab, mehr, wenn er ein höher bewertetes Modell schlägt (Elo, K = 32). Zwei Modelle mit 1000: der Sieger steigt auf 1016, der Verlierer fällt auf 984. Ein Unentschieden bringt sie näher zusammen; „beide schlecht“ zählt als Unentschieden.')}</p>
    <p class="note">${T('Your table holds only your own votes, kept on this device. A public arena pools millions of votes from everyone; this one shows what you prefer. Each battle spends two answers from Verse\'s free daily limit.', 'Deine Tabelle enthält nur deine eigenen Stimmen, auf diesem Gerät. Eine öffentliche Arena sammelt Millionen Stimmen von allen; diese zeigt, was du bevorzugst. Jedes Duell braucht zwei Antworten aus dem freien Tageslimit von Verse.')}</p>
    <p class="note">${tryLimits}</p>
  </section>`,
};

// ---------------------------------------------------------------- the assistant pages
const TEMPLATE_OPT = [['', T('Start from a template…', 'Mit einer Vorlage beginnen…')], ...TEMPLATES.map(([k, n]) => [k, n])];
const LIMITS = `
  <section class="pane" aria-label="${T('What it can and cannot do', 'Was es kann und nicht kann')}">
    <h2>${T('What it can and cannot do', 'Was es kann und nicht kann')}</h2>
    <ul class="note">
      <li>${T('It answers with a smaller open model on Verse\'s free share of Cloudflare Workers AI, not a frontier model: it knows less, reasons less deeply and makes more mistakes than the largest assistants. Check anything that matters.', 'Es antwortet mit einem kleineren offenen Modell auf dem freien Anteil von Verse an Cloudflare Workers AI, nicht mit einem Spitzenmodell: es weiß weniger, denkt weniger tief und macht mehr Fehler als die größten Assistenten. Prüfe alles, was wichtig ist.')}</li>
      <li>${T('There is a daily free limit shared by everyone, and about ten messages a minute each. When it is reached the page says so and keeps your chat.', 'Es gibt ein freies Tageslimit für alle zusammen und etwa zehn Nachrichten pro Minute für jeden. Ist es erreicht, sagt die Seite das und behält deinen Chat.')}</li>
      <li>${T('It sees only this conversation\'s text (the last 16 turns): no web browsing, no images or PDFs read by the model, no memory across chats, no connectors to your accounts.', 'Es sieht nur den Text dieses Gesprächs (die letzten 16 Beiträge): kein Surfen im Web, keine Bilder oder PDFs, die das Modell liest, kein Gedächtnis über Chats hinweg, keine Verbindungen zu deinen Konten.')}</li>
      <li>${T('It writes code, and JavaScript runs right here in your browser, sealed off from the page; it does not run other languages or make files for you.', 'Es schreibt Code, und JavaScript läuft direkt hier in deinem Browser, abgeschottet von der Seite; andere Sprachen führt es nicht aus und es erstellt keine Dateien für dich.')}</li>
      <li>${T('Verse builds itself: questions it cannot handle well become work it takes on, so it grows from what people ask.', 'Verse baut sich selbst: Fragen, mit denen es nicht gut umgehen kann, werden zu Arbeit, die es übernimmt, so wächst es an dem, was Menschen fragen.')}</li>
      <li>${T('No account: your chats, notes and instructions stay on this device. Each message is sent once to be answered and is not stored by Verse.', 'Kein Konto: deine Chats, Notizen und Anweisungen bleiben auf diesem Gerät. Jede Nachricht wird einmal zum Beantworten gesendet und von Verse nicht gespeichert.')}</li>
    </ul>
  </section>`;
const chatShell = (o) => `
  <div class="chat">
    <aside class="side" aria-label="${T('Your chats', 'Deine Chats')}">
      <div class="row"><button type="button" class="go" id="newChat" style="flex:1">${T('New chat', 'Neuer Chat')}</button>${o.burn ? `<button type="button" id="burn" title="${T('Burn every chat on this device', 'Alle Chats auf diesem Gerät verbrennen')}">${T('Burn all', 'Alle verbrennen')}</button>` : ''}</div>
      <label class="vh" for="find">${T('Search your chats', 'Deine Chats durchsuchen')}</label><input type="search" id="find" placeholder="${T('Search your chats', 'Deine Chats durchsuchen')}" style="width:100%">
      ${o.folders ? `<div class="row"><label>${T('Folder', 'Ordner')}<select id="folderFilter"><option value="">${T('Every folder', 'Alle Ordner')}</option></select></label></div>` : ''}
      <ul id="chats" aria-label="${T('Chats', 'Chats')}"></ul>
      ${o.stats ? `<p class="note" id="stats"></p>` : ''}
    </aside>
    <div>
      <section class="thread" id="thread" aria-label="${T('Conversation', 'Gespräch')}" aria-live="polite"><p class="empty" id="emptyNote">${o.empty}</p></section>
      <form class="composer" id="composer" aria-label="${T('Write a message', 'Eine Nachricht schreiben')}">
        <label class="vh" for="box">${T('Your message', 'Deine Nachricht')}</label>
        <textarea id="box" maxlength="4000" placeholder="${o.placeholder}" enterkeyhint="send"></textarea>
        <div class="row">
          <button type="submit" class="go" id="send">${T('Send', 'Senden')}</button><button type="button" id="stop" disabled>${T('Stop', 'Stopp')}</button><button type="button" id="again" disabled>${T('Answer again', 'Neu antworten')}</button>
          ${o.voice ? `<button type="button" id="mic" aria-pressed="false">${T('Speak', 'Sprechen')}</button>` : ''}
          ${o.attach ? `<label class="chk" style="font-size:15px"><span>${T('Add a text file', 'Eine Textdatei anhängen')}</span><input type="file" id="file" accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.log,text/*" style="max-width:190px"></label>` : ''}
        </div>
        <div class="row">
          ${o.templates ? `<label>${T('Template', 'Vorlage')}<select id="tpl">${opt(TEMPLATE_OPT, '')}</select></label>` : ''}
          ${o.styles ? `<label>${T('Chat style', 'Chat-Stil')}<select id="style">${opt(STYLE_NAMES.map(([k, n]) => [k, n]), o.style || 'default')}</select></label>` : ''}
          ${o.models ? `<label>${T('Model', 'Modell')}<select id="model">${opt(TRY_OPT, 'verse')}</select></label>` : ''}
          ${o.folders ? `<label>${T('This chat\'s folder', 'Ordner dieses Chats')}<input id="folder" maxlength="40" list="folderList" placeholder="${T('Work, school, ideas', 'Arbeit, Schule, Ideen')}"><datalist id="folderList"></datalist></label>` : ''}
        </div>
        <p class="status" id="status" role="status" aria-live="polite">${T('Enter sends, Shift+Enter starts a new line.', 'Enter sendet, Umschalt+Enter beginnt eine neue Zeile.')}</p>
      </form>
    </div>
  </div>`;
const TOOLS = `
  <section class="pane" aria-label="${T('Text tools', 'Textwerkzeuge')}">
    <h2>${T('Text tools', 'Textwerkzeuge')}</h2>
    <p class="note">${T('Count, summarize and rewrite run on this device and work offline; translate uses Verse\'s translator.', 'Zählen, Zusammenfassen und Umschreiben laufen auf diesem Gerät und offline; Übersetzen nutzt den Übersetzer von Verse.')}</p>
    <div class="row"><label>${T('Use the text of', 'Den Text nehmen von')}<select id="toolSrc">${opt([['reply', T('the last reply', 'der letzten Antwort')], ['box', T('the message box', 'dem Nachrichtenfeld')], ['file', T('the added file', 'der angehängten Datei')], ['notes', T('my notes', 'meinen Notizen')]], 'reply')}</select></label><label>${T('Rewrite as', 'Umschreiben als')}<select id="how">${opt([['shorter', T('Shorter (filler out)', 'Kürzer (Füllwörter raus)')], ['tidy', T('Tidy spaces and capitals', 'Leerzeichen und Großschreibung aufräumen')], ['bullets', T('Bullet points', 'Stichpunkte')], ['sentence', T('Sentence case', 'Satzschreibung')], ['title', T('Title Case', 'Titelschreibung')], ['upper', T('UPPER CASE', 'GROSSBUCHSTABEN')], ['lower', T('lower case', 'kleinbuchstaben')]], 'shorter')}</select></label><label>${T('Translate to', 'Übersetzen nach')}<select id="lang">${opt([['de', 'Deutsch'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['uk', 'Українська'], ['ja', '日本語'], ['zh', '中文']], 'de')}</select></label></div>
    <div class="row"><button type="button" id="tCount">${T('Count', 'Zählen')}</button><button type="button" id="tSum">${T('Summarize', 'Zusammenfassen')}</button><button type="button" id="tRe">${T('Rewrite', 'Umschreiben')}</button><button type="button" id="tTr">${T('Translate', 'Übersetzen')}</button><button type="button" id="tAsk">${T('Ask Verse to rewrite it', 'Verse umschreiben lassen')}</button></div>
    <div class="ans" id="toolOut" aria-live="polite" style="min-height:80px;white-space:pre-wrap"></div>
    <div class="row"><button type="button" id="toolCopy">${T('Copy the result', 'Ergebnis kopieren')}</button><button type="button" id="toolToBox">${T('Put it in the message box', 'Ins Nachrichtenfeld setzen')}</button></div>
  </section>`;
const NOTES = `
  <section class="pane" aria-label="${T('Notes', 'Notizen')}">
    <h2>${T('Notes', 'Notizen')}</h2>
    <label class="vh" for="notes">${T('Your notes', 'Deine Notizen')}</label><textarea id="notes" style="min-height:120px" placeholder="${T('Notes kept on this device; they work offline.', 'Notizen auf diesem Gerät; sie funktionieren offline.')}"></textarea>
    <div class="row"><button type="button" id="toNotes">${T('Save the last reply to notes', 'Letzte Antwort in die Notizen')}</button><span class="note" id="notesNote">${T('Saved as you type.', 'Wird beim Tippen gespeichert.')}</span></div>
  </section>`;
const INSTR = `
  <section class="pane" aria-label="${T('Standing instructions', 'Dauerhafte Anweisungen')}">
    <h2>${T('Standing instructions', 'Dauerhafte Anweisungen')}</h2>
    <label class="vh" for="instr">${T('What Verse should always keep in mind', 'Was Verse immer beachten soll')}</label><textarea id="instr" maxlength="800" placeholder="${T('For example: I am a nurse; answer in plain English; keep answers short.', 'Zum Beispiel: Ich bin Pflegekraft; antworte einfach; halte dich kurz.')}"></textarea>
    <p class="note">${T('Sent with every message of every chat, kept on this device.', 'Wird mit jeder Nachricht jedes Chats gesendet, auf diesem Gerät gespeichert.')}</p>
  </section>`;
const SHARE = `
  <section class="pane" aria-label="${T('Share and export', 'Teilen und exportieren')}">
    <h2>${T('Share and export', 'Teilen und exportieren')}</h2>
    <div class="row"><button type="button" id="shareChat">${T('Share this chat as a link', 'Diesen Chat als Link teilen')}</button><button type="button" id="exMd">${T('Export this chat (Markdown)', 'Diesen Chat exportieren (Markdown)')}</button><button type="button" id="exJson">${T('Export every chat (JSON)', 'Alle Chats exportieren (JSON)')}</button><label class="chk" style="font-size:15px"><span>${T('Import chats', 'Chats importieren')}</span><input type="file" id="imp" accept=".json,application/json" style="max-width:190px"></label><button type="button" id="print">${T('Print', 'Drucken')}</button></div>
    <p class="note" id="shareNote">${T('A shared link holds the chat itself, packed into the address: nothing is uploaded, and whoever opens it can keep a copy.', 'Ein geteilter Link enthält den Chat selbst, gepackt in die Adresse: nichts wird hochgeladen, und wer ihn öffnet, kann eine Kopie behalten.')}</p>
  </section>`;
const DEF_EMPTY = T('Ask anything. Your chats stay on this device.', 'Frag, was du willst. Deine Chats bleiben auf diesem Gerät.');
const DEF_PH = T('Message Verse', 'Nachricht an Verse');
const ASSISTANT_BODY = {
  hub: () => chatShell({ attach: true, templates: true, styles: true, models: true, empty: DEF_EMPTY, placeholder: DEF_PH }) + TOOLS + INSTR + NOTES + SHARE + LIMITS,
  workspace: () => chatShell({ attach: true, templates: true, styles: true, models: true, folders: true, stats: true, empty: T('Your workspace: chats in folders, pinned chats on top, a prompt library on "/", characters with their own instructions.', 'Dein Arbeitsbereich: Chats in Ordnern, angeheftete Chats oben, eine Prompt-Bibliothek auf „/“, Figuren mit eigenen Anweisungen.'), placeholder: T('Message Verse, or type / for your prompts', 'Nachricht an Verse oder / für deine Prompts') }) + `
  <section class="pane" aria-label="${T('Prompt library', 'Prompt-Bibliothek')}">
    <h2>${T('Prompt library', 'Prompt-Bibliothek')}</h2>
    <p class="note">${T('Save prompts you use often; type / in the message box to pick one.', 'Speichere Prompts, die du oft nutzt; tippe / ins Nachrichtenfeld, um einen zu wählen.')}</p>
    <div class="row"><label>${T('Name', 'Name')}<input id="pName" maxlength="40" placeholder="${T('Weekly report', 'Wochenbericht')}"></label><label>${T('Prompt', 'Prompt')}<input id="pText" maxlength="1000" placeholder="${T('Turn these notes into a weekly report: …', 'Mach aus diesen Notizen einen Wochenbericht: …')}"></label><button type="button" id="pSave">${T('Save prompt', 'Prompt speichern')}</button></div>
    <ul class="cards" id="prompts" style="min-height:60px"></ul>
  </section>
  <section class="pane" aria-label="${T('Characters', 'Figuren')}">
    <h2>${T('Characters', 'Figuren')}</h2>
    <p class="note">${T('A character is a name with its own standing instructions. Pick one for this chat.', 'Eine Figur ist ein Name mit eigenen dauerhaften Anweisungen. Wähle eine für diesen Chat.')}</p>
    <div class="row"><label>${T('Name', 'Name')}<input id="cName" maxlength="40" placeholder="${T('Spanish tutor', 'Spanischlehrer')}"></label><label>${T('Instructions', 'Anweisungen')}<input id="cText" maxlength="800" placeholder="${T('Answer in simple Spanish and correct my mistakes.', 'Antworte in einfachem Spanisch und korrigiere meine Fehler.')}"></label><button type="button" id="cSave">${T('Save character', 'Figur speichern')}</button></div>
    <div class="row"><label>${T('Character for this chat', 'Figur für diesen Chat')}<select id="charSel"><option value="">${T('None', 'Keine')}</option></select></label></div>
  </section>` + INSTR + TOOLS + SHARE + LIMITS,
  voice: () => chatShell({ voice: true, empty: T('Press Speak and talk, or type. Replies are read aloud.', 'Drück Sprechen und rede, oder tippe. Antworten werden vorgelesen.'), placeholder: T('Say or type something', 'Sag oder tippe etwas') }) + `
  <section class="pane" aria-label="${T('Voice', 'Stimme')}">
    <h2>${T('Voice', 'Stimme')}</h2>
    <div class="row"><label class="chk"><input type="checkbox" id="readAloud" checked> ${T('Read replies aloud', 'Antworten vorlesen')}</label><label class="chk"><input type="checkbox" id="handsFree"> ${T('Hands-free: listen again after each reply', 'Freihändig: nach jeder Antwort wieder zuhören')}</label></div>
    <div class="row"><label>${T('Voice', 'Stimme')}<select id="voiceSel"><option value="">${T('The device\'s default voice', 'Die Standardstimme des Geräts')}</option></select></label><label>${T('Speed', 'Tempo')}<input type="range" id="rate" min="0.6" max="1.6" step="0.1" value="1"></label><button type="button" id="hush">${T('Stop speaking', 'Nicht mehr sprechen')}</button></div>
    <p class="note" id="voiceNote">${T('Your browser turns speech into text and reads the replies; where it cannot, type instead. Speech recognition in some browsers is done by the browser maker\'s service.', 'Dein Browser macht aus Sprache Text und liest die Antworten vor; wo er das nicht kann, tippe stattdessen. Die Spracherkennung mancher Browser läuft über einen Dienst des Browserherstellers.')}</p>
  </section>
  <section class="pane" aria-label="${T('Topics to start from', 'Themen zum Einstieg')}">
    <h2>${T('Topics to start from', 'Themen zum Einstieg')}</h2>
    <div class="row" id="topics">${[T('Help me unwind after a long day', 'Hilf mir, nach einem langen Tag abzuschalten'), T('Talk me through a decision', 'Hilf mir bei einer Entscheidung'), T('Tell me something fascinating', 'Erzähl mir etwas Faszinierendes'), T('Practise a hard conversation', 'Ein schwieriges Gespräch üben'), T('Plan my weekend', 'Plan mein Wochenende'), T('Let\'s brainstorm a gift', 'Lass uns eine Geschenkidee finden')].map((x) => `<button type="button" data-topic="${esc(x)}">${esc(x)}</button>`).join('')}</div>
  </section>` + NOTES + SHARE + LIMITS,
  quick: () => `
  <section class="pane" aria-label="${T('Chat style', 'Chat-Stil')}">
    <h2>${T('Chat style', 'Chat-Stil')}</h2>
    <div class="row" id="styleBtns">${STYLE_NAMES.filter(([k]) => k !== 'long' && k !== 'warm').map(([k, n]) => `<button type="button" data-style="${k}" aria-pressed="${k === 'default'}">${esc(n)}</button>`).join('')}</div>
    <div class="row"><label class="chk"><input type="checkbox" id="longer"> ${T('Longer, deeper answers', 'Längere, tiefere Antworten')}</label></div>
  </section>` + chatShell({ empty: T('Ask anything: no sign-in, an answer in seconds.', 'Frag irgendwas: ohne Anmeldung, eine Antwort in Sekunden.'), placeholder: T('Ask anything', 'Frag irgendwas') }) + SHARE + LIMITS,
  private: () => `
  <section class="pane" aria-label="${T('Privacy', 'Privatsphäre')}">
    <h2>${T('Privacy', 'Privatsphäre')}</h2>
    <ul class="note"><li>${T('No account, no cookie, no tracking of what you write.', 'Kein Konto, kein Cookie, kein Mitlesen dessen, was du schreibst.')}</li><li>${T('Each message goes once to the model on Verse\'s Cloudflare account to be answered; Verse keeps no log or copy of it.', 'Jede Nachricht geht einmal an das Modell im Cloudflare-Konto von Verse, um beantwortet zu werden; Verse behält kein Protokoll und keine Kopie.')}</li><li>${T('Your recent chats are kept only in this browser, and only if you want them kept.', 'Deine letzten Chats bleiben nur in diesem Browser, und nur, wenn du das willst.')}</li><li>${T('Burn all deletes every chat on this device at once.', 'Alle verbrennen löscht sofort jeden Chat auf diesem Gerät.')}</li></ul>
    <div class="row"><label class="chk"><input type="checkbox" id="keepChats" checked> ${T('Keep my recent chats on this device', 'Meine letzten Chats auf diesem Gerät behalten')}</label></div>
  </section>` + chatShell({ burn: true, models: true, empty: T('A private chat. Pick a model below; nothing is kept but what this browser keeps.', 'Ein privater Chat. Wähle unten ein Modell; nichts bleibt außer dem, was dieser Browser behält.'), placeholder: T('Message, privately', 'Nachricht, privat') }) + SHARE + LIMITS,
  sources: () => chatShell({ empty: T('Ask a question: the answer comes with its sources, numbered.', 'Stell eine Frage: die Antwort kommt mit ihren Quellen, nummeriert.'), placeholder: T('Ask a question', 'Stell eine Frage') }) + `
  <section class="pane" aria-label="${T('Sources', 'Quellen')}">
    <h2>${T('Sources', 'Quellen')}</h2>
    <ul class="src" id="srcCards" style="min-height:60px"></ul>
    <h3>${T('Ask next', 'Als Nächstes fragen')}</h3>
    <div class="row" id="follow" style="min-height:44px"></div>
    <p class="note">${T('The sources are encyclopedia articles found for your question; the answer cites one only where it really answers part of it. There is no live web search, so very recent news may be missing. Each question is answered on its own; a follow-up carries the subject along.', 'Die Quellen sind Lexikonartikel, die zu deiner Frage gefunden wurden; die Antwort zitiert einen nur, wo er wirklich einen Teil beantwortet. Es gibt keine Live-Websuche, sehr aktuelle Nachrichten können also fehlen. Jede Frage wird für sich beantwortet; eine Folgefrage nimmt das Thema mit.')}</p>
  </section>` + SHARE + LIMITS,
};

// words the pages' code writes (the app modules call t() on them)
const RUNTIME = [
  ['Card', 'Karte'], ['Compare', 'Vergleichen'], ['Try', 'Ausprobieren'], ['Files', 'Dateien'], ['Copy', 'Kopieren'], ['Copied.', 'Kopiert.'], ['Copied the link.', 'Link kopiert.'], ['Run', 'Ausführen'],
  ['downloads', 'Downloads'], ['likes', 'Likes'], ['updated', 'aktualisiert'], ['from the name', 'aus dem Namen'], ['gated: accept its terms on the Hub', 'gesperrt: Bedingungen im Hub annehmen'], ['size not stated', 'Größe nicht angegeben'],
  ['Loading…', 'Lädt…'], ['Thinking…', 'Denkt nach…'], ['Nothing matches. Try fewer filters.', 'Nichts passt. Versuch es mit weniger Filtern.'], ['You are offline: showing what this device kept.', 'Du bist offline: es wird gezeigt, was dieses Gerät gespeichert hat.'],
  ['The Hub did not answer just now; showing the models this page carries.', 'Der Hub hat gerade nicht geantwortet; es werden die Modelle aus dieser Seite gezeigt.'], ['Live from the Hugging Face Hub', 'Live aus dem Hugging Face Hub'], ['shown', 'gezeigt'],
  ['No card text in this repository.', 'Kein Kartentext in diesem Repository.'], ['Open it on the Hub', 'Im Hub öffnen'], ['Licence', 'Lizenz'], ['Task', 'Aufgabe'], ['Size', 'Größe'], ['Downloads', 'Downloads'], ['Likes', 'Likes'], ['Updated', 'Aktualisiert'], ['Library', 'Bibliothek'],
  ['Memory to run (Q4)', 'Speicher zum Ausführen (Q4)'], ['Memory to run (16-bit)', 'Speicher zum Ausführen (16 Bit)'], ['Verse can run it', 'Verse kann es ausführen'], ['yes', 'ja'], ['no', 'nein'], ['Remove', 'Entfernen'], ['At most three models.', 'Höchstens drei Modelle.'],
  ['Write a prompt first.', 'Schreib zuerst eine Eingabe.'], ['The model did not answer.', 'Das Modell hat nicht geantwortet.'], ['rows', 'Zeilen'], ['Sorted by', 'Sortiert nach'], ['Searching…', 'Sucht…'],
  ['The leaderboard did not load. Try again later.', 'Die Rangliste hat nicht geladen. Versuch es später.'], ['No GGUF files listed.', 'Keine GGUF-Dateien aufgeführt.'], ['fits', 'passt'], ['too big', 'zu groß'], ['Run it with Ollama', 'Mit Ollama starten'], ['Run it with llama.cpp', 'Mit llama.cpp starten'],
  ['The price list did not load. Try again later.', 'Die Preisliste hat nicht geladen. Versuch es später.'], ['free', 'kostenlos'], ['models', 'Modelle'], ['a day', 'pro Tag'], ['a month (30 days)', 'pro Monat (30 Tage)'], ['Context', 'Kontext'], ['Max output', 'Maximale Ausgabe'], ['In $/M', 'Ein $/M'], ['Out $/M', 'Aus $/M'], ['Takes in', 'Nimmt an'], ['Gives out', 'Gibt aus'], ['Uses tools', 'Kann Werkzeuge nutzen'],
  ['Model A', 'Modell A'], ['Model B', 'Modell B'], ['A was', 'A war'], ['B was', 'B war'], ['Vote kept.', 'Stimme gespeichert.'], ['votes', 'Stimmen'], ['No votes yet.', 'Noch keine Stimmen.'], ['Clear every vote on this device?', 'Alle Stimmen auf diesem Gerät löschen?'],
  ['You', 'Du'], ['Verse', 'Verse'], ['New chat', 'Neuer Chat'], ['Pin', 'Anheften'], ['Unpin', 'Lösen'], ['Rename', 'Umbenennen'], ['Delete', 'Löschen'], ['Delete this chat?', 'Diesen Chat löschen?'], ['Name of the chat', 'Name des Chats'],
  ['Read aloud', 'Vorlesen'], ['Edit', 'Bearbeiten'], ['Run the JavaScript', 'JavaScript ausführen'], ['Copy the code', 'Code kopieren'], ['(no output)', '(keine Ausgabe)'], ['Stopped after 3 seconds.', 'Nach 3 Sekunden gestoppt.'],
  ['You are offline. Your message stays in the box; notes, chats and the text tools work offline.', 'Du bist offline. Deine Nachricht bleibt im Feld; Notizen, Chats und Textwerkzeuge funktionieren offline.'], ['Stopped.', 'Gestoppt.'],
  ['words', 'Wörter'], ['characters', 'Zeichen'], ['without spaces', 'ohne Leerzeichen'], ['sentences', 'Sätze'], ['paragraphs', 'Absätze'], ['min to read', 'Min. Lesezeit'], ['min to speak', 'Min. Sprechzeit'], ['No text there yet.', 'Dort ist noch kein Text.'],
  ['Translating…', 'Übersetzt…'], ['The translator did not answer.', 'Der Übersetzer hat nicht geantwortet.'], ['Added', 'Angehängt'], ['The file is not text this page can read.', 'Die Datei ist kein Text, den diese Seite lesen kann.'],
  ['A shared chat. Keep a copy to continue it.', 'Ein geteilter Chat. Behalte eine Kopie, um weiterzumachen.'], ['Keep a copy', 'Kopie behalten'], ['Kept as a new chat.', 'Als neuer Chat behalten.'], ['Imported', 'Importiert'], ['chats', 'Chats'], ['messages', 'Nachrichten'],
  ['Burn every chat on this device? This cannot be undone.', 'Jeden Chat auf diesem Gerät verbrennen? Das lässt sich nicht rückgängig machen.'], ['Every chat is gone.', 'Jeder Chat ist weg.'], ['Saved to notes.', 'In den Notizen gespeichert.'],
  ['Listening…', 'Hört zu…'], ['This browser cannot turn speech into text; type instead.', 'Dieser Browser kann Sprache nicht in Text umwandeln; tippe stattdessen.'], ['Sources', 'Quellen'], ['No source matched: answered from the model\'s own knowledge.', 'Keine Quelle passte: aus dem eigenen Wissen des Modells beantwortet.'],
  ['matches', 'Treffer'], ['Prompt saved.', 'Prompt gespeichert.'], ['Character saved.', 'Figur gespeichert.'], ['Folder', 'Ordner'], ['Your prompts', 'Deine Prompts'], ['Insert', 'Einfügen'], ['Light or dark', 'Hell oder dunkel'], ['Share this page', 'Diese Seite teilen'],
];

// ---------------------------------------------------------------- the shell
const NAVS = { models: MODEL_SITES.map((r) => [r.path, r.name]), assistant: ASSISTANT_SITES.map((r) => [r.path, r.name]) };
for (const r of [...MODEL_SITES, ...ASSISTANT_SITES]) T(r.name, { '/models/': 'KI-Modelle', '/models/leaderboard/': 'Modell-Rangliste', '/models/local/': 'Modelle für zu Hause', '/models/prices/': 'Modellpreise und Kontext', '/models/arena/': 'Modell-Arena', '/assistant/': 'Assistent', '/assistant/workspace/': 'Chat-Arbeitsbereich', '/assistant/voice/': 'Sprachchat', '/assistant/quick/': 'Schneller Chat', '/assistant/private/': 'Privater Chat', '/assistant/sources/': 'Antworten mit Quellen' }[r.path]);
const H1_DE = { 'AI models': 'KI-Modelle', 'Open model leaderboard': 'Rangliste offener Modelle', 'Run a model on your computer': 'Ein Modell auf deinem Computer ausführen', 'Model prices and context': 'Modellpreise und Kontext', 'Model arena': 'Modell-Arena', Assistant: 'Assistent', 'Chat workspace': 'Chat-Arbeitsbereich', 'Talk with Verse': 'Mit Verse sprechen', 'Quick AI chat': 'Schneller KI-Chat', 'Private AI chat': 'Privater KI-Chat', 'Answers with sources': 'Antworten mit Quellen' };
const DOES_DE = {
  '/models/': 'Offene KI-Modelle und Datensätze durchsuchen: nach Aufgabe, Lizenz, Größe und Downloads filtern, eine Modellkarte lesen, bis zu drei Modelle nebeneinanderstellen, die ausprobieren, die Verse kostenlos ausführen kann, und sehen, was jede Lizenz erlaubt. Daten live aus einem öffentlichen Modell-Hub; kein Konto.',
  '/models/leaderboard/': 'Eine Rangliste offener Sprachmodelle nach Benchmark (IFEval, BBH, MATH Stufe 5, GPQA, MuSR, MMLU-PRO und Durchschnitt): jede Spalte sortieren, nach Größe und Typ filtern, suchen, Modelle im Diagramm vergleichen, lesen, was jeder Benchmark misst, und als CSV exportieren.',
  '/models/local/': 'Offene Modelle finden, die auf deinem eigenen Computer laufen (GGUF-Dateien): suchen, nach Fähigkeit filtern, jede Datei mit ihrer Größe sehen, den Befehl zum Starten und welche Versionen in deinen Speicher passen. Quantisierung einfach erklärt.',
  '/models/prices/': 'Jedes gehostete KI-Modell, das ein öffentlicher Router listet, mit Preis pro Million Tokens, Kontextlänge und was es annimmt und ausgibt: filtern, sortieren, die kostenlosen finden, nebeneinander vergleichen und ausrechnen, was ein Monat Nutzung kostet.',
  '/models/arena/': 'Eine Eingabe an zwei KI-Modelle zugleich, ohne zu wissen, welches welches ist, für die bessere Antwort stimmen, dann ihre Namen sehen. Deine Stimmen ergeben deine eigene Wertungstabelle (Elo) nach Kategorie, auf deinem Gerät. Auch nebeneinander mit Modellen deiner Wahl.',
  '/assistant/': 'Mit dem Assistenten von Verse auf einem freien offenen Modell chatten: Gespräche auf deinem Gerät und durchsuchbar, Vorlagen, dauerhafte Anweisungen, Code, der im Browser läuft, Export, einen Chat als Link teilen, Notizen, die offline funktionieren, und Textwerkzeuge (zählen, zusammenfassen, umschreiben, übersetzen). Kein Konto.',
  '/assistant/workspace/': 'Ein KI-Chat-Arbeitsbereich auf deinem Gerät: Ordner für Chats, angeheftete Chats, Suche in jeder Nachricht, eine Prompt-Bibliothek, die du mit einem Schrägstrich einfügst, gespeicherte Figuren mit eigenen Anweisungen, Chat-Statistik, Import und Export.',
  '/assistant/voice/': 'Eine freundliche KI zum Reden: sprich statt zu tippen, hör jede Antwort in der Stimme und dem Tempo, das du wählst, ein Freihandmodus, der nach jeder Antwort wieder zuhört, und Themen zum Einstieg. Dein Browser macht aus Sprache Text.',
  '/assistant/quick/': 'Frag irgendwas und bekomm sofort eine Antwort, ohne Anmeldung: wähle einen Chat-Stil (Lehrer, Programmierer, Dichter, Komiker, Philosoph und mehr), bitte um längere Antworten, kopiere oder teile eine Antwort, fang mit einem Druck neu an.',
  '/assistant/private/': 'Privater KI-Chat: kein Konto, Chats nur auf deinem Gerät (oder gar nicht), das Modell wählen und ein Knopf, der jeden Chat verbrennt. Verse protokolliert nicht, was du schreibst; jede Nachricht wird einmal zum Beantworten gesendet.',
  '/assistant/sources/': 'Stell eine Frage und bekomm eine Antwort mit nummerierten Quellen zum Öffnen, die Quellen als Karten, Folgefragen zum Vertiefen, und jeder Verlauf bleibt auf deinem Gerät.',
};
const navOf = (floor, cur) => `<nav id="anav" aria-label="${floor === 'models' ? T('AI model pages', 'Seiten zu KI-Modellen') : T('Assistant pages', 'Assistenten-Seiten')}">${NAVS[floor].map(([h, l]) => `<a href="${h}"${h === cur ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>`;
export const ogName = (p) => p.replace(/^\/|\/$/g, '').replace(/\//g, '-');
export function pageHtml(row, floor) {
  const p = row.path, title = row.h1 + ' · Verse', body = (floor === 'models' ? MODEL_BODY : ASSISTANT_BODY)[row.page]();
  T(row.h1, H1_DE[row.h1]); T(row.does, DOES_DE[p]); T(title, H1_DE[row.h1] + ' · Verse');
  const og = 'https://a-to-mind.com/og/' + ogName(p) + '.png';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(row.does)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Verse">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(row.does)}">
<meta property="og:url" content="https://a-to-mind.com${p}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(row.name)} on Verse">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(row.does)}">
<meta name="twitter:image" content="${og}">
<style>${CSS}
</style>
<!-- seo -->
<!-- /seo -->
</head>
<body data-page="${row.page}">
<main id="app">
  <h1>${esc(row.h1)}</h1>
  <p class="sub" id="lede">${esc(row.does)}</p>
  ${navOf(floor, p)}${body}
  ${row.links ? '<!-- asks -->\n  <!-- /asks -->\n  ' : ''}<nav id="related" aria-label="${T('Related tools', 'Verwandte Werkzeuge')}"></nav>
  <p class="note" style="text-align:center"><button type="button" id="shareBtn">${T('Share this page', 'Diese Seite teilen')}</button> <button type="button" id="theme" aria-pressed="false">${T('Light or dark', 'Hell oder dunkel')}</button></p>
  <footer><a href="/">Verse</a> · <a href="/tools/">${T('every tool', 'alle Werkzeuge')}</a></footer>
</main>
<script type="module">
  // the page is whole before this runs: its words and controls are in the HTML. Its code loads after the first paint and the load event, then wires them and fetches what is live
  const go = () => Promise.all([import('/lib/${floor === 'models' ? 'models' : 'assistant'}-page.js'), import('/lib/toolkit.js')]).then(([page, kit]) => { page.start('${row.page}'); kit.mountRelated(document.getElementById('related'), '${p}'); });
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
</script>
<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js LATER, kept with its modules)</script>
</body>
</html>
`;
}
export const ROWS = [...MODEL_SITES.map((r) => [r, 'models']), ...ASSISTANT_SITES.map((r) => [r, 'assistant'])];
/** every page's HTML (with what seo-pages.mjs wrote kept, and its preloads) and lib/ai-de.js. */
export function build() {
  const out = [];
  for (const [r, floor] of ROWS) {
    const file = path.join(site, r.path, 'index.html'); let html = pageHtml(r, floor), old = null;
    try { old = fs.readFileSync(file, 'utf8'); for (const [a, b] of [['<!-- seo -->', '<!-- /seo -->'], ['<!-- asks -->', '<!-- /asks -->']]) { const i = old.indexOf(a), j = old.indexOf(b); if (i >= 0 && j > i) html = html.replace(new RegExp(a + '[\\s\\S]*?' + b), () => old.slice(i, j + b.length)); } } catch (_) { /* a new page */ }
    let pre = []; try { pre = graphOf(html); } catch (_) { pre = []; }
    out.push({ file, old, html: withPreloads(html, pre) });
  }
  for (const [en, de] of RUNTIME) T(en, de);
  const de = `// The AI model and assistant pages' words in German (tools/ai-pages.mjs writes this file from its T(english, german) pairs; never edit it by hand). The pages
// choose by the browser's language or ?lang=de; the English text of a control, heading or note is the key, and a string with no entry stays English.
export const DE = Object.freeze(${JSON.stringify(Object.fromEntries(DE), null, 0).replace(/","/g, '",\n  "')});
`;
  const deFile = path.join(site, 'lib', 'ai-de.js'); let oldDe = null; try { oldDe = fs.readFileSync(deFile, 'utf8'); } catch (_) { /* new */ }
  out.push({ file: deFile, old: oldDe, html: de });
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'); let stale = 0;
  for (const f of build()) {
    if (check) { if (f.old !== f.html) { stale++; console.error('stale: ' + path.relative(site, f.file) + ' (node tools/ai-pages.mjs)'); } continue; }
    fs.mkdirSync(path.dirname(f.file), { recursive: true }); if (f.old !== f.html) { fs.writeFileSync(f.file, f.html); console.log('wrote', path.relative(site, f.file)); }
  }
  if (stale) process.exit(1);
}
