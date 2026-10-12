"""Severity Gate, Python side. Draft, awaiting clinician review.

Implements docs/gate-contract.md. Must return exactly the same output as the
TypeScript evaluator in mobile/src/gate/evaluate.ts on every shared case.
Deterministic code only: no LLM, no network.
"""

import json
import math
from pathlib import Path
from typing import Any

SHARED_DIR = Path(__file__).resolve().parents[2] / "shared"
POLICY = "docs/gate-contract.md"
MAX_SAFE_INTEGER = 2**53 - 1


def _load(filename: str) -> dict[str, Any]:
    with open(SHARED_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


RULES: list[dict[str, Any]] = _load("gate_rules.json")["rules"]
_QUESTION_BANK = _load("questions_shoulder.json")
QUESTIONS: list[dict[str, Any]] = _QUESTION_BANK["questions"]
CONTENT_VERSION: str = _QUESTION_BANK["contentVersion"]
_QUESTIONS_BY_ID = {q["questionId"]: q for q in QUESTIONS}


def _is_number(x: Any) -> bool:
    # bool is a subclass of int in Python; a JSON true/false is never a number.
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _same(a: Any, b: Any) -> bool:
    """Strict equality like TypeScript ===, so True never equals 1 or "true"."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if _is_number(a) and _is_number(b):
        return a == b
    return type(a) is type(b) and a == b


def is_required_question(q: dict[str, Any], answers: list[dict[str, Any]]) -> bool:
    """Always-required questions, plus those whose requiredWhen clauses all match an answered record (contract v1.2)."""
    if q["required"]:
        return True
    clauses = q.get("requiredWhen") or []
    return bool(clauses) and all(
        any(
            a["questionId"] == clause["questionId"] and a["state"] == "answered" and _same(a["value"], clause["equals"])
            for a in answers
        )
        for clause in clauses
    )


def is_valid_answer(a: Any) -> bool:
    if not isinstance(a, dict):
        return False
    qid = a.get("questionId")
    q = _QUESTIONS_BY_ID.get(qid) if isinstance(qid, str) else None
    if q is None or a.get("type") != q["type"]:
        return False
    if "clarificationAttempted" in a and not isinstance(a["clarificationAttempted"], bool):
        return False
    state = a.get("state")
    if state == "unknown":
        return "value" in a and a["value"] is None
    if state != "answered":
        return False
    value = a.get("value")
    if q["type"] == "yesno":
        return isinstance(value, bool)
    if q["type"] == "choice":
        return any(_same(option["value"], value) for option in q.get("options") or [])
    if q["type"] in ("number", "duration"):
        if not _is_number(value) or (isinstance(value, float) and not math.isfinite(value)):
            return False
        low = q["min"] if q.get("min") is not None else 0
        high = q["max"] if q.get("max") is not None else MAX_SAFE_INTEGER
        return low <= value <= high
    return False


def evaluate(answers: Any) -> dict[str, Any]:
    """Run the gate on the complete saved answers of one intake.

    Priority is RED_FLAG, then CLARIFY, then SAFE. "Not sure" on a required
    safety question is never SAFE; if it persists after the clarification it
    stays CLARIFY (contract v1.1): uncertainty alone is not a clinical red flag.
    """
    if (
        not isinstance(answers, list)
        or not all(is_valid_answer(a) for a in answers)
        or len({a["questionId"] for a in answers}) != len(answers)
    ):
        return {
            "verdict": "RED_FLAG",
            "firedRules": [
                {
                    "ruleId": "INPUT_INVALID",
                    "matchedAnswers": [],
                    "source": POLICY,
                    "reason": "Invalid or conflicting answers; clinical review required.",
                }
            ],
        }

    by_id = {a["questionId"]: a for a in answers}
    fired: list[dict[str, Any]] = []
    danger = False

    for rule in RULES:
        if all(_clause_matches(clause, by_id) for clause in rule["all"]):
            danger = True
            fired.append(
                {
                    "ruleId": rule["ruleId"],
                    "matchedAnswers": [c["questionId"] for c in rule["all"]],
                    "source": rule["source"],
                    "reason": rule["description"],
                }
            )

    for q in QUESTIONS:
        if not is_required_question(q, answers):
            continue
        qid = q["questionId"]
        a = by_id.get(qid)
        if a is None:
            fired.append(
                {
                    "ruleId": f"M_{qid}",
                    "matchedAnswers": [qid],
                    "source": POLICY,
                    "reason": "Required safety answer is missing.",
                }
            )
        elif a["state"] == "unknown":
            clarified = a.get("clarificationAttempted") is True
            fired.append(
                {
                    "ruleId": f"U_{qid}",
                    "matchedAnswers": [qid],
                    "source": POLICY,
                    "reason": "Uncertainty persists after clarification; clinical review required."
                    if clarified
                    else "Safety answer is uncertain; ask the fixed clarification.",
                }
            )

    verdict = "RED_FLAG" if danger else "CLARIFY" if fired else "SAFE"
    return {"verdict": verdict, "firedRules": fired}


def _clause_matches(clause: dict[str, Any], by_id: dict[str, dict[str, Any]]) -> bool:
    a = by_id.get(clause["questionId"])
    return a is not None and a["state"] == "answered" and _same(a["value"], clause["equals"])
