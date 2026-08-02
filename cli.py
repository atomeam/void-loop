"""Command-line interface for autosalvage."""
from __future__ import annotations

import argparse
from pathlib import Path

from autosalvage import Config, RunReport, run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="autosalvage",
        description="Scan, classify, and migrate legacy repositories.",
    )
    parser.add_argument("--path", type=Path, help="repository root to scan (default: cwd)")
    parser.add_argument(
        "--dry-run",
        dest="dry_run",
        action="store_true",
        help="compute plans and diffs without applying (default)",
    )
    parser.add_argument("--apply", dest="dry_run", action="store_false", help="apply migrations")
    parser.set_defaults(dry_run=True)
    parser.add_argument(
        "--backup",
        action="store_true",
        help="write backups under .autosalvage/backups before applying",
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="JSON config file (path, dry_run, backup, state_dir, model_path)",
    )
    parser.add_argument("--model", dest="model_path", type=Path, help="optional trained ML model path (stub by default)")
    parser.add_argument("--verbose", action="store_true", help="enable debug-level logging")
    parser.add_argument(
        "--branch",
        "--create-branch",
        dest="branch",
        help="reserved: git branch to create for the work",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    cfg = Config.from_args(args)
    report = run(cfg)
    _print_report(report)
    return 0


def _print_report(report: RunReport) -> None:
    print(f"\nScanned: {report.scanned} files")
    for evaluation in report.evaluations:
        print(
            f"  [{evaluation.category:>14}] {evaluation.file.rel_path}  "
            f"({evaluation.confidence:.0%} via {evaluation.source})"
        )
    planned = [r for r in report.migrations if r.status in ("applied", "dry-run")]
    print(f"\nMigrations planned: {len(planned)}")
    for result in planned:
        print(f"  - {result.migration}: {result.file.rel_path} [{result.status}] {result.details}")
        if result.diff:
            print(result.diff)
    print(f"\nTelemetry DB: {report.telemetry_db}")


if __name__ == "__main__":
    raise SystemExit(main())
