export interface ParsedCommand {
  verb: string;
  args: string[];
  raw: string;
  valid: boolean;
  error?: string;
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { verb: '', args: [], raw: input, valid: false, error: 'empty' };
  }

  const parts = trimmed.split(/\s+/);
  const verb = parts[0].toLowerCase();
  const args = parts.slice(1);

  const knownVerbs = [
    'case', 'clock', 'hold', 'allow', 'deny',
    'ag', 'score', 'session', 'help', 'clear', 'close'
  ];

  if (!knownVerbs.includes(verb)) {
    return { verb, args, raw: input, valid: false, error: 'unknown_verb' };
  }

  return { verb, args, raw: input, valid: true };
}

export function formatUsage(verb: string): string {
  const usage: Record<string, string> = {
    case: 'case open <product_id> aev|incident aware <ISO-8601>',
    clock: 'clock <case_id>',
    hold: 'hold <hold_id>',
    allow: 'allow <hold_id>',
    deny: 'deny <hold_id>',
    ag: 'ag run <interval>',
    score: 'score <run_id>',
    session: 'session set <token>',
    help: 'help',
    clear: 'clear',
    close: 'close <surface_id>',
  };
  return usage[verb] || 'unknown';
}