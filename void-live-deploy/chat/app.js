// /chat/: the language and the Share button at once, the chat screen after the load event (only this small file stands before it), then the related row
import { localize, sharePage } from '/lib/floor-share.js';
const lang = localize({ h1: 'Chat', intro: 'Private Chats per Einladungslink, Ende-zu-Ende-verschlüsselt in Ihrem Browser: Gruppen, Bilder, Lesebestätigungen und Sprach- und Videoanrufe direkt zwischen Browsern. Kein Konto, keine Telefonnummer.',
  footer: 'Nachrichten werden in Ihrem Browser mit einem Schlüssel versiegelt, der nur im Einladungslink nach dem # steht; das Relais von Verse hält die versiegelten Nachrichten 7 Tage (Bilder 3), damit die anderen sie abholen können, und kann sie nicht lesen. Anrufe gehen direkt zwischen Browsern über freie öffentliche STUN-Server und können in strengen Netzen scheitern (kein TURN-Relais: das kostet Geld). Ihre Chats bleiben auf diesem Gerät. Kein Konto, keine Werbung.' });
sharePage(document.getElementById('share-page'), lang);
const go = () => import('/lib/chat-ui.js').then(({ mountChat }) => mountChat(document.getElementById('app'), { lang }))
  .finally(() => import('/lib/toolkit.js').then(({ mountRelated }) => mountRelated(document.getElementById('related'), '/chat/')));
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
