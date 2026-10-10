# Agreed data formats

Status: draft, awaiting clinician review. These are the four formats agreed by the team.
Demo only, not for real patients.

## 1. Answer

```json
{ "questionId": "string", "type": "string", "value": "any", "state": "answered | unknown" }
```

`state` is `unknown` when the user says "not sure". An unknown answer to a key danger question must never produce `SAFE`.

Shoulder v1 adds optional `clarificationAttempted: boolean`. Unknown values are
always null; answered yes/no values are booleans. See
[`docs/gate-contract.md`](../docs/gate-contract.md) for exact typing, completeness,
uncertainty, validation and rule semantics. This v1 contract replaces the
placeholder equality-rule format and needs C's Python implementation.

## 2. Gate output

```json
{
  "verdict": "RED_FLAG | SAFE | CLARIFY",
  "firedRules": [ { "ruleId": "string", "matchedAnswers": ["questionId"], "source": "string", "reason": "string" } ]
}
```

## 3. Movement result

```json
{
  "movementId": "string",
  "painful": true,
  "weak": false,
  "unableToDo": false,
  "measuredAngle": 0,
  "state": "string"
}
```

`measuredAngle` is a number or `null` when no angle was measured.

## 4. Narrowing output

```json
{
  "candidates": [ { "muscleId": "string", "confidence": 0.0, "reason": "string" } ],
  "cluster": true
}
```

`cluster` is `true` or `false`.
