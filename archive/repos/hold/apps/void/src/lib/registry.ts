export type SurfaceKind =
  | 'cmd'
  | 'clock'
  | 'hold'
  | 'science'
  | 'evidence'
  | 'code'
  | 'data'
  | 'run'
  | 'doc';

export interface Surface {
  id: string;
  kind: SurfaceKind;
  title: string;
  wired: boolean;
  payload: unknown;
}

export function resolveIntent(input: string): SurfaceKind {
  const s = input.trim().toLowerCase();
  if (/^(case|clock|art14|aware)\b/.test(s)) return 'clock';
  if (/^(hold|allow|deny)\b/.test(s)) return 'hold';
  if (/^(ag|genome|score)\b/.test(s)) return 'science';
  if (/^(pack|sha|evidence)\b/.test(s)) return 'evidence';
  if (/^(run|status)\b/.test(s)) return 'run';
  if (/^(edit|code)\b/.test(s)) return 'code';
  if (/^(table|select|query)\b/.test(s)) return 'data';
  if (/^(note|doc)\b/.test(s)) return 'doc';
  return 'cmd';
}

export function generateSurfaceId(kind: SurfaceKind): string {
  return `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}