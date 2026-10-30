"""SQLite-backed event tracking, sequence logging, and dead-letter queue."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from utils import ensure_dir

_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    session_id TEXT NOT NULL,
    step TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS dlq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload TEXT NOT NULL,
    error TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_step ON events(step);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Telemetry:
    """Stores event sequences and DLQ entries in a SQLite database."""

    def __init__(self, db_path: Path) -> None:
        ensure_dir(db_path.parent)
        self.db_path = db_path
        self.session_id = uuid.uuid4().hex
        self._conn = sqlite3.connect(db_path)
        self._conn.executescript(_SCHEMA)

    def record(self, step: str, status: str = "ok", payload: dict | None = None) -> int:
        """Append an event to the sequence. Returns the new row id."""
        cur = self._conn.execute(
            "INSERT INTO events (timestamp, session_id, step, status, payload) VALUES (?, ?, ?, ?, ?)",
            (now := _now(), self.session_id, step, status, json.dumps(payload or {}, sort_keys=True)),
        )
        self._conn.commit()
        return cur.lastrowid

    def record_dlq(self, payload: dict, error: str) -> int:
        """Push a failed operation onto the dead-letter queue."""
        cur = self._conn.execute(
            "INSERT INTO dlq (payload, error, created_at) VALUES (?, ?, ?)",
            (json.dumps(payload, sort_keys=True), error, _now()),
        )
        self._conn.commit()
        return cur.lastrowid

    def events(self, session_id: str | None = None) -> list[sqlite3.Row]:
        if session_id is not None:
            return self.query("SELECT * FROM events WHERE session_id = ? ORDER BY id", (session_id,))
        return self.query("SELECT * FROM events ORDER BY id")

    def dlq(self) -> list[sqlite3.Row]:
        return self.query("SELECT * FROM dlq ORDER BY id")

    def query(self, sql: str, params: tuple[object, ...] = ()) -> list[sqlite3.Row]:
        return self._conn.execute(sql, params).fetchall()

    def close(self) -> None:
        self._conn.close()
