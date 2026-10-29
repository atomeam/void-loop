"""Optional ML model adapter.

The default implementation is a stub that always signals "no model", so the
evaluator falls back to rule-based heuristics. Swap in a real classifier
(e.g. scikit-learn / PyTorch) by implementing ``load`` and ``predict`` here.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Prediction:
    label: str
    confidence: float
    model_id: str


class ModelAdapter:
    """Thin wrapper around a trained classifier (stub by default)."""

    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path
        self._loaded = False

    def load(self) -> bool:
        """Load the model. Returns False when no real model is configured."""
        if self.model_path is None:
            return False
        # TODO: swap in a real model loader for the chosen framework here.
        raise NotImplementedError(
            "No model loader configured; provide model_path pointing at a supported artifact."
        )

    def predict(self, features: dict[str, object]) -> Prediction | None:
        """Return a Prediction for extracted features, or None to tell the
        caller to fall back to rule-based heuristics."""
        return None


def build_model_adapter(model_path: Path | None = None) -> ModelAdapter:
    """Factory used by the orchestrator; returns the pluggable stub."""
    return ModelAdapter(model_path)
