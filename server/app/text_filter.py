"""Patient-facing text filter. Draft, awaiting clinician review.

Runs on every string a patient can see. A string containing a drug name, a
dose, a definite diagnosis or "injured"-style wording is replaced by a fixed
fallback sentence and the event is logged. Deterministic code: no LLM decides
what a patient may read.
"""

import logging
import re
from typing import Any

logger = logging.getLogger("shifakinetix.text_filter")

DRUGS = (
    "ibuprofen|diclofenac|naproxen|paracetamol|acetaminophen|aspirin|tramadol|codeine|morphine|"
    "prednisolone|prednisone|methylprednisolone|dexamethasone|cortisone|celecoxib|ketorolac|"
    "meloxicam|piroxicam|mefenamic acid|gabapentin|pregabalin|orphenadrine|tizanidine|"
    # brand names commonly sold in Pakistan (extend with the clinician reviewer)
    "panadol|brufen|voltral|voltaren|ponstan|disprin|calpol|arcoxia|synflex"
)
DIAGNOSES = (
    "fracture[sd]?|dislocat\\w+|septic|arthritis|impingement|frozen shoulder|capsulitis|bursitis|"
    "tendinitis|tendonitis|tendinopathy|radiculopathy|heart attack|angina|infection"
)

BLOCK: dict[str, re.Pattern[str]] = {
    "dose": re.compile(r"\b\d+(\.\d+)?\s?(mg|mcg|g|ml|iu|milligrams?|tablets?|capsules?|pills?)\b", re.IGNORECASE),
    "drug": re.compile(rf"\b({DRUGS})\b", re.IGNORECASE),
    "definite_diagnosis": re.compile(
        r"\b(you have|you've got|you are suffering from|your diagnosis is|you definitely|"
        r"you are diagnosed|diagnosed with|this is definitely|it is definitely)\b",
        re.IGNORECASE,
    ),
    "condition_name": re.compile(rf"\b({DIAGNOSES})\b", re.IGNORECASE),
    "injury_wording": re.compile(r"\b(injured|torn|tear|ruptured?|damaged)\b", re.IGNORECASE),
}

FALLBACK = "We could not show this message. Please talk to a doctor about your shoulder."


def blocked_reasons(text: str) -> list[str]:
    """Names of every block pattern the text matches. Empty means the text is allowed."""
    return [name for name, pattern in BLOCK.items() if pattern.search(text)]


def contains_medication(text: str) -> bool:
    return bool(BLOCK["dose"].search(text) or BLOCK["drug"].search(text))


def safe_patient_text(text: Any, fallback: str = FALLBACK) -> str:
    """Return the text if a patient may see it, otherwise the fallback."""
    if not isinstance(text, str):
        logger.warning("blocked patient text: not a string")
        return fallback
    reasons = blocked_reasons(text)
    if reasons:
        logger.warning("blocked patient text: %s", ", ".join(reasons))
        return fallback
    return text


def safe_patient_payload(payload: Any, fallback: str = FALLBACK) -> Any:
    """Apply the filter to every string inside a patient-facing dict or list."""
    if isinstance(payload, str):
        return safe_patient_text(payload, fallback)
    if isinstance(payload, list):
        return [safe_patient_payload(item, fallback) for item in payload]
    if isinstance(payload, dict):
        return {key: safe_patient_payload(value, fallback) for key, value in payload.items()}
    return payload
