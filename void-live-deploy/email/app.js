// /email/: the language and the Share button at once, the mail tools after the load event (only this small file stands before it), then the related row
import { localize, sharePage } from '/lib/floor-share.js';
const lang = localize({ h1: 'E-Mail', intro: 'Schreiben Sie eine E-Mail mit Vorlagen und Spam-Prüfung und senden Sie sie mit einem Tipp aus Ihrem eigenen Mailprogramm; lesen Sie die .eml- und .mbox-Dateien, die Ihr Mailprogramm speichert, durchsuchen Sie sie und sehen Sie, was die Kopfzeilen einer Nachricht sagen und wo man sich abmeldet. Alles läuft auf diesem Gerät.',
  footer: 'Verse hat kein Postfach: Es sendet und empfängt keine E-Mails. Echte Mails zu senden braucht einen Mailserver, dem andere Server vertrauen, und ihn gut zu betreiben (Zustellbarkeit, Spam und Missbrauch) ist ein eigener Dienst; Verse öffnet Ihren Entwurf stattdessen in dem Mailprogramm, das Sie schon nutzen. Geöffnete Mail-Dateien werden in diesem Tab gelesen und beim Schließen vergessen; Ihre Entwürfe und Ihre Signatur bleiben in diesem Browser. Kein Konto, keine Werbung.' });
sharePage(document.getElementById('share-page'), lang);
const go = () => import('/lib/mail-ui.js').then(({ mountMail }) => mountMail(document.getElementById('app'), { lang }))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/email/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
