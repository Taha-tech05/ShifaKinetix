"""A-owned cross-language contract test; C owns server/app/gate.py."""

import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))
from app.gate import evaluate  # noqa: E402


def main():
    cases = json.loads((ROOT / "shared/gate_test_cases.json").read_text(encoding="utf-8"))["cases"]
    result = subprocess.run(
        ["node", str(ROOT / "mobile/scripts/export-gate.cjs")],
        check=True, capture_output=True, text=True,
    )
    mobile = {item["caseId"]: item["output"] for item in json.loads(result.stdout)}
    failures = []
    for case in cases:
        try:
            server = evaluate(case["answers"])
            if mobile[case["caseId"]] != case["expectedOutput"]:
                failures.append(f"{case['caseId']}: TypeScript differs from expected output")
            if server != case["expectedOutput"]:
                failures.append(f"{case['caseId']}: Python differs from expected output")
            if server != mobile[case["caseId"]]:
                failures.append(f"{case['caseId']}: Python/TypeScript mismatch")
        except Exception as error:
            failures.append(f"{case['caseId']}: Python raised {type(error).__name__}: {error}")
    if failures:
        print("Gate parity FAILED. Implement docs/gate-contract.md before merging.")
        print("\n".join(failures[:8]))
        print(f"{len(failures)} discrepancies across {len(cases)} cases.")
        return 1
    print(f"Gate parity passed: {len(cases)} complete outputs match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
