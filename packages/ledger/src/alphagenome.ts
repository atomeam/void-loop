import { z } from 'zod';

export const AgRunCreateSchema = z.object({
  case_id: z.string(),
  org_id: z.string(),
  interval_json: z.string(),
  variant_json: z.string().optional(),
});

export type AgRunCreate = z.infer<typeof AgRunCreateSchema>;

export interface AgOutput {
  run_id: string;
  mode: 'DRY_RUN' | 'LIVE';
  status: 'QUEUED' | 'RUNNING' | 'SCORED' | 'FAILED' | 'BLOCKED';
  interval: { start: number; end: number; step: number };
  variant: { chrom: string; pos: number; ref: string; alt: string; gene?: string } | null;
  evidence_id: string;
  notes: string;
}

export function dryRunScore(interval: { start: number; end: number; step: number }, variant: { chrom: string; pos: number; ref: string; alt: string; gene?: string } | null): { score: number; modality: string; evidence_id: string } {
  const score = Math.round((interval.start + interval.end) / 2 / interval.step) * interval.step;
  const modality = variant ? 'RNAseq' : 'placeholder';
  const evidence_id = `ev_${Math.random().toString(36).slice(2, 20)}`;
  return { score, modality, evidence_id };
}

export function validateAgRun(input: unknown): asserts input is AgRunCreate {
  AgRunCreateSchema.parse(input);
}