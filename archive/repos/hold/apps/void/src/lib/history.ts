import { ParsedCommand } from './parse';
import { Surface } from './registry';

export interface TranscriptEntry {
  id: string;
  timestamp: number;
  type: 'input' | 'output' | 'error' | 'surface_spawned' | 'surface_closed' | 'system';
  content: string;
  command?: ParsedCommand;
  surfaceId?: string;
}

export function createTranscriptEntry(
  type: TranscriptEntry['type'],
  content: string,
  extras: Partial<TranscriptEntry> = {}
): TranscriptEntry {
  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    type,
    content,
    ...extras,
  };
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}