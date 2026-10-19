"""Harder cases across the gate, narrowing and ranking. Made-up cases only, not patient data.

Covers combined dangers, mixed "not sure" answers, partial and conflicting
evidence, and sweeps over every combination of the key inputs.
"""

import itertools
import json
import random

import pytest
from safety_answers import REQUIRED, REQUIRED_IDS, answers

from app.conditions import CONDITIONS
from app.gate import QUESTIONS, RULES, THRESHOLDS, evaluate, is_asked_question
from app.narrowing import MOVEMENTS, MUSCLES, narrow
from app.ranking import DANGER_BOOST, rank

# Questions where one answer alone is a hard stop (contract v2): its dangerAnswers.
SOLO_DANGER = [q for q in QUESTIONS if q["dangerAnswers"]]
SOLO_DANGER_IDS = [q["questionId"] for q in SOLO_DANGER]
MOVEMENT_IDS = list(MOVEMENTS)
DANGER_IDS = {c["id"] for c in CONDITIONS if c["danger"]}
PIN_TOP = len(DANGER_IDS)  # at most this many conditions can be pinned
BENIGN_IDS = {c["id"] for c in CONDITIONS if not c["danger"]}
# Defining question -> the dangerous condition it belongs to.
DEFINING = {f["q"]: c["id"] for c in CONDITIONS for f in c["features"] if f.get("defining")}
DEFINING_VALUE = {f["q"]: f["expect"] for c in CONDITIONS for f in c["features"] if f.get("defining")}


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
    ranking = rank(answers(onset="injury", shape=True, fever=True, redness=True, temperature="hot"))
    assert {"fracture_or_dislocation", "septic_arthritis"} <= set(ids(ranking)[:3])
    assert item(ranking, "fracture_or_dislocation")["flagged"]
    assert item(ranking, "septic_arthritis")["flagged"]


def test_three_dangers_at_once_fill_the_top_3():
    ranking = rank(answers(chest=True, onset="injury", fever=True), movements("sideways_raise", "can_position_hold"))
    assert set(ids(ranking)[:3]) == DANGER_IDS
    assert all(i["pinned"] for i in ranking[:3])


def test_danger_sign_is_not_buried_under_a_perfect_benign_pattern():
    ranking = rank(answers(chest=True), movements("sideways_raise", "can_position_hold"), "shoulder_right_front")
    impingement, cardiac = item(ranking, "subacromial_impingement"), item(ranking, "cardiac_referral")
    assert impingement["baseScore"] == 1.0
    assert cardiac["flagged"] and cardiac["pinned"]
    assert position(ranking, "cardiac_referral") < PIN_TOP


def test_fracture_and_ac_joint_overlap_after_a_fall_onto_the_shoulder():
    ranking = rank(answers(onset="injury", shape=True), movements("sideways_raise"), "shoulder_left_top")
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
    assert rank(answers(missing=["chest"])) == rank(answers(unknown=["chest"]))


def test_a_topic_denied_by_its_opening_question_counts_as_no_not_unknown():
    denied = item(rank(answers()), "septic_arthritis")
    assert "fever=false" in denied["contradictedFacts"] and not denied["flagged"]
    assert rank(answers()) == rank(answers(fever=False, redness=False, temperature="normal", swelling="none", infection_risk=False))


def test_one_danger_confirmed_and_another_not_sure():
    ranking = rank(answers(unknown=["chest", "breathing"], onset="injury", shape=True))
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
    ranking = rank(answers(tingling="comes_goes", numb=True), movements("sideways_raise", "can_position_hold"))
    assert position(ranking, "neck_nerve_referral") < 4
    assert ids(ranking)[0] in {"rotator_cuff_related_pain", "subacromial_impingement"}


def test_context_answers_that_are_not_features_do_not_change_the_ranking():
    extra = [
        {"questionId": "duration", "type": "duration", "value": 400, "state": "answered"},
        {"questionId": "side", "type": "choice", "value": "both", "state": "answered"},
    ]
    assert rank(answers(pain_score=9) + extra, movements("hand_behind_back")) == rank(answers(), movements("hand_behind_back"))


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
    given_answers = answers(unknown=["chest"], onset="injury", temperature="hot")
    given_movements = movements("sideways_raise", "hand_behind_back", unknown=["can_position_hold"])
    expected = (evaluate(given_answers), narrow(given_movements), rank(given_answers, given_movements))
    for _ in range(20):
        a, m = given_answers[:], given_movements[:]
        rng.shuffle(a)
        rng.shuffle(m)
        assert (evaluate(a), narrow(m), rank(a, m)) == expected


# ---------------------------------------------------------------- gate: combinations checked against a second, simpler statement of the contract


