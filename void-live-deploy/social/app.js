// /social/: the language and the Share button at once, the feed after the load event (only this small file stands before it), then the related row
import { localize, sharePage } from '/lib/floor-share.js';
const lang = localize({ h1: 'Social', intro: 'Communities mit einem Feed nach angesagt, neu oder top, Beiträge und Kommentare als Baum, Stimmen, Folgen und ein RSS-Feed für jede Community. Kein Konto: Die Communities, denen Sie folgen, bleiben auf diesem Gerät.',
  footer: 'Beiträge und Kommentare sind öffentlich, auf den eigenen Boards von Verse: Es gelten dieselben Regeln, Meldungen, Grenzen und Sperren. Eine Stimme wird als eine Zeile pro Beitrag und Verbindung unter einem geheimen Hash der Adresse gespeichert, nie die Adresse selbst. Was Sie folgen, speichern oder ausblenden, bleibt in diesem Browser. Kein Konto, keine Werbung, kein Tracking.' });
sharePage(document.getElementById('share-page'), lang);
const go = () => import('/lib/social-ui.js').then(({ mountSocial }) => mountSocial(document.getElementById('app'), { lang }))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/social/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
