"""Harder cases across the gate, narrowing and ranking. Made-up cases only, not patient data.

Covers combined dangers, mixed "not sure" answers, partial and conflicting
evidence, and sweeps over every combination of the key inputs.
"""

import itertools
import json
import random

import pytest

from app.conditions import CONDITIONS
from app.gate import QUESTIONS, RULES, evaluate
from app.narrowing import MOVEMENTS, MUSCLES, narrow
from app.ranking import DANGER_BOOST, rank

REQUIRED = [q for q in QUESTIONS if q["required"]]
REQUIRED_IDS = [q["questionId"] for q in REQUIRED]
# Questions where one answer alone is a red flag. "redness" is required but only fires in combination.
SOLO_DANGER = [q for q in REQUIRED if q["dangerAnswers"]]
SOLO_DANGER_IDS = [q["questionId"] for q in SOLO_DANGER]
MOVEMENT_IDS = list(MOVEMENTS)
DANGER_IDS = {c["id"] for c in CONDITIONS if c["danger"]}
PIN_TOP = len(DANGER_IDS)  # at most this many conditions can be pinned
BENIGN_IDS = {c["id"] for c in CONDITIONS if not c["danger"]}
# Defining question -> the dangerous condition it belongs to.
DEFINING = {f["q"]: c["id"] for c in CONDITIONS for f in c["features"] if f.get("defining")}
DEFINING_VALUE = {f["q"]: f["expect"] for c in CONDITIONS for f in c["features"] if f.get("defining")}


def answers(unknown=(), clarified=(), missing=(), **changed):
    out = []
    for q in REQUIRED:
        qid = q["questionId"]
        if qid in missing:
            continue
        if qid in unknown or qid in clarified:
            record = {"questionId": qid, "type": q["type"], "value": None, "state": "unknown"}
            if qid in clarified:
                record["clarificationAttempted"] = True
        else:
            value = changed.get(qid, False if q["type"] == "yesno" else "normal")
            record = {"questionId": qid, "type": q["type"], "value": value, "state": "answered"}
        out.append(record)
    return out


def movement(movement_id, painful=False, weak=False, unable=False, state="answered"):
    return {
        "movementId": movement_id,
        "painful": painful,
        "weak": weak,
        "unableToDo": unable,
        "measuredAngle": None,
        "state": state,
    }


def movements(*positive, unknown=(), skip=()):
    return [
        movement(m, painful=m in positive, state="unknown" if m in unknown else "answered")
        for m in MOVEMENT_IDS
        if m not in skip
    ]


def ids(ranking):
    return [i["conditionId"] for i in ranking]


def item(ranking, condition_id):
    return next(i for i in ranking if i["conditionId"] == condition_id)


def position(ranking, condition_id):
    return ids(ranking).index(condition_id)


# ---------------------------------------------------------------- ranking: combined dangers


def test_two_dangers_at_once_are_both_flagged_in_the_top_3():
    ranking = rank(answers(injury=True, shape=True, fever=True, redness=True, temperature="hot"))
    assert {"fracture_or_dislocation", "septic_arthritis"} <= set(ids(ranking)[:3])
    assert item(ranking, "fracture_or_dislocation")["flagged"]
    assert item(ranking, "septic_arthritis")["flagged"]


def test_three_dangers_at_once_fill_the_top_3():
    ranking = rank(answers(chest=True, injury=True, fever=True), movements("sideways_raise", "can_position_hold"))
    assert set(ids(ranking)[:3]) == DANGER_IDS
    assert all(i["pinned"] for i in ranking[:3])


def test_danger_sign_is_not_buried_under_a_perfect_benign_pattern():
    ranking = rank(answers(chest=True), movements("sideways_raise", "can_position_hold"), "shoulder_right_front")
    impingement, cardiac = item(ranking, "subacromial_impingement"), item(ranking, "cardiac_referral")
    assert impingement["baseScore"] == 1.0
    assert cardiac["flagged"] and cardiac["pinned"]
    assert position(ranking, "cardiac_referral") < PIN_TOP


