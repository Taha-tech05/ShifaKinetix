// Test-only TypeScript loader for the live app-signal gate. No LLM, network, or alternate gate implementation.
// Runs the real mobile pipeline on the shared raw fixtures:
//   structuredGateInputs -> withMovementUncertainty -> evaluateSessionGate
// The session store is stubbed: fixtures pass their movement results explicitly.
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === '../store/session') return { useSession: { getState: () => ({ movementResults: [] }) } };
  // gateInputs only needs question ids from the structure bank; its translations need react-native, so stub them.
  if (request === '../i18n') return { getLanguage: () => 'en' };
  return load.call(this, request, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  module._compile(source, filename);
};
const { evaluateSessionGate, safetyReviewToken, REVIEW_PREFIX } = require('../src/gate/sessionAdapter.ts');
const { withMovementUncertainty } = require('../src/gate/sessionEvaluator.ts');
const { structuredGateInputs } = require('../src/flow/gateInputs.ts');
const { cases } = require('../../shared/app_signal_test_cases.json');

const assemble = (answers, movements) =>
  withMovementUncertainty([...answers, ...structuredGateInputs(answers, movements)], movements);
// A review record as SafetySession writes it: the fingerprint of the evidence and answer it reviewed.
const reviews = (input, ids) => ids.map((id) => ({
  questionId: REVIEW_PREFIX + id, type: 'safety-review', state: 'answered', value: safetyReviewToken(input, id),
}));

process.stdout.write(JSON.stringify(cases.map((item) => {
  const input = assemble(item.answers, item.movements);
  // Stale reviews were made for an earlier state; their fingerprints no longer match the current evidence.
  const stale = item.staleReview
    ? reviews(assemble(item.staleReview.answers, item.staleReview.movements), item.staleReview.ids) : [];
  return { caseId: item.caseId, output: evaluateSessionGate([...input, ...stale, ...reviews(input, item.reviewed)]) };
})));
