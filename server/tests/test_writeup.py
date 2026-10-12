"""Write-up tests: the model explains, it never ranks. Made-up cases only."""

import json

import pytest

from app import llm as groq_llm
from app.gate import QUESTIONS
from app.narrowing import MOVEMENTS, narrow
from app.ranking import rank
from app.writeup import LABEL, template_explanation, write_doctor_summary

REQUIRED = [q for q in QUESTIONS if q["required"]]


def answers(**changed):
    return [
        {"questionId": q["questionId"], "type": q["type"], "state": "answered",
         "value": changed.get(q["questionId"], False if q["type"] == "yesno" else "normal")}
        for q in REQUIRED
    ]


def movements(*positive):
    return [{"movementId": m, "painful": m in positive, "weak": False, "unableToDo": False,
             "measuredAngle": None, "state": "answered"} for m in MOVEMENTS]


RANKING = rank(answers(injury=True), movements("sideways_raise", "can_position_hold"), "shoulder_right_top")
ORDER = [item["conditionId"] for item in RANKING]
NARROWING = narrow(movements("sideways_raise", "can_position_hold"))
CLUSTER = narrow(movements("outward_push_elbow_at_side"))


def model(explanations, muscle_note="Movement testing points to one muscle."):
    seen = []

    def llm(system, user):
        seen.append((system, json.loads(user)))
        return json.dumps({"explanations": explanations, "muscleNote": muscle_note})

    llm.seen = seen
    return llm


def order_of(summary):
    return [item["conditionId"] for item in summary["items"]]


def test_honest_model_output_is_used_in_the_code_order():
    llm = model({cid: f"Explanation for {cid}." for cid in ORDER})
    summary = write_doctor_summary(RANKING, NARROWING, llm)
    assert order_of(summary) == ORDER
    assert [item["rank"] for item in summary["items"]] == list(range(1, len(ORDER) + 1))
    assert summary["items"][0]["explanation"] == f"Explanation for {ORDER[0]}."
    assert summary["generatedBy"] == "llm" and summary["label"] == LABEL
    assert summary["replacedWithTemplate"] == [] and summary["discardedFromModel"] == []


def test_model_cannot_reorder():
    llm = model({cid: f"Explanation for {cid}." for cid in reversed(ORDER)})
    assert order_of(write_doctor_summary(RANKING, NARROWING, llm)) == ORDER


def test_model_cannot_add_a_condition():
    explanations = {cid: "Fine." for cid in ORDER} | {"gout": "Very likely gout.", "lung_cancer": "Consider this."}
    summary = write_doctor_summary(RANKING, NARROWING, model(explanations))
    assert order_of(summary) == ORDER
    assert summary["discardedFromModel"] == ["gout", "lung_cancer"]
    assert "gout" not in json.dumps(summary["items"])


def test_model_cannot_remove_a_condition():
    dropped = "fracture_or_dislocation"
    summary = write_doctor_summary(RANKING, NARROWING, model({cid: "Fine." for cid in ORDER if cid != dropped}))
    assert order_of(summary) == ORDER
    assert summary["replacedWithTemplate"] == [dropped] and summary["generatedBy"] == "mixed"
    kept = next(i for i in summary["items"] if i["conditionId"] == dropped)
    assert kept["explanation"] == template_explanation(next(r for r in RANKING if r["conditionId"] == dropped))
    assert "Flagged as a dangerous condition" in kept["explanation"]


@pytest.mark.parametrize(
    "bad_text",
    ["Start ibuprofen 400 mg three times a day.", "Give tramadol.", "This is doctor-validated.", "", "   ", None, 7, ["x"]],
    ids=["dose", "drug", "claims-validation", "empty", "blank", "null", "number", "list"],
)
def test_unacceptable_explanation_is_replaced_by_the_template(bad_text):
    explanations = {cid: "Fine." for cid in ORDER} | {ORDER[0]: bad_text}
    summary = write_doctor_summary(RANKING, NARROWING, model(explanations))
    assert summary["replacedWithTemplate"] == [ORDER[0]]
    assert summary["items"][0]["explanation"] == template_explanation(RANKING[0])


@pytest.mark.parametrize(
    "reply",
    ["not json at all", "[]", '{"explanations": "none"}', '{"something": "else"}', ""],
    ids=["not-json", "list", "wrong-type", "wrong-keys", "empty"],
)
def test_garbled_model_reply_falls_back_to_the_template(reply):
    summary = write_doctor_summary(RANKING, NARROWING, lambda system, user: reply)
    assert order_of(summary) == ORDER
    assert summary["generatedBy"] == "template" and summary["modelError"]
    assert [i["explanation"] for i in summary["items"]] == [template_explanation(r) for r in RANKING]


def test_model_failure_falls_back_to_the_template():
    def broken(system, user):
        raise TimeoutError("no network")

    summary = write_doctor_summary(RANKING, NARROWING, broken)
    assert summary["generatedBy"] == "template" and "TimeoutError" in summary["modelError"]
    assert order_of(summary) == ORDER


def test_no_api_key_means_no_model_call(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr(groq_llm, "chat", lambda *a, **k: pytest.fail("the model must not be called"))
    summary = write_doctor_summary(RANKING, NARROWING)
    assert summary["generatedBy"] == "template" and summary["modelError"] is None


def test_model_is_sent_the_ranked_list_and_told_not_to_change_it():
    llm = model({cid: "Fine." for cid in ORDER})
    write_doctor_summary(RANKING, NARROWING, llm)
    system, request = llm.seen[0]
    assert [r["conditionId"] for r in request["ranking"]] == ORDER
    assert request["narrowing"] == NARROWING
    assert "Do not reorder" in system and "medicines" in system


def test_branching_note_when_more_than_one_muscle_is_possible():
    summary = write_doctor_summary(RANKING, CLUSTER, model({cid: "Fine." for cid in ORDER}, muscle_note=None))
    assert "if infraspinatus:" in summary["muscleNote"] and "if teres_minor:" in summary["muscleNote"]
    single = write_doctor_summary(RANKING, NARROWING)
    assert "supraspinatus" in single["muscleNote"] and "if " not in single["muscleNote"]
    assert "did not point" in write_doctor_summary(RANKING, {"candidates": [], "cluster": False})["muscleNote"]


def test_muscle_note_with_a_medicine_in_it_is_replaced():
    summary = write_doctor_summary(RANKING, CLUSTER, model({cid: "Fine." for cid in ORDER}, "Inject cortisone 40 mg."))
    assert "cortisone" not in summary["muscleNote"] and "if infraspinatus:" in summary["muscleNote"]


def test_template_explanation_states_the_facts_and_never_claims_validation():
    for item in RANKING:
        text = template_explanation(item)
        assert item["name"] in text and item["uncertainty"] in text
        assert "validated" not in text.lower()


def test_ranking_passed_in_is_not_changed():
    before = json.dumps(RANKING)
    write_doctor_summary(RANKING, NARROWING, model({cid: "x" for cid in reversed(ORDER)}))
    assert json.dumps(RANKING) == before
