"""PLACEHOLDER gate evaluator. Rules are draft, awaiting clinician review."""

import json
from pathlib import Path
from typing import Any

SHARED_DIR = Path(__file__).resolve().parents[2] / "shared"
PRIORITY = ["RED_FLAG", "CLARIFY", "SAFE"]


def load_rules() -> dict[str, Any]:
    with open(SHARED_DIR / "gate_rules.json", encoding="utf-8") as f:
        return json.load(f)


def evaluate(answers: list[dict[str, Any]]) -> dict[str, Any]:
    gate = load_rules()
    fired = []
    verdicts = []
    for rule in gate["rules"]:
        when = rule["when"]
        matched = [
            a
            for a in answers
            if a["questionId"] == rule["questionId"]
            and a["state"] == when["state"]
            and ("value" not in when or a["value"] == when["value"])
        ]
        if matched:
            fired.append(
                {
                    "ruleId": rule["ruleId"],
                    "matchedAnswers": [a["questionId"] for a in matched],
                    "source": rule["source"],
                }
            )
            verdicts.append(rule["verdict"])
    verdict = next((v for v in PRIORITY if v in verdicts), gate["defaultVerdict"])
    return {"verdict": verdict, "firedRules": fired}
