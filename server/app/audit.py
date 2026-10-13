"""Append-only audit log of every gate run, including SAFE results.

This in-memory version is used by the agent and its tests. The backend task
replaces it with a PostgreSQL table that rejects UPDATE and DELETE; anything
with the same record() method can be passed to the agent.
"""

import copy
from datetime import UTC, datetime
from typing import Any, Protocol

from app.gate import CONTENT_VERSION


class AuditLog(Protocol):
    def record(self, thread_id: str, gate: dict[str, Any], answers: list[dict[str, Any]]) -> dict[str, Any]: ...


def build_row(thread_id: str, gate: dict[str, Any], answers: Any) -> dict[str, Any]:
    """One audit row: what the gate decided, which rules fired, and on which answers."""
    by_id = {a["questionId"]: a for a in answers if isinstance(a, dict) and isinstance(a.get("questionId"), str)} \
        if isinstance(answers, list) else {}
    matched_ids = [qid for rule in gate["firedRules"] for qid in rule["matchedAnswers"]]
    return {
        "thread_id": thread_id,
        "ts": datetime.now(UTC).isoformat(),
        "verdict": gate["verdict"],
        "fired_rules": copy.deepcopy(gate["firedRules"]),
        "matched_answers": [copy.deepcopy(by_id[qid]) for qid in dict.fromkeys(matched_ids) if qid in by_id],
        "rule_version": CONTENT_VERSION,
    }


class InMemoryAuditLog:
    """Rows can be added and read, never changed or removed."""

    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []

    def record(self, thread_id: str, gate: dict[str, Any], answers: list[dict[str, Any]]) -> dict[str, Any]:
        row = {"id": len(self._rows) + 1, **build_row(thread_id, gate, answers)}
        self._rows.append(row)
        return copy.deepcopy(row)

    @property
    def rows(self) -> tuple[dict[str, Any], ...]:
        return tuple(copy.deepcopy(self._rows))
