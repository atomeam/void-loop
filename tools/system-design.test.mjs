import { isSystemDesign } from '../void-live-deploy/skills/system-design.js';

const examples = [
  'system design for client onboarding',
  'design the system for invoice reminders',
  'design systems for the support flow',
  'design a system for weekly status reports'
];
const near = [
  'what is a system',
  'system status',
  'design the page',
  'build the system'
];

const ok = examples.every(isSystemDesign) && !near.some(isSystemDesign);
if (!ok) {
  console.error('system-design match failed');
  process.exit(1);
}
console.log('system-design suite ok');