def test_fracture_and_ac_joint_overlap_after_a_fall_onto_the_shoulder():
    ranking = rank(answers(injury=True, shape=True, sudden=True), movements("sideways_raise"), "shoulder_left_top")
    assert position(ranking, "fracture_or_dislocation") < PIN_TOP
    assert position(ranking, "ac_joint") < PIN_TOP
    assert item(ranking, "ac_joint")["flagged"] is False


@pytest.mark.parametrize("present", [c for n in range(1, 7) for c in itertools.combinations(sorted(DEFINING), n)], ids="+".join)
@pytest.mark.parametrize("pattern", [(), ("sideways_raise", "can_position_hold"), tuple(MOVEMENT_IDS)], ids=["no-pain", "arc", "all-pain"])
def test_every_combination_of_defining_danger_signs_pins_its_condition(present, pattern):
    """All 63 combinations of the six defining questions, against three movement patterns."""
    ranking = rank(answers(**{q: DEFINING_VALUE[q] for q in present}), movements(*pattern), "shoulder_right_top")
    for condition_id in {DEFINING[q] for q in present}:
        entry = item(ranking, condition_id)
        assert entry["flagged"] and entry["pinned"]
        assert position(ranking, condition_id) < PIN_TOP


# ---------------------------------------------------------------- ranking: not sure


@pytest.mark.parametrize("qid", sorted(DEFINING))
def test_not_sure_on_each_defining_question_flags_and_outranks_a_clear_no(qid):
    said_no = item(rank(answers(), movements("sideways_raise")), DEFINING[qid])
    not_sure = item(rank(answers(unknown=[qid]), movements("sideways_raise")), DEFINING[qid])
    assert said_no["flagged"] is False
    assert not_sure["flagged"] is True and not_sure["pinned"] is False
    assert not_sure["score"] > said_no["score"]
    assert qid in not_sure["unknownFacts"]
    assert not any(fact.startswith(f"{qid}=") for fact in not_sure["contradictedFacts"])


def test_not_sure_after_clarification_is_still_unknown_not_no():
    first = rank(answers(unknown=["chest"]))
    again = rank(answers(clarified=["chest"]))
    assert first == again
    assert item(again, "cardiac_referral")["flagged"]


def test_missing_answer_is_treated_like_not_sure():
    assert rank(answers(missing=["fever"])) == rank(answers(unknown=["fever"]))


def test_one_danger_confirmed_and_another_not_sure():
    ranking = rank(answers(unknown=["chest", "breathing"], injury=True, shape=True))
    fracture, cardiac = item(ranking, "fracture_or_dislocation"), item(ranking, "cardiac_referral")
    assert fracture["pinned"] and position(ranking, "fracture_or_dislocation") < PIN_TOP
    assert cardiac["flagged"] and not cardiac["pinned"]
    assert cardiac["score"] >= DANGER_BOOST - 2 / 7 - 0.01  # only the two movement features can be unknown here


def test_not_sure_on_movements_lowers_benign_scores_but_never_below_the_unknown_floor():
    clear = rank(answers(), movements("sideways_raise", "can_position_hold"))
    unsure = rank(answers(), movements("sideways_raise", unknown=["can_position_hold"]))
    assert item(unsure, "rotator_cuff_related_pain")["score"] < item(clear, "rotator_cuff_related_pain")["score"]
    assert "can_position_hold" in item(unsure, "rotator_cuff_related_pain")["unknownFacts"]
    assert ids(unsure)[0] in {"rotator_cuff_related_pain", "subacromial_impingement"}


def test_half_the_safety_screen_not_sure_keeps_every_affected_danger_flagged():
    half = REQUIRED_IDS[::2]
    ranking = rank(answers(unknown=half), movements("sideways_raise", "can_position_hold"))
    for qid in set(half) & set(DEFINING):
        assert item(ranking, DEFINING[qid])["flagged"]


