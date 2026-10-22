"""Common helpers for autosalvage (logging, file I/O abstractions)."""
from __future__ import annotations

import hashlib
import logging
import sys
from pathlib import Path

LOGGER_NAME = "autosalvage"


def setup_logging(verbose: bool = False) -> logging.Logger:
    """Configure and return the package logger (idempotent)."""
    logger = logging.getLogger(LOGGER_NAME)
    if logger.handlers:
        logger.setLevel(logging.DEBUG if verbose else logging.INFO)
        return logger
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.propagate = False
    return logger


def sha256(path: Path, chunk_size: int = 65536) -> str:
    """Compute the SHA-256 of a file in chunks."""
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_dir(path: Path) -> Path:
    """Create a directory (and parents) if needed; return it."""
    path.mkdir(parents=True, exist_ok=True)
    return path
