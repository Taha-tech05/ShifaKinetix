import json

import pytest

from app.gate import SHARED_DIR
from app.narrowing import MOVEMENTS, MUSCLES, SPEC, narrow, score_muscles

LABEL = "draft, awaiting clinician review"


def result(movement_id, painful=False, weak=False, unable=False, state="answered", angle=None):
    return {
        "movementId": movement_id,
        "painful": painful,
        "weak": weak,
        "unableToDo": unable,
        "measuredAngle": angle,
        "state": state,
    }


def results(**positive):
    """All four movements answered; the named ones painful, or 'unknown' for not sure."""
    out = []
    for movement_id in MOVEMENTS:
        value = positive.get(movement_id, False)
        if value == "unknown":
            out.append(result(movement_id, state="unknown"))
        else:
            out.append(result(movement_id, painful=value))
    return out


def ids(output):
    return [c["muscleId"] for c in output["candidates"]]


def test_clear_supraspinatus_pattern_ranks_it_first():
    output = narrow(results(sideways_raise=True, can_position_hold=True))
    assert ids(output)[0] == "supraspinatus"
    assert output["candidates"][0]["confidence"] == 1.0
    assert output["cluster"] is False


def test_hand_behind_back_pattern_points_to_subscapularis():
    assert ids(narrow(results(hand_behind_back=True))) == ["subscapularis"]


def test_unable_to_hand_behind_back_counts_as_positive():
    moves = [result("hand_behind_back", unable=True) if m["movementId"] == "hand_behind_back" else m for m in results()]
    assert ids(narrow(moves)) == ["subscapularis"]


def test_weakness_on_can_position_hold_counts_as_positive():
    moves = [result("sideways_raise", painful=True), result("can_position_hold", weak=True)]
    assert ids(narrow(moves))[0] == "supraspinatus"


def test_indistinguishable_muscles_return_a_labelled_cluster():
    output = narrow(results(outward_push_elbow_at_side=True))
    assert output["cluster"] is True
    assert ids(output) == ["infraspinatus", "teres_minor"]
    assert all("posterior_cuff_group" in c["reason"] for c in output["candidates"])


def test_close_confidences_return_a_cluster():
    output = narrow(results(outward_push_elbow_at_side=True, hand_behind_back=True, belly_press=True))
    assert output["cluster"] is True
    assert ids(output) == ["subscapularis", "infraspinatus", "teres_minor"]
    assert all("rotator_cuff_group" in c["reason"] for c in output["candidates"])


def test_server_movement_ids_are_exactly_the_apps_movement_ids():
    """Reconciled with mobile/src/data/movements_shoulder.json: one set of ids on both sides."""
    app_file = SHARED_DIR.parent / "mobile" / "src" / "data" / "movements_shoulder.json"
    app_ids = {m["id"] for m in json.loads(app_file.read_text(encoding="utf-8"))["movements"]}
    assert set(MOVEMENTS) == app_ids


def test_every_muscle_names_structures_that_exist_in_the_apps_region_map():
    structures = json.loads((SHARED_DIR / "regions_shoulder.json").read_text(encoding="utf-8"))["structures"]
    for muscle in MUSCLES:
        assert set(muscle["structureIds"]) == {"right", "left"}
        assert all(structure in structures for structure in muscle["structureIds"].values()), muscle["id"]


def test_belly_press_supports_subscapularis_and_forward_raise_is_recorded_but_unused():
    assert ids(narrow(results(belly_press=True, hand_behind_back=True))) == ["subscapularis"]
    assert not any("forward_raise" in muscle["profile"] for muscle in MUSCLES)
    assert narrow(results(forward_raise=True)) == {"candidates": [], "cluster": False}


def test_separated_confidences_are_not_forced_into_a_cluster():
    output = narrow(results(sideways_raise=True, can_position_hold=True, outward_push_elbow_at_side=True, hand_behind_back=True))
    assert output["cluster"] is False
    assert ids(output)[0] == "supraspinatus"


