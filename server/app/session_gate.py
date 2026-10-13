"""Gate for live app signals. Draft, awaiting clinician review.

Server-side equivalent of the mobile pipeline (docs/safety-integration.md,
focused follow-ups, contract v1.1 and v1.2):

    raw app answers + raw movement results
      -> structured_gate_inputs()      mobile/src/flow/gateInputs.ts
      -> with_movement_uncertainty()   mobile/src/gate/sessionEvaluator.ts
      -> safety_answers_from()         mobile/src/gate/sessionAdapter.ts
      -> evaluate()                    the canonical gate, unchanged and strict

The server derives the safety signals from the raw movement results itself; it
does not rely on the app having sent derived answers.

A broad positive or unknown app signal does not stop the patient by itself. It
asks the precise canonical question again: until that question is answered for
the current evidence, the canonical answer is presented as unknown, so an old
"no" cannot clear new evidence. A confirmed canonical "yes" always stays "yes".
Nothing unknown ever becomes "no".

Which follow-ups have been answered is decided by the caller from server-held
history (see store.reviewed_followups). Client review tokens are never read.
These mappings are conservative draft policy, not clinician-approved rules.
"""

import json
import math
from collections.abc import Collection
from typing import Any

from app.gate import QUESTIONS, evaluate, is_valid_answer

CANONICAL_IDS = {q["questionId"] for q in QUESTIONS}
ALIASES: dict[str, list[str]] = {
    "Q_UNABLE_TO_MOVE_ARM": ["unable"],
    "Q_ONSET_SUDDEN_TRAUMA": ["injury", "sudden"],
    "Q_BONE_TENDER_AFTER_TRAUMA": ["injury"],
    "Q_NUMB_OR_WEAK": ["unable", "numb", "tingling"],
    "Q_ST_NUMB": ["numb"],
    "Q_ST_TINGLE": ["tingling"],
}
BASICS_HOW = "Q_BASICS_HOW"
BASICS_VALUES = ("after_injury", "suddenly", "slowly")
SUDDEN_OR_INJURY = ("after_injury", "suddenly")
BONE_POINT = "Q_ST_BONE_POINT"
TINGLE = "Q_ST_TINGLE"
NUMB = "Q_ST_NUMB"
ONSET = "Q_ONSET_SUDDEN_TRAUMA"
UNABLE = "Q_UNABLE_TO_MOVE_ARM"
BONE_AFTER_TRAUMA = "Q_BONE_TENDER_AFTER_TRAUMA"
NUMB_OR_WEAK = "Q_NUMB_OR_WEAK"
MOVEMENT_FOLLOWUPS = ("unable", "numb", "tingling")  # follow-ups whose evidence includes the movement results
COMPLETED_MOVEMENT_STATES = ("answered", "done")


def _js_string(value: Any) -> str:
    """String(value) as the TypeScript code sees it, for the few shapes that can reach it."""
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


def _valid_movement(m: Any) -> bool:
    if not isinstance(m, dict) or not isinstance(m.get("movementId"), str) or not m["movementId"].strip():
        return False
    if not all(isinstance(m.get(key), bool) for key in ("painful", "weak", "unableToDo")):
        return False
    angle = m.get("measuredAngle")
    return angle is None or (
        isinstance(angle, (int, float)) and not isinstance(angle, bool)
        and (not isinstance(angle, float) or math.isfinite(angle))
    )


def _well_formed(answers: Any, movements: Any) -> bool:
    return (
        isinstance(answers, list)
        and all(isinstance(a, dict) and isinstance(a.get("questionId"), str) for a in answers)
        and isinstance(movements, list)
        and all(_valid_movement(m) for m in movements)
    )


def _find(answers: list[dict[str, Any]], question_id: str) -> dict[str, Any] | None:
    return next((a for a in answers if a["questionId"] == question_id), None)


