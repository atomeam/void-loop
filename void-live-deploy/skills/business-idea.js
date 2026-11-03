/**
 * business-idea skill — capture and clarify a business idea into a system outline.
 * "business idea: <rough idea>" produces a card with clarified problem, audience, key systems to build/connect, and handoff notes.
 * Reuses notebook for keeping the idea. Helps take over heavy lifting by reducing client work on clarification.
 * Contract: { name: 'business-idea', examples: [...], match(lower), run(text, api) }
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';

export const name = 'business-idea';
export const examples = ['business idea: a tool that tracks client automations', 'clarify idea: we need a system for handoff docs'];

export function match(lower) {
  return /business idea:|clarify idea:|idea canvas:/i.test(lower);
}

export function run(text, api) {
  const idea = text.replace(/^(business idea:|clarify idea:|idea canvas:)/i, '').trim();
  if (!idea) return { card: { title: 'Business Idea', body: 'Give a rough idea to clarify.' } };
  // Simple clarification (in real would call model or pure functions)
  const clarified = {
    problem: 'Clarify: ' + idea.slice(0, 100),
    systems: ['Capture notes', 'Connect automations', 'Hand off status'],
    handoff: 'Status card and docs for client'
  };
  const card = cardEl('Business Idea Canvas', `
    <p><strong>Idea:</strong> ${idea}</p>
    <p><strong>Problem:</strong> ${clarified.problem}</p>
    <p><strong>Systems to own:</strong> ${clarified.systems.join(', ')}</p>
    <p><strong>Handoff:</strong> ${clarified.handoff}</p>
  `);
  return { card, keep: true };
}
