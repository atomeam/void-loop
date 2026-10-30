"""Orchestrator: scan -> evaluate -> migrate -> telemetry."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from evaluator import Evaluation, Evaluator
from migrator import Migrator, MigrationResult
from models import build_model_adapter
from scanner import scan
from telemetry import Telemetry
from utils import ensure_dir, setup_logging

DEFAULT_STATE_DIR = Path(".autosalvage")


@dataclass
class Config:
    path: Path
    dry_run: bool = True
    backup: bool = False
    state_dir: Path = DEFAULT_STATE_DIR
    model_path: Path | None = None
    verbose: bool = False

    @classmethod
    def from_args(cls, args: object) -> "Config":
        """Build a Config from an argparse Namespace, merged over a JSON file."""
        values: dict[str, object] = {}
        config = getattr(args, "config", None)
        if config is not None:
            values = json.loads(config.read_text(encoding="utf-8"))
        return cls(
            path=Path(values.get("path") or getattr(args, "path", None) or Path.cwd()),
            dry_run=bool(values.get("dry_run", getattr(args, "dry_run", True))),
            backup=bool(values.get("backup", getattr(args, "backup", False))),
            state_dir=Path(values.get("state_dir", DEFAULT_STATE_DIR)),
            model_path=(
                Path(str(values["model_path"]))
                if values.get("model_path")
                else getattr(args, "model_path", None)
            ),
            verbose=bool(getattr(args, "verbose", False)),
        )


@dataclass
class RunReport:
    scanned: int
    evaluations: list[Evaluation]
    migrations: list[MigrationResult]
    telemetry_db: Path


def run(cfg: Config) -> RunReport:
    """Execute a full scan -> evaluate -> migrate pipeline with telemetry."""
    logger = setup_logging(cfg.verbose)
    state_dir = ensure_dir(cfg.path / cfg.state_dir)
    telemetry = Telemetry(state_dir / "telemetry.db")

    try:
        telemetry.record(
            "session.start",
            payload={"path": str(cfg.path), "dry_run": cfg.dry_run, "backup": cfg.backup},
        )
        files = scan(cfg.path)
        telemetry.record("scan.complete", payload={"files": len(files)})
        logger.info("scanned %d files under %s", len(files), cfg.path)

        evaluator = Evaluator(build_model_adapter(cfg.model_path))
        evaluations = evaluator.evaluate_all(files)
        telemetry.record("evaluate.complete", payload={"evaluated": len(evaluations)})

        backup_dir = None
        if cfg.backup:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
            backup_dir = ensure_dir(state_dir / "backups" / stamp)

        migrator = Migrator()
        results = migrator.run(evaluations, dry_run=cfg.dry_run, backup_dir=backup_dir)
        telemetry.record(
            "migrate.complete",
            payload={
                "planned": sum(1 for r in results if r.status in ("applied", "dry-run")),
                "skipped": sum(1 for r in results if r.status == "skipped"),
                "failed": sum(1 for r in results if r.status == "failed"),
            },
        )
        telemetry.record("session.end", payload={"migrations": len(results)})
        return RunReport(len(files), evaluations, results, telemetry.db_path)
    except Exception as exc:
        telemetry.record("session.failed", status="error", payload={"error": str(exc)})
        telemetry.record_dlq({"step": "session"}, str(exc))
        raise
    finally:
        telemetry.close()
