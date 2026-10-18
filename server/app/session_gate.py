"""Gate for live app answers. Draft, awaiting clinician review.

Server-side equivalent of the mobile pipeline (docs/safety-integration.md,
contract v2):

    canonical answers + raw app answers + raw movement results
      -> safety_answers_from()     mobile/src/gate/sessionAdapter.ts
      -> evaluate()                the canonical gate, unchanged and strict
      -> conflicts()               follow-ups only for real contradictions

Each thing is asked once. An app answer never re-opens a safety question by
itself; it only asks again when it contradicts an answer the patient gave:

- the basics answer (how it started, the pain score) now differs from the
  canonical answer it filled in, for example after the basics were edited;
- the patient said they can move the arm, and after the whole movement set
  they could not do at least one movement.

A weak, painful, skipped or unknown movement is never a safety signal: it goes
to narrowing. A pending follow-up turns SAFE into CLARIFY with an F_ reason; a
confirmed danger keeps its verdict and lists the follow-up too.

Which follow-ups have been answered is decided by the caller from server-held
history (see store.reviewed_followups). Client review tokens are never read.
These mappings are conservative draft policy, not clinician-approved rules.
"""

import json
import math
from collections.abc import Collection
from typing import Any

from app.gate import QUESTIONS, _same, evaluate, is_valid_answer

CANONICAL_IDS = {q["questionId"] for q in QUESTIONS}
BASICS_HOW = "Q_BASICS_HOW"
BASICS_VALUES = ("after_injury", "suddenly", "slowly")
MOVEMENT_SET_SIZE = 6  # the app's six guided movements; a contradiction is checked once, after the whole set
COMPLETED_MOVEMENT_STATES = ("answered", "done")
FOLLOWUP_SOURCE = "docs/safety-integration.md"
FOLLOWUP_REASON = "A later answer differs from this earlier answer; please confirm it."
_MISSING = object()


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


def prefill_value(answers: list[dict[str, Any]], question: dict[str, Any]) -> Any:
    """The value an earlier app answer gives for this canonical question (prefillFrom), or _MISSING."""
    source = question.get("prefillFrom")
    if not source:
        return _MISSING
    given = _find(answers, source["questionId"])
    if given is None or given.get("state") != "answered":
        return _MISSING
    value = given.get("value")
    mapping = source.get("map")
    if mapping is not None:
        if not isinstance(value, str) or value not in mapping:
            return _MISSING
        value = mapping[value]
    candidate = {"questionId": question["questionId"], "type": question["type"], "value": value, "state": "answered"}
    return value if is_valid_answer(candidate) else _MISSING


def unable_movements(movements: list[dict[str, Any]]) -> list[str]:
    """Movements the patient could not do, once the whole movement set has an answer; otherwise none."""
    if len({m["movementId"] for m in movements}) < MOVEMENT_SET_SIZE:
        return []
    return sorted({m["movementId"] for m in movements if m.get("state") != "unknown" and m.get("unableToDo") is True})


def signals(answers: list[dict[str, Any]], movements: list[dict[str, Any]]) -> dict[str, Any]:
    """For each canonical question an app answer speaks about: that evidence. Needs no canonical answer.

    The basics answer that fills a question (prefillFrom), and, after the whole
    movement set, any movement the patient could not do (for "unable").
    """
    out: dict[str, Any] = {}
    for q in QUESTIONS:
        pre = prefill_value(answers, q)
        if pre is not _MISSING:
            out[q["questionId"]] = {"from": q["prefillFrom"]["questionId"], "value": pre}
    failed = unable_movements(movements)
    if failed:
        out["unable"] = {"movements": failed}
    return out


def conflicts(answers: list[dict[str, Any]], movements: list[dict[str, Any]]) -> list[tuple[str, Any]]:
    """(canonical question, evidence) for each given answer that the app evidence contradicts, in question order."""
    evidence = signals(answers, movements)
    out = []
    for q in QUESTIONS:
        qid = q["questionId"]
        own = next((a for a in answers if a["questionId"] == qid), None)
        if qid not in evidence or own is None or own.get("state") != "answered":
            continue
        contradicted = own.get("value") is False if qid == "unable" else not _same(evidence[qid]["value"], own.get("value"))
        if contradicted:
            out.append((qid, evidence[qid]))
    return out


def followup_evidence(answers: Any, movements: Any) -> dict[str, str]:
    """For each canonical question app evidence speaks about: a fingerprint of that evidence.

    Used by the server to decide whether a follow-up was answered after the
    evidence it reviews; it works from app answers alone, without canonical
    answers. Any change to that evidence is new evidence.
    """
    if not _well_formed(answers, movements):
        return {}
    return {qid: json.dumps(evidence, sort_keys=True) for qid, evidence in signals(answers, movements).items()}


def pending_followups(answers: list[dict[str, Any]], movements: list[dict[str, Any]], reviewed: Collection[str] = ()) -> list[str]:
    """Contradicted canonical questions not yet answered again for the current evidence."""
    return [qid for qid, _ in conflicts(answers, movements) if qid not in reviewed]


def safety_answers_from(combined: Any) -> list[dict[str, Any]] | None:
    """The canonical safety answers among all app answers. None means the input cannot be trusted."""
    if not _well_formed(combined, []):
        return None
    canonical = [a for a in combined if a["questionId"] in CANONICAL_IDS]
    if not all(is_valid_answer(a) for a in canonical) or len({a["questionId"] for a in canonical}) != len(canonical):
        return None
    for a in combined:
        question_id, state, value = a["questionId"], a.get("state"), a.get("value", ...)
        unknown_ok = state == "unknown" and value is None
        if question_id == BASICS_HOW and not (
            unknown_ok or (state == "answered" and isinstance(value, str) and value in BASICS_VALUES)
        ):
            return None
        # An unmapped safety input must not silently disappear as the app evolves.
        if question_id not in CANONICAL_IDS and (question_id.startswith("Q_DANGER_") or _js_truthy(a.get("flagged"))):
            return None
    return canonical


def evaluate_session_gate(answers: Any, movements: Any = None, reviewed: Collection[str] = ()) -> dict[str, Any]:
    """Gate output for the app's canonical and raw answers and raw movement results.

    reviewed lists the canonical questions already answered for the current
    evidence. It must come from server-held history, never from the client.
    """
    movements = [] if movements is None else movements
    if not _well_formed(answers, movements):
        return evaluate(None)
    canonical = safety_answers_from(answers)
    output = evaluate(canonical)
    if canonical is None:
        return output
    pending = pending_followups(answers, movements, reviewed)
    if not pending:
        return output
    fired = [*output["firedRules"], *(
        {"ruleId": f"F_{qid}", "matchedAnswers": [qid], "source": FOLLOWUP_SOURCE, "reason": FOLLOWUP_REASON}
        for qid in pending
    )]
    if output["verdict"] == "SAFE":
        return {"verdict": "CLARIFY", "level": None, "score": output["score"], "firedRules": fired}
    return {**output, "firedRules": fired}