def _yesno(question_id: str, value: bool | None) -> dict[str, Any]:
    return {"questionId": question_id, "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}


def structured_gate_inputs(answers: list[dict[str, Any]], movements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Safety signals derived from the basics answer, the structure-type answers and the raw movement results.

    "Not sure" and "Skip" stay unknown. Something that was never asked is absent, never "no".
    """
    out: list[dict[str, Any]] = []

    how = _find(answers, BASICS_HOW)
    if how is not None:
        out.append(_yesno(ONSET, None if how.get("state") == "unknown" else _js_string(how.get("value")) in SUDDEN_OR_INJURY))

    answered_moves = [m for m in movements if m.get("state") != "unknown"]
    if any(_js_truthy(m.get("unableToDo")) for m in answered_moves):
        out.append(_yesno(UNABLE, True))
    elif answered_moves:
        out.append(_yesno(UNABLE, False))
    elif movements:
        out.append(_yesno(UNABLE, None))

    # A sore spot on a bone after an injury: yes only when both are yes; no when either is a real no; otherwise unknown.
    bone = _find(answers, BONE_POINT)
    trauma = _find(out, ONSET)
    if bone is not None:
        def said(answer, value):
            return answer is not None and answer.get("state") == "answered" and answer.get("value") is value

        if said(bone, True) and said(trauma, True):
            out.append(_yesno(BONE_AFTER_TRAUMA, True))
        elif said(bone, False) or said(trauma, False):
            out.append(_yesno(BONE_AFTER_TRAUMA, False))
        else:
            out.append(_yesno(BONE_AFTER_TRAUMA, None))

    # Numbness, tingling or weakness: yes from any one; no only when both sensory answers are real noes and no
    # movement was weak; unknown when they were skipped; absent when none was asked.
    sensory = [a for a in (_find(answers, TINGLE), _find(answers, NUMB)) if a is not None]
    weak_move = any(_js_truthy(m.get("weak")) for m in answered_moves)
    if any(a.get("state") == "answered" and a.get("value") is True for a in sensory) or weak_move:
        out.append(_yesno(NUMB_OR_WEAK, True))
    elif sensory and all(a.get("state") == "answered" and a.get("value") is False for a in sensory):
        out.append(_yesno(NUMB_OR_WEAK, False))
    elif sensory:
        out.append(_yesno(NUMB_OR_WEAK, None))
    return out


def with_movement_uncertainty(answers: list[dict[str, Any]], movements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """A skipped or unfinished movement restores uncertainty about inability and weakness."""
    if any(m.get("state") not in COMPLETED_MOVEMENT_STATES for m in movements):
        return [*answers, _yesno(UNABLE, None), _yesno(NUMB_OR_WEAK, None)]
    return list(answers)


def relevant_signals(combined: list[dict[str, Any]], canonical_id: str) -> list[dict[str, Any]]:
    """The positive or unknown app signals that ask for this canonical question."""
    has_basics = any(a["questionId"] == BASICS_HOW for a in combined)
    signals = []
    for a in combined:
        question_id, state, value = a["questionId"], a.get("state"), a.get("value")
        if question_id == BASICS_HOW:
            relevant = (
                (state == "unknown" and canonical_id in ("injury", "sudden"))
                or (value == "after_injury" and canonical_id == "injury")
                or (value == "suddenly" and canonical_id == "sudden")
            )
        elif canonical_id not in ALIASES.get(question_id, ()) or not (state == "unknown" or value is True):
            relevant = False
        else:
            # The combined onset signal adds nothing when its original basics answer is present.
            relevant = question_id != ONSET or not has_basics
        if relevant:
            signals.append(a)
    return signals


def assemble(answers: list[dict[str, Any]], movements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Everything the adapter sees: given answers, signals derived by the server, and movement uncertainty."""
    return with_movement_uncertainty([*answers, *structured_gate_inputs(answers, movements)], movements)


def followup_evidence(answers: Any, movements: Any) -> dict[str, str]:
    """For each canonical question that app signals ask about: a fingerprint of that evidence.

    Used by the server to decide whether a follow-up was answered after the
    evidence it reviews. Movement and sensory follow-ups also depend on the
    movement results, so any change to those results is new evidence.
    """
    if not _well_formed(answers, movements):
        return {}
    combined = assemble(answers, movements)
    evidence = {}
    for q in QUESTIONS:
        signals = relevant_signals(combined, q["questionId"])
        if signals:
            fields = sorted(json.dumps([a["questionId"], a.get("type"), a.get("state"), a.get("value")]) for a in signals)
            movement = movements if q["questionId"] in MOVEMENT_FOLLOWUPS else None
            evidence[q["questionId"]] = json.dumps({"signals": fields, "movement": movement}, sort_keys=True)
    return evidence


def pending_followups(combined: list[dict[str, Any]], reviewed: Collection[str] = ()) -> list[str]:
    """Canonical questions that app signals ask about and that have not been answered for the current evidence."""
    return [
        q["questionId"]
        for q in QUESTIONS
        if q["questionId"] not in reviewed and relevant_signals(combined, q["questionId"])
    ]


def safety_answers_from(combined: Any, reviewed: Collection[str] = ()) -> list[dict[str, Any]] | None:
    """Canonical safety answers with pending follow-ups presented as unknown. None means the input cannot be trusted."""
    if not _well_formed(combined, []):
        return None
    canonical = [a for a in combined if a["questionId"] in CANONICAL_IDS]
    if not all(is_valid_answer(a) for a in canonical) or len({a["questionId"] for a in canonical}) != len(canonical):
        return None
    for a in combined:
        question_id, state, value = a["questionId"], a.get("state"), a.get("value", ...)
        unknown_ok = state == "unknown" and value is None
        if question_id in ALIASES and (
            a.get("type") != "yesno" or not (unknown_ok or (state == "answered" and isinstance(value, bool)))
        ):
            return None
        if question_id == BASICS_HOW and not (
            unknown_ok or (state == "answered" and value is not ... and _js_string(value) in BASICS_VALUES)
        ):
            return None
        # An unmapped safety input must not silently disappear as the app evolves.
        unmapped = question_id not in CANONICAL_IDS and question_id not in ALIASES
        if unmapped and (question_id.startswith("Q_DANGER_") or _js_truthy(a.get("flagged"))):
            return None
    merged = {a["questionId"]: a for a in canonical}
    for question_id in pending_followups(combined, reviewed):
        # A confirmed danger always wins. Otherwise ask again about the new evidence.
        if not (question_id in merged and merged[question_id].get("value") is True):
            merged[question_id] = {
                "questionId": question_id, "type": "yesno", "state": "unknown", "value": None,
                "clarificationAttempted": False,
            }
    return list(merged.values())


def evaluate_session_gate(answers: Any, movements: Any = None, reviewed: Collection[str] = ()) -> dict[str, Any]:
    """Gate output for the app's raw answers and raw movement results.

    reviewed lists the canonical questions already answered for the current
    evidence. It must come from server-held history, never from the client.
    """
    movements = [] if movements is None else movements
    if not _well_formed(answers, movements):
        return evaluate(None)
    return evaluate(safety_answers_from(assemble(answers, movements), reviewed))
