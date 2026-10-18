// suite check for phone-poster skill
import { phonePosterOf } from '../void-live-deploy/skills/phone-poster.js';

const assert = (c, m) => { if (!c) throw new Error(m || 'fail'); };

assert(phonePosterOf('phone cut posters'), 'matches phone cut');
assert(phonePosterOf('generate film posters'), 'matches generate');
assert(phonePosterOf('promotional posters for films'), 'matches promotional');
assert(!phonePosterOf('movie poster for inception'), 'near miss');
assert(!phonePosterOf('what is a poster'), 'near miss');

console.log('phone-poster suite check passed');