def test_unknown_lowers_confidence_and_is_not_treated_as_no_pain():
    full = narrow(results(sideways_raise=True, can_position_hold=True))
    partial = narrow(results(sideways_raise=True, can_position_hold="unknown"))
    assert ids(partial)[0] == "supraspinatus"
    assert partial["candidates"][0]["confidence"] < full["candidates"][0]["confidence"]
    assert "unknown: can_position_hold" in partial["candidates"][0]["reason"]
    assert "unmatched: none" in partial["candidates"][0]["reason"]


def test_missing_movement_scores_the_same_as_unknown():
    with_unknown = results(sideways_raise=True, can_position_hold="unknown")
    without = [r for r in with_unknown if r["movementId"] != "can_position_hold"]
    assert narrow(without) == narrow(with_unknown)


@pytest.mark.parametrize("moves", [[], results(**{m: "unknown" for m in MOVEMENTS})], ids=["none", "all-unknown"])
def test_all_unknown_gives_zero_confidence_everywhere_and_no_candidates(moves):
    assert all(s["score"] == 0 for s in score_muscles(moves))
    assert narrow(moves) == {"candidates": [], "cluster": False}


def test_nothing_painful_does_not_invent_a_candidate():
    assert narrow(results()) == {"candidates": [], "cluster": False}


def test_output_is_exactly_the_agreed_format():
    output = narrow(results(sideways_raise=True, can_position_hold=True, outward_push_elbow_at_side=True, hand_behind_back=True))
    assert set(output) == {"candidates", "cluster"}
    assert isinstance(output["cluster"], bool)
    assert 1 <= len(output["candidates"]) <= 3
    for candidate in output["candidates"]:
        assert set(candidate) == {"muscleId", "confidence", "reason"}
        assert 0 <= candidate["confidence"] <= 1
        assert "injur" not in candidate["reason"].lower()


def test_measured_angle_may_be_null_or_a_number():
    with_angle = results(sideways_raise=True, can_position_hold=True)
    with_angle[0]["measuredAngle"] = 95
    assert narrow(with_angle) == narrow(results(sideways_raise=True, can_position_hold=True))


def test_same_input_gives_same_output_and_input_is_untouched():
    moves = results(outward_push_elbow_at_side=True)
    before = json.dumps(moves)
    assert narrow(moves) == narrow(moves)
    assert json.dumps(moves) == before


@pytest.mark.parametrize(
    "bad",
    [
        None,
        [None],
        [{"movementId": "handstand", "state": "unknown"}],
        [result("sideways_raise"), result("sideways_raise")],
        [result("sideways_raise", state="done")],
        [{**result("sideways_raise"), "painful": None}],
        [{**result("sideways_raise"), "painful": "yes"}],
        [{**result("sideways_raise"), "measuredAngle": "95"}],
    ],
    ids=["not-a-list", "not-an-object", "unknown-id", "duplicate", "bad-state", "null-flag", "string-flag", "string-angle"],
)
def test_bad_input_is_rejected_not_guessed(bad):
    with pytest.raises((ValueError, TypeError)):
        narrow(bad)


def test_every_data_item_has_source_and_draft_label():
    for key in ("movements", "muscles", "clusters"):
        for item in SPEC[key]:
            assert str(item.get("source", "")).strip(), f"{key}/{item['id']}: missing source"
            assert item.get("label") == LABEL, f"{key}/{item['id']}: missing label"
    assert "validated" not in json.dumps(SPEC).lower()


def test_data_file_is_internally_consistent():
    muscle_ids = {m["id"] for m in MUSCLES}
    for muscle in MUSCLES:
        assert set(muscle["profile"]) <= set(MOVEMENTS)
        assert any(e["expect"] for e in muscle["profile"].values()), "needs a provoking movement"
    for cluster in SPEC["clusters"]:
        assert set(cluster["members"]) <= muscle_ids
    for movement in MOVEMENTS.values():
        assert set(movement["positiveWhen"]) <= {"painful", "weak", "unableToDo"}
