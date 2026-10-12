"""Report builder. Draft, awaiting clinician review.

Two separate reports are built from one case. The patient report never
contains the ranking, a condition name or a score. The doctor report carries
the ranked differential and its write-up, and is returned to doctor accounts
only (enforced by the API).
"""

from typing import Any

from app.text_filter import safe_patient_payload
from app.writeup import LABEL, LLM, write_doctor_summary

BANNER = "Demo only, not for real patients."
GUIDANCE = (
    "These are muscles that may be involved, based on the movements you tried. "
    "This is not a diagnosis. Move only as far as comfortable. Stop if pain is sharp or severe."
)
NO_MUSCLES = "The movements did not point to a specific muscle. This is not a diagnosis."
REFERRAL = "Please talk to a doctor about your shoulder before trying any movements."


def build_patient_report(narrowing: dict[str, Any]) -> dict[str, Any]:
    candidates = narrowing["candidates"]
    report = {
        "banner": BANNER,
        "musclesThatMayBeInvolved": [c["muscleId"] for c in candidates],
        "cluster": narrowing["cluster"],
        "guidance": GUIDANCE if candidates else NO_MUSCLES,
        "talkToDoctor": True,
    }
    return safe_patient_payload(report)


def build_doctor_report(
    ranking: list[dict[str, Any]], narrowing: dict[str, Any], llm: LLM | None = None
) -> dict[str, Any]:
    return {
        "banner": BANNER,
        "label": LABEL,
        "narrowing": narrowing,
        "differential": ranking,
        "writeUp": write_doctor_summary(ranking, narrowing, llm),
    }
