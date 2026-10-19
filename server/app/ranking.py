"""Differential ranking. Draft, awaiting clinician review.

Matches one patient's answers, movement results and tapped region against the
shoulder condition table and returns the conditions in order. Deterministic
code only: the LLM never ranks, reorders, adds or removes a condition.
Doctor-only output: nothing returned here is ever shown to a patient.

"Not sure" is never "no": an unknown feature adds nothing to the score and is
listed as unknown, and a dangerous condition whose defining feature is unknown
is still flagged. A topic denied by its opening question counts as "no".
"""

from typing import Any

from app.conditions import CONDITIONS, REGIONS, feature_kind
from app.gate import _same, implied_answers, is_valid_answer
from app.narrowing import observed_movements

DANGER_BOOST = 0.25  # added to a dangerous condition whose defining feature is present or unknown


def _show(value: Any) -> str:
    return str(value).lower() if isinstance(value, bool) else str(value)


def _region(region_id: Any) -> str | None:
    """'shoulder_right_top' -> 'top'. None when no region was confirmed."""
    if region_id is None:
        return None
    if isinstance(region_id, str):
        for region in REGIONS:
            if region_id == region or region_id.endswith(f"_{region}"):
                return region
    raise ValueError(f"unknown regionId: {region_id!r}")


def _feature_state(feature: dict[str, Any], facts: dict[str, Any]) -> tuple[str, str]:
    """Return (state, fact) where state is matched, contradicted or unknown."""
    kind = feature_kind(feature)
    target = feature[kind]
    if kind == "q":
        answer = facts["answers"].get(target)
        if answer is None or answer["state"] == "unknown":
            return "unknown", target
        state = "matched" if _same(answer["value"], feature["expect"]) else "contradicted"
        return state, f"{target}={_show(answer['value'])}"
    if kind == "movement":
        if target not in facts["movements"]:
            return "unknown", target
        positive = facts["movements"][target]
        state = "matched" if positive == feature["expect"] else "contradicted"
        return state, f"{target}={'positive' if positive else 'negative'}"
    if facts["region"] is None:
        return "unknown", f"region_{target}"
    tapped = facts["region"] == target
    return ("matched" if tapped == feature["expect"] else "contradicted"), f"region_{target}={_show(tapped)}"


def _score(condition: dict[str, Any], facts: dict[str, Any]) -> dict[str, Any]:
    found: dict[str, list[str]] = {"matched": [], "contradicted": [], "unknown": []}
    points = total = 0
    defining_present = defining_unknown = False
    for feature in condition["features"]:
        state, fact = _feature_state(feature, facts)
        found[state].append(fact)
        total += feature["w"]
        if state == "matched":
            points += feature["w"]
        elif state == "contradicted":
            points -= feature["w"]
        if feature.get("defining"):
            defining_present = defining_present or state == "matched"
            defining_unknown = defining_unknown or state == "unknown"

    base = points / total
    flagged = condition["danger"] and (defining_present or defining_unknown)
    pinned = condition["danger"] and defining_present
    score = base + (DANGER_BOOST if flagged else 0)

    count = len(condition["features"])
    uncertainty = f"{len(found['matched'])} of {count} features confirmed"
    if found["contradicted"]:
        uncertainty += f", {len(found['contradicted'])} contradicted"
    uncertainty += f", {len(found['unknown'])} unknown"

    rationale = f"Score {score:.2f} = base {base:.2f}"
    if flagged:
        why = "present" if defining_present else "unknown, and not sure is never treated as no"
        rationale += f" + danger boost {DANGER_BOOST:.2f} (a defining danger feature is {why})"
    rationale += "."
    if pinned:
        rationale += " Placed ahead of every unpinned condition: rule out dangerous conditions first."

    return {
        "conditionId": condition["id"],
        "name": condition["name"],
        "danger": condition["danger"],
        "flagged": flagged,
        "pinned": pinned,
        "score": round(score, 2),
        "baseScore": round(base, 2),
        "matchedFacts": found["matched"],
        "contradictedFacts": found["contradicted"],
        "unknownFacts": found["unknown"],
        "uncertainty": uncertainty,
        "rankRationale": rationale,
        "source": condition["source"],
        "label": condition["label"],
    }


def _order(item: dict[str, Any]) -> tuple[bool, float, str]:
    # Rule out dangerous first: a dangerous condition with a defining feature present goes ahead of
    # everything else, whatever its score. Then highest score first; ties alphabetical (no sourced
    # prevalence prior yet) so results are reproducible.
    return (not item["pinned"], -item["score"], item["conditionId"])


def rank(
    answers: list[dict[str, Any]],
    movements: list[dict[str, Any]] | None = None,
    region_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return every condition, most relevant first, each with its provenance."""
    if (
        not isinstance(answers, list)
        or not all(is_valid_answer(a) for a in answers)
        or len({a["questionId"] for a in answers}) != len(answers)
    ):
        raise ValueError("invalid or conflicting answers")
    facts = {
        # A No to an opening question is a real No for its detail questions (contract v2), not an unknown.
        "answers": {a["questionId"]: a for a in implied_answers(answers)},
        "movements": observed_movements(movements or []),
        "region": _region(region_id),
    }
    return sorted((_score(c, facts) for c in CONDITIONS), key=_order)
