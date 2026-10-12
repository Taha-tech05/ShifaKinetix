"""Gate for live app signals. Draft, awaiting clinician review.

Server-side equivalent of mobile/src/gate/sessionAdapter.ts and the movement
uncertainty step of sessionEvaluator.ts (see docs/safety-integration.md). The
app sends more than the 20 canonical questions: derived signals such as
Q_UNABLE_TO_MOVE_ARM, and movement results. This module keeps their danger
and uncertainty; it never turns "not sure" into "no" and a negative app answer
never grants clearance. The canonical evaluate() is unchanged and still strict.

APP_REVIEW_* stop policies are conservative engineering precautions, not
clinician-approved rules.
"""

import math
from typing import Any

from app.gate import QUESTIONS, evaluate, is_valid_answer

CANONICAL_IDS = {q["questionId"] for q in QUESTIONS}
ALIASES: dict[str, list[str]] = {
    "Q_UNABLE_TO_MOVE_ARM": ["unable"],
    "Q_ONSET_SUDDEN_TRAUMA": ["injury", "sudden"],
    "Q_BONE_TENDER_AFTER_TRAUMA": ["injury"],
    "Q_NUMB_OR_WEAK": ["numb"],
    "Q_ST_NUMB": ["numb"],
    "Q_ST_TINGLE": ["tingling"],
}
BASICS_HOW = "Q_BASICS_HOW"
BASICS_VALUES = ("after_injury", "suddenly", "slowly")
BASICS_DANGER = ("after_injury", "suddenly")
COMPLETED_MOVEMENT_STATES = ("answered", "done")
APP_REVIEW_SOURCE = "https://www.nhs.uk/symptoms/shoulder-pain/"
APP_REVIEW_REASON = "draft, awaiting clinician review: a new app safety signal requires clinical review before continuing."


def _js_string(value: Any) -> str:
    """String(value) as the TypeScript adapter sees it, for the few shapes that can reach it."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return ",".join("" if item is None else _js_string(item) for item in value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _js_truthy(value: Any) -> bool:
    if value is None or value is False or value == "":
        return False
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return not (value == 0 or (isinstance(value, float) and math.isnan(value)))
    return True


def _well_formed(answers: Any) -> bool:
    return isinstance(answers, list) and all(
        isinstance(a, dict) and isinstance(a.get("questionId"), str) for a in answers
    )


def safety_answers_from(answers: Any) -> list[dict[str, Any]] | None:
    """Canonical safety answers with app uncertainty merged in. None means the input cannot be trusted."""
    if not _well_formed(answers):
        return None
    canonical = [a for a in answers if a["questionId"] in CANONICAL_IDS]
    if not all(is_valid_answer(a) for a in canonical) or len({a["questionId"] for a in canonical}) != len(canonical):
        return None
    merged = {a["questionId"]: a for a in canonical}

    def signal(question_id: str, answer: dict[str, Any]) -> None:
        old = merged.get(question_id)
        # Uncertainty asks for the canonical clarification. It never overrides a reported "yes",
        # and no clinical answer is invented from an app signal.
        if answer.get("state") == "unknown" and not (old is not None and old.get("value") is True):
            unknown = {"questionId": question_id, "type": "yesno", "state": "unknown", "value": None}
            if old is not None and "clarificationAttempted" in old:
                unknown["clarificationAttempted"] = old["clarificationAttempted"]
            merged[question_id] = unknown

    for answer in answers:
        question_id, state, value = answer["questionId"], answer.get("state"), answer.get("value", ...)
        if question_id in ALIASES:
            unknown_ok = state == "unknown" and value is None
            answered_ok = state == "answered" and isinstance(value, bool)
            if answer.get("type") != "yesno" or not (unknown_ok or answered_ok):
                return None
            for target in ALIASES[question_id]:
                signal(target, answer)
        if question_id == BASICS_HOW:
            if state == "answered" and _js_string(None if value is ... else value) not in BASICS_VALUES:
                return None
            if state == "unknown":
                signal("injury", answer)
                signal("sudden", answer)
            if value == "after_injury":
                signal("injury", answer)
            if value == "suddenly":
                signal("sudden", answer)
        # An unmapped safety input must not silently disappear as the app evolves.
        unmapped = question_id not in CANONICAL_IDS and question_id not in ALIASES
        if unmapped and (question_id.startswith("Q_DANGER_") or _js_truthy(answer.get("flagged"))):
            return None
    return list(merged.values())


def _positive_signal(answer: dict[str, Any]) -> bool:
    if answer.get("state") != "answered":
        return False
    if answer["questionId"] in ALIASES:
        return answer.get("value") is True
    return answer["questionId"] == BASICS_HOW and _js_string(answer.get("value")) in BASICS_DANGER


def with_movement_uncertainty(answers: Any, movements: Any) -> Any:
    """A skipped or unfinished movement restores uncertainty about inability and weakness."""
    if not isinstance(answers, list) or not isinstance(movements, list):
        return None
    if any(not isinstance(m, dict) or m.get("state") not in COMPLETED_MOVEMENT_STATES for m in movements):
        return [
            *answers,
            {"questionId": "Q_UNABLE_TO_MOVE_ARM", "type": "yesno", "value": None, "state": "unknown"},
            {"questionId": "Q_NUMB_OR_WEAK", "type": "yesno", "value": None, "state": "unknown"},
        ]
    return list(answers)


def evaluate_session_gate(answers: Any, movements: Any = None) -> dict[str, Any]:
    """Gate output for the app's full answer list plus its movement results."""
    combined = with_movement_uncertainty(answers, [] if movements is None else movements)
    output = evaluate(safety_answers_from(combined))
    signals = [a for a in combined if _positive_signal(a)] if _well_formed(combined) else []
    if not signals:
        return output
    return {
        "verdict": "RED_FLAG",
        "firedRules": [
            *output["firedRules"],
            *(
                {
                    "ruleId": f"APP_REVIEW_{a['questionId']}",
                    "matchedAnswers": [a["questionId"]],
                    "source": APP_REVIEW_SOURCE,
                    "reason": APP_REVIEW_REASON,
                }
                for a in signals
            ),
        ],
    }