# Points restated by hand from docs/gate-contract.md (draft weighting), independent of the rule file's layout.
POINTS = {("onset", "injury"): 2, ("onset", "sudden"): 2, ("temperature", "hot"): 2, ("fever", True): 2,
          ("bilateral", True): 2, ("systemic", True): 2, ("cancer", True): 2, ("redness", True): 1,
          ("tingling", "comes_goes"): 1, ("swelling", "mild"): 1}
EMERGENCY = {("chest", True), ("breathing", True)}
URGENT = {("unable", True), ("shape", True), ("numb", True), ("tingling", "persistent"), ("temperature", "cold"), ("swelling", "severe")}
WEIGHTED_HALF = {"onset": 1, "pain_score": 1, "fever": 1, "bilateral": 1, "systemic": 1, "cancer": 1, "redness": 0.5}


def oracle(given):
    """The contract restated without the rule file: (verdict, level, score), used to cross-check evaluate()."""
    by_id = {a["questionId"]: a for a in given}
    said = {qid: a["value"] for qid, a in by_id.items() if a["state"] == "answered"}
    pairs = {(qid, value) for qid, value in said.items() if isinstance(value, (str, bool))}
    score = sum(points for key, points in POINTS.items() if key in pairs)
    pain = said.get("pain_score")
    score += 2 if pain is not None and pain >= 8 else 1 if pain is not None and pain >= 6 else 0
    score += sum(half for qid, half in WEIGHTED_HALF.items() if qid in by_id and by_id[qid]["state"] == "unknown")
    emergency = bool(pairs & EMERGENCY)
    urgent = bool(pairs & URGENT) or (said.get("redness") is True and (said.get("fever") is True or said.get("infection_risk") is True))
    asked = [q for q in QUESTIONS if is_asked_question(q, given)]
    # still not sure after the simpler question: one may stay open (then at least SOON), never chest or breathing
    unresolved = [q["questionId"] for q in asked if q["tier"] == "hardStop" and q["questionId"] in by_id
                  and by_id[q["questionId"]]["state"] == "unknown" and by_id[q["questionId"]].get("clarificationAttempted") is True]
    tolerated = len(unresolved) <= 1 and not set(unresolved) & {"chest", "breathing"}
    incomplete = any(
        q["questionId"] not in by_id
        or (by_id[q["questionId"]]["state"] == "unknown" and q["tier"] == "hardStop"
            and not (tolerated and q["questionId"] in unresolved))
        for q in asked
    )
    if emergency:
        return "RED_FLAG", "EMERGENCY", score
    if urgent or score >= THRESHOLDS["URGENT"]:
        return "RED_FLAG", "URGENT", score
    if incomplete:
        return "CLARIFY", None, score
    return "SAFE", "SOON" if score >= THRESHOLDS["SOON"] or (tolerated and unresolved) else "ROUTINE", score


def random_intake(rng):
    out = []
    for q in QUESTIONS:
        roll = rng.random()
        qid = q["questionId"]
        if roll < 0.12:
            continue
        if roll < 0.20:
            record = {"questionId": qid, "type": q["type"], "value": None, "state": "unknown"}
            if rng.random() < 0.4:
                record["clarificationAttempted"] = rng.random() < 0.7
        else:
            if q["type"] == "yesno":
                options = [True, False]
            elif q["type"] == "choice":
                options = [o["value"] for o in q["options"]]
            else:
                options = [0, 3, 6, 8, 10] if q["type"] == "number" else [1, 30]
            weights = [1 if v in q["dangerAnswers"] or v is True else 8 for v in options]
            record = {"questionId": qid, "type": q["type"], "value": rng.choices(options, weights)[0], "state": "answered"}
        out.append(record)
    rng.shuffle(out)
    return out


def test_3000_random_intakes_match_the_restated_contract():
    rng = random.Random(2026)
    seen = {"RED_FLAG": 0, "CLARIFY": 0, "SAFE": 0}
    for _ in range(3000):
        given = random_intake(rng)
        result = evaluate(given)
        assert (result["verdict"], result["level"], result["score"]) == oracle(given), json.dumps(given)
        if result["verdict"] == "SAFE":
            assert all("points" in r for r in result["firedRules"])
        seen[result["verdict"]] += 1
    assert seen["RED_FLAG"] > 100 and seen["CLARIFY"] > 100 and seen["SAFE"] > 30, seen


@pytest.mark.parametrize("pair", list(itertools.combinations(SOLO_DANGER_IDS, 2)), ids="+".join)
def test_every_pair_of_hard_stop_answers_is_red_flag_and_names_every_matching_hard_stop(pair):
    changed = {q["questionId"]: q["dangerAnswers"][0] for q in SOLO_DANGER if q["questionId"] in pair}
    result = evaluate(answers(**changed))
    assert result["verdict"] == "RED_FLAG"
    assert result["level"] == ("EMERGENCY" if {"chest", "breathing"} & set(pair) else "URGENT")
    hard = [r["ruleId"] for r in result["firedRules"] if "level" in r]
    expected = [r["ruleId"] for r in RULES if "level" in r and len(r["all"]) == 1 and r["all"][0]["questionId"] in pair]
    assert hard == expected and len(expected) == 2


