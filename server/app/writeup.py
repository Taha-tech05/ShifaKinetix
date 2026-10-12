"""Doctor-facing write-up of an already-ranked list. Draft, awaiting clinician review.

The language model only explains. It is asked for one explanation per
condition id; code then lays those out in the order the ranking code chose.
A condition the model invents is discarded, one it leaves out gets a template
sentence, and the order cannot change because the model never supplies it.
Doctor-only: nothing here is shown to a patient.
"""

import json
from collections.abc import Callable
from typing import Any

from app import llm as groq_llm
from app.text_filter import contains_medication

LABEL = "draft, awaiting clinician review"

SYSTEM = (
    "You write short explanations for a doctor reviewing a draft shoulder differential. "
    "The list is already ranked by code. Do not reorder it, add conditions or remove conditions. "
    "Use only the facts given. Do not name medicines or doses and do not state a definite diagnosis. "
    "If more than one candidate muscle is given, say what would differ for each in muscleNote. "
    'Reply with JSON only: {"explanations": {"<conditionId>": "<one or two sentences>"}, "muscleNote": "<text>"}'
)

LLM = Callable[[str, str], str]


def template_explanation(item: dict[str, Any]) -> str:
    """Explanation built by code from the ranking's own provenance."""

    def facts(name):
        return ", ".join(item[name]) or "none"

    flag = " Flagged as a dangerous condition to rule out." if item["flagged"] else ""
    return (
        f"{item['name']}: {item['uncertainty']}. Supporting: {facts('matchedFacts')}. "
        f"Against: {facts('contradictedFacts')}. Unknown: {facts('unknownFacts')}.{flag}"
    )


def template_muscle_note(narrowing: dict[str, Any] | None) -> str:
    candidates = (narrowing or {}).get("candidates") or []
    if not candidates:
        return "Movement testing did not point to a specific muscle."
    if len(candidates) == 1:
        return f"Movement testing points to {candidates[0]['muscleId']} ({candidates[0]['reason']})"
    branches = "; ".join(f"if {c['muscleId']}: confidence {c['confidence']}, {c['reason']}" for c in candidates)
    return f"Movement testing could not settle on one muscle: {branches}"


def _acceptable(text: Any) -> bool:
    return isinstance(text, str) and bool(text.strip()) and not contains_medication(text) and "validated" not in text.lower()


def write_doctor_summary(
    ranking: list[dict[str, Any]],
    narrowing: dict[str, Any] | None = None,
    llm: LLM | None = None,
) -> dict[str, Any]:
    """Explain the ranking. The order and membership of items always equal the ranking's."""
    if llm is None and groq_llm.available():
        def llm(system, user):
            return groq_llm.chat(system, user, json_mode=True)

    explanations: dict[str, Any] = {}
    muscle_note: Any = None
    model_error = None
    if llm is not None:
        facts = ("conditionId", "name", "flagged", "score", "matchedFacts", "contradictedFacts", "unknownFacts", "uncertainty")
        request = {"ranking": [{k: item[k] for k in facts} for item in ranking], "narrowing": narrowing}
        try:
            reply = json.loads(llm(SYSTEM, json.dumps(request)))
            if isinstance(reply, dict) and isinstance(reply.get("explanations"), dict):
                explanations = reply["explanations"]
                muscle_note = reply.get("muscleNote")
            else:
                model_error = "reply was not in the requested shape"
        except Exception as error:  # noqa: BLE001 - any model failure falls back to the template
            model_error = f"{type(error).__name__}: {error}"

    known = [item["conditionId"] for item in ranking]
    items, replaced = [], []
    for position, item in enumerate(ranking, start=1):
        text = explanations.get(item["conditionId"])
        if not _acceptable(text):
            replaced.append(item["conditionId"])
            text = template_explanation(item)
        items.append({"rank": position, "conditionId": item["conditionId"], "explanation": text.strip()})

    return {
        "label": LABEL,
        "generatedBy": "template" if len(replaced) == len(ranking) else "llm" if not replaced else "mixed",
        "items": items,
        "muscleNote": muscle_note.strip() if _acceptable(muscle_note) else template_muscle_note(narrowing),
        "replacedWithTemplate": replaced,
        "discardedFromModel": sorted(str(key) for key in explanations if key not in known),
        "modelError": model_error,
    }
