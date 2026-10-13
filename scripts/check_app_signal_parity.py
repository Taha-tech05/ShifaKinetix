"""Cross-language contract test for live app signals (docs/safety-integration.md).

Runs the raw fixtures in shared/app_signal_test_cases.json through the mobile
pipeline (gateInputs, sessionEvaluator, sessionAdapter) and through
server/app/session_gate.py. Both must give the expected verdict and rule ids,
and their complete outputs must be identical.

The mobile side marks a follow-up as answered with a review fingerprint; the
server takes the list of answered follow-ups from its own history. The
fixtures name the answered follow-ups, and each side represents them its way.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))
from app.session_gate import evaluate_session_gate  # noqa: E402


def main():
    cases = json.loads((ROOT / "shared/app_signal_test_cases.json").read_text(encoding="utf-8"))["cases"]
    result = subprocess.run(
        ["node", str(ROOT / "mobile/scripts/export-session-gate.cjs")],
        check=True, capture_output=True, text=True,
    )
    mobile = {item["caseId"]: item["output"] for item in json.loads(result.stdout)}
    failures = []
    for case in cases:
        server = evaluate_session_gate(case["answers"], case["movements"], case["reviewed"])
        for name, output in (("TypeScript", mobile[case["caseId"]]), ("Python", server)):
            if output["verdict"] != case["expectedVerdict"]:
                failures.append(f"{case['caseId']}: {name} verdict {output['verdict']}, expected {case['expectedVerdict']}")
            if [rule["ruleId"] for rule in output["firedRules"]] != case["expectedRuleIds"]:
                failures.append(f"{case['caseId']}: {name} rule ids differ from expected")
        if server != mobile[case["caseId"]]:
            failures.append(f"{case['caseId']}: Python/TypeScript complete outputs differ")
    if failures:
        print("App-signal parity FAILED.")
        print("\n".join(failures[:12]))
        print(f"{len(failures)} discrepancies across {len(cases)} cases.")
        return 1
    print(f"App-signal parity passed: {len(cases)} complete outputs match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
