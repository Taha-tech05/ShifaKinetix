"""Ranking tests. Made-up cases only, not patient data."""

import json

import pytest

from app.conditions import CONDITIONS
from app.gate import QUESTIONS
from app.narrowing import MOVEMENTS
from app.ranking import DANGER_BOOST, rank

REQUIRED = [q for q in QUESTIONS if q["required"]]
DANGER_IDS = {c["id"] for c in CONDITIONS if c["danger"]}
CUFF_OR_IMPINGEMENT = {"rotator_cuff_related_pain", "subacromial_impingement"}


def answers(unknown=(), **changed):
    """Every required safety question answered 'no'; override some, or mark some not sure."""
    out = []
    for q in REQUIRED:
        qid = q["questionId"]
        if qid in unknown:
            out.append({"questionId": qid, "type": q["type"], "value": None, "state": "unknown"})
        else:
            value = changed.get(qid, False if q["type"] == "yesno" else "normal")
            out.append({"questionId": qid, "type": q["type"], "value": value, "state": "answered"})
    return out


def movements(*positive, unknown=()):
    return [
        {
            "movementId": m,
            "painful": m in positive,
            "weak": False,
            "unableToDo": False,
            "measuredAngle": None,
            "state": "unknown" if m in unknown else "answered",
        }
        for m in MOVEMENTS
    ]


def ids(ranking):
    return [item["conditionId"] for item in ranking]


def item(ranking, condition_id):
    return next(i for i in ranking if i["conditionId"] == condition_id)


def test_fall_with_deformed_swollen_shoulder_ranks_fracture_in_top_3_and_flags_it():
    ranking = rank(answers(injury=True, shape=True, swelling=True, unable=True, sudden=True))
    assert "fracture_or_dislocation" in ids(ranking)[:3]
    assert item(ranking, "fracture_or_dislocation")["flagged"] is True


def test_fever_with_hot_swollen_joint_flags_joint_infection_near_the_top():
    ranking = rank(answers(fever=True, redness=True, temperature="hot", swelling=True))
    assert ids(ranking)[0] == "septic_arthritis"
    assert ranking[0]["flagged"] is True


def test_chest_symptoms_flag_heart_referral():
    ranking = rank(answers(chest=True, breathing=True), movements())
    assert ids(ranking)[0] == "cardiac_referral"
    assert ranking[0]["flagged"] is True


def test_classic_painful_arc_pattern_ranks_cuff_or_impingement_first():
    ranking = rank(answers(), movements("painful_arc", "empty_can"), "shoulder_right_front")
    assert ids(ranking)[0] in CUFF_OR_IMPINGEMENT
    assert set(ids(ranking)[:2]) == CUFF_OR_IMPINGEMENT
    assert not any(i["flagged"] for i in ranking)


def test_gradual_stiffness_in_all_directions_ranks_frozen_shoulder_high():
    ranking = rank(answers(), movements(*MOVEMENTS), "shoulder_left_front")
    assert "frozen_shoulder" in ids(ranking)[:2]


def test_tingling_and_numbness_bring_up_neck_nerve_referral():
    ranking = rank(answers(tingling=True, numb=True), movements())
    assert ids(ranking)[0] == "neck_nerve_referral"


def test_pain_on_top_of_the_shoulder_brings_up_ac_joint():
    ranking = rank(answers(), movements("painful_arc"), "shoulder_right_top")
    assert "ac_joint" in ids(ranking)[:2]


def test_all_not_sure_keeps_danger_visible_and_gives_no_confident_benign_ranking():
    everything = [q["questionId"] for q in REQUIRED]
    ranking = rank(answers(unknown=everything), movements(unknown=list(MOVEMENTS)))
    assert set(ids(ranking)[:3]) == DANGER_IDS
    for entry in ranking:
        assert entry["matchedFacts"] == [] and entry["contradictedFacts"] == []
        assert entry["flagged"] is entry["danger"]
        assert entry["score"] == (DANGER_BOOST if entry["danger"] else 0)
        assert "0 of" in entry["uncertainty"]


def test_no_information_at_all_behaves_like_all_not_sure():
    assert set(ids(rank([]))[:3]) == DANGER_IDS