# ---------------------------------------------------------------- ranking: partial and conflicting evidence


def test_only_one_movement_done_gives_lower_scores_and_lists_the_rest_as_unknown():
    full = rank(answers(), movements("sideways_raise", "can_position_hold"))
    partial = rank(answers(), [movement("sideways_raise", painful=True)])
    cuff = item(partial, "rotator_cuff_related_pain")
    assert set(cuff["unknownFacts"]) == {"can_position_hold", "outward_push_elbow_at_side"}
    assert cuff["score"] < item(full, "rotator_cuff_related_pain")["score"]
    assert ids(partial)[0] == "subacromial_impingement"


def test_nothing_hurts_and_nothing_is_wrong_gives_no_confident_ranking():
    ranking = rank(answers(), movements(), "shoulder_right_front")
    assert max(i["score"] for i in ranking) < 0.5
    assert not any(i["flagged"] for i in ranking)


def test_weakness_or_inability_counts_like_pain():
    by_pain = rank(answers(), movements("can_position_hold", "hand_behind_back"))
    by_other = rank(answers(), [movement("sideways_raise"), movement("can_position_hold", weak=True),
                                movement("outward_push_elbow_at_side"), movement("hand_behind_back", unable=True)])
    assert by_pain == by_other


def test_cold_arm_does_not_count_as_a_hot_joint():
    hot = item(rank(answers(fever=True, temperature="hot")), "septic_arthritis")
    cold = item(rank(answers(fever=True, temperature="cold")), "septic_arthritis")
    assert "temperature=hot" in hot["matchedFacts"]
    assert "temperature=cold" in cold["contradictedFacts"]
    assert cold["score"] < hot["score"] and cold["flagged"]


def test_optional_risk_question_raises_joint_infection_when_answered_yes():
    risk = {"questionId": "infection_risk", "type": "yesno", "value": True, "state": "answered"}
    without = item(rank(answers(fever=True, redness=True)), "septic_arthritis")
    with_risk = item(rank(answers(fever=True, redness=True) + [risk]), "septic_arthritis")
    assert "infection_risk" in without["unknownFacts"]
    assert "infection_risk=true" in with_risk["matchedFacts"]
    assert with_risk["score"] > without["score"]


def test_tapped_region_moves_ac_joint_up_and_down():
    scores = {
        region: item(rank(answers(), movements("sideways_raise"), region), "ac_joint")["score"]
        for region in ("shoulder_right_top", None, "shoulder_right_front", "shoulder_left_back")
    }
    assert scores["shoulder_right_top"] > scores[None] > scores["shoulder_right_front"]
    assert scores["shoulder_right_front"] == scores["shoulder_left_back"]


def test_neck_nerve_signs_with_a_painful_shoulder_pattern_show_both():
    ranking = rank(answers(tingling=True, numb=True), movements("sideways_raise", "can_position_hold"))
    assert position(ranking, "neck_nerve_referral") < 4
    assert ids(ranking)[0] in {"rotator_cuff_related_pain", "subacromial_impingement"}


def test_context_answers_that_are_not_features_do_not_change_the_ranking():
    extra = [
        {"questionId": "pain_score", "type": "number", "value": 9, "state": "answered"},
        {"questionId": "duration", "type": "duration", "value": 400, "state": "answered"},
        {"questionId": "side", "type": "choice", "value": "both", "state": "answered"},
    ]
    assert rank(answers() + extra, movements("hand_behind_back")) == rank(answers(), movements("hand_behind_back"))


# ---------------------------------------------------------------- ranking: properties over every combination

STATES = ("positive", "negative", "unknown")
ALL_MOVEMENT_COMBOS = list(itertools.product(STATES, repeat=len(MOVEMENT_IDS)))


def combo(states):
    return [
        movement(m, painful=s == "positive", state="unknown" if s == "unknown" else "answered")
        for m, s in zip(MOVEMENT_IDS, states)
    ]


