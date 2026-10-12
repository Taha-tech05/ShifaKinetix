import copy
import json

import pytest

from app.conditions import (
    CONDITIONS,
    LABEL,
    TABLE,
    ConditionTableError,
    feature_kind,
    load_conditions,
    validate,
)
from app.gate import QUESTIONS

BY_ID = {c["id"]: c for c in CONDITIONS}
REQUIRED = {q["questionId"] for q in QUESTIONS if q["required"]}


def broken(change):
    """A copy of the real table with one thing changed."""
    table = copy.deepcopy(TABLE)
    change(table["conditions"])
    return table


def test_file_loads_without_errors():
    assert load_conditions() == CONDITIONS
    assert 6 <= len(CONDITIONS) <= 8


def test_allocation_list_is_covered():
    assert set(BY_ID) == {
        "rotator_cuff_related_pain",
        "subacromial_impingement",
        "frozen_shoulder",
        "ac_joint",
        "neck_nerve_referral",
        "cardiac_referral",
        "septic_arthritis",
        "fracture_or_dislocation",
    }


def test_the_three_dangerous_conditions_are_flagged():
    assert {c["id"] for c in CONDITIONS if c["danger"]} == {
        "cardiac_referral",
        "septic_arthritis",
        "fracture_or_dislocation",
    }


@pytest.mark.parametrize("condition", CONDITIONS, ids=[c["id"] for c in CONDITIONS])
def test_every_row_has_source_danger_flag_and_draft_label(condition):
    assert condition["source"].strip()
    assert isinstance(condition["danger"], bool)
    assert condition["label"] == LABEL


@pytest.mark.parametrize("condition", [c for c in CONDITIONS if c["danger"]], ids=lambda c: c["id"])
def test_danger_condition_has_a_defining_feature_on_a_required_question(condition):
    defining = [f for f in condition["features"] if f.get("defining")]
    assert defining
    assert all(feature_kind(f) == "q" and f["q"] in REQUIRED for f in defining)


def test_never_claims_validation():
    text = json.dumps(TABLE).lower()
    assert "validated" not in text
    assert TABLE["label"] == LABEL


@pytest.mark.parametrize(
    "change",
    [
        lambda c: c[0].pop("source"),
        lambda c: c[0].update(source="  "),
        lambda c: c[0].update(label="doctor-validated"),
        lambda c: c[0].pop("danger"),
        lambda c: c[0].update(danger="yes"),
        lambda c: c[0].update(features=[]),
        lambda c: [f.pop("defining", None) for f in c[0]["features"]],
        lambda c: c[0]["features"][0].update(q="sh_q99"),
        lambda c: c[0]["features"][0].update(expect="yes"),
        lambda c: c[0]["features"][0].update(w=0),
        lambda c: c[0]["features"][0].update(movement="painful_arc"),
        lambda c: c[0]["features"].append(dict(c[0]["features"][0])),
        lambda c: c[0]["features"].append({"movement": "handstand", "expect": True, "w": 1}),
        lambda c: c[0]["features"].append({"region": "elbow", "expect": True, "w": 1}),
        lambda c: c[0]["features"].append({"q": "pain_score", "expect": 7, "w": 1}),
        lambda c: c[0]["features"].append({"q": "infection_risk", "expect": True, "w": 1, "defining": True}),
        lambda c: c.append(dict(c[0])),
        lambda c: c.clear(),
    ],
    ids=[
        "no-source", "blank-source", "wrong-label", "no-danger-flag", "danger-not-boolean", "no-features",
        "danger-without-defining", "unknown-question", "bad-expect", "zero-weight", "two-kinds",
        "duplicate-feature", "unknown-movement", "unknown-region", "number-question",
        "defining-on-optional-question", "duplicate-id", "empty-table",
    ],
)
def test_a_broken_table_is_rejected(change):
    with pytest.raises(ConditionTableError):
        validate(broken(change))
