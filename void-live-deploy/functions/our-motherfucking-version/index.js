import { fillVersus } from '../../lib/versus.js';
export function onRequestGet(context) { return fillVersus(context, 'weigh'); }
