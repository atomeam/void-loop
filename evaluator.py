"""Asset classification via rule-based heuristics plus a pluggable model."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from models import ModelAdapter, Prediction
from scanner import ScannedFile

CATEGORY_LICENSE = "license"
CATEGORY_SOURCE = "source"
CATEGORY_CONFIG = "config"
CATEGORY_DOCS = "documentation"
CATEGORY_DATA = "data"
CATEGORY_BINARY = "binary"
CATEGORY_UNKNOWN = "unknown"

_LICENSE_NAMES = frozenset({"license", "licence", "copying", "notice", "contributing"})
_LICENSE_EXTS = frozenset({"", "txt", "md", "rst", "markdown"})

_SOURCE_EXTS = frozenset(
    {
        ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".c", ".h",
        ".cpp", ".hpp", ".cs", ".rb", ".php", ".sh", ".ps1", ".kt", ".swift",
    }
)
_CONFIG_EXTS = frozenset({".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml"})
_DOCS_EXTS = frozenset({".md", ".rst", ".txt", ".adoc", ".html"})
_DATA_EXTS = frozenset({".csv", ".tsv", ".jsonl", ".parquet", ".sql", ".db", ".sqlite"})
_BINARY_EXTS = frozenset(
    {
        ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
        ".ttf", ".pdf", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib",
    }
)


@dataclass(frozen=True)
class Evaluation:
    file: ScannedFile
    category: str
    confidence: float
    reasons: tuple[str, ...]
    source: str  # "heuristic" | ML model id


class HeuristicClassifier:
    """Rule-based classifier used as the default and fallback path."""

    def classify(self, file: ScannedFile) -> Evaluation:
        name = file.path.name.lower()
        stem = file.path.stem.lower()
        ext = file.path.suffix.lower()

        if stem in _LICENSE_NAMES and ext.lstrip(".") in _LICENSE_EXTS:
            return Evaluation(file, CATEGORY_LICENSE, 0.98, ("license-named file",), "heuristic")
        if ext in _SOURCE_EXTS:
            return Evaluation(file, CATEGORY_SOURCE, 0.9, (f"source extension {ext or '(none)'}",), "heuristic")
        if ext in _CONFIG_EXTS:
            return Evaluation(file, CATEGORY_CONFIG, 0.85, (f"config extension {ext}",), "heuristic")
        if ext in _DOCS_EXTS:
            return Evaluation(file, CATEGORY_DOCS, 0.8, (f"docs extension {ext}",), "heuristic")
        if ext in _DATA_EXTS:
            return Evaluation(file, CATEGORY_DATA, 0.8, (f"data extension {ext}",), "heuristic")
        if ext in _BINARY_EXTS or _looks_binary(file):
            return Evaluation(file, CATEGORY_BINARY, 0.9, (f"binary ({ext or 'null-byte'})",), "heuristic")
        return Evaluation(file, CATEGORY_UNKNOWN, 0.3, ("no strong signal",), "heuristic")


def _looks_binary(file: ScannedFile, limit: int = 1024) -> bool:
    try:
        with file.path.open("rb") as fh:
            chunk = fh.read(limit)
    except OSError:
        return False
    return b"\x00" in chunk


class Evaluator:
    """Uses the ML adapter when it produces a prediction, else heuristics."""

    def __init__(self, model: ModelAdapter | None = None) -> None:
        self.model = model or ModelAdapter()

    def evaluate(self, file: ScannedFile) -> Evaluation:
        if self.model is not None:
            prediction = self.model.predict(self._features(file))
            if prediction is not None:
                return Evaluation(
                    file,
                    prediction.label,
                    prediction.confidence,
                    ("ml model prediction",),
                    prediction.model_id,
                )
        return HeuristicClassifier().classify(file)

    def evaluate_all(self, files: list[ScannedFile]) -> list[Evaluation]:
        return [self.evaluate(f) for f in files]

    @staticmethod
    def _features(file: ScannedFile) -> dict[str, object]:
        return {
            "name": file.path.name,
            "stem": file.path.stem,
            "suffix": file.path.suffix,
            "size": file.size,
        }
