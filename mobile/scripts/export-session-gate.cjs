// Test-only TypeScript loader for the live app-signal gate. No LLM, network, or alternate gate implementation.
// The session store is stubbed: fixtures pass their movement results explicitly.
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === '../store/session') return { useSession: { getState: () => ({ movementResults: [] }) } };
  return load.call(this, request, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  module._compile(source, filename);
};
const { evaluateSessionGate } = require('../src/gate/sessionAdapter.ts');
const { withMovementUncertainty } = require('../src/gate/sessionEvaluator.ts');
const { cases } = require('../../shared/app_signal_test_cases.json');
process.stdout.write(JSON.stringify(cases.map((item) => ({
  caseId: item.caseId,
  output: evaluateSessionGate(withMovementUncertainty(item.answers, item.movements)),
}))));
