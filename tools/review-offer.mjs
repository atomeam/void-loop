// What A-to-Mind can do next for the people whose pull requests Verse reviews (owner, 2026-10-13: "the Verse code reviewer should
// offer upgrades and be extra helpful ... it could also be trying to sell people on the side our products and expertise").
// Shown only on other people's repositories, never on Verse's own, and only when it fits what the PR holds: at most two
// lines, each naming one product and its page, no price (the live store sets those) and no claim the review didn't show.
import { productById, buyUrl } from '../void-live-deploy/lib/products.js';

export const HOME = 'atomeam/void-loop';
const AUTOMATION = /^\.github\/workflows\/|(?:^|\/)(?:zap|zapier|make|n8n|power-?automate|ifttt|cron)[\w.-]*\.(?:json|ya?ml)$|(?:^|\/)crontab$/i;

/** the lines to add at the end of a review, or [] (Verse's own repo, or nothing that fits). Pure. */
export function offerLines({ repo = '', files = [], blocking = 0, deep = false, upgrades = 0 } = {}) {
  if (!repo || repo.toLowerCase() === HOME) return [];
  const out = [], auto = files.filter((f) => AUTOMATION.test(f));
  if (auto.length >= 3) {
    const a = productById('full-stack-audit');
    out.push(`This PR touches ${auto.length} automations. If more of them break than you have time to chase, A-to-Mind's [${a.name}](${buyUrl(a)}) goes through every one and says what's broken, fragile or wasteful.`);
  } else if (auto.length) {
    const f = productById('one-time-fix');
    out.push(`If the automation this PR changes keeps failing after it lands, A-to-Mind's [${f.name}](${buyUrl(f)}) fixes it and shows you a run that goes through.`);
  }
  if (!deep) {
    const p = productById('code-review');
    out.push(blocking
      ? `These are the instant checks. [${p.name}](${p.page}) adds ${p.adds}, reading the change for what patterns can't see.`
      : upgrades ? `[${p.name}](${p.page}) adds ${p.adds}.` : '');
  }
  return out.filter(Boolean).slice(0, 2);
}
