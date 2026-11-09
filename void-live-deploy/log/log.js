// /log/: the one page that holds Verse's own activity (lib/verse-log.js draws it). A file, not an inline script, so the page needs no CSP hash rule.
import { drawVerseLog } from '/lib/verse-log.js';
const el = document.getElementById('log');
drawVerseLog(el).catch(() => { el.textContent = 'The log could not be read just now. Try again in a moment.'; });
