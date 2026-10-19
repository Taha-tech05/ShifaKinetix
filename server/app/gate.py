"""Severity Gate, Python side. Draft, awaiting clinician review.

Implements docs/gate-contract.md (v2: weighted triage with linked questions).
Must return exactly the same output as the TypeScript evaluator in
mobile/src/gate/evaluate.ts on every shared case.
Deterministic code only: no LLM, no network.
"""

import json
import math
from pathlib import Path
from typing import Any

SHARED_DIR = Path(__file__).resolve().parents[2] / "shared"
POLICY = "docs/gate-contract.md"
MAX_SAFE_INTEGER = 2**53 - 1
LEVEL_RANK = {"ROUTINE": 0, "SOON": 1, "URGENT": 2, "EMERGENCY": 3}


def _load(filename: str) -> dict[str, Any]:
    with open(SHARED_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


_RULE_FILE = _load("gate_rules.json")
RULES: list[dict[str, Any]] = _RULE_FILE["rules"]
THRESHOLDS: dict[str, float] = _RULE_FILE["levels"]
# Hard-stop answers still "Not sure" after their simpler question: how many may stay open, and the lowest level they allow.
UNRESOLVED: dict[str, Any] = _RULE_FILE["unresolved"]
# Questions behind an EMERGENCY rule (chest, breathing): never left unresolved.
EMERGENCY_IDS = {c["questionId"] for r in RULES if r.get("level") == "EMERGENCY" for c in r["all"]}
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


def value_matches(clause: dict[str, Any], value: Any) -> bool:
    """Does an answered value meet a clause (equals, in, or atLeast with an optional below)?"""
    if "equals" in clause:
        return _same(value, clause["equals"])
    if "in" in clause:
        return any(_same(value, option) for option in clause["in"])
    if "atLeast" in clause:
        return _is_number(value) and value >= clause["atLeast"] and ("below" not in clause or value < clause["below"])
    return False


def _clause_matches(clause: dict[str, Any], by_id: dict[str, dict[str, Any]], for_asking: bool) -> bool:
    a = by_id.get(clause["questionId"])
    if a is None:
        return False
    if a["state"] == "unknown":
        return for_asking and clause.get("orUnknown") is True
    return a["state"] == "answered" and value_matches(clause, a["value"])


def is_asked_question(q: dict[str, Any], answers: list[dict[str, Any]]) -> bool:
    """Always-required questions, plus linked ones whose askWhen matches (any clause)."""
    if q["tier"] == "context":
        return False
    if q["required"]:
        return True
    by_id = {a["questionId"]: a for a in answers}
    return any(_clause_matches(clause, by_id, True) for clause in q.get("askWhen") or [])


# Contract v1 name: a question is required exactly when it is asked.
is_required_question = is_asked_question


def half_points(question_id: str) -> float:
    """Points an uncertain weighted answer adds: half of the largest single-sign points for that question."""
    top = max(
        [0]
        + [
            r["points"]
            for r in RULES
            if "points" in r and len(r["all"]) == 1 and r["all"][0]["questionId"] == question_id
        ]
    )
    return top / 2


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


def _invalid() -> dict[str, Any]:
    return {
        "verdict": "RED_FLAG",
        "level": "URGENT",
        "score": 0,
        "firedRules": [
            {
                "ruleId": "INPUT_INVALID",
                "matchedAnswers": [],
                "source": POLICY,
                "reason": "Invalid or conflicting answers; clinical review required.",
            }
        ],
    }


def evaluate(answers: Any) -> dict[str, Any]:
    """Run the gate on the complete saved answers of one intake.

    Hard stops set EMERGENCY or URGENT whatever the points. Weighted signals add
    points; an uncertain weighted answer counts half. Missing linked answers, or
    "Not sure" on a hard-stop question, give CLARIFY unless danger already
    stands. Otherwise the score gives SOON or ROUTINE (both SAFE).
    """
    if (
        not isinstance(answers, list)
        or not all(is_valid_answer(a) for a in answers)
        or len({a["questionId"] for a in answers}) != len(answers)
    ):
        return _invalid()

    by_id = {a["questionId"]: a for a in answers}
    fired: list[dict[str, Any]] = []
    hard_stop: str | None = None
    score: float = 0

    for rule in RULES:
        if not all(_clause_matches(clause, by_id, False) for clause in rule["all"]):
            continue
        item: dict[str, Any] = {
            "ruleId": rule["ruleId"],
            "matchedAnswers": [c["questionId"] for c in rule["all"]],
            "source": rule["source"],
            "reason": rule["description"],
        }
        if "level" in rule:
            item["level"] = rule["level"]
            if hard_stop is None or LEVEL_RANK[rule["level"]] > LEVEL_RANK[hard_stop]:
                hard_stop = rule["level"]
        else:
            item["points"] = rule.get("points", 0)
            score += item["points"]
        fired.append(item)

    for q in QUESTIONS:
        a = by_id.get(q["questionId"])
        if q["tier"] != "weighted" or a is None or a["state"] != "unknown":
            continue
        points = half_points(q["questionId"])
        if points <= 0:
            continue
        score += points
        fired.append(
            {
                "ruleId": f"W_{q['questionId']}",
                "matchedAnswers": [q["questionId"]],
                "source": POLICY,
                "reason": "Answer is uncertain; counted at half weight.",
                "points": points,
            }
        )

    # Unresolved: a hard-stop answer still "Not sure" after its simpler question. A few may stay open (the result is then
    # at least SOON); more, or chest/breathing, needs a doctor (CLARIFY). No points, so nothing can lower a result.
    asked = [q for q in QUESTIONS if is_asked_question(q, answers)]
    unresolved = [
        q for q in asked
        if q["tier"] == "hardStop" and q["questionId"] in by_id and by_id[q["questionId"]]["state"] == "unknown"
        and by_id[q["questionId"]].get("clarificationAttempted") is True
    ]
    tolerated = len(unresolved) <= UNRESOLVED["allowed"] and not any(q["questionId"] in EMERGENCY_IDS for q in unresolved)
    if tolerated:
        for q in unresolved:
            fired.append(
                {
                    "ruleId": f"N_{q['questionId']}",
                    "matchedAnswers": [q["questionId"]],
                    "source": POLICY,
                    "reason": f"Could not check {q.get('shortName', q['questionId'])} in the app",
                    "points": 0,
                }
            )

    incomplete = False
    for q in asked:
        qid = q["questionId"]
        if tolerated and q in unresolved:
            continue
        a = by_id.get(qid)
        if a is None:
            incomplete = True
            fired.append(
                {
                    "ruleId": f"M_{qid}",
                    "matchedAnswers": [qid],
                    "source": POLICY,
                    "reason": "Required safety answer is missing.",
                }
            )
        elif a["state"] == "unknown" and q["tier"] == "hardStop":
            incomplete = True
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

    if hard_stop is not None or score >= THRESHOLDS["URGENT"]:
        level = hard_stop if hard_stop is not None else "URGENT"
        return {"verdict": "RED_FLAG", "level": level, "score": score, "firedRules": fired}
    if incomplete:
        return {"verdict": "CLARIFY", "level": None, "score": score, "firedRules": fired}
    soon = score >= THRESHOLDS["SOON"] or (tolerated and len(unresolved) > 0)
    level = UNRESOLVED["level"] if soon else "ROUTINE"
    return {"verdict": "SAFE", "level": level, "score": score, "firedRules": fired}


def implied_answer(answers: list[dict[str, Any]], question_id: str) -> dict[str, Any] | None:
    """The question's answer, or what it counts as when it was not asked.

    If every answer that would open it was given and none opened it (a gateway
    No, or a gradual onset for "changed shape"), it counts as its deniedValue.
    None when not known.
    """
    own = next((a for a in answers if a["questionId"] == question_id), None)
    if own is not None:
        return own
    q = _QUESTIONS_BY_ID.get(question_id)
    if q is None or "deniedValue" not in q or not q.get("askWhen"):
        return None
    for clause in q["askWhen"]:
        trigger = implied_answer(answers, clause["questionId"])
        if trigger is None or trigger["state"] != "answered" or value_matches(clause, trigger["value"]):
            return None
    return {"questionId": question_id, "type": q["type"], "value": q["deniedValue"], "state": "answered"}


def implied_answers(answers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The answers plus what each unasked detail question counts as. For doctor-side ranking only.

    A denied topic is a real No, not an unknown. The gate itself never needs
    this, because an unasked question fires nothing.
    """
    given = {a["questionId"] for a in answers}
    extra = [implied_answer(answers, q["questionId"]) for q in QUESTIONS if q["questionId"] not in given]
    return [*answers, *(a for a in extra if a is not None)]
