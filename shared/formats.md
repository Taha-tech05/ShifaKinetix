# Agreed data formats

Status: draft, awaiting clinician review. These are the four formats agreed by the team.
Demo only, not for real patients.

## 1. Answer

```json
{ "questionId": "string", "type": "string", "value": "any", "state": "answered | unknown" }
```

`state` is `unknown` when the user says "not sure". An unknown answer to a key danger question must never produce `SAFE`.

## 2. Gate output

```json
{
  "verdict": "RED_FLAG | SAFE | CLARIFY",
  "firedRules": [ { "ruleId": "string", "matchedAnswers": ["questionId"], "source": "string" } ]
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