@pytest.mark.parametrize("states", ALL_MOVEMENT_COMBOS, ids="/".join)
def test_all_81_movement_combinations_give_a_well_formed_result(states):
    ranking = rank(answers(), combo(states), "shoulder_right_front")
    assert sorted(ids(ranking)) == sorted(c["id"] for c in CONDITIONS)
    assert not any(i["flagged"] for i in ranking), "all safety answers were a clear no"
    assert [i["score"] for i in ranking] == sorted((i["score"] for i in ranking), reverse=True)
    assert all(-1 <= i["score"] <= 1 for i in ranking)
    if "positive" not in states:
        assert max(i["score"] for i in ranking) < 0.6, "no positive movement must not look confident"

    narrowed = narrow(combo(states))
    assert len(narrowed["candidates"]) <= 3
    assert narrowed["cluster"] is (len(narrowed["candidates"]) > 1) or not narrowed["cluster"]
    assert {c["muscleId"] for c in narrowed["candidates"]} <= {m["id"] for m in MUSCLES}
    if "positive" not in states:
        assert narrowed["candidates"] == []


@pytest.mark.parametrize("states", ALL_MOVEMENT_COMBOS, ids="/".join)
def test_turning_a_movement_to_not_sure_never_pushes_a_score_past_its_extremes(states):
    """Unknown sits between match and contradiction for every condition."""
    base = {i["conditionId"]: i["baseScore"] for i in rank(answers(), combo(states))}
    for index, state in enumerate(states):
        if state == "unknown":
            continue
        other = "negative" if state == "positive" else "positive"
        as_unknown = rank(answers(), combo(states[:index] + ("unknown",) + states[index + 1 :]))
        as_other = rank(answers(), combo(states[:index] + (other,) + states[index + 1 :]))
        for entry in as_unknown:
            low, high = sorted((base[entry["conditionId"]], item(as_other, entry["conditionId"])["baseScore"]))
            assert low - 0.01 <= entry["baseScore"] <= high + 0.01


def test_order_of_the_input_lists_does_not_matter():
    rng = random.Random(7)
    given_answers = answers(unknown=["chest"], injury=True, temperature="hot")
    given_movements = movements("sideways_raise", "hand_behind_back", unknown=["can_position_hold"])
    expected = (evaluate(given_answers), narrow(given_movements), rank(given_answers, given_movements))
    for _ in range(20):
        a, m = given_answers[:], given_movements[:]
        rng.shuffle(a)
        rng.shuffle(m)
        assert (evaluate(a), narrow(m), rank(a, m)) == expected


# ---------------------------------------------------------------- gate: combinations checked against a second, simpler statement of the contract


def oracle(given):
    """The contract restated without rules: used to cross-check evaluate()."""
    by_id = {a["questionId"]: a for a in given}
    danger = any(
        by_id[q["questionId"]]["state"] == "answered" and by_id[q["questionId"]]["value"] in q["dangerAnswers"]
        for q in REQUIRED
        if q["questionId"] in by_id
    )
    incomplete = any(q["questionId"] not in by_id or by_id[q["questionId"]]["state"] == "unknown" for q in REQUIRED)
    # v1.2: redness = yes makes infection_risk required, and these intakes never contain it.
    needs_risk = "redness" in by_id and by_id["redness"]["state"] == "answered" and by_id["redness"]["value"] is True
    # v1.1: uncertainty, even after clarification, is CLARIFY and never a red flag by itself.
    return "RED_FLAG" if danger else "CLARIFY" if incomplete or needs_risk else "SAFE"


def random_intake(rng):
    out = []
    for q in REQUIRED:
        roll = rng.random()
        qid = q["questionId"]
        if roll < 0.04:
            continue
        if roll < 0.10:
            record = {"questionId": qid, "type": q["type"], "value": None, "state": "unknown"}
            if rng.random() < 0.4:
                record["clarificationAttempted"] = rng.random() < 0.7
        else:
            options = [True, False] if q["type"] == "yesno" else [o["value"] for o in q["options"]]
            weights = [1 if v in q["dangerAnswers"] else 12 for v in options]
            record = {"questionId": qid, "type": q["type"], "value": rng.choices(options, weights)[0], "state": "answered"}
        out.append(record)
    rng.shuffle(out)
    return out


