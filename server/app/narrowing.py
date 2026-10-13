"""Movement-based narrowing. Draft, awaiting clinician review.

Movement results go in; 1 to 3 "muscles that may be involved" come out, or one
labelled cluster when muscles cannot be told apart. Deterministic code only: no
LLM. An unknown movement adds nothing to a muscle's score but stays in the
denominator, so "not sure" lowers confidence and never counts as "no pain".
"""

import json
from typing import Any

from app.gate import SHARED_DIR

with open(SHARED_DIR / "narrowing_shoulder.json", encoding="utf-8") as _f:
    SPEC: dict[str, Any] = json.load(_f)

MOVEMENTS: dict[str, dict[str, Any]] = {m["id"]: m for m in SPEC["movements"]}
MUSCLES: list[dict[str, Any]] = SPEC["muscles"]
CLUSTERS: list[dict[str, Any]] = SPEC["clusters"]
MIN_CONFIDENCE: float = SPEC["scoring"]["minConfidence"]
CLUSTER_MARGIN: float = SPEC["scoring"]["clusterMargin"]
MAX_CANDIDATES: int = SPEC["scoring"]["maxCandidates"]
CONTENT_VERSION: str = SPEC["contentVersion"]

_FLAGS = ("painful", "weak", "unableToDo")


def _validate(results: Any) -> None:
    if not isinstance(results, list):
        raise TypeError("movement results must be a list")
    seen = set()
    for r in results:
        if not isinstance(r, dict):
            raise TypeError("movement result must be an object")
        movement_id = r.get("movementId")
        if not isinstance(movement_id, str) or movement_id not in MOVEMENTS:
            raise ValueError(f"unknown movementId: {movement_id!r}")
        if movement_id in seen:
            raise ValueError(f"duplicate movementId: {movement_id}")
        seen.add(movement_id)
        if r.get("state") not in ("answered", "unknown"):
            raise ValueError(f"{movement_id}: state must be 'answered' or 'unknown'")
        if r["state"] == "answered" and not all(isinstance(r.get(k), bool) for k in _FLAGS):
            raise ValueError(f"{movement_id}: painful, weak and unableToDo must be true or false")
        angle = r.get("measuredAngle")
        if angle is not None and (isinstance(angle, bool) or not isinstance(angle, (int, float))):
            raise ValueError(f"{movement_id}: measuredAngle must be a number or null")


def _observed(results: list[dict[str, Any]]) -> dict[str, bool]:
    """Movement id -> was it positive. Unknown movements are left out."""
    return {
        r["movementId"]: any(r[flag] for flag in MOVEMENTS[r["movementId"]]["positiveWhen"])
        for r in results
        if r["state"] == "answered"
    }


def observed_movements(results: list[dict[str, Any]]) -> dict[str, bool]:
    """Checked movement results as movement id -> positive. Unknown movements are left out."""
    _validate(results)
    return _observed(results)


def score_muscles(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Score every muscle, best first. Ties are alphabetical so results are reproducible."""
    _validate(results)
    observed = _observed(results)
    scored = []
    for muscle in MUSCLES:
        matched, unmatched, unknown = [], [], []
        matched_weight = total_weight = 0
        positive_match = False
        for movement_id, expected in muscle["profile"].items():
            total_weight += expected["w"]
            if movement_id not in observed:
                unknown.append(movement_id)
            elif observed[movement_id] == expected["expect"]:
                matched.append(movement_id)
                matched_weight += expected["w"]
                positive_match = positive_match or expected["expect"]
            else:
                unmatched.append(movement_id)
        scored.append(
            {
                "muscleId": muscle["id"],
                "score": matched_weight / total_weight,
                "positiveMatch": positive_match,
                "matched": matched,
                "unmatched": unmatched,
                "unknown": unknown,
            }
        )
    return sorted(scored, key=lambda s: (-s["score"], s["muscleId"]))


def _same_on_tested(a: str, b: str, tested: set[str]) -> bool:
    profiles = {m["id"]: m["profile"] for m in MUSCLES}

    def expected(muscle_id):
        return {mv: profiles[muscle_id].get(mv, {}).get("expect") for mv in tested}

    return expected(a) == expected(b)


def _cluster_label(members: list[str]) -> str | None:
    """Smallest declared cluster that contains every member."""
    fitting = [c for c in CLUSTERS if set(members) <= set(c["members"])]
    return min(fitting, key=lambda c: len(c["members"]))["id"] if fitting else None


def _reason(item: dict[str, Any], cluster_note: str = "") -> str:
    def part(name):
        return f"{name}: {', '.join(item[name]) or 'none'}"

    return f"{cluster_note}{part('matched')}; {part('unmatched')}; {part('unknown')}."


def narrow(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Return the agreed narrowing output: {candidates: [{muscleId, confidence, reason}], cluster}.

    A muscle is a candidate only if at least one movement it is expected to
    provoke was positive, and its confidence reaches the minimum. With nothing
    positive (or everything unknown) the candidate list is empty.
    """
    scored = score_muscles(results)
    tested = set(_observed(results))
    eligible = [s for s in scored if s["positiveMatch"] and s["score"] >= MIN_CONFIDENCE]
    if not eligible:
        return {"candidates": [], "cluster": False}

    top = eligible[0]
    group = [top] + [
        s
        for s in eligible[1:]
        if top["score"] - s["score"] < CLUSTER_MARGIN
        or _same_on_tested(top["muscleId"], s["muscleId"], tested)
    ]
    cluster = len(group) > 1
    chosen = (group if cluster else eligible)[:MAX_CANDIDATES]

    note = ""
    if cluster:
        label = _cluster_label([s["muscleId"] for s in chosen])
        note = f"Cannot be separated by the movements tested ({label or 'unlabelled group'}). "
    return {
        "candidates": [
            {"muscleId": s["muscleId"], "confidence": round(s["score"], 2), "reason": _reason(s, note)}
            for s in chosen
        ],
        "cluster": cluster,
    }
