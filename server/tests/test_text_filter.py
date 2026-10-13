import logging

import pytest

from app.agent import MOVE_SAFELY
from app.report import BANNER, GUIDANCE, NO_MUSCLES, REFERRAL
from app.text_filter import (
    FALLBACK,
    blocked_reasons,
    contains_medication,
    safe_patient_payload,
    safe_patient_text,
)

BLOCKED = {
    "drug-name": "Take ibuprofen after food.",
    "drug-uppercase": "DICLOFENAC gel may help.",
    "drug-brand": "A Panadol tablet is fine.",
    "drug-brand-2": "Try Brufen tonight.",
    "dose-mg": "Use 400 mg twice a day.",
    "dose-no-space": "Use 400mg twice a day.",
    "dose-decimal": "Apply 2.5 ml to the area.",
    "dose-tablets": "Take 2 tablets every morning.",
    "dose-iu": "About 1000 IU daily.",
    "definite-you-have": "You have rotator cuff tear.",
    "definite-suffering": "You are suffering from a shoulder problem.",
    "definite-diagnosis-is": "Your diagnosis is clear.",
    "definite-definitely": "You definitely need rest.",
    "definite-diagnosed": "You were diagnosed with a problem.",
    "condition-frozen": "This looks like frozen shoulder.",
    "condition-fracture": "It may be a fracture.",
    "condition-infection": "There could be an infection in the joint.",
    "condition-impingement": "Signs of impingement were found.",
    "condition-heart": "This might be a heart attack.",
    "wording-injured": "Your supraspinatus is injured.",
    "wording-torn": "The muscle may be torn.",
    "several-at-once": "You have a fracture, take 500 mg paracetamol.",
    "hidden-in-long-text": "Rest the arm, keep it warm, and when it is sore take naproxen with water before bed.",
}

ALLOWED = [
    "These are muscles that may be involved.",
    "Move only as far as comfortable. Stop if pain is sharp or severe.",
    "Please talk to a doctor about your shoulder.",
    "supraspinatus",
    "You answered 16 questions.",
    "The pain started 3 days ago.",
    "This is not a diagnosis.",
    "",
]


@pytest.mark.parametrize("text", BLOCKED.values(), ids=BLOCKED.keys())
def test_blocked_text_is_replaced(text):
    assert blocked_reasons(text)
    assert safe_patient_text(text) == FALLBACK
    assert safe_patient_text(text, "custom fallback") == "custom fallback"


def test_the_three_cases_named_in_the_guide():
    for text in ("Take ibuprofen.", "Take 400 mg.", "you have rotator cuff tear"):
        assert safe_patient_text(text) == FALLBACK


@pytest.mark.parametrize("text", ALLOWED)
def test_ordinary_text_passes_unchanged(text):
    assert blocked_reasons(text) == []
    assert safe_patient_text(text) == text


@pytest.mark.parametrize("template", [FALLBACK, BANNER, GUIDANCE, NO_MUSCLES, REFERRAL, MOVE_SAFELY])
def test_our_own_fixed_sentences_pass_the_filter(template):
    assert safe_patient_text(template) == template


def test_reasons_name_what_was_found():
    assert blocked_reasons("You have a fracture, take 500 mg paracetamol.") == [
        "dose", "drug", "definite_diagnosis", "condition_name",
    ]


def test_every_blocked_string_is_logged(caplog):
    with caplog.at_level(logging.WARNING, logger="shifakinetix.text_filter"):
        safe_patient_text("Take ibuprofen 400 mg.")
        safe_patient_text("Move only as far as comfortable.")
    assert [record.getMessage() for record in caplog.records] == ["blocked patient text: dose, drug"]


def test_log_does_not_repeat_the_blocked_text(caplog):
    with caplog.at_level(logging.WARNING, logger="shifakinetix.text_filter"):
        safe_patient_text("You have a fracture.")
    assert "fracture." not in caplog.text


@pytest.mark.parametrize("value", [None, 42, ["ibuprofen"], {"text": "hello"}])
def test_anything_that_is_not_a_string_is_replaced(value):
    assert safe_patient_text(value) == FALLBACK


def test_payload_filter_reaches_every_nested_string():
    payload = {
        "guidance": "Take ibuprofen.",
        "muscles": ["supraspinatus", "it is torn"],
        "nested": {"note": "You have a fracture.", "ok": "Talk to a doctor.", "count": 3, "flag": True, "none": None},
    }
    assert safe_patient_payload(payload) == {
        "guidance": FALLBACK,
        "muscles": ["supraspinatus", FALLBACK],
        "nested": {"note": FALLBACK, "ok": "Talk to a doctor.", "count": 3, "flag": True, "none": None},
    }


def test_medication_check_used_for_doctor_text():
    assert contains_medication("consider 50 mg") and contains_medication("tramadol")
    assert not contains_medication("Possible fracture: 3 of 5 features confirmed.")