@pytest.mark.parametrize("pair", list(itertools.combinations(REQUIRED_IDS, 2)), ids="+".join)
def test_every_pair_of_not_sure_answers_is_never_safe(pair):
    for given in (answers(unknown=pair), answers(unknown=pair[:1], clarified=pair[1:])):
        result = evaluate(given)
        assert result["verdict"] == "CLARIFY"
        # in the second set the clarified pair[1] may stay unresolved, unless it is chest or breathing
        clarified = any(a.get("clarificationAttempted") for a in given)
        settled = pair[1] if clarified and pair[1] not in ("chest", "breathing") else None
        hard_stops = [q["questionId"] for q in REQUIRED if q["questionId"] in pair and q["tier"] == "hardStop" and q["questionId"] != settled]
        assert [r["ruleId"] for r in result["firedRules"] if r["ruleId"].startswith("U_")] == [f"U_{q}" for q in hard_stops]


def test_danger_answer_wins_over_missing_and_not_sure_together():
    result = evaluate(answers(unknown=["unable"], missing=["illness", "sensation"], onset="injury", shape=False, pain_score=9, bilateral=False))
    assert (result["verdict"], result["level"]) == ("RED_FLAG", "URGENT")
    assert [r["ruleId"] for r in result["firedRules"]] == ["P_onset_injury", "P_pain_very_bad", "U_unable", "M_sensation", "M_illness"]


def test_only_opening_and_weighted_questions_have_no_danger_answer_of_their_own():
    assert [q["questionId"] for q in REQUIRED if not q["dangerAnswers"]] == ["onset", "sensation", "inflammation", "illness", "pain_score"]


def test_red_shoulder_is_urgent_only_in_combination_and_never_clears_without_infection_risk():
    """Contract v2: redness adds a point, asks infection risk, and is urgent with fever or an infection risk."""

    def risk(value):
        return {"questionId": "infection_risk", "type": "yesno", "value": value, "state": "unknown" if value is None else "answered"}

    def ids(given):
        result = evaluate(given)
        return result["verdict"], [r["ruleId"] for r in result["firedRules"]]

    base = {"inflammation": True, "temperature": "normal", "swelling": "none", "fever": False}
    assert ids(answers(redness=True, **base)) == ("CLARIFY", ["P_redness", "M_infection_risk"])
    assert ids(answers(redness=True, **base) + [risk(None)]) == ("CLARIFY", ["P_redness", "U_infection_risk"])
    assert ids(answers(redness=True, **base) + [risk(False)]) == ("SAFE", ["P_redness"])
    assert ids(answers(redness=True, **base) + [risk(True)]) == ("RED_FLAG", ["H_infection_risk_redness", "P_redness"])
    assert ids(answers(redness=True, **{**base, "fever": True})) == ("RED_FLAG", ["H_fever_redness", "P_fever", "P_redness", "M_infection_risk"])
    assert ids(answers(unknown=["redness"], **base)) == ("CLARIFY", ["W_redness", "M_infection_risk"])


def test_red_shoulder_alone_is_still_flagged_for_the_doctor():
    """The gate lets it through, but the doctor-only ranking keeps joint infection in the top 3."""
    ranking = rank(answers(inflammation=True, redness=True, infection_risk=False), movements("sideways_raise", "can_position_hold"))
    infection = item(ranking, "septic_arthritis")
    assert infection["flagged"] and infection["pinned"]
    assert position(ranking, "septic_arthritis") < PIN_TOP


def test_one_bad_record_among_good_ones_invalidates_the_whole_intake():
    given = answers(chest=True)
    given[3]["value"] = "false"
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
    assert gate == {"verdict": "SAFE", "level": "ROUTINE", "score": 0, "firedRules": []}
    assert narrowed["candidates"][0]["muscleId"] == "supraspinatus"
    assert ids(ranking)[0] in BENIGN_IDS and not any(i["flagged"] for i in ranking)


def test_flow_danger_patient_stops_at_the_gate_and_the_doctor_still_sees_it_ranked():
    gate, narrowed, ranking = flow(answers(onset="injury", unable=True), movements("sideways_raise"), "shoulder_right_top")
    assert gate["verdict"] == "RED_FLAG"
    assert {"H_unable", "P_onset_injury"} <= {r["ruleId"] for r in gate["firedRules"]}
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
    question = next(q for q in SOLO_DANGER if q["questionId"] == qid)
    gate, narrowed, _ = flow(answers(**{qid: question["dangerAnswers"][0]}), movements("sideways_raise"), None)
    assert gate["verdict"] == "RED_FLAG" and narrowed is None
