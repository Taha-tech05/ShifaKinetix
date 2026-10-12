"""Shoulder condition table. Draft, awaiting clinician review.

Loads and checks server/data/conditions_shoulder.json. The table is doctor-only
content: it lives on the server and is never sent to a patient. A broken table
stops the server at start-up instead of producing a wrong ranking later.
"""

import json
from pathlib import Path
from typing import Any

from app.gate import QUESTIONS
from app.narrowing import MOVEMENTS

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
LABEL = "draft, awaiting clinician review"
REGIONS = ("front", "back", "top")
FEATURE_KINDS = ("q", "movement", "region")

_QUESTIONS_BY_ID = {q["questionId"]: q for q in QUESTIONS}


class ConditionTableError(ValueError):
    pass


def feature_kind(feature: dict[str, Any]) -> str:
    """Which of q / movement / region this feature refers to."""
    kinds = [k for k in FEATURE_KINDS if k in feature]
    if len(kinds) != 1:
        raise ConditionTableError(f"feature needs exactly one of {FEATURE_KINDS}: {feature}")
    return kinds[0]


def _check_feature(condition_id: str, feature: Any) -> None:
    if not isinstance(feature, dict):
        raise ConditionTableError(f"{condition_id}: feature must be an object")
    kind = feature_kind(feature)
    target, expect, weight = feature[kind], feature.get("expect"), feature.get("w")
    where = f"{condition_id}/{target}"
    if isinstance(weight, bool) or not isinstance(weight, int) or weight < 1:
        raise ConditionTableError(f"{where}: w must be a whole number of 1 or more")
    if not isinstance(feature.get("defining", False), bool):
        raise ConditionTableError(f"{where}: defining must be true or false")
    if kind == "q":
        question = _QUESTIONS_BY_ID.get(target)
        if question is None:
            raise ConditionTableError(f"{where}: unknown question id")
        if question["type"] == "yesno" and not isinstance(expect, bool):
            raise ConditionTableError(f"{where}: expect must be true or false")
        if question["type"] == "choice" and expect not in [o["value"] for o in question["options"]]:
            raise ConditionTableError(f"{where}: expect must be one of the question's options")
        if question["type"] not in ("yesno", "choice"):
            raise ConditionTableError(f"{where}: only yes/no and choice questions can be features")
        if feature.get("defining") and not question["required"]:
            raise ConditionTableError(f"{where}: a defining feature must be a required safety question")
    else:
        if target not in (MOVEMENTS if kind == "movement" else REGIONS):
            raise ConditionTableError(f"{where}: unknown {kind}")
        if not isinstance(expect, bool):
            raise ConditionTableError(f"{where}: expect must be true or false")
        if feature.get("defining"):
            raise ConditionTableError(f"{where}: only question features can be defining")


def validate(table: Any) -> list[dict[str, Any]]:
    """Return the condition list, or raise ConditionTableError naming the first problem."""
    conditions = table.get("conditions") if isinstance(table, dict) else None
    if not isinstance(conditions, list) or not 6 <= len(conditions) <= 8:
        raise ConditionTableError("table must list 6 to 8 conditions")
    seen = set()
    for condition in conditions:
        condition_id = condition.get("id") if isinstance(condition, dict) else None
        if not isinstance(condition_id, str) or not condition_id:
            raise ConditionTableError("every condition needs an id")
        if condition_id in seen:
            raise ConditionTableError(f"{condition_id}: duplicate id")
        seen.add(condition_id)
        if not str(condition.get("name", "")).strip():
            raise ConditionTableError(f"{condition_id}: missing name")
        if not str(condition.get("source", "")).strip():
            raise ConditionTableError(f"{condition_id}: missing source")
        if condition.get("label") != LABEL:
            raise ConditionTableError(f"{condition_id}: label must be '{LABEL}'")
        if not isinstance(condition.get("danger"), bool):
            raise ConditionTableError(f"{condition_id}: danger must be true or false")
        features = condition.get("features")
        if not isinstance(features, list) or not features:
            raise ConditionTableError(f"{condition_id}: needs at least one feature")
        for feature in features:
            _check_feature(condition_id, feature)
        targets = [(feature_kind(f), f[feature_kind(f)]) for f in features]
        if len(set(targets)) != len(targets):
            raise ConditionTableError(f"{condition_id}: the same feature is listed twice")
        if condition["danger"] and not any(f.get("defining") for f in features):
            raise ConditionTableError(f"{condition_id}: a danger condition needs a defining feature")
    return conditions


def load_conditions(path: Path | None = None) -> list[dict[str, Any]]:
    with open(path or DATA_DIR / "conditions_shoulder.json", encoding="utf-8") as f:
        return validate(json.load(f))


with open(DATA_DIR / "conditions_shoulder.json", encoding="utf-8") as _f:
    TABLE: dict[str, Any] = json.load(_f)
CONDITIONS: list[dict[str, Any]] = validate(TABLE)
CONTENT_VERSION: str = TABLE["contentVersion"]