def test_2000_random_intakes_match_the_restated_contract():
    rng = random.Random(2026)
    seen = {"RED_FLAG": 0, "CLARIFY": 0, "SAFE": 0}
    for _ in range(2000):
        given = random_intake(rng)
        result = evaluate(given)
        assert result["verdict"] == oracle(given), json.dumps(given)
        assert (result["verdict"] == "SAFE") == (result["firedRules"] == [])
        seen[result["verdict"]] += 1
    assert seen["RED_FLAG"] > 100 and seen["CLARIFY"] > 100 and seen["SAFE"] > 30, seen


@pytest.mark.parametrize("pair", list(itertools.combinations(SOLO_DANGER_IDS, 2)), ids="+".join)
def test_every_pair_of_danger_answers_is_red_flag_and_names_every_matching_rule(pair):
    changed = {q["questionId"]: q["dangerAnswers"][0] for q in REQUIRED if q["questionId"] in pair}
    given = answers(**changed)
    by_id = {a["questionId"]: a["value"] for a in given}
    expected = [r["ruleId"] for r in RULES if all(by_id.get(c["questionId"]) == c["equals"] and
                                                 type(by_id.get(c["questionId"])) is type(c["equals"]) for c in r["all"])]
    result = evaluate(given)
    assert result["verdict"] == "RED_FLAG"
    assert [r["ruleId"] for r in result["firedRules"]] == expected
    assert len(expected) >= 2


@pytest.mark.parametrize("pair", list(itertools.combinations(REQUIRED_IDS, 2)), ids="+".join)
def test_every_pair_of_not_sure_answers_is_never_safe(pair):
    first = evaluate(answers(unknown=pair))
    assert first["verdict"] == "CLARIFY"
    assert [r["ruleId"] for r in first["firedRules"]] == [f"U_{q}" for q in REQUIRED_IDS if q in pair]
    assert evaluate(answers(unknown=pair[:1], clarified=pair[1:]))["verdict"] == "CLARIFY", "contract v1.1"


def test_danger_answer_wins_over_missing_and_not_sure_together():
    result = evaluate(answers(unknown=["shape"], missing=["cancer", "redness"], fever=True))
    assert result["verdict"] == "RED_FLAG"
    assert [r["ruleId"] for r in result["firedRules"]] == ["R_fever", "U_shape", "M_cancer", "M_redness"]


def test_only_redness_has_no_danger_answer_of_its_own():
    assert [q["questionId"] for q in REQUIRED if not q["dangerAnswers"]] == ["redness"]