def test_not_sure_never_counts_as_no():
    said_no = item(rank(answers()), "cardiac_referral")
    not_sure = item(rank(answers(unknown=["chest"])), "cardiac_referral")
    assert "chest=false" in said_no["contradictedFacts"] and said_no["flagged"] is False
    assert "chest" in not_sure["unknownFacts"] and not_sure["flagged"] is True
    assert not_sure["contradictedFacts"].count("chest=false") == 0
    assert not_sure["score"] > said_no["score"]
    assert "not sure is never treated as no" in not_sure["rankRationale"]


def test_one_defining_danger_sign_is_placed_first_despite_a_low_score():
    ranking = rank(answers(injury=True), movements("painful_arc", "empty_can"), "shoulder_right_top")
    fracture = item(ranking, "fracture_or_dislocation")
    assert fracture["baseScore"] < 0
    assert fracture["pinned"] is True
    assert ids(ranking)[0] == "fracture_or_dislocation"
    assert sum(1 for i in ranking if i["score"] > fracture["score"]) >= 3


def test_pinned_conditions_come_first_then_everything_is_in_score_order():
    ranking = rank(answers(injury=True, fever=True), movements("painful_arc", "empty_can"))
    pinned = [i for i in ranking if i["pinned"]]
    assert {i["conditionId"] for i in pinned} == {"fracture_or_dislocation", "septic_arthritis"}
    assert ranking[: len(pinned)] == pinned
    for part in (pinned, ranking[len(pinned) :]):
        assert [i["score"] for i in part] == sorted((i["score"] for i in part), reverse=True)


def test_danger_sign_outranks_a_benign_condition_that_has_almost_no_evidence():
    """Fall and cannot move, no movements done: fracture must not sit below a guess."""
    ranking = rank(answers(injury=True, unable=True))
    assert ids(ranking)[0] == "fracture_or_dislocation"
    assert ranking[0]["score"] < ranking[1]["score"]
    assert "rule out dangerous conditions first" in ranking[0]["rankRationale"]


def test_flagged_but_not_pinned_is_ordered_by_score():
    """Not sure is boosted and flagged, but only a present danger sign is placed first."""
    ranking = rank(answers(unknown=["chest"]), movements("painful_arc", "empty_can"))
    cardiac = item(ranking, "cardiac_referral")
    assert cardiac["flagged"] and not cardiac["pinned"]
    assert [i["score"] for i in ranking] == sorted((i["score"] for i in ranking), reverse=True)


def test_every_condition_is_returned_once_with_full_provenance():
    ranking = rank(answers(), movements("painful_arc"))
    assert sorted(ids(ranking)) == sorted(c["id"] for c in CONDITIONS)
    for entry in ranking:
        assert entry["source"].strip()
        assert entry["label"] == "draft, awaiting clinician review"
        assert entry["rankRationale"].startswith("Score ")
        assert " features confirmed" in entry["uncertainty"]
        total = len(entry["matchedFacts"]) + len(entry["contradictedFacts"]) + len(entry["unknownFacts"])
        assert total == len(next(c for c in CONDITIONS if c["id"] == entry["conditionId"])["features"])


def test_ties_are_alphabetical_so_results_are_reproducible():
    ranking = rank([])
    benign = [i for i in ranking if not i["danger"]]
    assert ids(benign) == sorted(ids(benign))
    assert ids(ranking[:3]) == sorted(ids(ranking[:3]))


def test_same_input_gives_same_output_and_input_is_untouched():
    given_answers, given_movements = answers(fever=True), movements("lift_off")
    before = json.dumps([given_answers, given_movements])
    assert rank(given_answers, given_movements) == rank(given_answers, given_movements)
    assert json.dumps([given_answers, given_movements]) == before


@pytest.mark.parametrize(
    "bad_answers",
    [None, [None], [{"questionId": "chest", "type": "yesno", "value": "true", "state": "answered"}], answers() + answers()],
    ids=["not-a-list", "not-an-object", "string-boolean", "duplicates"],
)
def test_bad_answers_are_rejected_not_guessed(bad_answers):
    with pytest.raises(ValueError):
        rank(bad_answers)


def test_bad_movements_or_region_are_rejected():
    with pytest.raises(ValueError):
        rank(answers(), [{"movementId": "handstand", "state": "answered"}])
    with pytest.raises(ValueError):
        rank(answers(), movements(), "elbow_left")
