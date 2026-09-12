export type GenomeInterval = {
  chrom: string;
  start: number;
  end: number;
  genome: "hg38" | "mm10";
};

export type AgDryRunScore = {
  mode: "DRY_RUN";
  interval: GenomeInterval;
  variant_effect: null;
  notes: ["TOS_NOT_ACCEPTED", "NO_LIVE_FETCH"];
};

export function dryRunScore(interval: GenomeInterval): AgDryRunScore {
  return {
    mode: "DRY_RUN",
    interval,
    variant_effect: null,
    notes: ["TOS_NOT_ACCEPTED", "NO_LIVE_FETCH"],
  };
}