def test_red_or_warm_shoulder_is_a_red_flag_only_in_combination_and_never_clears_alone():
    """Contract v1.2: redness needs fever or an infection risk to fire, and makes infection risk a required answer."""

    def risk(value):
        return {"questionId": "infection_risk", "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}

    def ids(given):
        result = evaluate(given)
        return result["verdict"], [r["ruleId"] for r in result["firedRules"]]

    assert ids(answers(redness=True)) == ("CLARIFY", ["M_infection_risk"])
    assert ids(answers(redness=True) + [risk(None)]) == ("CLARIFY", ["U_infection_risk"])
    assert ids(answers(redness=True) + [risk(False)]) == ("SAFE", [])
    assert ids(answers(redness=True) + [risk(True)]) == ("RED_FLAG", ["R_local_infection_risk"])
    assert ids(answers(redness=True, fever=True)) == ("RED_FLAG", ["R_fever", "R_fever_joint", "M_infection_risk"])
    assert ids(answers(unknown=["redness"])) == ("CLARIFY", ["U_redness"])


def test_red_or_warm_shoulder_alone_is_still_flagged_for_the_doctor():
    """The gate lets it through, but the doctor-only ranking keeps joint infection in the top 3."""
    ranking = rank(answers(redness=True), movements("sideways_raise", "can_position_hold"))
    infection = item(ranking, "septic_arthritis")
    assert infection["flagged"] and infection["pinned"]
    assert position(ranking, "septic_arthritis") < PIN_TOP


def test_one_bad_record_among_good_ones_invalidates_the_whole_intake():
    given = answers(chest=True)
    given[5]["value"] = "false"
    assert [r["ruleId"] for r in evaluate(given)["firedRules"]] == ["INPUT_INVALID"]


# ---------------------------------------------------------------- narrowing: harder patterns


def test_mixed_pattern_returns_at_most_three_and_never_forces_one_muscle():
    output = narrow(movements("sideways_raise", "can_position_hold", "outward_push_elbow_at_side", "hand_behind_back"))
    assert 1 < len(output["candidates"]) <= 3
    assert [c["confidence"] for c in output["candidates"]] == sorted(
        (c["confidence"] for c in output["candidates"]), reverse=True
    )


def test_one_positive_movement_with_the_rest_not_sure_stays_low_confidence():
    output = narrow(movements("sideways_raise", unknown=["can_position_hold", "outward_push_elbow_at_side", "hand_behind_back"]))
    assert output["candidates"] == [] or output["candidates"][0]["confidence"] < 0.5


def test_not_sure_on_the_separating_movement_widens_the_result():
    clear = narrow(movements("outward_push_elbow_at_side"))
    unsure = narrow(movements("outward_push_elbow_at_side", unknown=["hand_behind_back", "can_position_hold"]))
    assert all(c["confidence"] < clear["candidates"][0]["confidence"] for c in unsure["candidates"])
    assert unsure["cluster"] is True


# ---------------------------------------------------------------- whole flow in code: gate, then narrowing, then ranking


def flow(given_answers, given_movements, region):
    gate = evaluate(given_answers)
    if gate["verdict"] != "SAFE":
        return gate, None, rank(given_answers, [], region)  # no movements once the gate stops the patient
    return gate, narrow(given_movements), rank(given_answers, given_movements, region)


def test_flow_safe_patient_reaches_narrowing_and_a_benign_ranking():
    gate, narrowed, ranking = flow(answers(), movements("sideways_raise", "can_position_hold"), "shoulder_right_front")
    assert gate == {"verdict": "SAFE", "firedRules": []}
    assert narrowed["candidates"][0]["muscleId"] == "supraspinatus"
    assert ids(ranking)[0] in BENIGN_IDS and not any(i["flagged"] for i in ranking)


def test_flow_danger_patient_stops_at_the_gate_and_the_doctor_still_sees_it_ranked():
    gate, narrowed, ranking = flow(answers(injury=True, unable=True), movements("sideways_raise"), "shoulder_right_top")
    assert gate["verdict"] == "RED_FLAG"
    assert {"R_injury", "R_unable", "R_injury_unable"} <= {r["ruleId"] for r in gate["firedRules"]}
    assert narrowed is None
    assert position(ranking, "fracture_or_dislocation") < PIN_TOP


def test_flow_not_sure_patient_is_held_at_the_gate_and_the_danger_stays_flagged():
    for given, verdict in ((answers(unknown=["chest"]), "CLARIFY"), (answers(clarified=["chest"]), "CLARIFY")):
        gate, narrowed, ranking = flow(given, movements("sideways_raise"), None)
        assert gate["verdict"] == verdict
        assert narrowed is None
        assert item(ranking, "cardiac_referral")["flagged"]


@pytest.mark.parametrize("qid", SOLO_DANGER_IDS)
def test_flow_no_single_danger_answer_ever_reaches_narrowing(qid):
    question = next(q for q in REQUIRED if q["questionId"] == qid)
    gate, narrowed, _ = flow(answers(**{qid: question["dangerAnswers"][0]}), movements("sideways_raise"), None)
    assert gate["verdict"] == "RED_FLAG" and narrowed is None
